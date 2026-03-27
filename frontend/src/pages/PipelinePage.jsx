import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, AlertCircle, Clock, User, Building2 } from 'lucide-react'
import NewDealModal from '../components/deals/NewDealModal'

function DealCard({ deal }) {
  const isIdle = parseFloat(deal.days_idle) > 5

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', deal.id)
    // Small timeout so the drag image renders before opacity change
    setTimeout(() => { e.target.style.opacity = '0.4' }, 0)
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1'
  }

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ cursor: 'grab' }}
      className={`bg-white border rounded-xl p-3.5 mb-2 shadow-sm hover:shadow-md transition-shadow select-none ${
        isIdle ? 'border-red-200' : 'border-slate-200'
      }`}
    >
      {/* Name + value — NOT a link so drag works cleanly */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{deal.name}</p>
        {deal.ai_score > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
            deal.ai_score >= 70 ? 'bg-emerald-100 text-emerald-700' :
            deal.ai_score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>AI {deal.ai_score}</span>
        )}
      </div>
      <p className="text-sm font-bold text-indigo-600 mb-2">
        ${(parseFloat(deal.value) || 0).toLocaleString()}
      </p>
      {deal.first_name && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
          <User size={10} /> {deal.first_name} {deal.last_name}
        </div>
      )}
      {deal.company_name && (
        <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
          <Building2 size={10} /> {deal.company_name}
        </div>
      )}
      {isIdle && (
        <div className="flex items-center gap-1 text-xs text-red-500 mt-1">
          <AlertCircle size={10} /> {Math.round(deal.days_idle)}d idle
        </div>
      )}
      {deal.expected_close && (
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
          <Clock size={10} /> {new Date(deal.expected_close).toLocaleDateString()}
        </div>
      )}
      {/* Open link below the draggable area */}
      <Link
        to={`/deals/${deal.id}`}
        className="block mt-2 text-xs text-indigo-500 hover:underline"
        onClick={e => e.stopPropagation()}
      >
        Open deal →
      </Link>
    </div>
  )
}

function StageColumn({ stage, deals, onDrop, filter }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const formatK = (v) => { const n = parseFloat(v) || 0; return n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${Math.round(n)}` }

  const filteredDeals = filter
    ? deals.filter(d =>
        d.name?.toLowerCase().includes(filter.toLowerCase()) ||
        d.company_name?.toLowerCase().includes(filter.toLowerCase()) ||
        `${d.first_name} ${d.last_name}`.toLowerCase().includes(filter.toLowerCase())
      )
    : deals

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if leaving the column entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const dealId = e.dataTransfer.getData('text/plain')
    if (dealId) {
      onDrop(dealId, stage.id, stage.name)
    }
  }

  return (
    <div className="flex flex-col" style={{ width: 220, minWidth: 220 }}>
      {/* Header */}
      <div
        className="rounded-xl mb-2 px-3 py-2.5 transition-colors"
        style={{ backgroundColor: isDragOver ? stage.color + '30' : stage.color + '15' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
            <span className="text-xs font-semibold text-slate-700 truncate">{stage.name}</span>
          </div>
          <span className="text-xs text-slate-500">{filteredDeals.length}</span>
        </div>
        <p className="text-xs font-bold text-slate-700 mt-0.5 ml-4">{formatK(stage.total_value)}</p>
      </div>

      {/* Cards + drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 rounded-xl p-1 transition-all duration-150 min-h-24"
        style={{
          border: isDragOver ? `2px dashed ${stage.color}` : '2px dashed transparent',
          backgroundColor: isDragOver ? stage.color + '08' : 'transparent',
        }}
      >
        {filteredDeals.map(deal => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {filteredDeals.length === 0 && (
          <div className="text-center py-5">
            <p className="text-xs text-slate-400">
              {isDragOver ? '✓ Drop here' : 'Empty'}
            </p>
          </div>
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

  const handleDrop = async (dealId, newStageId, stageName) => {
    // Check it's actually a different stage
    const currentStage = stages.find(s => s.deals?.some(d => d.id === dealId))
    if (currentStage?.id === newStageId) return

    // Optimistic UI update
    setStages(prev => {
      const deal = prev.flatMap(s => s.deals || []).find(d => d.id === dealId)
      if (!deal) return prev
      return prev.map(s => ({
        ...s,
        deals: s.id === newStageId
          ? [...(s.deals || []), { ...deal, stage_id: newStageId }]
          : (s.deals || []).filter(d => d.id !== dealId)
      }))
    })

    try {
      await api.patch(`/deals/${dealId}`, { stage_id: newStageId })
      toast.success(`→ ${stageName}`)
      fetchPipeline()
    } catch {
      toast.error('Failed to move deal')
      fetchPipeline()
    }
  }

  const totalValue = stages.reduce((sum, s) => sum + (parseFloat(s.total_value) || 0), 0)
  const totalDeals = stages.reduce((n, s) => n + (s.deals?.length || 0), 0)
  const formatK = (v) => { const n = parseFloat(v) || 0; return n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${Math.round(n)}` }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Pipeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">{totalDeals} deals · {formatK(totalValue)}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input className="input w-44 text-xs" placeholder="Filter deals…" value={filter} onChange={e => setFilter(e.target.value)} />
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowNewDeal(true)}>
            <Plus size={14} /> New deal
          </button>
        </div>
      </div>

      <div className="px-6 py-1.5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
        <p className="text-xs text-slate-400">Drag deal cards between columns to move stages</p>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3" style={{ minWidth: stages.length * 236 + 'px', minHeight: '100%' }}>
          {stages.map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={stage.deals || []}
              onDrop={handleDrop}
              filter={filter}
            />
          ))}
        </div>
      </div>

      {showNewDeal && <NewDealModal onClose={() => setShowNewDeal(false)} onCreated={fetchPipeline} />}
    </div>
  )
}
