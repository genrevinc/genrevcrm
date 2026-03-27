const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

// GET /api/contacts
router.get('/', async (req, res) => {
  try {
    const { search, owner_id, lifecycle_stage, company_id, page = 1, limit = 50, sort = 'created_at', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;
    let conditions = ['c.tenant_id = $1'];
    let params = [req.tenantId];
    let pi = 2;

    if (search) {
      conditions.push(`(c.first_name ILIKE $${pi} OR c.last_name ILIKE $${pi} OR c.email ILIKE $${pi} OR c.phone ILIKE $${pi})`);
      params.push(`%${search}%`); pi++;
    }
    if (owner_id) { conditions.push(`c.owner_id = $${pi++}`); params.push(owner_id); }
    if (lifecycle_stage) { conditions.push(`c.lifecycle_stage = $${pi++}`); params.push(lifecycle_stage); }
    if (company_id) { conditions.push(`c.company_id = $${pi++}`); params.push(company_id); }

    const where = conditions.join(' AND ');
    const allowedSorts = ['created_at', 'first_name', 'last_name', 'email', 'ai_score', 'last_contacted_at'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const orderDir = order === 'ASC' ? 'ASC' : 'DESC';

    const [contactsResult, countResult] = await Promise.all([
      query(`
        SELECT c.*, 
          co.name as company_name,
          u.full_name as owner_name,
          (SELECT COUNT(*) FROM deals d WHERE d.contact_id = c.id AND d.status = 'open') as open_deals_count
        FROM contacts c
        LEFT JOIN companies co ON c.company_id = co.id
        LEFT JOIN users u ON c.owner_id = u.id
        WHERE ${where}
        ORDER BY c.${sortCol} ${orderDir}
        LIMIT $${pi} OFFSET $${pi+1}
      `, [...params, limit, offset]),
      query(`SELECT COUNT(*) FROM contacts c WHERE ${where}`, params)
    ]);

    res.json({
      data: contactsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, 
        co.name as company_name,
        u.full_name as owner_name, u.email as owner_email
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE c.id = $1 AND c.tenant_id = $2
    `, [req.params.id, req.tenantId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });

    // Fetch related deals and activities
    const [deals, activities, tasks] = await Promise.all([
      query(`SELECT d.*, ps.name as stage_name, ps.color as stage_color FROM deals d LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id WHERE d.contact_id = $1 ORDER BY d.created_at DESC`, [req.params.id]),
      query(`SELECT a.*, u.full_name as user_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.related_to_type = 'contact' AND a.related_to_id = $1 ORDER BY a.occurred_at DESC LIMIT 20`, [req.params.id]),
      query(`SELECT t.*, u.full_name as assigned_to_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.related_to_type = 'contact' AND t.related_to_id = $1 AND t.status != 'completed' ORDER BY t.due_date ASC`, [req.params.id])
    ]);

    res.json({ ...result.rows[0], deals: deals.rows, activities: activities.rows, tasks: tasks.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, mobile, job_title, company_id, lead_source, lifecycle_stage, owner_id, tags, custom_fields, notes } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });

    const result = await query(`
      INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, mobile, job_title, company_id, lead_source, lifecycle_stage, owner_id, tags, custom_fields, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [req.tenantId, first_name, last_name, email, phone, mobile, job_title, company_id || null, lead_source, lifecycle_stage || 'lead', owner_id || req.user.id, tags || [], custom_fields || {}, notes]);

    // Log activity
    await query(`INSERT INTO activities (tenant_id, user_id, type, subject, related_to_type, related_to_id) VALUES ($1,$2,'contact_created','Contact created','contact',$3)`,
      [req.tenantId, req.user.id, result.rows[0].id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/contacts/:id
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['first_name','last_name','email','phone','mobile','job_title','company_id','lead_source','lifecycle_stage','owner_id','tags','custom_fields','notes','do_not_contact','ai_score','last_contacted_at'];
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
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.tenantId);
    const result = await query(
      `UPDATE contacts SET ${updates.join(', ')} WHERE id = $${pi++} AND tenant_id = $${pi} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM contacts WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.tenantId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contacts/:id/activities
router.post('/:id/activities', async (req, res) => {
  try {
    const { type, subject, body, direction, duration_sec, outcome } = req.body;
    const result = await query(`
      INSERT INTO activities (tenant_id, user_id, type, subject, body, direction, duration_sec, outcome, related_to_type, related_to_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'contact',$9) RETURNING *
    `, [req.tenantId, req.user.id, type, subject, body, direction || 'out', duration_sec, outcome, req.params.id]);
    await query('UPDATE contacts SET last_contacted_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
