import { useState, useEffect } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

export default function NewDealModal({ onClose, onCreated, prefilledContact, prefilledCompany }) {
  const [form, setForm] = useState({
    name: '',
    value: '',
    expected_close: '',
    priority: 'medium',
    contact_id: prefilledContact?.id || '',
    company_id: prefilledCompany?.id || '',
    owner_id: '',
    deal_type: '',
    borrower_name: '',
    deal_size: '',
    fees: '',
    funding_date: '',
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
      const custom_fields = {
        borrower_name: form.borrower_name,
        deal_size: form.deal_size,
        fees: form.fees,
        funding_date: form.funding_date,
      }
      await api.post('/deals', {
        name: form.name,
        value: parseFloat(form.value) || 0,
        expected_close: form.expected_close || undefined,
        priority: form.priority,
        contact_id: form.contact_id || undefined,
        company_id: form.company_id || undefined,
        owner_id: form.owner_id || undefined,
        deal_type: form.deal_type || undefined,
        custom_fields,
      })
      toast.success('Deal created!')
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create deal')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-bold text-slate-900">New deal</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">

          {/* Deal name */}
          <div>
            <label className="label">Deal name *</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Acme Corp — Series A" required />
          </div>

          {/* Borrower name */}
          <div>
            <label className="label">Borrower name</label>
            <input className="input" value={form.borrower_name} onChange={set('borrower_name')} placeholder="Legal borrower / entity name" />
          </div>

          {/* Deal size + Fees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Deal size ($)</label>
              <input className="input" type="number" value={form.deal_size} onChange={set('deal_size')} placeholder="0" min="0" />
            </div>
            <div>
              <label className="label">Fees ($)</label>
              <input className="input" type="number" value={form.fees} onChange={set('fees')} placeholder="0" min="0" />
            </div>
          </div>

          {/* Funding date + Expected close */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Funding date</label>
              <input className="input" type="date" value={form.funding_date} onChange={set('funding_date')} />
            </div>
            <div>
              <label className="label">Expected close</label>
              <input className="input" type="date" value={form.expected_close} onChange={set('expected_close')} />
            </div>
          </div>

          {/* Deal value + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Deal value ($)</label>
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

          {/* Contact */}
          <div>
            <label className="label">Contact</label>
            <select className="input" value={form.contact_id} onChange={set('contact_id')}>
              <option value="">— Select contact —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>

          {/* Company */}
          <div>
            <label className="label">Company</label>
            <select className="input" value={form.company_id} onChange={set('company_id')}>
              <option value="">— Select company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Assign to */}
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
