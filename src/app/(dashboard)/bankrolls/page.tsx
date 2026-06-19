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
import { Plus, Wallet, Clock, Settings } from "lucide-react";
import { toast } from "sonner";
import type { BankrollWithStats } from "@/types";

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("bankrolls").insert({
      user_id: user.id,
      name: formData.name.trim(),
      starting_capital: parseFloat(formData.starting_capital),
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      status: "active",
    });

    if (error) {
      toast.error("Erro ao criar bankroll");
      return;
    }

    toast.success("Bankroll criado com sucesso!");
    setDialogOpen(false);
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
                    <CardTitle className="text-lg font-semibold">
                      {bankroll.name}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.preventDefault();
                        // TODO: settings
                      }}
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </Button>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreate}
                    className="bg-gradient-action text-white hover:opacity-90"
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
