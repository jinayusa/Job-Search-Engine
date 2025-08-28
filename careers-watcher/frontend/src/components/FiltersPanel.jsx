import { ROLE_DEFS } from "../roles";

export default function FiltersPanel({
  companies,
  selectedSources, setSelectedSources,
  selectedCompanies, setSelectedCompanies,
  selectedRoles, setSelectedRoles
}) {
  const allCompanyOptions = companies.map((c) => ({ label: c.company, value: c.company }));
  const toggleSource = (key) => setSelectedSources((p) => ({ ...p, [key]: !p[key] }));
  const toggleRole = (key) => setSelectedRoles((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  const onCompaniesChange = (e) => {
    const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedCompanies(vals);
  };

  return (
    <div className="mt-4 p-4 border rounded-2xl bg-white">
      <div className="grid gap-4 md:grid-cols-3">
        {/* ATS */}
        <div>
          <div className="text-sm font-medium mb-2">ATS</div>
          <div className="flex flex-wrap gap-3">
            {["greenhouse","lever","workday","ashby","smartrecruiters","workable"].map((s) => (
              <label key={s} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!selectedSources[s]} onChange={() => toggleSource(s)} />
                <span className="capitalize">{s}</span>
              </label>
            ))}
          </div>
        </div>
        {/* Companies */}
        <div>
          <div className="text-sm font-medium mb-2">Companies</div>
          <select multiple size={Math.min(6, Math.max(3, allCompanyOptions.length))} value={selectedCompanies}
                  onChange={onCompaniesChange} className="border rounded-xl px-3 py-2 bg-white w-full">
            {allCompanyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="mt-2 flex gap-2 text-xs">
            <button onClick={() => setSelectedCompanies(allCompanyOptions.map(o => o.value))} className="px-2 py-1 border rounded-lg">Select all</button>
            <button onClick={() => setSelectedCompanies([])} className="px-2 py-1 border rounded-lg">Clear</button>
          </div>
        </div>
        {/* Roles */}
        <div>
          <div className="text-sm font-medium mb-2">Roles</div>
          <div className="flex flex-wrap gap-2">
            {ROLE_DEFS.map((r) => (
              <label key={r.key} className={`px-2 py-1 rounded-full border text-xs cursor-pointer ${selectedRoles.includes(r.key) ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50"}`}>
                <input type="checkbox" className="sr-only" checked={selectedRoles.includes(r.key)} onChange={() => toggleRole(r.key)} />
                {r.label}
              </label>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">Select none to include all roles.</div>
        </div>
      </div>
    </div>
  );
}
