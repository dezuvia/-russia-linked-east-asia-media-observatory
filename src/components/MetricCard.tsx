import type { ReactNode } from "react";

export function MetricCard({
  title,
  value,
  note,
  icon
}: {
  title: string;
  value: number | string;
  note?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card metric-card">
      <div className="card-body">
        <div className="d-flex align-items-center">
          {icon && <div className="metric-icon">{icon}</div>}
          <div>
            <div className="text-secondary metric-title">{title}</div>
            <div className="h1 mb-0">{value}</div>
            {note && <div className="text-secondary small mt-1">{note}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
