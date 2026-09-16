import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getMetricHelp, MetricHelpExampleStep } from '../../content/metricHelp';

type Props = {
  label: string;
  helpId: string;
  nightMode?: boolean;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
};

const accentClass = (accent: MetricHelpExampleStep['accent'], nightMode: boolean) => {
  if (accent === 'emerald') return nightMode ? 'text-emerald-300 bg-emerald-950/60' : 'text-emerald-700 bg-emerald-50';
  if (accent === 'rose') return nightMode ? 'text-rose-300 bg-rose-950/60' : 'text-rose-700 bg-rose-50';
  if (accent === 'amber') return nightMode ? 'text-amber-300 bg-amber-950/60' : 'text-amber-700 bg-amber-50';
  return nightMode ? 'text-sky-300 bg-sky-950/60' : 'text-sky-700 bg-sky-50';
};

const MetricField: React.FC<Props> = ({
  label,
  helpId,
  nightMode = false,
  className = '',
  labelClassName = '',
  children
}) => {
  const [open, setOpen] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const content = getMetricHelp(helpId);

  const close = useCallback(() => {
    setOpen(false);
    setShowExample(false);
    setVisibleSteps(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!showExample || !content) {
      setVisibleSteps(0);
      return;
    }
    setVisibleSteps(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    content.example.steps.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleSteps(i + 1), 180 + i * 420));
    });
    return () => timers.forEach(clearTimeout);
  }, [showExample, content]);

  const openHelp = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
    setShowExample(false);
    setVisibleSteps(0);
  };

  const runExample = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowExample(true);
  };

  return (
    <>
      <div className={`group/metric relative ${className}`}>
        <div className="flex items-center gap-1 min-h-[1.25rem]">
          <span
            className={`text-xs flex-1 min-w-0 ${
              labelClassName || (nightMode ? 'text-slate-400' : 'text-slate-500')
            }`}
          >
            {label}
          </span>
          {content && (
            <button
              ref={helpBtnRef}
              type="button"
              aria-label={`Help: ${label}`}
              onClick={openHelp}
              className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-all duration-200 opacity-0 scale-75 group-hover/metric:opacity-100 group-hover/metric:scale-100 focus:opacity-100 focus:scale-100 ${
                nightMode
                  ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/40 hover:bg-indigo-500/35'
                  : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-100'
              }`}
            >
              ?
            </button>
          )}
        </div>
        {children}
      </div>

      {open &&
        content &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-[2px] animate-help-backdrop"
              onClick={close}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`help-title-${helpId}`}
              className={`fixed left-1/2 top-1/2 z-[201] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl border animate-help-popup ${
                nightMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`px-5 pt-5 pb-4 border-b ${
                  nightMode ? 'border-slate-800 bg-gradient-to-br from-indigo-950/40 to-transparent' : 'border-slate-100 bg-gradient-to-br from-indigo-50/80 to-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      nightMode ? 'bg-indigo-500/25 text-indigo-200' : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    i
                  </div>
                  <div>
                    <h3 id={`help-title-${helpId}`} className="text-base font-bold leading-tight">
                      {content.title}
                    </h3>
                    <p className={`mt-1.5 text-sm leading-relaxed ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {content.description}
                    </p>
                    {content.formula && (
                      <p
                        className={`mt-2 text-xs font-mono px-2.5 py-1.5 rounded-lg inline-block ${
                          nightMode ? 'bg-slate-800 text-indigo-200' : 'bg-slate-100 text-indigo-800'
                        }`}
                      >
                        {content.formula}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                {!showExample ? (
                  <button
                    type="button"
                    onClick={runExample}
                    className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] ${
                      nightMode
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/40'
                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-200'
                    }`}
                  >
                    Show example
                  </button>
                ) : (
                  <div
                    className={`rounded-xl border p-3.5 space-y-2.5 ${
                      nightMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50/80'
                    }`}
                  >
                    <div className={`text-xs font-semibold uppercase tracking-wide ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Example
                    </div>
                    <p className={`text-sm ${nightMode ? 'text-slate-200' : 'text-slate-700'}`}>{content.example.intro}</p>
                    <div className="space-y-2">
                      {content.example.steps.map((step, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-500 ${
                            i < visibleSteps
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 translate-y-2 pointer-events-none'
                          } ${accentClass(step.accent, nightMode)}`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold">{step.label}</div>
                            {step.detail && (
                              <div className={`text-xs ${nightMode ? 'opacity-80' : 'opacity-70'}`}>{step.detail}</div>
                            )}
                          </div>
                          {step.value && <div className="font-bold tabular-nums shrink-0">{step.value}</div>}
                        </div>
                      ))}
                    </div>
                    <div
                      className={`mt-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-all duration-700 ${
                        visibleSteps >= content.example.steps.length
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-2'
                      } ${nightMode ? 'bg-emerald-950/50 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'}`}
                    >
                      {content.example.result}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExample(false);
                        setVisibleSteps(0);
                      }}
                      className={`text-xs font-medium underline-offset-2 hover:underline ${
                        nightMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Close example
                    </button>
                  </div>
                )}
              </div>

              <div className={`px-5 pb-5 flex justify-end`}>
                <button
                  type="button"
                  onClick={close}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    nightMode
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  OK
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
};

export default MetricField;

/** Shorthand for label + value metric rows used in Day/Holiday views. */
export const HelpMetric: React.FC<{
  label: string;
  helpId: string;
  value: React.ReactNode;
  nightMode?: boolean;
}> = ({ label, helpId, value, nightMode }) => (
  <MetricField label={label} helpId={helpId} nightMode={nightMode}>
    <span className="font-semibold">{value}</span>
  </MetricField>
);
