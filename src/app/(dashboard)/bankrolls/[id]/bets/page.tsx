"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { Bet } from "@/types";
import { BetFormDialog } from "@/components/forms/BetFormDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Date formatting helpers (avoiding date-fns import issues)
const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const weekdays = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function formatMonthYear(d: Date) { return `${months[d.getMonth()]} ${d.getFullYear()}`; }
function formatWeekdayDay(d: Date) { return `${weekdays[d.getDay()]} ${d.getDate()}`; }
function formatTime(d: Date) { return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function parseDate(s: string) { return new Date(s); }

interface PageProps {
  params: Promise<{ id: string }>;
}

interface GroupedBets {
  [month: string]: {
    total: number;
    weeks: {
      [week: string]: {
        total: number;
        days: {
          [day: string]: {
            total: number;
            bets: Bet[];
          };
        };
      };
    };
  };
}

export default function BetsListPage({ params }: PageProps) {
  const { id } = use(params);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<any | null>(null);
  const supabase = createClient();

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterBookmaker, setFilterBookmaker] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterSport, setFilterSport] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minOdds, setMinOdds] = useState<string>("");
  const [maxOdds, setMaxOdds] = useState<string>("");
  const [minStake, setMinStake] = useState<string>("");
  const [maxStake, setMaxStake] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadBets();
  }, [id]);

  const loadBets = async () => {
    const { data } = await supabase
      .from("bets")
      .select("*, bookmaker:bookmakers(*), category:categories(*), competition:competitions(*), bet_type:bet_types(*)")
      .eq("bankroll_id", id)
      .order("bet_date", { ascending: false });

    if (data) setBets(data);
    setLoading(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterState("all");
    setFilterBookmaker("all");
    setFilterFormat("all");
    setFilterSport("all");
    setStartDate("");
    setEndDate("");
    setMinOdds("");
    setMaxOdds("");
    setMinStake("");
    setMaxStake("");
    setSortBy("date_desc");
  };

  // Extract unique options for filter dropdowns from all bets
  const bookmakerOptions = Array.from(
    new Map(
      bets
        .filter((b) => b.bookmaker)
        .map((b) => [b.bookmaker!.id, b.bookmaker!])
    ).values()
  );

  const sportOptions = Array.from(
    new Set(bets.map((b) => b.sport).filter(Boolean))
  );

  // Filter bets list client-side
  const filteredBets = bets.filter((bet) => {
    // 1. Search Term (bet label, bookmaker name, category name, competition name, sport)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchLabel = bet.label?.toLowerCase().includes(term);
      const matchBookmaker = bet.bookmaker?.name?.toLowerCase().includes(term);
      const matchCategory = bet.category?.name?.toLowerCase().includes(term);
      const matchCompetition = bet.competition?.name?.toLowerCase().includes(term);
      const matchSport = bet.sport?.toLowerCase().includes(term);
      const matchNotes = bet.notes?.toLowerCase().includes(term);
      if (
        !matchLabel &&
        !matchBookmaker &&
        !matchCategory &&
        !matchCompetition &&
        !matchSport &&
        !matchNotes
      ) {
        return false;
      }
    }

    // 2. State
    if (filterState !== "all") {
      if (filterState === "others") {
        if (["pending", "won", "lost"].includes(bet.state)) {
          return false;
        }
      } else if (bet.state !== filterState) {
        return false;
      }
    }

    // 3. Bookmaker
    if (filterBookmaker !== "all" && bet.bookmaker_id !== filterBookmaker) {
      return false;
    }

    // 4. Format
    if (filterFormat !== "all" && bet.bet_format !== filterFormat) {
      return false;
    }

    // 5. Sport
    if (filterSport !== "all" && bet.sport !== filterSport) {
      return false;
    }

    // 6. Date Range
    if (startDate) {
      const betTime = new Date(bet.bet_date).getTime();
      const startLimit = new Date(`${startDate}T00:00:00`).getTime();
      if (betTime < startLimit) return false;
    }
    if (endDate) {
      const betTime = new Date(bet.bet_date).getTime();
      const endLimit = new Date(`${endDate}T23:59:59`).getTime();
      if (betTime > endLimit) return false;
    }

    // 7. Odds Range
    if (minOdds) {
      const minVal = parseFloat(minOdds);
      if (!isNaN(minVal) && bet.odds < minVal) return false;
    }
    if (maxOdds) {
      const maxVal = parseFloat(maxOdds);
      if (!isNaN(maxVal) && bet.odds > maxVal) return false;
    }

    // 8. Stake Range
    if (minStake) {
      const minVal = parseFloat(minStake);
      if (!isNaN(minVal) && bet.stake < minVal) return false;
    }
    if (maxStake) {
      const maxVal = parseFloat(maxStake);
      if (!isNaN(maxVal) && bet.stake > maxVal) return false;
    }

    return true;
  });

  // Sort filtered bets client-side
  const sortedBets = [...filteredBets].sort((a, b) => {
    switch (sortBy) {
      case "date_desc":
        return new Date(b.bet_date).getTime() - new Date(a.bet_date).getTime();
      case "date_asc":
        return new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime();
      case "profit_desc":
        return b.profit_loss - a.profit_loss;
      case "profit_asc":
        return a.profit_loss - b.profit_loss;
      case "odds_desc":
        return b.odds - a.odds;
      case "odds_asc":
        return a.odds - b.odds;
      case "stake_desc":
        return b.stake - a.stake;
      case "stake_asc":
        return a.stake - b.stake;
      default:
        return 0;
    }
  });

  // Check if any filters are active
  const activeFiltersCount = [
    searchTerm !== "",
    filterState !== "all",
    filterBookmaker !== "all",
    filterFormat !== "all",
    filterSport !== "all",
    startDate !== "",
    endDate !== "",
    minOdds !== "",
    maxOdds !== "",
    minStake !== "",
    maxStake !== "",
  ].filter(Boolean).length;

  const isAnyFilterActive = activeFiltersCount > 0;

  // Group bets by month > week > day using sortedBets
  const grouped: GroupedBets = {};
  sortedBets.forEach((bet) => {
    const date = parseDate(bet.bet_date);
    const monthKey = formatMonthYear(date);
    const weekNum = Math.ceil(date.getDate() / 7);
    const weekKey = `Semana ${weekNum}`;
    const dayKey = formatWeekdayDay(date);

    if (!grouped[monthKey]) {
      grouped[monthKey] = { total: 0, weeks: {} };
    }
    if (!grouped[monthKey].weeks[weekKey]) {
      grouped[monthKey].weeks[weekKey] = { total: 0, days: {} };
    }
    if (!grouped[monthKey].weeks[weekKey].days[dayKey]) {
      grouped[monthKey].weeks[weekKey].days[dayKey] = { total: 0, bets: [] };
    }

    const pl = bet.state !== "pending" ? bet.profit_loss : 0;
    grouped[monthKey].total += pl;
    grouped[monthKey].weeks[weekKey].total += pl;
    grouped[monthKey].weeks[weekKey].days[dayKey].total += pl;
    grouped[monthKey].weeks[weekKey].days[dayKey].bets.push(bet);
  });

  const stateColor = (state: string) => {
    switch (state) {
      case "won": return "text-success";
      case "lost": return "text-danger";
      case "pending": return "text-warning";
      case "refunded": return "text-muted-foreground";
      case "half_won": return "text-success/70";
      case "half_lost": return "text-danger/70";
      default: return "";
    }
  };

  const stateLabel = (state: string) => {
    switch (state) {
      case "won": return "Won";
      case "lost": return "Lost";
      case "pending": return "Pending";
      case "refunded": return "Refund";
      case "half_won": return "½ Won";
      case "half_lost": return "½ Lost";
      default: return state;
    }
  };

  const formatPL = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)} R$`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/bankrolls/${id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Apostas</h1>
        </div>
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        {/* Main Search & Advanced filters trigger */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar aposta, casa, notas..."
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
            variant={showAdvanced || isAnyFilterActive ? "default" : "outline"}
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 border-border/80 h-9 px-3 ${
              showAdvanced || isAnyFilterActive
                ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                : "bg-card hover:bg-surface-hover"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4.5 h-4.5">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Quick Status Filters (Horizontal Scrollable) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-2 px-2 scrollbar-none">
          {[
            { id: "all", label: "Todas" },
            { id: "pending", label: "Pendentes", color: "border-warning/30 hover:border-warning/60 text-warning" },
            { id: "won", label: "Ganhas", color: "border-success/30 hover:border-success/60 text-success" },
            { id: "lost", label: "Perdidas", color: "border-danger/30 hover:border-danger/60 text-danger" },
            { id: "refunded", label: "Reembolsadas" },
            { id: "half_won", label: "½ Ganhas" },
            { id: "half_lost", label: "½ Perdidas" },
            { id: "others", label: "Outros" }
          ].map((status) => {
            const isSelected = filterState === status.id;
            return (
              <Button
                key={status.id}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={`rounded-full text-xs py-1 h-7 border-border/60 shrink-0 ${
                  isSelected
                    ? "bg-primary/20 text-primary border-primary/40 font-semibold hover:bg-primary/30"
                    : status.color || "bg-card hover:bg-surface-hover text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterState(status.id)}
              >
                {status.label}
              </Button>
            );
          })}
        </div>

        {/* Advanced Filters Expandable Panel */}
        {showAdvanced && (
          <Card className="stat-card glass-card border-primary/20 p-4 space-y-4 animate-in fade-in-50 slide-in-from-top-3 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Bookmaker Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Casa de Apostas</label>
                <Select value={filterBookmaker} onValueChange={setFilterBookmaker}>
                  <SelectTrigger className="bg-background w-full h-8 text-xs">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
                    <SelectItem value="all">Todas</SelectItem>
                    {bookmakerOptions.map((bm) => (
                      <SelectItem key={bm.id} value={bm.id}>
                        {bm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Format Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Formato</label>
                <Select value={filterFormat} onValueChange={setFilterFormat}>
                  <SelectTrigger className="bg-background w-full h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="back">Back</SelectItem>
                    <SelectItem value="lay">Lay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sport Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Esporte</label>
                <Select value={filterSport} onValueChange={setFilterSport}>
                  <SelectTrigger className="bg-background w-full h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
                    <SelectItem value="all">Todos</SelectItem>
                    {sportOptions.map((sport) => (
                      <SelectItem key={sport} value={sport}>
                        {sport}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Inputs */}
              <div className="space-y-1.5 sm:col-span-2 md:col-span-1">
                <label className="text-xs text-muted-foreground font-medium">Período</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-background h-8 text-[11px] px-2"
                    placeholder="Início"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-background h-8 text-[11px] px-2"
                    placeholder="Fim"
                  />
                </div>
              </div>

              {/* Odds Range Inputs */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Odds (Min / Max)</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Min"
                    value={minOdds}
                    onChange={(e) => setMinOdds(e.target.value)}
                    className="bg-background h-8 text-xs px-2"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Max"
                    value={maxOdds}
                    onChange={(e) => setMaxOdds(e.target.value)}
                    className="bg-background h-8 text-xs px-2"
                  />
                </div>
              </div>

              {/* Stake Range Inputs */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Stake (Min / Max)</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="1"
                    placeholder="Min R$"
                    value={minStake}
                    onChange={(e) => setMinStake(e.target.value)}
                    className="bg-background h-8 text-xs px-2"
                  />
                  <Input
                    type="number"
                    step="1"
                    placeholder="Max R$"
                    value={maxStake}
                    onChange={(e) => setMaxStake(e.target.value)}
                    className="bg-background h-8 text-xs px-2"
                  />
                </div>
              </div>

              {/* Sort Options */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Ordenar por</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-background w-full h-8 text-xs">
                    <SelectValue placeholder="Data (Mais recente)" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="date_desc">📅 Data (Mais recente)</SelectItem>
                    <SelectItem value="date_asc">📅 Data (Mais antiga)</SelectItem>
                    <SelectItem value="profit_desc">📈 Lucro (Maior primeiro)</SelectItem>
                    <SelectItem value="profit_asc">📉 Lucro (Menor primeiro)</SelectItem>
                    <SelectItem value="odds_desc">🎯 Odds (Maior primeiro)</SelectItem>
                    <SelectItem value="odds_asc">🎯 Odds (Menor primeiro)</SelectItem>
                    <SelectItem value="stake_desc">💰 Stake (Maior primeiro)</SelectItem>
                    <SelectItem value="stake_asc">💰 Stake (Menor primeiro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear filters trigger */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground h-8"
                onClick={clearFilters}
                disabled={!isAnyFilterActive}
              >
                Limpar Filtros
              </Button>
            </div>
          </Card>
        )}

        {/* Active Filters Badges */}
        {isAnyFilterActive && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Filtros ativos:</span>
            {searchTerm && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                Busca: "{searchTerm}"
                <X className="w-2.5 h-2.5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setSearchTerm("")} />
              </Badge>
            )}
            {filterBookmaker !== "all" && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                Casa: {bookmakerOptions.find(b => b.id === filterBookmaker)?.name || "Selecionada"}
                <X className="w-2.5 h-2.5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setFilterBookmaker("all")} />
              </Badge>
            )}
            {filterFormat !== "all" && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                Formato: {filterFormat}
                <X className="w-2.5 h-2.5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setFilterFormat("all")} />
              </Badge>
            )}
            {filterSport !== "all" && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                Esporte: {filterSport}
                <X className="w-2.5 h-2.5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setFilterSport("all")} />
              </Badge>
            )}
            {(startDate || endDate) && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                Período: {startDate || "Início"} - {endDate || "Fim"}
                <X className="w-2.5 h-2.5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => { setStartDate(""); setEndDate(""); }} />
              </Badge>
            )}
            {(minOdds || maxOdds) && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                Odds: {minOdds || "1.0"} - {maxOdds || "∞"}
                <X className="w-2.5 h-2.5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => { setMinOdds(""); setMaxOdds(""); }} />
              </Badge>
            )}
            {(minStake || maxStake) && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                Stake: {minStake ? `R$${minStake}` : "Min"} - {maxStake ? `R$${maxStake}` : "Max"}
                <X className="w-2.5 h-2.5 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => { setMinStake(""); setMaxStake(""); }} />
              </Badge>
            )}
            <button
              onClick={clearFilters}
              className="text-[10px] text-primary hover:underline ml-1 cursor-pointer font-medium"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* Filtered Summary Banner */}
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-surface/40 px-3 py-1.5 rounded-lg border border-border/40">
          <div>
            Exibindo <span className="font-semibold text-foreground">{sortedBets.length}</span> de{" "}
            <span className="font-semibold text-foreground">{bets.length}</span> apostas
          </div>
          {isAnyFilterActive && (
            <div className="flex items-center gap-1.5">
              <span>P&L Filtrado:</span>
              <span className={`font-semibold tabular-nums ${
                sortedBets.reduce((acc, b) => acc + (b.state !== "pending" ? b.profit_loss : 0), 0) >= 0
                  ? "text-success"
                  : "text-danger"
              }`}>
                {formatPL(sortedBets.reduce((acc, b) => acc + (b.state !== "pending" ? b.profit_loss : 0), 0))}
              </span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : bets.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhuma aposta registrada
            </p>
            <Button
              className="bg-gradient-action text-white hover:opacity-90"
              onClick={() => setBetDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Aposta
            </Button>
          </CardContent>
        </Card>
      ) : sortedBets.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhuma aposta encontrada com os filtros selecionados.
            </p>
            <Button
              variant="outline"
              className="border-dashed"
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
              <span
                className={`font-bold tabular-nums text-sm ${
                  monthData.total >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {formatPL(monthData.total)}
              </span>
            </div>

            {Object.entries(monthData.weeks).map(([week, weekData]) => (
              <div key={week} className="space-y-2 pl-2">
                {/* Week Header */}
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-muted-foreground">{week}</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      weekData.total >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatPL(weekData.total)}
                  </span>
                </div>

                {Object.entries(weekData.days).map(([day, dayData]) => (
                  <div key={day} className="space-y-2">
                    {/* Day Header */}
                    <div className="flex items-center justify-between px-2">
                      <span className="text-sm font-medium capitalize">
                        {day}
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          dayData.total >= 0
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {formatPL(dayData.total)}
                      </span>
                    </div>

                    {/* Bet Cards */}
                    {dayData.bets.map((bet) => (
                      <Card
                        key={bet.id}
                        className="stat-card overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => {
                          setSelectedBet(bet);
                          setBetDialogOpen(true);
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {formatTime(parseDate(bet.bet_date))}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {bet.bet_format === "simple"
                                    ? "Simple"
                                    : bet.bet_format === "back"
                                    ? "Back"
                                    : "Lay"}
                                </Badge>
                                {bet.bookmaker && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
                                  >
                                    {bet.bookmaker.name}
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    bet.stake_source === "free_balance"
                                      ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                                      : "border-sky-500/30 text-sky-500 bg-sky-500/10"
                                  }`}
                                >
                                  {bet.stake_source === "free_balance" ? "💼 Livre" : "🏦 Casa"}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium truncate">
                                {bet.label}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>Odds: {bet.odds.toFixed(2)}</span>
                                <span>Stake: R$ {bet.stake.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span
                                className={`text-sm font-bold writing-mode-vertical ${stateColor(bet.state)}`}
                                style={{
                                  writingMode: "vertical-rl",
                                  textOrientation: "mixed",
                                }}
                              >
                                {stateLabel(bet.state)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}

      {/* FAB */}
      <BetFormDialog
        bankrollId={id}
        open={betDialogOpen}
        onOpenChange={(open) => {
          setBetDialogOpen(open);
          if (!open) setSelectedBet(null);
        }}
        onSaved={loadBets}
        betToEdit={selectedBet}
      />

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Button
          size="lg"
          className="rounded-full w-14 h-14 bg-gradient-action text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all"
          onClick={() => {
            setSelectedBet(null);
            setBetDialogOpen(true);
          }}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
