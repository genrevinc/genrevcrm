const { query } = require('./db');

// Run every 15 minutes in production
const JOB_INTERVAL = 15 * 60 * 1000;

async function checkIdleDeals() {
  try {
    // Find deals idle for 7+ days and create notifications
    const idleDeals = await query(`
      SELECT d.id, d.name, d.value, d.owner_id, d.tenant_id,
        EXTRACT(DAY FROM NOW() - d.last_activity_at) as days_idle
      FROM deals d
      WHERE d.status = 'open'
        AND d.last_activity_at < NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.related_to_id = d.id
            AND n.type = 'idle_deal'
            AND n.created_at > NOW() - INTERVAL '7 days'
        )
      LIMIT 50
    `);

    for (const deal of idleDeals.rows) {
      await query(
        `INSERT INTO notifications (tenant_id, user_id, type, title, body, related_to_type, related_to_id)
         VALUES ($1, $2, 'idle_deal', $3, $4, 'deal', $5)`,
        [
          deal.tenant_id,
          deal.owner_id,
          `Deal idle: ${deal.name}`,
          `"${deal.name}" ($${parseFloat(deal.value).toLocaleString()}) has had no activity for ${Math.round(deal.days_idle)} days.`,
          deal.id
        ]
      );
    }

    if (idleDeals.rows.length > 0) {
      console.log(`[Jobs] Notified owners of ${idleDeals.rows.length} idle deals`);
    }
  } catch (err) {
    console.error('[Jobs] Idle deal check failed:', err.message);
  }
}

async function checkOverdueTasks() {
  try {
    const overdue = await query(`
      SELECT t.id, t.title, t.assigned_to, t.tenant_id
      FROM tasks t
      WHERE t.status = 'open'
        AND t.due_date < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.related_to_id = t.id
            AND n.type = 'overdue_task'
            AND n.created_at > NOW() - INTERVAL '24 hours'
        )
      LIMIT 50
    `);

    for (const task of overdue.rows) {
      await query(
        `INSERT INTO notifications (tenant_id, user_id, type, title, related_to_type, related_to_id)
         VALUES ($1, $2, 'overdue_task', $3, 'task', $4)`,
        [task.tenant_id, task.assigned_to, `Overdue: ${task.title}`, task.id]
      );
    }
  } catch (err) {
    console.error('[Jobs] Overdue task check failed:', err.message);
  }
}

async function scoreNewContacts() {
  try {
    // Score contacts that have no AI score yet
    const unscored = await query(`
      SELECT c.id,
        (SELECT COUNT(*) FROM activities a WHERE a.related_to_type='contact' AND a.related_to_id=c.id) as activity_count,
        (SELECT COUNT(*) FROM deals d WHERE d.contact_id=c.id AND d.status='won') as won_deals,
        c.lead_source, c.lifecycle_stage, c.email, c.job_title
      FROM contacts c
      WHERE c.ai_score = 0 OR c.ai_score IS NULL
      LIMIT 20
    `);

    for (const c of unscored.rows) {
      let score = 25;
      if (c.email) score += 10;
      if (c.job_title && ['CEO','CTO','VP','Director','Owner','President'].some(t => c.job_title.includes(t))) score += 20;
      if (c.lead_source === 'Referral') score += 15;
      if (parseInt(c.activity_count) > 3) score += 15;
      if (parseInt(c.won_deals) > 0) score += 15;
      if (c.lifecycle_stage === 'qualified') score += 10;
      if (c.lifecycle_stage === 'customer') score += 20;
      score = Math.min(95, Math.max(10, score + Math.floor(Math.random() * 10)));
      await query('UPDATE contacts SET ai_score = $1 WHERE id = $2', [score, c.id]);
    }
  } catch (err) {
    console.error('[Jobs] Auto-scoring failed:', err.message);
  }
}

function startJobs() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Jobs] Background jobs running in dev mode (reduced interval)');
  }

  // Run immediately on start
  setTimeout(async () => {
    await scoreNewContacts();
    await checkIdleDeals();
    await checkOverdueTasks();
  }, 5000);

  // Then on interval
  setInterval(async () => {
    await checkIdleDeals();
    await checkOverdueTasks();
    await scoreNewContacts();
  }, JOB_INTERVAL);

  console.log('[Jobs] Background jobs started');
}

module.exports = { startJobs };
