"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Search, SlidersHorizontal, Trash2, X, History, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Bookmaker, BankrollTransaction } from "@/types";

// Date formatting helpers
const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function formatMonthYear(d: Date) {
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatWeekdayDay(d: Date) {
  return `${weekdays[d.getDay()]} ${d.getDate()}`;
}

function parseDate(s: string) {
  // Handles YYYY-MM-DD correctly without timezones shifting the day
  const parts = s.split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return new Date(s);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

interface GroupedTransactions {
  [month: string]: {
    totalDeposit: number;
    totalWithdrawal: number;
    days: {
      [day: string]: BankrollTransaction[];
    };
  };
}

export default function TransactionsListPage({ params }: PageProps) {
  const { id } = use(params);
  const [transactions, setTransactions] = useState<BankrollTransaction[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBookmaker, setFilterBookmaker] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    // 1. Fetch transactions
    const { data: txData } = await supabase
      .from("bankroll_transactions")
      .select("*")
      .eq("bankroll_id", id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (txData) setTransactions(txData);

    // 2. Fetch bookmakers
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: bmData } = await supabase
        .from("bookmakers")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (bmData) setBookmakers(bmData);
    }
    setLoading(false);
  };

  const getBookmakerName = (bmId: string | null) => {
    if (!bmId) return "Saldo Livre";
    const bm = bookmakers.find((b) => b.id === bmId);
    return bm ? bm.name : "Casa Desconhecida";
  };

  const isTransfer = (t: BankrollTransaction) => {
    return t.notes?.startsWith("Transferência:") || false;
  };

  const handleDeleteClick = (txId: string) => {
    setDeletingId(txId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setDeleting(true);

    const txToDelete = transactions.find(t => t.id === deletingId);
    if (!txToDelete) return;

    // Check if we should delete both sides of a transfer
    // If it's a transfer and we find another transaction with same notes & date
    let idsToDelete = [deletingId];
    if (isTransfer(txToDelete)) {
      const partnerTx = transactions.find(
        (t) =>
          t.id !== deletingId &&
          t.notes === txToDelete.notes &&
          t.transaction_date === txToDelete.transaction_date &&
          t.amount === txToDelete.amount
      );
      if (partnerTx) {
        idsToDelete.push(partnerTx.id);
      }
    }

    const { error } = await supabase
      .from("bankroll_transactions")
      .delete()
      .in("id", idsToDelete);

    if (error) {
      toast.error("Erro ao excluir transação", { description: error.message });
    } else {
      toast.success(idsToDelete.length > 1 ? "Transferência excluída!" : "Transação excluída!");
      loadData();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeletingId(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterBookmaker("all");
  };

  // Filter transactions client-side
  const filteredTransactions = transactions.filter((tx) => {
    // 1. Search term (notes or bookmaker name)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const notesMatch = tx.notes?.toLowerCase().includes(term);
      const bmName = getBookmakerName(tx.bookmaker_id).toLowerCase();
      const bmMatch = bmName.includes(term);
      if (!notesMatch && !bmMatch) return false;
    }

    // 2. Filter by type
    if (filterType !== "all") {
      const transfer = isTransfer(tx);
      if (filterType === "transfer" && !transfer) return false;
      if (filterType === "deposit" && (tx.type !== "deposit" || transfer)) return false;
      if (filterType === "withdrawal" && (tx.type !== "withdrawal" || transfer)) return false;
    }

    // 3. Filter by bookmaker
    if (filterBookmaker !== "all") {
      if (filterBookmaker === "free" && tx.bookmaker_id !== null) return false;
      if (filterBookmaker !== "free" && tx.bookmaker_id !== filterBookmaker) return false;
    }

    return true;
  });

  // Group by month -> day
  const grouped: GroupedTransactions = {};
  filteredTransactions.forEach((tx) => {
    const dateObj = parseDate(tx.transaction_date);
    const monthKey = formatMonthYear(dateObj);
    const dayKey = formatWeekdayDay(dateObj);

    if (!grouped[monthKey]) {
      grouped[monthKey] = { totalDeposit: 0, totalWithdrawal: 0, days: {} };
    }
    if (!grouped[monthKey].days[dayKey]) {
      grouped[monthKey].days[dayKey] = [];
    }

    // Accumulate sums for non-transfer transactions
    if (!isTransfer(tx)) {
      if (tx.type === "deposit") {
        grouped[monthKey].totalDeposit += tx.amount;
      } else {
        grouped[monthKey].totalWithdrawal += tx.amount;
      }
    }

    grouped[monthKey].days[dayKey].push(tx);
  });

  const getTransactionBadge = (tx: BankrollTransaction) => {
    if (isTransfer(tx)) {
      return (
        <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-semibold px-2 py-0.5 rounded-full text-[10px]">
          🔁 Transferência
        </Badge>
      );
    }
    if (tx.type === "deposit") {
      return (
        <Badge className="bg-success/15 text-success border-success/20 font-semibold px-2 py-0.5 rounded-full text-[10px]">
          📥 Depósito
        </Badge>
      );
    }
    return (
      <Badge className="bg-danger/15 text-danger border-danger/20 font-semibold px-2 py-0.5 rounded-full text-[10px]">
        📤 Saque
      </Badge>
    );
  };

  const isFiltersActive = searchTerm !== "" || filterType !== "all" || filterBookmaker !== "all";

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/bankrolls/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Histórico de Transações
        </h1>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por notas, casa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border/80 text-sm focus-visible:ring-primary/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters || isFiltersActive ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 border-border/80 h-9 px-3 ${
              showFilters || isFiltersActive
                ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                : "bg-card hover:bg-surface-hover"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Filtros</span>
          </Button>
        </div>

        {showFilters && (
          <Card className="stat-card glass-card border-primary/20 p-4 space-y-4 animate-in fade-in-50 slide-in-from-top-3 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type Filter */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Tipo</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="bg-background w-full h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="deposit">📥 Apenas Depósitos</SelectItem>
                    <SelectItem value="withdrawal">📤 Apenas Saques</SelectItem>
                    <SelectItem value="transfer">🔁 Apenas Transferências</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bookmaker/Free Balance Filter */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Conta / Casa</label>
                <Select value={filterBookmaker} onValueChange={setFilterBookmaker}>
                  <SelectTrigger className="bg-background w-full h-8 text-xs">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="free">💼 Saldo Livre</SelectItem>
                    {bookmakers.map((bm) => (
                      <SelectItem key={bm.id} value={bm.id}>
                        🏦 {bm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isFiltersActive && (
              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground h-8"
                  onClick={clearFilters}
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              Nenhuma transação registrada neste bankroll.
            </p>
          </CardContent>
        </Card>
      ) : filteredTransactions.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhuma transação corresponde aos filtros selecionados.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-dashed"
              onClick={clearFilters}
            >
              Limpar Filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([month, monthData]) => (
          <div key={month} className="space-y-3">
            {/* Month Header */}
            <div className="flex items-center justify-between bg-surface rounded-xl p-3">
              <span className="font-semibold capitalize text-primary">
                {month}
              </span>
              <div className="flex gap-3 text-xs text-muted-foreground font-semibold">
                {monthData.totalDeposit > 0 && (
                  <span className="text-success">
                    Depósitos: +R$ {monthData.totalDeposit.toFixed(2)}
                  </span>
                )}
                {monthData.totalWithdrawal > 0 && (
                  <span className="text-danger">
                    Saques: -R$ {monthData.totalWithdrawal.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {Object.entries(monthData.days).map(([day, dayTransactions]) => (
              <div key={day} className="space-y-2 pl-2">
                {/* Day Header */}
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-semibold capitalize text-muted-foreground">
                    {day}
                  </span>
                </div>

                {/* Transaction Cards */}
                {dayTransactions.map((tx) => (
                  <Card
                    key={tx.id}
                    className="stat-card overflow-hidden transition-colors border border-border/40 hover:border-primary/20"
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getTransactionBadge(tx)}
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-border"
                          >
                            {getBookmakerName(tx.bookmaker_id)}
                          </Badge>
                        </div>
                        {tx.notes && (
                          <p className="text-sm text-foreground font-medium truncate">
                            {tx.notes}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {parseDate(tx.transaction_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span
                          className={`font-mono text-sm font-bold ${
                            isTransfer(tx)
                              ? "text-indigo-400"
                              : tx.type === "deposit"
                              ? "text-success"
                              : "text-danger"
                          }`}
                        >
                          {isTransfer(tx) ? "" : tx.type === "deposit" ? "+" : "-"}R$ {tx.amount.toFixed(2)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
                          onClick={() => handleDeleteClick(tx.id)}
                          title="Excluir Transação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Transação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita e irá impactar o saldo calculado da banca.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeletingId(null);
              }}
              disabled={deleting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="flex-1 bg-destructive text-destructive-foreground"
            >
              {deleting ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
