import * as XLSX from "xlsx";
import type { Bankroll, Bet, BankrollTransaction, Bookmaker } from "@/types";
import { calculateBankrollStats } from "@/lib/calculations/statistics";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function brl(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

function pct(value: number) {
  return `${value.toFixed(2)}%`;
}

function fmtDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function stateLabel(state: string) {
  const map: Record<string, string> = {
    won: "✅ Ganhou",
    lost: "❌ Perdeu",
    pending: "⏳ Pendente",
    refunded: "↩️ Reembolsada",
    half_won: "½ Meio ganhou",
    half_lost: "½ Meio perdeu",
  };
  return map[state] ?? state;
}

function formatLabel(state: string) {
  const map: Record<string, string> = {
    simple: "Simples",
    back: "Back",
    lay: "Lay",
  };
  return map[state] ?? state;
}

function txTypeLabel(type: string, notes: string | null) {
  if (notes?.startsWith("Transferência:")) return "🔁 Transferência";
  if (type === "deposit") return "📥 Depósito";
  return "📤 Saque";
}

/** Apply uniform column widths to a worksheet */
function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

/** Create a header row style helper — returns array ready for aoa_to_sheet */
function makeHeader(cols: string[]): string[] {
  return cols;
}

// ─────────────────────────────────────────────
// Sheet 1 — Resumo
// ─────────────────────────────────────────────

function buildResumoSheet(
  bankroll: Bankroll,
  bets: Bet[],
  transactions: BankrollTransaction[]
): XLSX.WorkSheet {
  const stats = calculateBankrollStats(bets, transactions, bankroll.starting_capital);

  const rows: (string | number)[][] = [
    ["BET MANAGER — RELATÓRIO DE BANKROLL"],
    [],
    ["━━━ INFORMAÇÕES GERAIS ━━━"],
    ["Nome do Bankroll", bankroll.name],
    ["Capital Inicial", brl(bankroll.starting_capital)],
    ["Data de Início", fmtDate(bankroll.start_date)],
    ["Data de Fim", bankroll.end_date ? fmtDate(bankroll.end_date) : "Em andamento"],
    ["Status", bankroll.status === "active" ? "🟢 Ativo" : "📦 Arquivado"],
    ["Data de Exportação", new Date().toLocaleDateString("pt-BR")],
    [],
    ["━━━ PERFORMANCE ━━━"],
    ["Saldo Atual da Banca", brl(stats.currentCapital)],
    ["Lucro / Prejuízo Total", brl(stats.profits)],
    ["ROI (Return on Investment)", pct(stats.roi)],
    ["Progressão vs. Capital Inicial", pct(stats.progression)],
    ["TWR (Time-Weighted Return)", pct(stats.twr)],
    ["IRR (Taxa Interna de Retorno, anual)", pct(stats.irr)],
    ["Drawdown Máximo", pct(stats.drawdown)],
    [],
    ["━━━ APOSTAS ━━━"],
    ["Total de Apostas Finalizadas", stats.bets],
    ["Apostas Ganhas", stats.winningBets],
    ["Apostas Perdidas", stats.losingBets],
    ["Apostas Reembolsadas", stats.refundedBets],
    ["Apostas em Andamento", stats.inProgressBets],
    ["Taxa de Acerto", pct(stats.successRate)],
    ["Maior Sequência de Vitórias", stats.maxWinStreak],
    ["Maior Sequência de Derrotas", stats.maxLossStreak],
    [],
    ["━━━ STAKES & ODDS ━━━"],
    ["Total Apostado (finalizadas)", brl(stats.playedStakes)],
    ["Em Risco (pendentes)", brl(stats.inProgressStake)],
    ["Stake Médio", brl(stats.averageStake)],
    ["Maior Stake", brl(stats.maxStake)],
    ["Odds Médias", stats.averageOdds.toFixed(3)],
    ["Maior Odd Ganha", stats.biggestOddsWon.toFixed(3)],
    ["Maior Lucro (aposta)", brl(stats.biggestProfit)],
    ["Maior Perda (aposta)", brl(stats.biggestLoss)],
    ["Total em Comissões", brl(stats.commissions)],
    [],
    ["━━━ TRANSAÇÕES ━━━"],
    ["Total Depositado", brl(stats.deposits)],
    ["Total Sacado", brl(stats.withdrawals)],
    ["Saldo Líquido Transações", brl(stats.deposits - stats.withdrawals)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [38, 24]);
  return ws;
}

// ─────────────────────────────────────────────
// Sheet 2 — Apostas
// ─────────────────────────────────────────────

function buildApostasSheet(bets: Bet[], bookmakers: Bookmaker[]): XLSX.WorkSheet {
  const bmMap = new Map(bookmakers.map((b) => [b.id, b.name]));

  const header = makeHeader([
    "Data",
    "Label / Evento",
    "Esporte",
    "Casa de Apostas",
    "Formato",
    "Estado",
    "Stake (R$)",
    "Odds",
    "Odds Fechamento",
    "Comissão (%)",
    "Lucro/Perda (R$)",
    "Fonte da Stake",
    "Notas",
  ]);

  const sorted = [...bets].sort(
    (a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime()
  );

  const dataRows = sorted.map((b) => [
    fmtDate(b.bet_date),
    b.label,
    b.sport,
    b.bookmaker_id ? (bmMap.get(b.bookmaker_id) ?? "Desconhecida") : "—",
    formatLabel(b.bet_format),
    stateLabel(b.state),
    b.stake,
    b.odds,
    b.closing_odds ?? "—",
    b.commission_pct,
    b.profit_loss,
    b.stake_source === "bookmaker" ? "Casa" : "Saldo Livre",
    b.notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  setColWidths(ws, [12, 32, 14, 20, 10, 16, 12, 8, 16, 12, 16, 14, 28]);
  return ws;
}

// ─────────────────────────────────────────────
// Sheet 3 — Transações
// ─────────────────────────────────────────────

function buildTransacoesSheet(
  transactions: BankrollTransaction[],
  bookmakers: Bookmaker[]
): XLSX.WorkSheet {
  const bmMap = new Map(bookmakers.map((b) => [b.id, b.name]));

  const header = makeHeader([
    "Data",
    "Tipo",
    "Valor (R$)",
    "Conta / Casa",
    "Notas",
  ]);

  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.transaction_date).getTime() -
      new Date(b.transaction_date).getTime()
  );

  const dataRows = sorted.map((t) => [
    fmtDate(t.transaction_date),
    txTypeLabel(t.type, t.notes),
    t.type === "deposit" ? t.amount : -t.amount,
    t.bookmaker_id ? (bmMap.get(t.bookmaker_id) ?? "Desconhecida") : "Saldo Livre",
    t.notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  setColWidths(ws, [12, 20, 14, 20, 40]);
  return ws;
}

// ─────────────────────────────────────────────
// Sheet 4 — Timeline de Lucro
// ─────────────────────────────────────────────

function buildTimelineSheet(bets: Bet[]): XLSX.WorkSheet {
  const header = makeHeader([
    "Data",
    "Lucro do Dia (R$)",
    "Lucro Acumulado (R$)",
    "Nº Apostas no Dia",
  ]);

  const finished = bets
    .filter((b) => b.state !== "pending")
    .sort((a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime());

  const grouped = new Map<string, { profit: number; count: number }>();
  for (const bet of finished) {
    const key = bet.bet_date.substring(0, 10);
    const prev = grouped.get(key) ?? { profit: 0, count: 0 };
    grouped.set(key, { profit: prev.profit + bet.profit_loss, count: prev.count + 1 });
  }

  let cumulative = 0;
  const dataRows = [...grouped.entries()].map(([date, { profit, count }]) => {
    cumulative += profit;
    return [fmtDate(date), profit, cumulative, count];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  setColWidths(ws, [14, 20, 24, 20]);
  return ws;
}

// ─────────────────────────────────────────────
// Sheet 5 — Por Casa de Apostas
// ─────────────────────────────────────────────

function buildPorCasaSheet(bets: Bet[], bookmakers: Bookmaker[]): XLSX.WorkSheet {
  const header = makeHeader([
    "Casa de Apostas",
    "Nº Apostas",
    "Ganhou",
    "Perdeu",
    "Reembolsadas",
    "Taxa de Acerto (%)",
    "Total Apostado (R$)",
    "Lucro/Perda (R$)",
    "ROI (%)",
    "Odds Médias",
    "Maior Lucro (R$)",
    "Maior Perda (R$)",
  ]);

  const finished = bets.filter((b) => b.state !== "pending");

  const buildRow = (label: string, bmBets: Bet[]) => {
    const bmFinished = bmBets.filter((b) => b.state !== "pending");
    const won = bmBets.filter((b) => b.state === "won" || b.state === "half_won").length;
    const lost = bmBets.filter((b) => b.state === "lost" || b.state === "half_lost").length;
    const refunded = bmBets.filter((b) => b.state === "refunded").length;
    const totalStake = bmFinished.reduce((s, b) => s + b.stake, 0);
    const profit = bmFinished.reduce((s, b) => s + b.profit_loss, 0);
    const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;
    const avgOdds =
      bmFinished.length > 0
        ? bmFinished.reduce((s, b) => s + b.odds, 0) / bmFinished.length
        : 0;
    const biggestProfit =
      bmFinished.length > 0 ? Math.max(...bmFinished.map((b) => b.profit_loss)) : 0;
    const biggestLoss =
      bmFinished.length > 0 ? Math.min(...bmFinished.map((b) => b.profit_loss)) : 0;
    const successRate =
      bmFinished.length > 0 ? ((won) / bmFinished.length) * 100 : 0;

    return [
      label,
      bmFinished.length,
      won,
      lost,
      refunded,
      parseFloat(successRate.toFixed(2)),
      parseFloat(totalStake.toFixed(2)),
      parseFloat(profit.toFixed(2)),
      parseFloat(roi.toFixed(2)),
      parseFloat(avgOdds.toFixed(3)),
      parseFloat(biggestProfit.toFixed(2)),
      parseFloat(biggestLoss.toFixed(2)),
    ];
  };

  const dataRows: (string | number)[][] = [];

  // Row per bookmaker
  for (const bm of bookmakers) {
    const bmBets = finished.filter((b) => b.bookmaker_id === bm.id);
    if (bmBets.length > 0) {
      dataRows.push(buildRow(bm.name, bmBets));
    }
  }

  // Row for bets without bookmaker
  const noBmBets = finished.filter((b) => !b.bookmaker_id);
  if (noBmBets.length > 0) {
    dataRows.push(buildRow("(Sem casa)", noBmBets));
  }

  // Totals row
  dataRows.push(buildRow("📊 TOTAL GERAL", finished));

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  setColWidths(ws, [22, 12, 10, 10, 14, 18, 20, 18, 10, 12, 16, 16]);
  return ws;
}

// ─────────────────────────────────────────────
// Main export function
// ─────────────────────────────────────────────

export function exportBankrollToExcel(
  bankroll: Bankroll,
  bets: Bet[],
  transactions: BankrollTransaction[],
  bookmakers: Bookmaker[]
) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    buildResumoSheet(bankroll, bets, transactions),
    "Resumo"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildApostasSheet(bets, bookmakers),
    "Apostas"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTransacoesSheet(transactions, bookmakers),
    "Transações"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTimelineSheet(bets),
    "Timeline"
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildPorCasaSheet(bets, bookmakers),
    "Por Casa"
  );

  const today = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  const safeName = bankroll.name.replace(/[^a-zA-Z0-9À-ÿ\s-_]/g, "").trim();
  const filename = `${safeName} - ${today}.xlsx`;

  XLSX.writeFile(wb, filename);
}
