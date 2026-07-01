"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Wallet, Clock, Settings, Archive, ArchiveRestore } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { BankrollWithStats, Bookmaker } from "@/types";

export default function BankrollsPage() {
  const [bankrolls, setBankrolls] = useState<BankrollWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    starting_capital: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  });
  const [activeBookmakers, setActiveBookmakers] = useState<Bookmaker[]>([]);
  const [showAllocations, setShowAllocations] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const supabase = createClient();

  useEffect(() => {
    loadBankrolls();
    loadBookmakers();
  }, []);

  const loadBookmakers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bookmakers")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("name");

    if (data) {
      setActiveBookmakers(data);
    }
  };

  const totalAllocated = Object.values(allocations).reduce((sum, val) => {
    const num = parseFloat(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const startingCapitalNum = parseFloat(formData.starting_capital) || 0;
  const remainingBalance = startingCapitalNum - totalAllocated;

  const handleToggleArchive = async (bankrollId: string, currentStatus: string, e: React.MouseEvent) => {
    e.preventDefault();
    const newStatus = currentStatus === "archived" ? "active" : "archived";
    // Optimistic update
    setBankrolls((prev) =>
      prev.map((b) => b.id === bankrollId ? { ...b, status: newStatus as "active" | "archived" } : b)
    );
    const { error } = await supabase
      .from("bankrolls")
      .update({ status: newStatus })
      .eq("id", bankrollId);
    if (error) {
      toast.error("Erro ao atualizar bankroll");
      // Revert on error
      setBankrolls((prev) =>
        prev.map((b) => b.id === bankrollId ? { ...b, status: currentStatus as "active" | "archived" } : b)
      );
    } else {
      toast.success(newStatus === "archived" ? "Bankroll arquivado!" : "Bankroll reativado!");
    }
  };

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
          const progression =
            bankroll.starting_capital > 0
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

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.starting_capital) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const startingCapitalNum = parseFloat(formData.starting_capital);
    if (isNaN(startingCapitalNum) || startingCapitalNum <= 0) {
      toast.error("O capital inicial deve ser maior que zero");
      return;
    }

    if (showAllocations && remainingBalance < 0) {
      toast.error("A soma do capital alocado nas casas excede o capital inicial");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newBankroll, error } = await supabase
      .from("bankrolls")
      .insert({
        user_id: user.id,
        name: formData.name.trim(),
        starting_capital: startingCapitalNum,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: "active",
      })
      .select()
      .single();

    if (error || !newBankroll) {
      toast.error("Erro ao criar bankroll");
      return;
    }

    // Insert allocation transactions if any
    if (showAllocations && Object.keys(allocations).length > 0) {
      const txsToInsert = [];
      for (const [bmId, amountStr] of Object.entries(allocations)) {
        const amountVal = parseFloat(amountStr);
        if (isNaN(amountVal) || amountVal <= 0) continue;
        const bm = activeBookmakers.find((b) => b.id === bmId);
        const bmName = bm ? bm.name : "Casa";
        const transferNote = `Transferência: Saldo Livre → ${bmName} | Saldo Inicial`;

        txsToInsert.push(
          {
            bankroll_id: newBankroll.id,
            type: "withdrawal" as const,
            amount: amountVal,
            transaction_date: formData.start_date,
            bookmaker_id: null,
            notes: transferNote,
          },
          {
            bankroll_id: newBankroll.id,
            type: "deposit" as const,
            amount: amountVal,
            transaction_date: formData.start_date,
            bookmaker_id: bmId,
            notes: transferNote,
          }
        );
      }

      if (txsToInsert.length > 0) {
        const { error: txError } = await supabase
          .from("bankroll_transactions")
          .insert(txsToInsert);
        if (txError) {
          toast.error("Bankroll criado, mas erro ao registrar saldos iniciais");
        }
      }
    }

    toast.success("Bankroll criado com sucesso!");
    setDialogOpen(false);
    setShowAllocations(false);
    setAllocations({});
    setFormData({
      name: "",
      starting_capital: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
    });
    loadBankrolls();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bankrolls</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie seus bankrolls por período
          </p>
        </div>
      </div>

      {/* Bankrolls List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="stat-card animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-muted rounded w-1/2 mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 bg-muted rounded" />
                  <div className="h-16 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {bankrolls.map((bankroll) => (
            <Link
              key={bankroll.id}
              href={`/bankrolls/${bankroll.id}`}
            >
              <Card className="stat-card cursor-pointer mb-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      {bankroll.name}
                      {bankroll.status === "archived" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                          <Archive className="w-2.5 h-2.5" />
                          Arquivado
                        </span>
                      )}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-surface-hover"
                          onClick={(e) => e.preventDefault()}
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border min-w-[180px]">
                        <DropdownMenuItem
                          className={`gap-2 cursor-pointer text-sm ${
                            bankroll.status === "archived"
                              ? "text-success focus:text-success focus:bg-success/10"
                              : "text-warning focus:text-warning focus:bg-warning/10"
                          }`}
                          onClick={(e) => handleToggleArchive(bankroll.id, bankroll.status, e)}
                        >
                          {bankroll.status === "archived" ? (
                            <><ArchiveRestore className="w-4 h-4" /> Reativar bankroll</>
                          ) : (
                            <><Archive className="w-4 h-4" /> Arquivar bankroll</>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface rounded-lg p-4 text-center">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                        ROI
                      </p>
                      <p
                        className={`text-xl font-bold tabular-nums ${
                          bankroll.roi >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        {bankroll.roi.toFixed(2)}%
                      </p>
                    </div>
                    <div className="bg-surface rounded-lg p-4 text-center">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">
                        PROGRESSION
                      </p>
                      <p
                        className={`text-xl font-bold tabular-nums ${
                          bankroll.progression >= 0
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {bankroll.progression.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  {bankroll.pendingBets > 0 && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-warning bg-warning/10 rounded-lg py-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{bankroll.pendingBets} apostas pendentes</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Add bankroll */}
          {/* Add bankroll */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setShowAllocations(false);
              setAllocations({});
            }
          }}>
            <DialogTrigger asChild>
              <Card className="stat-card cursor-pointer border-dashed border-2 border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-8 flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Plus className="w-7 h-7 text-primary" />
                  </div>
                  <p className="font-medium text-muted-foreground">
                    Adicionar bankroll
                  </p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Novo Bankroll</DialogTitle>
                <DialogDescription>
                  Crie um novo bankroll para organizar suas apostas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="br-name">Nome</Label>
                  <Input
                    id="br-name"
                    placeholder="Ex: Jan/Fev 2026"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-capital">Capital Inicial (R$)</Label>
                  <Input
                    id="br-capital"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 1000"
                    value={formData.starting_capital}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        starting_capital: e.target.value,
                      }))
                    }
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="br-start">Data Início</Label>
                    <Input
                      id="br-start"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          start_date: e.target.value,
                        }))
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="br-end">Data Fim (opcional)</Label>
                    <Input
                      id="br-end"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          end_date: e.target.value,
                        }))
                      }
                      className="bg-background"
                    />
                  </div>
                </div>

                {activeBookmakers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold cursor-pointer" htmlFor="toggle-allocations">
                        Distribuir capital inicial entre as casas?
                      </Label>
                      <input
                        id="toggle-allocations"
                        type="checkbox"
                        checked={showAllocations}
                        onChange={(e) => {
                          setShowAllocations(e.target.checked);
                          if (!e.target.checked) setAllocations({});
                        }}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                    </div>
                    
                    {showAllocations && (
                      <div className="space-y-2.5 bg-surface/50 p-3 rounded-lg border border-border/35 max-h-48 overflow-y-auto">
                        <p className="text-[11px] text-muted-foreground mb-1.5">
                          Defina o saldo inicial em cada casa. O restante ficará como Banca Livre.
                        </p>
                        <div className="space-y-2">
                          {activeBookmakers.map((bm) => (
                            <div key={bm.id} className="flex items-center gap-3">
                              <span className="text-xs font-medium text-foreground w-1/3 truncate" title={bm.name}>
                                {bm.name}
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="R$ 0,00"
                                value={allocations[bm.id] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAllocations((prev) => ({
                                    ...prev,
                                    [bm.id]: val,
                                  }));
                                }}
                                className="bg-background h-8 text-xs flex-1"
                              />
                            </div>
                          ))}
                        </div>
                        
                        <div className="border-t border-border/30 pt-2 flex flex-col gap-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Distribuído:</span>
                            <span className="font-semibold text-success">
                              R$ {totalAllocated.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Banca Livre restante:</span>
                            <span className={`font-semibold ${remainingBalance < 0 ? "text-danger" : "text-muted-foreground"}`}>
                              R$ {remainingBalance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setDialogOpen(false);
                      setShowAllocations(false);
                      setAllocations({});
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreate}
                    className="bg-gradient-action text-white hover:opacity-90"
                    disabled={showAllocations && remainingBalance < 0}
                  >
                    Criar Bankroll
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Bottom bar for mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-action">
        <Button
          className="w-full text-white font-semibold py-6 bg-transparent hover:bg-white/10"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-5 h-5 mr-2" />
          Adicionar bankroll
        </Button>
      </div>
    </div>
  );
}
