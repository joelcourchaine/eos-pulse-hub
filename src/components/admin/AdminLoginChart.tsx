import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  format,
  subDays,
  subMonths,
  startOfDay,
  startOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachHourOfInterval,
} from "date-fns";

type TimeRange = "1d" | "1w" | "1m" | "6m" | "1y";

interface ChartDataPoint {
  label: string;
  count: number;
  date: Date;
}

export const AdminLoginChart = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("1w");

  const getDateRange = (range: TimeRange) => {
    const now = new Date();
    switch (range) {
      case "1d":
        return { start: subDays(now, 1), end: now };
      case "1w":
        return { start: subDays(now, 7), end: now };
      case "1m":
        return { start: subMonths(now, 1), end: now };
      case "6m":
        return { start: subMonths(now, 6), end: now };
      case "1y":
        return { start: subMonths(now, 12), end: now };
    }
  };

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["admin-login-chart", timeRange],
    queryFn: async (): Promise<ChartDataPoint[]> => {
      const { start, end } = getDateRange(timeRange);

      const { data: logins, error } = await supabase
        .from("profiles")
        .select("last_sign_in_at")
        .not("last_sign_in_at", "is", null)
        .gte("last_sign_in_at", start.toISOString())
        .lte("last_sign_in_at", end.toISOString())
        .eq("is_system_user", false);

      if (error) throw error;

      let buckets: Date[];
      let formatStr: string;

      if (timeRange === "1d") {
        buckets = eachHourOfInterval({ start, end });
        formatStr = "HH:mm";
      } else if (timeRange === "1w" || timeRange === "1m") {
        buckets = eachDayOfInterval({ start, end });
        formatStr = "MMM d";
      } else {
        buckets = eachWeekOfInterval({ start, end });
        formatStr = "MMM d";
      }

      const counts = new Map<string, number>();
      buckets.forEach((bucket) => counts.set(bucket.toISOString(), 0));

      logins?.forEach((login) => {
        if (!login.last_sign_in_at) return;
        const loginDate = new Date(login.last_sign_in_at);
        let bucketKey: string | null = null;

        if (timeRange === "1d") {
          const hourStart = new Date(loginDate);
          hourStart.setMinutes(0, 0, 0);
          bucketKey = hourStart.toISOString();
        } else if (timeRange === "1w" || timeRange === "1m") {
          bucketKey = startOfDay(loginDate).toISOString();
        } else {
          bucketKey = startOfWeek(loginDate).toISOString();
        }

        if (bucketKey && counts.has(bucketKey)) {
          counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
        }
      });

      return buckets.map((bucket) => ({
        label: format(bucket, formatStr),
        count: counts.get(bucket.toISOString()) || 0,
        date: bucket,
      }));
    },
    staleTime: 60000,
  });

  const totalLogins =
    chartData?.reduce((sum, point) => sum + point.count, 0) || 0;

  const timeRangeButtons: { value: TimeRange; label: string }[] = [
    { value: "1d", label: "1D" },
    { value: "1w", label: "1W" },
    { value: "1m", label: "1M" },
    { value: "6m", label: "6M" },
    { value: "1y", label: "1Y" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-medium">Active Users</CardTitle>
          <p className="text-sm text-muted-foreground">
            {totalLogins} unique users active in selected period
          </p>
        </div>
        <div className="flex gap-1">
          {timeRangeButtons.map(({ value, label }) => (
            <Button
              key={value}
              variant={timeRange === value ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setTimeRange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`${value} users`, "Active"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
