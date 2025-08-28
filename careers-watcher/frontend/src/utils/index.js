// frontend/src/utils/index.js

// Generic utilities
export const UTC = () => new Date().toISOString();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const cx = (...xs) => xs.filter(Boolean).join(" ");

// Pretty “time ago” text
export function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// “Within last N hours?”
export function withinWindow(iso, hours) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= hours * 3600 * 1000;
}
