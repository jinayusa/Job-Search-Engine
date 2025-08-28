import Stat from "./common/Stat";

export default function StatsBar({ companiesCount, totalJobs, newCount, onExport }) {
  return (
    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat label="Companies loaded" value={companiesCount} />
      <Stat label="Jobs in window" value={totalJobs} />
      <Stat label="New since load" value={newCount} />
      <div className="p-4 rounded-2xl border bg-white flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-gray-500">Export</div>
          <div className="text-xs text-gray-500">CSV of current table</div>
        </div>
        <button onClick={onExport} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">Download CSV</button>
      </div>
    </div>
  );
}
