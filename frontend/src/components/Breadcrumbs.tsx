import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  currentPage: string;
  onNavigateHome: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  currentPage,
  onNavigateHome,
}) => {
  return (
    <nav aria-label="Breadcrumb" className="bg-slate-100/90 border-b border-slate-200/80 py-2.5 px-4 text-xs font-medium text-slate-600">
      <div className="max-w-7xl mx-auto flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1 hover:text-navy-950 transition-colors focus:outline-none"
        >
          <Home size={14} className="text-navy-900" />
          <span>Home</span>
        </button>
        <ChevronRight size={13} className="text-slate-400" />
        <span className="text-navy-950 font-bold">{currentPage}</span>
      </div>
    </nav>
  );
};
