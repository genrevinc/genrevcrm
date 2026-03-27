import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { Plus, AlertCircle, Clock, User, Building2 } from 'lucide-react'
import NewDealModal from '../components/deals/NewDealModal'

function AIScore({ score }) {
  if (!score) return null
  const color = score >= 70 ? 'bg-emerald-100 text-emerald-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${color}`}>AI {score}</span>
}

function DealCard({ deal }) {
  const isIdle = parseFloat(deal.days_idle) > 5
  const contactName = deal.first_name ? `${deal.first_name} ${deal.last_name}` : null

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('dealId', deal.id)
        e.currentTarget.style.opacity = '0.4'
      }}
      onDragEnd={(e) => {
        e.currentTarget.style.opacity = '1'
      }}
      className={`bg-white border rounded-xl p-3.5 mb-2 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none ${isIdle ? 'border-red-200' : 'border-slate-200'}`}
    >
      <Link to={`/deals/${deal.id}`} onClick={e => e.stopPropagation()} className="block">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="text-sm font-semibold text-slate-800 leading-tight">{deal.name}</p>
          <AIScore score={deal.ai_score} />
        </div>
        <p className="text-sm font-bold text-indigo-600 mb-2">
          ${(parseFloat(deal.value) || 0).toLocaleString()}
        </p>
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
            <AlertCircle size={10} /> {Math.round(deal.days_idle)}d idle
          </div>
        )}
        {deal.expected_close && (
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
            <Clock size={10} /> {new Date(deal.expected_close).toLocaleDateString()}
          </div>
        )}
      </Link>
    </div>
  )
}

function StageColumn({ stage, deals, onDrop, filter }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const formatK = (v) => { const n = parseFloat(v) || 0; return n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${Math.round(n)}` }

  const filteredDeals = filter
    ? deals.filter(d =>
        d.name.toLowerCase().includes(filter.toLowerCase()) ||
        d.company_name?.toLowerCase().includes(filter.toLowerCase()) ||
        d.first_name?.toLowerCase().includes(filter.toLowerCase())
      )
    : deals

  return (
    <div className="flex flex-col" style={{ width: 220, minWidth: 220 }}>
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

      {/* Drop zone */}
      <div
        className="flex-1 min-h-32 rounded-xl transition-all duration-150"
        style={{
          background: isDragOver ? stage.color + '15' : 'transparent',
          border: isDragOver ? `2px dashed ${stage.color}` : '2px dashed transparent',
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setIsDragOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          const dealId = e.dataTransfer.getData('dealId')
          if (dealId) onDrop(dealId, stage.id, stage.name)
        }}
      >
        {filteredDeals.map(deal => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {filteredDeals.length === 0 && !isDragOver && (
          <div className="text-center py-6">
            <p className="text-xs text-slate-400">Drop deals here</p>
          </div>
        )}
        {isDragOver && (
          <div className="text-center py-6">
            <p className="text-xs font-medium" style={{ color: stage.color }}>Drop to move here</p>
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
  const [dragging, setDragging] = useState(false)

  const fetchPipeline = async () => {
    try {
      const res = await api.get('/deals/pipeline-view')
      setStages(res.data)
    } catch { toast.error('Failed to load pipeline') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPipeline() }, [])

  const handleDrop = async (dealId, newStageId, stageName) => {
    // Optimistic update
    setStages(prev => prev.map(s => ({
      ...s,
      deals: s.id === newStageId
        ? [...s.deals.filter(d => d.id !== dealId), ...s.deals.filter(d => d.id === dealId).length === 0
            ? prev.flatMap(st => st.deals).filter(d => d.id === dealId)
            : []]
        : s.deals.filter(d => d.id !== dealId),
      total_value: 0
    })))

    try {
      await api.patch(`/deals/${dealId}`, { stage_id: newStageId })
      toast.success(`Moved to ${stageName}`)
      fetchPipeline() // Refresh with real data
    } catch {
      toast.error('Failed to move deal')
      fetchPipeline()
    }
  }

  const totalPipelineValue = stages.reduce((sum, s) => sum + (parseFloat(s.total_value) || 0), 0)
  const formatK = (v) => { const n = parseFloat(v) || 0; return n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${Math.round(n)}` }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

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
          <input
            className="input w-48 text-xs"
            placeholder="Filter deals…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setShowNewDeal(true)}>
            <Plus size={14} /> New deal
          </button>
        </div>
      </div>

      {/* Drag hint */}
      <div className="px-6 py-1.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs text-slate-400">💡 Drag and drop deals between stages</p>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div
          className="flex gap-3 h-full"
          style={{ minWidth: stages.length * 236 + 'px' }}
          onDragStart={() => setDragging(true)}
          onDragEnd={() => setDragging(false)}
        >
          {stages.map((stage) => (
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

      {showNewDeal && (
        <NewDealModal
          onClose={() => setShowNewDeal(false)}
          onCreated={fetchPipeline}
        />
      )}
    </div>
  )
}
