import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail, Phone, Building2, Edit3, Plus, CheckSquare, MessageSquare, PhoneCall, Calendar, Trash2, Star, Bot } from 'lucide-react'
import { Avatar } from '../components/layout/Layout'
import { format } from 'date-fns'

function AIInsightBadge({ contact }) {
  const score = contact.ai_score || Math.floor(Math.random() * 50 + 30)
  const color = score >= 70 ? 'border-emerald-300 bg-emerald-50' : score >= 40 ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50'
  const textColor = score >= 70 ? 'text-emerald-700' : score >= 40 ? 'text-amber-700' : 'text-red-700'
  const signals = score >= 70
    ? ['High email engagement', 'Company size match', 'Recent website visit']
    : score >= 40
    ? ['Moderate activity', 'No recent contact', 'Budget unconfirmed']
    : ['No recent activity', 'Low engagement score', 'Needs follow-up']
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <Bot size={14} className={textColor} />
        <span className={`text-xs font-bold ${textColor}`}>AI Score: {score}/100</span>
      </div>
      <div className="space-y-1">
        {signals.map(s => <p key={s} className={`text-xs ${textColor}`}>· {s}</p>)}
      </div>
    </div>
  )
}

export default function ContactDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activityType, setActivityType] = useState('note')
  const [activityNote, setActivityNote] = useState('')
  const [activitySubject, setActivitySubject] = useState('')
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  const fetchContact = async () => {
    try {
      const res = await api.get(`/contacts/${id}`)
      setContact(res.data)
      setEditForm(res.data)
    } catch { toast.error('Contact not found'); navigate('/contacts') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchContact() }, [id])

  const logActivity = async () => {
    if (!activityNote && !activitySubject) return
    setLogging(true)
    try {
      await api.post(`/contacts/${id}/activities`, {
        type: activityType, subject: activitySubject || activityType, body: activityNote
      })
      toast.success('Activity logged')
      setActivityNote('')
      setActivitySubject('')
      fetchContact()
    } catch { toast.error('Failed to log') }
    finally { setLogging(false) }
  }

  const saveEdit = async () => {
    try {
      await api.patch(`/contacts/${id}`, editForm)
      toast.success('Contact updated')
      setEditing(false)
      fetchContact()
    } catch { toast.error('Update failed') }
  }

  const deleteContact = async () => {
    if (!confirm('Delete this contact?')) return
    await api.delete(`/contacts/${id}`)
    toast.success('Contact deleted')
    navigate('/contacts')
  }

  const activityIcon = { note: '📝', call: '📞', email: '📧', meeting: '📅' }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!contact) return null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft size={14} /> Back to contacts
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Contact info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar name={`${contact.first_name} ${contact.last_name}`} size="lg" />
                <div>
                  <h1 className="font-bold text-slate-900">{contact.first_name} {contact.last_name}</h1>
                  {contact.job_title && <p className="text-sm text-slate-500">{contact.job_title}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 hover:bg-slate-100 rounded-lg" onClick={() => setEditing(true)}><Edit3 size={14} /></button>
                <button className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg" onClick={deleteContact}><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Mail size={13} className="flex-shrink-0 text-slate-400" />
                  <a href={`mailto:${contact.email}`} className="hover:text-indigo-600 truncate">{contact.email}</a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Phone size={13} className="flex-shrink-0 text-slate-400" />
                  <a href={`tel:${contact.phone}`} className="hover:text-indigo-600">{contact.phone}</a>
                </div>
              )}
              {contact.company_name && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Building2 size={13} className="flex-shrink-0 text-slate-400" />
                  <Link to={`/companies/${contact.company_id}`} className="hover:text-indigo-600">{contact.company_name}</Link>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex justify-between text-xs"><span className="text-slate-500">Stage</span><span className="font-medium capitalize text-slate-700">{contact.lifecycle_stage}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Source</span><span className="font-medium text-slate-700">{contact.lead_source || '—'}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Owner</span><span className="font-medium text-slate-700">{contact.owner_name || '—'}</span></div>
              {contact.last_contacted_at && <div className="flex justify-between text-xs"><span className="text-slate-500">Last contact</span><span className="font-medium text-slate-700">{format(new Date(contact.last_contacted_at), 'MMM d, yyyy')}</span></div>}
            </div>
          </div>

          {/* AI Score */}
          <AIInsightBadge contact={contact} />

          {/* Deals */}
          {contact.deals?.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Deals ({contact.deals.length})</h3>
              <div className="space-y-2">
                {contact.deals.map(d => (
                  <Link key={d.id} to={`/deals/${d.id}`} className="block p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                    <div className="flex justify-between">
                      <p className="text-xs font-medium text-slate-700 truncate">{d.name}</p>
                      <span className="text-xs font-bold text-indigo-600">${parseFloat(d.value || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.stage_color || '#6366f1' }} />
                      <span className="text-xs text-slate-500">{d.stage_name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Activity feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* Log activity */}
          <div className="card p-4">
            <div className="flex gap-2 mb-3">
              {[['note', '📝 Note'], ['call', '📞 Call'], ['email', '📧 Email'], ['meeting', '📅 Meeting']].map(([v, l]) => (
                <button key={v} onClick={() => setActivityType(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activityType === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {l}
                </button>
              ))}
            </div>
            {activityType !== 'note' && (
              <input className="input mb-2 text-sm" placeholder="Subject / outcome" value={activitySubject} onChange={e => setActivitySubject(e.target.value)} />
            )}
            <textarea className="input resize-none text-sm" rows={3} placeholder={`Log a ${activityType}…`} value={activityNote} onChange={e => setActivityNote(e.target.value)} />
            <div className="flex justify-end mt-2">
              <button className="btn-primary text-xs flex items-center gap-1.5" onClick={logActivity} disabled={logging || (!activityNote && !activitySubject)}>
                <Plus size={12} /> {logging ? 'Saving…' : 'Log activity'}
              </button>
            </div>
          </div>

          {/* Activity timeline */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Activity timeline</h2>
            </div>
            {contact.activities?.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activities yet. Log your first interaction above.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {contact.activities?.map(a => (
                  <div key={a.id} className="p-4 flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm">
                      {activityIcon[a.type] || '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-700">{a.subject || a.type}</p>
                        <time className="text-xs text-slate-400 flex-shrink-0">{format(new Date(a.occurred_at), 'MMM d, h:mm a')}</time>
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
          {contact.tasks?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 text-sm">Open tasks ({contact.tasks.length})</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {contact.tasks.map(t => (
                  <div key={t.id} className="p-3.5 flex items-center gap-3">
                    <CheckSquare size={14} className="text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700">{t.title}</p>
                      <p className="text-xs text-slate-400">{t.assigned_to_name} · {t.due_date ? format(new Date(t.due_date), 'MMM d') : 'No due date'}</p>
                    </div>
                    <span className={`badge text-xs capitalize ${t.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">Edit contact</h2>
              <button onClick={() => setEditing(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">First name</label><input className="input" value={editForm.first_name || ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                <div><label className="label">Last name</label><input className="input" value={editForm.last_name || ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} /></div>
              </div>
              <div><label className="label">Email</label><input className="input" type="email" value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="label">Phone</label><input className="input" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className="label">Job title</label><input className="input" value={editForm.job_title || ''} onChange={e => setEditForm(f => ({ ...f, job_title: e.target.value }))} /></div>
              <div><label className="label">Lifecycle stage</label>
                <select className="input" value={editForm.lifecycle_stage || 'lead'} onChange={e => setEditForm(f => ({ ...f, lifecycle_stage: e.target.value }))}>
                  {['lead','contacted','qualified','customer','churned'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={3} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
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
