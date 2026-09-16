import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const pickInterval = (durationMs: number) => {
  const hours = durationMs / 1000 / 60 / 60;
  if (hours > 48) return '1h';
  if (hours > 12) return '15m';
  if (hours > 3) return '5m';
  return '1m';
};

const ChartPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const symbol = params.get('symbol') || '';
  const startMs = Number(params.get('start'));
  const endMs = Number(params.get('end'));
  const startDate = isNaN(startMs) ? null : new Date(startMs);
  const endDateRaw = isNaN(endMs) ? null : new Date(endMs);
  const now = Date.now();
  const endDate =
    endDateRaw && startDate && endDateRaw.getTime() > startDate.getTime()
      ? new Date(Math.min(endDateRaw.getTime(), now))
      : startDate
        ? new Date(Math.min(startDate.getTime() + 6 * 60 * 60 * 1000, now))
        : null;

  const duration = startDate && endDate ? endDate.getTime() - startDate.getTime() : 0;
  const interval = duration ? pickInterval(duration) : '1m';

  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready' | 'empty'>('idle');
  const [renderMode, setRenderMode] = useState<'library' | 'svg'>('library');
  const [source, setSource] = useState<'binance' | 'fallback'>('binance');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const fetchedKeyRef = useRef<string>('');

  const queryRange = useMemo(() => {
    if (!startDate || !endDate) return null;
    const padding = Math.max(30 * 60 * 1000, duration * 2 || 0); // 30m or 2x duration
    return {
      start: Math.max(0, startDate.getTime() - padding),
      end: Math.max(0, endDate.getTime() + padding)
    };
  }, [duration, endDate, startDate]);

  useEffect(() => {
    if (!symbol || !queryRange) return;

    const key = `${symbol}-${queryRange.start}-${queryRange.end}-${interval}`;
    if (fetchedKeyRef.current === key && candles.length) return;
    fetchedKeyRef.current = key;

    const now = Date.now();
    const rangeEnd = Math.min(queryRange.end, now);
    const rangeStart = Math.max(queryRange.start, 0);
    if (rangeStart >= rangeEnd) {
      setStatus('error');
      return;
    }
    let aborted = false;
    const fetchCandles = async () => {
      setStatus('loading');
      try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
          symbol
        )}&interval=${interval}&startTime=${rangeStart}&endTime=${rangeEnd}`;
        let parsed: Candle[] = [];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load candles (${res.status})`);
        let data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          setStatus('empty');
          return;
        }
        parsed = data.map((c: any) => ({
          time: Math.floor(c[0] / 1000),
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4])
        }));
        setSource('binance');
        setCandles(parsed);
        setStatus(parsed.length ? 'ready' : 'empty');
      } catch (err) {
        console.error(err);
        if (!aborted) setStatus('error');
      }
    };
    fetchCandles();
    return () => {
      aborted = true;
    };
  }, [interval, queryRange, symbol]);

  useEffect(() => {
    if (!containerRef.current || !candles.length || !startDate || !endDate) return;

    const el = containerRef.current;
    if (!el) return;

    // try library chart, fallback to inline SVG
    try {
      if (!createChart) throw new Error('createChart missing');

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      let chart;
      chart = createChart(el, {
        width: containerRef.current.clientWidth,
        height: 720,
        layout: {
          background: { color: '#0b1221' },
          textColor: '#e2e8f0'
        },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.15)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.2)' }
        },
        crosshair: { mode: 1 },
        rightPriceScale: { borderVisible: true, autoScale: true, visible: true },
        timeScale: { borderVisible: true, timeVisible: true, secondsVisible: interval === '1m' }
      });
      chartRef.current = chart;

      const hasCandle = typeof (chart as any).addCandlestickSeries === 'function';
      const hasLine = typeof (chart as any).addLineSeries === 'function';
      if (!hasCandle && !hasLine) throw new Error('No series methods');

      if (hasCandle) {
        const candleSeries = (chart as any).addCandlestickSeries({
          upColor: '#16a34a',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#fb7185'
        });
        candleSeries.setData(candles);
      } else if (hasLine) {
        const lineSeries = (chart as any).addLineSeries({
          color: '#38bdf8',
          lineWidth: 2
        });
        lineSeries.setData(
          candles.map((c) => ({
            time: c.time as any,
            value: c.close
          }))
        );
      }

      const minPrice = Math.min(...candles.map((c) => c.low));
      const maxPrice = Math.max(...candles.map((c) => c.high));

      const startTs = Math.floor(startDate.getTime() / 1000);
      const endTs = Math.floor(endDate.getTime() / 1000);

      const startLine = (chart as any).addLineSeries({
        color: 'rgba(52,211,153,0.9)',
        lineStyle: LineStyle.Solid,
        lineWidth: 2
      });
      startLine.setData([
        { time: startTs as any, value: minPrice },
        { time: startTs as any, value: maxPrice }
      ]);

      const endLine = (chart as any).addLineSeries({
        color: 'rgba(239,68,68,0.9)',
        lineStyle: LineStyle.Solid,
        lineWidth: 2
      });
      endLine.setData([
        { time: endTs as any, value: minPrice },
        { time: endTs as any, value: maxPrice }
      ]);

      chart.timeScale().setVisibleRange({
        from: startTs - (endTs - startTs) * 2 - 1200,
        to: endTs + (endTs - startTs) * 2 + 1200
      } as any);

      const handleResize = () => {
        if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: 720 });
      };
      window.addEventListener('resize', handleResize);
      const currentChart = chart;
      return () => {
        window.removeEventListener('resize', handleResize);
        currentChart.remove();
      };
    } catch (err) {
      console.warn('Library chart failed, switching to SVG fallback', err);
      setRenderMode('svg');
    }
  }, [candles, endDate, startDate]);

  const svgChart = useMemo(() => {
    if (!candles.length) return null;
    const width = Math.max(1600, window.innerWidth - 80);
    const height = Math.min(1000, Math.max(720, window.innerHeight - 180));
    const padding = 60;
    const xs = candles.map((c) => c.time);
    const ys = candles.flatMap((c) => [c.low, c.high]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scaleX = (t: number) =>
      padding + ((t - minX) / Math.max(1, maxX - minX)) * (width - padding * 2);
    const scaleY = (p: number) =>
      height - padding - ((p - minY) / Math.max(1, maxY - minY)) * (height - padding * 2);

    const candleWidth = Math.max(2, (width - padding * 2) / candles.length / 1.5);
    const elements = candles.map((c, idx) => {
      const x = scaleX(c.time);
      const yHigh = scaleY(c.high);
      const yLow = scaleY(c.low);
      const yOpen = scaleY(c.open);
      const yClose = scaleY(c.close);
      const color = c.close >= c.open ? '#16a34a' : '#ef4444';
      return (
        <g key={idx}>
          <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={1} />
          <rect
            x={x - candleWidth / 2}
            y={Math.min(yOpen, yClose)}
            width={candleWidth}
            height={Math.max(1, Math.abs(yClose - yOpen))}
            fill={color}
          />
        </g>
      );
    });
    const yTicks = 4;
    // every 1 hour
    const oneHour = 60 * 60; // seconds
    const xLabels: number[] = [];
    for (let t = minX; t <= maxX + 1; t += oneHour) {
      xLabels.push(t);
      if (xLabels.length > 200) break; // hard cap to avoid runaway
    }
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => minY + ((maxY - minY) * i) / yTicks);
    const xLabelsInfo = xLabels.map((t) => {
      const d = new Date(t * 1000);
      return {
        t,
        time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        showDate: d.getHours() === 0
      };
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[520px] bg-slate-950 rounded-xl">
        {xLabelsInfo.map((label, idx) => (
          <g key={`x-${idx}`}>
            <text
              x={scaleX(label.t)}
              y={height - padding / 4}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="10"
            >
              {label.time}
            </text>
            {label.showDate && (
              <text
                x={scaleX(label.t)}
                y={height - padding / 1.5}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="10"
                transform={`rotate(-90 ${scaleX(label.t)} ${height - padding / 1.5})`}
              >
                {label.date}
              </text>
            )}
          </g>
        ))}
        {yLabels.map((p, idx) => (
          <text
            key={`y-${idx}`}
            x={padding / 3}
            y={scaleY(p)}
            textAnchor="start"
            fill="#94a3b8"
            fontSize="10"
          >
            {p.toFixed(0)}
          </text>
        ))}
        {elements}
      </svg>
    );
  }, [candles]);

  if (!symbol || !startDate || !endDate) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="text-xl font-semibold">Missing chart parameters</div>
          <div className="text-sm text-slate-400">Provide symbol, start, and end in the URL.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-full mx-auto px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm uppercase text-slate-400 tracking-wide">Chart View</div>
            <div className="text-2xl font-bold text-white">{symbol}</div>
            <div className="text-xs text-slate-400">
              {startDate.toLocaleString()} → {endDate.toLocaleString()} ({interval})
            </div>
          </div>
          <a
            href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs px-3 py-2 rounded-full border border-slate-700 hover:border-slate-500 text-slate-200"
          >
            Open in TradingView
          </a>
        </div>
        <div className="bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 p-3">
          {status === 'loading' && <div className="text-sm text-slate-400">Loading candles…</div>}
          {status === 'empty' && (
            <div className="text-sm text-amber-300">
              No candles returned for this window. It may be outside available market data. Try a shorter window or a past trade.
            </div>
          )}
          {status === 'error' && (
            <div className="text-sm text-rose-400">
              Could not load candles for {symbol}. Showing fallback view if available.
            </div>
          )}
          {renderMode === 'library' ? (
            <div ref={containerRef} className="w-full h-[720px] md:h-[880px]" />
          ) : (
            svgChart
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartPage;
