import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Container: React.FC<ContainerProps> = ({
  className,
  children,
  size = 'lg',
  ...props
}) => {
  const sizeClasses = {
    sm: 'max-w-3xl',
    md: 'max-w-5xl',
    lg: 'max-w-7xl',
    xl: 'max-w-[1360px]',
    full: 'max-w-full',
  }[size];

  return (
    <div
      className={twMerge(clsx('w-full mx-auto px-4 sm:px-6 lg:px-8', sizeClasses, className))}
      {...props}
    >
      {children}
    </div>
  );
};
