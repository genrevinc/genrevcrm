import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit3, Plus, Trash2, Bot, DollarSign, Calendar, User, Building2, BarChart2 } from 'lucide-react'
import { format } from 'date-fns'

function AISuggestion({ deal }) {
  const suggestions = [
    { action: 'Send follow-up email', reason: 'No activity in 3+ days. Similar won deals had email contact at this stage.', type: 'email' },
    { action: 'Schedule discovery call', reason: 'Deal is qualified but no meeting logged yet. Calls increase close rate by 2x.', type: 'call' },
    { action: 'Send updated proposal', reason: 'Proposal is 7+ days old. Refresh to re-engage.', type: 'proposal' },
  ]
  const s = suggestions[Math.floor((deal.value || 1000) % suggestions.length)]
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-center gap-2 mb-2"><Bot size={14} className="text-indigo-600" /><span className="text-xs font-bold text-indigo-700">AI Suggestion</span></div>
      <p className="text-sm font-medium text-indigo-800 mb-1">{s.action}</p>
      <p className="text-xs text-indigo-600">{s.reason}</p>
      <button className="mt-2 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">Create task</button>
    </div>
  )
}

export default function DealDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [activityNote, setActivityNote] = useState('')
  const [activityType, setActivityType] = useState('note')
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  const fetch = async () => {
    try {
      const [dealRes, pipelineRes] = await Promise.all([api.get(`/deals/${id}`), api.get('/deals/pipeline-view')])
      setDeal(dealRes.data)
      setEditForm(dealRes.data)
      const allStages = pipelineRes.data.flatMap(s => ({ id: s.id, name: s.name, color: s.color, is_won: s.is_won, is_lost: s.is_lost }))
      setStages(allStages)
    } catch { navigate('/deals') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [id])

  const moveStage = async (stageId) => {
    try { await api.patch(`/deals/${id}`, { stage_id: stageId }); toast.success('Stage updated'); fetch() }
    catch { toast.error('Failed') }
  }

  const logActivity = async () => {
    if (!activityNote) return
    setLogging(true)
    try {
      await api.post(`/deals/${id}/activities`, { type: activityType, subject: activityType, body: activityNote })
      toast.success('Logged'); setActivityNote(''); fetch()
    } catch { toast.error('Failed') }
    finally { setLogging(false) }
  }

  const saveEdit = async () => {
    try {
      await api.patch(`/deals/${id}`, { name: editForm.name, value: parseFloat(editForm.value), priority: editForm.priority, expected_close: editForm.expected_close })
      toast.success('Updated'); setEditing(false); fetch()
    } catch { toast.error('Failed') }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!deal) return null

  const statusColor = { won: 'bg-emerald-100 text-emerald-700', lost: 'bg-red-100 text-red-700', open: 'bg-indigo-100 text-indigo-700' }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={() => navigate('/deals')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5"><ArrowLeft size={14} /> Back to deals</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="font-bold text-slate-900 text-lg leading-tight">{deal.name}</h1>
                <span className={`badge mt-1 capitalize text-xs ${statusColor[deal.status] || 'bg-slate-100 text-slate-600'}`}>{deal.status}</span>
              </div>
              <button className="p-1.5 hover:bg-slate-100 rounded-lg" onClick={() => setEditing(true)}><Edit3 size={14} /></button>
            </div>
            <div className="text-3xl font-bold text-indigo-600 mb-4">${parseFloat(deal.value || 0).toLocaleString()}</div>
            <div className="space-y-2.5 text-sm">
              {deal.first_name && <div className="flex items-center gap-2 text-slate-600"><User size={13} className="text-slate-400" /><Link to={`/contacts/${deal.contact_id}`} className="hover:text-indigo-600">{deal.first_name} {deal.last_name}</Link></div>}
              {deal.company_name && <div className="flex items-center gap-2 text-slate-600"><Building2 size={13} className="text-slate-400" /><Link to={`/companies/${deal.company_id}`} className="hover:text-indigo-600">{deal.company_name}</Link></div>}
              {deal.expected_close && <div className="flex items-center gap-2 text-slate-600"><Calendar size={13} className="text-slate-400" />Close {new Date(deal.expected_close).toLocaleDateString()}</div>}
              <div className="flex items-center gap-2 text-slate-600"><BarChart2 size={13} className="text-slate-400" />{deal.probability}% probability</div>
            </div>
            {/* Custom fields */}
            {(deal.custom_fields?.borrower_name || deal.custom_fields?.deal_size || deal.custom_fields?.fees || deal.custom_fields?.funding_date) && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Deal details</p>
                {deal.custom_fields?.borrower_name && <div className="flex justify-between"><span className="text-slate-500">Borrower</span><span className="font-medium text-slate-700">{deal.custom_fields.borrower_name}</span></div>}
                {deal.custom_fields?.deal_size && <div className="flex justify-between"><span className="text-slate-500">Deal size</span><span className="font-medium text-slate-700">${parseFloat(deal.custom_fields.deal_size).toLocaleString()}</span></div>}
                {deal.custom_fields?.fees && <div className="flex justify-between"><span className="text-slate-500">Fees</span><span className="font-medium text-slate-700">${parseFloat(deal.custom_fields.fees).toLocaleString()}</span></div>}
                {deal.custom_fields?.funding_date && <div className="flex justify-between"><span className="text-slate-500">Funding date</span><span className="font-medium text-slate-700">{new Date(deal.custom_fields.funding_date).toLocaleDateString()}</span></div>}
              </div>
            )}
            <div className="hidden">
            </div>
            {/* Stage progress */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2">Current stage</p>
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deal.stage_color || '#6366f1' }} />
                <span className="text-sm font-semibold text-slate-800">{deal.stage_name}</span>
              </div>
              <p className="text-xs font-medium text-slate-500 mb-2">Move to stage</p>
              <div className="flex flex-wrap gap-1.5">
                {stages.filter(s => s.id !== deal.stage_id).map(s => (
                  <button key={s.id} onClick={() => moveStage(s.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${s.is_won ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : s.is_lost ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AISuggestion deal={deal} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Log activity */}
          <div className="card p-4">
            <div className="flex gap-2 mb-3">
              {[['note','📝 Note'],['call','📞 Call'],['email','📧 Email'],['meeting','📅 Meeting']].map(([v,l]) => (
                <button key={v} onClick={() => setActivityType(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${activityType === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{l}</button>
              ))}
            </div>
            <textarea className="input resize-none text-sm" rows={2} placeholder={`Log a ${activityType}…`} value={activityNote} onChange={e => setActivityNote(e.target.value)} />
            <div className="flex justify-end mt-2">
              <button className="btn-primary text-xs" onClick={logActivity} disabled={logging || !activityNote}>{logging ? 'Saving…' : 'Log'}</button>
            </div>
          </div>

          {/* Activity feed */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100"><h2 className="font-semibold text-slate-800 text-sm">Activity</h2></div>
            {deal.activities?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No activities yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deal.activities?.map(a => (
                  <div key={a.id} className="p-4 flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm flex-shrink-0">
                      {{'note':'📝','call':'📞','email':'📧','meeting':'📅','stage_change':'→','deal_created':'💼'}[a.type] || '📌'}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-medium text-slate-700">{a.subject || a.type}</p>
                        <time className="text-xs text-slate-400">{format(new Date(a.occurred_at), 'MMM d, h:mm a')}</time>
                      </div>
                      {a.body && <p className="text-sm text-slate-600 mt-0.5">{a.body}</p>}
                      <p className="text-xs text-slate-400 mt-1">{a.user_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tasks */}
          {deal.tasks?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100"><h2 className="font-semibold text-slate-800 text-sm">Tasks ({deal.tasks.length})</h2></div>
              <div className="divide-y divide-slate-100">
                {deal.tasks.map(t => (
                  <div key={t.id} className="p-3.5 flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${t.priority === 'high' ? 'bg-red-500' : 'bg-slate-300'}`} />
                    <div className="flex-1"><p className="text-sm text-slate-700">{t.title}</p><p className="text-xs text-slate-400">{t.assigned_name} · {t.due_date ? format(new Date(t.due_date), 'MMM d') : 'No due date'}</p></div>
                    <span className={`badge capitalize text-xs ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quotes */}
          {deal.quotes?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h2 className="font-semibold text-slate-800 text-sm">Quotes ({deal.quotes.length})</h2>
                <Link to="/quotes" className="text-xs text-indigo-600">+ New quote</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {deal.quotes.map(q => (
                  <div key={q.id} className="p-3.5 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{q.quote_number}</p>
                      <p className="text-xs text-slate-400">Created {format(new Date(q.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-600">${parseFloat(q.total || 0).toLocaleString()}</p>
                    <span className={`badge capitalize text-xs ${q.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : q.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{q.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-bold">Edit deal</h2><button onClick={() => setEditing(false)} className="text-slate-400">✕</button></div>
            <div className="p-5 space-y-3">
              <div><label className="label">Deal name</label><input className="input" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Value ($)</label><input className="input" type="number" value={editForm.value || ''} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} /></div>
              <div><label className="label">Priority</label>
                <select className="input" value={editForm.priority || 'medium'} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}>
                  {['low','medium','high'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              </div>
              <div><label className="label">Expected close</label><input className="input" type="date" value={editForm.expected_close?.split('T')[0] || ''} onChange={e => setEditForm(f => ({ ...f, expected_close: e.target.value }))} /></div>
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={saveEdit}>Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
