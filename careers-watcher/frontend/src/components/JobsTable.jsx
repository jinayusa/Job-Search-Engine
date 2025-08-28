import Badge from "./common/Badge";
import { timeAgo } from "../utils/index.js";

export default function JobsTable({ jobs, error }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Recent postings</h2>
      {error && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-xl border">{String(error)}</div>}
      {jobs.length === 0 ? (
        <div className="text-gray-600 text-sm">
          No results yet. Click Check updates after uploading your Excel file or adjust the filters.
        </div>
      ) : (
        <div className="overflow-auto border rounded-2xl bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium">Company</th>
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Location</th>
                <th className="text-left p-3 font-medium">Department</th>
                <th className="text-left p-3 font-medium">Posted</th>
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">{j.company}</td>
                  <td className="p-3 min-w-[18rem]">
                    {j.title}{" "}
                    {j.isNew && (
                      <span className="ml-2 text-xs text-white bg-green-600 rounded-full px-2 py-0.5">
                        New
                      </span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">{j.location}</td>
                  <td className="p-3 whitespace-nowrap">{j.department}</td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{j.postedAt ? new Date(j.postedAt).toLocaleString() : ""}</span>
                      <span className="text-gray-500">{timeAgo(j.postedAt || j.firstSeenAt)}</span>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap"><Badge>{j.source}</Badge></td>
                  <td className="p-3 whitespace-nowrap">
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Open</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
