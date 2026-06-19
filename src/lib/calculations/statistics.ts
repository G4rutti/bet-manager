import { Bet, BankrollStats, BankrollTransaction } from "@/types";

/**
 * Calculate all 27 bankroll statistics from bets and transactions
 */
export function calculateBankrollStats(
  bets: Bet[],
  transactions: BankrollTransaction[],
  startingCapital: number
): BankrollStats {
  const finishedBets = bets.filter(
    (b) => b.state !== "pending"
  );
  const wonBets = bets.filter((b) => b.state === "won");
  const lostBets = bets.filter((b) => b.state === "lost");
  const refundedBets = bets.filter((b) => b.state === "refunded");
  const pendingBets = bets.filter((b) => b.state === "pending");
  const halfWonBets = bets.filter((b) => b.state === "half_won");
  const halfLostBets = bets.filter((b) => b.state === "half_lost");

  // Basic counts
  const totalFinished = finishedBets.length;

  // Profits
  const profits = finishedBets.reduce((sum, b) => sum + b.profit_loss, 0);

  // Stakes
  const playedStakes = finishedBets.reduce((sum, b) => sum + b.stake, 0);
  const inProgressStake = pendingBets.reduce((sum, b) => sum + b.stake, 0);

  // ROI
  const roi = playedStakes > 0 ? (profits / playedStakes) * 100 : 0;

  // Deposits & Withdrawals (exclude internal transfers to avoid inflating totals)
  const isTransfer = (t: BankrollTransaction) =>
    t.notes?.startsWith("Transferência:");
  const deposits = transactions
    .filter((t) => t.type === "deposit" && !isTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0);
  const withdrawals = transactions
    .filter((t) => t.type === "withdrawal" && !isTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0);

  // Current Capital (deducts active stakes in progress)
  const currentCapital = startingCapital + profits + deposits - withdrawals - inProgressStake;

  // Progression
  const progression =
    startingCapital > 0
      ? ((currentCapital - startingCapital) / startingCapital) * 100
      : 0;

  // Success %
  const successRate =
    totalFinished > 0
      ? ((wonBets.length + halfWonBets.length) / totalFinished) * 100
      : 0;

  // Max Win/Loss Streaks
  const { maxWin, maxLoss } = calculateStreaks(finishedBets);

  // Average/Max Stake
  const averageStake =
    totalFinished > 0 ? playedStakes / totalFinished : 0;
  const maxStake =
    finishedBets.length > 0
      ? Math.max(...finishedBets.map((b) => b.stake))
      : 0;

  // Average/Max Odds
  const averageOdds =
    totalFinished > 0
      ? finishedBets.reduce((sum, b) => sum + b.odds, 0) / totalFinished
      : 0;
  const biggestOddsWon =
    wonBets.length > 0 ? Math.max(...wonBets.map((b) => b.odds)) : 0;

  // Biggest Profit/Loss
  const biggestProfit =
    finishedBets.length > 0
      ? Math.max(...finishedBets.map((b) => b.profit_loss))
      : 0;
  const biggestLoss =
    finishedBets.length > 0
      ? Math.min(...finishedBets.map((b) => b.profit_loss))
      : 0;

  // Commissions
  const commissions = finishedBets.reduce(
    (sum, b) => sum + (b.stake * b.commission_pct) / 100,
    0
  );

  // Drawdown
  const drawdown = calculateMaxDrawdown(finishedBets, startingCapital);

  // TWR
  const twr = calculateTWR(finishedBets, transactions, startingCapital);

  // IRR (simplified - monthly)
  const irr = calculateIRR(finishedBets, transactions, startingCapital);

  return {
    bets: totalFinished,
    profits,
    roi,
    progression,
    twr,
    irr,
    successRate,
    drawdown,
    startingCapital,
    currentCapital,
    winningBets: wonBets.length + halfWonBets.length,
    losingBets: lostBets.length + halfLostBets.length,
    refundedBets: refundedBets.length,
    inProgressBets: pendingBets.length,
    playedStakes,
    inProgressStake,
    deposits,
    withdrawals,
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss,
    averageStake,
    maxStake,
    averageOdds,
    biggestOddsWon,
    biggestProfit,
    biggestLoss,
    commissions,
  };
}

/**
 * Calculate max win and loss streaks
 */
