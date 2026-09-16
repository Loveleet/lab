export type MetricHelpExampleStep = {
  label: string;
  detail: string;
  value?: string;
  accent?: 'emerald' | 'rose' | 'sky' | 'amber';
};

export type MetricHelpContent = {
  title: string;
  description: string;
  formula?: string;
  example: {
    intro: string;
    steps: MetricHelpExampleStep[];
    result: string;
  };
};

export const METRIC_HELP: Record<string, MetricHelpContent> = {
  trades: {
    title: 'Trades',
    description:
      'How many trades are in this group. Opening groups by start time. Closing groups by end time. Only closed trades that match your filters are counted.',
    example: {
      intro: 'You have 3 trades in this period:',
      steps: [
        { label: 'Trade 1', detail: 'BTCUSDT', value: '+40' },
        { label: 'Trade 2', detail: 'ETHUSDT', value: '-15' },
        { label: 'Trade 3', detail: 'SOLUSDT', value: '+25' }
      ],
      result: 'Trades = 3'
    }
  },
  avgTradesPerActiveDay: {
    title: 'Avg trades/day',
    description: 'On average, how many trades you took on each day that had at least one trade.',
    formula: 'Total trades ÷ days with trades',
    example: {
      intro: 'In March you traded on 3 days only:',
      steps: [
        { label: 'Mar 1', detail: '4 trades', value: '4' },
        { label: 'Mar 2', detail: '6 trades', value: '6' },
        { label: 'Mar 3', detail: '2 trades', value: '2' }
      ],
      result: 'Average = (4 + 6 + 2) ÷ 3 = 4 trades per day'
    }
  },
  buysSells: {
    title: 'Buys / Sells',
    description: 'Top line: how many BUY trades and how many SELL trades. Bottom line: total profit/loss from buys and from sells.',
    example: {
      intro: 'Example:',
      steps: [
        { label: 'Buys', detail: '120 trades', value: 'P/L +800', accent: 'emerald' },
        { label: 'Sells', detail: '80 trades', value: 'P/L +200', accent: 'emerald' }
      ],
      result: 'Shows: 120 / 80  and  800.00 / 200.00'
    }
  },
  profitLossCount: {
    title: 'Profit / Loss count',
    description: 'How many trades made money vs lost money. Trades with zero P/L are not counted in either number.',
    example: {
      intro: '5 trades:',
      steps: [
        { label: '+10', detail: 'made money', value: '✓', accent: 'emerald' },
        { label: '+5', detail: 'made money', value: '✓', accent: 'emerald' },
        { label: '-3', detail: 'lost money', value: '✓', accent: 'rose' },
        { label: '0', detail: 'no gain, no loss', value: '—' },
        { label: '-7', detail: 'lost money', value: '✓', accent: 'rose' }
      ],
      result: 'Profit count = 2  |  Loss count = 2'
    }
  },
  netPnl: {
    title: 'Net P/L',
    description: 'Total profit or loss when you add up every trade in this card. Green = you made money. Red = you lost money.',
    formula: 'Add up P/L of all trades',
    example: {
      intro: 'Add each trade result:',
      steps: [
        { label: 'Trade 1', detail: '', value: '+120', accent: 'emerald' },
        { label: 'Trade 2', detail: '', value: '-40', accent: 'rose' },
        { label: 'Trade 3', detail: '', value: '+60', accent: 'emerald' }
      ],
      result: 'Net P/L = 120 − 40 + 60 = +140'
    }
  },
  plSoFar: {
    title: 'P/L so far',
    description:
      'Your running total up to this point. Month cards add from January. Day cards add from the 1st of the month. Hour cards add from 00:00 of that day.',
    example: {
      intro: 'Two days in the same month:',
      steps: [
        { label: 'Day 1', detail: 'P/L this day', value: '+269', accent: 'emerald' },
        { label: 'Day 2', detail: 'P/L this day', value: '−100', accent: 'rose' }
      ],
      result: 'Day 1 so far = 269  |  Day 2 so far = 269 − 100 = 169'
    }
  },
  plAvg: {
    title: 'P/L avg',
    description: 'On average, how much each trade made or lost.',
    formula: 'Net P/L ÷ number of trades',
    example: {
      intro: '500 trades, total P/L is 1000:',
      steps: [
        { label: 'Total P/L', detail: 'all trades added', value: '1000', accent: 'emerald' },
        { label: 'Trades', detail: 'how many', value: '500', accent: 'sky' }
      ],
      result: 'P/L avg = 1000 ÷ 500 = 2.00 per trade'
    }
  },
  profitLossAmount: {
    title: 'Profit / Loss amount',
    description: 'Left number: total money from winning trades. Right number: total money lost from losing trades (shown as negative).',
    example: {
      intro: 'Winners and losers:',
      steps: [
        { label: 'Winners', detail: '+50, +30, +20', value: '+100', accent: 'emerald' },
        { label: 'Losers', detail: '−10, −25', value: '−35', accent: 'rose' }
      ],
      result: 'Shows: 100.00 / −35.00'
    }
  },
  winRate: {
    title: 'Win rate',
    description: 'How much of your total profit+loss came from winning trades. Higher % means winners gave you more of the total dollars.',
    formula: 'Total profit ÷ (Total profit + total loss) × 100',
    example: {
      intro: 'You made $300 from winners and lost $200 from losers:',
      steps: [
        { label: 'Total profit', detail: 'from winning trades', value: '300', accent: 'emerald' },
        { label: 'Total loss', detail: 'from losing trades', value: '200', accent: 'rose' }
      ],
      result: 'Win rate = 300 ÷ (300 + 200) × 100 = 60%'
    }
  },
  avgDur: {
    title: 'Avg duration',
    description: 'On average, how long each trade stayed open (from open time to close time).',
    formula: 'Total time of all trades ÷ number of trades',
    example: {
      intro: '3 trades and how long each stayed open:',
      steps: [
        { label: 'Trade A', detail: '1 hour', value: '60m' },
        { label: 'Trade B', detail: '2 hours', value: '120m' },
        { label: 'Trade C', detail: '30 minutes', value: '30m' }
      ],
      result: 'Average = (60 + 120 + 30) ÷ 3 = 70 minutes (1h 10m)'
    }
  },
  runningPeak: {
    title: 'Running (peak)',
    description: 'The most trades that were open at the same time during this hour. Counts trades that opened earlier but were still running.',
    example: {
      intro: 'Between 2:00 PM and 3:00 PM on one day:',
      steps: [
        { label: '2:05 PM', detail: '2 trades open', value: '2', accent: 'sky' },
        { label: '2:20 PM', detail: '5 trades open', value: '5', accent: 'amber' },
        { label: '2:50 PM', detail: '3 trades open', value: '3', accent: 'sky' }
      ],
      result: 'Running (peak) = 5 (the highest point)'
    }
  },
  avgOpenNested: {
    title: 'Avg open (nested)',
    description:
      'Average number of trades running at the same time, calculated step by step. Day = average for that day. Month = average of each day’s average. Year = average of each month’s average.',
    example: {
      intro: 'March — average open trades per day:',
      steps: [
        { label: 'Mar 1', detail: 'avg open that day', value: '2.0', accent: 'sky' },
        { label: 'Mar 2', detail: 'avg open that day', value: '4.0', accent: 'sky' },
        { label: 'Mar 3', detail: 'avg open that day', value: '3.0', accent: 'sky' }
      ],
      result: 'March average = (2 + 4 + 3) ÷ 3 = 3.0'
    }
  },
  maxOpen: {
    title: 'Max open',
    description: 'The highest number of trades that were open at the same time in this whole period (year, month, or day).',
    example: {
      intro: 'During the day:',
      steps: [
        { label: '10:00 AM', detail: '3 open', value: '3' },
        { label: '11:30 AM', detail: '8 open', value: '8', accent: 'amber' },
        { label: '12:00 PM', detail: '5 open', value: '5' }
      ],
      result: 'Max open = 8'
    }
  },
  runningAvgPeak: {
    title: 'Running (avg peak)',
    description:
      'For this weekday and hour (e.g. all Mondays at 9 AM): find the busiest moment in that hour on each day, then take the average of those peaks.',
    example: {
      intro: 'Every Monday at 9:00 AM:',
      steps: [
        { label: 'Mon Jan 6', detail: 'busiest moment in that hour', value: '4', accent: 'sky' },
        { label: 'Mon Jan 13', detail: 'busiest moment in that hour', value: '6', accent: 'sky' },
        { label: 'Mon Jan 20', detail: 'busiest moment in that hour', value: '5', accent: 'sky' }
      ],
      result: 'Average = (4 + 6 + 5) ÷ 3 = 5.0'
    }
  }
};

export function getMetricHelp(id: string): MetricHelpContent | undefined {
  return METRIC_HELP[id];
}
