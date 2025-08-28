// frontend/src/services/connectors.js
import { UTC } from "../utils/index.js";
import { proxyGetJSON, proxyPostJSON, proxyGetText } from "./proxy.js";
import { extractFromUrl } from "./atsDetect.js";

/* ---------------------------- Common helpers ----------------------------- */

const SLUG_SOURCES = new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "workable"]);

function safeString(x) {
  return (x == null ? "" : String(x));
}

function mkLocation(parts) {
  const arr = Array.isArray(parts) ? parts : [parts];
  return arr
    .flatMap((p) =>
      typeof p === "string"
        ? [p]
        : [p?.city || p?.addressLocality, p?.region || p?.addressRegion, p?.country || p?.addressCountry]
    )
    .filter(Boolean)
    .join(", ");
}

function slugifyForUrl(s) {
  return safeString(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function hashId(s) {
  // small stable hash for generic ids
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/* ------------------------------ Greenhouse ------------------------------- */

export async function fetchGreenhouse(slug) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const json = await proxyGetJSON(url);
  const now = UTC();

  const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
  return jobs.map((j, i) => ({
    id: `greenhouse:${slug}:${j.id ?? i}`,
    company: j?.offices?.[0]?.name || slug, // overwrite to real company later in runFetch
    source: "greenhouse",
    title: j.title || "Job",
    location: mkLocation(j?.offices?.map((o) => o.name) || j.location),
    department: j?.departments?.map((d) => d.name).join(" / ") || "",
    url: j.absolute_url || j?.internal_job_id || "",
    postedAt: j.updated_at || j.created_at || null,
    firstSeenAt: now,
  }));
}

/* --------------------------------- Lever -------------------------------- */

export async function fetchLever(slug) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const json = await proxyGetJSON(url);
  const now = UTC();

  const list = Array.isArray(json) ? json : [];
  return list.map((p, i) => ({
    id: `lever:${slug}:${p?.id ?? i}`,
    company: slug,
    source: "lever",
    title: p?.text || p?.title || "Job",
    location: mkLocation(p?.categories?.location || p?.workplaceType),
    department: p?.categories?.team || p?.department || "",
    url: p?.hostedUrl || p?.applyUrl || p?.leverUrl || "",
    postedAt: p?.createdAt ? new Date(p.createdAt).toISOString() : null,
    firstSeenAt: now,
  }));
}

/* -------------------------------- Workday ------------------------------- */

async function fetchAllWorkdayPages({ host, tenant, board = "External" }) {
  const pageSize = 200;
  let offset = 0;
  let out = [];
  while (true) {
    const url = `https://${host}/wday/cxs/${tenant}/${board}/jobs`;
    const body = {
      limit: pageSize,
      offset,
      searchText: "",
      appliedFacets: {},
      locale: "en_US",
    };
    const js = await proxyPostJSON(url, body);
    const posts = js?.jobPostings || js?.jobs || [];
    out = out.concat(posts);
    if (posts.length < pageSize) break;
    offset += pageSize;
    // tiny throttle to be nice
    await new Promise((r) => setTimeout(r, 120));
    if (offset > 1000) break; // soft cap
  }
  return out;
}

export async function fetchWorkday({ host, tenant, board = "External" }) {
  if (!host || !tenant) throw new Error("Workday needs host + tenant");
  const now = UTC();
  const items = await fetchAllWorkdayPages({ host, tenant, board });

  return items.map((p, i) => ({
    id: `workday:${host}:${tenant}:${p?.bulletFields?.jobId || p?.id || i}`,
    company: p?.hiringCompany || tenant,
    source: "workday",
    title: p?.title || p?.displayTitle || "Job",
    location:
      mkLocation(
        p?.locations?.map((loc) => loc?.shortName || loc?.name) ||
          p?.locationsText ||
          p?.location
      ) || "",
    department: p?.department || p?.teams?.[0] || "",
    url:
      p?.externalPath
        ? `https://${host}${p.externalPath}`
        : p?.jobRequisitionLocation || "",
    postedAt: p?.postedOn || p?.postedDate || p?.postedOnDate || null,
    firstSeenAt: now,
  }));
}

/* --------------------------------- Ashby -------------------------------- */

export async function fetchAshby(slug) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  const json = await proxyGetJSON(url);
  const now = UTC();

  let jobs = [];
  if (Array.isArray(json?.jobs)) jobs = json.jobs;
  if (Array.isArray(json?.jobBoard?.sections)) {
    for (const s of json.jobBoard.sections) if (Array.isArray(s?.jobs)) jobs.push(...s.jobs);
  }

  return jobs.map((j, i) => ({
    id: `ashby:${slug}:${j.id || j.jobId || i}`,
    company: slug,
    source: "ashby",
    title: j.title || j.jobTitle || "Job",
    location: mkLocation(j?.location?.name || j?.location || j?.cities?.[0]?.text),
    department: j?.department?.name || j?.team || "",
    url: j?.externalLink || j?.jobUrl || j?.applyUrl || j?.publicUrl || "",
    postedAt: j?.publishedAt || j?.updatedAt || j?.createdAt || null,
    firstSeenAt: now,
  }));
}

