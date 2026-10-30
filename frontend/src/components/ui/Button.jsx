import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-primary-accent text-white hover:bg-primary-accentHover focus:ring-primary-accent/40 shadow-xs',
    secondary: 'bg-white text-primary border border-neutralBorder hover:bg-gray-50 focus:ring-gray-200 shadow-xs',
    outline: 'bg-transparent text-primary border border-neutralBorder hover:bg-gray-50 focus:ring-gray-200',
    ghost: 'bg-transparent text-secondary hover:text-primary hover:bg-gray-100 focus:ring-gray-200',
    danger: 'bg-danger text-white hover:bg-red-600 focus:ring-danger/40 shadow-xs'
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5'
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

