import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Building2, Edit3, Plus, Trash2, Users, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

export default function CompanyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})

  const fetch = async () => {
    try {
      const res = await api.get(`/companies/${id}`)
      setCompany(res.data); setEditForm(res.data)
    } catch { navigate('/companies') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [id])

  const save = async () => {
    try { await api.patch(`/companies/${id}`, editForm); toast.success('Updated'); setEditing(false); fetch() }
    catch { toast.error('Failed') }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!company) return null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={() => navigate('/companies')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft size={14} /> Back to companies
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-600">{company.name[0]}</div>
                <div>
                  <h1 className="font-bold text-slate-900">{company.name}</h1>
                  {company.domain && <p className="text-sm text-slate-500">{company.domain}</p>}
                </div>
              </div>
              <button className="p-1.5 hover:bg-slate-100 rounded-lg" onClick={() => setEditing(true)}><Edit3 size={14} /></button>
            </div>
            <div className="space-y-2 text-sm">
              {company.industry && <div className="flex justify-between"><span className="text-slate-500">Industry</span><span className="font-medium text-slate-700">{company.industry}</span></div>}
              {company.website && <div className="flex justify-between"><span className="text-slate-500">Website</span><a href={company.website} target="_blank" className="text-indigo-600 hover:underline text-xs">{company.website}</a></div>}
              {company.phone && <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="font-medium text-slate-700">{company.phone}</span></div>}
              {company.employee_count && <div className="flex justify-between"><span className="text-slate-500">Employees</span><span className="font-medium text-slate-700">{company.employee_count}</span></div>}
              {company.annual_revenue && <div className="flex justify-between"><span className="text-slate-500">Revenue</span><span className="font-medium text-slate-700">${parseFloat(company.annual_revenue).toLocaleString()}</span></div>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{company.contacts?.length || 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Contacts</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{company.deals?.filter(d => d.status === 'open').length || 0}</p>
              <p className="text-xs text-slate-500 mt-0.5">Open deals</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {/* Contacts */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">Contacts ({company.contacts?.length || 0})</h2>
              <Link to="/contacts" className="text-xs text-indigo-600">+ Add contact</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {company.contacts?.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">No contacts yet</div>
              ) : company.contacts?.map(c => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center gap-3 p-3.5 hover:bg-slate-50">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700">{c.first_name?.[0]}{c.last_name?.[0]}</div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-slate-500">{c.job_title || c.email}</p>
                  </div>
                  <span className={`badge ml-auto capitalize text-xs ${c.lifecycle_stage === 'customer' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{c.lifecycle_stage}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Deals */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">Deals ({company.deals?.length || 0})</h2>
              <Link to="/deals" className="text-xs text-indigo-600">+ New deal</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {company.deals?.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">No deals yet</div>
              ) : company.deals?.map(d => (
                <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center gap-3 p-3.5 hover:bg-slate-50">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.stage_color || '#6366f1' }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.stage_name}</p>
                  </div>
                  <p className="text-sm font-bold text-indigo-600">${parseFloat(d.value || 0).toLocaleString()}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-bold">Edit company</h2><button onClick={() => setEditing(false)} className="text-slate-400">✕</button></div>
            <div className="p-5 space-y-3">
              <div><label className="label">Name</label><input className="input" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Domain</label><input className="input" value={editForm.domain || ''} onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))} /></div>
              <div><label className="label">Industry</label>
                <select className="input" value={editForm.industry || ''} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))}>
                  {['','Technology','Energy / BESS','Solar','Automotive','Construction','Consulting','Telecom','Healthcare','Finance','Other'].map(i => <option key={i} value={i}>{i||'— Select —'}</option>)}
                </select>
              </div>
              <div><label className="label">Website</label><input className="input" value={editForm.website || ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} /></div>
              <div><label className="label">Phone</label><input className="input" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className="label">Employee count</label><input className="input" type="number" value={editForm.employee_count || ''} onChange={e => setEditForm(f => ({ ...f, employee_count: e.target.value }))} /></div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={3} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary flex-1" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn-primary flex-1" onClick={save}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
