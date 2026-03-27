import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { TrendingUp, Users, DollarSign, Target, CheckSquare, Zap, ArrowRight, Clock, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, FunnelChart, Funnel, Cell } from 'recharts'
import { format } from 'date-fns'

function StatCard({ label, value, sub, icon: Icon, color = 'indigo', trend }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      {trend && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          <TrendingUp size={12} />
          {trend > 0 ? '+' : ''}{trend}% vs last month
        </div>
      )}
    </div>
  )
}

function ActivityIcon({ type }) {
  const map = {
    call: '📞', email: 'envelope', note: '📝', meeting: '📅',
    stage_change: '→', deal_created: '💼', contact_created: '👤'
  }
  return <span className="text-sm">{map[type] || '📌'}</span>
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/forecast'),
      api.get('/tasks?due_today=true'),
    ]).then(([s, f, t]) => {
      setStats(s.data)
      setForecast(f.data)
      setTasks(t.data)
    }).finally(() => setLoading(false))
  }, [])

  const formatCurrency = (v) => {
    const n = parseFloat(v) || 0
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }

  const forecastData = forecast ? [
    { name: 'Won', value: parseFloat(forecast.won), fill: '#10b981' },
    { name: 'Commit', value: parseFloat(forecast.commit_value), fill: '#f59e0b' },
    { name: 'Best case', value: parseFloat(forecast.best_case), fill: '#6366f1' },
    { name: 'Pipeline', value: parseFloat(forecast.pipeline), fill: '#94a3b8' },
  ] : []

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{greeting}, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {tasks.length > 0 ? `${tasks.length} task${tasks.length > 1 ? 's' : ''} due today` : 'No tasks due today'} · Here's your pipeline snapshot
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/contacts" className="btn-secondary flex items-center gap-1.5">
            <Users size={14} /> New contact
          </Link>
          <Link to="/deals" className="btn-primary flex items-center gap-1.5">
            <TrendingUp size={14} /> New deal
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pipeline value" value={formatCurrency(stats?.pipeline_value)} sub={`${stats?.open_deals} open deals`} icon={DollarSign} color="indigo" trend={12} />
        <StatCard label="Won this month" value={formatCurrency(stats?.won_this_month?.value)} sub={`${stats?.won_this_month?.count || 0} deals closed`} icon={Target} color="green" trend={8} />
        <StatCard label="Win rate" value={`${stats?.win_rate || 0}%`} sub="Last 90 days" icon={TrendingUp} color="amber" trend={-2} />
        <StatCard label="Tasks due today" value={stats?.tasks_due_today || 0} sub="Needs your attention" icon={CheckSquare} color={stats?.tasks_due_today > 0 ? 'red' : 'indigo'} />
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline funnel */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 text-sm">Pipeline by stage</h2>
            <Link to="/pipeline" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">View board <ArrowRight size={12} /></Link>
          </div>
          <div className="space-y-2.5">
            {stats?.stage_breakdown?.map((s) => {
              const pct = parseFloat(stats.pipeline_value) > 0 ? (parseFloat(s.total_value) / parseFloat(stats.pipeline_value)) * 100 : 0
              return (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-slate-600 truncate">{s.name}</div>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: s.color }} />
                  </div>
                  <div className="text-xs text-slate-500 w-10 text-right">{s.deal_count}</div>
                  <div className="text-xs font-medium text-slate-700 w-16 text-right">{formatCurrency(s.total_value)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Forecast */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 text-sm mb-4">Forecast — this month</h2>
          <div className="space-y-3">
            {forecastData.map(d => (
              <div key={d.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">{d.name}</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(d.value)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${Math.min((d.value / (forecastData[3]?.value || 1)) * 100, 100)}%`, backgroundColor: d.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tasks due */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 text-sm">Due today</h2>
            <Link to="/tasks" className="text-xs text-indigo-600 hover:underline">All tasks</Link>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <CheckSquare size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">All clear for today</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 capitalize">{t.type} · {t.priority}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 text-sm">Recent activity</h2>
            <Link to="/activities" className="text-xs text-indigo-600 hover:underline">All activity</Link>
          </div>
          <div className="space-y-3">
            {stats?.recent_activities?.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <ActivityIcon type={a.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-700 truncate">
                    <span className="font-medium">{a.user_name}</span> · {a.subject || a.type}
                  </p>
                  <p className="text-xs text-slate-400">{format(new Date(a.occurred_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rep leaderboard */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 text-sm">Rep performance</h2>
            <Link to="/reports" className="text-xs text-indigo-600 hover:underline">Full report</Link>
          </div>
          <div className="space-y-3">
            {stats?.rep_performance?.slice(0, 5).map((rep, i) => (
              <div key={rep.id} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{rep.full_name}</p>
                  <p className="text-xs text-slate-400">{rep.won_count} won · {rep.win_rate}% rate</p>
                </div>
                <p className="text-xs font-semibold text-emerald-600">{formatCurrency(rep.won_value)}</p>
              </div>
            ))}
            {(!stats?.rep_performance || stats.rep_performance.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-4">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
