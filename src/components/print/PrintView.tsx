import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PrintViewProps {
  year: number;
  quarter: number;
  mode: "weekly" | "monthly";
}

interface Department {
  id: string;
  name: string;
}

interface KPI {
  id: string;
  name: string;
  metric_type: "dollar" | "percentage" | "unit";
  target_value: number;
  display_order: number;
  assigned_to: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

const FINANCIAL_METRICS = [
  { name: "Total Sales", key: "total_sales", type: "dollar" },
  { name: "GP Net", key: "gp_net", type: "dollar" },
  { name: "GP%", key: "gp_percent", type: "percentage" },
  { name: "Personnel Expense %", key: "personnel_expense_percent", type: "percentage" },
  { name: "Parts Transfer", key: "parts_transfer", type: "dollar" },
  { name: "Net", key: "net", type: "dollar" },
];

const YEAR_STARTS: { [key: number]: Date } = {
  2025: new Date(2024, 11, 30), // Dec 30, 2024
  2026: new Date(2025, 11, 29), // Dec 29, 2025 (Monday)
  2027: new Date(2026, 11, 28), // Dec 28, 2026 (Monday)
};

const getWeekDates = (selectedQuarter: { year: number; quarter: number }) => {
  const weeks = [];
  const yearStart = YEAR_STARTS[selectedQuarter.year] || new Date(selectedQuarter.year, 0, 1);
  const quarterStartWeek = (selectedQuarter.quarter - 1) * 13;
  
  for (let i = 0; i < 13; i++) {
    const weekStart = new Date(yearStart);
    weekStart.setDate(yearStart.getDate() + ((quarterStartWeek + i) * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const endLabel = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    
    weeks.push({
      start: weekStart,
      label: `${startLabel}-${endLabel}`,
      date: weekStart.toISOString().split('T')[0],
    });
  }
  
  return weeks;
};

const getMonthsForQuarter = (quarter: number, year: number) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const months = [];
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    });
  }
  
  return months;
};

