interface Props {
  label: string;
  value: number;
  icon?: React.ReactNode;
  delta?: number; // % change
}

export function MetricCard({ label, value, icon, delta }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {delta !== undefined && (
        <p className={`text-xs mt-1 font-medium ${delta >= 0 ? "text-green-600" : "text-red-500"}`}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs prev period
        </p>
      )}
    </div>
  );
}
