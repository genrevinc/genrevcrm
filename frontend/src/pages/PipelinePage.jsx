import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, AlertCircle, Clock, User, Building2, DollarSign } from 'lucide-react'
import NewDealModal from '../components/deals/NewDealModal'

function AIScore({ score }) {
  if (!score) return null
  const color = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${color}`}>AI {score}</span>
}

function DealCard({ deal, onMoveStage, stages }) {
  const isIdle = deal.days_idle > 5
  const contactName = deal.first_name ? `${deal.first_name} ${deal.last_name}` : null

  return (
    <div className={`bg-white border rounded-xl p-3.5 mb-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${isIdle ? 'border-red-200' : 'border-slate-200'}`}>
      <Link to={`/deals/${deal.id}`} className="block">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="text-sm font-semibold text-slate-800 leading-tight">{deal.name}</p>
          <AIScore score={deal.contact_id ? Math.floor(Math.random() * 40 + 50) : null} />
        </div>
        <p className="text-sm font-bold text-indigo-600 mb-2">${parseFloat(deal.value || 0).toLocaleString()}</p>
        {contactName && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
            <User size={10} /> {contactName}
          </div>
        )}
        {deal.company_name && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
            <Building2 size={10} /> {deal.company_name}
          </div>
        )}
        {isIdle && (
          <div className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
            <AlertCircle size={10} /> {Math.round(deal.days_idle)}d idle — follow up
          </div>
        )}
        {deal.expected_close && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
            <Clock size={10} /> Close {new Date(deal.expected_close).toLocaleDateString()}
          </div>
        )}
      </Link>
      {/* Quick stage move buttons */}
      <div className="mt-2.5 flex gap-1 flex-wrap">
        {stages.filter(s => s.id !== deal.stage_id && !s.is_won && !s.is_lost).slice(0, 2).map(s => (
          <button key={s.id}
            onClick={(e) => { e.preventDefault(); onMoveStage(deal.id, s.id, s.name) }}
            className="text-xs px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-500 truncate max-w-[90px]">
            → {s.name}
          </button>
        ))}
        {stages.find(s => s.is_won) && deal.stage_id !== stages.find(s => s.is_won)?.id && (
          <button onClick={(e) => { e.preventDefault(); const won = stages.find(s => s.is_won); onMoveStage(deal.id, won.id, won.name) }}
            className="text-xs px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Won ✓</button>
        )}
      </div>
    </div>
  )
}

export default function PipelinePage() {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [filter, setFilter] = useState('')

  const fetchPipeline = async () => {
    try {
      const res = await api.get('/deals/pipeline-view')
      setStages(res.data)
    } catch { toast.error('Failed to load pipeline') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPipeline() }, [])

  const allStages = stages.map(s => ({ id: s.id, name: s.name, is_won: s.is_won, is_lost: s.is_lost }))

  const handleMoveStage = async (dealId, newStageId, stageName) => {
    try {
      await api.patch(`/deals/${dealId}`, { stage_id: newStageId })
      toast.success(`Moved to ${stageName}`)
      fetchPipeline()
    } catch { toast.error('Failed to move deal') }
  }

  const totalPipelineValue = stages.reduce((sum, s) => sum + (parseFloat(s.total_value) || 0), 0)
  const formatK = (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Pipeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {stages.reduce((n, s) => n + s.deals.length, 0)} deals · Total {formatK(totalPipelineValue)}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input className="input w-48 text-xs" placeholder="Filter deals…" value={filter} onChange={e => setFilter(e.target.value)} />
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowNewDeal(true)}>
            <Plus size={14} /> New deal
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full" style={{ minWidth: stages.length * 230 + 'px' }}>
          {stages.map((stage) => {
            const filteredDeals = filter
              ? stage.deals.filter(d => d.name.toLowerCase().includes(filter.toLowerCase()) || d.company_name?.toLowerCase().includes(filter.toLowerCase()))
              : stage.deals

            return (
              <div key={stage.id} className="flex flex-col" style={{ width: 220, minWidth: 220 }}>
                {/* Column header */}
                <div className="rounded-xl mb-2 px-3 py-2.5" style={{ backgroundColor: stage.color + '18' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{stage.name}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{filteredDeals.length}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-0.5 ml-4">{formatK(stage.total_value)}</p>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto min-h-[60px] rounded-xl">
                  {filteredDeals.map(deal => (
                    <DealCard key={deal.id} deal={deal} onMoveStage={handleMoveStage} stages={allStages} />
                  ))}
                  {filteredDeals.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-slate-400">Drop deals here</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showNewDeal && <NewDealModal onClose={() => setShowNewDeal(false)} onCreated={fetchPipeline} />}
    </div>
  )
}
