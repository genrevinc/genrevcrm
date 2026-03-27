const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/automations
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM automations WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.tenantId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/automations
router.post('/', async (req, res) => {
  try {
    const { name, description, trigger_type, trigger_config, conditions, actions } = req.body;
    if (!name || !trigger_type) return res.status(400).json({ error: 'Name and trigger required' });
    const result = await query(
      `INSERT INTO automations (tenant_id, created_by, name, description, trigger_type, trigger_config, conditions, actions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.tenantId, req.user.id, name, description, trigger_type, trigger_config || {}, JSON.stringify(conditions || []), JSON.stringify(actions || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/automations/:id
router.patch('/:id', async (req, res) => {
  try {
    const { name, description, trigger_type, trigger_config, conditions, actions, is_active } = req.body;
    const updates = []; const values = []; let pi = 1;
    if (name !== undefined) { updates.push(`name=$${pi++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description=$${pi++}`); values.push(description); }
    if (trigger_type !== undefined) { updates.push(`trigger_type=$${pi++}`); values.push(trigger_type); }
    if (trigger_config !== undefined) { updates.push(`trigger_config=$${pi++}`); values.push(trigger_config); }
    if (conditions !== undefined) { updates.push(`conditions=$${pi++}`); values.push(JSON.stringify(conditions)); }
    if (actions !== undefined) { updates.push(`actions=$${pi++}`); values.push(JSON.stringify(actions)); }
    if (is_active !== undefined) { updates.push(`is_active=$${pi++}`); values.push(is_active); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    updates.push(`updated_at=NOW()`);
    values.push(req.params.id, req.tenantId);
    const result = await query(
      `UPDATE automations SET ${updates.join(',')} WHERE id=$${pi++} AND tenant_id=$${pi} RETURNING *`, values
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/automations/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM automations WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/automations/trigger  (internal - called by event system)
router.post('/trigger', async (req, res) => {
  try {
    const { event_type, entity_type, entity_id, data } = req.body;

    // Find matching active automations
    const automations = await query(
      `SELECT * FROM automations WHERE tenant_id = $1 AND is_active = true AND trigger_type = $2`,
      [req.tenantId, event_type]
    );

    const results = [];
    for (const automation of automations.rows) {
      const conditions = typeof automation.conditions === 'string'
        ? JSON.parse(automation.conditions) : automation.conditions || [];
      const actions = typeof automation.actions === 'string'
        ? JSON.parse(automation.actions) : automation.actions || [];

      // Evaluate conditions
      let conditionsMet = true;
      for (const cond of conditions) {
        const val = data?.[cond.field];
        if (cond.operator === 'equals' && val !== cond.value) { conditionsMet = false; break; }
        if (cond.operator === 'not_equals' && val === cond.value) { conditionsMet = false; break; }
        if (cond.operator === 'contains' && !String(val || '').includes(cond.value)) { conditionsMet = false; break; }
        if (cond.operator === 'greater_than' && parseFloat(val) <= parseFloat(cond.value)) { conditionsMet = false; break; }
      }

      if (!conditionsMet) continue;

      // Execute actions
      const actionResults = [];
      for (const action of actions) {
        try {
          const result = await executeAction(action, entity_type, entity_id, req.tenantId, req.user.id, data);
          actionResults.push({ action: action.type, result });
        } catch (e) {
          actionResults.push({ action: action.type, error: e.message });
        }
      }

      // Update run count
      await query('UPDATE automations SET run_count = run_count + 1, last_run_at = NOW() WHERE id = $1', [automation.id]);
      results.push({ automation_id: automation.id, name: automation.name, actions_run: actionResults });
    }

    res.json({ triggered: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Trigger failed' });
  }
});

// Default automation templates
router.get('/templates', (req, res) => {
  res.json([
    {
      name: 'New lead → assign + create task',
      trigger_type: 'contact_created',
      trigger_config: {},
      conditions: [],
      actions: [
        { type: 'create_task', config: { title: 'Introduction call with {{first_name}}', type: 'call', priority: 'high', due_in_days: 1 } },
        { type: 'log_activity', config: { type: 'contact_created', subject: 'Lead entered CRM' } }
      ]
    },
    {
      name: 'Proposal sent → follow up in 3 days',
      trigger_type: 'stage_change',
      trigger_config: { stage_name: 'Proposal Sent' },
      conditions: [],
      actions: [
        { type: 'create_task', config: { title: 'Follow up on proposal for {{deal_name}}', type: 'email', priority: 'high', due_in_days: 3 } }
      ]
    },
    {
      name: 'Deal won → create onboarding task',
      trigger_type: 'deal_won',
      trigger_config: {},
      conditions: [],
      actions: [
        { type: 'create_task', config: { title: 'Kickoff onboarding for {{deal_name}}', type: 'task', priority: 'high', due_in_days: 1 } },
        { type: 'update_contact', config: { lifecycle_stage: 'customer' } }
      ]
    },
    {
      name: 'Deal idle 7 days → notify owner',
      trigger_type: 'deal_idle',
      trigger_config: { days: 7 },
      conditions: [],
      actions: [
        { type: 'create_notification', config: { message: 'Deal {{deal_name}} has been idle for 7 days' } },
        { type: 'create_task', config: { title: 'Re-engage: {{deal_name}}', type: 'call', priority: 'high', due_in_days: 1 } }
      ]
    },
    {
      name: 'Deal lost → move to nurture',
      trigger_type: 'deal_lost',
      trigger_config: {},
      conditions: [],
      actions: [
        { type: 'update_contact', config: { lifecycle_stage: 'nurture' } },
        { type: 'create_task', config: { title: 'Schedule re-engagement for {{contact_name}}', type: 'task', priority: 'low', due_in_days: 30 } }
      ]
    },
    {
      name: 'High-value deal → notify manager',
      trigger_type: 'deal_created',
      trigger_config: {},
      conditions: [{ field: 'value', operator: 'greater_than', value: '50000' }],
      actions: [
        { type: 'create_notification', config: { message: 'High-value deal created: {{deal_name}} (${{value}})' } }
      ]
    }
  ]);
});

async function executeAction(action, entityType, entityId, tenantId, userId, data) {
  switch (action.type) {
    case 'create_task': {
      const title = (action.config.title || 'Follow up')
        .replace('{{deal_name}}', data?.name || '')
        .replace('{{first_name}}', data?.first_name || '')
        .replace('{{contact_name}}', `${data?.first_name || ''} ${data?.last_name || ''}`.trim());

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (action.config.due_in_days || 1));

      await query(
        `INSERT INTO tasks (tenant_id, title, type, priority, assigned_to, created_by, due_date, related_to_type, related_to_id, description)
         VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9)`,
        [tenantId, title, action.config.type || 'task', action.config.priority || 'medium', userId, dueDate, entityType, entityId, action.config.description || 'Created by automation']
      );
      return 'task created';
    }
    case 'update_contact': {
      if (entityType === 'contact' && entityId) {
        const updates = Object.entries(action.config).map(([k, v], i) => `${k} = $${i + 2}`).join(', ');
        const values = [entityId, ...Object.values(action.config)];
        if (updates) await query(`UPDATE contacts SET ${updates}, updated_at = NOW() WHERE id = $1`, values);
      }
      return 'contact updated';
    }
    case 'log_activity': {
      await query(
        `INSERT INTO activities (tenant_id, user_id, type, subject, related_to_type, related_to_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, userId, action.config.type || 'automation', action.config.subject || 'Automated action', entityType, entityId]
      );
      return 'activity logged';
    }
    case 'create_notification': {
      const message = (action.config.message || 'Automation triggered')
        .replace('{{deal_name}}', data?.name || '')
        .replace('{{value}}', data?.value || '');
      await query(
        `INSERT INTO notifications (tenant_id, user_id, type, title, related_to_type, related_to_id) VALUES ($1,$2,'automation',$3,$4,$5)`,
        [tenantId, userId, message, entityType, entityId]
      );
      return 'notification sent';
    }
    default:
      return `unknown action: ${action.type}`;
  }
}

module.exports = router;
