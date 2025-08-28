export default function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      className="border rounded-xl px-3 py-2 w-full bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
