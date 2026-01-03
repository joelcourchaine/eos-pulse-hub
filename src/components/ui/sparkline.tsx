import { LineChart, Line, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";

interface SparklineProps {
  data: (number | null | undefined)[];
  className?: string;
  color?: string;
}

export const Sparkline = ({ data, className = "", color }: SparklineProps) => {
  const [strokeColor, setStrokeColor] = useState("#3b82f6");
  
  useEffect(() => {
    // Get the computed primary color from CSS variables
    const computedColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim();
    
    if (computedColor) {
      setStrokeColor(`hsl(${computedColor})`);
    }
  }, []);

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
            stroke={color || strokeColor}
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
