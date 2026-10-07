import React from 'react';
import { clsx } from 'clsx';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  errorStepIndex?: number;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStepIndex,
  errorStepIndex,
  className,
}) => {
  return (
    <div className={clsx('w-full', className)}>
      <ol className="flex items-center w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex && errorStepIndex === undefined;
          const isError = idx === errorStepIndex;
          const isLast = idx === steps.length - 1;

          return (
            <li
              key={step.id}
              className={clsx(
                'flex items-center',
                isLast ? 'w-auto' : 'w-full'
              )}
            >
              <div className="flex flex-col items-center sm:items-start group">
                <div className="flex items-center">
                  <div
                    className={clsx(
                      'flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full font-bold text-xs sm:text-sm border-2 transition-all duration-200',
                      isCompleted && 'bg-emerald-600 border-emerald-600 text-white',
                      isCurrent && 'bg-navy-900 border-navy-900 text-white ring-4 ring-navy-900/10',
                      isError && 'bg-rose-600 border-rose-600 text-white ring-4 ring-rose-600/10',
                      !isCompleted && !isCurrent && !isError && 'bg-white border-slate-300 text-slate-400'
                    )}
                  >
                    {isCompleted ? (
                      <Check size={16} strokeWidth={3} />
                    ) : isCurrent ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isError ? (
                      <AlertCircle size={16} />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={clsx(
                        'flex-1 h-0.5 min-w-[24px] sm:min-w-[60px] mx-2 transition-colors duration-200',
                        isCompleted ? 'bg-emerald-600' : 'bg-slate-200'
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="mt-2 text-center sm:text-left">
                  <p
                    className={clsx(
                      'text-xs font-semibold',
                      isCurrent ? 'text-navy-950 font-bold' : isCompleted ? 'text-slate-800' : isError ? 'text-rose-600 font-bold' : 'text-slate-400'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[11px] text-slate-500 hidden sm:block max-w-[120px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
