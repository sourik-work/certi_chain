import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
  children: React.ReactNode;
  variant?: 'white' | 'slate' | 'navy' | 'pattern';
}

export const Section: React.FC<SectionProps> = ({
  className,
  children,
  variant = 'white',
  ...props
}) => {
  const variantClasses = {
    white: 'bg-white text-slate-900',
    slate: 'bg-slate-50/80 text-slate-900 border-y border-slate-200/70',
    navy: 'bg-navy-950 text-white',
    pattern: 'bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900',
  }[variant];

  return (
    <section
      className={twMerge(clsx('py-12 sm:py-16 lg:py-20 relative overflow-hidden', variantClasses, className))}
      {...props}
    >
      {children}
    </section>
  );
};
