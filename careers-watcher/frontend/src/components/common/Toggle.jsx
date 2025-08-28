import { cx } from "../../utils/index.js";
export default function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={cx("w-10 h-6 rounded-full p-1 transition-colors", checked ? "bg-blue-600" : "bg-gray-300")}>
        <span className={cx("block w-4 h-4 bg-white rounded-full translate-y-0.5 transition-transform", checked ? "translate-x-4" : "translate-x-0")} />
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
