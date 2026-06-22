import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, ChevronDown, Warehouse as WarehouseIcon } from "lucide-react";
import { toast } from "sonner";

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

export function RulesSection() {
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
  const { data: sbuRows } = useQuery({
    queryKey: ["distinct-sbu"],
    queryFn: async () => {
      const { data } = await supabase
        .from("containers")
        .select("sbu")
        .not("sbu", "is", null);
      return data ?? [];
    },
  });
  const sbuList = useMemo(() => {
    const set = new Set<string>();
    for (const r of sbuRows ?? []) {
      const v = String((r as any).sbu ?? "").trim();
      if (v) set.add(v);
    }
    return [...set].sort();
  }, [sbuRows]);

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
    <div className="space-y-6">
      <SbuWarehouseCard
        sbuList={sbuList}
        warehouses={warehouses ?? []}
        rules={rules ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["rules"] })}
      />

      <Collapsible>
        <Card className="p-0 overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">고급 설정 (JSON 직접 편집)</span>
              <span className="text-xs text-muted-foreground">
                입항지·통관·입고 규칙, 고객사별 규칙 등
              </span>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-5 space-y-6">
              <AdvancedRulesEditor
                customers={customers ?? []}
                rules={rules ?? []}
                warehouses={warehouses ?? []}
                qc={qc}
              />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

// ---------- SBU → Warehouse mapping card ----------

function SbuWarehouseCard({
  sbuList,
  warehouses,
  rules,
  onSaved,
}: {
  sbuList: string[];
  warehouses: { id: string; name: string }[];
  rules: any[];
  onSaved: () => void;
}) {
  // Target the common (customer_id = null) warehouse rule.
  const existing = rules.find(
    (r) => r.rule_type === "warehouse" && r.customer_id == null && r.active,
  );
  const existingCfg = existing?.config ?? {};
  const isSbuType = existingCfg.type === "sbu";

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultWh, setDefaultWh] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Hydrate from existing rule when it loads.
  useEffect(() => {
    const next: Record<string, string> = {};
    if (isSbuType) {
      for (const m of existingCfg.mappings ?? []) {
        for (const v of m.values ?? []) next[String(v)] = m.warehouse_id ?? "";
      }
      setDefaultWh(existingCfg.default_warehouse_id ?? "");
    }
    setMapping(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  // Ensure every discovered SBU has a row.
  const allSbus = useMemo(() => {
    const set = new Set<string>([...sbuList, ...Object.keys(mapping)]);
    return [...set].sort();
  }, [sbuList, mapping]);

  const setWh = (sbu: string, whId: string) =>
    setMapping((m) => ({ ...m, [sbu]: whId }));

  async function save() {
    setSaving(true);
    try {
      // Build sbu-type config from the dropdown state.
      const byWh = new Map<string, string[]>();
      for (const [sbu, whId] of Object.entries(mapping)) {
        if (!whId) continue;
        if (!byWh.has(whId)) byWh.set(whId, []);
        byWh.get(whId)!.push(sbu);
      }
      const config = {
        type: "sbu",
        mappings: [...byWh.entries()].map(([warehouse_id, values]) => ({
          values,
          warehouse_id,
        })),
        default_warehouse_id: defaultWh || null,
      };

      if (existing) {
        const { error } = await supabase
          .from("customer_rules")
          .update({ config, active: true })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer_rules").insert({
          customer_id: null,
          rule_type: "warehouse",
          config,
          priority: 0,
          active: true,
        });
        if (error) throw error;
      }
      toast.success("창고 배정 규칙 저장됨");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <WarehouseIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">창고 배정 규칙 (SBU 기준)</h3>
          <Badge variant="outline">전체 공통</Badge>
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="size-3.5" /> 저장
        </Button>
      </div>

      {!isSbuType && existing && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
          현재 활성 창고 규칙이 SBU 타입이 아닙니다. 저장 시 SBU 매핑으로 덮어씁니다.
        </p>
      )}

      {allSbus.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          업로드된 컨테이너의 SBU 값이 아직 없습니다. 엑셀 업로드 후 다시 열어주세요.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allSbus.map((sbu) => (
            <div key={sbu} className="flex items-center gap-2">
              <Badge className="w-14 justify-center font-mono">{sbu}</Badge>
              <span className="text-xs text-muted-foreground">→</span>
              <select
                value={mapping[sbu] ?? ""}
                onChange={(e) => setWh(sbu, e.target.value)}
                className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">(기본값 사용)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-20">기본 창고</span>
        <select
          value={defaultWh}
          onChange={(e) => setDefaultWh(e.target.value)}
          className="flex-1 h-9 rounded-md border bg-background px-2 text-sm max-w-xs"
        >
          <option value="">(미지정)</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <span className="text-[11px] text-muted-foreground">
          매핑되지 않은 SBU는 기본 창고로 배정됩니다.
        </span>
      </div>
    </Card>
  );
}

// ---------- Advanced (JSON) editor — collapsed by default ----------

function AdvancedRulesEditor({
  customers,
  rules,
  warehouses,
  qc,
}: {
  customers: any[];
  rules: any[];
  warehouses: { id: string; name: string }[];
  qc: ReturnType<typeof useQueryClient>;
}) {
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
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground">고객사</label>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="block h-9 rounded-md border bg-background px-3 text-sm min-w-[200px]"
          >
            <option value="">전체 공통</option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
          {warehouses.map((w: any) => (
            <div key={w.id} className="flex gap-3">
              <span className="text-muted-foreground w-32">{w.name}</span>
              <span>{w.id}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        {rules.map((r: any) => {
          const cust = customers.find((c: any) => c.id === r.customer_id);
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
        {rules.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            규칙이 없습니다. 위에서 추가해주세요.
          </Card>
        )}
      </div>
    </div>
  );
}

function RuleCard({
  rule, customerName, onSave, onToggle, onDelete,
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
  return ({ port: "입항지", warehouse: "창고", customs: "통관", inbound: "입고" } as Record<string, string>)[t] || t;
}