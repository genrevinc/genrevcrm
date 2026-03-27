import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, Search, Upload, Download, User, Star, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { Avatar } from '../components/layout/Layout'

const LEAD_SOURCES = ['', 'Website', 'Referral', 'Cold outreach', 'Trade show', 'LinkedIn', 'Partner', 'Other']
const STAGES = ['', 'lead', 'contacted', 'qualified', 'customer', 'churned']

function AIScoreBadge({ score }) {
  if (!score) return null
  const color = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`badge ${color}`}>{score}</span>
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [showNew, setShowNew] = useState(false)
  const navigate = useNavigate()

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 50 })
      if (search) params.set('search', search)
      if (stage) params.set('lifecycle_stage', stage)
      const res = await api.get('/contacts?' + params)
      setContacts(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch { toast.error('Failed to load contacts') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchContacts() }, [search, stage, page])

  const toggleSelect = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} contact(s)?`)) return
    try {
      await Promise.all([...selected].map(id => api.delete(`/contacts/${id}`)))
      toast.success(`Deleted ${selected.size} contact(s)`)
      setSelected(new Set())
      fetchContacts()
    } catch { toast.error('Delete failed') }
  }

  const stageColor = (s) => ({
    lead: 'bg-slate-100 text-slate-600',
    contacted: 'bg-blue-100 text-blue-700',
    qualified: 'bg-indigo-100 text-indigo-700',
    customer: 'bg-emerald-100 text-emerald-700',
    churned: 'bg-red-100 text-red-700',
  }[s] || 'bg-slate-100 text-slate-600')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total.toLocaleString()} total contacts</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button className="btn-danger flex items-center gap-1.5" onClick={deleteSelected}>
              <Trash2 size={14} /> Delete ({selected.size})
            </button>
          )}
          <button className="btn-secondary flex items-center gap-1.5"><Upload size={14} /> Import</button>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search contacts…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input w-40" value={stage} onChange={e => { setStage(e.target.value); setPage(1) }}>
          <option value="">All stages</option>
          {STAGES.filter(Boolean).map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select className="input w-44" value={source} onChange={e => setSource(e.target.value)}>
          <option value="">All sources</option>
          {LEAD_SOURCES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-secondary flex items-center gap-1.5 text-xs"><Download size={12} /> Export</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" className="rounded" onChange={e => setSelected(e.target.checked ? new Set(contacts.map(c => c.id)) : new Set())} /></th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Name</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden md:table-cell">Company</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden lg:table-cell">Email</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Stage</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden lg:table-cell">Source</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">AI Score</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden md:table-cell">Deals</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden lg:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading…</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12">
                <User size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">No contacts yet</p>
                <button className="btn-primary mt-3" onClick={() => setShowNew(true)}>Add your first contact</button>
              </td></tr>
            ) : contacts.map(c => (
              <tr key={c.id} className="table-row">
                <td className="p-3"><input type="checkbox" className="rounded" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                <td className="p-3">
                  <Link to={`/contacts/${c.id}`} className="flex items-center gap-2.5 hover:text-indigo-600">
                    <Avatar name={`${c.first_name} ${c.last_name}`} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</p>
                      {c.job_title && <p className="text-xs text-slate-500">{c.job_title}</p>}
                    </div>
                  </Link>
                </td>
                <td className="p-3 hidden md:table-cell">
                  {c.company_name ? <Link to={`/companies/${c.company_id}`} className="text-sm text-slate-600 hover:text-indigo-600">{c.company_name}</Link> : <span className="text-slate-400 text-sm">—</span>}
                </td>
                <td className="p-3 hidden lg:table-cell">
                  <a href={`mailto:${c.email}`} className="text-sm text-slate-600 hover:text-indigo-600">{c.email || '—'}</a>
                </td>
                <td className="p-3">
                  <span className={`badge capitalize ${stageColor(c.lifecycle_stage)}`}>{c.lifecycle_stage || 'lead'}</span>
                </td>
                <td className="p-3 hidden lg:table-cell"><span className="text-xs text-slate-500">{c.lead_source || '—'}</span></td>
                <td className="p-3"><AIScoreBadge score={c.ai_score} /></td>
                <td className="p-3 hidden md:table-cell"><span className="text-sm text-slate-600">{c.open_deals_count || 0}</span></td>
                <td className="p-3 hidden lg:table-cell"><span className="text-xs text-slate-500">{c.owner_name || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        {total > 50 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}</p>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs py-1 px-3" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
              <button className="btn-secondary text-xs py-1 px-3" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showNew && <NewContactModal onClose={() => setShowNew(false)} onCreated={fetchContacts} />}
    </div>
  )
}

function NewContactModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', job_title: '', lead_source: '', lifecycle_stage: 'lead' })
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/companies?limit=200').then(r => setCompanies(r.data.data || [])) }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/contacts', form)
      toast.success('Contact created!')
      onCreated?.()
      onClose()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">New contact</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><Plus size={16} className="rotate-45" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First name *</label><input className="input" value={form.first_name} onChange={set('first_name')} required /></div>
            <div><label className="label">Last name *</label><input className="input" value={form.last_name} onChange={set('last_name')} required /></div>
          </div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} /></div>
          <div><label className="label">Phone</label><input className="input" type="tel" value={form.phone} onChange={set('phone')} /></div>
          <div><label className="label">Job title</label><input className="input" value={form.job_title} onChange={set('job_title')} /></div>
          <div><label className="label">Company</label>
            <select className="input" value={form.company_id || ''} onChange={set('company_id')}>
              <option value="">— No company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Lead source</label>
            <select className="input" value={form.lead_source} onChange={set('lead_source')}>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s || '— Select —'}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex justify-center">{loading ? 'Saving…' : 'Create contact'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
