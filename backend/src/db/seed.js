/**
 * Optional: seed demo data so you can explore the CRM immediately
 * Run: node backend/src/db/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./index');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding demo data...');

    // Get tenant
    const tenantRes = await client.query(`SELECT id FROM tenants LIMIT 1`);
    const tenantId = tenantRes.rows[0]?.id;
    if (!tenantId) { console.error('No tenant found. Run migrations first.'); return; }

    // Get admin user
    const adminRes = await client.query(`SELECT id FROM users WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    const adminId = adminRes.rows[0]?.id;

    // Get pipeline stages
    const stagesRes = await client.query(`SELECT ps.id, ps.name FROM pipeline_stages ps JOIN pipelines p ON ps.pipeline_id = p.id WHERE p.tenant_id = $1 ORDER BY ps.position`, [tenantId]);
    const stages = stagesRes.rows;
    const stageMap = Object.fromEntries(stages.map(s => [s.name, s.id]));

    // Seed companies
    const companies = [
      ['Apex Renewable Energy', 'apex-renewable.com', 'Energy / BESS', 250, 18000000],
      ['NovaTech Solutions', 'novatech.io', 'Technology', 85, 5500000],
      ['Summit Auto Group', 'summitauto.com', 'Automotive', 120, 22000000],
      ['Greenwave Energy', 'greenwave.energy', 'Solar', 45, 3200000],
      ['Atlas Telecom', 'atlastelecom.net', 'Telecom', 600, 95000000],
      ['Delta Contractors', 'deltacontractors.com', 'Construction', 38, 8400000],
      ['Pinnacle BESS', 'pinnacleBESS.com', 'Energy / BESS', 30, 4100000],
      ['Vertex Consulting', 'vertexconsulting.co', 'Consulting', 22, 2900000],
    ];

    const companyIds = [];
    for (const [name, domain, industry, employees, revenue] of companies) {
      const r = await client.query(
        `INSERT INTO companies (tenant_id, name, domain, industry, employee_count, annual_revenue, owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [tenantId, name, domain, industry, employees, revenue, adminId]
      );
      companyIds.push(r.rows[0].id);
    }
    console.log(`  ✓ ${companies.length} companies`);

    // Seed contacts
    const contacts = [
      ['James', 'Patterson', 'james@apex-renewable.com', 'CEO', 'Referral', 0],
      ['Sarah', 'Mitchell', 'sarah@novatech.io', 'VP of Operations', 'Website', 1],
      ['Mike', 'Torres', 'mike@summitauto.com', 'Owner', 'Trade show', 2],
      ['Emma', 'Chen', 'emma@greenwave.energy', 'Director of Procurement', 'LinkedIn', 3],
      ['Robert', 'Walsh', 'robert@atlastelecom.net', 'CTO', 'Cold outreach', 4],
      ['Linda', 'Brooks', 'linda@deltacontractors.com', 'Project Manager', 'Referral', 5],
      ['David', 'Nguyen', 'david@pinnacleBESS.com', 'CEO', 'Website', 6],
      ['Rachel', 'Kim', 'rachel@vertexconsulting.co', 'Managing Partner', 'Partner', 7],
    ];

    const contactIds = [];
    for (const [first, last, email, title, source, coIdx] of contacts) {
      const score = Math.floor(Math.random() * 50 + 40);
      const r = await client.query(
        `INSERT INTO contacts (tenant_id, first_name, last_name, email, job_title, lead_source, lifecycle_stage, company_id, owner_id, ai_score) VALUES ($1,$2,$3,$4,$5,$6,'qualified',$7,$8,$9) RETURNING id`,
        [tenantId, first, last, email, title, source, companyIds[coIdx], adminId, score]
      );
      contactIds.push(r.rows[0].id);
    }
    console.log(`  ✓ ${contacts.length} contacts`);

    // Seed deals across stages
    const dealData = [
      ['BESS Installation — Apex Renewable', 85000, 'Proposal Sent', 0, 0, 30],
      ['CRM Integration — NovaTech', 24000, 'Qualified', 1, 1, 45],
      ['Fleet Management System — Summit Auto', 48000, 'Discovery', 2, 2, 60],
      ['Solar Monitoring Platform — Greenwave', 32000, 'Negotiation', 3, 3, 14],
      ['Network Infrastructure — Atlas Telecom', 140000, 'Negotiation', 4, 4, 21],
      ['Project Tracking Suite — Delta', 18500, 'Won', 5, 5, null],
      ['BESS Control System — Pinnacle', 95000, 'Proposal Sent', 6, 6, 5],
      ['Strategy Consulting — Vertex', 12000, 'Contacted', 7, 7, 90],
      ['Energy Analytics — Greenwave', 27000, 'New Lead', 3, 3, 3],
      ['Telecom Audit — Atlas', 55000, 'Qualified', 4, 4, 50],
    ];

    for (const [name, value, stageName, contactIdx, coIdx, idleDays] of dealData) {
      const stageId = stageMap[stageName];
      if (!stageId) continue;
      const probMap = { 'New Lead': 0, 'Contacted': 10, 'Qualified': 25, 'Discovery': 40, 'Proposal Sent': 60, 'Negotiation': 75, 'Won': 100 };
      const prob = probMap[stageName] || 0;
      const closeDate = new Date(); closeDate.setDate(closeDate.getDate() + 30 + Math.floor(Math.random() * 60));
      const lastActivity = idleDays ? new Date(Date.now() - idleDays * 86400000) : new Date();
      const status = stageName === 'Won' ? 'won' : 'open';
      await client.query(
        `INSERT INTO deals (tenant_id, name, value, pipeline_id, stage_id, contact_id, company_id, owner_id, probability, expected_close, status, last_activity_at)
         SELECT $1,$2,$3, p.id,$4,$5,$6,$7,$8,$9,$10,$11 FROM pipelines p WHERE p.tenant_id=$1 AND p.is_default=true LIMIT 1`,
        [tenantId, name, value, stageId, contactIds[contactIdx], companyIds[coIdx], adminId, prob, closeDate, status, lastActivity]
      );
    }
    console.log(`  ✓ ${dealData.length} deals`);

    // Seed some tasks
    const tasks = [
      ['Follow up call — Apex BESS proposal', 'call', 'high', 0],
      ['Send revised pricing — Atlas Telecom', 'email', 'high', 1],
      ['Discovery call — Greenwave Energy', 'meeting', 'medium', 2],
      ['Prepare ROI deck — Pinnacle BESS', 'task', 'medium', 3],
      ['Check in — NovaTech CRM', 'email', 'low', 4],
    ];
    for (const [title, type, priority, daysAhead] of tasks) {
      const due = new Date(); due.setDate(due.getDate() + daysAhead);
      await client.query(
        `INSERT INTO tasks (tenant_id, title, type, priority, assigned_to, created_by, due_date) VALUES ($1,$2,$3,$4,$5,$5,$6)`,
        [tenantId, title, type, priority, adminId, due]
      );
    }
    console.log(`  ✓ ${tasks.length} tasks`);

    // Seed some activities
    const activityTypes = ['call', 'email', 'note', 'meeting'];
    const subjects = ['Introduction call completed', 'Sent product overview deck', 'Discussed requirements', 'Proposal walkthrough meeting', 'Follow-up email sent', 'Discovery call notes'];
    for (let i = 0; i < 12; i++) {
      const type = activityTypes[i % activityTypes.length];
      const subject = subjects[i % subjects.length];
      const daysAgo = Math.floor(Math.random() * 14);
      const occurred = new Date(Date.now() - daysAgo * 86400000);
      await client.query(
        `INSERT INTO activities (tenant_id, user_id, type, subject, related_to_type, related_to_id, occurred_at) VALUES ($1,$2,$3,$4,'contact',$5,$6)`,
        [tenantId, adminId, type, subject, contactIds[i % contactIds.length], occurred]
      );
    }
    console.log(`  ✓ 12 activities`);

    // Seed a product catalog
    const products = [
      ['BESS 100kWh Unit', 'BESS-100', 'Battery Energy Storage System 100kWh', 38000, 'each'],
      ['BESS Installation Service', 'SVC-INST', 'Professional installation and commissioning', 12000, 'project'],
      ['Annual Maintenance Contract', 'SVC-MAINT', 'Annual preventive maintenance and monitoring', 4800, 'year'],
      ['CRM License — Pro', 'CRM-PRO', 'Per seat annual license', 1200, 'year'],
      ['Implementation & Training', 'SVC-IMPL', 'Full onboarding and staff training', 8500, 'project'],
      ['Solar Monitoring Platform', 'SOL-MON', 'Real-time solar production monitoring', 299, 'month'],
    ];
    for (const [name, sku, desc, price, unit] of products) {
      await client.query(
        `INSERT INTO products (tenant_id, name, sku, description, unit_price, unit) VALUES ($1,$2,$3,$4,$5,$6)`,
        [tenantId, name, sku, desc, price, unit]
      );
    }
    console.log(`  ✓ ${products.length} products`);

    console.log('\n✅ Demo data seeded successfully!');
    console.log('   Login: admin@genrevcrm.com / Admin123!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
