"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Minus,
  BarChart3,
  CalendarDays,
  ListOrdered,
  ArrowLeft,
  ChevronRight,
  HelpCircle,
  History,
  FileSpreadsheet,
  Loader2,
  Archive,
  ArchiveRestore,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Bankroll, Bet, Bookmaker } from "@/types";
import { ProfitChart } from "@/components/charts/ProfitChart";
import { calculateProfitTimeline } from "@/lib/calculations/statistics";
import { BetFormDialog } from "@/components/forms/BetFormDialog";
import { TransactionFormDialog } from "@/components/forms/TransactionFormDialog";
import { exportBankrollToExcel } from "@/lib/export/bankrollExcel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BankrollDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allBookmakers, setAllBookmakers] = useState<Bookmaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txType, setTxType] = useState<"deposit" | "withdrawal" | "transfer">("deposit");
  const [txBookmakerId, setTxBookmakerId] = useState<string>("none");
  const [timeRange, setTimeRange] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const supabase = createClient();

  const isArchived = bankroll?.status === "archived";

  const handleToggleArchive = async () => {
    if (!bankroll) return;
    setArchiving(true);
    const newStatus = isArchived ? "active" : "archived";
    const { error } = await supabase
      .from("bankrolls")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status do bankroll");
    } else {
      toast.success(
        newStatus === "archived" ? "Bankroll arquivado!" : "Bankroll reativado!"
      );
      setBankroll({ ...bankroll, status: newStatus });
    }
    setArchiving(false);
    setArchiveDialogOpen(false);
  };

  const handleExportExcel = async () => {
    if (!bankroll) return;
    setExporting(true);
    try {
      exportBankrollToExcel(bankroll, bets, transactions, allBookmakers);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    const { data: bankrollData } = await supabase
      .from("bankrolls")
      .select("*")
      .eq("id", id)
      .single();

    if (bankrollData) setBankroll(bankrollData);

    const { data: betsData } = await supabase
      .from("bets")
      .select("*, bookmaker:bookmakers(*)")
      .eq("bankroll_id", id)
      .order("bet_date", { ascending: true });

    if (betsData) setBets(betsData);

    const { data: txData } = await supabase
      .from("bankroll_transactions")
      .select("*")
      .eq("bankroll_id", id);

    if (txData) setTransactions(txData);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: bmData } = await supabase
        .from("bookmakers")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (bmData) setAllBookmakers(bmData);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-64 bg-muted rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-muted rounded-xl animate-pulse" />
          <div className="h-24 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!bankroll) {
    return <div className="text-center py-12 text-muted-foreground">Bankroll não encontrado</div>;
  }

  const finishedBets = bets.filter((b) => b.state !== "pending");
  const pendingBets = bets.filter((b) => b.state === "pending");
  const profits = finishedBets.reduce((s, b) => s + b.profit_loss, 0);
  const stakes = finishedBets.reduce((s, b) => s + b.stake, 0);
  const pendingStakes = pendingBets.reduce((s, b) => s + b.stake, 0);
  const roi = stakes > 0 ? (profits / stakes) * 100 : 0;

  // Helper: check if a transaction is an internal transfer
  const isTransfer = (t: { notes: string | null }) =>
    t.notes?.startsWith("Transferência:");

  // --- External-only deposits/withdrawals (excluding internal transfers) ---
  const externalDeposits = transactions
    .filter((t) => t.type === "deposit" && !isTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0);
  const externalWithdrawals = transactions
    .filter((t) => t.type === "withdrawal" && !isTransfer(t))
    .reduce((sum, t) => sum + t.amount, 0);

  // --- Capital distribution model ---
  // Stakes funded from free balance (default to free_balance for existing bets)
  const freeStakes = bets
    .filter((b) => b.stake_source === "free_balance" || !b.stake_source)
    .reduce((sum, b) => sum + b.stake, 0);

  // Transactions touching the free balance (bookmaker_id = null)
  const freeDeposits = transactions
    .filter((t) => t.type === "deposit" && !t.bookmaker_id)
    .reduce((sum, t) => sum + t.amount, 0);
  const freeWithdrawals = transactions
    .filter((t) => t.type === "withdrawal" && !t.bookmaker_id)
    .reduce((sum, t) => sum + t.amount, 0);

  // Banca livre = capital inicial + depósitos ao saldo livre - saques do saldo livre - todas as stakes tiradas do saldo livre
  const bancaLivre = Math.max(
    0,
    bankroll.starting_capital + freeDeposits - freeWithdrawals - freeStakes
  );

  // Payout de uma aposta resolvida (dinheiro que volta pra casa)
  const getBetPayout = (bet: Bet) => {
    if (bet.state === "pending") return 0;
    if (bet.state === "won" || bet.state === "half_won" || bet.state === "half_lost") {
      return bet.stake + bet.profit_loss; // stake de volta + lucro
    }
    if (bet.state === "refunded") return bet.stake;
    return 0; // lost: nada volta
  };

  // Per-bookmaker distribution
  const distribution = allBookmakers.map((bm) => {
    const bmBets = bets.filter((b) => b.bookmaker_id === bm.id);
    const bmFinishedBets = bmBets.filter((b) => b.state !== "pending");
    const bmPendingBets = bmBets.filter((b) => b.state === "pending");

    // Payouts das apostas resolvidas nesta casa (independentemente de onde veio a stake, o dinheiro volta pra casa de apostas)
    const bmPayouts = bmFinishedBets.reduce((sum, b) => sum + getBetPayout(b), 0);
    // Retido = stakes das pendentes
    const bmPendingStakes = bmPendingBets.reduce((sum, b) => sum + b.stake, 0);

    // Transações vinculadas a esta casa (depósitos/saques/transferências)
    const bmTxDeposits = transactions
      .filter((t) => t.type === "deposit" && t.bookmaker_id === bm.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const bmTxWithdrawals = transactions
      .filter((t) => t.type === "withdrawal" && t.bookmaker_id === bm.id)
      .reduce((sum, t) => sum + t.amount, 0);

    // Stakes que saíram do saldo da própria casa
    const bmStakesFromBm = bmBets
      .filter((b) => b.stake_source === "bookmaker")
      .reduce((sum, b) => sum + b.stake, 0);

    // Saldo disponível na casa = payouts + depósitos pra casa - saques da casa - stakes tiradas do saldo da casa
    const bmBalance = bmTxDeposits - bmTxWithdrawals + bmPayouts - bmStakesFromBm;

    return {
      bookmaker: bm,
      balance: bmBalance,            // saldo real disponível na casa
      pendingStakes: bmPendingStakes, // retido em apostas ativas
    };
  }).filter(item => item.balance > 0 || item.pendingStakes > 0);

  // Total dos saldos de todas as casas
  const totalBmBalance = distribution.reduce((sum, item) => sum + item.balance, 0);

  // Total disponível = banca livre + saldos de todas as casas
  const totalDisponivel = bancaLivre + totalBmBalance;

  // --- Stats card values (external-only deposits/withdrawals for accurate metrics) ---
  const currentCapital = bankroll.starting_capital + profits + externalDeposits - externalWithdrawals - pendingStakes;
  const progression = bankroll.starting_capital > 0
    ? ((currentCapital - bankroll.starting_capital) / bankroll.starting_capital) * 100
    : 0;

  const timeline = calculateProfitTimeline(bets);

  // Filter timeline by range
  const filteredTimeline = (() => {
    if (timeRange === "all") return timeline;
    const now = new Date();
    let cutoff = new Date();
    switch (timeRange) {
      case "1d": cutoff.setDate(now.getDate() - 1); break;
      case "1w": cutoff.setDate(now.getDate() - 7); break;
      case "1m": cutoff.setMonth(now.getMonth() - 1); break;
      case "1y": cutoff.setFullYear(now.getFullYear() - 1); break;
    }
    return timeline.filter((t) => new Date(t.date) >= cutoff);
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bankrolls">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{bankroll.name}</h1>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-border/80 bg-card hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400 transition-all h-9 px-3 text-xs font-medium"
            onClick={handleExportExcel}
            disabled={exporting}
            title="Exportar dados do bankroll como Excel"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{exporting ? "Exportando..." : "Exportar Excel"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className={`flex items-center gap-2 h-9 px-3 text-xs font-medium transition-all ${
              isArchived
                ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
                : "border-border/80 bg-card hover:bg-warning/10 hover:border-warning/40 hover:text-warning"
            }`}
            onClick={() => setArchiveDialogOpen(true)}
            title={isArchived ? "Reativar bankroll" : "Arquivar bankroll"}
          >
            {isArchived ? (
              <ArchiveRestore className="w-4 h-4" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{isArchived ? "Reativar" : "Arquivar"}</span>
          </Button>
        </div>
      </div>

      {/* Archived Banner */}
      {isArchived && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/25 text-warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Bankroll arquivado</p>
            <p className="text-xs text-warning/80">Este bankroll está encerrado. Novos registros de apostas e transações estão bloqueados.</p>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isArchived ? (
                <><ArchiveRestore className="w-5 h-5 text-success" /> Reativar Bankroll</>
              ) : (
                <><Archive className="w-5 h-5 text-warning" /> Arquivar Bankroll</>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {isArchived
                ? "O bankroll voltará a aceitar novas apostas e transações."
                : "O bankroll ficará somente leitura. Você poderá consultar o histórico, mas não poderá registrar novas apostas ou movimentar valores."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={archiving}
            >
              Cancelar
            </Button>
            <Button
              className={`flex-1 ${
                isArchived
                  ? "bg-success/20 text-success border border-success/30 hover:bg-success/30"
                  : "bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30"
              }`}
              onClick={handleToggleArchive}
              disabled={archiving}
            >
              {archiving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : isArchived ? (
                <ArchiveRestore className="w-4 h-4 mr-2" />
              ) : (
                <Archive className="w-4 h-4 mr-2" />
              )}
              {archiving ? "Aguarde..." : isArchived ? "Reativar" : "Arquivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chart */}
      <div className="bg-gradient-green rounded-2xl p-4 relative overflow-hidden">
        <div className="h-[250px]">
          <ProfitChart data={filteredTimeline} />
        </div>
        <div className="flex items-center gap-2 mt-3">
          {["1d", "1w", "1m", "1y", "all"].map((range) => (
            <Button
              key={range}
              variant="ghost"
              size="sm"
              className={`text-white/80 hover:text-white hover:bg-white/20 text-xs px-3 h-7 rounded-full ${
                timeRange === range ? "bg-white/20 text-white" : ""
              }`}
              onClick={() => setTimeRange(range)}
            >
              {range === "all" ? "Tudo" : range}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href={`/bankrolls/${id}/statistics`}>
          <Button
            variant="outline"
            className="w-full border-border bg-card hover:bg-surface-hover h-12"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Estatísticas
          </Button>
        </Link>
        <Link href={`/bankrolls/${id}/bets`}>
          <Button
            variant="outline"
            className="w-full border-border bg-card hover:bg-surface-hover h-12"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Apostas
          </Button>
        </Link>
        <Link href={`/bankrolls/${id}/transactions`}>
          <Button
            variant="outline"
            className="w-full border-border bg-card hover:bg-surface-hover h-12"
          >
            <History className="w-4 h-4 mr-2" />
            Transações
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="SALDO DA BANCA"
          value={`R$ ${currentCapital.toFixed(2)}`}
          color={currentCapital >= bankroll.starting_capital ? "text-success" : "text-danger"}
          tooltip="Capital Inicial + Lucros + Depósitos - Saques - Apostas Pendentes"
        />
        <StatCard label="BETS" value={finishedBets.length.toString()} />
        <StatCard
          label="PROFITS"
          value={`${profits >= 0 ? "+" : ""}R$ ${profits.toFixed(2)}`}
          color={profits >= 0 ? "text-success" : "text-danger"}
        />
        <StatCard
          label="ROI"
          value={`${roi.toFixed(2)}%`}
          color={roi >= 0 ? "text-success" : "text-danger"}
          tooltip="Return on Investment: Lucro / Total apostado"
        />
        <StatCard
          label="PROGRESSION"
          value={`${progression.toFixed(2)}%`}
          color={progression >= 0 ? "text-success" : "text-danger"}
          tooltip="Crescimento em relação ao capital inicial"
        />
      </div>

      {/* Capital Distribution Card */}
      <Card className="stat-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Distribuição de Capital</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Onde está o seu dinheiro
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-dashed border-primary/30 hover:border-primary/50 text-xs gap-1.5 h-8 disabled:opacity-40"
              onClick={() => {
                setTxType("deposit");
                setTxBookmakerId("none");
                setTxDialogOpen(true);
              }}
              disabled={isArchived}
              title={isArchived ? "Bankroll arquivado — sem movimentações" : undefined}
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Transação
            </Button>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="col-span-2 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Total Disponível</p>
                <p className={`text-lg font-bold tabular-nums ${totalDisponivel >= 0 ? "text-success" : "text-danger"}`}>
                  R$ {totalDisponivel.toFixed(2)}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">Banca Livre + Saldos nas Casas</span>
                  {pendingStakes > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
                      R$ {pendingStakes.toFixed(2)} retido
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Banca livre row - never-bet money */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface/50 border border-border/40 hover:border-primary/10 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">
                  💼
                </div>
                <div>
                  <p className="text-sm font-medium">Banca Livre</p>
                  <p className="text-[11px] text-muted-foreground">Capital nunca apostado</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-sm font-bold font-mono ${bancaLivre > 0 ? "text-success" : "text-muted-foreground"}`}>
                    R$ {bancaLivre.toFixed(2)}
                  </p>
                </div>
                {!isArchived && (
                  <div className="flex items-center gap-1 border-l border-border/30 pl-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-success/15 hover:text-success text-muted-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTxType("deposit");
                        setTxBookmakerId("none");
                        setTxDialogOpen(true);
                      }}
                      title="Depositar saldo livre"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg hover:bg-danger/15 hover:text-danger text-muted-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTxType("withdrawal");
                        setTxBookmakerId("none");
                        setTxDialogOpen(true);
                      }}
                      title="Sacar saldo livre"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Bookmaker rows */}
            {distribution.map((item) => (
              <div
                key={item.bookmaker.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface/50 border border-border/40 hover:border-primary/10 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-sm font-semibold border border-border/30">
                    🏦
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.bookmaker.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {item.balance > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                          R$ {item.balance.toFixed(2)} disponível
                        </span>
                      )}
                      {item.pendingStakes > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
                          R$ {item.pendingStakes.toFixed(2)} retido
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-sm font-bold font-mono ${item.balance > 0 ? "text-success" : "text-muted-foreground"}`}>
                      R$ {item.balance.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">disponível</p>
                  </div>
                  {!isArchived && (
                    <div className="flex items-center gap-1 border-l border-border/30 pl-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-success/15 hover:text-success text-muted-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTxType("deposit");
                          setTxBookmakerId(item.bookmaker.id);
                          setTxDialogOpen(true);
                        }}
                        title={`Depositar dinheiro na ${item.bookmaker.name}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-danger/15 hover:text-danger text-muted-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTxType("withdrawal");
                          setTxBookmakerId(item.bookmaker.id);
                          setTxDialogOpen(true);
                        }}
                        title={`Sacar dinheiro da ${item.bookmaker.name}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {distribution.length === 0 && (
              <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                Nenhum dinheiro alocado em casas de apostas.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Bet FAB */}
      <BetFormDialog
        bankrollId={id}
        open={betDialogOpen}
        onOpenChange={setBetDialogOpen}
        onSaved={loadData}
      />

      <TransactionFormDialog
        bankrollId={id}
        open={txDialogOpen}
        onOpenChange={setTxDialogOpen}
        onSaved={loadData}
        bookmakers={allBookmakers}
        initialType={txType}
        initialBookmakerId={txBookmakerId}
      />

      {!isArchived && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:bottom-8 z-50">
          <Button
            size="lg"
            className="rounded-full w-14 h-14 bg-gradient-action text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all"
            onClick={() => setBetDialogOpen(true)}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
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
      <CardContent className="p-4 text-center">
        <div className="flex items-center justify-center gap-1 mb-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-3 h-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
