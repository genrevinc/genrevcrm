const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Helper: call Claude API
async function callClaude(prompt, systemPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt || 'You are an expert B2B sales AI assistant. Always respond with valid JSON only. No markdown, no explanation.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// POST /api/ai/score-contact
// Scores a contact 0-100 and returns signals
router.post('/score-contact/:id', async (req, res) => {
  try {
    const contactResult = await query(`
      SELECT c.*,
        co.name as company_name, co.industry, co.employee_count, co.annual_revenue,
        (SELECT COUNT(*) FROM activities a WHERE a.related_to_type = 'contact' AND a.related_to_id = c.id) as activity_count,
        (SELECT COUNT(*) FROM activities a WHERE a.related_to_type = 'contact' AND a.related_to_id = c.id AND a.type = 'email') as email_count,
        (SELECT COUNT(*) FROM deals d WHERE d.contact_id = c.id) as deal_count,
        (SELECT COUNT(*) FROM deals d WHERE d.contact_id = c.id AND d.status = 'won') as won_deals,
        EXTRACT(DAY FROM NOW() - c.last_contacted_at) as days_since_contact
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = $1 AND c.tenant_id = $2
    `, [req.params.id, req.tenantId]);

    if (!contactResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const contact = contactResult.rows[0];

    // Try AI scoring first
    const aiResult = await callClaude(`
Score this B2B sales contact and return JSON with these exact fields:
{
  "score": <integer 0-100>,
  "grade": <"A"|"B"|"C"|"D">,
  "positive_signals": [<up to 3 short strings>],
  "negative_signals": [<up to 3 short strings>],
  "recommended_action": <one short sentence>
}

Contact data:
- Name: ${contact.first_name} ${contact.last_name}
- Job title: ${contact.job_title || 'Unknown'}
- Company: ${contact.company_name || 'Unknown'} (${contact.industry || 'Unknown industry'})
- Employees: ${contact.employee_count || 'Unknown'}
- Annual revenue: ${contact.annual_revenue ? '$' + contact.annual_revenue : 'Unknown'}
- Lead source: ${contact.lead_source || 'Unknown'}
- Lifecycle stage: ${contact.lifecycle_stage}
- Activities logged: ${contact.activity_count}
- Emails logged: ${contact.email_count}
- Days since last contact: ${Math.round(contact.days_since_contact) || 'Never contacted'}
- Open deals: ${contact.deal_count}
- Won deals: ${contact.won_deals}
`);

    // Fallback: rule-based scoring
    let score, grade, positiveSignals, negativeSignals, recommendedAction;

    if (aiResult) {
      score = aiResult.score;
      grade = aiResult.grade;
      positiveSignals = aiResult.positive_signals;
      negativeSignals = aiResult.negative_signals;
      recommendedAction = aiResult.recommended_action;
    } else {
      // Rule-based fallback
      score = 30;
      positiveSignals = [];
      negativeSignals = [];

      if (['CEO','CTO','VP','Director','Owner','President'].some(t => contact.job_title?.includes(t))) { score += 20; positiveSignals.push('Decision maker title'); }
      if (contact.company_name) { score += 10; positiveSignals.push('Company identified'); }
      if (contact.industry) { score += 5; positiveSignals.push('Industry known'); }
      if (contact.email_count > 2) { score += 10; positiveSignals.push(`${contact.email_count} email interactions`); }
      if (contact.activity_count > 3) { score += 10; positiveSignals.push('High engagement history'); }
      if (contact.won_deals > 0) { score += 15; positiveSignals.push('Previous deal won'); }
      if (contact.lead_source === 'Referral') { score += 10; positiveSignals.push('Referral source'); }
      if (!contact.last_contacted_at || contact.days_since_contact > 30) { score -= 15; negativeSignals.push('No recent contact'); }
      if (!contact.email) { score -= 10; negativeSignals.push('No email on file'); }
      if (contact.lifecycle_stage === 'lead') { score -= 5; negativeSignals.push('Not yet qualified'); }

      score = Math.max(0, Math.min(100, score));
      grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
      recommendedAction = score >= 70 ? 'Prioritize — schedule a call this week' : score >= 40 ? 'Follow up with value-add email' : 'Add to nurture sequence';
    }

    // Save score
    await query('UPDATE contacts SET ai_score = $1 WHERE id = $2', [score, req.params.id]);

    res.json({ score, grade, positive_signals: positiveSignals, negative_signals: negativeSignals, recommended_action: recommendedAction });
  } catch (err) {
    console.error('AI score error:', err);
    res.status(500).json({ error: 'Scoring failed' });
  }
});

// POST /api/ai/suggest-tasks/:dealId
// Suggests next best actions for a deal
router.post('/suggest-tasks/:dealId', async (req, res) => {
  try {
    const dealResult = await query(`
      SELECT d.*,
        ps.name as stage_name, ps.probability_default,
        c.first_name, c.last_name, c.job_title, c.email as contact_email,
        co.name as company_name, co.industry,
        (SELECT COUNT(*) FROM activities a WHERE a.related_to_type = 'deal' AND a.related_to_id = d.id) as activity_count,
        (SELECT MAX(a.occurred_at) FROM activities a WHERE a.related_to_type = 'deal' AND a.related_to_id = d.id) as last_activity,
        EXTRACT(DAY FROM NOW() - d.last_activity_at) as days_idle
      FROM deals d
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies co ON d.company_id = co.id
      WHERE d.id = $1 AND d.tenant_id = $2
    `, [req.params.dealId, req.tenantId]);

    if (!dealResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const deal = dealResult.rows[0];

    const aiResult = await callClaude(`
You are a B2B sales coach. Suggest 3 specific next actions for this deal.
Return JSON array with exactly 3 objects, each with:
{
  "title": <task title, max 60 chars>,
  "type": <"call"|"email"|"meeting"|"task">,
  "priority": <"high"|"medium"|"low">,
  "reason": <one sentence why this action, max 100 chars>,
  "due_in_days": <integer 1-14>
}

Deal info:
- Deal name: ${deal.name}
- Value: $${parseFloat(deal.value).toLocaleString()}
- Stage: ${deal.stage_name} (${deal.probability_default}% probability)
- Contact: ${deal.first_name || 'Unknown'} ${deal.last_name || ''}, ${deal.job_title || 'Unknown role'}
- Company: ${deal.company_name || 'Unknown'} (${deal.industry || 'Unknown industry'})
- Days idle: ${Math.round(deal.days_idle) || 0}
- Total activities: ${deal.activity_count}
- Expected close: ${deal.expected_close || 'Not set'}
`);

    // Fallback suggestions
    const fallback = [
      { title: 'Follow up call to check proposal status', type: 'call', priority: 'high', reason: 'No recent activity on this deal', due_in_days: 1 },
      { title: 'Send value-add case study or ROI data', type: 'email', priority: 'medium', reason: 'Reinforce why your solution fits their needs', due_in_days: 3 },
      { title: 'Schedule next steps meeting', type: 'meeting', priority: 'medium', reason: 'Define clear timeline and decision process', due_in_days: 7 },
    ];

    const suggestions = aiResult || fallback;
    res.json({ suggestions, deal_name: deal.name, stage: deal.stage_name });
  } catch (err) {
    console.error('AI suggest error:', err);
    res.status(500).json({ error: 'Suggestion failed' });
  }
});

// POST /api/ai/draft-email/:contactId
// Drafts a follow-up email
router.post('/draft-email/:contactId', async (req, res) => {
  try {
    const { context, email_type = 'follow_up' } = req.body;

    const contactResult = await query(`
      SELECT c.first_name, c.last_name, c.job_title, co.name as company_name, co.industry
      FROM contacts c LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = $1 AND c.tenant_id = $2
    `, [req.params.contactId, req.tenantId]);

    if (!contactResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const contact = contactResult.rows[0];

    const userResult = await query('SELECT full_name FROM users WHERE id = $1', [req.user.id]);
    const senderName = userResult.rows[0]?.full_name || 'The team';

    const aiResult = await callClaude(`
Draft a professional B2B sales email. Return JSON with:
{
  "subject": <email subject line>,
  "body": <email body, plain text, 3-5 short paragraphs, no markdown>
}

Email type: ${email_type}
Sender: ${senderName}
Recipient: ${contact.first_name} ${contact.last_name}, ${contact.job_title || 'decision maker'} at ${contact.company_name || 'their company'}
${contact.industry ? `Industry: ${contact.industry}` : ''}
${context ? `Additional context: ${context}` : ''}

Keep it concise, personal, and end with a clear call to action. Do not use [brackets] or placeholder text.
`);

    const fallback = {
      subject: `Following up — ${contact.first_name}`,
      body: `Hi ${contact.first_name},\n\nI wanted to follow up on our recent conversation and see if you had any questions or if there's anything I can help clarify.\n\nI'd love to find a time this week to connect and discuss how we can help ${contact.company_name || 'your team'} move forward.\n\nWould you be open to a quick 15-minute call?\n\nBest,\n${senderName}`
    };

    res.json(aiResult || fallback);
  } catch (err) {
    console.error('AI email error:', err);
    res.status(500).json({ error: 'Draft failed' });
  }
});

// POST /api/ai/score-all-contacts
// Bulk score all contacts (background job style)
router.post('/score-all', async (req, res) => {
  try {
    const contacts = await query(
      `SELECT id FROM contacts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.tenantId]
    );

    // Fire-and-forget scoring with rule-based fallback (fast)
    const results = [];
    for (const c of contacts.rows) {
      const actResult = await query(
        `SELECT COUNT(*) as cnt FROM activities WHERE related_to_type='contact' AND related_to_id=$1`, [c.id]
      );
      const actCount = parseInt(actResult.rows[0].cnt);
      const baseScore = 30 + Math.min(actCount * 8, 40) + Math.floor(Math.random() * 20);
      const score = Math.min(95, baseScore);
      await query('UPDATE contacts SET ai_score = $1 WHERE id = $2', [score, c.id]);
      results.push({ id: c.id, score });
    }

    res.json({ scored: results.length, message: `Scored ${results.length} contacts` });
  } catch (err) {
    res.status(500).json({ error: 'Bulk scoring failed' });
  }
});

// GET /api/ai/pipeline-health
// Analyzes whole pipeline and returns risk flags
router.get('/pipeline-health', async (req, res) => {
  try {
    const [idleDeals, noContact, highValue, staleProposals] = await Promise.all([
      query(`SELECT d.id, d.name, d.value, ps.name as stage_name, EXTRACT(DAY FROM NOW() - d.last_activity_at) as days_idle, u.full_name as owner_name
        FROM deals d LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id LEFT JOIN users u ON d.owner_id = u.id
        WHERE d.tenant_id = $1 AND d.status = 'open' AND d.last_activity_at < NOW() - INTERVAL '7 days'
        ORDER BY d.value DESC LIMIT 10`, [req.tenantId]),
      query(`SELECT d.id, d.name, d.value FROM deals d
        WHERE d.tenant_id = $1 AND d.status = 'open' AND d.contact_id IS NULL LIMIT 10`, [req.tenantId]),
      query(`SELECT d.id, d.name, d.value, ps.name as stage_name
        FROM deals d LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
        WHERE d.tenant_id = $1 AND d.status = 'open' AND d.value > 50000
        ORDER BY d.value DESC LIMIT 10`, [req.tenantId]),
      query(`SELECT d.id, d.name, d.value, EXTRACT(DAY FROM NOW() - d.last_activity_at) as days_idle
        FROM deals d JOIN pipeline_stages ps ON d.stage_id = ps.id
        WHERE d.tenant_id = $1 AND d.status = 'open' AND ps.name ILIKE '%proposal%' AND d.last_activity_at < NOW() - INTERVAL '5 days'
        ORDER BY d.value DESC LIMIT 5`, [req.tenantId]),
    ]);

    res.json({
      idle_deals: idleDeals.rows,
      no_contact_assigned: noContact.rows,
      high_value_deals: highValue.rows,
      stale_proposals: staleProposals.rows,
      summary: {
        total_idle: idleDeals.rows.length,
        total_no_contact: noContact.rows.length,
        total_stale_proposals: staleProposals.rows.length,
        high_value_at_risk: idleDeals.rows.filter(d => d.value > 50000).length,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;
