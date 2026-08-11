"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Menu,
  BookOpen,
  Tag,
  Trophy,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const mainNav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/bankrolls", label: "Bankrolls", icon: Wallet, exact: false },
  { href: "/statistics", label: "Estatísticas", icon: BarChart3, exact: false },
];

const configNav = [
  { href: "/bookmakers", label: "Bookmakers", icon: BookOpen, exact: true },
  { href: "/categories", label: "Categorias", icon: Tag, exact: true },
  { href: "/competitions", label: "Competições", icon: Trophy, exact: true },
  { href: "/bet-types", label: "Tipos de Aposta", icon: ListChecks, exact: true },
];

const allNav = [...mainNav, ...configNav];

function isNavActive(pathname: string, item: (typeof allNav)[number]) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
}

/** Tracks the active nav link's on-screen position and exposes a style for a
 *  pill that glides between items instead of popping — same spatial anchor,
 *  no re-derivation of the target from scratch on every navigation. */
function useActiveIndicator(pathname: string, collapsed: boolean) {
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [style, setStyle] = useState({ top: 0, height: 0, opacity: 0 });

  const measure = useCallback(() => {
    const active = allNav.find((item) => isNavActive(pathname, item));
    const nav = navRef.current;
    const link = active ? linkRefs.current[active.href] : null;
    if (!nav || !link) {
      setStyle((s) => ({ ...s, opacity: 0 }));
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    setStyle({ top: linkRect.top - navRect.top, height: linkRect.height, opacity: 1 });
  }, [pathname]);

  useLayoutEffect(() => {
    measure();
  }, [measure, collapsed]);

  return { navRef, linkRefs, style };
}

function NavContent({
  pathname,
  collapsed,
  onItemClick,
}: {
  pathname: string;
  collapsed: boolean;
  onItemClick?: () => void;
}) {
  const { navRef, linkRefs, style } = useActiveIndicator(pathname, collapsed);

  const renderItem = (item: (typeof allNav)[number]) => {
    const isActive = isNavActive(pathname, item);
    return (
      <Link
        key={item.href}
        ref={(el) => {
          linkRefs.current[item.href] = el;
        }}
        href={item.href}
        onClick={onItemClick}
        className={`relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 group ${
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
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
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-xl font-semibold tracking-tight text-brand whitespace-nowrap">
            BetManager
          </span>
        )}
      </div>

      <Separator className="bg-border/50" />

      {/* Main Navigation */}
      <nav ref={navRef} className="relative flex-1 p-3 space-y-1">
        {/* Sliding active indicator — glides to the new position instead of popping */}
        <div
          aria-hidden
          className="absolute inset-x-3 rounded-lg bg-primary/10 border border-primary/15 pointer-events-none transition-[top,height,opacity] duration-300"
          style={{ top: style.top, height: style.height, opacity: style.opacity, transitionTimingFunction: "var(--ease-spring)" }}
        />

        <p className={`relative z-10 text-[11px] uppercase tracking-wider text-muted-foreground mb-2 ${collapsed ? "text-center" : "px-3"}`}>
          {collapsed ? "•" : "Menu"}
        </p>
        {mainNav.map(renderItem)}

        <Separator className="relative z-10 bg-border/50 my-3" />

        <p className={`relative z-10 text-[11px] uppercase tracking-wider text-muted-foreground mb-2 ${collapsed ? "text-center" : "px-3"}`}>
          {collapsed ? "•" : "Configuração"}
        </p>
        {configNav.map(renderItem)}
      </nav>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar — translucent material, recedes behind content */}
      <aside
        className={`hidden lg:flex flex-col border-r border-sidebar-border material-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] relative ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        <NavContent pathname={pathname} collapsed={collapsed} />
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
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-sidebar-border material-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-brand">
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
              <NavContent
                pathname={pathname}
                collapsed={false}
                onItemClick={() => setMobileOpen(false)}
              />
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
