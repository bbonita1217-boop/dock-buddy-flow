import * as XLSX from "xlsx";

// Normalize header for tolerant matching: trim, collapse spaces, lowercase,
// strip punctuation (/, ., (), -, _ etc.) and whitespace.
function normalizeHeader(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[\s./()\-_\[\]{}:;,'"`]+/g, "");
}

// Raw header → field. Keys will be normalized at lookup time.
const HEADER_MAP_RAW: Record<string, string> = {
  "고객사": "customer_name",
  "Customer": "customer_name",
  "SBU": "sbu",
  "BL NO": "bl_no",
  "BL NO.": "bl_no",
  "B/L NO": "bl_no",
  "ITEM NO": "item_no",
  "ITEM NO.": "item_no",
  "ITEM": "item_no",
  "BATCH": "batch",
  "EXPIRY": "expiry",
  "QTY (CA)": "qty_case",
  "QTY CA": "qty_case",
  "QTY (EA)": "qty_ea",
  "QTY EA": "qty_ea",
  "Pack factor": "pack_factor",
  "CONTAINER NO": "container_no",
  "CNTR NO": "container_no",
  "container": "container_no",
  "SHIPMENT MODE": "shipment_mode",
  "MODE": "shipment_mode",
  "CONTAINER SIZE": "container_size",
  "Container size": "container_size",
  "SIZE": "container_size",
  "FORWARDER": "forwarder",
  "포워딩/선사": "forwarder",
  "포워딩": "forwarder",
  "선사": "forwarder",
  "ETD": "etd",
  "ETA": "eta",
  "수입신고수리일": "customs_clear_date",
  "수입신고 수리일": "customs_clear_date",
  "통관일": "customs_clear_date",
  "수입신고번호": "customs_declaration_no",
  "REMARK": "remark",
  "DESCRIPTION": "description",
  "DESC": "description",
  "반출기간만료일": "return_deadline",
  "반출기한": "return_deadline",
  "입항지": "port",
  "PORT": "port",
  "창고": "_warehouse_name",
  "WAREHOUSE": "_warehouse_name",
  "입고일": "inbound_date",
  "Inbound date": "inbound_date",
  "입고시간": "inbound_time",
};

const HEADER_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(HEADER_MAP_RAW).map(([k, v]) => [normalizeHeader(k), v]),
);

const excelDateToISO = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  // try direct
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

export interface ParsedRow {
  customer_name?: string;
  sbu?: string;
  bl_no?: string;
  item_no?: string;
  batch?: string;
  expiry?: string | null;
  container_no?: string;
  shipment_mode?: string;
  container_size?: string;
  forwarder?: string;
  etd?: string | null;
  eta?: string | null;
  customs_clear_date?: string | null;
  description?: string;
  return_deadline?: string | null;
  port?: string;
  inbound_date?: string | null;
  inbound_time?: string;
  _warehouse_name?: string;
  qty_case?: string;
  qty_ea?: string;
  pack_factor?: string;
  remark?: string;
  customs_declaration_no?: string;
  raw: Record<string, any>;
}

export interface ParseResult {
  rows: ParsedRow[];
  unmatchedHeaders: string[];
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const all: ParsedRow[] = [];
  const unmatched = new Set<string>();
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null, raw: true });
    for (const r of rows) {
      const out: ParsedRow = { raw: r };
      for (const [k, v] of Object.entries(r)) {
        const key = HEADER_MAP[normalizeHeader(k)];
        if (!key) {
          // Ignore auto-generated empty column headers like "__EMPTY", "__EMPTY_1"
          if (!/^__empty/i.test(k)) unmatched.add(k);
          continue;
        }
        if (["etd", "eta", "expiry", "customs_clear_date", "return_deadline", "inbound_date"].includes(key)) {
          (out as any)[key] = excelDateToISO(v);
        } else {
          (out as any)[key] = v == null ? null : String(v).trim();
        }
      }
      // skip empty
      if (out.bl_no || out.container_no || out.item_no) all.push(out);
    }
  }
  return { rows: all, unmatchedHeaders: [...unmatched] };
}

// Export warehouse dispatch sheet
export interface DispatchExportRow {
  bl_no: string | null;
  container_no: string | null;
  item_no: string | null;
  description: string | null;
  port: string | null;
  warehouse_name: string | null;
  inbound_date: string | null;
  inbound_time: string | null;
  container_size: string | null;
  forwarder: string | null;
}

export function downloadWarehouseDispatch(warehouseName: string, rows: DispatchExportRow[]) {
  const header = [
    "BL NO",
    "Container No",
    "Item No",
    "Description",
    "입항지",
    "창고",
    "입고일",
    "입고시간",
    "Container Size",
    "Forwarder",
  ];
  const data = rows.map((r) => [
    r.bl_no,
    r.container_no,
    r.item_no,
    r.description,
    r.port,
    r.warehouse_name,
    r.inbound_date,
    r.inbound_time,
    r.container_size,
    r.forwarder,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = header.map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "배차표");
  XLSX.writeFile(wb, `${warehouseName}_배차표.xlsx`);
}