export default function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-4 shadow-sm">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="text-2xl font-bold text-forest-800 mt-1">{value}</div>
      {hint && <div className="text-xs text-stone-400 mt-1">{hint}</div>}
    </div>
  );
}
