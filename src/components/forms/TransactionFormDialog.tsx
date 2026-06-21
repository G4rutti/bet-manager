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
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Bookmaker } from "@/types";

interface TransactionFormDialogProps {
  bankrollId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  bookmakers: Bookmaker[];
  initialType?: "deposit" | "withdrawal" | "transfer";
  initialBookmakerId?: string;
}

export function TransactionFormDialog({
  bankrollId,
  open,
  onOpenChange,
  onSaved,
  bookmakers,
  initialType,
  initialBookmakerId,
}: TransactionFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"deposit" | "withdrawal" | "transfer">(
    initialType || "deposit"
  );
  const [amount, setAmount] = useState("");
  const [bookmakerId, setBookmakerId] = useState(initialBookmakerId || "none");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Transfer-specific state
  const [sourceId, setSourceId] = useState("free");
  const [destId, setDestId] = useState("free");

  const supabase = createClient();

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, initialType, initialBookmakerId]);

  const resetForm = () => {
    setType(initialType || "deposit");
    setAmount("");
    setBookmakerId(initialBookmakerId || "none");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setSourceId("free");
    setDestId(bookmakers.length > 0 ? bookmakers[0].id : "free");
  };

  const getLocationLabel = (id: string) => {
    if (id === "free") return "Saldo Livre";
    const bm = bookmakers.find((b) => b.id === id);
    return bm?.name || "Desconhecido";
  };

  const handleSubmit = async () => {
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error("O valor deve ser maior que zero");
      return;
    }

    if (!date) {
      toast.error("A data é obrigatória");
      return;
    }

    setLoading(true);

    if (type === "transfer") {
      if (sourceId === destId) {
        toast.error("Origem e destino devem ser diferentes");
        setLoading(false);
        return;
      }

      const sourceLabel = getLocationLabel(sourceId);
      const destLabel = getLocationLabel(destId);
      const transferNote = `Transferência: ${sourceLabel} → ${destLabel}${
        notes.trim() ? ` | ${notes.trim()}` : ""
      }`;

      // Atomic insert: withdrawal from source + deposit to destination
      const { error } = await supabase
        .from("bankroll_transactions")
        .insert([
          {
            bankroll_id: bankrollId,
            type: "withdrawal" as const,
            amount: amountVal,
            transaction_date: date,
            bookmaker_id: sourceId === "free" ? null : sourceId,
            notes: transferNote,
          },
          {
            bankroll_id: bankrollId,
            type: "deposit" as const,
            amount: amountVal,
            transaction_date: date,
            bookmaker_id: destId === "free" ? null : destId,
            notes: transferNote,
          },
        ]);

      if (error) {
        toast.error("Erro ao salvar transferência", {
          description: error.message,
        });
        setLoading(false);
        return;
      }

      toast.success(`Transferência de R$ ${amountVal.toFixed(2)} realizada!`, {
        description: `${sourceLabel} → ${destLabel}`,
      });
    } else {
      const transactionPayload = {
        bankroll_id: bankrollId,
        type,
        amount: amountVal,
        transaction_date: date,
        bookmaker_id: bookmakerId === "none" ? null : bookmakerId,
        notes: notes.trim() || null,
      };

      const { error } = await supabase
        .from("bankroll_transactions")
        .insert(transactionPayload);

      if (error) {
        toast.error("Erro ao salvar transação", {
          description: error.message,
        });
        setLoading(false);
        return;
      }

      toast.success(
        type === "deposit" ? "Depósito registrado!" : "Saque registrado!"
      );
    }

    setLoading(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
          <DialogDescription>
            Registre depósitos, saques ou transferências entre contas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Tipo de Transação
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={type === "deposit" ? "default" : "outline"}
                className={
                  type === "deposit"
                    ? "bg-success/20 text-success border-success/30 hover:bg-success/30 font-semibold"
                    : "border-border hover:bg-surface-hover"
                }
                onClick={() => setType("deposit")}
              >
                📥 Depósito
              </Button>
              <Button
                variant={type === "withdrawal" ? "default" : "outline"}
                className={
                  type === "withdrawal"
                    ? "bg-danger/20 text-danger border-danger/30 hover:bg-danger/30 font-semibold"
                    : "border-border hover:bg-surface-hover"
                }
                onClick={() => setType("withdrawal")}
              >
                📤 Saque
              </Button>
              <Button
                variant={type === "transfer" ? "default" : "outline"}
                className={
                  type === "transfer"
                    ? "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 font-semibold"
                    : "border-border hover:bg-surface-hover"
                }
                onClick={() => setType("transfer")}
              >
                🔁 Transferir
              </Button>
            </div>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label
                className="text-xs text-muted-foreground"
                htmlFor="tx-amount"
              >
                Valor (R$)
              </Label>
              <Input
                id="tx-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label
                className="text-xs text-muted-foreground"
                htmlFor="tx-date"
              >
                Data
              </Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          {/* Transfer-specific: Source and Destination */}
          {type === "transfer" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Origem
                  </Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger className="bg-background w-full">
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
                      <SelectItem value="free">💼 Saldo Livre</SelectItem>
                      {bookmakers.map((bm) => (
                        <SelectItem key={bm.id} value={bm.id}>
                          🏦 {bm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-center h-9 px-1">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Destino
                  </Label>
                  <Select value={destId} onValueChange={setDestId}>
                    <SelectTrigger className="bg-background w-full">
                      <SelectValue placeholder="Selecione o destino" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
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

              {sourceId === destId && sourceId !== "" && (
                <p className="text-xs text-danger">
                  Origem e destino devem ser diferentes.
                </p>
              )}
            </div>
          ) : (
            /* Deposit/Withdrawal: Bookmaker Selector */
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Destino/Origem
              </Label>
              <Select value={bookmakerId} onValueChange={setBookmakerId}>
                <SelectTrigger className="bg-background w-full">
                  <SelectValue placeholder="Saldo Livre (Sobrando)" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
                  <SelectItem value="none">💼 Nenhuma (Saldo Livre)</SelectItem>
                  {bookmakers.map((bm) => (
                    <SelectItem key={bm.id} value={bm.id}>
                      🏦 {bm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label
              className="text-xs text-muted-foreground"
              htmlFor="tx-notes"
            >
              Notas
            </Label>
            <Textarea
              id="tx-notes"
              placeholder="Observações sobre a transação..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-background resize-none"
              rows={2}
            />
          </div>

          {/* Submit / Action Buttons */}
          <div className="flex gap-2 w-full pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-2 bg-gradient-action text-white hover:opacity-90 font-semibold"
              disabled={
                loading || (type === "transfer" && sourceId === destId)
              }
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                "Confirmar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
