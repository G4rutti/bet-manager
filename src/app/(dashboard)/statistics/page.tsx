"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronRight } from "lucide-react";
import type { Bankroll } from "@/types";

export default function StatisticsOverviewPage() {
  const [bankrolls, setBankrolls] = useState<Bankroll[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadBankrolls();
  }, []);

  const loadBankrolls = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("bankrolls").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setBankrolls(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Estatísticas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione um bankroll para ver as estatísticas detalhadas
        </p>
      </div>

      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="stat-card animate-pulse">
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))
          : bankrolls.length === 0
          ? (
            <Card className="stat-card">
              <CardContent className="p-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Crie um bankroll para ver estatísticas
                </p>
              </CardContent>
            </Card>
          )
          : bankrolls.map((bankroll) => (
              <Link
                key={bankroll.id}
                href={`/bankrolls/${bankroll.id}/statistics`}
              >
                <Card className="stat-card cursor-pointer mb-3">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{bankroll.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Capital: R$ {bankroll.starting_capital.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))
        }
      </div>
    </div>
  );
}
