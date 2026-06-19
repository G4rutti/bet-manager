"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Target,
  Clock,
} from "lucide-react";
import type { BankrollWithStats } from "@/types";

export default function DashboardPage() {
  const [bankrolls, setBankrolls] = useState<BankrollWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadBankrolls();
  }, []);

  const loadBankrolls = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: bankrollsData } = await supabase
      .from("bankrolls")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (bankrollsData) {
      const enriched: BankrollWithStats[] = await Promise.all(
        bankrollsData.map(async (bankroll: any) => {
          const { data: bets } = await supabase
            .from("bets")
            .select("stake, profit_loss, state")
            .eq("bankroll_id", bankroll.id);

          const finishedBets = (bets || []).filter((b: any) => b.state !== "pending");
          const pendingBets = (bets || []).filter((b: any) => b.state === "pending");
          const profits = finishedBets.reduce((s: number, b: any) => s + b.profit_loss, 0);
          const stakes = finishedBets.reduce((s: number, b: any) => s + b.stake, 0);
          const pendingStakes = pendingBets.reduce((s: number, b: any) => s + b.stake, 0);
          const roi = stakes > 0 ? (profits / stakes) * 100 : 0;
          const progression = bankroll.starting_capital > 0
            ? ((profits - pendingStakes) / bankroll.starting_capital) * 100
            : 0;

          return {
            ...bankroll,
            roi,
            progression,
            pendingBets: pendingBets.length,
            totalBets: (bets || []).length,
            profits,
          };
        })
      );
      setBankrolls(enriched);
    }
    setLoading(false);
  };

  // Aggregate stats
  const totalProfits = bankrolls.reduce((s, b) => s + b.profits, 0);
  const totalBets = bankrolls.reduce((s, b) => s + b.totalBets, 0);
  const totalPending = bankrolls.reduce((s, b) => s + b.pendingBets, 0);
  const activeBankrolls = bankrolls.filter((b) => b.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão geral das suas apostas
          </p>
        </div>
        <Link href="/bankrolls">
          <Button className="bg-gradient-action text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Novo Bankroll
          </Button>
        </Link>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Total</p>
                <p className={`text-lg font-bold tabular-nums ${totalProfits >= 0 ? "text-success" : "text-danger"}`}>
                  {totalProfits >= 0 ? "+" : ""}R$ {totalProfits.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Apostas</p>
                <p className="text-lg font-bold tabular-nums">{totalBets}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-lg font-bold tabular-nums">{totalPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bankrolls Ativos</p>
                <p className="text-lg font-bold tabular-nums">{activeBankrolls}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bankrolls List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Seus Bankrolls</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="stat-card animate-pulse">
                <CardContent className="p-6">
                  <div className="h-5 bg-muted rounded w-3/4 mb-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-16 bg-muted rounded" />
                    <div className="h-16 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : bankrolls.length === 0 ? (
          <Card className="stat-card">
            <CardContent className="p-8 text-center">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Nenhum bankroll ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie seu primeiro bankroll para começar a rastrear suas apostas
              </p>
              <Link href="/bankrolls">
                <Button className="bg-gradient-action text-white hover:opacity-90">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Bankroll
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bankrolls.map((bankroll) => (
              <Link
                key={bankroll.id}
                href={`/bankrolls/${bankroll.id}`}
              >
                <Card className="stat-card cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {bankroll.name}
                      </CardTitle>
                      <Badge
                        variant={bankroll.status === "active" ? "default" : "secondary"}
                        className={bankroll.status === "active" ? "bg-primary/10 text-primary border-primary/20" : ""}
                      >
                        {bankroll.status === "active" ? "Ativo" : "Arquivado"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface rounded-lg p-3 text-center">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                          ROI
                        </p>
                        <p className={`text-lg font-bold tabular-nums ${bankroll.roi >= 0 ? "text-success" : "text-danger"}`}>
                          {bankroll.roi.toFixed(2)}%
                        </p>
                      </div>
                      <div className="bg-surface rounded-lg p-3 text-center">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                          Progression
                        </p>
                        <p className={`text-lg font-bold tabular-nums ${bankroll.progression >= 0 ? "text-success" : "text-danger"}`}>
                          {bankroll.progression.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    {bankroll.pendingBets > 0 && (
                      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-warning">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{bankroll.pendingBets} apostas pendentes</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}

            {/* Add bankroll card */}
            <Link href="/bankrolls">
              <Card className="stat-card cursor-pointer h-full border-dashed border-2 border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[180px]">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium text-muted-foreground">
                    Adicionar bankroll
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
