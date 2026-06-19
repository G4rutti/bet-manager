"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Wallet,
  Settings,
  BarChart3,
  LogOut,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  BookOpen,
  Tag,
  Trophy,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bankrolls", label: "Bankrolls", icon: Wallet },
  { href: "/statistics", label: "Estatísticas", icon: BarChart3 },
];

const configNav = [
  { href: "/bookmakers", label: "Bookmakers", icon: BookOpen },
  { href: "/categories", label: "Categorias", icon: Tag },
  { href: "/competitions", label: "Competições", icon: Trophy },
  { href: "/bet-types", label: "Tipos de Aposta", icon: ListChecks },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();



  const NavContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-action flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-xl font-bold text-gradient-neon whitespace-nowrap">
            BetManager
          </span>
        )}
      </div>

      <Separator className="bg-border/50" />

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <p className={`text-[11px] uppercase tracking-wider text-muted-foreground mb-2 ${collapsed ? "text-center" : "px-3"}`}>
          {collapsed ? "•" : "Menu"}
        </p>
        {mainNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? "text-primary" : "group-hover:text-foreground"
                }`}
              />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}

        <Separator className="bg-border/50 my-3" />

        <p className={`text-[11px] uppercase tracking-wider text-muted-foreground mb-2 ${collapsed ? "text-center" : "px-3"}`}>
          {collapsed ? "•" : "Configuração"}
        </p>
        {configNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isActive ? "text-primary" : "group-hover:text-foreground"
                }`}
              />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>


    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-border/50 bg-sidebar transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        <NavContent />
        <div className="absolute bottom-16 -right-3 z-10 hidden lg:block">
          <Button
            variant="outline"
            size="icon"
            className="w-6 h-6 rounded-full bg-sidebar border-border/50"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronLeft className="w-3 h-3" />
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-sidebar">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-action flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gradient-neon">
              BetManager
            </span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 bg-sidebar">
              <NavContent onItemClick={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
