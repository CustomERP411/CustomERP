import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface InventoryAlertCardProps {
  title: string;
  subtitle?: string;
  actionHref: string;
  actionLabel?: string;
  loading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  children?: ReactNode;
}

export default function InventoryAlertCard({
  title,
  subtitle,
  actionHref,
  actionLabel = 'View',
  loading,
  isEmpty,
  emptyLabel,
  children,
}: InventoryAlertCardProps) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
        </div>
        <Link to={actionHref} className="text-sm font-semibold text-blue-600 hover:underline">
          {actionLabel}
        </Link>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : isEmpty ? (
          <div className="text-sm text-slate-500">{emptyLabel}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
