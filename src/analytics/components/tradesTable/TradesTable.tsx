import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { utils as XLSXUtils, writeFile as writeXLSXFile } from 'xlsx';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Cell,
  Row,
  SortingState,
  useReactTable
} from '@tanstack/react-table';
import { Trade } from '../../types/trade';
import { formatDate, toDurationStr } from '../../utils/time';

type Props = {
  trades: Trade[];
  nightMode: boolean;
};

const TradesTable: FC<Props> = ({ trades, nightMode }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [{ pageIndex, pageSize }, setPagination] = useState({ pageIndex: 0, pageSize: 200 });
  const [countsOpen, setCountsOpen] = useState(false);
  const [countField, setCountField] = useState<'day' | 'action' | 'symbol' | 'interval'>('day');
  const data = useMemo(() => trades, [trades]);

  const toMs = (value: unknown) => {
    if (value === null || value === undefined) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const toWeekday = (value: unknown) => {
    const ms = toMs(value);
    if (!ms) return '';
    return new Date(ms).toLocaleDateString(undefined, { weekday: 'short' });
  };

  const counts = useMemo(() => {
    const counter = new Map<string, number>();
    data.forEach((trade) => {
      let key = '';
      if (countField === 'day') key = toWeekday(trade.startTime) || 'Unknown';
      else if (countField === 'action') key = trade.action ? String(trade.action) : 'Unknown';
      else if (countField === 'symbol') key = trade.symbol || 'Unknown';
      else if (countField === 'interval') key = trade.timeBucket || 'Unknown';
      counter.set(key, (counter.get(key) || 0) + 1);
    });
    return Array.from(counter.entries()).sort((a, b) => b[1] - a[1]);
  }, [data, countField]);

  const controlButtonClass = nightMode
    ? 'text-xs font-semibold px-3 py-2 rounded-full border border-slate-700 bg-slate-800 text-slate-100 shadow-sm hover:border-slate-600'
    : 'text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 bg-white shadow-sm hover:border-slate-300';

  const columns = useMemo<ColumnDef<Trade>[]>(
    () => [
      {
        header: 'Start Time',
        id: 'startTime',
        accessorFn: (row) => toMs(row.startTime),
        cell: (info) => formatDate(new Date(info.getValue<number>()))
      },
      {
        header: 'Day',
        id: 'day',
        accessorFn: (row) => toMs(row.startTime),
        cell: (info) => toWeekday(info.row.original.startTime)
      },
      {
        header: 'End Time',
        id: 'endTime',
        accessorFn: (row) => toMs(row.endTime),
        cell: (info) => formatDate(new Date(info.getValue<number>()))
      },
      {
        header: 'Symbol',
        accessorKey: 'symbol',
        cell: (info) => {
          const trade = info.row.original;
          const startMs = toMs(trade?.startTime);
          const endMs = toMs(trade?.endTime);
          return (
            <a
              className={`${
                nightMode ? 'text-indigo-200 hover:text-indigo-100' : 'text-slate-900 hover:text-indigo-600'
              } font-semibold underline decoration-dotted underline-offset-4`}
              href={
                startMs && endMs
                  ? `/analytics/chart?symbol=${encodeURIComponent(trade.symbol)}&start=${startMs}&end=${endMs}`
                  : undefined
              }
              target="_blank"
              rel="noreferrer"
            >
              {info.getValue<string>()}
            </a>
          );
        }
      },
      { header: 'Action', accessorKey: 'action' },
      {
        header: 'P/L',
        id: 'pnlValue',
        accessorFn: (row) => row.pnlValue,
        cell: (info) => {
          const val = info.getValue<number>();
          return (
            <span className={val >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
              {val.toFixed(2)}
            </span>
          );
        }
      },
      {
        header: 'Interval',
        accessorKey: 'timeBucket',
        cell: (info) => {
          const bucket = info.getValue<string>();
          // derive interval from bucket spacing if encoded like "HH:MM"
          const parts = bucket.split(':');
          if (parts.length === 2) {
            const minute = Number(parts[1]);
            if (minute === 0) return '1h';
            if (minute % 30 === 0) return '30m';
            if (minute % 15 === 0) return '15m';
            if (minute % 5 === 0) return '5m';
          }
          return bucket;
        }
      },
      {
        header: 'Duration',
        id: 'durationMs',
        accessorFn: (row) => row.durationMs,
        cell: (info) => {
          const row = info.row.original;
          const duration = toDurationStr(info.getValue<number>());
          const binanceUrl = `https://www.binance.com/en/trade/${encodeURIComponent(
            row.symbol
          )}?type=spot`;
          return (
            <a
              href={binanceUrl}
              target="_blank"
              rel="noreferrer"
              className={nightMode ? 'text-blue-200 hover:text-blue-100' : 'text-blue-600 hover:underline'}
              title="Open in Binance"
            >
              {duration}
            </a>
          );
        }
      }
    ],
    []
  );

  const table = useReactTable<Trade>({
    data,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false
  });
  const pagedRows = table.getRowModel().rows;

  const exportCurrentPage = () => {
    const rows = pagedRows.map((row) => row.original);
    const formatted = rows.map((r) => ({
      'Start Time': r.startTime ? formatDate(new Date(r.startTime)) : '',
      Day: toWeekday(r.startTime),
      'End Time': r.endTime ? formatDate(new Date(r.endTime)) : '',
      Symbol: r.symbol,
      Action: r.action,
      'P/L': r.pnlValue,
      Interval: r.timeBucket,
      Duration: toDurationStr(r.durationMs)
    }));
    const sheet = XLSXUtils.json_to_sheet(formatted);
    const wb = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(wb, sheet, 'Trades');
    writeXLSXFile(wb, 'trades-page.xlsx');
  };

  return (
    <div
      className={`overflow-x-auto relative ${
        nightMode ? 'bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-3' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="relative flex items-center gap-2">
          <select
            className={`text-xs font-semibold px-3 py-2 rounded-full border ${
              nightMode
                ? 'border-slate-700 bg-slate-800 text-slate-100'
                : 'border-slate-200 bg-white'
            }`}
            value={countField}
            onChange={(e) => setCountField(e.target.value as typeof countField)}
          >
            <option value="day">Day</option>
            <option value="action">Action (Buy/Sell)</option>
            <option value="symbol">Symbol</option>
            <option value="interval">Interval</option>
          </select>
          <button
            className={controlButtonClass}
            onClick={() => setCountsOpen((v) => !v)}
          >
            Show counts
          </button>
          {countsOpen && (
            <div
              className={`absolute z-10 mt-2 w-56 rounded-lg shadow-lg max-h-64 overflow-auto ${
                nightMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
              }`}
              style={{ top: '110%' }}
            >
              {counts.map(([label, count]) => (
                <div
                  key={label}
                  className={`px-3 py-2 text-sm flex justify-between ${
                    nightMode ? 'text-slate-100' : ''
                  }`}
                >
                  <span className="truncate">{label}</span>
                  <span className={nightMode ? 'text-slate-300' : 'text-slate-600'}>
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className={controlButtonClass}
          onClick={exportCurrentPage}
          disabled={!pagedRows.length}
          title="Export current page rows to Excel"
        >
          Export page to Excel
        </button>
      </div>
      <table className="min-w-full text-sm">
        <thead className={nightMode ? 'bg-slate-800' : 'bg-slate-100'}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-3 py-2 text-left font-semibold cursor-pointer select-none ${
                    nightMode ? 'text-slate-100' : 'text-slate-700'
                  }`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <span className="ml-1 text-xs text-slate-500 inline-flex items-center gap-1">
                    {header.column.getIsSorted()
                      ? ({
                          asc: '↑',
                          desc: '↓'
                        }[header.column.getIsSorted() as string] || null)
                      : null}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {pagedRows.map((row: Row<Trade>) => (
            <tr
              key={row.id}
              className={`border-b ${
                nightMode
                  ? 'border-slate-800 hover:bg-slate-800/60'
                  : 'border-slate-100 hover:bg-slate-50'
              }`}
            >
              {row.getVisibleCells().map((cell: Cell<Trade, unknown>) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {!trades.length && (
            <tr>
              <td
                colSpan={columns.length}
                className={`text-center py-6 ${nightMode ? 'text-slate-300' : 'text-slate-500'}`}
              >
                No trades match the current selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {trades.length > pageSize && (
        <div className="flex items-center justify-between text-xs text-slate-600 mt-3">
          <div>
            Page {pageIndex + 1} / {table.getPageCount()} · {trades.length.toLocaleString()} rows
          </div>
          <div className="space-x-2">
            <button
              className={`px-2 py-1 rounded border ${
                nightMode
                  ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
                  : 'border-slate-200'
              }`}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Prev
            </button>
            <button
              className={`px-2 py-1 rounded border ${
                nightMode
                  ? 'border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600'
                  : 'border-slate-200'
              }`}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradesTable;
