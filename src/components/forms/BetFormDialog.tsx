"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { Bookmaker, BetState, BetFormat } from "@/types";

interface BetFormDialogProps {
  bankrollId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  betToEdit?: any;
}

interface SelectionInput {
  label: string;
  odds: string;
  sport: string;
  state: BetState;
}

export function BetFormDialog({
  bankrollId,
  open,
  onOpenChange,
  onSaved,
  betToEdit,
}: BetFormDialogProps) {
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const supabase = createClient();

  // Form state
  const [betDate, setBetDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [betTime, setBetTime] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [bookmakerId, setBookmakerId] = useState("");
  const [betFormat, setBetFormat] = useState<BetFormat>("simple");
  const [stake, setStake] = useState("");
  const [state, setState] = useState<BetState>("pending");
  const [closingOdds, setClosingOdds] = useState("");
  const [commissionPct, setCommissionPct] = useState("0");
  const [notes, setNotes] = useState("");
  const [stakeSource, setStakeSource] = useState<"free_balance" | "bookmaker">("free_balance");
  const [selections, setSelections] = useState<SelectionInput[]>([
    { label: "", odds: "", sport: "Football", state: "pending" },
  ]);

  useEffect(() => {
    if (open) {
      loadBookmakers();
      if (betToEdit) {
        const dateObj = new Date(betToEdit.bet_date);
        setBetDate(dateObj.toISOString().split("T")[0]);
        setBetTime(dateObj.toTimeString().slice(0, 5));
        setBookmakerId(betToEdit.bookmaker_id || "");
        setBetFormat(betToEdit.bet_format);
        setStake(betToEdit.stake.toString());
        setState(betToEdit.state);
        setClosingOdds(betToEdit.closing_odds?.toString() || "");
        setCommissionPct(betToEdit.commission_pct?.toString() || "0");
        setNotes(betToEdit.notes || "");
        setStakeSource(betToEdit.stake_source || "free_balance");
        if (betToEdit.closing_odds || betToEdit.commission_pct || betToEdit.notes) {
          setShowMore(true);
        }
        loadSelections(betToEdit.id);
      } else {
        resetForm();
      }
    }
  }, [open, betToEdit]);

  const loadSelections = async (betId: string) => {
    const { data } = await supabase
      .from("selections")
      .select("*")
      .eq("bet_id", betId);
    if (data && data.length > 0) {
      setSelections(
        data.map((s: any) => ({
          label: s.label,
          odds: s.odds.toString(),
          sport: s.sport,
          state: s.state as BetState,
        }))
      );
    } else {
      setSelections([
        { label: "", odds: "", sport: "Football", state: "pending" },
      ]);
    }
  };

  const loadBookmakers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bookmakers")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (data) setBookmakers(data);
  };

  const addSelection = () => {
    setSelections([
      ...selections,
      { label: "", odds: "", sport: "Football", state: "pending" },
    ]);
  };

  const removeSelection = (index: number) => {
    if (selections.length > 1) {
      setSelections(selections.filter((_, i) => i !== index));
    }
  };

  const updateSelection = (
    index: number,
    field: keyof SelectionInput,
    value: string
  ) => {
    const updated = [...selections];
    updated[index] = { ...updated[index], [field]: value };
    setSelections(updated);
  };

  // Calculate combined odds for multiples
  const combinedOdds = selections.reduce((acc, s) => {
    const odds = parseFloat(s.odds);
    return isNaN(odds) ? acc : acc * odds;
  }, 1);

  // Calculate profit/loss
  const calculateProfitLoss = (): number => {
    const stakeNum = parseFloat(stake) || 0;
    const odds = selections.length === 1
      ? parseFloat(selections[0].odds) || 0
      : combinedOdds;

    if (state === "won") {
      return stakeNum * (odds - 1);
    } else if (state === "lost") {
      return -stakeNum;
    } else if (state === "half_won") {
      return (stakeNum * (odds - 1)) / 2;
    } else if (state === "half_lost") {
      return -stakeNum / 2;
    }
    return 0;
  };

  const handleDelete = async (keepMoneyDeducted: boolean) => {
    if (!betToEdit) return;

    setLoading(true);

    if (keepMoneyDeducted) {
      try {
        const betDateObj = new Date(betToEdit.bet_date);
        const formattedDate = betDateObj.toISOString().split("T")[0];

        const transactionPayload = {
          bankroll_id: bankrollId,
          type: "withdrawal" as const,
          amount: betToEdit.stake,
          transaction_date: formattedDate,
          bookmaker_id: betToEdit.stake_source === "bookmaker" ? (betToEdit.bookmaker_id || null) : null,
          notes: `Débito de aposta excluída: ${betToEdit.label || "Sem nome"}`
        };

        const { error: txError } = await supabase
          .from("bankroll_transactions")
          .insert(transactionPayload);

        if (txError) {
          toast.error("Erro ao registrar débito da stake", { description: txError.message });
          setLoading(false);
          return;
        }
      } catch (err: any) {
        toast.error("Erro ao processar data da transação", { description: err.message });
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("bets")
      .delete()
      .eq("id", betToEdit.id);

    if (error) {
      toast.error("Erro ao excluir aposta", { description: error.message });
      setLoading(false);
      return;
    }

    toast.success("Aposta excluída com sucesso!");
    setLoading(false);
    onOpenChange(false);
    onSaved();
  };

  const handleSubmit = async () => {
    if (!bookmakerId) {
      toast.error("A casa de apostas (Bookmaker) é obrigatória.");
      return;
    }

    const hasEmptySelection = selections.some((s) => !s.label.trim() || !s.odds.trim());
    if (hasEmptySelection) {
      toast.error("O nome e a odd de todas as seleções são obrigatórios.");
      return;
    }

    if (!stake) {
      toast.error("O valor da aposta (Stake) é obrigatório.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const odds = selections.length === 1
      ? parseFloat(selections[0].odds)
      : combinedOdds;

    const profitLoss = calculateProfitLoss();

    const betPayload = {
      user_id: user.id,
      bankroll_id: bankrollId,
      bookmaker_id: bookmakerId || null,
      bet_date: `${betDate}T${betTime}:00`,
      label: selections.map((s) => s.label).join(" + "),
      sport: selections[0].sport,
      state,
      bet_format: betFormat,
      stake: parseFloat(stake),
      odds,
      closing_odds: closingOdds ? parseFloat(closingOdds) : null,
      commission_pct: parseFloat(commissionPct) || 0,
      profit_loss: profitLoss,
      notes: notes || null,
      stake_source: stakeSource,
    };

    if (betToEdit) {
      const { error } = await supabase
        .from("bets")
        .update(betPayload)
        .eq("id", betToEdit.id);

      if (error) {
        toast.error("Erro ao salvar aposta", { description: error.message });
        setLoading(false);
        return;
      }

      // Delete existing selections and insert new ones
      await supabase.from("selections").delete().eq("bet_id", betToEdit.id);

      if (selections.length > 0) {
        const selectionsToInsert = selections.map((s) => ({
          bet_id: betToEdit.id,
          label: s.label,
          odds: parseFloat(s.odds) || 0,
          sport: s.sport,
          state: s.state as BetState,
        }));

        await supabase.from("selections").insert(selectionsToInsert);
      }

      toast.success("Aposta atualizada!");
    } else {
      const { data: bet, error } = await supabase
        .from("bets")
        .insert(betPayload)
        .select()
        .single();

      if (error) {
        toast.error("Erro ao salvar aposta", { description: error.message });
        setLoading(false);
        return;
      }

      // Insert selections
      if (bet && selections.length > 0) {
        const selectionsToInsert = selections.map((s) => ({
          bet_id: bet.id,
          label: s.label,
          odds: parseFloat(s.odds) || 0,
          sport: s.sport,
          state: s.state as BetState,
        }));

        await supabase.from("selections").insert(selectionsToInsert);
      }

      toast.success("Aposta registrada!");
    }

    setLoading(false);
    resetForm();
    onOpenChange(false);
    onSaved();
  };

  const resetForm = () => {
    setBetDate(new Date().toISOString().split("T")[0]);
    setBetTime(new Date().toTimeString().slice(0, 5));
    setBookmakerId("");
    setBetFormat("simple");
    setStake("");
    setState("pending");
    setClosingOdds("");
    setCommissionPct("0");
    setNotes("");
    setStakeSource("free_balance");
    setSelections([
      { label: "", odds: "", sport: "Football", state: "pending" },
    ]);
    setShowMore(false);
  };

  const sports = [
    "Football",
    "Basketball",
    "Tennis",
    "MMA",
    "Boxing",
    "Volleyball",
    "E-sports",
    "Baseball",
    "Hockey",
    "Other",
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{betToEdit ? "Editar Aposta" : "Adicionar Aposta"}</DialogTitle>
          <DialogDescription>
            {betToEdit
              ? "Edite os detalhes ou o status desta aposta"
              : "Registre uma nova aposta neste bankroll"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Data</Label>
              <Input
                type="date"
                value={betDate}
                onChange={(e) => setBetDate(e.target.value)}
                className="bg-background text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Hora</Label>
              <Input
                type="time"
                value={betTime}
                onChange={(e) => setBetTime(e.target.value)}
                className="bg-background text-sm"
              />
            </div>
          </div>

          {/* Bookmaker */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Bookmaker <span className="text-destructive">*</span>
            </Label>
            <Select value={bookmakerId} onValueChange={setBookmakerId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {bookmakers.map((bm) => (
                  <SelectItem key={bm.id} value={bm.id}>
                    {bm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Selections */}
          {selections.map((sel, i) => (
            <div
              key={i}
              className="space-y-3 bg-surface rounded-xl p-4 relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Seleção {i + 1}
                </span>
                {selections.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeSelection(i)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Nome da Aposta <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Ex: Real Madrid - Bayern"
                    value={sel.label}
                    onChange={(e) =>
                      updateSelection(i, "label", e.target.value)
                    }
                    className="bg-background text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Odds <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="1.50"
                    value={sel.odds}
                    onChange={(e) =>
                      updateSelection(i, "odds", e.target.value)
                    }
                    className="bg-background text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Esporte
                  </Label>
                  <Select
                    value={sel.sport}
                    onValueChange={(v) => updateSelection(i, "sport", v)}
                  >
                    <SelectTrigger className="bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {sports.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Estado
                  </Label>
                  <Select
                    value={sel.state}
                    onValueChange={(v) =>
                      updateSelection(i, "state", v)
                    }
                  >
                    <SelectTrigger className="bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="won">Ganhou</SelectItem>
                      <SelectItem value="lost">Perdeu</SelectItem>
                      <SelectItem value="refunded">Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full border-dashed border-border hover:border-primary/30"
            onClick={addSelection}
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar seleção
          </Button>

          <Separator />

          {/* Bet Format */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Formato da aposta
            </Label>
            <div className="flex gap-2">
              {(["simple", "back", "lay"] as BetFormat[]).map((format) => (
                <Button
                  key={format}
                  variant={betFormat === format ? "default" : "outline"}
                  size="sm"
                  className={
                    betFormat === format
                      ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                      : "border-border hover:bg-surface-hover"
                  }
                  onClick={() => setBetFormat(format)}
                >
                  {format === "simple"
                    ? "🎯 Simple"
                    : format === "back"
                    ? "⬆ Back"
                    : "⬇ Lay"}
                </Button>
              ))}
            </div>
          </div>

          {/* Stake Source */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Origem da Stake <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={stakeSource === "bookmaker" ? "default" : "outline"}
                size="sm"
                className={`flex-1 text-xs py-2 h-9 ${
                  stakeSource === "bookmaker"
                    ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                    : "border-border hover:bg-surface-hover"
                }`}
                onClick={() => setStakeSource("bookmaker")}
              >
                🏦 Saldo da Casa (Bookmaker)
              </Button>
              <Button
                type="button"
                variant={stakeSource === "free_balance" ? "default" : "outline"}
                size="sm"
                className={`flex-1 text-xs py-2 h-9 ${
                  stakeSource === "free_balance"
                    ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30"
                    : "border-border hover:bg-surface-hover"
                }`}
                onClick={() => setStakeSource("free_balance")}
              >
                💼 Banca Livre (Saldo Livre)
              </Button>
            </div>
          </div>

          {/* Stake and State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Stake (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 50"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Resultado
              </Label>
              <Select
                value={state}
                onValueChange={(v) => setState(v as BetState)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="pending">⏳ Pendente</SelectItem>
                  <SelectItem value="won">✅ Ganhou</SelectItem>
                  <SelectItem value="lost">❌ Perdeu</SelectItem>
                  <SelectItem value="refunded">↩ Reembolso</SelectItem>
                  <SelectItem value="half_won">½ Meio ganho</SelectItem>
                  <SelectItem value="half_lost">½ Meio perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Combined odds display */}
          {selections.length > 1 && (
            <div className="text-sm text-muted-foreground text-center">
              Odds combinadas:{" "}
              <span className="text-foreground font-mono font-bold">
                {combinedOdds.toFixed(2)}
              </span>
            </div>
          )}

          {/* P&L Preview */}
          {state !== "pending" && (
            <div
              className={`text-center py-2 px-4 rounded-lg text-sm font-semibold ${
                calculateProfitLoss() >= 0
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger"
              }`}
            >
              P&L: {calculateProfitLoss() >= 0 ? "+" : ""}R${" "}
              {calculateProfitLoss().toFixed(2)}
            </div>
          )}

          {/* More Options */}
          <button
            className="flex items-center gap-2 text-sm text-primary hover:underline"
            onClick={() => setShowMore(!showMore)}
          >
            {showMore ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {showMore ? "Menos opções" : "Mais opções"}
          </button>

          {showMore && (
            <div className="space-y-3 bg-surface rounded-xl p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Closing Odds
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Para CLV"
                    value={closingOdds}
                    onChange={(e) => setClosingOdds(e.target.value)}
                    className="bg-background text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    Comissão %
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(e.target.value)}
                    className="bg-background text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Notas
                </Label>
                <Textarea
                  placeholder="Observações sobre a aposta..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-background text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Submit / Action Buttons */}
          <div className="flex gap-2 w-full">
            {betToEdit && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex-1 bg-destructive text-destructive-foreground hover:opacity-90 py-5 font-semibold"
                disabled={loading}
              >
                Excluir
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              className="flex-[2] bg-gradient-action text-white hover:opacity-90 py-5 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : betToEdit ? (
                "Salvar Alterações"
              ) : (
                "Adicionar Aposta"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir Aposta</DialogTitle>
          <DialogDescription>
            Você está excluindo a aposta: <span className="font-semibold text-foreground">{betToEdit?.label}</span> no valor de <span className="font-semibold text-foreground">R$ {parseFloat(stake || "0").toFixed(2)}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Quer excluir o dinheiro apostado também?
          </p>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start text-left h-auto py-3 px-4 border-border hover:bg-surface-hover flex flex-col items-start gap-1 w-full bg-background font-normal"
              onClick={() => {
                setDeleteDialogOpen(false);
                handleDelete(false);
              }}
              disabled={loading}
            >
              <span className="font-semibold text-foreground text-sm">
                Sim, excluir o dinheiro apostado também
              </span>
              <span className="text-xs text-muted-foreground">
                A stake de R$ {parseFloat(stake || "0").toFixed(2)} será devolvida ao saldo da sua banca.
              </span>
            </Button>

            <Button
              variant="outline"
              className="justify-start text-left h-auto py-3 px-4 border-border hover:bg-surface-hover flex flex-col items-start gap-1 w-full bg-background font-normal"
              onClick={() => {
                setDeleteDialogOpen(false);
                handleDelete(true);
              }}
              disabled={loading}
            >
              <span className="font-semibold text-foreground text-sm">
                Não, manter o dinheiro descontado
              </span>
              <span className="text-xs text-muted-foreground">
                A aposta será deletada, mas a stake continuará debitada da banca (registrada como um saque).
              </span>
            </Button>
          </div>

          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
);
}
