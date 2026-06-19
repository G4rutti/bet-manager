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
import { Plus, Search, MoreVertical, Pencil, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { Bookmaker } from "@/types";

export default function BookmakersPage() {
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadBookmakers();
  }, []);

  const loadBookmakers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("bookmakers")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    if (data) setBookmakers(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      const { error } = await supabase
        .from("bookmakers")
        .update({ name: formName.trim() })
        .eq("id", editingId);

      if (error) {
        toast.error("Erro ao atualizar bookmaker");
        return;
      }
      toast.success("Bookmaker atualizado!");
    } else {
      const { error } = await supabase.from("bookmakers").insert({
        user_id: user.id,
        name: formName.trim(),
        active: true,
      });

      if (error) {
        toast.error("Erro ao criar bookmaker");
        return;
      }
      toast.success("Bookmaker adicionado!");
    }

    setDialogOpen(false);
    setFormName("");
    setEditingId(null);
    loadBookmakers();
  };

  const handleEdit = (bm: Bookmaker) => {
    setEditingId(bm.id);
    setFormName(bm.name);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("bookmakers").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao deletar", {
        description: "Bookmaker pode estar vinculado a apostas",
      });
      return;
    }
    toast.success("Bookmaker removido");
    loadBookmakers();
  };

  const filtered = bookmakers.filter((bm) =>
    bm.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-green rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Bookmakers</h1>
        <p className="text-white/80 text-sm mb-4">
          Gerencie suas casas de apostas favoritas
        </p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setFormName("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar bookmaker
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar" : "Adicionar"} Bookmaker
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Atualize o nome do bookmaker"
                  : "Adicione uma nova casa de apostas"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="bm-name">Nome</Label>
                <Input
                  id="bm-name"
                  placeholder="Ex: Bet365, Betano..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="bg-background"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-gradient-action text-white hover:opacity-90"
                >
                  {editingId ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar bookmaker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} bookmaker{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="stat-card animate-pulse">
              <CardContent className="p-4">
                <div className="h-5 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <Card className="stat-card">
            <CardContent className="p-8 text-center">
              <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search
                  ? "Nenhum bookmaker encontrado"
                  : "Nenhum bookmaker cadastrado"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((bm) => (
            <Card key={bm.id} className="stat-card">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="font-medium">{bm.name}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem onClick={() => handleEdit(bm)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-danger focus:text-danger"
                      onClick={() => handleDelete(bm.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
