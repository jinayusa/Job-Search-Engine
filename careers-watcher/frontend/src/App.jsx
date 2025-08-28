import { useEffect, useMemo, useRef, useState } from "react";
import { toCompanyRowsFromSheet, exportCSV, readWorkbookFirstCompaniesSheet } from "./services/excel.js";

import UploadBar from "./components/UploadBar";
import ControlsBar from "./components/ControlsBar";
import FiltersPanel from "./components/FiltersPanel";
import CompaniesTable from "./components/CompaniesTable";
import JobsTable from "./components/JobsTable";
import StatsBar from "./components/StatsBar";
import MissingRowsEditor from "./components/MissingRowsEditor";
import useLocalStorage from "./hooks/useLocalStorage";
import { cx, UTC, sleep, withinWindow } from "./utils/index.js";
import { CONNECTORS } from "./services/connectors";
import { matchesSelectedRoles } from "./roles";

export default function App() {
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [query, setQuery] = useState("");
  const [hours, setHours] = useState(24);
  const [autoRefresh, setAutoRefresh] = useLocalStorage("cw:auto", false);
  const [intervalMin, setIntervalMin] = useLocalStorage("cw:interval", 10);
  const [seen, setSeen] = useLocalStorage("cw:seen", {});
  const [selectedSources, setSelectedSources] = useState({  greenhouse: true, lever: true, workday: true, ashby: true, smartrecruiters: true, workable: true });
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);

  const timerRef = useRef(null);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => { runFetch(); }, Math.max(1, Number(intervalMin)) * 60 * 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, intervalMin, companies]);

  // Filtering
  function filterJobs(all) {
    const parts = query.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((j) => {
      if (!withinWindow(j.postedAt || j.firstSeenAt, hours)) return false;
      if (!selectedSources[j.source]) return false;
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(j.company)) return false;
      if (!matchesSelectedRoles(j, selectedRoles)) return false;
      if (parts.length) {
        const hay = `${j.company} ${j.title} ${j.location} ${j.department}`.toLowerCase();
        if (!parts.every((p) => hay.includes(p))) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.postedAt || b.firstSeenAt) - new Date(a.postedAt || a.firstSeenAt));
  }
  const displayed = useMemo(() => filterJobs(jobs), [jobs, query, hours, selectedSources, selectedCompanies, selectedRoles]);

  const stats = useMemo(() => {
    const newCount = displayed.filter((j) => j.isNew).length;
    const companiesSet = new Set(jobs.map((j) => j.company));
    return { total: displayed.length, newCount, companies: companiesSet.size };
  }, [displayed, jobs]);

  // Fetch
  // Supports: greenhouse, lever, workday, ashby, smartrecruiters, workable
