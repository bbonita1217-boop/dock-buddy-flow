import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { downloadWarehouseDispatch } from "@/lib/excel";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/board")({
  head: () => ({ meta: [{ title: "창고 일정 보드" }] }),
  component: Board,
});

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function Board() {
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [days, setDays] = useState(7);

  const { data: warehouses } = useQuery({
    queryKey: ["wh-active"],
    queryFn: async () =>
      (await supabase.from("warehouses").select("*").eq("active", true).order("name")).data ?? [],
  });
  const { data: slots } = useQuery({
    queryKey: ["slots"],
    queryFn: async () =>
      (await supabase.from("warehouse_slots").select("*").order("slot_time")).data ?? [],
  });

  const dateList = useMemo(() => {
    return Array.from({ length: days }, (_, i) => fmt(addDays(anchor, i)));
  }, [anchor, days]);

  const { data: containers } = useQuery({
    queryKey: ["board-containers", dateList[0], dateList[dateList.length - 1]],
    queryFn: async () => {
      const { data } = await supabase
        .from("containers")
        .select("*")
        .gte("inbound_date", dateList[0])
        .lte("inbound_date", dateList[dateList.length - 1]);
      return data ?? [];
    },
  });

  const handleDownload = async (whId: string, whName: string) => {
    const { data } = await supabase
      .from("containers")
      .select("*, warehouse:warehouses(name)")
      .eq("warehouse_id", whId)
      .not("inbound_date", "is", null)
      .order("inbound_date")
      .order("inbound_time");
    if (!data || data.length === 0) {
      toast.error("내보낼 배차 데이터가 없습니다");
      return;
    }
    downloadWarehouseDispatch(
      whName,
      data.map((c: any) => ({
        bl_no: c.bl_no,
        container_no: c.container_no,
        item_no: c.item_no,
        description: c.description,
        port: c.port,
        warehouse_name: c.warehouse?.name,
        inbound_date: c.inbound_date,
        inbound_time: c.inbound_time,
        container_size: c.container_size,
        forwarder: c.forwarder,
      })),
    );
    toast.success(`${whName}_배차표.xlsx 다운로드 완료`);
  };

  return (
    <>
      <PageHeader
        title="창고 일정 보드"
        description="창고별 입고 일정을 한눈에 확인하고 배차표를 다운로드하세요"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, -days))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date(new Date().setHours(0, 0, 0, 0)))}>
              오늘
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, days))}>
              <ChevronRight className="size-4" />
            </Button>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
            </select>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        {(warehouses ?? []).map((wh: any) => {
          const whSlots = (slots ?? []).filter((s: any) => s.warehouse_id === wh.id);
          const slotTimes = [...new Set(whSlots.map((s: any) => s.slot_time as string))].sort();
          return (
            <Card key={wh.id} className="overflow-hidden p-0">
              <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-semibold">{wh.name}</h2>
                  <Badge variant="outline">일 최대 {wh.max_daily}대</Badge>
                  <span className="text-xs text-muted-foreground">슬롯 {slotTimes.length}개</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleDownload(wh.id, wh.name)}>
                  <Download className="size-4" />
                  배차표 다운로드
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="text-left px-3 py-2 w-20 border-r sticky left-0 bg-muted/20">
                        시간
                      </th>
                      {dateList.map((d) => {
                        const day = new Date(d).getDay();
                        const isWknd = day === 0 || day === 6;
                        return (
                          <th
                            key={d}
                            className={`text-left px-3 py-2 border-r min-w-[140px] ${
                              isWknd ? "text-red-500 bg-red-50/30" : ""
                            }`}
                          >
                            <div className="font-semibold">{d.slice(5)}</div>
                            <div className="text-[10px] text-muted-foreground">{WEEKDAY[day]}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {slotTimes.map((t) => (
                      <tr key={t} className="border-t">
                        <td className="px-3 py-2 font-mono text-[11px] border-r bg-muted/10 sticky left-0">
                          {t}
                        </td>
                        {dateList.map((d) => {
                          const booked = (containers ?? []).filter(
                            (c: any) =>
                              c.warehouse_id === wh.id &&
                              c.inbound_date === d &&
                              c.inbound_time === t,
                          );
                          return (
                            <td key={d + t} className="border-r p-1.5 align-top">
                              {booked.map((c: any) => (
                                <div
                                  key={c.id}
                                  className={`rounded px-2 py-1 text-[11px] leading-tight mb-1 ${
                                    c.dispatch_status === "MANUAL"
                                      ? "bg-violet-100 text-violet-900 border border-violet-200"
                                      : "bg-sky-100 text-sky-900 border border-sky-200"
                                  }`}
                                  title={`${c.bl_no} · ${c.container_no} · ${c.item_no || ""}`}
                                >
                                  <div className="font-semibold truncate">{c.bl_no}</div>
                                  <div className="text-[10px] opacity-75 truncate">
                                    {c.container_no || c.item_no}
                                  </div>
                                </div>
                              ))}
                              {booked.length === 0 && (
                                <div className="text-[10px] text-muted-foreground/40 px-1">
                                  빈 슬롯
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
        {(warehouses ?? []).length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            등록된 창고가 없습니다. 창고 관리에서 추가해주세요.
          </Card>
        )}
      </div>
    </>
  );
}