/* --------------------------- SmartRecruiters ----------------------------- */

export async function fetchSmartRecruiters(slug) {
  const s = safeString(slug).toLowerCase();
  const url = `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=200`;
  const json = await proxyGetJSON(url);
  const now = UTC();
  const list = Array.isArray(json?.content) ? json.content : [];

  return list.map((p) => {
    const title = p?.name || "Job";
    const id = p?.id || title;
    const publicUrl = `https://jobs.smartrecruiters.com/${s}/${id}-${slugifyForUrl(title)}`;
    return {
      id: `smartrecruiters:${s}:${id}`,
      company: s,
      source: "smartrecruiters",
      title,
      location: mkLocation(p?.location),
      department: p?.department?.label || "",
      url: p?.applyUrl || publicUrl,
      postedAt: p?.releasedDate || p?.createdOn || null,
      firstSeenAt: now,
    };
  });
}

/* -------------------------------- Workable ------------------------------- */

export async function fetchWorkable(slug) {
  const s = safeString(slug).toLowerCase();
  const url = `https://apply.workable.com/api/v3/accounts/${s}/jobs?limit=200`;
  const json = await proxyGetJSON(url);
  const now = UTC();
  const results = Array.isArray(json?.results) ? json.results : [];

  return results.map((r, i) => ({
    id: `workable:${s}:${r?.id || r?.shortcode || i}`,
    company: s,
    source: "workable",
    title: r?.title || "Job",
    location: mkLocation(
      r?.location?.city
        ? [r.location.city, r.location.region, r.location.country]
        : r?.location?.country
    ),
    department: r?.department || "",
    url: r?.application_url || r?.shortlink || r?.url || "",
    postedAt: r?.published || r?.updated || null,
    firstSeenAt: now,
  }));
}

/* ------------------------------- Generic --------------------------------- */
/* Read a company's own careers page:
   1) parse JSON-LD JobPosting blocks
   2) if none, discover embedded ATS links and delegate to a known connector
*/

function extractJSONLDJobs(html) {
  // Uses DOMParser available in the browser environment (Vite app)
  const doc = new DOMParser().parseFromString(html, "text/html");
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const nodes = [];
  for (const s of scripts) {
    const text = s.textContent || s.innerText || "";
    if (!text.trim()) continue;
    try {
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : json?.["@graph"] ? json["@graph"] : [json];
      for (const n of arr) {
        const t = n?.["@type"] || n?.type;
        const types = Array.isArray(t) ? t : t ? [t] : [];
        if (types.some((x) => /JobPosting/i.test(x))) nodes.push(n);
      }
    } catch {
      /* ignore invalid JSON-LD */
    }
  }
  return nodes;
}

