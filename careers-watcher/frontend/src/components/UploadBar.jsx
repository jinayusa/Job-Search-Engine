import { downloadTemplate } from "../services/excel";

export default function UploadBar({ onFile, onReset }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={downloadTemplate} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">Download template</button>
      <label className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 cursor-pointer">
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
        Upload Excel
      </label>
      <button onClick={onReset} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">Reset</button>
    </div>
  );
}
