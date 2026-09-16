/* eslint-disable no-restricted-globals */
import * as XLSX from 'xlsx';
import { FundamentalMapping, Trade } from '../types/trade';
import { normalizeTradesAsync } from '../utils/parsing';

type ParseRequest = {
  type: 'parse';
  buffer: ArrayBuffer;
};

type NormalizeRequest = {
  type: 'normalize';
  rows: Record<string, any>[];
  mapping: FundamentalMapping;
};

type WorkerRequest = ParseRequest | NormalizeRequest;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  if (data.type === 'parse') {
    const workbook = XLSX.read(data.buffer, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const headers: string[] = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    (self as any).postMessage(
      {
        type: 'parsed',
        headers,
        rows,
        csv
      },
      []
    );
    return;
  }

  if (data.type === 'normalize') {
    const { rows, mapping } = data;
    const { trades, warnings } = await normalizeTradesAsync(rows, mapping, 2000);
    (self as any).postMessage(
      {
        type: 'normalized',
        trades,
        warnings
      },
      []
    );
  }
};
