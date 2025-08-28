// robust proxy helpers (JSON + TEXT) with timeout and better errors
const API_BASE = import.meta.env.VITE_API_BASE || "";

function withTimeout(promise, ms = 15000) {
  const t = new Promise((_, rej) => setTimeout(() => rej(new Error("Request timeout")), ms));
  return Promise.race([promise, t]);
}

async function parseMaybeJSON(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function errFor(res, body) {
  const brief = typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200);
  return new Error(`Proxy ${res.status} ${res.statusText} — ${brief}`);
}

export async function proxyGetJSON(url) {
  const res = await withTimeout(
    fetch(`${API_BASE}/proxy?url=${encodeURIComponent(url)}`, {
      method: "GET",
      headers: { Accept: "application/json, text/plain, */*" },
    })
  );
  const body = await parseMaybeJSON(res);
  if (!res.ok) throw errFor(res, body);
  if (typeof body === "string") throw new Error(`Expected JSON, got text: ${body.slice(0,120)}`);
  return body;
}

export async function proxyPostJSON(url, json) {
  const res = await withTimeout(
    fetch(`${API_BASE}/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, */*" },
      body: JSON.stringify({ url, method: "POST", json }),
    })
  );
  const body = await parseMaybeJSON(res);
  if (!res.ok) throw errFor(res, body);
  if (typeof body === "string") throw new Error(`Expected JSON, got text: ${body.slice(0,120)}`);
  return body;
}

export async function proxyGetText(url) {
  const res = await withTimeout(
    fetch(`${API_BASE}/proxy?url=${encodeURIComponent(url)}`, {
      method: "GET",
      headers: { Accept: "text/html, text/plain, */*" },
    })
  );
  const text = await res.text();
  if (!res.ok) throw errFor(res, text);
  return text;
}
