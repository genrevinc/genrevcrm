const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

// GET /api/deals
router.get('/', async (req, res) => {
  try {
    const { pipeline_id, stage_id, owner_id, status = 'open', search, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    let conditions = ['d.tenant_id = $1'];
    let params = [req.tenantId];
    let pi = 2;

    if (pipeline_id) { conditions.push(`d.pipeline_id = $${pi++}`); params.push(pipeline_id); }
    if (stage_id) { conditions.push(`d.stage_id = $${pi++}`); params.push(stage_id); }
    if (owner_id) { conditions.push(`d.owner_id = $${pi++}`); params.push(owner_id); }
    if (status) { conditions.push(`d.status = $${pi++}`); params.push(status); }
    if (search) { conditions.push(`d.name ILIKE $${pi++}`); params.push(`%${search}%`); }

    const where = conditions.join(' AND ');

    const result = await query(`
      SELECT d.*,
        ps.name as stage_name, ps.color as stage_color, ps.probability_default, ps.is_won, ps.is_lost, ps.position as stage_position,
        c.first_name, c.last_name, c.email as contact_email,
        co.name as company_name,
        u.full_name as owner_name,
        p.name as pipeline_name,
        EXTRACT(DAY FROM NOW() - d.last_activity_at) as days_idle
      FROM deals d
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies co ON d.company_id = co.id
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      WHERE ${where}
      ORDER BY ps.position ASC, d.value DESC
      LIMIT $${pi} OFFSET $${pi+1}
    `, [...params, limit, offset]);

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/deals/pipeline-view  (grouped by stage for kanban)
router.get('/pipeline-view', async (req, res) => {
  try {
    const { pipeline_id } = req.query;

    // Get pipeline stages
    let pipelineWhere = 'p.tenant_id = $1 AND p.is_default = true';
    let params = [req.tenantId];
    if (pipeline_id) { pipelineWhere = 'p.id = $2'; params.push(pipeline_id); }

    const stagesResult = await query(`
      SELECT ps.* FROM pipeline_stages ps
      JOIN pipelines p ON ps.pipeline_id = p.id
      WHERE ${pipelineWhere}
      ORDER BY ps.position ASC
    `, params);

    // Get deals with contact/company info
    const dealsResult = await query(`
      SELECT d.*,
        ps.name as stage_name, ps.color as stage_color, ps.position as stage_position, ps.is_won, ps.is_lost,
        c.first_name, c.last_name,
        co.name as company_name,
        u.full_name as owner_name,
        EXTRACT(DAY FROM NOW() - d.last_activity_at) as days_idle
      FROM deals d
      JOIN pipeline_stages ps ON d.stage_id = ps.id
      JOIN pipelines p ON ps.pipeline_id = p.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies co ON d.company_id = co.id
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.tenant_id = $1 AND d.status = 'open'
      ORDER BY d.value DESC
    `, [req.tenantId]);

    // Group deals by stage
    const stagesWithDeals = stagesResult.rows.map(stage => ({
      ...stage,
      deals: dealsResult.rows.filter(d => d.stage_id === stage.id),
      total_value: dealsResult.rows.filter(d => d.stage_id === stage.id).reduce((sum, d) => sum + parseFloat(d.value || 0), 0)
    }));

    res.json(stagesWithDeals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/deals/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT d.*,
        ps.name as stage_name, ps.color as stage_color, ps.position as stage_position, ps.is_won, ps.is_lost,
        c.first_name, c.last_name, c.email as contact_email, c.phone as contact_phone,
        co.name as company_name,
        u.full_name as owner_name,
        p.name as pipeline_name
      FROM deals d
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies co ON d.company_id = co.id
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      WHERE d.id = $1 AND d.tenant_id = $2
    `, [req.params.id, req.tenantId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });

    const [activities, tasks, quotes] = await Promise.all([
      query(`SELECT a.*, u.full_name as user_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.related_to_type = 'deal' AND a.related_to_id = $1 ORDER BY a.occurred_at DESC LIMIT 30`, [req.params.id]),
      query(`SELECT t.*, u.full_name as assigned_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.related_to_type = 'deal' AND t.related_to_id = $1 ORDER BY t.due_date ASC`, [req.params.id]),
      query(`SELECT * FROM quotes WHERE deal_id = $1 ORDER BY created_at DESC`, [req.params.id])
    ]);

    res.json({ ...result.rows[0], activities: activities.rows, tasks: tasks.rows, quotes: quotes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deals
router.post('/', async (req, res) => {
  try {
    const { name, value, pipeline_id, stage_id, contact_id, company_id, owner_id, expected_close, priority, deal_type, tags, custom_fields } = req.body;
    if (!name) return res.status(400).json({ error: 'Deal name required' });

    // Get default pipeline if not provided
    let pipeId = pipeline_id;
    let stageId = stage_id;
    if (!pipeId) {
      const pipeResult = await query('SELECT id FROM pipelines WHERE tenant_id = $1 AND is_default = true LIMIT 1', [req.tenantId]);
      pipeId = pipeResult.rows[0]?.id;
    }
    if (!stageId && pipeId) {
      const stageResult = await query('SELECT id FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY position ASC LIMIT 1', [pipeId]);
      stageId = stageResult.rows[0]?.id;
    }

    const probResult = await query('SELECT probability_default FROM pipeline_stages WHERE id = $1', [stageId]);
    const prob = probResult.rows[0]?.probability_default || 0;

    const result = await query(`
      INSERT INTO deals (tenant_id, name, value, pipeline_id, stage_id, contact_id, company_id, owner_id, expected_close, priority, deal_type, tags, custom_fields, probability)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [req.tenantId, name, value || 0, pipeId, stageId, contact_id || null, company_id || null, owner_id || req.user.id, expected_close || null, priority || 'medium', deal_type, tags || [], custom_fields || {}, prob]);

    await query(`INSERT INTO activities (tenant_id, user_id, type, subject, related_to_type, related_to_id) VALUES ($1,$2,'deal_created','Deal created','deal',$3)`,
      [req.tenantId, req.user.id, result.rows[0].id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/deals/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name','value','stage_id','contact_id','company_id','owner_id','expected_close','actual_close','priority','deal_type','tags','custom_fields','lost_reason','status','probability'];
    const updates = [];
    const values = [];
    let pi = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${pi++}`);
        values.push(req.body[key]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    // If stage changed, update probability and log activity
    if (req.body.stage_id) {
      const stageResult = await query('SELECT probability_default, name, is_won, is_lost FROM pipeline_stages WHERE id = $1', [req.body.stage_id]);
      if (stageResult.rows[0]) {
        const stage = stageResult.rows[0];
        if (!req.body.probability) {
          updates.push(`probability = $${pi++}`);
          values.push(stage.probability_default);
        }
        if (stage.is_won) {
          updates.push(`status = $${pi++}`, `actual_close = $${pi++}`);
          values.push('won', new Date());
        } else if (stage.is_lost) {
          updates.push(`status = $${pi++}`);
          values.push('lost');
        }
        await query(`INSERT INTO activities (tenant_id, user_id, type, subject, related_to_type, related_to_id) VALUES ($1,$2,'stage_change',$3,'deal',$4)`,
          [req.tenantId, req.user.id, `Moved to ${stage.name}`, req.params.id]);
      }
    }

    updates.push(`updated_at = NOW()`, `last_activity_at = NOW()`);
    values.push(req.params.id, req.tenantId);

    const result = await query(
      `UPDATE deals SET ${updates.join(', ')} WHERE id = $${pi++} AND tenant_id = $${pi} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/deals/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM deals WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deals/:id/activities
router.post('/:id/activities', async (req, res) => {
  try {
    const { type, subject, body, direction, duration_sec, outcome } = req.body;
    const result = await query(`
      INSERT INTO activities (tenant_id, user_id, type, subject, body, direction, duration_sec, outcome, related_to_type, related_to_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'deal',$9) RETURNING *
    `, [req.tenantId, req.user.id, type, subject, body, direction || 'out', duration_sec, outcome, req.params.id]);
    await query('UPDATE deals SET last_activity_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
