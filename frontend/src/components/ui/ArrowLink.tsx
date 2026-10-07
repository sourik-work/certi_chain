import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronRight } from 'lucide-react';

interface ArrowLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
  className?: string;
  theme?: 'navy' | 'white' | 'azure';
}

export const ArrowLink: React.FC<ArrowLinkProps> = ({
  children,
  className,
  theme = 'azure',
  ...props
}) => {
  const themeClasses = {
    azure: 'text-azure-700 hover:text-navy-950',
    navy: 'text-navy-900 hover:text-azure-700',
    white: 'text-white/90 hover:text-white',
  }[theme];

  return (
    <a
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 font-semibold text-sm group transition-all duration-150 cursor-pointer',
          themeClasses,
          className
        )
      )}
      {...props}
    >
      <span>{children}</span>
      <ChevronRight
        size={16}
        className="transition-transform duration-150 group-hover:translate-x-1"
        aria-hidden="true"
      />
    </a>
  );
};
