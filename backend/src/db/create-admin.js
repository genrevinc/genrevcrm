/**
 * Run this in Railway terminal to create/reset the admin user
 * Usage: node backend/src/db/create-admin.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createAdmin() {
  const client = await pool.connect();
  try {
    console.log('Connected to database...');

    // Create extension
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create tenants table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        plan VARCHAR(50) DEFAULT 'pro',
        status VARCHAR(50) DEFAULT 'active',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create users table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        timezone VARCHAR(100) DEFAULT 'UTC',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Upsert tenant
    await client.query(`
      INSERT INTO tenants (name, slug, plan)
      VALUES ('GenRev', 'genrev', 'pro')
      ON CONFLICT (slug) DO UPDATE SET name = 'GenRev'
    `);

    const tenantRes = await client.query(`SELECT id FROM tenants WHERE slug = 'genrev'`);
    const tenantId = tenantRes.rows[0].id;
    console.log('Tenant ID:', tenantId);

    // Hash password
    const hash = await bcrypt.hash('Admin123!', 10);

    // Upsert admin user
    await client.query(`
      INSERT INTO users (tenant_id, email, password_hash, full_name, role)
      VALUES ($1, 'admin@genrevcrm.com', $2, 'Admin User', 'admin')
      ON CONFLICT (email) DO UPDATE SET
        password_hash = $2,
        tenant_id = $1,
        is_active = true,
        role = 'admin'
    `, [tenantId, hash]);

    console.log('');
    console.log('✅ Admin user created/reset successfully!');
    console.log('');
    console.log('   Email:    admin@genrevcrm.com');
    console.log('   Password: Admin123!');
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdmin();
