import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: (number | null | undefined)[];
  className?: string;
  color?: string;
}

export const Sparkline = ({ data, className = "", color = "hsl(var(--primary))" }: SparklineProps) => {
  // Filter out null/undefined values and create chart data
  const chartData = data.map((value, index) => ({
    index,
    value: value ?? null,
  }));

  // Check if we have any valid data
  const hasData = data.some(v => v !== null && v !== undefined);
  
  if (!hasData) {
    return null;
  }

  return (
    <div className={`w-full h-8 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
