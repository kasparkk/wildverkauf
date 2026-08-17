const styles: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  reserved: "bg-amber-100 text-amber-800",
  sold: "bg-stone-200 text-stone-600",
  bezahlt: "bg-green-100 text-green-800",
  offen: "bg-red-100 text-red-800",
};

const labels: Record<string, string> = {
  available: "Verfügbar",
  reserved: "Reserviert",
  sold: "Verkauft",
  bezahlt: "Bezahlt",
  offen: "Offen",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[status] ?? "bg-stone-100 text-stone-700"
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
