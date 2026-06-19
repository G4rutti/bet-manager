-- ===================================================
-- Add stake_source column to bets
-- ===================================================
ALTER TABLE bets 
ADD COLUMN IF NOT EXISTS stake_source TEXT NOT NULL DEFAULT 'free_balance' CHECK (stake_source IN ('free_balance', 'bookmaker'));

-- Update existing bets to free_balance to preserve original bankroll values
UPDATE bets SET stake_source = 'free_balance';
