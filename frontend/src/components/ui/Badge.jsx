import React from 'react';
import { cn } from '../../lib/utils';

export function DecisionBadge({ decision, className }) {
  const map = {
    'SHIP_AS_IS': {
      label: 'Ship As-Is',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20',
      dot: 'bg-emerald-500'
    },
    'SHIP_AFTER_CONFIRMATION': {
      label: 'Ship After Confirmation',
      bg: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600/20',
      dot: 'bg-blue-500'
    },
    'NUDGE_TO_PREPAID': {
      label: 'Nudge to Prepaid',
      bg: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-600/20',
      dot: 'bg-purple-500'
    },
    'HOLD_CANCEL': {
      label: 'Hold / Cancel',
      bg: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/20',
      dot: 'bg-rose-500'
    }
  };

  const item = map[decision] || {
    label: decision || 'Unknown',
    bg: 'bg-gray-50 text-gray-700 border-gray-200 ring-gray-600/20',
    dot: 'bg-gray-400'
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-xs',
      item.bg,
      className
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', item.dot)} />
      {item.label}
    </span>
  );
}

export function RiskTierBadge({ tier, score, className }) {
  const map = {
    'LOW': {
      label: 'Low Risk',
      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    'MEDIUM': {
      label: 'Medium Risk',
      classes: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    'HIGH': {
      label: 'High Risk',
      classes: 'bg-orange-50 text-orange-700 border-orange-200'
    },
    'CRITICAL': {
      label: 'Critical Risk',
      classes: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold'
    }
  };

  const item = map[tier] || {
    label: tier || 'Standard',
    classes: 'bg-gray-50 text-gray-700 border-gray-200'
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
      item.classes,
      className
    )}>
      {score !== undefined && <span className="font-mono font-bold">{score}</span>}
      <span>{item.label}</span>
    </span>
  );
}

