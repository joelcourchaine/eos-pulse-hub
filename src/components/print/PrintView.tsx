import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PrintViewProps {
  year: number;
  quarter: number;
  mode: "weekly" | "monthly";
  departmentId?: string;
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

export const PrintView = ({ year, quarter, mode, departmentId }: PrintViewProps) => {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentData, setDepartmentData] = useState<any>({});
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});

  useEffect(() => {
    console.log('PrintView mounted with:', { departmentId, year, quarter, mode });
    if (departmentId) {
      loadAllData();
    } else {
      console.log('No departmentId provided to PrintView');
    }
  }, [year, quarter, departmentId]);

  const loadAllData = async () => {
    if (!departmentId) {
      console.log('loadAllData: No departmentId');
      return;
    }
    
    console.log('Loading data for department:', departmentId);
    setLoading(true);
    setDepartments([]); // Clear previous departments
    setDepartmentData({}); // Clear previous data
    
    // Fetch profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name");
    
    const profilesMap: { [key: string]: Profile } = {};
    profilesData?.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
    setProfiles(profilesMap);
    console.log('Loaded profiles:', Object.keys(profilesMap).length);

    // Fetch ONLY the selected department
    const { data: depts, error: deptError } = await supabase
      .from("departments")
      .select("*")
      .eq("id", departmentId)
      .single();

    if (deptError) {
      console.error('Error loading department:', deptError);
      setLoading(false);
      return;
    }

    if (!depts) {
      console.log('No department found for id:', departmentId);
      setLoading(false);
      return;
    }

    console.log('Loaded department:', depts.name);
    // Set as array with single department
    setDepartments([depts]);

    // Fetch data for the single department
    const allData: any = {};
    const months = getMonthsForQuarter(quarter, year);
    const weeks = getWeekDates({ year, quarter });

    // Fetch KPIs
    const { data: kpis } = await supabase
      .from("kpi_definitions")
      .select("*")
      .eq("department_id", depts.id)
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
      .eq("department_id", depts.id)
      .in("month", monthIds);

    allData[depts.id] = {
      kpis: kpis || [],
      scorecardEntries: scorecardEntries || [],
      financialEntries: financialEntries || [],
    };

    console.log('Loaded data for department:', {
      departmentId: depts.id,
      kpiCount: kpis?.length || 0,
      entryCount: scorecardEntries?.length || 0,
      financialCount: financialEntries?.length || 0
    });

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
    <div className="print-view" style={{ minHeight: '100vh', padding: '20px', backgroundColor: 'white' }}>
      {departments.map((dept) => {
        const data = departmentData[dept.id];
        if (!data) {
          console.log('No data for department:', dept.id);
          return null;
        }

        console.log('Rendering department:', dept.name, 'with KPIs:', data.kpis.length);
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
          <div key={dept.id} className="department-content">
            {/* Department Header */}
            <div className="print-header">
              <h1>{dept.name}</h1>
              <p>Q{quarter} {year} - {mode === "weekly" ? "Weekly" : "Monthly"} View</p>
            </div>

            {/* Scorecard Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="print-table">
                <colgroup>
                  <col style={{ width: '200px', minWidth: '200px' }} />
                  <col style={{ width: '100px', minWidth: '100px' }} />
                  {periods.map((_, idx) => (
                    <col key={idx} style={{ width: mode === 'weekly' ? '125px' : '105px', minWidth: mode === 'weekly' ? '125px' : '105px' }} />
                  ))}
                </colgroup>
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

                  {/* Financial Metrics Section - Only show in monthly mode */}
                  {mode === "monthly" && (
                    <>
                      <tr className="section-divider">
                        <td colSpan={2 + periods.length}>
                          <strong>Financial Metrics</strong>
                        </td>
                      </tr>
                      {FINANCIAL_METRICS.map(metric => (
                        <tr key={metric.key} className="financial-row">
                          <td className="kpi-name">{metric.name}</td>
                          <td className="target-value">-</td>
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
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <style>{`
        .print-view {
          font-family: Arial, sans-serif;
          font-size: 10px;
          color: #000;
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
          color: #000;
        }

        .print-header p {
          margin: 4px 0 0 0;
          font-size: 12px;
          color: #333;
        }

        .print-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          table-layout: fixed;
        }

        .print-table th,
        .print-table td {
          border: 1px solid #333;
          padding: 4px;
          color: #000;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .print-table th {
          background-color: #e0e0e0;
          font-weight: bold;
          text-align: center;
          color: #000;
          font-size: 10px;
        }

        .print-table col:nth-child(1) {
          width: 200px;
        }

        .print-table col:nth-child(2) {
          width: 100px;
        }

        .kpi-name {
          font-weight: 500;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .target-value {
          text-align: center;
          color: #666;
          white-space: nowrap;
        }

        .value-cell {
          text-align: center;
          font-weight: 500;
          font-size: 10px;
          white-space: nowrap;
        }

        .status-green {
          background-color: #d4edda;
          color: #000;
        }

        .status-yellow {
          background-color: #fff3cd;
          color: #000;
        }

        .status-red {
          background-color: #f8d7da;
          color: #000;
        }

        .owner-row {
          background-color: #e9ecef;
        }

        .owner-row td {
          padding: 5px;
          font-weight: bold;
        }

        .section-divider {
          background-color: #343a40;
          color: white;
        }

        .section-divider td {
          padding: 5px;
          font-weight: bold;
          color: white;
        }

        .financial-row {
          background-color: #f8f9fa;
        }
        
        @media print {
          @page {
            size: landscape;
            margin: 0.5in;
          }
          
          /* Hide everything except print content */
          body > :not(.print-only-content) {
            display: none !important;
          }
          
          .print-only-content {
            display: block !important;
          }
          
          .print-view {
            display: block !important;
            position: relative;
            width: 100%;
            background: white;
          }
          
          .status-green {
            background-color: #d4edda !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .status-yellow {
            background-color: #fff3cd !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .status-red {
            background-color: #f8d7da !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print-table th {
            background-color: #e0e0e0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .owner-row {
            background-color: #e9ecef !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .section-divider {
            background-color: #343a40 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .financial-row {
            background-color: #f8f9fa !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};