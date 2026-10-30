import React, { useState } from 'react';
import { Calendar, Plus, Menu, X, User, ShieldAlert, CheckCircle2, ChevronDown, ExternalLink } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';

export function Header({ 
  title, 
  subtitle, 
  onOpenNewOrder, 
  selectedPeriod, 
  onPeriodChange,
  onToggleMobileMenu 
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-neutralBorder px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Menu Toggle & Title */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 -ml-2 rounded-lg text-secondary hover:text-primary hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Toggle navigation sidebar"
            title="Toggle navigation sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="truncate">
          <h1 className="text-base sm:text-lg font-bold text-primary tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-secondary truncate hidden sm:block mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Middle/Right: Period Filters, Actions, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Date Filter (when supplied) */}
        {onPeriodChange && (
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-neutralBorder text-xs font-medium text-secondary">
            {['Yesterday', 'Last 7 Days', 'All Time'].map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-2 sm:px-2.5 py-1 rounded-md transition-all ${
                  selectedPeriod === p
                    ? 'bg-white text-primary shadow-xs font-semibold'
                    : 'hover:text-primary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* User Avatar Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary-accent to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-xs">
              AM
            </div>
            <ChevronDown className="w-3 h-3 text-secondary hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-modal border border-neutralBorder z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-3 border-b border-neutralBorder bg-gray-50">
                <div className="text-xs font-bold text-primary">Aditya Mehta</div>
                <div className="text-[11px] text-secondary">Head of Operations</div>
                <div className="text-[10px] font-medium text-primary-accent mt-0.5">VelvetLocks Haircare</div>
              </div>
              <div className="p-1 text-xs">
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-secondary hover:text-primary transition-colors"
                >
                  Settings & Policy Rules
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/analytics'); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-secondary hover:text-primary transition-colors"
                >
                  Policy Backtester
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
