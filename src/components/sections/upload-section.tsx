import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { parseExcelFile, type ParsedRow } from "@/lib/excel";
import { supabase } from "@/integrations/supabase/client";
import { applyAutoDispatch } from "@/lib/dispatch";
import { toast } from "sonner";

export function UploadSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [unmatchedHeaders, setUnmatchedHeaders] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const parsed = await parseExcelFile(f);
      setRows(parsed.rows);
      setUnmatchedHeaders(parsed.unmatchedHeaders);
      toast.success(`${parsed.rows.length}건 파싱 완료`);
      if (parsed.unmatchedHeaders.length) {
        toast.warning(`인식 안 된 컬럼 ${parsed.unmatchedHeaders.length}개`);
      }
    } catch (err: any) {
      toast.error(err?.message || "엑셀 파싱 실패");
    }
  }

  async function importAndDispatch(runDispatch: boolean) {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const custNames = [...new Set(rows.map((r) => r.customer_name).filter(Boolean))] as string[];
      const custMap = new Map<string, string>();
      if (custNames.length) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id, name")
          .in("name", custNames);
        for (const c of existing ?? []) custMap.set(c.name, c.id);
        const missing = custNames.filter((n) => !custMap.has(n));
        if (missing.length) {
          const { data: ins } = await supabase
            .from("customers")
            .insert(missing.map((n) => ({ name: n })))
            .select("id, name");
          for (const c of ins ?? []) custMap.set(c.name, c.id);
        }
      }

      const { data: whs } = await supabase.from("warehouses").select("id, name");
      const whMap = new Map<string, string>((whs ?? []).map((w: any) => [w.name, w.id]));

      const records = rows.map((r) => ({
        customer_id: r.customer_name ? custMap.get(r.customer_name) ?? null : null,
        sbu: r.sbu ?? null,
        bl_no: r.bl_no ?? null,
        item_no: r.item_no ?? null,
        batch: r.batch ?? null,
        expiry: r.expiry ?? null,
        container_no: r.container_no ?? null,
        shipment_mode: r.shipment_mode ?? null,
        container_size: r.container_size ?? null,
        forwarder: r.forwarder ?? null,
        etd: r.etd ?? null,
        eta: r.eta ?? null,
        customs_clear_date: r.customs_clear_date ?? null,
        description: r.description ?? null,
        return_deadline: r.return_deadline ?? null,
        port: r.port ?? null,
        warehouse_id: r._warehouse_name ? whMap.get(r._warehouse_name) ?? null : null,
        inbound_date: r.inbound_date ?? null,
        inbound_time: r.inbound_time ?? null,
        dispatch_status: r.inbound_date ? "MANUAL" : "PENDING",
        raw: r.raw,
      }));

      for (let i = 0; i < records.length; i += 200) {
        const slice = records.slice(i, i + 200);
        const { error } = await supabase.from("containers").insert(slice);
        if (error) throw error;
      }
      toast.success(`${records.length}건 등록 완료`);

      if (runDispatch) {
        const r = await applyAutoDispatch(supabase as any);
        toast.success(`자동 배차 완료 · 배정 ${r.placed} · 대기 ${r.failed}`);
      }
      setRows([]);
      setUnmatchedHeaders([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e: any) {
      toast.error(e?.message || "등록 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
          <FileSpreadsheet className="size-12 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">엑셀 파일을 선택하세요</p>
          <p className="text-xs text-muted-foreground mt-1">.xlsx / .xls 지원</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={onFile}
            className="hidden"
          />
          <Button className="mt-5" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" /> 파일 선택
          </Button>
          {fileName && (
            <p className="mt-3 text-xs text-muted-foreground">
              {fileName} · <Badge variant="outline">{rows.length}행</Badge>
            </p>
          )}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h3 className="text-sm font-semibold">미리보기 (상위 20행)</h3>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => importAndDispatch(false)}>
                <CheckCircle2 className="size-4" /> 등록만
              </Button>
              <Button disabled={busy} onClick={() => importAndDispatch(true)}>
                <CheckCircle2 className="size-4" /> 등록 + 자동 배차
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  {["고객사", "BL", "Container", "Item", "SBU", "ETA", "통관", "Mode", "Size", "Forwarder"].map(
                    (h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">{r.customer_name}</td>
                    <td className="px-3 py-1.5">{r.bl_no}</td>
                    <td className="px-3 py-1.5 font-mono">{r.container_no}</td>
                    <td className="px-3 py-1.5 font-mono">{r.item_no}</td>
                    <td className="px-3 py-1.5">{r.sbu}</td>
                    <td className="px-3 py-1.5">{r.eta}</td>
                    <td className="px-3 py-1.5">{r.customs_clear_date}</td>
                    <td className="px-3 py-1.5">{r.shipment_mode}</td>
                    <td className="px-3 py-1.5">{r.container_size}</td>
                    <td className="px-3 py-1.5">{r.forwarder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}