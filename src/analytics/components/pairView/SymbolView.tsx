import React, { useMemo, useState } from 'react';
import { GroupStats } from '../../types/trade';

type Props = {
  symbolStats: GroupStats[];
  nightMode: boolean;
};

type SortKey = keyof GroupStats | 'winRate';

const SymbolView: React.FC<Props> = ({ symbolStats, nightMode }) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'netPnl',
    dir: 'desc'
  });
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'netPnl', label: 'Net P/L' },
    { key: 'tradesCount', label: 'Orders' },
    { key: 'winRate', label: 'Win rate' },
    { key: 'avgPnlPerTrade', label: 'Avg P/L' },
    { key: 'totalProfit', label: 'Total Profit' },
    { key: 'totalLoss', label: 'Total Loss' },
    { key: 'avgConcurrentTrades', label: 'Avg open' },
    { key: 'maxConcurrentTrades', label: 'Max open' },
    { key: 'key', label: 'Symbol (A-Z)' }
  ];

  const sorted = useMemo(() => {
    const list = [...symbolStats];
    list.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'key') {
        return dir * String(a.key).localeCompare(String(b.key));
      }
      const av = a[sort.key as keyof GroupStats] as number;
      const bv = b[sort.key as keyof GroupStats] as number;
      return dir * ((bv ?? 0) - (av ?? 0));
    });
    return list;
  }, [symbolStats, sort]);

  const setSortKey = (key: SortKey) =>
    setSort((prev) => ({
      key,
      dir: prev.key === key ? (prev.dir === 'desc' ? 'asc' : 'desc') : 'desc'
    }));

  const rowShadow = (net: number) => {
    const strength = Math.min(0.95, Math.abs(net) / (Math.abs(net) + 250));
    const color =
      net >= 0
        ? `rgba(16,185,129,${(0.25 + strength * 0.35).toFixed(3)})`
        : `rgba(248,113,113,${(0.25 + strength * 0.35).toFixed(3)})`;
    const outline =
      net >= 0
        ? '0 0 0 1px rgba(16,185,129,0.25)'
        : '0 0 0 1px rgba(248,113,113,0.25)';
    return { boxShadow: `0 18px 48px -16px ${color}, ${outline}` };
  };

  const containerClass = nightMode
    ? 'mt-6 card p-4 bg-slate-900 text-slate-100 border border-slate-800'
    : 'mt-6 card p-4';
  const headerButtonClass = nightMode
    ? 'text-xs font-semibold px-3 py-2 rounded-full border border-slate-700 bg-slate-800 text-slate-100 shadow-sm hover:border-slate-600'
    : 'text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 bg-white shadow-sm hover:border-slate-300';
  const headerSubBtnClass = nightMode
    ? 'text-[11px] px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-800 text-slate-100 hover:border-slate-600 shadow-sm'
    : 'text-[11px] px-2.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-white shadow-sm';

  return (
    <section className={containerClass}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-lg font-semibold">Symbol Summary</div>
          <div className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Aggregations respect current time selection and filters.
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            className={headerButtonClass}
            onClick={() => setSort((prev) => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))}
          >
            Sort: {sortOptions.find((o) => o.key === sort.key)?.label || 'Net P/L'} ({sort.dir === 'asc' ? '↑' : '↓'})
          </button>
          <button
            className={headerSubBtnClass}
            onClick={() => setSortMenuOpen((v) => !v)}
          >
            Choose label
          </button>
          {sortMenuOpen && (
            <div
              className={`absolute right-0 top-11 z-10 w-52 rounded-lg shadow-lg p-2 space-y-1 ${
                nightMode ? 'bg-slate-800 border border-slate-700 text-slate-100' : 'bg-white border border-slate-200'
              }`}
            >
              {sortOptions.map((opt) => (
                <button
                  key={opt.key as string}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-slate-50 ${
                    sort.key === opt.key ? (nightMode ? 'bg-slate-700 font-semibold' : 'bg-slate-100 font-semibold') : ''
                  }`}
                  onClick={() => {
                    setSortKey(opt.key);
                    setSortMenuOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className={nightMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-100'}>
            <tr>
              {[
                { label: 'Symbol', key: 'key' as SortKey },
                { label: 'Orders', key: 'tradesCount' as SortKey },
                { label: 'Total Profit', key: 'totalProfit' as SortKey },
                { label: 'Total Loss', key: 'totalLoss' as SortKey },
                { label: 'Net P/L', key: 'netPnl' as SortKey },
                { label: 'Win rate', key: 'winRate' as SortKey },
                { label: 'Avg P/L', key: 'avgPnlPerTrade' as SortKey },
                { label: 'Avg open', key: 'avgConcurrentTrades' as SortKey },
                { label: 'Max open', key: 'maxConcurrentTrades' as SortKey }
              ].map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-left font-semibold cursor-pointer select-none ${
                    nightMode ? 'text-slate-100' : 'text-slate-700'
                  }`}
                  onClick={() => setSortKey(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sort.key === col.key && (sort.dir === 'asc' ? '↑' : '↓')}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.key}
                className={`border-b transition ${
                  nightMode ? 'border-slate-800 hover:bg-slate-800/60' : 'border-slate-100 hover:bg-slate-50'
                }`}
                style={rowShadow(s.netPnl)}
              >
                <td className="px-3 py-2 font-semibold">{s.key}</td>
                <td className="px-3 py-2">{s.tradesCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-emerald-500 font-semibold">
                  {s.totalProfit.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-rose-500 font-semibold">{s.totalLoss.toFixed(2)}</td>
                <td
                  className={`px-3 py-2 font-semibold ${
                    s.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  <span className="text-base font-extrabold">{s.netPnl.toFixed(2)}</span>
                </td>
                <td className="px-3 py-2">{s.winRate.toFixed(1)}%</td>
                <td className="px-3 py-2">{s.avgPnlPerTrade.toFixed(2)}</td>
                <td className="px-3 py-2">{s.avgConcurrentTrades?.toFixed(2) ?? '-'}</td>
                <td className="px-3 py-2">{s.maxConcurrentTrades ?? '-'}</td>
              </tr>
            ))}
            {!symbolStats.length && (
              <tr>
                <td
                  colSpan={8}
                  className={`text-center py-6 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  No symbols found in the current subset.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default SymbolView;
