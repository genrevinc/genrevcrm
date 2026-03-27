import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Bot, Zap, TrendingDown, AlertCircle, CheckCircle, Mail, Star, RefreshCw } from 'lucide-react'

function PipelineHealthCard({ health, loading }) {
  if (loading) return <div className="card p-6 flex items-center justify-center h-48"><div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!health) return null
  const { summary, idle_deals, stale_proposals, no_contact_assigned } = health

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bot size={16} className="text-indigo-600" />
        <h2 className="font-semibold text-slate-800 text-sm">AI Pipeline Health Check</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className={`rounded-xl p-3 text-center ${summary.total_idle > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`text-2xl font-bold ${summary.total_idle > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{summary.total_idle}</p>
          <p className={`text-xs mt-0.5 ${summary.total_idle > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Idle 7+ days</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${summary.total_stale_proposals > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`text-2xl font-bold ${summary.total_stale_proposals > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{summary.total_stale_proposals}</p>
          <p className={`text-xs mt-0.5 ${summary.total_stale_proposals > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>Stale proposals</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${summary.total_no_contact > 0 ? 'bg-slate-50 border border-slate-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`text-2xl font-bold text-slate-700`}>{summary.total_no_contact}</p>
          <p className="text-xs text-slate-500 mt-0.5">No contact</p>
        </div>
      </div>

      {idle_deals.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Idle deals — act now</p>
          <div className="space-y-2">
            {idle_deals.slice(0, 4).map(d => (
              <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center gap-3 p-2.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
                <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-red-800 truncate">{d.name}</p>
                  <p className="text-xs text-red-500">{d.stage_name} · {Math.round(d.days_idle)}d idle</p>
                </div>
                <p className="text-xs font-bold text-red-700">${parseFloat(d.value).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {stale_proposals.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Stale proposals</p>
          <div className="space-y-2">
            {stale_proposals.map(d => (
              <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors">
                <TrendingDown size={13} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs font-medium text-amber-800 flex-1 truncate">{d.name}</p>
                <p className="text-xs font-bold text-amber-700">${parseFloat(d.value).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {summary.total_idle === 0 && summary.total_stale_proposals === 0 && (
        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl p-3">
          <CheckCircle size={16} />
          <p className="text-sm font-medium">Pipeline looks healthy!</p>
        </div>
      )}
    </div>
  )
}

function BulkScoringCard({ onDone }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const run = async () => {
    setLoading(true)
    try {
      const res = await api.post('/ai/score-all')
      setResult(res.data)
      toast.success(`Scored ${res.data.scored} contacts!`)
      onDone?.()
    } catch { toast.error('Scoring failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Star size={16} className="text-amber-500" />
        <h2 className="font-semibold text-slate-800 text-sm">Bulk AI Lead Scoring</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Automatically score all contacts based on engagement, deal history, company data, and behavior signals. Scores appear on contact cards.
      </p>
      <div className="bg-slate-50 rounded-xl p-3 mb-4 text-xs text-slate-600 space-y-1">
        <p>· Analyzes email engagement, activity count, deal history</p>
        <p>· Scores title seniority, lead source quality, lifecycle stage</p>
        <p>· Runs automatically every 24h in the background</p>
        <p>· Scores range 0–100 with A/B/C/D grade</p>
      </div>
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 text-xs text-emerald-700 font-medium">
          ✓ Scored {result.scored} contacts successfully
        </div>
      )}
      <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={run} disabled={loading}>
        {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Scoring contacts…</> : <><Zap size={14} /> Run bulk scoring now</>}
      </button>
    </div>
  )
}

function EmailDrafterCard() {
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState('')
  const [emailType, setEmailType] = useState('follow_up')
  const [context, setContext] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/contacts?limit=100').then(r => setContacts(r.data.data || []))
  }, [])

  const generate = async () => {
    if (!selectedContact) { toast.error('Select a contact'); return }
    setLoading(true)
    try {
      const res = await api.post(`/ai/draft-email/${selectedContact}`, { email_type: emailType, context })
      setDraft(res.data)
    } catch { toast.error('Failed to generate email') }
    finally { setLoading(false) }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mail size={16} className="text-blue-500" />
        <h2 className="font-semibold text-slate-800 text-sm">AI Email Drafter</h2>
        <span className="ml-auto badge bg-indigo-100 text-indigo-700 text-xs">Powered by Claude</span>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <label className="label">Contact</label>
          <select className="input" value={selectedContact} onChange={e => setSelectedContact(e.target.value)}>
            <option value="">— Select contact —</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.company_name ? ` · ${c.company_name}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Email type</label>
          <select className="input" value={emailType} onChange={e => setEmailType(e.target.value)}>
            <option value="follow_up">Follow up</option>
            <option value="introduction">Introduction / cold outreach</option>
            <option value="proposal_follow_up">Proposal follow up</option>
            <option value="check_in">Check in</option>
            <option value="re_engagement">Re-engagement (lost/nurture)</option>
            <option value="thank_you">Thank you / post-meeting</option>
          </select>
        </div>
        <div>
          <label className="label">Additional context (optional)</label>
          <textarea className="input resize-none text-sm" rows={2} value={context} onChange={e => setContext(e.target.value)} placeholder="e.g. we met at SolarCon, they're interested in BESS for their Q1 project…" />
        </div>
        <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={generate} disabled={loading || !selectedContact}>
          {loading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Writing email…</> : <><Bot size={14} /> Draft with AI</>}
        </button>
      </div>

      {draft && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Generated email</p>
            <button onClick={copyToClipboard} className="text-xs text-indigo-600 hover:underline">Copy</button>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Subject</p>
            <p className="text-sm font-semibold text-slate-800 mb-3">{draft.subject}</p>
            <p className="text-xs font-medium text-slate-500 mb-1">Body</p>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{draft.body}</div>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex gap-2">
            <button className="btn-primary text-xs flex-1 flex justify-center items-center gap-1.5" onClick={copyToClipboard}><Mail size={12} /> Copy email</button>
            <button className="btn-secondary text-xs" onClick={() => setDraft(null)}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AutomationTemplatesCard() {
  const [templates, setTemplates] = useState([])
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/automations/templates').then(r => setTemplates(r.data))
    api.get('/automations').then(r => setAutomations(r.data))
  }, [])

  const activate = async (template) => {
    setLoading(true)
    try {
      await api.post('/automations', template)
      toast.success(`Automation "${template.name}" activated!`)
      api.get('/automations').then(r => setAutomations(r.data))
    } catch { toast.error('Failed to activate') }
    finally { setLoading(false) }
  }

  const toggle = async (auto) => {
    try {
      await api.patch(`/automations/${auto.id}`, { is_active: !auto.is_active })
      toast.success(auto.is_active ? 'Automation paused' : 'Automation activated')
      api.get('/automations').then(r => setAutomations(r.data))
    } catch { toast.error('Failed') }
  }

  const del = async (id) => {
    try {
      await api.delete(`/automations/${id}`)
      api.get('/automations').then(r => setAutomations(r.data))
      toast.success('Deleted')
    } catch { toast.error('Failed') }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={16} className="text-violet-500" />
        <h2 className="font-semibold text-slate-800 text-sm">Automation Engine</h2>
      </div>

      {/* Active automations */}
      {automations.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Active automations ({automations.length})</p>
          <div className="space-y-2">
            {automations.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate">{a.name}</p>
                  <p className="text-xs text-slate-400">Trigger: {a.trigger_type} · Ran {a.run_count}×</p>
                </div>
                <button onClick={() => toggle(a)} className={`text-xs px-2.5 py-1 rounded-lg border ${a.is_active ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-500'}`}>
                  {a.is_active ? 'On' : 'Off'}
                </button>
                <button onClick={() => del(a.id)} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Templates */}
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recipes — click to activate</p>
      <div className="space-y-2">
        {templates.map((t, i) => {
          const alreadyActive = automations.some(a => a.name === t.name)
          return (
            <div key={i} className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Trigger: <span className="font-medium">{t.trigger_type}</span> → {t.actions.length} action{t.actions.length > 1 ? 's' : ''}
                  </p>
                </div>
                {alreadyActive ? (
                  <span className="badge bg-emerald-100 text-emerald-700 text-xs flex-shrink-0">Active</span>
                ) : (
                  <button onClick={() => activate(t)} disabled={loading} className="text-xs px-2.5 py-1 rounded-lg border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 flex-shrink-0">
                    Activate
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AIPage() {
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(true)

  const fetchHealth = () => {
    setHealthLoading(true)
    api.get('/ai/pipeline-health').then(r => setHealth(r.data)).finally(() => setHealthLoading(false))
  }

  useEffect(() => { fetchHealth() }, [])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bot size={20} className="text-indigo-600" /> AI & Automations
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Lead scoring, email drafting, pipeline health, and automation rules</p>
        </div>
        <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={fetchHealth}>
          <RefreshCw size={13} /> Refresh health
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <PipelineHealthCard health={health} loading={healthLoading} />
          <BulkScoringCard onDone={fetchHealth} />
        </div>
        <div className="space-y-5">
          <EmailDrafterCard />
          <AutomationTemplatesCard />
        </div>
      </div>
    </div>
  )
}
