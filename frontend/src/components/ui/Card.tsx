import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'navy' | 'floating' | 'subtle';
  hoverable?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'white',
  hoverable = false,
  className,
  children,
  ...props
}) => {
  const variantClasses = {
    white: 'bg-white border border-slate-200/90 text-slate-800 shadow-card',
    navy: 'bg-navy-950 text-white border border-navy-800/80 shadow-navy-deep',
    floating: 'bg-white border border-slate-200 text-slate-800 shadow-floating',
    subtle: 'bg-slate-50 border border-slate-200/80 text-slate-800 shadow-subtle',
  }[variant];

  return (
    <div
      className={twMerge(
        clsx(
          'rounded-2xl transition-all duration-200',
          variantClasses,
          hoverable && 'hover:shadow-card-hover hover:-translate-y-0.5',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
