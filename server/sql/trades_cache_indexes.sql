-- Speed up split trade queries (running vs closed, incremental closed sync)
CREATE INDEX IF NOT EXISTS idx_alltraderecords_type
  ON alltraderecords (type);

CREATE INDEX IF NOT EXISTS idx_alltraderecords_closed_created
  ON alltraderecords (created_at DESC NULLS LAST)
  WHERE type IN ('close', 'hedge_close');
