import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  kicker?: string;
  align?: 'left' | 'center';
  theme?: 'dark' | 'light';
  className?: string;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subtitle,
  kicker,
  align = 'left',
  theme = 'light',
  className,
  ...props
}) => {
  const isCenter = align === 'center';
  const isDark = theme === 'dark';

  return (
    <div
      className={twMerge(
        clsx(
          'mb-8 sm:mb-12',
          isCenter ? 'text-center flex flex-col items-center' : 'text-left',
          className
        )
      )}
      {...props}
    >
      {kicker && (
        <span
          className={clsx(
            'text-xs font-bold uppercase tracking-widest mb-2 inline-block',
            isDark ? 'text-gold-400' : 'text-azure-700'
          )}
        >
          {kicker}
        </span>
      )}
      <h2
        className={clsx(
          'text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight relative pb-4',
          isDark ? 'text-white' : 'text-navy-950'
        )}
      >
        {title}
        <span
          aria-hidden="true"
          className={clsx(
            'absolute bottom-0 h-1 w-12 rounded-full',
            isCenter ? 'left-1/2 -translate-x-1/2' : 'left-0',
            isDark ? 'bg-gold-400' : 'bg-navy-900'
          )}
        />
      </h2>
      {subtitle && (
        <p
          className={clsx(
            'mt-3 text-base sm:text-lg max-w-3xl',
            isDark ? 'text-slate-300' : 'text-slate-600'
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};
