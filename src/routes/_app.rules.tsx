import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/rules")({
  head: () => ({ meta: [{ title: "고객사 규칙" }] }),
  component: RulesPage,
});

const TEMPLATES: Record<string, any> = {
  port: {
    type: "item_prefix",
    mappings: [{ prefixes: ["FNB", "R5C", "5H"], port: "INCHEON" }],
    default: "BUSAN",
  },
  warehouse: {
    type: "sbu",
    mappings: [{ values: ["PD"], warehouse_id: "<PD창고 ID>" }],
    default_warehouse_id: "<양지창고 ID>",
  },
  customs: {
    use_declared_date: true,
    skip_weekends: true,
    customs_days_after_eta: 0,
    inbound_days_after_customs: 1,
  },
  inbound: { note: "추가 입고 규칙 (예약)" },
};

function RulesPage() {
  const qc = useQueryClient();
  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });
  const { data: rules } = useQuery({
    queryKey: ["rules"],
    queryFn: async () =>
      (await supabase.from("customer_rules").select("*").order("priority")).data ?? [],
  });
  const { data: warehouses } = useQuery({
    queryKey: ["wh-list"],
    queryFn: async () => (await supabase.from("warehouses").select("id,name").order("name")).data ?? [],
  });

  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [newType, setNewType] = useState<"port" | "warehouse" | "customs" | "inbound">("port");

  async function addRule() {
    const { error } = await supabase.from("customer_rules").insert({
      customer_id: selectedCustomer || null,
      rule_type: newType,
      config: TEMPLATES[newType],
      priority: 0,
      active: true,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("규칙 추가됨");
      qc.invalidateQueries({ queryKey: ["rules"] });
    }
  }

  async function saveRule(id: string, config: any) {
    const { error } = await supabase.from("customer_rules").update({ config }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("저장됨");
      qc.invalidateQueries({ queryKey: ["rules"] });
    }
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("customer_rules").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["rules"] });
  }

  async function del(id: string) {
    if (!confirm("규칙을 삭제하시겠습니까?")) return;
    await supabase.from("customer_rules").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["rules"] });
  }

  return (
    <>
      <PageHeader
        title="고객사 규칙"
        description="입항지·창고·통관 결정 규칙을 룰 엔진 형태로 관리합니다"
      />
      <div className="p-8 space-y-6">
        <Card className="p-4 flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground">고객사</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="block h-9 rounded-md border bg-background px-3 text-sm min-w-[200px]"
            >
              <option value="">전체 공통</option>
              {(customers ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">규칙 종류</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="block h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="port">입항지 결정</option>
              <option value="warehouse">창고 결정</option>
              <option value="customs">통관 규칙</option>
              <option value="inbound">입고 규칙</option>
            </select>
          </div>
          <Button onClick={addRule}>
            <Plus className="size-4" /> 규칙 추가
          </Button>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-2">창고 ID 참조 (warehouse rule 작성 시 사용)</h3>
          <div className="space-y-1 text-xs font-mono">
            {(warehouses ?? []).map((w: any) => (
              <div key={w.id} className="flex gap-3">
                <span className="text-muted-foreground w-32">{w.name}</span>
                <span>{w.id}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          {(rules ?? []).map((r: any) => {
            const cust = (customers ?? []).find((c: any) => c.id === r.customer_id);
            return (
              <RuleCard
                key={r.id}
                rule={r}
                customerName={cust?.name || "전체 공통"}
                onSave={(cfg) => saveRule(r.id, cfg)}
                onToggle={(a) => toggle(r.id, a)}
                onDelete={() => del(r.id)}
              />
            );
          })}
          {(rules ?? []).length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              규칙이 없습니다. 위에서 추가해주세요.
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function RuleCard({
  rule,
  customerName,
  onSave,
  onToggle,
  onDelete,
}: {
  rule: any;
  customerName: string;
  onSave: (cfg: any) => void;
  onToggle: (a: boolean) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(JSON.stringify(rule.config, null, 2));
  const [err, setErr] = useState("");

  function save() {
    try {
      const cfg = JSON.parse(text);
      setErr("");
      onSave(cfg);
    } catch (e: any) {
      setErr("JSON 오류: " + e.message);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{customerName}</Badge>
          <Badge>{ruleLabel(rule.rule_type)}</Badge>
          {!rule.active && <Badge variant="secondary">비활성</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onToggle(!rule.active)}>
            {rule.active ? "비활성화" : "활성화"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="font-mono text-xs min-h-[140px]"
      />
      {err && <p className="text-xs text-destructive mt-2">{err}</p>}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={save}>
          <Save className="size-3.5" /> 저장
        </Button>
      </div>
    </Card>
  );
}

function ruleLabel(t: string) {
  return { port: "입항지", warehouse: "창고", customs: "통관", inbound: "입고" }[t] || t;
}