export const PrintView = ({ year, quarter, mode }: PrintViewProps) => {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentData, setDepartmentData] = useState<any>({});
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});

  useEffect(() => {
    loadAllData();
  }, [year, quarter]);

  const loadAllData = async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name");
    
    const profilesMap: { [key: string]: Profile } = {};
    profilesData?.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
    setProfiles(profilesMap);

    // Fetch all departments
    const { data: depts } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (!depts) {
      setLoading(false);
      return;
    }

    setDepartments(depts);

    // Fetch data for each department
    const allData: any = {};
    const months = getMonthsForQuarter(quarter, year);
    const weeks = getWeekDates({ year, quarter });

    for (const dept of depts) {
      // Fetch KPIs
      const { data: kpis } = await supabase
        .from("kpi_definitions")
        .select("*")
        .eq("department_id", dept.id)
        .order("display_order");

      // Fetch scorecard entries
      const monthIds = months.map(m => m.identifier);
      const weekDates = weeks.map(w => w.date);
      
      const { data: scorecardEntries } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpis?.map(k => k.id) || [])
        .or(`week_start_date.in.(${weekDates.join(',')}),month.in.(${monthIds.join(',')})`);

      // Fetch financial entries
      const { data: financialEntries } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("department_id", dept.id)
        .in("month", monthIds);

      allData[dept.id] = {
        kpis: kpis || [],
        scorecardEntries: scorecardEntries || [],
        financialEntries: financialEntries || [],
      };
    }

    setDepartmentData(allData);
    setLoading(false);
  };

  const formatValue = (value: number | null, type: string) => {
    if (value === null || value === undefined) return "-";
    if (type === "dollar") return `$${value.toLocaleString()}`;
    if (type === "percentage") return `${value}%`;
    return value.toString();
  };

  const formatTarget = (value: number, type: string) => {
    if (type === "dollar") return `$${value.toLocaleString()}`;
    if (type === "percentage") return `${value}%`;
    return value.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const months = getMonthsForQuarter(quarter, year);
  const weeks = getWeekDates({ year, quarter });
  const periods = mode === "weekly" ? weeks : months;

  return (
    <div className="print-view">
      {departments.map((dept, deptIndex) => {
        const data = departmentData[dept.id];
        if (!data) return null;

        const kpis: KPI[] = data.kpis;
        const scorecardEntries = data.scorecardEntries;
        const financialEntries = data.financialEntries;

        // Group KPIs by assigned_to
        const groupedKpis: { [key: string]: KPI[] } = {};
        kpis.forEach(kpi => {
          const owner = kpi.assigned_to || "unassigned";
          if (!groupedKpis[owner]) groupedKpis[owner] = [];
          groupedKpis[owner].push(kpi);
        });

        return (
          <div key={dept.id} className={`page-break ${deptIndex > 0 ? 'break-before' : ''}`}>
            {/* Department Header */}
            <div className="print-header">
              <h1>{dept.name}</h1>
              <p>Q{quarter} {year} - {mode === "weekly" ? "Weekly" : "Monthly"} View</p>
            </div>

            {/* Scorecard Table */}
            <table className="print-table">
              <thead>
                <tr>
                  <th className="metric-col">KPI</th>
                  <th className="target-col">Target</th>
                  {periods.map(period => (
                    <th key={mode === "weekly" ? (period as any).date : (period as any).identifier} className="value-col">
                      {period.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedKpis).map(([ownerId, ownerKpis]) => {
                  const owner = ownerId !== "unassigned" ? profiles[ownerId] : null;
                  
                  return (
                    <React.Fragment key={ownerId}>
                      {owner && (
                        <tr className="owner-row">
                          <td colSpan={2}>
                            <strong>{owner.full_name}</strong>
                          </td>
                          <td colSpan={periods.length}></td>
                        </tr>
                      )}
                      {ownerKpis.map(kpi => (
                        <tr key={kpi.id}>
                          <td className="kpi-name">{kpi.name}</td>
                          <td className="target-value">{formatTarget(kpi.target_value, kpi.metric_type)}</td>
                          {periods.map(period => {
                            const entry = mode === "weekly"
                              ? scorecardEntries.find(
                                  e => e.kpi_id === kpi.id && e.week_start_date === (period as any).date
                                )
                              : scorecardEntries.find(
                                  e => e.kpi_id === kpi.id && e.month === (period as any).identifier
                                );
                            const status = entry?.status || null;
                            
                            return (
                              <td 
                                key={mode === "weekly" ? (period as any).date : (period as any).identifier}
                                className={`value-cell ${status === 'green' ? 'status-green' : status === 'yellow' ? 'status-yellow' : status === 'red' ? 'status-red' : ''}`}
                              >
                                {entry?.actual_value !== null && entry?.actual_value !== undefined
                                  ? kpi.metric_type === "dollar" 
                                    ? `$${entry.actual_value.toLocaleString()}`
                                    : kpi.metric_type === "percentage"
                                    ? `${entry.actual_value}%`
                                    : entry.actual_value.toString()
                                  : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}

                {/* Financial Metrics Section */}
                <tr className="section-divider">
                  <td colSpan={2 + periods.length}>
                    <strong>Financial Metrics (Monthly)</strong>
                  </td>
                </tr>
                {FINANCIAL_METRICS.map(metric => (
                  <tr key={metric.key} className="financial-row">
                    <td className="kpi-name">{metric.name}</td>
                    <td className="target-value">-</td>
                    {mode === "weekly" ? (
                      // For weekly view, show monthly data but span multiple columns
                      <>
                        {months.map((month, idx) => {
                          const entry = financialEntries.find(
                            e => e.metric_name === metric.key && e.month === month.identifier
                          );
                          const weeksPerMonth = idx === 0 ? 4 : idx === 1 ? 4 : 5;
                          
                          return (
                            <td key={month.identifier} className="value-cell" colSpan={weeksPerMonth}>
                              {formatValue(entry?.value || null, metric.type)}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      // For monthly view, normal display
                      <>
                        {months.map(month => {
                          const entry = financialEntries.find(
                            e => e.metric_name === metric.key && e.month === month.identifier
                          );
                          
                          return (
                            <td key={month.identifier} className="value-cell">
                              {formatValue(entry?.value || null, metric.type)}
                            </td>
                          );
                        })}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5in;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .page-break {
            page-break-after: always;
          }

          .page-break:last-child {
            page-break-after: avoid;
          }

          .break-before {
            page-break-before: always;
          }
        }

        .print-view {
          font-family: Arial, sans-serif;
          font-size: 10px;
        }

        .print-header {
          margin-bottom: 12px;
          border-bottom: 2px solid #333;
          padding-bottom: 8px;
        }

        .print-header h1 {
          margin: 0;
          font-size: 18px;
          font-weight: bold;
        }

        .print-header p {
          margin: 4px 0 0 0;
          font-size: 12px;
          color: #666;
        }

        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }

        .print-table th,
        .print-table td {
          border: 1px solid #ddd;
          padding: 6px;
          text-align: left;
        }

        .print-table th {
          background-color: #f5f5f5;
          font-weight: bold;
          text-align: center;
        }

        .metric-col {
          width: 35%;
        }

        .target-col {
          width: 12%;
          text-align: center;
        }

        .value-col {
          width: 18%;
          text-align: center;
        }

        .kpi-name {
          font-weight: 500;
        }

        .target-value {
          text-align: center;
          color: #666;
        }

        .value-cell {
          text-align: center;
          font-weight: 500;
        }

        .status-green {
          background-color: #d4edda !important;
          color: #155724 !important;
        }

        .status-yellow {
          background-color: #fff3cd !important;
          color: #856404 !important;
        }

        .status-red {
          background-color: #f8d7da !important;
          color: #721c24 !important;
        }

        .owner-row {
          background-color: #e9ecef;
        }

        .owner-row td {
          padding: 8px;
          font-weight: bold;
        }

        .section-divider {
          background-color: #343a40;
          color: white;
        }

        .section-divider td {
          padding: 8px;
          font-weight: bold;
        }

        .financial-row {
          background-color: #f8f9fa;
        }
      `}</style>
    </div>
  );
};