export default function Select({ value, onChange, options, ...props }) {
  return (
    <select className="border rounded-xl px-3 py-2 bg-white" value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
