import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, Search, TrendingUp, DollarSign } from 'lucide-react'
import NewDealModal from '../components/deals/NewDealModal'

export default function DealsPage() {
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [showNew, setShowNew] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: 100 })
      if (search) params.set('search', search)
      const res = await api.get('/deals?' + params)
      setDeals(res.data.data || [])
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [search, statusFilter])

  const totalValue = deals.reduce((s, d) => s + parseFloat(d.value || 0), 0)

  const priorityColor = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-600' }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500">{deals.length} deals · ${totalValue.toLocaleString()} total value</p>
        </div>
        <div className="flex gap-2">
          <Link to="/pipeline" className="btn-secondary flex items-center gap-1.5"><TrendingUp size={14} /> Kanban view</Link>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowNew(true)}><Plus size={14} /> New deal</button>
        </div>
      </div>

      <div className="card p-3 mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search deals…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['open','won','lost'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Deal</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Stage</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Value</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden md:table-cell">Contact</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden lg:table-cell">Close date</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3">Priority</th>
              <th className="text-left text-xs font-semibold text-slate-600 p-3 hidden lg:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading…</td></tr>
              : deals.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <TrendingUp size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-500 text-sm">No deals found</p>
                  <button className="btn-primary mt-3" onClick={() => setShowNew(true)}>Create first deal</button>
                </td></tr>
              ) : deals.map(d => (
                <tr key={d.id} className="table-row">
                  <td className="p-3">
                    <Link to={`/deals/${d.id}`} className="hover:text-indigo-600">
                      <p className="text-sm font-medium text-slate-800">{d.name}</p>
                      {d.company_name && <p className="text-xs text-slate-400">{d.company_name}</p>}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.stage_color || '#6366f1' }} />
                      <span className="text-xs text-slate-600">{d.stage_name}</span>
                    </div>
                  </td>
                  <td className="p-3"><span className="text-sm font-bold text-slate-800">${parseFloat(d.value || 0).toLocaleString()}</span></td>
                  <td className="p-3 hidden md:table-cell">
                    {d.first_name ? <Link to={`/contacts/${d.contact_id}`} className="text-sm text-slate-600 hover:text-indigo-600">{d.first_name} {d.last_name}</Link> : <span className="text-slate-400 text-sm">—</span>}
                  </td>
                  <td className="p-3 hidden lg:table-cell"><span className="text-xs text-slate-500">{d.expected_close ? new Date(d.expected_close).toLocaleDateString() : '—'}</span></td>
                  <td className="p-3"><span className={`badge capitalize text-xs ${priorityColor[d.priority] || 'bg-slate-100 text-slate-600'}`}>{d.priority}</span></td>
                  <td className="p-3 hidden lg:table-cell"><span className="text-xs text-slate-500">{d.owner_name || '—'}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showNew && <NewDealModal onClose={() => setShowNew(false)} onCreated={fetch} />}
    </div>
  )
}
