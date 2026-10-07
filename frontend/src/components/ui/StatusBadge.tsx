import React from 'react';
import { clsx } from 'clsx';
import { ShieldCheck, AlertOctagon, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'valid' | 'revoked' | 'tampered' | 'pending';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className,
}) => {
  const configs = {
    valid: {
      text: label || 'Valid & Authentic',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      icon: ShieldCheck,
      iconClass: 'text-emerald-600',
    },
    revoked: {
      text: label || 'Revoked Credential',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
      icon: XCircle,
      iconClass: 'text-rose-600',
    },
    tampered: {
      text: label || 'Invalid / Tampered',
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
      icon: AlertOctagon,
      iconClass: 'text-amber-600',
    },
    pending: {
      text: label || 'Verification Pending',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      icon: ShieldCheck,
      iconClass: 'text-slate-500',
    },
  }[status];

  const Icon = configs.icon;
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm';
  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold border shadow-sm',
        configs.badgeClass,
        sizeClasses,
        className
      )}
    >
      <Icon size={iconSize} className={configs.iconClass} aria-hidden="true" />
      <span>{configs.text}</span>
    </span>
  );
};
