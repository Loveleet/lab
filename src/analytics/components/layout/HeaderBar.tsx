import React from 'react';
import ActionFilterToggle from '../filters/ActionFilterToggle';
import { useAppContext } from '../../context/AppContext';

type SourceMode = 'live' | 'files';

type Props = {
  onOpenMapping: () => void;
  onOpenFiles: () => void;
  sourceMode: SourceMode;
  onSourceMode: (mode: SourceMode) => void;
  canMap: boolean;
  fileName?: string;
  liveStatus?: string;
  liveLoading?: boolean;
  nightMode: boolean;
};

const HeaderBar: React.FC<Props> = ({
  onOpenMapping,
  onOpenFiles,
  sourceMode,
  onSourceMode,
  canMap,
  fileName,
  liveStatus,
  liveLoading,
  nightMode
}) => {
  const { state } = useAppContext();
  const hasTrades = state.trades.some((t) => !t.invalid);
  const pill = (active: boolean) =>
    active
      ? 'bg-slate-900 text-white'
      : nightMode
        ? 'text-slate-200'
        : 'text-slate-600';

  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur border-b ${
        nightMode ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-50/95 border-slate-200'
      }`}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 justify-self-start">
          <div className="text-xl font-bold tracking-tight">Analytics</div>
          <div className={`text-xs truncate ${nightMode ? 'text-slate-300' : 'text-slate-500'}`}>
            {sourceMode === 'live'
              ? liveLoading
                ? liveStatus || 'Loading live + closed trades…'
                : liveStatus || 'Live: running from DB + closed from cloud file'
              : fileName
                ? `File: ${fileName}`
                : 'Open a saved file or upload Excel from this PC'}
          </div>
        </div>

        <div className="justify-self-center">
          {hasTrades ? (
            <ActionFilterToggle nightMode={nightMode} compact />
          ) : (
            <span className={`text-xs ${nightMode ? 'text-slate-600' : 'text-slate-300'}`} aria-hidden />
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 shrink-0 justify-self-end">
          <div
            className={`flex items-center border shadow-sm rounded-full p-1 ${
              nightMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <button
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${pill(sourceMode === 'live')}`}
              onClick={() => onSourceMode('live')}
            >
              Live
            </button>
            <button
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${pill(sourceMode === 'files')}`}
              onClick={() => onSourceMode('files')}
            >
              Files
            </button>
          </div>
          {sourceMode === 'files' && (
            <>
              <button
                className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${
                  nightMode ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-slate-900 text-white'
                }`}
                onClick={onOpenFiles}
              >
                Open file
              </button>
              <button
                className={`px-4 py-2 rounded-full border text-sm font-semibold shadow-sm transition ${
                  nightMode
                    ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
                    : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-100'
                }`}
                disabled={!canMap}
                onClick={onOpenMapping}
              >
                Settings
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
