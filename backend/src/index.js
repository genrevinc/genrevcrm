require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const dealsRoutes = require('./routes/deals');
const aiRoutes = require('./routes/ai');
const automationsRoutes = require('./routes/automations');
const {
  companiesRouter, tasksRouter, dashboardRouter, usersRouter,
  activitiesRouter, notificationsRouter, productsRouter, quotesRouter, pipelinesRouter
} = require('./routes/other');
const { pool } = require('./db');
const { startJobs } = require('./jobs');

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 1 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/companies', companiesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/users', usersRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/products', productsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/pipelines', pipelinesRouter);
app.use('/api/ai', aiRoutes);
app.use('/api/automations', automationsRoutes);

// Serve React frontend — try multiple possible dist paths
const possibleDistPaths = [
  path.join(__dirname, '../../frontend/dist'),
  path.join(__dirname, '../../../frontend/dist'),
  path.join(process.cwd(), 'frontend/dist'),
  '/app/frontend/dist',
];

let distPath = null;
for (const p of possibleDistPaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
    distPath = p;
    console.log(`✅ Serving frontend from: ${distPath}`);
    break;
  }
}

if (distPath) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('⚠️  Frontend dist not found. Checked:', possibleDistPaths);
  app.get('/', (req, res) => res.json({ 
    status: 'GenRev API running', 
    message: 'Frontend build not found',
    checked_paths: possibleDistPaths,
    cwd: process.cwd(),
    dirname: __dirname
  }));
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Run schema migrations
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    const tables = [
      `CREATE TABLE IF NOT EXISTS tenants (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(255) NOT NULL, slug VARCHAR(100) UNIQUE NOT NULL, plan VARCHAR(50) DEFAULT 'starter', status VARCHAR(50) DEFAULT 'active', settings JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(255) NOT NULL, role VARCHAR(50) DEFAULT 'sales', avatar_url TEXT, timezone VARCHAR(100) DEFAULT 'UTC', is_active BOOLEAN DEFAULT true, last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS companies (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, domain VARCHAR(255), industry VARCHAR(100), employee_count INTEGER, annual_revenue NUMERIC(15,2), website VARCHAR(255), phone VARCHAR(50), address JSONB DEFAULT '{}', owner_id UUID REFERENCES users(id), type VARCHAR(50) DEFAULT 'prospect', logo_url TEXT, tags TEXT[] DEFAULT '{}', custom_fields JSONB DEFAULT '{}', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS contacts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, company_id UUID REFERENCES companies(id) ON DELETE SET NULL, owner_id UUID REFERENCES users(id), first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(255), phone VARCHAR(50), mobile VARCHAR(50), job_title VARCHAR(150), lead_source VARCHAR(100), lifecycle_stage VARCHAR(50) DEFAULT 'lead', ai_score INTEGER DEFAULT 0, tags TEXT[] DEFAULT '{}', custom_fields JSONB DEFAULT '{}', do_not_contact BOOLEAN DEFAULT false, last_contacted_at TIMESTAMPTZ, address JSONB DEFAULT '{}', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS pipelines (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, is_default BOOLEAN DEFAULT false, deal_currency CHAR(3) DEFAULT 'USD', created_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS pipeline_stages (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, position INTEGER NOT NULL, probability_default INTEGER DEFAULT 0, is_won BOOLEAN DEFAULT false, is_lost BOOLEAN DEFAULT false, color VARCHAR(7) DEFAULT '#6366f1', required_fields TEXT[] DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS deals (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, pipeline_id UUID REFERENCES pipelines(id), stage_id UUID REFERENCES pipeline_stages(id), contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL, company_id UUID REFERENCES companies(id) ON DELETE SET NULL, owner_id UUID REFERENCES users(id), name VARCHAR(255) NOT NULL, value NUMERIC(15,2) DEFAULT 0, currency CHAR(3) DEFAULT 'USD', probability INTEGER DEFAULT 0, expected_close DATE, actual_close DATE, deal_type VARCHAR(50), priority VARCHAR(20) DEFAULT 'medium', status VARCHAR(20) DEFAULT 'open', lost_reason TEXT, tags TEXT[] DEFAULT '{}', custom_fields JSONB DEFAULT '{}', last_activity_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS tasks (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, assigned_to UUID REFERENCES users(id), created_by UUID REFERENCES users(id), related_to_type VARCHAR(50), related_to_id UUID, title VARCHAR(500) NOT NULL, description TEXT, type VARCHAR(50) DEFAULT 'task', priority VARCHAR(20) DEFAULT 'medium', status VARCHAR(50) DEFAULT 'open', due_date TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS activities (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id), type VARCHAR(50) NOT NULL, subject VARCHAR(500), body TEXT, direction VARCHAR(10) DEFAULT 'out', duration_sec INTEGER, outcome VARCHAR(100), related_to_type VARCHAR(50), related_to_id UUID, metadata JSONB DEFAULT '{}', occurred_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, sku VARCHAR(100), description TEXT, unit_price NUMERIC(15,2) NOT NULL DEFAULT 0, pricing_model VARCHAR(50) DEFAULT 'fixed', tax_rate NUMERIC(5,2) DEFAULT 0, unit VARCHAR(50) DEFAULT 'each', is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS quotes (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, deal_id UUID REFERENCES deals(id) ON DELETE CASCADE, contact_id UUID REFERENCES contacts(id), created_by UUID REFERENCES users(id), quote_number VARCHAR(50) UNIQUE, status VARCHAR(50) DEFAULT 'draft', subtotal NUMERIC(15,2) DEFAULT 0, tax_amount NUMERIC(15,2) DEFAULT 0, discount_amount NUMERIC(15,2) DEFAULT 0, total NUMERIC(15,2) DEFAULT 0, currency CHAR(3) DEFAULT 'USD', valid_until DATE, terms TEXT, notes TEXT, sent_at TIMESTAMPTZ, viewed_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS quote_line_items (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE, product_id UUID REFERENCES products(id), name VARCHAR(255) NOT NULL, description TEXT, quantity NUMERIC(10,2) DEFAULT 1, unit_price NUMERIC(15,2) NOT NULL, discount_pct NUMERIC(5,2) DEFAULT 0, tax_rate NUMERIC(5,2) DEFAULT 0, total NUMERIC(15,2) NOT NULL, position INTEGER DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS automations (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, created_by UUID REFERENCES users(id), name VARCHAR(255) NOT NULL, description TEXT, trigger_type VARCHAR(100) NOT NULL, trigger_config JSONB DEFAULT '{}', conditions JSONB DEFAULT '[]', actions JSONB DEFAULT '[]', is_active BOOLEAN DEFAULT true, run_count INTEGER DEFAULT 0, last_run_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id) ON DELETE CASCADE, type VARCHAR(100) NOT NULL, title VARCHAR(500) NOT NULL, body TEXT, link TEXT, is_read BOOLEAN DEFAULT false, related_to_type VARCHAR(50), related_to_id UUID, created_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS audit_log (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id), action VARCHAR(100) NOT NULL, resource_type VARCHAR(100), resource_id UUID, diff JSONB DEFAULT '{}', ip_address INET, user_agent TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    ];
    for (const sql of tables) await client.query(sql);
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id)`,
      `CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)`,
      `CREATE INDEX IF NOT EXISTS idx_activities_related ON activities(related_to_type, related_to_id)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`,
    ];
    for (const idx of indexes) await client.query(idx);

    // Unique constraint to prevent duplicate pipeline stages on re-deploy
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE pipeline_stages ADD CONSTRAINT uq_pipeline_stage_pos UNIQUE (pipeline_id, position);
      EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`INSERT INTO tenants (name, slug, plan) VALUES ('GenRev', 'genrev', 'pro') ON CONFLICT (slug) DO NOTHING`);
    const tenantRes = await client.query(`SELECT id FROM tenants WHERE slug = 'genrev' LIMIT 1`);
    const tenantId = tenantRes.rows[0]?.id;
    if (tenantId) {
        // Fixed pipeline ID — same every deploy, no duplicates ever
      const PIPELINE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

      // Upsert pipeline
      await client.query(`
        INSERT INTO pipelines (id, tenant_id, name, is_default)
        VALUES ($1, $2, 'Sales Pipeline', true)
        ON CONFLICT (id) DO NOTHING
      `, [PIPELINE_ID, tenantId]);

      // ALWAYS delete and re-insert stages cleanly — idempotent
      await client.query(`DELETE FROM pipeline_stages WHERE pipeline_id = $1`, [PIPELINE_ID]);

      const stages = [
        ['New Lead',1,0,'#6366f1',false,false],
        ['Contacted',2,10,'#8b5cf6',false,false],
        ['Qualified',3,25,'#06b6d4',false,false],
        ['Discovery',4,40,'#0ea5e9',false,false],
        ['Proposal Sent',5,60,'#f59e0b',false,false],
        ['Negotiation',6,75,'#f97316',false,false],
        ['Won',7,100,'#10b981',true,false],
        ['Lost',8,0,'#ef4444',false,true],
        ['Nurture',9,5,'#94a3b8',false,false]
      ];
      for (const [name,pos,prob,color,won,lost] of stages) {
        await client.query(
          `INSERT INTO pipeline_stages (pipeline_id, name, position, probability_default, color, is_won, is_lost) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [PIPELINE_ID, name, pos, prob, color, won, lost]
        );
      }
      console.log('✅ Pipeline stages synced (9 stages)');
      await client.query(`INSERT INTO users (tenant_id, email, password_hash, full_name, role) VALUES ($1, 'admin@genrevcrm.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lVWy', 'Admin User', 'admin') ON CONFLICT (email) DO NOTHING`, [tenantId]);
    }
    console.log('✅ Database migrations complete');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    client.release();
  }
}

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
    await runMigrations();
  } catch (err) {
    console.error('⚠️  Database connection failed:', err.message);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GenRev running on port ${PORT}`);
    startJobs();
  });
}

startServer();
