const CsvWorker = () =>
  new Worker(new URL('../workers/csvWorker.ts', import.meta.url), { type: 'module' });

export type ParsedWorkbook = {
  headers: string[];
  rows: Record<string, any>[];
  csv: string;
};

export function parseExcelBuffer(buffer: ArrayBuffer): Promise<ParsedWorkbook> {
  return new Promise((resolve, reject) => {
    const worker = CsvWorker();
    const fail = (err: unknown) => {
      worker.terminate();
      reject(err);
    };
    worker.onerror = (ev) => fail(ev.message || 'Excel parse failed');
    worker.onmessage = (ev: MessageEvent<any>) => {
      if (ev.data?.type === 'parsed') {
        worker.terminate();
        resolve({
          headers: ev.data.headers || [],
          rows: ev.data.rows || [],
          csv: ev.data.csv || ''
        });
      }
    };
    try {
      worker.postMessage({ type: 'parse', buffer }, [buffer]);
    } catch (err) {
      fail(err);
    }
  });
}
