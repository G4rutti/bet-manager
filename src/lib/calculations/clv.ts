import { Bet, CLVStats } from "@/types";

/**
 * Calculate Closing Line Value statistics
 * CLV measures how well you beat the closing line (final market odds)
 * Only considers bets that have closing_odds set
 */
export function calculateCLVStats(bets: Bet[]): CLVStats {
  const betsWithCLV = bets.filter(
    (b) => b.closing_odds !== null && b.closing_odds > 0 && b.state !== "pending"
  );

  if (betsWithCLV.length === 0) {
    return {
      clvProfits: 0,
      clvRoi: 0,
      profitGapValue: 0,
      profitGapPercent: 0,
      closingBelow: 0,
      closingAbove: 0,
    };
  }

  // CLV Expected Profits: sum of stake * ((yourOdds / closingOdds) - 1)
  const clvProfits = betsWithCLV.reduce((sum, bet) => {
    const clvEdge = bet.odds / bet.closing_odds! - 1;
    return sum + bet.stake * clvEdge;
  }, 0);

  // Total stakes of CLV bets
  const totalStakes = betsWithCLV.reduce((sum, b) => sum + b.stake, 0);

  // CLV ROI
  const clvRoi = totalStakes > 0 ? (clvProfits / totalStakes) * 100 : 0;

  // Actual profits from CLV bets
  const actualProfits = betsWithCLV.reduce(
    (sum, b) => sum + b.profit_loss,
    0
  );

  // Profit Gap (difference between actual and expected)
  const profitGapValue = actualProfits - clvProfits;
  const profitGapPercent =
    clvProfits !== 0 ? (profitGapValue / Math.abs(clvProfits)) * 100 : 0;

  // Closing Below: you got better odds than closing (positive CLV)
  const closingBelow = betsWithCLV.filter(
    (b) => b.odds > b.closing_odds!
  ).length;

  // Closing Above: closing odds were better (negative CLV)
  const closingAbove = betsWithCLV.filter(
    (b) => b.odds < b.closing_odds!
  ).length;

  return {
    clvProfits,
    clvRoi,
    profitGapValue,
    profitGapPercent,
    closingBelow,
    closingAbove,
  };
}

/**
 * Calculate CLV for a single bet
 */
export function calculateSingleBetCLV(
  odds: number,
  closingOdds: number
): { edge: number; isPositive: boolean } {
  const edge = ((odds / closingOdds) - 1) * 100;
  return {
    edge,
    isPositive: edge > 0,
  };
}
