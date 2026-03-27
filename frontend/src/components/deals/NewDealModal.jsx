import { useState, useEffect } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

export default function NewDealModal({ onClose, onCreated, prefilledContact, prefilledCompany }) {
  const [form, setForm] = useState({
    name: '', value: '', expected_close: '', priority: 'medium',
    contact_id: prefilledContact?.id || '', company_id: prefilledCompany?.id || '',
    owner_id: '', deal_type: ''
  })
  const [contacts, setContacts] = useState([])
  const [companies, setCompanies] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/contacts?limit=200'),
      api.get('/companies?limit=200'),
      api.get('/users'),
    ]).then(([c, co, u]) => {
      setContacts(c.data.data || [])
      setCompanies(co.data.data || [])
      setUsers(u.data || [])
    })
  }, [])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) { toast.error('Deal name required'); return }
    setLoading(true)
    try {
      await api.post('/deals', { ...form, value: parseFloat(form.value) || 0 })
      toast.success('Deal created!')
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create deal')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">New deal</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="label">Deal name *</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Acme Corp — BESS Installation" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Value ($)</label>
              <input className="input" type="number" value={form.value} onChange={set('value')} placeholder="0" min="0" />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Expected close</label>
            <input className="input" type="date" value={form.expected_close} onChange={set('expected_close')} />
          </div>
          <div>
            <label className="label">Contact</label>
            <select className="input" value={form.contact_id} onChange={set('contact_id')}>
              <option value="">— Select contact —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Company</label>
            <select className="input" value={form.company_id} onChange={set('company_id')}>
              <option value="">— Select company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Assign to</label>
            <select className="input" value={form.owner_id} onChange={set('owner_id')}>
              <option value="">— Assign to me —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex justify-center">
              {loading ? 'Creating…' : 'Create deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