function mapJSONLDToJobs(nodes, { companyFallback }) {
  const now = UTC();
  const jobs = [];
  for (const n of nodes) {
    const title = n?.title || n?.name || "";
    if (!title) continue;

    const url =
      n?.url || n?.applyUrl || n?.hiringOrganization?.sameAs || n?.atsApplyUrl || "";
    const org = n?.hiringOrganization?.name || companyFallback || "";

    const addr = n?.jobLocation?.address || n?.jobLocation?.addressCountry || n?.jobLocation;
    const location =
      typeof addr === "string"
        ? addr
        : mkLocation([addr?.addressLocality, addr?.addressRegion, addr?.addressCountry]);

    const postedAt = n?.datePosted || n?.datePublished || n?.validFrom || null;
    const dept = n?.department?.name || n?.department || "";

    const id = `generic:${hashId(`${org}:${title}:${url || ""}:${postedAt || ""}`)}`;
    jobs.push({
      id,
      company: org,
      source: "generic",
      title,
      location,
      department: dept,
      url: url || "",
      postedAt,
      firstSeenAt: now,
    });
  }
  return jobs;
}

function findKnownATSLinks(html) {
  const urls = new Set();
  const rx = /https?:\/\/[^\s"'<>]+/gi;
  let m;
  while ((m = rx.exec(html))) {
    const u = m[0];
    if (/(greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|smartrecruiters\.com|workable\.com)/i.test(u)) {
      urls.add(u.replace(/["')\]]+$/, ""));
    }
  }
  return [...urls];
}

export async function fetchGeneric(row) {
  const url = row?.careers;
  if (!url) throw new Error("generic source requires a careers URL");
  const html = await proxyGetText(url);

  // 1) JSON-LD
  const nodes = extractJSONLDJobs(html);
  const jobs = mapJSONLDToJobs(nodes, { companyFallback: row.company });
  if (jobs.length) return jobs;

  // 2) Look for embedded ATS links and delegate
  const links = findKnownATSLinks(html);
  for (const href of links) {
    const parsed = extractFromUrl(href);
    if (!parsed.ok) continue;

    if (parsed.source === "greenhouse" && parsed.slug && CONNECTORS.greenhouse) {
      return CONNECTORS.greenhouse({ slug: parsed.slug, company: row.company });
    }
    if (parsed.source === "lever" && parsed.slug && CONNECTORS.lever) {
      return CONNECTORS.lever({ slug: parsed.slug, company: row.company });
    }
    if (parsed.source === "ashby" && parsed.slug && CONNECTORS.ashby) {
      return CONNECTORS.ashby({ slug: parsed.slug, company: row.company });
    }
    if (parsed.source === "smartrecruiters" && parsed.slug && CONNECTORS.smartrecruiters) {
      return CONNECTORS.smartrecruiters({ slug: parsed.slug, company: row.company });
    }
    if (parsed.source === "workable" && parsed.slug && CONNECTORS.workable) {
      return CONNECTORS.workable({ slug: parsed.slug, company: row.company });
    }
    if (
      parsed.source === "workday" &&
      parsed.host &&
      parsed.tenant &&
      CONNECTORS.workday
    ) {
      return CONNECTORS.workday({
        host: parsed.host,
        tenant: parsed.tenant,
        board: parsed.board || "External",
        company: row.company,
      });
    }
  }

  // 3) Nothing extractable
  return [];
}

/* ------------------------------- Registry -------------------------------- */

export const CONNECTORS = {
  greenhouse: (row) => fetchGreenhouse(row.slug),
  lever: (row) => fetchLever(row.slug),
  workday: (row) => fetchWorkday(row),
  ashby: (row) => fetchAshby(row.slug),
  smartrecruiters: (row) => fetchSmartRecruiters(row.slug),
  workable: (row) => fetchWorkable(row.slug),
  generic: (row) => fetchGeneric(row),
};
