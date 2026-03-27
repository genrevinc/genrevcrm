import { useEffect, useState } from 'react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, CheckSquare, Clock, Trash2, Check } from 'lucide-react'
import { format } from 'date-fns'

export default function TasksPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState('open')
  const [form, setForm] = useState({ title: '', description: '', type: 'task', priority: 'medium', due_date: '' })

  const fetch = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'completed') params.set('status', 'completed')
      const res = await api.get('/tasks?' + params)
      setTasks(res.data)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [filter])

  const complete = async (id) => {
    try { await api.patch(`/tasks/${id}`, { status: 'completed' }); fetch(); toast.success('Task done!') }
    catch { toast.error('Failed') }
  }

  const del = async (id) => {
    try { await api.delete(`/tasks/${id}`); fetch() }
    catch { toast.error('Failed') }
  }

  const create = async (e) => {
    e.preventDefault()
    try { await api.post('/tasks', form); toast.success('Task created'); setShowNew(false); setForm({ title:'',description:'',type:'task',priority:'medium',due_date:'' }); fetch() }
    catch { toast.error('Failed') }
  }

  const priorityColor = { high: 'text-red-600', medium: 'text-amber-500', low: 'text-slate-400' }
  const today = tasks.filter(t => t.due_date && format(new Date(t.due_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'))
  const upcoming = tasks.filter(t => !t.due_date || format(new Date(t.due_date), 'yyyy-MM-dd') > format(new Date(), 'yyyy-MM-dd'))
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && format(new Date(t.due_date), 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd'))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowNew(true)}><Plus size={14} /> New task</button>
      </div>

      <div className="flex gap-2 mb-5">
        {['open','completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s}</button>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-slate-400">Loading…</div> : (
        <div className="space-y-5">
          {overdue.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Overdue ({overdue.length})</h2>
              <TaskList tasks={overdue} onComplete={complete} onDelete={del} priorityColor={priorityColor} overdue />
            </div>
          )}
          {today.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Due today ({today.length})</h2>
              <TaskList tasks={today} onComplete={complete} onDelete={del} priorityColor={priorityColor} />
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Upcoming ({upcoming.length})</h2>
              <TaskList tasks={upcoming} onComplete={complete} onDelete={del} priorityColor={priorityColor} />
            </div>
          )}
          {filter === 'completed' && tasks.length > 0 && (
            <TaskList tasks={tasks} onComplete={complete} onDelete={del} priorityColor={priorityColor} />
          )}
          {tasks.length === 0 && (
            <div className="card p-12 text-center text-slate-400">
              <CheckSquare size={32} className="mx-auto mb-2 opacity-40" />
              <p>No tasks {filter === 'open' ? 'to do' : 'completed yet'}</p>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="font-bold">New task</h2><button onClick={() => setShowNew(false)} className="text-slate-400">✕</button></div>
            <form onSubmit={create} className="p-5 space-y-3">
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required /></div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Type</label>
                  <select className="input" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
                    {['task','call','email','meeting','follow_up'].map(t => <option key={t} value={t} className="capitalize">{t.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm(f=>({...f,priority:e.target.value}))}>
                    {['low','medium','high'].map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Due date</label><input className="input" type="datetime-local" value={form.due_date} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} /></div>
              <div className="flex gap-2 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowNew(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskList({ tasks, onComplete, onDelete, priorityColor, overdue }) {
  return (
    <div className="card divide-y divide-slate-100 overflow-hidden">
      {tasks.map(t => (
        <div key={t.id} className={`flex items-center gap-3 p-3.5 ${overdue ? 'bg-red-50/50' : ''}`}>
          <button onClick={() => onComplete(t.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${t.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-indigo-500'}`}>
            {t.status === 'completed' && <Check size={11} className="text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.title}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="capitalize">{t.type?.replace('_',' ')}</span>
              {t.due_date && <><span>·</span><span className={overdue ? 'text-red-500 font-medium' : ''}>{format(new Date(t.due_date), 'MMM d, h:mm a')}</span></>}
              {t.assigned_to_name && <><span>·</span><span>{t.assigned_to_name}</span></>}
            </div>
          </div>
          <span className={`text-xs font-semibold capitalize ${priorityColor[t.priority] || ''}`}>{t.priority}</span>
          <button onClick={() => onDelete(t.id)} className="p-1 text-slate-300 hover:text-red-400 rounded"><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  )
}
