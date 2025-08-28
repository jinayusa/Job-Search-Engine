export default function Stat({ label, value }) {
  return (
    <div className="p-4 rounded-2xl shadow-sm bg-white border">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
