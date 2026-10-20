import React from 'react';

export const FILE_PIPELINE = [
  'Downloading the file',
  'Reading the Excel',
  'Waiting for column mapping',
  'Keeping the selected columns',
  'Preparing the results',
  'Saving the smaller file'
] as const;

type Props = {
  step: number;
  nightMode: boolean;
  note?: string;
  className?: string;
};

const FileProgress: React.FC<Props> = ({ step, nightMode, note, className }) => {
  return (
    <div
      className={`${className || 'mx-auto mt-10 max-w-md'} rounded-2xl border p-6 text-left shadow-sm ${
        nightMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
      }`}
    >
      <div className={`text-lg font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-900'}`}>
        Please wait
      </div>
      <p className={`mt-1 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {FILE_PIPELINE[step] || 'Working'}…
      </p>
      {note ? (
        <p className={`mt-1 text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>{note}</p>
      ) : null}
      <ol className="mt-5 space-y-3">
        {FILE_PIPELINE.map((label, index) => {
          const saving = index === FILE_PIPELINE.length - 1 && /saving/i.test(note || '');
          const done = index < step && !saving;
          const current = index === step || saving;
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : current
                      ? nightMode
                        ? 'border-sky-400 text-sky-300'
                        : 'border-slate-900 text-slate-900'
                      : nightMode
                        ? 'border-slate-700 text-slate-600'
                        : 'border-slate-200 text-slate-300'
                }`}
              >
                {done ? '✓' : current ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" /> : index + 1}
              </span>
              <span
                className={
                  current
                    ? nightMode
                      ? 'font-semibold text-slate-100'
                      : 'font-semibold text-slate-900'
                    : done
                      ? nightMode
                        ? 'text-slate-300'
                        : 'text-slate-600'
                      : nightMode
                        ? 'text-slate-600'
                        : 'text-slate-400'
                }
              >
                {label}
                {current ? '…' : done ? '' : ' — waiting'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default FileProgress;