function calculateStreaks(bets: Bet[]): {
  maxWin: number;
  maxLoss: number;
} {
  const sorted = [...bets].sort(
    (a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime()
  );

  let maxWin = 0;
  let maxLoss = 0;
  let currentWin = 0;
  let currentLoss = 0;

  for (const bet of sorted) {
    if (bet.state === "won" || bet.state === "half_won") {
      currentWin++;
      currentLoss = 0;
      maxWin = Math.max(maxWin, currentWin);
    } else if (bet.state === "lost" || bet.state === "half_lost") {
      currentLoss++;
      currentWin = 0;
      maxLoss = Math.max(maxLoss, currentLoss);
    } else {
      // refunded - don't break streak
    }
  }

  return { maxWin, maxLoss };
}

/**
 * Calculate Maximum Drawdown as a percentage
 */
function calculateMaxDrawdown(
  bets: Bet[],
  startingCapital: number
): number {
  const sorted = [...bets].sort(
    (a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime()
  );

  let peak = startingCapital;
  let balance = startingCapital;
  let maxDrawdown = 0;

  for (const bet of sorted) {
    balance += bet.profit_loss;
    if (balance > peak) {
      peak = balance;
    }
    const drawdown = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return maxDrawdown;
}

/**
 * Calculate Time-Weighted Return (TWR)
 * Breaks timeline into sub-periods based on deposits/withdrawals
 */
function calculateTWR(
  bets: Bet[],
  transactions: BankrollTransaction[],
  startingCapital: number
): number {
  if (bets.length === 0) return 0;

  // Simplified TWR: group by month
  const sorted = [...bets].sort(
    (a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime()
  );

  const monthlyReturns: Map<string, { start: number; profit: number }> =
    new Map();
  let runningBalance = startingCapital;

  for (const bet of sorted) {
    const monthKey = bet.bet_date.substring(0, 7); // YYYY-MM
    if (!monthlyReturns.has(monthKey)) {
      monthlyReturns.set(monthKey, { start: runningBalance, profit: 0 });
    }
    const month = monthlyReturns.get(monthKey)!;
    month.profit += bet.profit_loss;
    runningBalance += bet.profit_loss;
  }

  let twr = 1;
  for (const [, data] of monthlyReturns) {
    if (data.start > 0) {
      twr *= 1 + data.profit / data.start;
    }
  }

  return (twr - 1) * 100;
}

/**
 * Calculate Internal Rate of Return (simplified)
 * Uses Newton-Raphson method
 */
function calculateIRR(
  bets: Bet[],
  transactions: BankrollTransaction[],
  startingCapital: number
): number {
  if (bets.length === 0) return 0;

  const sorted = [...bets].sort(
    (a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime()
  );

  const firstDate = new Date(sorted[0].bet_date);
  const lastDate = new Date(sorted[sorted.length - 1].bet_date);
  const daysDiff =
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 0) return 0;

  // Build cash flow array
  const cashFlows: { amount: number; days: number }[] = [];

  // Initial investment (negative)
  cashFlows.push({ amount: -startingCapital, days: 0 });

  // Deposits (negative - money in), excluding internal transfers
  const externalTx = transactions.filter((t) => !t.notes?.startsWith("Transferência:"));
  for (const t of externalTx) {
    const tDate = new Date(t.transaction_date);
    const days =
      (tDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    if (t.type === "deposit") {
      cashFlows.push({ amount: -t.amount, days });
    } else {
      cashFlows.push({ amount: t.amount, days });
    }
  }

  // Final value (positive)
  const finalValue =
    startingCapital +
    sorted.reduce((sum, b) => sum + b.profit_loss, 0) +
    externalTx
      .filter((t) => t.type === "deposit")
      .reduce((sum, t) => sum + t.amount, 0) -
    externalTx
      .filter((t) => t.type === "withdrawal")
      .reduce((sum, t) => sum + t.amount, 0);

  cashFlows.push({ amount: finalValue, days: daysDiff });

  // Newton-Raphson to find daily rate
  let rate = 0.001; // Initial guess
  for (let i = 0; i < 100; i++) {
    let npv = 0;
    let dnpv = 0;
    for (const cf of cashFlows) {
      const factor = Math.pow(1 + rate, cf.days / 365);
      npv += cf.amount / factor;
      dnpv -= (cf.days / 365) * cf.amount / (factor * (1 + rate));
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-10) break;
    rate = newRate;
  }

  return rate * 100; // Annualized percentage
}

/**
 * Calculate profit over time for chart data
 */
export function calculateProfitTimeline(
  bets: Bet[]
): { date: string; profit: number; cumulativeProfit: number }[] {
  const sorted = [...bets]
    .filter((b) => b.state !== "pending")
    .sort(
      (a, b) =>
        new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime()
    );

  let cumulative = 0;
  const timeline: {
    date: string;
    profit: number;
    cumulativeProfit: number;
  }[] = [];

  // Group by date
  const grouped = new Map<string, number>();
  for (const bet of sorted) {
    const dateKey = bet.bet_date.substring(0, 10);
    grouped.set(dateKey, (grouped.get(dateKey) || 0) + bet.profit_loss);
  }

  for (const [date, profit] of grouped) {
    cumulative += profit;
    timeline.push({ date, profit, cumulativeProfit: cumulative });
  }

  return timeline;
}
