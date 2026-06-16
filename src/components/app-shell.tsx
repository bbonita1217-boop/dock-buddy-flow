import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Container,
  CalendarRange,
  Warehouse,
  Settings2,
  Users,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "대시보드", icon: LayoutDashboard },
  { to: "/board", label: "창고 일정 보드", icon: CalendarRange },
  { to: "/containers", label: "컨테이너", icon: Container },
  { to: "/upload", label: "엑셀 업로드", icon: Upload },
  { to: "/warehouses", label: "창고 관리", icon: Warehouse },
  { to: "/rules", label: "고객사 규칙", icon: Settings2 },
  { to: "/customers", label: "고객사", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="text-[15px] font-semibold tracking-tight">컨테이너 배차</div>
          <div className="text-[11px] text-sidebar-foreground/60 mt-0.5">Auto Dispatch System</div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 text-[10px] text-sidebar-foreground/40 border-t border-sidebar-border">
          v1.0
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-5 border-b border-border bg-card">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}