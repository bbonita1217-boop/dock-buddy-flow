import type { SupabaseClient } from "@supabase/supabase-js";

export type RuleConfig = Record<string, any>;

export interface Container {
  id: string;
  customer_id: string | null;
  sbu: string | null;
  bl_no: string | null;
  item_no: string | null;
  container_no: string | null;
  shipment_mode: string | null;
  container_size: string | null;
  forwarder: string | null;
  etd: string | null;
  eta: string | null;
  customs_clear_date: string | null;
  description: string | null;
  return_deadline: string | null;
  port: string | null;
  warehouse_id: string | null;
  inbound_date: string | null;
  inbound_time: string | null;
  dispatch_status: "PENDING" | "AUTO" | "MANUAL";
  batch?: string | null;
  expiry?: string | null;
  carrier?: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  max_daily: number;
  active: boolean;
}

export interface WarehouseSlot {
  id: string;
  warehouse_id: string;
  slot_time: string;
  weekday: number | null;
}

export interface CustomerRule {
  id: string;
  customer_id: string | null;
  rule_type: "port" | "warehouse" | "customs" | "inbound";
  config: RuleConfig;
  priority: number;
  active: boolean;
}

// ---------- date helpers ----------
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const nextBusinessDay = (d: Date, holidays: Set<string>) => {
  let x = addDays(d, 1);
  while (isWeekend(x) || holidays.has(fmt(x))) x = addDays(x, 1);
  return x;
};

// ---------- Rule engine ----------

/** Port rule. Supported config:
 *  { type: 'item_prefix', mappings:[{prefixes:['FNB','R5C','5H'], port:'INCHEON'}], default:'BUSAN' }
 *  { type: 'column' }   // use container.port column from upload
 *  { type: 'fixed', port: 'BUSAN' }
 */
export function decidePort(c: Container, rules: CustomerRule[]): string | null {
  const r = rules.find((x) => x.rule_type === "port" && x.active);
  if (!r) return c.port ?? null;
  const cfg = r.config || {};
  if (cfg.type === "column") return c.port ?? cfg.default ?? null;
  if (cfg.type === "fixed") return cfg.port ?? null;
  if (cfg.type === "item_prefix") {
    const item = (c.item_no || "").toUpperCase();
    for (const m of cfg.mappings || []) {
      if ((m.prefixes || []).some((p: string) => item.startsWith(String(p).toUpperCase()))) {
        return m.port;
      }
    }
    return cfg.default ?? c.port ?? null;
  }
  return c.port ?? null;
}

/** Warehouse rule. Supported config:
 *  { type:'sbu', mappings:[{values:['PD'], warehouse_id:'...'}], default_warehouse_id:'...' }
 *  { type:'item_prefix', mappings:[{prefixes:[...], warehouse_id:'...'}], default_warehouse_id:'...' }
 *  { type:'port', mappings:[{ports:['INCHEON'], warehouse_id:'...'}], default_warehouse_id:'...' }
 *  { type:'fixed', warehouse_id:'...' }
 */
export function decideWarehouse(
  c: Container,
  port: string | null,
  rules: CustomerRule[],
  warehouses: Warehouse[],
): string | null {
  const r = rules.find((x) => x.rule_type === "warehouse" && x.active);
  if (!r) return warehouses[0]?.id ?? null;
  const cfg = r.config || {};
  if (cfg.type === "fixed") return cfg.warehouse_id ?? null;
  if (cfg.type === "sbu") {
    const sbu = (c.sbu || "").toUpperCase();
    for (const m of cfg.mappings || []) {
      if ((m.values || []).map((v: string) => v.toUpperCase()).includes(sbu)) return m.warehouse_id;
    }
    return cfg.default_warehouse_id ?? null;
  }
  if (cfg.type === "item_prefix") {
    const item = (c.item_no || "").toUpperCase();
    for (const m of cfg.mappings || []) {
      if ((m.prefixes || []).some((p: string) => item.startsWith(String(p).toUpperCase())))
        return m.warehouse_id;
    }
    return cfg.default_warehouse_id ?? null;
  }
  if (cfg.type === "port") {
    for (const m of cfg.mappings || []) {
      if ((m.ports || []).includes(port)) return m.warehouse_id;
    }
    return cfg.default_warehouse_id ?? null;
  }
  return cfg.default_warehouse_id ?? null;
}

/** Customs / inbound rule. config:
 *  { use_declared_date: true, skip_weekends:true, customs_days_after_eta:0, inbound_days_after_customs:1, pre_arrival:true }
 * pre_arrival=true means if ETA is Fri, customs can finish same/earlier, inbound Mon.
 */
export function calcEarliestInbound(
  c: Container,
  rules: CustomerRule[],
  holidays: Set<string>,
): Date | null {
  const r = rules.find((x) => x.rule_type === "customs" && x.active);
  const cfg = r?.config || {};
  const useDeclared = cfg.use_declared_date !== false;
  const skipWeekends = cfg.skip_weekends !== false;
  const customsDays = Number(cfg.customs_days_after_eta ?? 0);
  const inboundDays = Number(cfg.inbound_days_after_customs ?? 1);

  let customsDay: Date | null = null;
  if (useDeclared && c.customs_clear_date) customsDay = parseDate(c.customs_clear_date);
  if (!customsDay) {
    const eta = parseDate(c.eta);
    if (!eta) return null;
    customsDay = addDays(eta, customsDays);
    if (skipWeekends) {
      while (isWeekend(customsDay) || holidays.has(fmt(customsDay)))
        customsDay = addDays(customsDay, 1);
    }
  }

  let inbound = addDays(customsDay, inboundDays);
  if (skipWeekends) {
    while (isWeekend(inbound) || holidays.has(fmt(inbound))) inbound = addDays(inbound, 1);
  }
  return inbound;
}

