// ============================================
// Database Types (match Supabase schema)
// ============================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface Bookmaker {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  active: boolean;
  created_at: string;
}

export interface Bankroll {
  id: string;
  user_id: string;
  name: string;
  starting_capital: number;
  status: "active" | "archived";
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export interface Competition {
  id: string;
  user_id: string;
  name: string;
  sport: string;
}

export interface BetType {
  id: string;
  user_id: string;
  name: string;
}

export type BetState =
  | "won"
  | "lost"
  | "pending"
  | "refunded"
  | "half_won"
  | "half_lost";

export type BetFormat = "simple" | "back" | "lay";

export interface Bet {
  id: string;
  user_id: string;
  bankroll_id: string;
  bookmaker_id: string | null;
  category_id: string | null;
  competition_id: string | null;
  bet_type_id: string | null;
  bet_date: string;
  label: string;
  sport: string;
  state: BetState;
  bet_format: BetFormat;
  stake: number;
  odds: number;
  closing_odds: number | null;
  commission_pct: number;
  profit_loss: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stake_source: "free_balance" | "bookmaker";
  // Joined data
  bookmaker?: Bookmaker;
  category?: Category;
  competition?: Competition;
  bet_type?: BetType;
  selections?: Selection[];
}

export interface Selection {
  id: string;
  bet_id: string;
  label: string;
  odds: number;
  sport: string;
  state: BetState;
}

export interface BankrollTransaction {
  id: string;
  bankroll_id: string;
  bookmaker_id: string | null;
  type: "deposit" | "withdrawal";
  amount: number;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

// ============================================
// Statistics Types
// ============================================

export interface BankrollStats {
  bets: number;
  profits: number;
  roi: number;
  progression: number;
  twr: number;
  irr: number;
  successRate: number;
  drawdown: number;
  startingCapital: number;
  currentCapital: number;
  winningBets: number;
  losingBets: number;
  refundedBets: number;
  inProgressBets: number;
  playedStakes: number;
  inProgressStake: number;
  deposits: number;
  withdrawals: number;
  maxWinStreak: number;
  maxLossStreak: number;
  averageStake: number;
  maxStake: number;
  averageOdds: number;
  biggestOddsWon: number;
  biggestProfit: number;
  biggestLoss: number;
  commissions: number;
}

export interface CLVStats {
  clvProfits: number;
  clvRoi: number;
  profitGapValue: number;
  profitGapPercent: number;
  closingBelow: number;
  closingAbove: number;
}

// ============================================
// Form Types
// ============================================

export interface BetFormData {
  bet_date: string;
  bet_time: string;
  bookmaker_id: string;
  label: string;
  sport: string;
  state: BetState;
  bet_format: BetFormat;
  stake: number;
  odds: number;
  closing_odds?: number;
  commission_pct: number;
  category_id?: string;
  competition_id?: string;
  bet_type_id?: string;
  notes?: string;
  selections: SelectionFormData[];
}

export interface SelectionFormData {
  label: string;
  odds: number;
  sport: string;
  state: BetState;
}

export interface BankrollFormData {
  name: string;
  starting_capital: number;
  start_date: string;
  end_date?: string;
}

export interface BookmakerFormData {
  name: string;
  logo_url?: string;
}

// ============================================
// Chart Types
// ============================================

export interface ProfitDataPoint {
  date: string;
  profit: number;
  cumulativeProfit: number;
}

// ============================================
// Bankroll with computed stats (for list view)
// ============================================

export interface BankrollWithStats extends Bankroll {
  roi: number;
  progression: number;
  pendingBets: number;
  totalBets: number;
  profits: number;
}
