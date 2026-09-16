import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const CsvWorker = () => new Worker(new URL('../../workers/csvWorker.ts', import.meta.url), { type: 'module' });

type Props = {
  setRawRows: (rows: Record<string, any>[]) => void;
  nightMode: boolean;
};

const ExcelUpload: React.FC<Props> = ({ setRawRows, nightMode }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { setHeaders, setWarnings, setTrades } = useAppContext();
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [csvUrl, setCsvUrl] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const worker = CsvWorker();
      workerRef.current = worker;
      worker.onmessage = (ev: MessageEvent<any>) => {
        if (ev.data.type === 'parsed') {
          const { headers, rows, csv } = ev.data;
          setRawRows(rows);
          setHeaders(headers);
          setWarnings([]);
          setTrades([]); // reset trades until mapping is confirmed
          setFileName(file.name);
          const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          setCsvUrl(blobUrl);
          setLoading(false);
        }
      };
      worker.postMessage({ type: 'parse', buffer }, [buffer]);
    } catch (err) {
      console.error(err);
      setWarnings(['Failed to read file. Ensure it is a valid Excel workbook.']);
      setLoading(false);
    } finally {
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleChange}
      />
      <button
        className={`px-4 py-2 rounded-full text-sm font-semibold shadow-sm hover:shadow-md transition ${
          nightMode ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-slate-900 text-white'
        }`}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? 'Loading...' : 'Upload Excel'}
      </button>
      {fileName && <span className={`text-xs ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>{fileName}</span>}
      {csvUrl && (
        <a
          href={csvUrl}
          download={fileName.replace(/\.xlsx?$/i, '') + '.csv'}
          className={`text-xs underline ${nightMode ? 'text-slate-200' : 'text-slate-700'}`}
        >
          Download CSV
        </a>
      )}
    </div>
  );
};

export default ExcelUpload;