// ---------- Slot assignment ----------

export interface DispatchResult {
  container_id: string;
  warehouse_id: string | null;
  inbound_date: string | null;
  inbound_time: string | null;
  port: string | null;
  reason?: string;
}

export function runAutoDispatch(
  containers: Container[],
  warehouses: Warehouse[],
  slots: WarehouseSlot[],
  rules: CustomerRule[],
  holidayList: string[],
  existingBookings: Container[], // already-dispatched containers (incl. MANUAL)
  options: { horizonDays?: number } = {},
): DispatchResult[] {
  const holidays = new Set(holidayList);
  const horizon = options.horizonDays ?? 30;
  const results: DispatchResult[] = [];

  // bookings map: warehouse_id -> date(YYYY-MM-DD) -> Set<time>
  const bookings = new Map<string, Map<string, Set<string>>>();
  const dailyCount = new Map<string, Map<string, number>>();
  const book = (wh: string, date: string, time: string) => {
    if (!bookings.has(wh)) bookings.set(wh, new Map());
    const d = bookings.get(wh)!;
    if (!d.has(date)) d.set(date, new Set());
    d.get(date)!.add(time);
    if (!dailyCount.has(wh)) dailyCount.set(wh, new Map());
    const dc = dailyCount.get(wh)!;
    dc.set(date, (dc.get(date) ?? 0) + 1);
  };

  for (const ex of existingBookings) {
    if (ex.warehouse_id && ex.inbound_date && ex.inbound_time) {
      book(ex.warehouse_id, ex.inbound_date, ex.inbound_time);
    }
  }

  // sort containers by ETA asc
  const queue = [...containers].sort((a, b) => (a.eta || "").localeCompare(b.eta || ""));

  for (const c of queue) {
    const custRules = rules.filter((r) => !r.customer_id || r.customer_id === c.customer_id);
    const port = decidePort(c, custRules);
    const whId = decideWarehouse(c, port, custRules, warehouses);
    const wh = warehouses.find((w) => w.id === whId);
    const earliest = calcEarliestInbound(c, custRules, holidays);

    if (!wh || !earliest) {
      results.push({
        container_id: c.id,
        warehouse_id: whId,
        inbound_date: null,
        inbound_time: null,
        port,
        reason: !wh ? "창고 결정 실패" : "입고일 계산 실패",
      });
      continue;
    }

    const whSlots = slots
      .filter((s) => s.warehouse_id === wh.id)
      .map((s) => s.slot_time)
      .sort();

    let placed = false;
    let cursor = new Date(earliest);
    for (let i = 0; i < horizon && !placed; i++) {
      const dateStr = fmt(cursor);
      const weekday = cursor.getDay();
      const skip = isWeekend(cursor) || holidays.has(dateStr);
      if (!skip) {
        const taken = bookings.get(wh.id)?.get(dateStr) ?? new Set<string>();
        const dayCount = dailyCount.get(wh.id)?.get(dateStr) ?? 0;
        if (dayCount < wh.max_daily) {
          const daySlots = whSlots.filter(
            (t) =>
              !slots.some(
                (s) =>
                  s.warehouse_id === wh.id &&
                  s.slot_time === t &&
                  s.weekday !== null &&
                  s.weekday !== weekday,
              ),
          );
          const open = daySlots.find((t) => !taken.has(t));
          if (open) {
            book(wh.id, dateStr, open);
            results.push({
              container_id: c.id,
              warehouse_id: wh.id,
              inbound_date: dateStr,
              inbound_time: open,
              port,
            });
            placed = true;
            break;
          }
        }
      }
      cursor = addDays(cursor, 1);
    }

    if (!placed) {
      results.push({
        container_id: c.id,
        warehouse_id: wh.id,
        inbound_date: null,
        inbound_time: null,
        port,
        reason: "가용 슬롯 없음",
      });
    }
  }

  return results;
}

export async function applyAutoDispatch(supabase: SupabaseClient): Promise<{
  total: number;
  placed: number;
  failed: number;
}> {
  const [containersRes, whRes, slotsRes, rulesRes, holRes] = await Promise.all([
    supabase.from("containers").select("*"),
    supabase.from("warehouses").select("*").eq("active", true),
    supabase.from("warehouse_slots").select("*"),
    supabase.from("customer_rules").select("*").eq("active", true),
    supabase.from("holidays").select("holiday_date"),
  ]);

  const all: Container[] = (containersRes.data || []) as Container[];
  const seaMode = (m: string | null) => (m || "").toUpperCase().includes("SEA");

  // candidates: SEA + (PENDING or AUTO without complete info)
  const candidates = all.filter(
    (c) => seaMode(c.shipment_mode) && c.dispatch_status !== "MANUAL",
  );
  // existing bookings to honor: MANUAL ones
  const existing = all.filter((c) => c.dispatch_status === "MANUAL");

  const results = runAutoDispatch(
    candidates,
    (whRes.data || []) as Warehouse[],
    (slotsRes.data || []) as WarehouseSlot[],
    (rulesRes.data || []) as CustomerRule[],
    (holRes.data || []).map((h: any) => h.holiday_date),
    existing,
  );

  let placed = 0;
  let failed = 0;
  for (const r of results) {
    const update: any = {
      warehouse_id: r.warehouse_id,
      port: r.port,
      inbound_date: r.inbound_date,
      inbound_time: r.inbound_time,
      dispatch_status: r.inbound_date ? "AUTO" : "PENDING",
    };
    await supabase.from("containers").update(update).eq("id", r.container_id);
    if (r.inbound_date) placed++;
    else failed++;
  }
  return { total: results.length, placed, failed };
}