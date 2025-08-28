// frontend/src/services/excel.js
import * as XLSXLib from "xlsx";

/** Pick the companies sheet (prefer one named like "companies", else first) */
function pickCompaniesSheet(workbook) {
  const byName = workbook.SheetNames.find((n) => n.toLowerCase().includes("comp"));
  const name = byName || workbook.SheetNames[0];
  return { ws: workbook.Sheets[name], sheetName: name };
}

/** Robust row parsing — forgiving mode by default */
export function toCompanyRowsFromSheet(ws, { strict = false } = {}) {
  const table = XLSXLib.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const rows = table.filter((r) => (r || []).some((cell) => String(cell).trim() !== ""));
  if (rows.length === 0) return [];

  const headerRow = rows[0].map((h) => String(h).trim().toLowerCase());
  const data = rows.slice(1);

  const idx = (name) => headerRow.indexOf(name);
  const get = (r, name) => {
    const i = idx(name);
    return i >= 0 ? String(r[i] ?? "").trim() : "";
  };

  const out = data.map((r) => ({
    company: get(r, "company"),
    source: get(r, "source").toLowerCase(),
    slug: get(r, "slug"),
    host: get(r, "host"),
    tenant: get(r, "tenant"),
    board: get(r, "board"),
    careers: get(r, "careers"),
  }));

  // Keep rows that at least have a company name
  const normalized = out.filter((r) => r.company);

  if (!strict) return normalized;

  // Strict mode (not used by default)
  return normalized.filter((row) => {
    if (!row.source) return false;
    if (row.source === "workday") return !!(row.host && row.tenant);
    return !!row.slug; // greenhouse/lever
  });
}

/** Download a tiny starter template */
export function downloadTemplate() {
  const rows = [
    { company: "Adobe",   source: "greenhouse", slug: "adobe",   host: "", tenant: "", board: "" },
    { company: "Contoso", source: "lever",      slug: "contoso", host: "", tenant: "", board: "" },
    { company: "Acme",    source: "workday",    slug: "", host: "wd1.myworkdayjobs.com", tenant: "acme", board: "External" },
  ];
  const wb = XLSXLib.utils.book_new();
  XLSXLib.utils.book_append_sheet(wb, XLSXLib.utils.json_to_sheet(rows), "companies");
  XLSXLib.writeFile(wb, "careers_companies_template.xlsx");
}

/** Export visible jobs to CSV */
export function exportCSV(filename, rows) {
  const headers = ["company","source","title","location","department","postedAt","firstSeenAt","url"];
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

/** Read an ArrayBuffer into a workbook and pick the companies sheet */
export function readWorkbookFirstCompaniesSheet(arrayBuffer) {
  const wb = XLSXLib.read(new Uint8Array(arrayBuffer), { type: "array" });
  const picked = pickCompaniesSheet(wb);
  if (!picked.ws) throw new Error("No worksheet found in this file");
  return picked;
}
// ✅ is a company row fully configured for fetching?
export function isConfiguredRow(row) {
  if (!row || !row.company) return false;
  if (!row.source) return false;
  if (row.source === "workday") return !!(row.host && row.tenant);
  // greenhouse / lever need slug
  return !!row.slug;
}

// ✅ export companies to a new Excel file
export function exportCompaniesExcel(filename, rows) {
  const cols = ["company", "source", "slug", "host", "tenant", "board", "careers"];
  const normalized = (rows || []).map((r) => ({
    company: r.company || "",
    source: r.source || "",
    slug: r.slug || "",
    host: r.host || "",
    tenant: r.tenant || "",
    board: r.board || "",
  }));
  const wb = XLSXLib.utils.book_new();
  const ws = XLSXLib.utils.json_to_sheet(normalized, { header: cols });
  XLSXLib.utils.book_append_sheet(wb, ws, "companies");
  XLSXLib.writeFile(wb, filename);
}
