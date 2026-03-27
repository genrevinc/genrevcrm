import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, Users, Building2, TrendingUp, Kanban,
  CheckSquare, Activity, BarChart3, FileText, Package,
  Settings, LogOut, Bell, Zap, ChevronDown, Search, Bot
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban },
  { to: '/deals', label: 'Deals', icon: TrendingUp },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/activities', label: 'Activities', icon: Activity },
  { to: '/quotes', label: 'Quotes', icon: FileText },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/ai', label: 'AI & Automations', icon: Bot },
]

const bottomItems = [
  { to: '/products', label: 'Products', icon: Package },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Avatar({ name, size = 'sm' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
  const color = colors[name?.charCodeAt(0) % colors.length] || 'bg-indigo-500'
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}

export { Avatar }

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-56'} flex-shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200`}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          {!collapsed && <span className="font-bold text-slate-900 text-base">GenRev</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-slate-100 space-y-0.5">
          {bottomItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}>
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
          <button onClick={handleLogout}
            className={`nav-item w-full text-red-500 hover:bg-red-50 hover:text-red-600 ${collapsed ? 'justify-center px-2' : ''}`}>
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          {/* User */}
          <div className={`flex items-center gap-2 p-2 mt-1 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
            <Avatar name={user?.full_name} />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <LayoutDashboard size={16} />
          </button>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search contacts, deals, companies…" />
            </div>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 relative">
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2 pl-2">
              <Avatar name={user?.full_name} />
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-slate-800">{user?.full_name}</p>
                <p className="text-xs text-slate-500">{user?.tenant_name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
