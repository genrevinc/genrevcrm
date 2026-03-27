import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [form, setForm] = useState({ company_name: '', full_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be 8+ characters'); return }
    setLoading(true)
    try {
      await register(form)
      toast.success('Account created! Welcome.')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Start your free CRM</h1>
          <p className="text-slate-500 mt-1 text-sm">Set up your team in 60 seconds</p>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Company name</label>
              <input className="input" value={form.company_name} onChange={set('company_name')} required placeholder="Acme Corp" />
            </div>
            <div>
              <label className="label">Your full name</label>
              <input className="input" value={form.full_name} onChange={set('full_name')} required placeholder="Jane Smith" />
            </div>
            <div>
              <label className="label">Work email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} required placeholder="jane@acme.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} required placeholder="8+ characters" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex justify-center">
              {loading ? 'Creating account…' : 'Create free account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account? <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
