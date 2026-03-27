// CompaniesPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, Building2, Search, Users, TrendingUp } from 'lucide-react'

export function CompaniesPage() {
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: 50 })
      if (search) params.set('search', search)
      const res = await api.get('/companies?' + params)
      setCompanies(res.data.data || [])
      setTotal(res.data.total || 0)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchCompanies() }, [search])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-slate-900">Companies</h1><p className="text-sm text-slate-500">{total} companies</p></div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowNew(true)}><Plus size={14} /> New company</button>
      </div>
      <div className="card p-3 mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Company</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden md:table-cell">Industry</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Contacts</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Open deals</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden lg:table-cell">Pipeline</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden lg:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-12 text-slate-400">Loading…</td></tr>
              : companies.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-500 text-sm">No companies yet</p>
                  <button className="btn-primary mt-3" onClick={() => setShowNew(true)}>Add first company</button>
                </td></tr>
              ) : companies.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="p-3">
                    <Link to={`/companies/${c.id}`} className="flex items-center gap-2.5 hover:text-indigo-600">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">{c.name[0]}</div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{c.name}</p>
                        {c.domain && <p className="text-xs text-slate-400">{c.domain}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="p-3 hidden md:table-cell"><span className="text-sm text-slate-600">{c.industry || '—'}</span></td>
                  <td className="p-3"><span className="text-sm text-slate-600">{c.contact_count || 0}</span></td>
                  <td className="p-3"><span className="text-sm text-slate-600">{c.open_deals_count || 0}</span></td>
                  <td className="p-3 hidden lg:table-cell"><span className="text-sm font-medium text-emerald-600">{c.pipeline_value > 0 ? `$${parseFloat(c.pipeline_value).toLocaleString()}` : '—'}</span></td>
                  <td className="p-3 hidden lg:table-cell"><span className="text-xs text-slate-500">{c.owner_name || '—'}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showNew && <NewCompanyModal onClose={() => setShowNew(false)} onCreated={fetchCompanies} />}
    </div>
  )
}

function NewCompanyModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', domain: '', industry: '', website: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    try { await api.post('/companies', form); toast.success('Company created!'); onCreated?.(); onClose() }
    catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b"><h2 className="font-bold">New company</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div><label className="label">Company name *</label><input className="input" value={form.name} onChange={set('name')} required /></div>
          <div><label className="label">Domain</label><input className="input" value={form.domain} onChange={set('domain')} placeholder="acme.com" /></div>
          <div><label className="label">Industry</label>
            <select className="input" value={form.industry} onChange={set('industry')}>
              {['','Technology','Energy / BESS','Solar','Automotive','Construction','Consulting','Telecom','Healthcare','Finance','Other'].map(i => <option key={i} value={i}>{i || '— Select —'}</option>)}
            </select>
          </div>
          <div><label className="label">Website</label><input className="input" value={form.website} onChange={set('website')} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1 flex justify-center" disabled={loading}>{loading ? 'Saving…' : 'Create company'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
