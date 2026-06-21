import type { ReactNode } from "react";
import { Container } from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-14 shrink-0 border-b bg-card flex items-center px-6 gap-3">
        <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Container className="size-4" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight leading-none">컨테이너 배차</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Auto Dispatch System</div>
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground">v1.0</div>
      </header>
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