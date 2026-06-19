-- ===================================================
-- Add bookmaker_id column to bankroll_transactions
-- ===================================================
ALTER TABLE bankroll_transactions 
ADD COLUMN IF NOT EXISTS bookmaker_id UUID REFERENCES bookmakers(id) ON DELETE SET NULL;

-- Create an index to optimize transaction lookups by bookmaker
CREATE INDEX IF NOT EXISTS idx_transactions_bookmaker ON bankroll_transactions(bookmaker_id);
