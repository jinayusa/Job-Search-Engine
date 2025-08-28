import TextInput from "./common/TextInput";
import Select from "./common/Select";
import Toggle from "./common/Toggle";
import { cx } from "../utils/index.js";

export default function ControlsBar({
  query, setQuery,
  hours, setHours,
  autoRefresh, setAutoRefresh,
  intervalMin, setIntervalMin,
  loading, onCheckUpdates
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-4">
      <div className="md:col-span-2">
        <TextInput value={query} onChange={setQuery} placeholder="Filter by keyword, e.g., backend, Python, Kafka" />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Window</span>
        <Select value={String(hours)} onChange={(v) => setHours(Number(v))} options={[
          { value: "6", label: "Last 6h" },
          { value: "12", label: "Last 12h" },
          { value: "24", label: "Last 24h" },
          { value: "72", label: "Last 3 days" },
          { value: "168", label: "Last 7 days" },
        ]} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Toggle checked={autoRefresh} onChange={setAutoRefresh} label="Auto refresh" />
        <div className="flex items-center gap-2 text-sm">
          <span>every</span>
          <input type="number" min={1} value={intervalMin} onChange={(e)=>setIntervalMin(e.target.value)} className="w-20 border rounded-xl px-2 py-1 bg-white" />
          <span>min</span>
        </div>
        <button onClick={onCheckUpdates} className={cx("px-4 py-2 rounded-xl text-white", loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700")}>
          {loading ? "Fetching..." : "Check updates"}
        </button>
      </div>
    </div>
  );
}
