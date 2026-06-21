import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function WarehousesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [maxDaily, setMaxDaily] = useState(8);

  const { data: warehouses } = useQuery({
    queryKey: ["wh-all"],
    queryFn: async () => (await supabase.from("warehouses").select("*").order("name")).data ?? [],
  });
  const { data: slots } = useQuery({
    queryKey: ["slots-all"],
    queryFn: async () =>
      (await supabase.from("warehouse_slots").select("*").order("slot_time")).data ?? [],
  });

  async function addWarehouse() {
    if (!name.trim()) return;
    const { error } = await supabase.from("warehouses").insert({ name: name.trim(), max_daily: maxDaily });
    if (error) toast.error(error.message);
    else {
      setName("");
      qc.invalidateQueries({ queryKey: ["wh-all"] });
    }
  }

  async function updateWh(id: string, patch: any) {
    await supabase.from("warehouses").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["wh-all"] });
  }

  async function delWh(id: string) {
    if (!confirm("삭제하시겠습니까? 슬롯도 함께 삭제됩니다.")) return;
    await supabase.from("warehouses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["wh-all"] });
  }

  async function addSlot(whId: string, time: string) {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      toast.error("HH:MM 형식으로 입력해주세요");
      return;
    }
    await supabase.from("warehouse_slots").insert({ warehouse_id: whId, slot_time: time });
    qc.invalidateQueries({ queryKey: ["slots-all"] });
  }

  async function delSlot(id: string) {
    await supabase.from("warehouse_slots").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["slots-all"] });
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 flex gap-2 items-end">
        <div className="flex-1 max-w-xs">
          <label className="text-xs text-muted-foreground">창고명</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 양지창고" />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground">일 최대</label>
          <Input
            type="number"
            value={maxDaily}
            onChange={(e) => setMaxDaily(Number(e.target.value))}
          />
        </div>
        <Button onClick={addWarehouse}>
          <Plus className="size-4" /> 추가
        </Button>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(warehouses ?? []).map((w: any) => {
          const whSlots = (slots ?? []).filter((s: any) => s.warehouse_id === w.id);
          return (
            <Card key={w.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">창고명</label>
                    <Input
                      defaultValue={w.name}
                      onBlur={(e) =>
                        e.target.value !== w.name && updateWh(w.id, { name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">일 최대 차량</label>
                    <Input
                      type="number"
                      defaultValue={w.max_daily}
                      onBlur={(e) =>
                        Number(e.target.value) !== w.max_daily &&
                        updateWh(w.id, { max_daily: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => delWh(w.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">시간 슬롯</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {whSlots.map((s: any) => (
                    <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
                      {s.slot_time}
                      <button
                        onClick={() => delSlot(s.id)}
                        className="hover:bg-destructive/20 rounded-full p-0.5"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  {whSlots.length === 0 && (
                    <span className="text-xs text-muted-foreground">슬롯이 없습니다</span>
                  )}
                </div>
                <SlotAdder onAdd={(t) => addSlot(w.id, t)} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SlotAdder({ onAdd }: { onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        placeholder="HH:MM"
        value={t}
        onChange={(e) => setT(e.target.value)}
        className="max-w-[100px] h-8 text-xs"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          onAdd(t);
          setT("");
        }}
      >
        <Plus className="size-3" /> 슬롯
      </Button>
    </div>
  );
}