import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  BrainCircuit, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function Sidebar({ mobileOpen, onCloseMobile, desktopOpen = true, onToggleDesktop }) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { label: 'Overview', to: '/', icon: LayoutDashboard },
    { label: 'Order Management', to: '/orders', icon: ShoppingBag, badge: 'Live' },
    { label: 'AI Risk Analysis', to: '/risk-analysis', icon: BrainCircuit, badge: 'AI' },
    { label: 'WhatsApp Simulator', to: '/whatsapp-simulator', icon: MessageSquare },
    { label: 'Analytics & Reports', to: '/analytics', icon: BarChart3 },
    { label: 'Settings', to: '/settings', icon: Settings }
  ];

  const content = (
    <aside
      className={cn(
        'h-screen bg-sidebar text-white flex flex-col justify-between border-r border-sidebar-border transition-all duration-300 select-none z-30 shrink-0 sticky top-0',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-accent to-indigo-400 flex items-center justify-center shadow-md shadow-primary-accent/30 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-tight">
                  RTO Sentinel
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-secondary-light flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Protection Active
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Collapse toggle (icon only vs full) */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg text-secondary-light hover:text-white hover:bg-sidebar-hover transition-colors hidden lg:flex"
              title={collapsed ? "Expand sidebar" : "Compact sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            {/* Full close toggle */}
            {onToggleDesktop && (
              <button
                onClick={onToggleDesktop}
                className="p-1.5 rounded-lg text-secondary-light hover:text-white hover:bg-sidebar-hover transition-colors hidden lg:flex"
                title="Hide sidebar fully"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Mobile close button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-secondary-light hover:text-white lg:hidden"
                title="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Brand context info */}
        {!collapsed && (
          <div className="mx-4 my-3 px-3 py-2 rounded-lg bg-sidebar-hover/40 border border-sidebar-border/60">
            <div className="text-[11px] font-medium text-secondary-light">Store:</div>
            <div className="text-xs font-semibold text-white truncate">VelvetLocks Haircare (D2C)</div>
          </div>
        )}

        {/* Navigation items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative group',
                    isActive
                      ? 'bg-primary-accent text-white shadow-xs font-semibold'
                      : 'text-secondary-light hover:text-white hover:bg-sidebar-hover'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-secondary-light group-hover:text-white')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className={cn(
                        'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded tracking-wide uppercase',
                        item.badge === 'AI' 
                          ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30' 
                          : 'bg-emerald-500/20 text-emerald-300'
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User profile & system health */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            AM
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">Aditya Mehta</div>
              <div className="text-[11px] text-secondary-light truncate">Head of Operations</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      {desktopOpen && (
        <div className="hidden lg:block shrink-0 transition-all duration-300">
          {content}
        </div>
      )}

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" 
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-64 shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
