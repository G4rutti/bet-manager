-- ===========================================
-- BetManager Database Schema
-- Supabase (PostgreSQL)
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- BOOKMAKERS
-- ===========================================
CREATE TABLE IF NOT EXISTS bookmakers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  logo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookmakers_user ON bookmakers(user_id);

-- ===========================================
-- BANKROLLS
-- ===========================================
CREATE TABLE IF NOT EXISTS bankrolls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  starting_capital DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bankrolls_user ON bankrolls(user_id);

-- ===========================================
-- CATEGORIES
-- ===========================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#00ffb7'
);

CREATE INDEX idx_categories_user ON categories(user_id);

-- ===========================================
-- COMPETITIONS
-- ===========================================
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'Football'
);

CREATE INDEX idx_competitions_user ON competitions(user_id);

-- ===========================================
-- BET TYPES
-- ===========================================
CREATE TABLE IF NOT EXISTS bet_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL
);

CREATE INDEX idx_bet_types_user ON bet_types(user_id);

-- ===========================================
-- BETS
-- ===========================================
CREATE TABLE IF NOT EXISTS bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  bankroll_id UUID NOT NULL REFERENCES bankrolls(id) ON DELETE CASCADE,
  bookmaker_id UUID REFERENCES bookmakers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
  bet_type_id UUID REFERENCES bet_types(id) ON DELETE SET NULL,
  bet_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  label TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'Football',
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('won', 'lost', 'pending', 'refunded', 'half_won', 'half_lost')),
  bet_format TEXT NOT NULL DEFAULT 'simple' CHECK (bet_format IN ('simple', 'back', 'lay')),
  stake DECIMAL(12,2) NOT NULL DEFAULT 0,
  odds DECIMAL(8,4) NOT NULL DEFAULT 1,
  closing_odds DECIMAL(8,4),
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  profit_loss DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_bankroll ON bets(bankroll_id);
CREATE INDEX idx_bets_date ON bets(bet_date);
CREATE INDEX idx_bets_state ON bets(state);

-- ===========================================
-- SELECTIONS (for combined/accumulator bets)
-- ===========================================
CREATE TABLE IF NOT EXISTS selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bet_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  odds DECIMAL(8,4) NOT NULL DEFAULT 1,
  sport TEXT NOT NULL DEFAULT 'Football',
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('won', 'lost', 'pending', 'refunded'))
);

CREATE INDEX idx_selections_bet ON selections(bet_id);

-- ===========================================
-- BANKROLL TRANSACTIONS (deposits/withdrawals)
-- ===========================================
CREATE TABLE IF NOT EXISTS bankroll_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bankroll_id UUID NOT NULL REFERENCES bankrolls(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount DECIMAL(12,2) NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_bankroll ON bankroll_transactions(bankroll_id);

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================
-- RLS disabled for single-user local deployment
ALTER TABLE bookmakers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bankrolls DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE competitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bet_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE bets DISABLE ROW LEVEL SECURITY;
ALTER TABLE selections DISABLE ROW LEVEL SECURITY;
ALTER TABLE bankroll_transactions DISABLE ROW LEVEL SECURITY;

-- ===========================================
-- TRIGGER: auto-update updated_at on bets
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bets_updated_at
  BEFORE UPDATE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
