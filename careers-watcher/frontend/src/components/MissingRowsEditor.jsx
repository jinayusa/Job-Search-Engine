// frontend/src/components/MissingRowsEditor.jsx
import { useMemo, useState } from "react";
import { proxyGetJSON, proxyPostJSON } from "../services/proxy.js";
import {
  detectATSForCompanyRow,
  extractFromUrl,
  makeSlugCandidates,
} from "../services/atsDetect.js";
import { exportCompaniesExcel, isConfiguredRow } from "../services/excel.js";

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const SLUG_SOURCES = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
]);

function RowEditor({ row, onApply }) {
  const [source, setSource] = useState(row.source || "");
  const [slug, setSlug] = useState(row.slug || "");
  const [host, setHost] = useState(row.host || "");
  const [tenant, setTenant] = useState(row.tenant || "");
  const [board, setBoard] = useState(row.board || "External");
  const [careers, setCareers] = useState(row.careers || "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const tryDetect = async () => {
    setBusy(true);
    setStatus("Discovering ATS…");
    try {
      const res = await detectATSForCompanyRow({
        ...row,
        source,
        slug,
        host,
        tenant,
        board,
        careers,
      });

      if (res.ok) {
        if (res.source === "workday") {
          setSource("workday");
          if (res.host) setHost(res.host);
          if (res.tenant) setTenant(res.tenant);
          setBoard(res.board || "External");
          setStatus(
            `Detected Workday (${res.host || "host"} / ${
              res.tenant || "tenant"
            }, jobs ~${res.jobs ?? "?"})`
          );
        } else {
          setSource(res.source);
          if (res.slug) setSlug(res.slug);
          const label = res.source[0].toUpperCase() + res.source.slice(1);
          setStatus(
            `Detected ${label}${res.slug ? ` (slug: ${res.slug})` : ""}${
              res.jobs != null ? `, jobs ~${res.jobs}` : ""
            }`
          );
        }
      } else {
        const guess = makeSlugCandidates(row.company)[0] || norm(row.company);
        setStatus("Couldn’t auto-detect. Try URL → Parse or fill fields manually.");
        if (!source) setSource("greenhouse");
        if (!slug) setSlug(guess);
      }
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    setStatus("Validating…");
    try {
      if (!source) throw new Error("Select ATS first");
      if (SLUG_SOURCES.has(source) && !slug) throw new Error("Missing slug");
    // ✅ generic careers page validation
    if (source === "generic") {
      if (!careers) throw new Error("Paste careers URL");
      const html = await proxyGetText(careers);
      const hasJsonLd = /application\/ld\+json/i.test(html);
      const hasKnownATS = /(greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|smartrecruiters\.com|workable\.com)/i.test(html);
      setStatus(
        `OK: ${hasJsonLd ? "Found JSON-LD" : "No JSON-LD"}${hasKnownATS ? "; Found ATS link(s)" : ""}`
      );
      return;
    }
      if (source === "greenhouse") {
        const js = await proxyGetJSON(
          `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
        );
        if (Array.isArray(js.jobs)) return setStatus(`OK: ${js.jobs.length} jobs`);
        throw new Error("No jobs[] in response");
      }

      if (source === "lever") {
        const js = await proxyGetJSON(
          `https://api.lever.co/v0/postings/${slug}?mode=json`
        );
        if (Array.isArray(js)) return setStatus(`OK: ${js.length} jobs`);
        throw new Error("No list in response");
      }

      if (source === "ashby") {
        const js = await proxyGetJSON(
          `https://api.ashbyhq.com/posting-api/job-board/${slug}`
        );
        const count = Array.isArray(js?.jobs)
          ? js.jobs.length
          : Array.isArray(js?.jobBoard?.sections)
          ? js.jobBoard.sections.reduce(
              (n, s) => n + (Array.isArray(s.jobs) ? s.jobs.length : 0),
              0
            )
          : 0;
        return setStatus(`OK: ${count} jobs`);
      }

      if (source === "smartrecruiters") {
        const s = String(slug).toLowerCase();
        const js = await proxyGetJSON(
          `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=1`
        );
        if (Array.isArray(js?.content))
          return setStatus(`OK: ${js.content.length} job(s) (sample)`);
        throw new Error("No content[] in response");
      }

      if (source === "workable") {
        const s = String(slug).toLowerCase();
        const js = await proxyGetJSON(
          `https://apply.workable.com/api/v3/accounts/${s}/jobs?limit=1`
        );
        if (Array.isArray(js?.results))
          return setStatus(`OK: ${js.results.length} job(s) (sample)`);
        throw new Error("No results[] in response");
      }

      if (source === "workday") {
        if (!host || !tenant) throw new Error("Missing host/tenant");
        const url = `https://${host}/wday/cxs/${tenant}/${board || "External"}/jobs`;
        const body = {
          limit: 1,
          offset: 0,
          searchText: "",
          appliedFacets: {},
          locale: "en_US",
        };
        const js = await proxyPostJSON(url, body);
        const posts = js?.jobPostings || js?.jobs || [];
        return setStatus(`OK: ${posts.length} job(s) (sample)`);
      }

      throw new Error(`Unsupported source: ${source}`);
    } catch (e) {
      setStatus(`❌ ${e.message || String(e)}`);
    }
  };

  const canApply =
    (SLUG_SOURCES.has(source) && !!slug) ||
    (source === "workday" && !!host && !!tenant) ||
    (source === "generic" && !!careers);

  return (
    <tr className="border-t align-top">
      <td className="p-3 font-medium">{row.company}</td>

      <td className="p-3">
        <select
          className="border rounded-lg px-2 py-1 bg-white"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">— select —</option>
          <option value="greenhouse">greenhouse</option>
          <option value="lever">lever</option>
          <option value="ashby">ashby</option>
          <option value="smartrecruiters">smartrecruiters</option>
          <option value="workable">workable</option>
          <option value="workday">workday</option>
          <option value="generic">generic</option>
        </select>
      </td>

      <td className="p-3">
        {/* Careers URL (optional, best signal) */}
        <div className="mb-2">
          <input
            className="border rounded-lg px-2 py-1 w-[28rem] bg-white"
            placeholder="Careers / jobs URL (paste here)"
            value={careers}
            onChange={(e) => setCareers(e.target.value)}
          />
          <button
            onClick={() => {
              const r = extractFromUrl(careers);
              if (r.ok) {
                setSource(r.source);
                if (r.slug) setSlug(r.slug);
                if (r.host) setHost(r.host);
                if (r.tenant) setTenant(r.tenant);
                if (r.board) setBoard(r.board);
                setStatus(`Parsed from URL: ${r.source}`);
              } else {
                setStatus("Couldn’t parse URL. Check it or try Discover.");
              }
            }}
            className="ml-2 px-2 py-1 border rounded-lg"
          >
            Parse URL
          </button>
        </div>

        {(source === "greenhouse" ||
          source === "lever" ||
          source === "ashby" ||
          source === "smartrecruiters" ||
          source === "workable") && (
          <input
            className="border rounded-lg px-2 py-1 w-60 bg-white"
            placeholder="slug e.g. figma / vercel / datadog"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        )}

        {source === "workday" && (
          <div className="flex flex-col gap-2 mt-2">
            <input
              className="border rounded-lg px-2 py-1 w-72 bg-white"
              placeholder="host e.g. wd5.myworkdayjobs.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
            <input
              className="border rounded-lg px-2 py-1 w-72 bg-white"
              placeholder="tenant e.g. acme"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
            />
            <input
              className="border rounded-lg px-2 py-1 w-72 bg-white"
              placeholder="board (External)"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
            />
          </div>
        )}
      </td>

      <td className="p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={tryDetect}
            disabled={busy}
            className="px-2 py-1 border rounded-lg"
          >
            {busy ? "Detecting…" : "Discover"}
          </button>
          <button onClick={validate} className="px-2 py-1 border rounded-lg">
            Validate
          </button>
          <button
            disabled={!canApply}
            onClick={() =>
              onApply({
                company: row.company,
                source,
                slug,
                host,
                tenant,
                board,
                careers,
              })
            }
            className={`px-2 py-1 rounded-lg ${
              canApply
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            Apply
          </button>
        </div>
        <div className="text-xs text-gray-600 mt-1 min-h-[1.25rem]">
          {status}
        </div>
      </td>
    </tr>
  );
}

export default function MissingRowsEditor({ companies, setCompanies }) {
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const missing = useMemo(() => {
    return (companies || []).filter((r) => {
      if (!r?.company) return false;
      const s = (r.source || "").toLowerCase();
      if (!s) return true;
      if (SLUG_SOURCES.has(s)) return !r.slug;
      if (s === "workday") return !r.host || !r.tenant;
      return true;
    });
  }, [companies]);

  const hasMissing = missing.length > 0;

  const applyRow = (patched) => {
    setCompanies((prev) =>
      prev.map((r) => (r.company === patched.company ? { ...r, ...patched } : r))
    );
  };

  const runBulkDiscover = async () => {
    setBulkBusy(true);
    let found = 0;
    try {
      for (const r of missing) {
        const res = await detectATSForCompanyRow(r);
        if (res.ok) {
          if (res.source === "workday") {
            applyRow({
              company: r.company,
              source: "workday",
              host: res.host,
              tenant: res.tenant,
              board: res.board || "External",
            });
          } else {
            applyRow({
              company: r.company,
              source: res.source,
              slug: res.slug,
            });
          }
          found++;
        }
        await new Promise((z) => setTimeout(z, 120));
      }
      setBulkMsg(
        `Auto-detected ${found} compan${found === 1 ? "y" : "ies"}. Review, then press "Check updates".`
      );
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="mt-6 border rounded-2xl bg-white">
      <div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="font-semibold">Fix missing company settings</div>
          <div className="text-sm text-gray-600">
            {hasMissing
              ? `${missing.length} compan${
                  missing.length === 1 ? "y" : "ies"
                } need ATS details.`
              : "All companies are configured 🎉"}
          </div>
          {hasMissing && bulkMsg && (
            <div className="text-xs text-gray-600 mt-1">{bulkMsg}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasMissing && (
            <button
              onClick={runBulkDiscover}
              disabled={bulkBusy}
              className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
            >
              {bulkBusy ? "Discovering…" : "Bulk Discover"}
            </button>
          )}
          <button
            onClick={() =>
              exportCompaniesExcel(
                "companies_detected.xlsx",
                companies.filter(isConfiguredRow)
              )
            }
            className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
          >
            Export detected
          </button>
          <button
            onClick={() =>
              exportCompaniesExcel(
                "companies_undetected.xlsx",
                companies.filter((c) => !isConfiguredRow(c))
              )
            }
            disabled={!hasMissing}
            className={`px-3 py-2 rounded-xl border ${
              hasMissing
                ? "bg-white hover:bg-gray-50"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Export undetected
          </button>
        </div>
      </div>

      {hasMissing && (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium">Company</th>
                <th className="text-left p-3 font-medium">ATS</th>
                <th className="text-left p-3 font-medium">Fields</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((r) => (
                <RowEditor key={r.company} row={r} onApply={applyRow} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
