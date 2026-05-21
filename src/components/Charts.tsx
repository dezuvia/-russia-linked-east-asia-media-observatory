import { useRef } from "react";
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

export type LabelPointClick = {
  date: string;
  labelCodes: string[];
};

export function TotalLineChart({
  data,
  height = 320
}: {
  data: Array<{ date: string; count: number }>;
  height?: number;
}) {
  const { language, t } = useI18n();
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <LineChart data={data} margin={{ top: 8, right: 20, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243244" />
          <XAxis dataKey="date" tickFormatter={(value) => compactDate(String(value), language)} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: "#101826", border: "1px solid #2f4058", borderRadius: 8, color: "#e5edf6" }}
            labelStyle={{ color: "#cbd5e1" }}
            labelFormatter={(value) => `${t("日期", "Date")} ${value}`}
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

const CHART_HORIZONTAL_PADDING = 64;

export function MultiLabelLineChart({
  data,
  labels,
  selected,
  onPointClick
}: {
  data: Array<{ date: string; counts: Record<string, number> }>;
  labels: Label[];
  selected: string[];
  onPointClick?: (point: LabelPointClick) => void;
}) {
  const { language, t } = useI18n();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const chartData = data.map((item) => ({
    date: item.date,
    ...item.counts
  }));
  const yAxisMax = Math.max(
    1,
    ...data.flatMap((item) => labels.map((label) => item.counts[label.code] ?? 0))
  );

  return (
    <ChartFrame
      clickable={Boolean(onPointClick && selected.length > 0)}
      height={320}
      onClick={(event) => {
        const point = chartFrameClickPoint(event, frameRef.current, data, selected);
        if (point) {
          onPointClick?.(point);
        }
      }}
      ref={frameRef}
    >
      <ResponsiveContainer width="100%" height={320} minWidth={0}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 20, left: -18, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#243244" />
          <XAxis dataKey="date" tickFormatter={(value) => compactDate(String(value), language)} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <YAxis allowDecimals={false} domain={[0, yAxisMax]} tickLine={false} axisLine={false} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: "#101826", border: "1px solid #2f4058", borderRadius: 8, color: "#e5edf6" }}
            labelStyle={{ color: "#cbd5e1" }}
            labelFormatter={(value) => `${t("日期", "Date")} ${value}`}
          />
          <Legend />
          {labels
            .map((label, index) => ({ label, index }))
            .filter(({ label }) => selected.includes(label.code))
            .map(({ label, index }) => {
              const color = CHART_COLORS[index % CHART_COLORS.length];
              return (
                <Line
                  key={label.code}
                  type="monotone"
                  dataKey={label.code}
                  name={labelText(label, language)}
                  stroke={color}
                  strokeWidth={2}
                  dot={<ClickableDot color={color} />}
                  activeDot={<ClickableDot active color={color} />}
                />
              );
            })}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function ClickableDot({
  cx,
  cy,
  color,
  active = false
}: {
  cx?: number;
  cy?: number;
  color: string;
  active?: boolean;
}) {
  if (typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      fill={color}
      r={active ? 5 : 2.75}
      role="button"
      style={{ cursor: "pointer" }}
      tabIndex={-1}
    />
  );
}

function chartFrameClickPoint(
  event: React.MouseEvent<HTMLDivElement>,
  element: HTMLDivElement | null,
  data: Array<{ date: string; counts: Record<string, number> }>,
  selected: string[]
): LabelPointClick | null {
  if (!element || data.length === 0 || selected.length === 0) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const plotLeft = Math.min(CHART_HORIZONTAL_PADDING, rect.width * 0.18);
  const plotRight = Math.max(plotLeft + 1, rect.width - 24);
  const clampedX = Math.max(plotLeft, Math.min(event.clientX - rect.left, plotRight));
  const ratio = data.length === 1 ? 0 : (clampedX - plotLeft) / (plotRight - plotLeft);
  const index = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
  return { date: data[index].date, labelCodes: selected };
}

function ChartFrame({
  children,
  height = 320,
  onClick,
  clickable = false,
  ref
}: {
  children: React.ReactNode;
  height?: number;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  clickable?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      className={`chart-frame ${clickable ? "clickable-chart-frame" : ""}`}
      onClick={onClick}
      ref={ref}
      style={{ height }}
    >
      {children}
    </div>
  );
}
