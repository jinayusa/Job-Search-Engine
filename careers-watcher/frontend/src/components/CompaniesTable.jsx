import Badge from "./common/Badge";

export default function CompaniesTable({ companies }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Companies</h2>
      {companies.length === 0 ? (
        <div className="text-gray-600 text-sm">
          No companies yet. Upload the Excel template with columns company, source, slug, and for Workday host and tenant.
        </div>
      ) : (
        <div className="overflow-auto border rounded-2xl bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium">Company</th>
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Slug</th>
                <th className="text-left p-3 font-medium">Host</th>
                <th className="text-left p-3 font-medium">Tenant</th>
                <th className="text-left p-3 font-medium">Board</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{c.company}</td>
                  <td className="p-3"><Badge>{c.source}</Badge></td>
                  <td className="p-3"><code className="text-xs bg-gray-50 px-2 py-1 rounded">{c.slug}</code></td>
                  <td className="p-3"><code className="text-xs bg-gray-50 px-2 py-1 rounded">{c.host}</code></td>
                  <td className="p-3"><code className="text-xs bg-gray-50 px-2 py-1 rounded">{c.tenant}</code></td>
                  <td className="p-3"><code className="text-xs bg-gray-50 px-2 py-1 rounded">{c.board}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
