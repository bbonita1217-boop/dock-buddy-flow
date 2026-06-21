import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CalendarRange, AlertTriangle, Ship, Truck, Clock } from "lucide-react";
import { applyAutoDispatch } from "@/lib/dispatch";
import { toast } from "sonner";
import { useState } from "react";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function DashboardSection() {
  const [running, setRunning] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["dash-containers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("containers")
        .select("*, warehouse:warehouses(name), customer:customers(name)")
        .order("eta", { ascending: true });
      return data ?? [];
    },
  });

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const containers = (data || []) as any[];
  const todayEta = containers.filter((c) => c.eta === todayStr).length;
  const pending = containers.filter(
    (c) => (c.shipment_mode || "").toUpperCase().includes("SEA") && c.dispatch_status === "PENDING",
  );
  const weekIn = containers.filter((c) => {
    if (!c.inbound_date) return false;
    const d = new Date(c.inbound_date);
    return d >= weekStart && d < weekEnd;
  }).length;
  const expiring = containers.filter((c) => {
    if (!c.return_deadline) return false;
    const days = (new Date(c.return_deadline).getTime() - today.getTime()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;

  async function onRun() {
    setRunning(true);
    try {
      const r = await applyAutoDispatch(supabase as any);
      toast.success(`자동 배차 완료 · 배정 ${r.placed} · 대기 ${r.failed}`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "배차 실패");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={onRun} disabled={running}>
          <Play className="size-4" /> {running ? "배차 중..." : "자동 배차 실행"}
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Kpi icon={Ship} label="오늘 입항 예정" value={todayEta} tone="info" />
        <Kpi icon={Truck} label="배차 필요" value={pending.length} tone="warning" />
        <Kpi icon={CalendarRange} label="금주 입고 예정" value={weekIn} tone="primary" />
        <Kpi icon={AlertTriangle} label="반출기한 임박 (7일)" value={expiring} tone="destructive" />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-sm font-semibold">배차 대기 리스트</h2>
            <p className="text-xs text-muted-foreground">SEA 컨테이너 중 배차되지 않은 건</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <Th>BL NO</Th><Th>Container No</Th><Th>고객사</Th><Th>SBU</Th>
                <Th>Item No</Th><Th>ETA</Th><Th>창고</Th><Th>추천 입고일</Th><Th>상태</Th>
              </tr>
            </thead>
            <tbody>
              {pending.slice(0, 15).map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <Td>{c.bl_no}</Td>
                  <Td>{c.container_no}</Td>
                  <Td>{c.customer?.name}</Td>
                  <Td>{c.sbu}</Td>
                  <Td>{c.item_no}</Td>
                  <Td>{c.eta}</Td>
                  <Td>{c.warehouse?.name || "-"}</Td>
                  <Td>{c.inbound_date || "-"}</Td>
                  <Td>
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                      <Clock className="size-3" /> PENDING
                    </Badge>
                  </Td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                    배차 대기 중인 컨테이너가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "primary" | "warning" | "info" | "destructive";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-700",
    info: "bg-sky-100 text-sky-700",
    destructive: "bg-red-100 text-red-700",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-3xl font-semibold mt-1 tracking-tight">{value}</div>
        </div>
        <div className={`size-10 rounded-md flex items-center justify-center ${toneCls}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

const Th = ({ children }: { children: any }) => (
  <th className="text-left font-medium px-4 py-2.5 whitespace-nowrap">{children}</th>
);
const Td = ({ children }: { children: any }) => (
  <td className="px-4 py-2.5 whitespace-nowrap">{children ?? "-"}</td>
);