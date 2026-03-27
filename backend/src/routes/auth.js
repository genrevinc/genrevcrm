const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'genrevcrm-secret-change-in-prod';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await query(
      'SELECT u.*, t.name as tenant_name, t.slug as tenant_slug FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = $1 AND u.is_active = true',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign({ userId: user.id, tenantId: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
        tenant_slug: user.tenant_slug,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register (creates new tenant + admin)
router.post('/register', async (req, res) => {
  try {
    const { company_name, full_name, email, password } = req.body;
    if (!company_name || !full_name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const slug = company_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant
    const tenantResult = await query(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
      [company_name, slug]
    );
    const tenantId = tenantResult.rows[0].id;

    // Create admin user
    const userResult = await query(
      'INSERT INTO users (tenant_id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role',
      [tenantId, email.toLowerCase(), passwordHash, full_name, 'admin']
    );
    const user = userResult.rows[0];

    // Create default pipeline
    const pipelineResult = await query(
      'INSERT INTO pipelines (tenant_id, name, is_default) VALUES ($1, $2, true) RETURNING id',
      [tenantId, 'Sales Pipeline']
    );
    const pipelineId = pipelineResult.rows[0].id;

    // Default stages
    const stages = [
      ['New Lead', 1, 0, '#6366f1', false, false],
      ['Contacted', 2, 10, '#8b5cf6', false, false],
      ['Qualified', 3, 25, '#06b6d4', false, false],
      ['Discovery', 4, 40, '#0ea5e9', false, false],
      ['Proposal Sent', 5, 60, '#f59e0b', false, false],
      ['Negotiation', 6, 75, '#f97316', false, false],
      ['Won', 7, 100, '#10b981', true, false],
      ['Lost', 8, 0, '#ef4444', false, true],
      ['Nurture', 9, 5, '#94a3b8', false, false],
    ];
    for (const [name, position, prob, color, is_won, is_lost] of stages) {
      await query(
        'INSERT INTO pipeline_stages (pipeline_id, name, position, probability_default, color, is_won, is_lost) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [pipelineId, name, position, prob, color, is_won, is_lost]
      );
    }

    const token = jwt.sign({ userId: user.id, tenantId }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...user, tenant_id: tenantId, tenant_name: company_name } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const result = await query(
    'SELECT u.id, u.email, u.full_name, u.role, u.avatar_url, u.timezone, t.name as tenant_name, t.slug as tenant_slug, t.plan FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1',
    [req.user.id]
  );
  res.json(result.rows[0]);
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
