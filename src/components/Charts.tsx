import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { Label } from "../types";
import { CHART_COLORS, compactDate, labelText } from "../format";
import { useI18n } from "../i18n";

export function TotalLineChart({
  data
}: {
  data: Array<{ weekStart: string; count: number }>;
}) {
  const { language, t } = useI18n();
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height={320} minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243244" />
          <XAxis dataKey="weekStart" tickFormatter={(value) => compactDate(String(value), language)} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: "#101826", border: "1px solid #2f4058", borderRadius: 8, color: "#e5edf6" }}
            labelStyle={{ color: "#cbd5e1" }}
            labelFormatter={(value) => `${t("週起始", "Week of")} ${value}`}
          />
          <Line
            type="monotone"
            dataKey="count"
            name={t("總文章數", "Total Articles")}
            stroke="#60a5fa"
            strokeWidth={2.5}
            dot={{ r: 2 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function MultiLabelLineChart({
  data,
  labels,
  selected
}: {
  data: Array<{ weekStart: string; counts: Record<string, number> }>;
  labels: Label[];
  selected: string[];
}) {
  const { language, t } = useI18n();
  const chartData = data.map((item) => ({
    weekStart: item.weekStart,
    ...item.counts
  }));

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height={320} minWidth={0}>
        <LineChart data={chartData} margin={{ top: 8, right: 20, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243244" />
          <XAxis dataKey="weekStart" tickFormatter={(value) => compactDate(String(value), language)} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: "#101826", border: "1px solid #2f4058", borderRadius: 8, color: "#e5edf6" }}
            labelStyle={{ color: "#cbd5e1" }}
            labelFormatter={(value) => `${t("週起始", "Week of")} ${value}`}
          />
          <Legend />
          {labels
            .filter((label) => selected.includes(label.code))
            .map((label, index) => (
              <Line
                key={label.code}
                type="monotone"
                dataKey={label.code}
                name={labelText(label, language)}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return <div className="chart-frame">{children}</div>;
}
