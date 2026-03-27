import { useEffect, useState } from 'react'
import api from '../lib/api'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

// ── ACTIVITIES PAGE ──────────────────────────────────────────────────────────
export function ActivitiesPage() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/activities?limit=50').then(r => setActivities(r.data)).finally(() => setLoading(false)) }, [])
  const icons = { note:'📝',call:'📞',email:'📧',meeting:'📅',stage_change:'→',deal_created:'💼',contact_created:'👤' }
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Activity feed</h1>
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading…</div>
          : activities.length === 0 ? <div className="p-8 text-center text-slate-400">No activities yet</div>
          : activities.map(a => (
          <div key={a.id} className="flex gap-3 p-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm">{icons[a.type]||'📌'}</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">{a.subject || a.type}</p>
              {a.body && <p className="text-sm text-slate-500 mt-0.5">{a.body}</p>}
              <p className="text-xs text-slate-400 mt-1">{a.user_name} · {format(new Date(a.occurred_at), 'MMM d, yyyy h:mm a')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── REPORTS PAGE ─────────────────────────────────────────────────────────────
export function ReportsPage() {
  const [stats, setStats] = useState(null)
  const [forecast, setForecast] = useState(null)
  useEffect(() => {
    Promise.all([api.get('/dashboard/stats'), api.get('/dashboard/forecast')]).then(([s, f]) => { setStats(s.data); setForecast(f.data) })
  }, [])

  const fmtK = v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${Math.round(v)}`

  const COLORS = ['#10b981','#f59e0b','#6366f1','#94a3b8']
  const forecastData = forecast ? [
    { name: 'Won', value: parseFloat(forecast.won) },
    { name: 'Commit', value: parseFloat(forecast.commit_value) },
    { name: 'Best case', value: parseFloat(forecast.best_case) },
    { name: 'Pipeline', value: parseFloat(forecast.pipeline) },
  ] : []

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Reports & analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pipeline value', value: fmtK(stats?.pipeline_value || 0) },
          { label: 'Won this month', value: fmtK(stats?.won_this_month?.value || 0) },
          { label: 'Win rate', value: `${stats?.win_rate || 0}%` },
          { label: 'Open deals', value: stats?.open_deals || 0 },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 text-sm mb-4">Pipeline by stage</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats?.stage_breakdown || []}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => [`$${parseInt(v).toLocaleString()}`, 'Value']} />
              <Bar dataKey="total_value" radius={[4,4,0,0]}>
                {(stats?.stage_breakdown || []).map((s, i) => <Cell key={i} fill={s.color || '#6366f1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 text-sm mb-4">Revenue forecast</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={forecastData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => [`$${parseInt(v).toLocaleString()}`, 'Value']} />
              <Bar dataKey="value" radius={[4,4,0,0]}>
                {forecastData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h2 className="font-semibold text-slate-800 text-sm">Sales rep performance (last 90 days)</h2></div>
        <table className="w-full">
          <thead className="bg-slate-50"><tr>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Rep</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Deals won</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Revenue</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Win rate</th>
          </tr></thead>
          <tbody>
            {(stats?.rep_performance || []).map(r => (
              <tr key={r.id} className="table-row">
                <td className="p-3 text-sm font-medium text-slate-800">{r.full_name}</td>
                <td className="p-3 text-sm text-slate-600">{r.won_count}</td>
                <td className="p-3 text-sm font-bold text-emerald-600">{fmtK(r.won_value)}</td>
                <td className="p-3"><span className={`badge text-xs ${r.win_rate >= 40 ? 'bg-emerald-100 text-emerald-700' : r.win_rate >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{r.win_rate}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── QUOTES PAGE ───────────────────────────────────────────────────────────────
export function QuotesPage() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/quotes').then(r => setQuotes(r.data)).finally(() => setLoading(false)) }, [])
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Quotes</h1>
        <button className="btn-primary text-sm">+ New quote</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200"><tr>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Quote #</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Deal</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Total</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Status</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Created</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-slate-400">Loading…</td></tr>
              : quotes.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-slate-400">No quotes yet. Create one from a deal page.</td></tr>
              : quotes.map(q => (
              <tr key={q.id} className="table-row">
                <td className="p-3 text-sm font-mono text-slate-700">{q.quote_number}</td>
                <td className="p-3 text-sm text-slate-600">{q.deal_name || '—'}</td>
                <td className="p-3 text-sm font-bold text-indigo-600">${parseFloat(q.total||0).toLocaleString()}</td>
                <td className="p-3"><span className={`badge capitalize text-xs ${q.status==='accepted'?'bg-emerald-100 text-emerald-700':q.status==='sent'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-600'}`}>{q.status}</span></td>
                <td className="p-3 text-xs text-slate-500">{format(new Date(q.created_at), 'MMM d, yyyy')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PRODUCTS PAGE ─────────────────────────────────────────────────────────────
export function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name:'',sku:'',description:'',unit_price:'',unit:'each',tax_rate:'0' })
  const fetch = () => api.get('/products').then(r => setProducts(r.data)).finally(() => setLoading(false))
  useEffect(() => { fetch() }, [])

  const create = async (e) => {
    e.preventDefault()
    try { await api.post('/products', { ...form, unit_price: parseFloat(form.unit_price) }); setShowNew(false); fetch() }
    catch {}
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Products & services</h1>
        <button className="btn-primary text-sm" onClick={() => setShowNew(true)}>+ Add product</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200"><tr>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Name</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">SKU</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Price</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Unit</th>
            <th className="text-left text-xs font-semibold text-slate-600 p-3">Tax %</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-slate-400">Loading…</td></tr>
              : products.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-slate-400">No products yet</td></tr>
              : products.map(p => (
              <tr key={p.id} className="table-row">
                <td className="p-3"><p className="text-sm font-medium text-slate-800">{p.name}</p>{p.description && <p className="text-xs text-slate-400">{p.description}</p>}</td>
                <td className="p-3 text-xs font-mono text-slate-500">{p.sku||'—'}</td>
                <td className="p-3 text-sm font-bold text-slate-800">${parseFloat(p.unit_price).toLocaleString()}</td>
                <td className="p-3 text-xs text-slate-500">{p.unit}</td>
                <td className="p-3 text-xs text-slate-500">{p.tax_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-bold">New product</h2><button onClick={() => setShowNew(false)} className="text-slate-400">✕</button></div>
            <form onSubmit={create} className="p-5 space-y-3">
              <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required /></div>
              <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} /></div>
              <div><label className="label">Description</label><input className="input" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Unit price *</label><input className="input" type="number" step="0.01" value={form.unit_price} onChange={e=>setForm(f=>({...f,unit_price:e.target.value}))} required /></div>
                <div><label className="label">Unit</label>
                  <select className="input" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                    {['each','hour','day','month','year','project','license'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Tax rate (%)</label><input className="input" type="number" step="0.1" value={form.tax_rate} onChange={e=>setForm(f=>({...f,tax_rate:e.target.value}))} /></div>
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SETTINGS PAGE ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  const [users, setUsers] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ full_name:'', email:'', password:'', role:'sales' })
  useEffect(() => { api.get('/users').then(r => setUsers(r.data)) }, [])
  const createUser = async (e) => {
    e.preventDefault()
    try { await api.post('/users', form); setShowNew(false); api.get('/users').then(r => setUsers(r.data)) }
    catch {}
  }
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Settings</h1>
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800 text-sm">Team members ({users.length})</h2>
          <button className="btn-primary text-xs" onClick={() => setShowNew(true)}>+ Invite user</button>
        </div>
        <div className="divide-y divide-slate-100">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-3.5">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">{u.full_name?.[0]}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
              <span className={`badge capitalize text-xs ${u.role==='admin'?'bg-indigo-100 text-indigo-700':u.role==='manager'?'bg-purple-100 text-purple-700':'bg-slate-100 text-slate-600'}`}>{u.role}</span>
              <span className={`badge text-xs ${u.is_active?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{u.is_active?'Active':'Inactive'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 text-sm mb-4">API access</h2>
        <p className="text-sm text-slate-600 mb-3">Your CRM exposes a full REST API. Base URL:</p>
        <code className="block bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-indigo-700">
          {window.location.origin}/api
        </code>
        <p className="text-xs text-slate-500 mt-2">Authenticate with <code className="bg-slate-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code></p>
      </div>
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-bold">Invite team member</h2><button onClick={() => setShowNew(false)} className="text-slate-400">✕</button></div>
            <form onSubmit={createUser} className="p-5 space-y-3">
              <div><label className="label">Full name *</label><input className="input" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} required /></div>
              <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required /></div>
              <div><label className="label">Password *</label><input className="input" type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required /></div>
              <div><label className="label">Role</label>
                <select className="input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {['admin','manager','sales','marketing','support','viewer'].map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create user</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
