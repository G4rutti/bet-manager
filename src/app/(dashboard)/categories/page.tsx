"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState("#00ffb7");
  const supabase = createClient();

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("categories").select("*").eq("user_id", user.id).order("name");
    if (data) setItems(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      await supabase.from("categories").update({ name: formName.trim(), color: formColor }).eq("id", editingId);
      toast.success("Categoria atualizada!");
    } else {
      await supabase.from("categories").insert({ user_id: user.id, name: formName.trim(), color: formColor });
      toast.success("Categoria adicionada!");
    }
    setDialogOpen(false); setFormName(""); setFormColor("#00ffb7"); setEditingId(null); loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Categoria removida"); loadItems();
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-green rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Categorias</h1>
        <p className="text-white/80 text-sm mb-4">Organize suas apostas por categoria</p>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setFormName(""); } }}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
              <Plus className="w-4 h-4 mr-2" />Adicionar categoria
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar" : "Adicionar"} Categoria</DialogTitle>
              <DialogDescription>Categorize suas apostas para análise</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Ex: Value Bet, Fun Bet..." value={formName} onChange={(e) => setFormName(e.target.value)} className="bg-background" onKeyDown={(e) => e.key === "Enter" && handleSave()} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                  <Input value={formColor} onChange={(e) => setFormColor(e.target.value)} className="bg-background flex-1" />
                </div>
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
          <Card className="stat-card"><CardContent className="p-8 text-center"><Tag className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">Nenhuma categoria</p></CardContent></Card>
        ) : filtered.map((item) => (
          <Card key={item.id} className="stat-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-medium">{item.name}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  <DropdownMenuItem onClick={() => { setEditingId(item.id); setFormName(item.name); setFormColor(item.color); setDialogOpen(true); }}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
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
