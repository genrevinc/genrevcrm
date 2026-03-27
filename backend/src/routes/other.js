const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

// ---- COMPANIES ----
const companiesRouter = express.Router();
companiesRouter.use(authenticate);

companiesRouter.get('/', async (req, res) => {
  try {
    const { search, industry, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let conditions = ['c.tenant_id = $1'];
    let params = [req.tenantId];
    let pi = 2;
    if (search) { conditions.push(`c.name ILIKE $${pi++}`); params.push(`%${search}%`); }
    if (industry) { conditions.push(`c.industry = $${pi++}`); params.push(industry); }
    const where = conditions.join(' AND ');
    const result = await query(`
      SELECT c.*, u.full_name as owner_name,
        (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) as contact_count,
        (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.status = 'open') as open_deals_count,
        (SELECT COALESCE(SUM(d.value),0) FROM deals d WHERE d.company_id = c.id AND d.status = 'open') as pipeline_value
      FROM companies c
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE ${where}
      ORDER BY c.name ASC
      LIMIT $${pi} OFFSET $${pi+1}
    `, [...params, limit, offset]);
    const countResult = await query(`SELECT COUNT(*) FROM companies c WHERE ${where}`, params);
    res.json({ data: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

companiesRouter.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, u.full_name as owner_name FROM companies c
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE c.id = $1 AND c.tenant_id = $2
    `, [req.params.id, req.tenantId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const [contacts, deals, activities] = await Promise.all([
      query('SELECT id, first_name, last_name, email, phone, job_title, lifecycle_stage FROM contacts WHERE company_id = $1', [req.params.id]),
      query(`SELECT d.*, ps.name as stage_name, ps.color as stage_color FROM deals d LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id WHERE d.company_id = $1 ORDER BY d.created_at DESC`, [req.params.id]),
      query(`SELECT a.*, u.full_name as user_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.related_to_type = 'company' AND a.related_to_id = $1 ORDER BY a.occurred_at DESC LIMIT 20`, [req.params.id])
    ]);
    res.json({ ...result.rows[0], contacts: contacts.rows, deals: deals.rows, activities: activities.rows });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

companiesRouter.post('/', async (req, res) => {
  try {
    const { name, domain, industry, employee_count, annual_revenue, website, phone, address, owner_id, type, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name required' });
    const result = await query(`
      INSERT INTO companies (tenant_id, name, domain, industry, employee_count, annual_revenue, website, phone, address, owner_id, type, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [req.tenantId, name, domain, industry, employee_count, annual_revenue, website, phone, address || {}, owner_id || req.user.id, type || 'prospect', notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

companiesRouter.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name','domain','industry','employee_count','annual_revenue','website','phone','address','owner_id','type','notes','tags'];
    const updates = []; const values = []; let pi = 1;
    for (const key of allowed) {
      if (req.body[key] !== undefined) { updates.push(`${key} = $${pi++}`); values.push(req.body[key]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.tenantId);
    const result = await query(`UPDATE companies SET ${updates.join(', ')} WHERE id = $${pi++} AND tenant_id = $${pi} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

companiesRouter.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM companies WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ---- TASKS ----
const tasksRouter = express.Router();
tasksRouter.use(authenticate);

tasksRouter.get('/', async (req, res) => {
  try {
    const { status, assigned_to, related_to_type, related_to_id, due_today } = req.query;
    let conditions = ['t.tenant_id = $1'];
    let params = [req.tenantId];
    let pi = 2;
    if (status) { conditions.push(`t.status = $${pi++}`); params.push(status); }
    else { conditions.push(`t.status != 'completed'`); }
    if (assigned_to) { conditions.push(`t.assigned_to = $${pi++}`); params.push(assigned_to); }
    if (related_to_type) { conditions.push(`t.related_to_type = $${pi++}`); params.push(related_to_type); }
    if (related_to_id) { conditions.push(`t.related_to_id = $${pi++}`); params.push(related_to_id); }
    if (due_today === 'true') { conditions.push(`DATE(t.due_date) = CURRENT_DATE`); }
    const where = conditions.join(' AND ');
    const result = await query(`
      SELECT t.*, u.full_name as assigned_to_name, u2.full_name as created_by_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE ${where}
      ORDER BY t.due_date ASC NULLS LAST, t.priority DESC
    `, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

tasksRouter.post('/', async (req, res) => {
  try {
    const { title, description, type, priority, assigned_to, due_date, related_to_type, related_to_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const result = await query(`
      INSERT INTO tasks (tenant_id, title, description, type, priority, assigned_to, created_by, due_date, related_to_type, related_to_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [req.tenantId, title, description, type || 'task', priority || 'medium', assigned_to || req.user.id, req.user.id, due_date || null, related_to_type, related_to_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

tasksRouter.patch('/:id', async (req, res) => {
  try {
    const { status, title, description, priority, due_date, assigned_to } = req.body;
    const updates = []; const values = []; let pi = 1;
    if (title !== undefined) { updates.push(`title = $${pi++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${pi++}`); values.push(description); }
    if (priority !== undefined) { updates.push(`priority = $${pi++}`); values.push(priority); }
    if (due_date !== undefined) { updates.push(`due_date = $${pi++}`); values.push(due_date); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${pi++}`); values.push(assigned_to); }
    if (status !== undefined) {
      updates.push(`status = $${pi++}`);
      values.push(status);
      if (status === 'completed') { updates.push(`completed_at = $${pi++}`); values.push(new Date()); }
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.tenantId);
    const result = await query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${pi++} AND tenant_id = $${pi} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

tasksRouter.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM tasks WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ---- DASHBOARD ----
const dashboardRouter = express.Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/stats', async (req, res) => {
  try {
    const tid = req.tenantId;
    const [
      pipelineValue, wonThisMonth, openDeals, winRate,
      tasksDueToday, recentActivities, stageBreakdown, repPerformance
    ] = await Promise.all([
      query(`SELECT COALESCE(SUM(value),0) as total FROM deals WHERE tenant_id = $1 AND status = 'open'`, [tid]),
      query(`SELECT COALESCE(SUM(value),0) as total, COUNT(*) as count FROM deals WHERE tenant_id = $1 AND status = 'won' AND DATE_TRUNC('month', actual_close) = DATE_TRUNC('month', NOW())`, [tid]),
      query(`SELECT COUNT(*) FROM deals WHERE tenant_id = $1 AND status = 'open'`, [tid]),
      query(`SELECT 
        CASE WHEN (won+lost) > 0 THEN ROUND(won * 100.0 / (won+lost)) ELSE 0 END as rate
        FROM (SELECT 
          COUNT(*) FILTER (WHERE status='won') as won,
          COUNT(*) FILTER (WHERE status='lost') as lost
          FROM deals WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '90 days'
        ) sub`, [tid]),
      query(`SELECT COUNT(*) FROM tasks WHERE tenant_id = $1 AND status != 'completed' AND DATE(due_date) = CURRENT_DATE`, [tid]),
      query(`SELECT a.*, u.full_name as user_name FROM activities a LEFT JOIN users u ON a.user_id = u.id WHERE a.tenant_id = $1 ORDER BY a.occurred_at DESC LIMIT 10`, [tid]),
      query(`SELECT ps.name, ps.color, COUNT(d.id) as deal_count, COALESCE(SUM(d.value),0) as total_value
        FROM pipeline_stages ps
        JOIN pipelines p ON ps.pipeline_id = p.id
        LEFT JOIN deals d ON d.stage_id = ps.id AND d.status = 'open'
        WHERE p.tenant_id = $1 AND p.is_default = true AND ps.is_won = false AND ps.is_lost = false
        GROUP BY ps.id, ps.name, ps.color, ps.position
        ORDER BY ps.position`, [tid]),
      query(`SELECT u.full_name, u.id,
        COUNT(d.id) FILTER (WHERE d.status='won') as won_count,
        COALESCE(SUM(d.value) FILTER (WHERE d.status='won'),0) as won_value,
        CASE WHEN COUNT(d.id) > 0 THEN ROUND(COUNT(d.id) FILTER (WHERE d.status='won') * 100.0 / COUNT(d.id)) ELSE 0 END as win_rate
        FROM users u
        LEFT JOIN deals d ON d.owner_id = u.id AND d.created_at > NOW() - INTERVAL '90 days'
        WHERE u.tenant_id = $1 AND u.is_active = true
        GROUP BY u.id, u.full_name
        ORDER BY won_value DESC
        LIMIT 10`, [tid])
    ]);

    res.json({
      pipeline_value: parseFloat(pipelineValue.rows[0].total),
      won_this_month: { value: parseFloat(wonThisMonth.rows[0].total), count: parseInt(wonThisMonth.rows[0].count) },
      open_deals: parseInt(openDeals.rows[0].count),
      win_rate: parseInt(winRate.rows[0]?.rate || 0),
      tasks_due_today: parseInt(tasksDueToday.rows[0].count),
      recent_activities: recentActivities.rows,
      stage_breakdown: stageBreakdown.rows,
      rep_performance: repPerformance.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forecast
dashboardRouter.get('/forecast', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COALESCE(SUM(value) FILTER (WHERE status = 'won' AND DATE_TRUNC('month', actual_close) = DATE_TRUNC('month', NOW())), 0) as won,
        COALESCE(SUM(value * probability / 100.0) FILTER (WHERE status = 'open' AND probability >= 75), 0) as commit_value,
        COALESCE(SUM(value * probability / 100.0) FILTER (WHERE status = 'open' AND probability >= 40), 0) as best_case,
        COALESCE(SUM(value * probability / 100.0) FILTER (WHERE status = 'open'), 0) as pipeline
      FROM deals WHERE tenant_id = $1
    `, [req.tenantId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Users list (for assignments)
const usersRouter = express.Router();
usersRouter.use(authenticate);
usersRouter.get('/', async (req, res) => {
  try {
    const result = await query('SELECT id, full_name, email, role, avatar_url, is_active FROM users WHERE tenant_id = $1 ORDER BY full_name', [req.tenantId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
usersRouter.post('/', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { full_name, email, role, password } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: 'Full name, email and password required' });
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (tenant_id, full_name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, full_name, email, role',
      [req.tenantId, full_name, email, hash, role || 'sales']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Activities feed
const activitiesRouter = express.Router();
activitiesRouter.use(authenticate);
activitiesRouter.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const result = await query(`
      SELECT a.*, u.full_name as user_name FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.tenant_id = $1
      ORDER BY a.occurred_at DESC
      LIMIT $2 OFFSET $3
    `, [req.tenantId, limit, offset]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Notifications
const notificationsRouter = express.Router();
notificationsRouter.use(authenticate);
notificationsRouter.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
notificationsRouter.patch('/:id/read', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
notificationsRouter.patch('/mark-all-read', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Products
const productsRouter = express.Router();
productsRouter.use(authenticate);
productsRouter.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM products WHERE tenant_id = $1 AND is_active = true ORDER BY name', [req.tenantId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
productsRouter.post('/', async (req, res) => {
  try {
    const { name, sku, description, unit_price, pricing_model, tax_rate, unit } = req.body;
    const result = await query(`INSERT INTO products (tenant_id, name, sku, description, unit_price, pricing_model, tax_rate, unit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.tenantId, name, sku, description, unit_price || 0, pricing_model || 'fixed', tax_rate || 0, unit || 'each']);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
productsRouter.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name','sku','description','unit_price','pricing_model','tax_rate','unit','is_active'];
    const updates = []; const values = []; let pi = 1;
    for (const key of allowed) {
      if (req.body[key] !== undefined) { updates.push(`${key} = $${pi++}`); values.push(req.body[key]); }
    }
    values.push(req.params.id, req.tenantId);
    const result = await query(`UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${pi++} AND tenant_id = $${pi} RETURNING *`, values);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Quotes
const quotesRouter = express.Router();
quotesRouter.use(authenticate);
quotesRouter.get('/', async (req, res) => {
  try {
    const { deal_id } = req.query;
    let where = 'q.tenant_id = $1';
    const params = [req.tenantId];
    if (deal_id) { where += ' AND q.deal_id = $2'; params.push(deal_id); }
    const result = await query(`SELECT q.*, d.name as deal_name, c.first_name, c.last_name FROM quotes q LEFT JOIN deals d ON q.deal_id = d.id LEFT JOIN contacts c ON q.contact_id = c.id WHERE ${where} ORDER BY q.created_at DESC`, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
quotesRouter.post('/', async (req, res) => {
  try {
    const { deal_id, contact_id, line_items = [], valid_until, terms, notes } = req.body;
    const subtotal = line_items.reduce((s, i) => s + (i.quantity * i.unit_price * (1 - (i.discount_pct || 0) / 100)), 0);
    const tax = line_items.reduce((s, i) => s + (i.quantity * i.unit_price * (i.tax_rate || 0) / 100), 0);
    const total = subtotal + tax;
    const quoteNum = 'Q-' + Date.now().toString().slice(-6);
    const result = await query(`INSERT INTO quotes (tenant_id, deal_id, contact_id, created_by, quote_number, subtotal, tax_amount, total, valid_until, terms, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.tenantId, deal_id, contact_id, req.user.id, quoteNum, subtotal, tax, total, valid_until, terms, notes]);
    for (let i = 0; i < line_items.length; i++) {
      const item = line_items[i];
      const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_pct || 0) / 100);
      await query(`INSERT INTO quote_line_items (quote_id, product_id, name, description, quantity, unit_price, discount_pct, tax_rate, total, position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [result.rows[0].id, item.product_id || null, item.name, item.description, item.quantity, item.unit_price, item.discount_pct || 0, item.tax_rate || 0, itemTotal, i]);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Pipelines
const pipelinesRouter = express.Router();
pipelinesRouter.use(authenticate);
pipelinesRouter.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT p.*, json_agg(ps ORDER BY ps.position) as stages FROM pipelines p LEFT JOIN pipeline_stages ps ON ps.pipeline_id = p.id WHERE p.tenant_id = $1 GROUP BY p.id ORDER BY p.is_default DESC`, [req.tenantId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = { companiesRouter, tasksRouter, dashboardRouter, usersRouter, activitiesRouter, notificationsRouter, productsRouter, quotesRouter, pipelinesRouter };
