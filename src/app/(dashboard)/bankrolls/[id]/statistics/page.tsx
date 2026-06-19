"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, HelpCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Bankroll, Bet, BankrollTransaction, BankrollStats, CLVStats } from "@/types";
import { calculateBankrollStats } from "@/lib/calculations/statistics";
import { calculateCLVStats } from "@/lib/calculations/clv";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StatisticsPage({ params }: PageProps) {
  const { id } = use(params);
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [stats, setStats] = useState<BankrollStats | null>(null);
  const [clvStats, setClvStats] = useState<CLVStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadStats();
  }, [id]);

  const loadStats = async () => {
    const { data: bankrollData } = await supabase
      .from("bankrolls")
      .select("*")
      .eq("id", id)
      .single();

    if (bankrollData) setBankroll(bankrollData);

    const { data: betsData } = await supabase
      .from("bets")
      .select("*")
      .eq("bankroll_id", id)
      .order("bet_date");

    const { data: txData } = await supabase
      .from("bankroll_transactions")
      .select("*")
      .eq("bankroll_id", id);

    const bets: Bet[] = betsData || [];
    const transactions: BankrollTransaction[] = txData || [];

    if (bankrollData) {
      const calculated = calculateBankrollStats(
        bets,
        transactions,
        bankrollData.starting_capital
      );
      setStats(calculated);

      const clv = calculateCLVStats(bets);
      setClvStats(clv);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats || !bankroll) {
    return <div className="text-center py-12 text-muted-foreground">Dados não disponíveis</div>;
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/bankrolls/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Estatísticas</h1>
          <p className="text-sm text-muted-foreground">{bankroll.name}</p>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Performance
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatItem label="Bets" value={stats.bets.toString()} />
          <StatItem
            label="Profits"
            value={`${stats.profits >= 0 ? "+" : ""}R$ ${stats.profits.toFixed(2)}`}
            color={stats.profits >= 0 ? "text-success" : "text-danger"}
          />
          <StatItem
            label="ROI"
            value={`${stats.roi.toFixed(2)}%`}
            color={stats.roi >= 0 ? "text-success" : "text-danger"}
            tooltip="Net Profit / Total Stakes × 100"
          />
          <StatItem
            label="Progression"
            value={`${stats.progression.toFixed(2)}%`}
            color={stats.progression >= 0 ? "text-success" : "text-danger"}
            tooltip="Crescimento em relação ao capital inicial"
          />
          <StatItem
            label="TWR"
            value={`${stats.twr.toFixed(2)}%`}
            color={stats.twr >= 0 ? "text-success" : "text-danger"}
            tooltip="Time-Weighted Return: retorno ponderado pelo tempo"
          />
          <StatItem
            label="IRR"
            value={`${stats.irr.toFixed(2)}%`}
            color={stats.irr >= 0 ? "text-success" : "text-danger"}
            tooltip="Internal Rate of Return: taxa anualizada de retorno"
          />
          <StatItem
            label="Success %"
            value={`${stats.successRate.toFixed(1)}%`}
            color={stats.successRate >= 50 ? "text-success" : "text-danger"}
          />
          <StatItem
            label="Drawdown"
            value={`${stats.drawdown.toFixed(2)}%`}
            color="text-danger"
            tooltip="Maior queda do pico ao vale"
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Capital */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Capital
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatItem
            label="Capital Inicial"
            value={`R$ ${stats.startingCapital.toFixed(2)}`}
          />
          <StatItem
            label="Capital Atual"
            value={`R$ ${stats.currentCapital.toFixed(2)}`}
            color={
              stats.currentCapital >= stats.startingCapital
                ? "text-success"
                : "text-danger"
            }
          />
          <StatItem
            label="Depósitos"
            value={`R$ ${stats.deposits.toFixed(2)}`}
          />
          <StatItem
            label="Saques"
            value={`R$ ${stats.withdrawals.toFixed(2)}`}
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Bet Breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Apostas
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatItem
            label="Winning Bets"
            value={stats.winningBets.toString()}
            color="text-success"
          />
          <StatItem
            label="Losing Bets"
            value={stats.losingBets.toString()}
            color="text-danger"
          />
          <StatItem
            label="Refunded"
            value={stats.refundedBets.toString()}
          />
          <StatItem
            label="In Progress"
            value={stats.inProgressBets.toString()}
            color="text-warning"
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Stakes */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Stakes & Odds
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatItem
            label="Played Stakes"
            value={`R$ ${stats.playedStakes.toFixed(2)}`}
          />
          <StatItem
            label="In Progress Stake"
            value={`R$ ${stats.inProgressStake.toFixed(2)}`}
          />
          <StatItem
            label="Average Stake"
            value={`R$ ${stats.averageStake.toFixed(2)}`}
          />
          <StatItem
            label="Max Stake"
            value={`R$ ${stats.maxStake.toFixed(2)}`}
          />
          <StatItem
            label="Average Odds"
            value={stats.averageOdds.toFixed(2)}
          />
          <StatItem
            label="Biggest Odds Won"
            value={stats.biggestOddsWon.toFixed(2)}
            color="text-success"
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Streaks & Records */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Recordes
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatItem
            label="Max Win Streak"
            value={stats.maxWinStreak.toString()}
            color="text-success"
          />
          <StatItem
            label="Max Loss Streak"
            value={stats.maxLossStreak.toString()}
            color="text-danger"
          />
          <StatItem
            label="Biggest Profit"
            value={`+R$ ${stats.biggestProfit.toFixed(2)}`}
            color="text-success"
          />
          <StatItem
            label="Biggest Loss"
            value={`R$ ${stats.biggestLoss.toFixed(2)}`}
            color="text-danger"
          />
          <StatItem
            label="Commissions"
            value={`R$ ${stats.commissions.toFixed(2)}`}
          />
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* CLV Section */}
      {clvStats && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Closing Line Value (CLV)
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Análise baseada nas apostas com closing odds preenchidas
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatItem
              label="CLV Profits"
              value={`${clvStats.clvProfits >= 0 ? "+" : ""}R$ ${clvStats.clvProfits.toFixed(2)}`}
              color={clvStats.clvProfits >= 0 ? "text-success" : "text-danger"}
              tooltip="Lucro esperado com base nas suas odds vs closing odds"
            />
            <StatItem
              label="CLV ROI"
              value={`${clvStats.clvRoi.toFixed(2)}%`}
              color={clvStats.clvRoi >= 0 ? "text-success" : "text-danger"}
            />
            <StatItem
              label="Profit Gap (R$)"
              value={`${clvStats.profitGapValue >= 0 ? "+" : ""}R$ ${clvStats.profitGapValue.toFixed(2)}`}
              color={clvStats.profitGapValue >= 0 ? "text-success" : "text-danger"}
              tooltip="Diferença entre o lucro real e o esperado pelo CLV"
            />
            <StatItem
              label="Profit Gap (%)"
              value={`${clvStats.profitGapPercent.toFixed(1)}%`}
              color={clvStats.profitGapPercent >= 0 ? "text-success" : "text-danger"}
            />
            <StatItem
              label="Closing Below"
              value={clvStats.closingBelow.toString()}
              color="text-success"
              tooltip="Apostas onde você pegou odds maiores que a closing line (bom!)"
            />
            <StatItem
              label="Closing Above"
              value={clvStats.closingAbove.toString()}
              color="text-danger"
              tooltip="Apostas onde a closing line teve odds maiores (ruim)"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({
  label,
  value,
  color = "text-foreground",
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <Card className="stat-card">
      <CardContent className="p-3">
        <div className="flex items-center gap-1 mb-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3 h-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px]">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
