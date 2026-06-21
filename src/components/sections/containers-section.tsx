import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ContainersSection() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>("ALL");

  const { data: warehouses } = useQuery({
    queryKey: ["wh"],
    queryFn: async () => (await supabase.from("warehouses").select("*").order("name")).data ?? [],
  });
  const { data: slots } = useQuery({
    queryKey: ["slots"],
    queryFn: async () => (await supabase.from("warehouse_slots").select("*").order("slot_time")).data ?? [],
  });

  const { data } = useQuery({
    queryKey: ["containers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("containers")
        .select("*, warehouse:warehouses(name), customer:customers(name)")
        .order("eta", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let r = (data || []) as any[];
    if (statusF !== "ALL") r = r.filter((c) => c.dispatch_status === statusF);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter(
        (c) =>
          (c.bl_no || "").toLowerCase().includes(s) ||
          (c.container_no || "").toLowerCase().includes(s) ||
          (c.item_no || "").toLowerCase().includes(s) ||
          (c.customer?.name || "").toLowerCase().includes(s),
      );
    }
    return r;
  }, [data, q, statusF]);

  async function updateContainer(id: string, patch: any) {
    const { error } = await supabase
      .from("containers")
      .update({ ...patch, dispatch_status: "MANUAL" })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("수정 완료 (MANUAL)");
      qc.invalidateQueries({ queryKey: ["containers"] });
    }
  }

  async function del(id: string) {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("containers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["containers"] });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="BL / Container / Item / 고객사 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusF}
          onChange={(e) => setStatusF(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="ALL">전체 상태</option>
          <option value="PENDING">PENDING</option>
          <option value="AUTO">AUTO</option>
          <option value="MANUAL">MANUAL</option>
        </select>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length}건</div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <Th>고객사</Th><Th>BL NO</Th><Th>Container</Th><Th>SBU</Th><Th>Item</Th>
                <Th>ETA</Th><Th>통관일</Th><Th>입항지</Th><Th>창고</Th><Th>입고일</Th>
                <Th>시간</Th><Th>상태</Th><Th>{" "}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => {
                const whSlots = (slots ?? []).filter((s: any) => s.warehouse_id === c.warehouse_id);
                const slotTimes = [...new Set(whSlots.map((s: any) => s.slot_time as string))].sort();
                return (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <Td>{c.customer?.name}</Td>
                    <Td>{c.bl_no}</Td>
                    <Td className="font-mono text-xs">{c.container_no}</Td>
                    <Td>{c.sbu}</Td>
                    <Td className="font-mono text-xs">{c.item_no}</Td>
                    <Td>{c.eta}</Td>
                    <Td>{c.customs_clear_date}</Td>
                    <Td>{c.port}</Td>
                    <td className="px-2 py-1.5">
                      <select
                        value={c.warehouse_id || ""}
                        onChange={(e) => updateContainer(c.id, { warehouse_id: e.target.value || null })}
                        className="h-7 text-xs rounded border bg-background px-1.5 min-w-[100px]"
                      >
                        <option value="">-</option>
                        {(warehouses ?? []).map((w: any) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={c.inbound_date || ""}
                        onChange={(e) => updateContainer(c.id, { inbound_date: e.target.value || null })}
                        className="h-7 text-xs rounded border bg-background px-1.5"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={c.inbound_time || ""}
                        onChange={(e) => updateContainer(c.id, { inbound_time: e.target.value || null })}
                        className="h-7 text-xs rounded border bg-background px-1.5"
                      >
                        <option value="">-</option>
                        {slotTimes.map((t) => (<option key={t} value={t}>{t}</option>))}
                        {c.inbound_time && !slotTimes.includes(c.inbound_time) && (
                          <option value={c.inbound_time}>{c.inbound_time}</option>
                        )}
                      </select>
                    </td>
                    <Td><StatusBadge status={c.dispatch_status} /></Td>
                    <td className="px-2 py-1.5">
                      <Button size="sm" variant="ghost" onClick={() => del(c.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-sm text-muted-foreground">
                    데이터가 없습니다. 업로드 탭에서 데이터를 등록해주세요.
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

function StatusBadge({ status }: { status: string }) {
  if (status === "AUTO")
    return <Badge className="bg-sky-100 text-sky-700 border-sky-200 border">AUTO</Badge>;
  if (status === "MANUAL")
    return <Badge className="bg-violet-100 text-violet-700 border-violet-200 border">MANUAL</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">PENDING</Badge>;
}

const Th = ({ children }: { children: any }) => (
  <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{children}</th>
);
const Td = ({ children, className = "" }: { children: any; className?: string }) => (
  <td className={`px-3 py-2 whitespace-nowrap ${className}`}>{children ?? "-"}</td>
);