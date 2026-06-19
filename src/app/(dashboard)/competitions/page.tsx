"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, MoreVertical, Pencil, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Competition } from "@/types";

export default function CompetitionsPage() {
  const [items, setItems] = useState<Competition[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formSport, setFormSport] = useState("Football");
  const supabase = createClient();

  const sports = ["Football", "Basketball", "Tennis", "MMA", "Boxing", "Volleyball", "E-sports", "Baseball", "Hockey", "Other"];

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("competitions").select("*").eq("user_id", user.id).order("name");
    if (data) setItems(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      await supabase.from("competitions").update({ name: formName.trim(), sport: formSport }).eq("id", editingId);
      toast.success("Competição atualizada!");
    } else {
      await supabase.from("competitions").insert({ user_id: user.id, name: formName.trim(), sport: formSport });
      toast.success("Competição adicionada!");
    }
    setDialogOpen(false); setFormName(""); setFormSport("Football"); setEditingId(null); loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("competitions").delete().eq("id", id);
    toast.success("Competição removida"); loadItems();
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-green rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Competições</h1>
        <p className="text-white/80 text-sm mb-4">Organize por liga ou torneio</p>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setFormName(""); } }}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0"><Plus className="w-4 h-4 mr-2" />Adicionar competição</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Adicionar"} Competição</DialogTitle>
              <DialogDescription>Filtre por ligas e eventos</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Ex: Premier League, NBA..." value={formName} onChange={(e) => setFormName(e.target.value)} className="bg-background" onKeyDown={(e) => e.key === "Enter" && handleSave()} />
              </div>
              <div className="space-y-2">
                <Label>Esporte</Label>
                <Select value={formSport} onValueChange={setFormSport}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {sports.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-gradient-action text-white hover:opacity-90">{editingId ? "Salvar" : "Adicionar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length}</span>
      </div>

      <div className="space-y-2">
        {loading ? Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="stat-card animate-pulse"><CardContent className="p-4"><div className="h-5 bg-muted rounded w-1/3" /></CardContent></Card>
        )) : filtered.length === 0 ? (
          <Card className="stat-card"><CardContent className="p-8 text-center"><Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">Nenhuma competição</p></CardContent></Card>
        ) : filtered.map((item) => (
          <Card key={item.id} className="stat-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground bg-surface px-2 py-0.5 rounded">{item.sport}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem onClick={() => { setEditingId(item.id); setFormName(item.name); setFormSport(item.sport); setDialogOpen(true); }}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                  <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