async function runFetch() {
  setError("");
  if (!companies.length) { setError("Upload an Excel file with companies first."); return; }
  setLoading(true);

  // sources that require only a slug
  const SLUG_SOURCES = new Set(["greenhouse","lever","ashby","smartrecruiters","workable"]);

  try {
    const all = [];
    const skipped = { noSource: 0, noSlug: 0, noWorkday: 0, unknownSource: 0 };

    for (const row of companies) {
      const source = (row.source || "").toLowerCase();

      // validate per ATS
      if (!source) { skipped.noSource++; continue; }
      if (SLUG_SOURCES.has(source) && !row.slug) { skipped.noSlug++; continue; }
      if (source === "workday" && (!row.host || !row.tenant)) { skipped.noWorkday++; continue; }
      if (source === "generic" && !row.careers) { skipped.noCareers++; continue; } // ✅ add this

      const fn = CONNECTORS[source];
      if (!fn) { skipped.unknownSource++; continue; }

      try {
        const items = await fn(row);
        // ensure company name is preserved (some connectors return slug)
        items.forEach((it) => (it.company = row.company));
        all.push(...items);
        await sleep(150); // light throttle; keep if vendors rate-limit
      } catch (e) {
        console.warn("Fetch error for", row.company, row, e);
        // swallow individual fetch errors so others still load
      }
    }

    // Summarize skips (only if any)
    const parts = [];
    if (skipped.noSource)      parts.push(`${skipped.noSource} missing source`);
    if (skipped.noSlug)        parts.push(`${skipped.noSlug} missing slug (for greenhouse/lever/ashby/smartrecruiters/workable)`);
    if (skipped.noWorkday)     parts.push(`${skipped.noWorkday} missing host+tenant (workday)`);
    if (skipped.unknownSource) parts.push(`${skipped.unknownSource} unknown source`);
    if (skipped.noCareers)     parts.push(`${skipped.noCareers} missing careers URL (generic)`); // ✅ add this

    if (parts.length) setError(`Skipped: ${parts.join("; ")}.`);

    // Enrich + "new" markers
    const newSeen = { ...seen };
    const enriched = all.map((j) => {
      const first = seen[j.id] || j.firstSeenAt || UTC();
      newSeen[j.id] = first;
      return { ...j, isNew: withinWindow(j.postedAt || first, hours) && !seen[j.id] };
    });

    setSeen(newSeen);
    setJobs(enriched);
  } catch (e) {
    setError(e.message || String(e));
  } finally {
    setLoading(false);
  }
}



  // Upload handler
  function onFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const { ws, sheetName } = readWorkbookFirstCompaniesSheet(evt.target.result);
      const rows = toCompanyRowsFromSheet(ws, { strict: false });

      if (rows.length === 0) {
        throw new Error(
          `No valid rows found on "${sheetName}". Make sure headers are: company, source, slug (for greenhouse/lever) or host+tenant (for workday).`
        );
      }

      setCompanies(rows);
      setSelectedCompanies([]);
      setError("");
    } catch (err) {
      console.error("Excel parse error:", err);
      setCompanies([]);
      setError(`Could not parse the file: ${err?.message || String(err)}`);
    }
  };
  reader.onerror = () => setError("Could not read the file (FileReader error).");
  reader.readAsArrayBuffer(file);
}



  function onReset() {
    setCompanies([]); setJobs([]); setSeen({});
    setSelectedCompanies([]); setSelectedRoles([]);
    setSelectedSources({ greenhouse: true, lever: true, workday: true });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Careers Watcher</h1>
            <p className="text-gray-600 mt-1">Upload your Excel list of companies, then check the newest openings across their career pages.</p>
          </div>
          <UploadBar onFile={onFile} onReset={onReset} />
        </div>

        {/* Controls */}
        <ControlsBar
          query={query} setQuery={setQuery}
          hours={hours} setHours={setHours}
          autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh}
          intervalMin={intervalMin} setIntervalMin={setIntervalMin}
          loading={loading} onCheckUpdates={runFetch}
        />

        {/* Filters */}
        <FiltersPanel
          companies={companies}
          selectedSources={selectedSources} setSelectedSources={setSelectedSources}
          selectedCompanies={selectedCompanies} setSelectedCompanies={setSelectedCompanies}
          selectedRoles={selectedRoles} setSelectedRoles={setSelectedRoles}
        />
        <MissingRowsEditor companies={companies} setCompanies={setCompanies} />
        {/* Stats */}
        <StatsBar
          companiesCount={companies.length}
          totalJobs={stats.total}
          newCount={stats.newCount}
          onExport={() => exportCSV(`jobs_${Date.now()}.csv`, displayed)}
        />

        {/* Tables */}
        
        <JobsTable jobs={displayed} error={error} />
        <CompaniesTable companies={companies} />
        {/* Footer */}
        <div className="mt-8 text-xs text-gray-500">
          Tip: Some vendors like Workday block browser requests. Use the proxy by setting VITE_API_BASE in .env.local and running the server.
        </div>
      </div>
    </div>
  );
}
