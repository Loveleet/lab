import React, { useEffect, useRef, useState } from 'react';
import {
  AnalyticsCloudFile,
  downloadAnalyticsFile,
  listAnalyticsFiles,
  renameAnalyticsFile,
  uploadAnalyticsFile
} from '../../utils/fileApi';
import { parseExcelBuffer } from '../../utils/parseExcel';

type Props = {
  open: boolean;
  onClose: () => void;
  nightMode: boolean;
  onParsed: (payload: {
    headers: string[];
    rows: Record<string, any>[];
    fileName: string;
  }) => void;
};

const FilePicker: React.FC<Props> = ({ open, onClose, nightMode, onParsed }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<AnalyticsCloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const panel = nightMode ? 'bg-slate-900 text-slate-100 border border-slate-800' : 'bg-white text-slate-900';
  const muted = nightMode ? 'text-slate-400' : 'text-slate-500';
  const rowClass = nightMode
    ? 'border-slate-800 hover:bg-slate-800/80'
    : 'border-slate-100 hover:bg-slate-50';

  const refresh = async () => {
    try {
      setFiles(await listAnalyticsFiles());
    } catch (err: any) {
      setError(err?.message || 'Could not load saved files');
    }
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    refresh();
  }, [open]);

  const parseAndClose = async (buffer: ArrayBuffer, fileName: string) => {
    const parsed = await parseExcelBuffer(buffer);
    onParsed({ headers: parsed.headers, rows: parsed.rows, fileName });
    onClose();
  };

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const saved = await uploadAnalyticsFile(file);
      const buffer = await file.arrayBuffer();
      await parseAndClose(buffer, saved.filename || file.name);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleOpen = async (item: AnalyticsCloudFile) => {
    setLoading(true);
    setError(null);
    try {
      const buffer = await downloadAnalyticsFile(item.id);
      await parseAndClose(buffer, item.filename);
    } catch (err: any) {
      setError(err?.message || 'Could not open file');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (item: AnalyticsCloudFile) => {
    const next = renameValue.trim();
    if (!next) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await renameAnalyticsFile(item.id, next);
      setFiles((prev) => prev.map((f) => (f.id === item.id ? updated : f)));
      setRenamingId(null);
    } catch (err: any) {
      setError(err?.message || 'Rename failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
      <div className={`rounded-2xl shadow-2xl max-w-2xl w-full p-6 ${panel}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xl font-semibold">Open file</div>
            <p className={`text-xs ${muted}`}>Upload from this PC (saved on cloud) or pick a file already stored here.</p>
          </div>
          <button className={`text-sm font-semibold ${nightMode ? 'text-slate-300' : 'text-slate-500'}`} onClick={onClose}>
            Close
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />

        <button
          className={`w-full mb-4 px-4 py-2 rounded-full text-sm font-semibold ${
            nightMode ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-slate-900 text-white'
          }`}
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? 'Working…' : 'Upload from this PC'}
        </button>

        {error && <div className="mb-3 text-sm text-rose-500">{error}</div>}

        <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>Already on cloud</div>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
          {files.length === 0 ? (
            <div className={`p-4 text-sm ${muted}`}>No saved files yet.</div>
          ) : (
            files.map((item) => (
              <div key={item.id} className={`flex items-center gap-2 px-3 py-2 border-b last:border-b-0 ${rowClass}`}>
                <div className="min-w-0 flex-1">
                  {renamingId === item.id ? (
                    <input
                      autoFocus
                      className={`w-full rounded-lg border px-2 py-1 text-sm ${
                        nightMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                      }`}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(item);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                    />
                  ) : (
                    <>
                      <div className="truncate text-sm font-medium">{item.filename}</div>
                      <div className={`text-[11px] ${muted}`}>
                        {new Date(item.updatedAt || item.createdAt).toLocaleString()} · {(item.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </>
                  )}
                </div>
                {renamingId === item.id ? (
                  <>
                    <button className="text-xs font-semibold text-emerald-600" onClick={() => handleRename(item)}>
                      Save
                    </button>
                    <button className={`text-xs ${muted}`} onClick={() => setRenamingId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={`text-xs font-semibold ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}
                      onClick={() => {
                        setRenamingId(item.id);
                        setRenameValue(item.filename);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        nightMode ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-white'
                      }`}
                      disabled={loading}
                      onClick={() => handleOpen(item)}
                    >
                      Open
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePicker;
