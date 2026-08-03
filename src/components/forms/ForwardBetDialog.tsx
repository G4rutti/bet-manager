"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Share2, Loader2, Landmark, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Bankroll, Bet, BetState, Bookmaker } from "@/types";

interface ForwardBetDialogProps {
  currentBankrollId: string;
  betsToForward: Bet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function calculateProfitLoss(state: BetState, stake: number, odds: number): number {
  if (state === "won") {
    return stake * (odds - 1);
  } else if (state === "lost") {
    return -stake;
  } else if (state === "half_won") {
    return (stake * (odds - 1)) / 2;
  } else if (state === "half_lost") {
    return -stake / 2;
  }
  return 0;
}

export function ForwardBetDialog({
  currentBankrollId,
  betsToForward,
  open,
  onOpenChange,
  onSuccess,
}: ForwardBetDialogProps) {
  const [bankrolls, setBankrolls] = useState<Bankroll[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [targetBankrollId, setTargetBankrollId] = useState<string>("");
  const [overrideStake, setOverrideStake] = useState<string>("");
  const [resetState, setResetState] = useState<boolean>(false);
  const [stakeSource, setStakeSource] = useState<"same" | "free_balance" | "bookmaker">("same");
  const [targetBookmakerId, setTargetBookmakerId] = useState<string>("same");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const supabase = createClient();
  const isMultiple = betsToForward.length > 1;
  const singleBet = betsToForward.length === 1 ? betsToForward[0] : null;

  useEffect(() => {
    if (open) {
      loadInitialData();
      if (singleBet) {
        setOverrideStake(singleBet.stake.toString());
      } else {
        setOverrideStake("");
      }
      setResetState(false);
      setStakeSource("same");
      setTargetBookmakerId("same");
    }
  }, [open, betsToForward]);

  const loadInitialData = async () => {
    setFetching(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch active bankrolls excluding current one
    const { data: bData } = await supabase
      .from("bankrolls")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .neq("id", currentBankrollId)
      .order("name");

    if (bData) {
      setBankrolls(bData);
      if (bData.length > 0) {
        setTargetBankrollId(bData[0].id);
      } else {
        setTargetBankrollId("");
      }
    }

    // Fetch user bookmakers
    const { data: bmData } = await supabase
      .from("bookmakers")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (bmData) setBookmakers(bmData);

    setFetching(false);
  };

  const handleForward = async () => {
    if (!targetBankrollId) {
      toast.error("Selecione um bankroll de destino.");
      return;
    }

    if (betsToForward.length === 0) {
      toast.error("Nenhuma aposta selecionada.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sua sessão expirou.");
      setLoading(false);
      return;
    }

    try {
      let successCount = 0;

      for (const bet of betsToForward) {
        // Fetch existing selections for this bet
        const { data: selections } = await supabase
          .from("selections")
          .select("*")
          .eq("bet_id", bet.id);

        const newStake = overrideStake && !isNaN(parseFloat(overrideStake)) && parseFloat(overrideStake) > 0
          ? parseFloat(overrideStake)
          : bet.stake;

        const newState: BetState = resetState ? "pending" : bet.state;
        const newProfitLoss = calculateProfitLoss(newState, newStake, bet.odds);

        const newBookmakerId = targetBookmakerId === "same"
          ? bet.bookmaker_id
          : targetBookmakerId === "none"
          ? null
          : targetBookmakerId;

        const newStakeSource = stakeSource === "same" ? bet.stake_source : stakeSource;

        const betPayload = {
          user_id: user.id,
          bankroll_id: targetBankrollId,
          bookmaker_id: newBookmakerId,
          category_id: bet.category_id,
          competition_id: bet.competition_id,
          bet_type_id: bet.bet_type_id,
          bet_date: bet.bet_date,
          label: bet.label,
          sport: bet.sport,
          state: newState,
          bet_format: bet.bet_format,
          stake: newStake,
          odds: bet.odds,
          closing_odds: bet.closing_odds,
          commission_pct: bet.commission_pct || 0,
          profit_loss: newProfitLoss,
          notes: bet.notes ? `[Encaminhada] ${bet.notes}` : "[Encaminhada]",
          stake_source: newStakeSource,
        };

        const { data: newBet, error: betError } = await supabase
          .from("bets")
          .insert(betPayload)
          .select()
          .single();

        if (betError) {
          console.error("Erro ao encaminhar aposta:", betError);
          continue;
        }

        // Copy selections if present
        if (selections && selections.length > 0 && newBet) {
          const selectionsToInsert = selections.map((s: any) => ({
            bet_id: newBet.id,
            label: s.label,
            odds: s.odds,
            sport: s.sport,
            state: resetState ? "pending" : s.state,
          }));

          await supabase.from("selections").insert(selectionsToInsert);
        }

        successCount++;
      }

      const targetBankrollName = bankrolls.find((b) => b.id === targetBankrollId)?.name || "destino";

      if (successCount > 0) {
        toast.success(
          isMultiple
            ? `${successCount} apostas encaminhadas para "${targetBankrollName}"!`
            : `Aposta encaminhada com sucesso para "${targetBankrollName}"!`
        );
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error("Ocorreu um erro ao encaminhar as apostas.");
      }
    } catch (err: any) {
      toast.error("Erro ao processar encaminhamento: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Share2 className="w-5 h-5 text-primary" />
            {isMultiple
              ? `Encaminhar ${betsToForward.length} Apostas`
              : "Encaminhar Aposta para Outro Bankroll"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Copie aposta(s) para outro bankroll sem precisar digitar todos os dados novamente.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : bankrolls.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-xl border border-border/50">
            Você não possui outros bankrolls ativos para onde encaminhar esta aposta.
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Bet Summary Preview */}
            {!isMultiple && singleBet && (
              <div className="p-3 bg-surface/60 rounded-xl border border-border/50 text-xs space-y-1">
                <p className="font-semibold text-foreground truncate">{singleBet.label}</p>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Esporte: {singleBet.sport}</span>
                  <span>Odd: <strong className="text-foreground">{singleBet.odds.toFixed(2)}</strong></span>
                  <span>Stake original: <strong className="text-foreground">R$ {singleBet.stake.toFixed(2)}</strong></span>
                </div>
              </div>
            )}

            {isMultiple && (
              <div className="p-3 bg-surface/60 rounded-xl border border-border/50 text-xs">
                <span className="font-semibold text-foreground">
                  {betsToForward.length} apostas selecionadas
                </span>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Serão copiadas mantendo odds, seleções e formatos originais.
                </p>
              </div>
            )}

            {/* Target Bankroll Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Bankroll de Destino *</Label>
              <Select value={targetBankrollId} onValueChange={setTargetBankrollId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione o bankroll..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {bankrolls.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <Landmark className="w-3.5 h-3.5" /> {b.name} (Capital R$ {b.starting_capital.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stake Input */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {isMultiple ? "Stake Personalizada (Opcional)" : "Stake no Bankroll de Destino (R$)"}
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder={isMultiple ? "Deixe em branco para manter a stake original de cada uma" : "Digite o valor da stake..."}
                value={overrideStake}
                onChange={(e) => setOverrideStake(e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Bookmaker Override Option */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Casa de Apostas</Label>
                <Select value={targetBookmakerId} onValueChange={setTargetBookmakerId}>
                  <SelectTrigger className="bg-background text-xs">
                    <SelectValue placeholder="Mesma da aposta" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="same">Manter mesma</SelectItem>
                    <SelectItem value="none">Nenhuma / Saldo livre</SelectItem>
                    {bookmakers.map((bm) => (
                      <SelectItem key={bm.id} value={bm.id}>
                        {bm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Origem do Saldo</Label>
                <Select value={stakeSource} onValueChange={(val: any) => setStakeSource(val)}>
                  <SelectTrigger className="bg-background text-xs">
                    <SelectValue placeholder="Mesma da aposta" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="same">Manter mesma</SelectItem>
                    <SelectItem value="free_balance">
                      <Wallet className="w-3.5 h-3.5" /> Saldo Livre
                    </SelectItem>
                    <SelectItem value="bookmaker">
                      <Landmark className="w-3.5 h-3.5" /> Casa de Apostas
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status Option */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="resetState"
                checked={resetState}
                onChange={(e) => setResetState(e.target.checked)}
                className="rounded border-border bg-background text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="resetState" className="text-xs text-foreground cursor-pointer select-none">
                Redefinir status para <strong className="text-warning">Pendente</strong> no destino
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleForward}
            disabled={loading || bankrolls.length === 0 || !targetBankrollId}
            className="bg-brand text-white hover:opacity-90 text-xs gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Encaminhando...
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                Confirmar Encaminhamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
