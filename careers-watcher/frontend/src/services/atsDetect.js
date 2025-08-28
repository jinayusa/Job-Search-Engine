import { proxyGetJSON, proxyPostJSON } from "./proxy.js";

// --- helpers ---------------------------------------------------------------
const STOP = new Set(["inc","inc.","co","corp","corp.","corporation","company","llc","l.l.c","plc","p.l.c","limited","ltd","ltd.","holdings","group","labs","lab","technologies","technology","systems","ai","usa","us"]);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const alnum = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
const compact = (words) => words.join("");
const hyphen = (words) => words.join("-");

export function makeSlugCandidates(company) {
  const words0 = alnum(company).trim().split(/\s+/).filter(Boolean);
  const words1 = words0.filter((w) => !STOP.has(w));
  const bases = uniq([compact(words0), compact(words1), words0[0]]);
  const hyphens = uniq([hyphen(words0), hyphen(words1)]);
  return uniq([...bases, ...hyphens]);
}

// --- parse from URL (most reliable) ---------------------------------------
export function extractFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.host.toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);
    // Greenhouse: boards.greenhouse.io/{slug}
    if (host.includes("greenhouse.io")) {
      const slug = parts[0]?.toLowerCase();
      if (slug) return { ok: true, source: "greenhouse", slug };
    }
    // Lever: jobs.lever.co/{slug}
    if (host.includes("lever.co")) {
      const slug = parts[0]?.toLowerCase();
      if (slug) return { ok: true, source: "lever", slug };
    }
    // Ashby: jobs.ashbyhq.com/{slug}
    if (host.includes("ashbyhq.com")) {
      const slug = parts[0]?.toLowerCase();
      if (slug) return { ok: true, source: "ashby", slug };
    }
    // SmartRecruiters: jobs.smartrecruiters.com/{CompanySlug}/...
    if (host.includes("smartrecruiters.com")) {
      const slug = (parts[0] || "").toLowerCase();
      if (slug) return { ok: true, source: "smartrecruiters", slug };
    }
    // Workable: apply.workable.com/{slug}
    if (host.includes("workable.com")) {
      const slug = (parts[0] || "").toLowerCase();
      if (slug) return { ok: true, source: "workable", slug };
    }
    // Workday: *.myworkdayjobs.com/wday/cxs/{tenant}/...
    if (host.endsWith("myworkdayjobs.com")) {
      // try /wday/cxs/{tenant}/...
      const wdayIdx = parts.findIndex((p) => p.toLowerCase() === "wday");
      if (wdayIdx >= 0 && parts[wdayIdx+1]?.toLowerCase() === "cxs") {
        const tenant = parts[wdayIdx+2];
        if (tenant) return { ok: true, source: "workday", host, tenant, board: "External" };
      }
      // fallback: try next segment after locale, eg /en-US/{tenant}/...
      const enIdx = parts.findIndex((p) => /^[a-z]{2}-[A-Z]{2}$/.test(p));
      if (enIdx >= 0 && parts[enIdx+1]) {
        return { ok: true, source: "workday", host, tenant: parts[enIdx+1], board: "External" };
      }
      return { ok: true, source: "workday", host, tenant: "", board: "External" };
    }
  } catch {}
  return { ok: false };
}

// --- API checkers (used when no URL) --------------------------------------
async function checkGreenhouse(slug) {
  try {
    const js = await proxyGetJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
    if (js && Array.isArray(js.jobs)) return { ok: true, source: "greenhouse", slug, jobs: js.jobs.length };
  } catch {}
  return { ok: false };
}
async function checkLever(slug) {
  try {
    const js = await proxyGetJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (Array.isArray(js)) return { ok: true, source: "lever", slug, jobs: js.length };
  } catch {}
  return { ok: false };
}
async function checkAshby(slug) {
  try {
    const js = await proxyGetJSON(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    const jobs = Array.isArray(js?.jobs) ? js.jobs.length
      : Array.isArray(js?.jobBoard?.sections) ? js.jobBoard.sections.reduce((n, s)=>n + (Array.isArray(s.jobs)?s.jobs.length:0), 0)
      : 0;
    return { ok: true, source: "ashby", slug, jobs };
  } catch {}
  return { ok: false };
}
async function checkSmartRecruiters(slug) {
  const s = String(slug).toLowerCase();
  try {
    const js = await proxyGetJSON(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`);
    if (Array.isArray(js?.content)) return { ok: true, source: "smartrecruiters", slug: s, jobs: js.content.length };
  } catch {}
  return { ok: false };
}
async function checkWorkable(slug) {
  const s = String(slug).toLowerCase();
  try {
    const js = await proxyGetJSON(`https://apply.workable.com/api/v3/accounts/${s}/jobs?limit=1`);
    if (Array.isArray(js?.results)) return { ok: true, source: "workable", slug: s, jobs: js.results.length };
  } catch {}
  return { ok: false };
}
const WORKDAY_HOSTS = Array.from({length: 14}, (_,i)=>`wd${i+1}.myworkdayjobs.com`);
async function checkWorkdayOnce(host, tenant, board = "External") {
  const url = `https://${host}/wday/cxs/${tenant}/${board}/jobs`;
  const body = { limit: 1, offset: 0, searchText: "", appliedFacets: {}, locale: "en_US" };
  try {
    const js = await proxyPostJSON(url, body);
    const posts = js?.jobPostings || js?.jobs;
    if (Array.isArray(posts)) return { ok: true, source: "workday", host, tenant, board, jobs: posts.length };
  } catch {}
  return { ok: false };
}

// --- main: detect for a whole row (uses URL first if present) --------------
export async function detectATSForCompanyRow(row, { tryWorkday = true } = {}) {
  // 1) If the row has a careers URL, parse it first (most reliable)
  if (row?.careers) {
    const r = extractFromUrl(row.careers);
    if (r.ok) return r;
  }
  // 2) Try name-based slug candidates across ATS
  const cands = makeSlugCandidates(row.company || "");
  for (const slug of cands) { const r = await checkGreenhouse(slug);      if (r.ok) return r; }
  for (const slug of cands) { const r = await checkLever(slug);           if (r.ok) return r; }
  for (const slug of cands) { const r = await checkAshby(slug);           if (r.ok) return r; }
  for (const slug of cands) { const r = await checkSmartRecruiters(slug); if (r.ok) return r; }
  for (const slug of cands) { const r = await checkWorkable(slug);        if (r.ok) return r; }

  // 3) Workday matrix search (slower)
  if (tryWorkday) {
    for (const tenant of cands) {
      for (const host of WORKDAY_HOSTS) {
        const r = await checkWorkdayOnce(host, tenant, "External");
        if (r.ok) return r;
      }
    }
  }
  return { ok: false };
}
