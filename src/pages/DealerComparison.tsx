import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Mail, Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmailComparisonDialog } from "@/components/enterprise/EmailComparisonDialog";
import { QuestionnaireComparisonTable } from "@/components/enterprise/QuestionnaireComparisonTable";
import { DataCoverageBadge } from "@/components/enterprise/DataCoverageBadge";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMetricsForBrand, type FinancialMetric } from "@/config/financialMetrics";

const getAllBrandMetricDefs = (): FinancialMetric[] => {
  const brands = [null, 'nissan', 'ford', 'mazda', 'honda', 'hyundai', 'genesis', 'stellantis', 'ktrv'];
  const seen = new Set<string>();
  const all: FinancialMetric[] = [];
  brands.forEach(b => {
    getMetricsForBrand(b).forEach(m => {
      if (!seen.has(m.key)) {
        seen.add(m.key);
        all.push(m);
      }
    });
  });
  return all;
};
import { getParentMetricKeys } from "@/utils/getParentMetricKeys";
import { format } from "date-fns";

interface ComparisonData {
  storeId: string;
  storeName: string;
  departmentId?: string;
  departmentName?: string;
  metricName: string;
  value: number | null;
  target: number | null;
  variance: number | null;
}

export default function DealerComparison() {
  const location = useLocation();
  const navigate = useNavigate();
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [rowNotes, setRowNotes] = useState<Record<string, string>>({});




  // Check if state exists, redirect if not
  useEffect(() => {
    if (!location.state) {
      navigate("/enterprise", { replace: true });
    }
  }, [location.state, navigate]);

  // Return null while redirecting
  if (!location.state) {
    return null;
  }

  const { metricType, selectedMetrics, selectedMonth, comparisonMode = "targets", departmentIds: initialDepartmentIds, isFixedCombined = false, selectedDepartmentNames = [], datePeriodType = "month", selectedYear, startMonth, endMonth, sortByMetric = "", storeIds = [], brandDisplayName = "All Brands", filterName = "", selectedComparisonQuarter = 4 } = location.state as {
    metricType: string;
    selectedMetrics: string[];
    selectedMonth?: string;
    comparisonMode?: string;
    departmentIds?: string[];
    isFixedCombined?: boolean;
    selectedDepartmentNames?: string[];
    datePeriodType?: string;
    selectedYear?: number;
    startMonth?: string;
    endMonth?: string;
    sortByMetric?: string;
    storeIds?: string[];
    brandDisplayName?: string;
    filterName?: string;
    selectedComparisonQuarter?: number;
  };

  // Fetch departments for selected stores
  const { data: departments } = useQuery({
    queryKey: ["dealer_comparison_departments", storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .in("store_id", storeIds);
      if (error) throw error;
      return data;
    },
    enabled: storeIds.length > 0,
  });

  // Extract department IDs from the fetched departments
  const departmentIds = useMemo(() => {
    if (initialDepartmentIds && initialDepartmentIds.length > 0) {
      return initialDepartmentIds;
    }
    if (!departments) return [];
    
    // Filter by selected department names if specified
    if (selectedDepartmentNames.length > 0) {
      const expandedNames = selectedDepartmentNames.flatMap(name => {
        if (name === 'Fixed Combined') {
          return departments
            .filter(d => d.name.toLowerCase().includes('parts') || d.name.toLowerCase().includes('service'))
            .map(d => d.name);
        }
        return [name];
      });
      return departments.filter(d => expandedNames.includes(d.name)).map(d => d.id);
    }
    
    return departments.map(d => d.id);
  }, [departments, initialDepartmentIds, selectedDepartmentNames]);

  // Create metric key map for financial metrics
  const metricKeyMap = useMemo(() => {
    if (metricType === "financial" && comparisonData.length > 0) {
      const map = new Map<string, string>();
      // Get metrics for all brands to build a comprehensive map
      const allBrands = ['GMC', 'Ford', 'Nissan', 'Mazda', 'Honda', 'Hyundai', 'Genesis', 'Stellantis', 'KTRV', 'Other'];
      allBrands.forEach(b => {
        getMetricsForBrand(b).forEach((m: any) => map.set(m.name, m.key));
      });
      return map;
    }
    return new Map<string, string>();
  }, [metricType, comparisonData]);


  // Fetch ALL financial entries for these departments (not filtered by month initially to get full context)
  const { data: financialEntries, refetch: refetchFinancial } = useQuery({
    queryKey: ["dealer_comparison_financial", departmentIds, selectedMonth, datePeriodType, selectedYear, startMonth, endMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];

      console.log("Fetching financial data for dealer comparison:", {
        datePeriodType,
        selectedMonth,
        selectedYear,
        startMonth,
        endMonth,
        departmentIds,
      });

      const buildBaseQuery = () => {
        let q = supabase
          .from("financial_entries")
          .select("*, departments(id, name, store_id, stores(name, brand, brand_id, brands(name)))")
          .in("department_id", departmentIds);

        // Apply date filtering based on period type
        if (datePeriodType === "month") {
          const monthString = selectedMonth || format(new Date(), "yyyy-MM");
          q = q.eq("month", monthString);
          console.log("Filtering by single month:", monthString);
        } else if (datePeriodType === "full_year") {
          const year = selectedYear || new Date().getFullYear();
          q = q.gte("month", `${year}-01`).lte("month", `${year}-12`);
          console.log("Filtering by full year:", year);
        } else if (datePeriodType === "custom_range" && startMonth && endMonth) {
          q = q.gte("month", startMonth).lte("month", endMonth);
          console.log("Filtering by custom range:", startMonth, "to", endMonth);
        }

        return q;
      };

      // Pagination: backend defaults to 1000 rows per request
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];

      while (true) {
        const { data, error } = await buildBaseQuery().range(from, from + pageSize - 1);
        if (error) {
          console.error("Error fetching financial entries:", error);
          throw error;
        }

        const rows = data || [];
        all.push(...rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      console.log("Fetched financial entries:", all.length, "records");
      return all;
    },
    enabled: departmentIds.length > 0 && metricType === "financial",
    refetchInterval: 60000,
  });

  // Sub-metric type map by full selection ID (e.g., "sub:sales_expense_percent:Comp Managers")
  const subMetricTypeBySelectionId = useMemo(() => {
    const result = new Map<string, "percentage" | "dollar">();
    // Check all brand definitions to find the parent metric type
    const allBrandNames = ['GMC', 'Ford', 'Nissan', 'Mazda', 'Honda', 'Hyundai', 'Genesis', 'Stellantis', 'KTRV', 'Other'];
    const allBrandDefs = allBrandNames.flatMap(b => getMetricsForBrand(b));

    // Map full selection IDs (sub:parent_key:subName) to their parent type
    selectedMetrics.forEach(selectionId => {
      if (!selectionId.startsWith("sub:")) return;
      const parts = selectionId.split(":");
      if (parts.length < 3) return;

      const parentKey = parts[1];
      const parentDef = allBrandDefs.find((d: any) => d.key === parentKey);
      result.set(selectionId, parentDef?.type === "percentage" ? "percentage" : "dollar");
    });

    return result;
  }, [selectedMetrics]);

  // Convert full selection ID to display name
  const selectionIdToDisplayName = (selectionId: string): string => {
    if (selectionId.startsWith("sub:")) {
      const parts = selectionId.split(":");
      if (parts.length >= 3) {
        return `↳ ${parts.slice(2).join(":")}`;
      }
    }
    return selectionId;
  };

  // Helper to extract (parentKey, subName) from any sub-metric key format.
  // Handles both "sub:parent:name" and "sub:parent:order:name" (with numeric order index).
  const extractSubMetricParts = (key: string): { parentKey: string; subName: string } | null => {
    if (!key.startsWith("sub:")) return null;
    const parts = key.split(":");
    if (parts.length < 3) return null;
    const parentKey = parts[1];
    // If parts[2] is a numeric order index, subName starts at parts[3]
    if (parts.length >= 4 && /^\d+$/.test(parts[2])) {
      return { parentKey, subName: parts.slice(3).join(":") };
    }
    return { parentKey, subName: parts.slice(2).join(":") };
  };

  // Build map from display name to full selection ID for lookup
  const displayNameToSelectionId = useMemo(() => {
    const result = new Map<string, string>();
    selectedMetrics.forEach(selectionId => {
      const displayName = selectionIdToDisplayName(selectionId);
      result.set(displayName, selectionId);
    });
    return result;
  }, [selectedMetrics]);

  // Map "parentKey|subName" → selectionId for matching DB sub-metric keys to selections
  const subMetricSelectionMap = useMemo(() => {
    const map = new Map<string, string>();
    selectedMetrics.forEach(selId => {
      const parsed = extractSubMetricParts(selId);
      if (parsed) {
        map.set(`${parsed.parentKey}|${parsed.subName}`, selId);
      }
    });
    return map;
  }, [selectedMetrics]);

  // Order selected metrics so sub-metrics render directly under their parent metric.
  // (Does not change calculations; display-only.)
  const orderedSelectedMetrics = useMemo(() => {
    if (metricType !== "financial") return selectedMetrics;

    // Build key-to-name map from all brands to handle any brand's metrics
    const allBrandNames = ['GMC', 'Ford', 'Nissan', 'Mazda', 'Honda', 'Hyundai', 'Genesis', 'Stellantis', 'KTRV', 'Other'];
    const keyToNameLocal = new Map<string, string>();
    allBrandNames.forEach(b => {
      getMetricsForBrand(b).forEach((d: any) => keyToNameLocal.set(d.key, d.name));
    });

    // Build sub-metric order map from financial entries (parentKey|subName -> orderIndex)
    const subOrderMap = new Map<string, number>();
    financialEntries?.forEach((entry: any) => {
      const parts = (entry.metric_name as string).split(':');
      if (parts.length >= 4) {
        const parentKey = parts[1];
        const orderIdx = parseInt(parts[2], 10) || 999;
        const name = parts.slice(3).join(':');
        const mapKey = `${parentKey}|${name}`;
        const existing = subOrderMap.get(mapKey);
        if (existing === undefined || orderIdx < existing) {
          subOrderMap.set(mapKey, orderIdx);
        }
      }
    });

    // Separate parent metrics and sub-metrics
    const parentIds: string[] = [];
    const subMetricsByParent = new Map<string, string[]>();

    selectedMetrics.forEach((id) => {
      if (id.startsWith("sub:")) {
        const parentKey = id.split(":")[1];
        const parentName = keyToNameLocal.get(parentKey) ?? parentKey;
        if (!subMetricsByParent.has(parentName)) {
          subMetricsByParent.set(parentName, []);
        }
        subMetricsByParent.get(parentName)!.push(id);
      } else {
        parentIds.push(id);
      }
    });

    // Sort sub-metrics within each parent group by orderIndex
    const sortSubsByOrder = (subs: string[]) => {
      subs.sort((a, b) => {
        const parsedA = extractSubMetricParts(a);
        const parsedB = extractSubMetricParts(b);
        const orderA = parsedA ? (subOrderMap.get(`${parsedA.parentKey}|${parsedA.subName}`) ?? 999) : 999;
        const orderB = parsedB ? (subOrderMap.get(`${parsedB.parentKey}|${parsedB.subName}`) ?? 999) : 999;
        return orderA - orderB;
      });
    };

    // Sort parent metrics by brand config order
    const brandMetrics = getMetricsForBrand(brandDisplayName);
    const parentOrderMap = new Map<string, number>();
    brandMetrics.forEach((m: any, idx: number) => parentOrderMap.set(m.name, idx));
    parentIds.sort((a, b) => {
      const ai = parentOrderMap.get(a) ?? 9999;
      const bi = parentOrderMap.get(b) ?? 9999;
      return ai - bi;
    });

    // Build ordered list: for each parent, add the parent then its sub-metrics
    const ordered: string[] = [];
    const added = new Set<string>();

    // First pass: add parents that are explicitly selected, followed by their subs
    parentIds.forEach((parentId) => {
      if (!added.has(parentId)) {
        ordered.push(parentId);
        added.add(parentId);
      }
      // Add any sub-metrics for this parent (sorted by order index)
      const subs = subMetricsByParent.get(parentId);
      if (subs) {
        sortSubsByOrder(subs);
        subs.forEach((subId) => {
          if (!added.has(subId)) {
            ordered.push(subId);
            added.add(subId);
          }
        });
        subMetricsByParent.delete(parentId);
      }
    });

    // Second pass: add remaining sub-metrics whose parent wasn't explicitly selected
    subMetricsByParent.forEach((subs, parentName) => {
      if (!added.has(parentName) && selectedMetrics.includes(parentName)) {
        ordered.push(parentName);
        added.add(parentName);
      }
      sortSubsByOrder(subs);
      subs.forEach((subId) => {
        if (!added.has(subId)) {
          ordered.push(subId);
          added.add(subId);
        }
      });
    });

    return ordered;
  }, [metricType, selectedMetrics, financialEntries]);

  // Compute sequential note numbers: only rows with non-empty notes get a number
  const noteNumberMap = useMemo(() => {
    const mapping: Record<string, number> = {};
    let currentNumber = 1;
    orderedSelectedMetrics.forEach((selectionId) => {
      if (rowNotes[selectionId]?.trim()) {
        mapping[selectionId] = currentNumber++;
      }
    });
    return mapping;
  }, [rowNotes, orderedSelectedMetrics]);


  const parentMetricKeys = useMemo(() => {
    if (metricType !== "financial") return new Set<string>();
    return getParentMetricKeys(orderedSelectedMetrics, null);
  }, [metricType, orderedSelectedMetrics]);

  // Fetch financial targets
  const { data: financialTargets } = useQuery({
    queryKey: ["dealer_comparison_targets", departmentIds, selectedMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const monthDate = selectedMonth ? new Date(selectedMonth + '-15') : new Date();
      const quarter = Math.ceil((monthDate.getMonth() + 1) / 3);
      const year = monthDate.getFullYear();
      
      const { data, error } = await supabase
        .from("financial_targets")
        .select("*")
        .in("department_id", departmentIds)
        .eq("quarter", quarter)
        .eq("year", year);
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType === "financial" && comparisonMode === "targets",
  });

  // Fetch year-over-year comparison data (same period from previous year)
  // For full_year and custom_range, only fetch months that match the current year's data availability
  const { data: yearOverYearData } = useQuery({
    queryKey: ["dealer_comparison_yoy", departmentIds, selectedMonth, datePeriodType, selectedYear, startMonth, endMonth, financialEntries],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      
      // For month period type, simple same-month comparison
      if (datePeriodType === "month") {
        const currentDate = selectedMonth ? new Date(selectedMonth + '-15') : new Date();
        const prevYear = currentDate.getFullYear() - 1;
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const prevYearMonth = `${prevYear}-${month}`;
        
        const { data, error } = await supabase
          .from("financial_entries")
          .select("*, departments(id, name, store_id, stores(name, brands(name)))")
          .in("department_id", departmentIds)
          .eq("month", prevYearMonth);
        
        if (error) throw error;
        return data || [];
      }
      
      // For full_year or custom_range, first determine which months have data in current year
      if (!financialEntries || financialEntries.length === 0) return [];
      
      // Get unique months with data per department in current year
      const currentYearMonthsByDept = new Map<string, Set<string>>();
      financialEntries.forEach((entry: any) => {
        const deptId = entry.departments?.id || entry.department_id;
        if (!currentYearMonthsByDept.has(deptId)) {
          currentYearMonthsByDept.set(deptId, new Set());
        }
        currentYearMonthsByDept.get(deptId)!.add(entry.month);
      });
      
      // Build list of previous year months to fetch (matching current year's available months)
      const prevYearMonthsToFetch = new Set<string>();
      currentYearMonthsByDept.forEach((months) => {
        months.forEach(month => {
          const [year, monthNum] = month.split('-');
          const prevYearMonth = `${parseInt(year) - 1}-${monthNum}`;
          prevYearMonthsToFetch.add(prevYearMonth);
        });
      });
      
      if (prevYearMonthsToFetch.size === 0) return [];
      
      console.log("Fetching YoY data for months matching current year availability:", Array.from(prevYearMonthsToFetch));
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id, stores(name, brands(name)))")
        .in("department_id", departmentIds)
        .in("month", Array.from(prevYearMonthsToFetch));
      
      if (error) throw error;
      return data || [];
    },
    enabled: departmentIds.length > 0 && metricType === "financial" && comparisonMode === "year_over_year",
  });

  // Fetch previous year average or quarter data for comparison
  const { data: prevYearAvgData } = useQuery({
    queryKey: ["dealer_comparison_prev_year_avg", departmentIds, selectedMonth, comparisonMode, selectedComparisonQuarter],
    queryFn: async () => {
      if (departmentIds.length === 0 || !selectedMonth) return [];
      
      const currentDate = new Date(selectedMonth + '-15');
      const prevYear = currentDate.getFullYear() - 1;
      
      let monthFilter: string[];
      
      if (comparisonMode === "prev_year_avg") {
        // All 12 months of previous year
        monthFilter = Array.from({ length: 12 }, (_, i) => 
          `${prevYear}-${String(i + 1).padStart(2, '0')}`
        );
      } else {
        // Specific quarter of previous year
        const quarterStartMonth = (selectedComparisonQuarter - 1) * 3 + 1;
        monthFilter = Array.from({ length: 3 }, (_, i) =>
          `${prevYear}-${String(quarterStartMonth + i).padStart(2, '0')}`
        );
      }
      
      console.log("Fetching prev year avg data for months:", monthFilter);
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id, stores(name, brands(name)))")
        .in("department_id", departmentIds)
        .in("month", monthFilter);
      
      if (error) throw error;
      return data || [];
    },
    enabled: departmentIds.length > 0 && metricType === "financial" && 
             (comparisonMode === "prev_year_avg" || comparisonMode === "prev_year_quarter") &&
             datePeriodType === "month",
  });

  // Fetch KPI data for polling
  const { data: kpiDefinitions, refetch: refetchKPIs } = useQuery({
    queryKey: ["dealer_comparison_kpis", departmentIds],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*, departments(id, name, store_id, stores(name))")
        .in("department_id", departmentIds);
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType !== "financial",
    refetchInterval: 60000,
  });

  const { data: scorecardEntries, refetch: refetchScorecard } = useQuery({
    queryKey: ["dealer_comparison_scorecard", kpiDefinitions],
    queryFn: async () => {
      if (!kpiDefinitions || kpiDefinitions.length === 0) return [];
      const kpiIds = kpiDefinitions.map(k => k.id);
      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", metricType === "weekly" ? "weekly" : "monthly")
        .order("week_start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: kpiDefinitions && kpiDefinitions.length > 0 && metricType !== "financial" && metricType !== "dept_info",
    refetchInterval: 60000,
  });

  // Fetch questionnaire data for dept_info metric type
  const { data: questionnaireAnswers, isLoading: questionnaireLoading } = useQuery({
    queryKey: ["dealer_comparison_questionnaire", departmentIds, selectedMetrics],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      
      // Get questions that match selected metrics (question_text), ordered by display_order
      const { data: questions, error: questionsError } = await supabase
        .from("department_questions")
        .select("id, question_text, answer_type, question_category, display_order")
        .eq("is_active", true)
        .in("question_text", selectedMetrics)
        .order("display_order", { ascending: true });
      
      if (questionsError) throw questionsError;
      if (!questions || questions.length === 0) return [];
      
      const questionIds = questions.map(q => q.id);
      const questionMap = new Map(questions.map(q => [q.id, q]));
      
      // First fetch all departments to ensure we show all stores
      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("id, name, store_id, stores(name)")
        .in("id", departmentIds);
      
      if (deptError) throw deptError;
      
      // Get answers for these questions
      const { data: answers, error: answersError } = await supabase
        .from("department_answers")
        .select("*")
        .in("department_id", departmentIds)
        .in("question_id", questionIds);
      
      if (answersError) throw answersError;
      
      // Create a map of answers by department+question
      const answerMap = new Map<string, string | null>();
      (answers || []).forEach(answer => {
        const key = `${answer.department_id}-${answer.question_id}`;
        answerMap.set(key, answer.answer_value);
      });
      
      // Build result with all stores and all questions (even if no answer)
      const result: any[] = [];
      (deptData || []).forEach(dept => {
        questions.forEach(question => {
          const key = `${dept.id}-${question.id}`;
          result.push({
            storeName: (dept as any).stores?.name || 'Unknown Store',
            departmentName: dept.name || 'Unknown Dept',
            departmentId: dept.id,
            questionId: question.id,
            questionText: question.question_text || '',
            answerValue: answerMap.get(key) ?? null,
            answerType: question.answer_type || 'text',
            questionCategory: question.question_category || '',
          });
        });
      });
      
      return result;
    },
    enabled: departmentIds.length > 0 && metricType === "dept_info" && selectedMetrics.length > 0,
  });

  // Update comparison data when fresh data arrives
  useEffect(() => {
    if (metricType === "financial" && financialEntries && selectedMetrics.length > 0) {
      console.log("Processing financial entries:", financialEntries.length);
      
      // Detect brand from first entry to get correct metrics
      const firstEntry = financialEntries[0];
      const brand = (firstEntry as any)?.departments?.stores?.brands?.name || 
                    (firstEntry as any)?.departments?.stores?.brand || null;
      console.log("Detected brand for comparison:", brand, "from entry:", firstEntry);
      
      // Create metric maps - we need name/key mappings and brand-specific definitions
      const nameToKey = new Map<string, string>();
      const keyToName = new Map<string, string>();

      // Track sub-metric metadata: display name -> parentKey
      const subMetricParentKeyByName = new Map<string, string>();

      // Build brand-specific metric definition maps
      const brandMetricDefs = new Map<string, Map<string, any>>();
      const brands = ['GMC', 'Ford', 'Nissan', 'Mazda', 'Honda', 'Hyundai', 'Genesis', 'Stellantis', 'KTRV', 'Other'];
      brands.forEach(brandName => {
        const brandMetrics = getMetricsForBrand(brandName);
        const brandMap = new Map<string, any>();
        brandMetrics.forEach((m: any) => {
          brandMap.set(m.key, m);
          // Build global name/key mappings
          nameToKey.set(m.name, m.key);
          keyToName.set(m.key, m.name);
        });
        brandMetricDefs.set(brandName, brandMap);
      });

      // Add dynamic sub-metric mappings from the actual data
      // Stored as: sub:<parentKey>:<order>:<subName>
      (financialEntries || []).forEach((entry: any) => {
        const rawKey = entry.metric_name as string;
        if (!rawKey?.startsWith('sub:')) return;
        const parts = rawKey.split(':');
        if (parts.length < 4) return;

        const parentKey = parts[1];
        const subName = parts.slice(3).join(':');
        const displayName = `↳ ${subName}`;

        nameToKey.set(displayName, rawKey);
        keyToName.set(rawKey, displayName);
        subMetricParentKeyByName.set(displayName, parentKey);
      });

      // Detect the primary brand key for fallback operations
      const normalizedDetectedBrand = brand?.toLowerCase() || '';
      let detectedBrandKey = 'GMC';
      if (normalizedDetectedBrand.includes('nissan')) detectedBrandKey = 'Nissan';
      else if (normalizedDetectedBrand.includes('ford')) detectedBrandKey = 'Ford';
      else if (normalizedDetectedBrand.includes('mazda')) detectedBrandKey = 'Mazda';
      else if (normalizedDetectedBrand.includes('honda')) detectedBrandKey = 'Honda';
      else if (normalizedDetectedBrand.includes('hyundai')) detectedBrandKey = 'Hyundai';
      else if (normalizedDetectedBrand.includes('genesis')) detectedBrandKey = 'Genesis';
      else if (normalizedDetectedBrand.includes('stellantis') || normalizedDetectedBrand.includes('chrysler') || normalizedDetectedBrand.includes('jeep') || normalizedDetectedBrand.includes('dodge') || normalizedDetectedBrand.includes('ram')) detectedBrandKey = 'Stellantis';
      else if (normalizedDetectedBrand.includes('ktrv') || normalizedDetectedBrand === 'other') detectedBrandKey = 'KTRV';

      // Build a default keyToDef using the detected brand instead of always GMC
      const keyToDef = brandMetricDefs.get(detectedBrandKey) || brandMetricDefs.get('GMC') || new Map<string, any>();

      // Helper to get brand-specific metric definition
      const getMetricDef = (metricKey: string, storeBrand: string | null): any => {
        const nb = storeBrand?.toLowerCase() || '';
        let brandKey = detectedBrandKey; // default to detected brand
        if (nb.includes('ford')) brandKey = 'Ford';
        else if (nb.includes('nissan')) brandKey = 'Nissan';
        else if (nb.includes('mazda')) brandKey = 'Mazda';
        else if (nb.includes('honda')) brandKey = 'Honda';
        else if (nb.includes('hyundai')) brandKey = 'Hyundai';
        else if (nb.includes('genesis')) brandKey = 'Genesis';
        else if (nb.includes('stellantis') || nb.includes('chrysler') || nb.includes('jeep') || nb.includes('dodge') || nb.includes('ram')) brandKey = 'Stellantis';
        else if (nb.includes('ktrv') || nb === 'other') brandKey = 'KTRV';
        else if (nb.includes('gmc') || nb.includes('chevrolet')) brandKey = 'GMC';

        return brandMetricDefs.get(brandKey)?.get(metricKey) || keyToDef.get(metricKey);
      };

      // Use all metrics from the detected brand's map for the combined list
      const metrics = Array.from(keyToDef.values());

      // Convert selection IDs (e.g., "sub:parent:Name") into the metric names used throughout processing (e.g., "↳ Name")
      const selectedMetricNames = selectedMetrics.map(selectionIdToDisplayName);

      console.log("DealerComparison - Using brand-specific metrics for calculations");
      
      // Build comparison baseline map (targets, averages, or previous year)
      const comparisonMap = new Map<string, { value: number; direction?: string }>();
      
      if (comparisonMode === "targets" && financialTargets) {
        financialTargets.forEach(target => {
          const key = `${target.department_id}-${target.metric_name}`;
          comparisonMap.set(key, {
            value: Number(target.target_value),
            direction: target.target_direction
          });
        });
      } else if (comparisonMode === "year_over_year" && yearOverYearData) {
        // For year-over-year, we need to aggregate the previous year data the same way as current data
        // Group by department first
        const prevYearByDept = new Map<string, Map<string, number>>();
        
        yearOverYearData.forEach(entry => {
          const deptId = (entry as any)?.departments?.id;
          if (!prevYearByDept.has(deptId)) {
            prevYearByDept.set(deptId, new Map());
          }
          const deptMetrics = prevYearByDept.get(deptId)!;
          const currentValue = deptMetrics.get(entry.metric_name) || 0;
          deptMetrics.set(entry.metric_name, currentValue + (entry.value ? Number(entry.value) : 0));
        });
        
        // Now calculate derived metrics for previous year data and store in comparison map
        prevYearByDept.forEach((metrics, deptId) => {
          // First, store raw values
          metrics.forEach((value, metricName) => {
            const key = `${deptId}-${metricName}`;
            comparisonMap.set(key, { value });
          });
          
          // Then calculate derived metrics (like Net Selling Gross, Department Profit, etc.)
          // Get brand for this department to use correct formulas
          const deptEntry = yearOverYearData.find(e => (e as any)?.departments?.id === deptId);
          const storeBrand = (deptEntry as any)?.departments?.stores?.brands?.name || 
                            (deptEntry as any)?.departments?.stores?.brand || null;
          
          const normalizedBrand = storeBrand?.toLowerCase() || '';
          let brandKey = 'GMC';
          if (normalizedBrand.includes('ford')) brandKey = 'Ford';
          else if (normalizedBrand.includes('nissan')) brandKey = 'Nissan';
          else if (normalizedBrand.includes('mazda')) brandKey = 'Mazda';
          
          const brandMetrics = brandMetricDefs.get(brandKey) || keyToDef;
          
          // Calculate derived dollar metrics
          brandMetrics.forEach((metricDef: any) => {
            if (metricDef.type === 'dollar' && metricDef.calculation) {
              const calc = metricDef.calculation;
              let calculatedValue: number | null = null;
              
              if (calc.type === 'subtract') {
                const base = metrics.get(calc.base);
                if (base !== undefined) {
                  calculatedValue = base;
                  (calc.deductions || []).forEach((d: string) => {
                    const val = metrics.get(d);
                    if (val !== undefined) calculatedValue! -= val;
                  });
                }
              } else if (calc.type === 'complex') {
                const base = metrics.get(calc.base);
                if (base !== undefined) {
                  calculatedValue = base;
                  (calc.deductions || []).forEach((d: string) => {
                    const val = metrics.get(d);
                    if (val !== undefined) calculatedValue! -= val;
                  });
                  (calc.additions || []).forEach((a: string) => {
                    const val = metrics.get(a);
                    if (val !== undefined) calculatedValue! += val;
                  });
                }
              }
              
              if (calculatedValue !== null) {
                // Store calculated value for use in dependent calculations
                metrics.set(metricDef.key, calculatedValue);
                const key = `${deptId}-${metricDef.key}`;
                comparisonMap.set(key, { value: calculatedValue });
              }
            }
          });
          
          // Calculate percentage metrics
          brandMetrics.forEach((metricDef: any) => {
            if (metricDef.type === 'percentage' && metricDef.calculation && 'numerator' in metricDef.calculation) {
              const calc = metricDef.calculation;
              const num = metrics.get(calc.numerator);
              const denom = metrics.get(calc.denominator);
              if (num !== undefined && denom !== undefined && denom !== 0) {
                const percentValue = (num / denom) * 100;
                const key = `${deptId}-${metricDef.key}`;
                comparisonMap.set(key, { value: percentValue });
              }
            }
          });
        });
      } else if ((comparisonMode === "prev_year_avg" || comparisonMode === "prev_year_quarter") && prevYearAvgData && prevYearAvgData.length > 0) {
        // Group by department and calculate monthly averages
        const prevByDept = new Map<string, Map<string, number>>();
        const deptMetricMonths = new Map<string, Set<string>>();
        
        prevYearAvgData.forEach(entry => {
          const deptId = (entry as any)?.departments?.id;
          if (!prevByDept.has(deptId)) {
            prevByDept.set(deptId, new Map());
          }
          const deptMetrics = prevByDept.get(deptId)!;
          const metricKey = entry.metric_name;
          const monthTrackKey = `${deptId}-${metricKey}`;
          
          if (!deptMetricMonths.has(monthTrackKey)) {
            deptMetricMonths.set(monthTrackKey, new Set());
          }
          deptMetricMonths.get(monthTrackKey)!.add(entry.month);
          
          const currentValue = deptMetrics.get(metricKey) || 0;
          deptMetrics.set(metricKey, currentValue + (entry.value ? Number(entry.value) : 0));
        });
        
        // Convert sums to averages and calculate derived metrics
        prevByDept.forEach((metrics, deptId) => {
          // First, convert sums to monthly averages
          const avgMetrics = new Map<string, number>();
          metrics.forEach((sum, metricName) => {
            const monthKey = `${deptId}-${metricName}`;
            const monthCount = deptMetricMonths.get(monthKey)?.size || 1;
            avgMetrics.set(metricName, sum / monthCount);
          });
          
          // Store averaged raw values
          avgMetrics.forEach((avgValue, metricName) => {
            const key = `${deptId}-${metricName}`;
            comparisonMap.set(key, { value: avgValue });
          });
          
          // Calculate derived metrics using brand-specific formulas
          const deptEntry = prevYearAvgData.find(e => (e as any)?.departments?.id === deptId);
          const storeBrand = (deptEntry as any)?.departments?.stores?.brands?.name || null;
          
          const normalizedBrand = storeBrand?.toLowerCase() || '';
          let brandKey = 'GMC';
          if (normalizedBrand.includes('ford')) brandKey = 'Ford';
          else if (normalizedBrand.includes('nissan')) brandKey = 'Nissan';
          else if (normalizedBrand.includes('mazda')) brandKey = 'Mazda';
          
          const brandMetrics = brandMetricDefs.get(brandKey) || keyToDef;
          
          // Calculate derived dollar metrics
          brandMetrics.forEach((metricDef: any) => {
            if (metricDef.type === 'dollar' && metricDef.calculation) {
              const calc = metricDef.calculation;
              let calculatedValue: number | null = null;
              
              if (calc.type === 'subtract') {
                const base = avgMetrics.get(calc.base);
                if (base !== undefined) {
                  calculatedValue = base;
                  (calc.deductions || []).forEach((d: string) => {
                    const val = avgMetrics.get(d);
                    if (val !== undefined) calculatedValue! -= val;
                  });
                }
              } else if (calc.type === 'complex') {
                const base = avgMetrics.get(calc.base);
                if (base !== undefined) {
                  calculatedValue = base;
                  (calc.deductions || []).forEach((d: string) => {
                    const val = avgMetrics.get(d);
                    if (val !== undefined) calculatedValue! -= val;
                  });
                  (calc.additions || []).forEach((a: string) => {
                    const val = avgMetrics.get(a);
                    if (val !== undefined) calculatedValue! += val;
                  });
                }
              }
              
              if (calculatedValue !== null) {
                avgMetrics.set(metricDef.key, calculatedValue);
                const key = `${deptId}-${metricDef.key}`;
                comparisonMap.set(key, { value: calculatedValue });
              }
            }
          });
          
          // Calculate percentage metrics
          brandMetrics.forEach((metricDef: any) => {
            if (metricDef.type === 'percentage' && metricDef.calculation && 'numerator' in metricDef.calculation) {
              const calc = metricDef.calculation;
              const num = avgMetrics.get(calc.numerator);
              const denom = avgMetrics.get(calc.denominator);
              if (num !== undefined && denom !== undefined && denom !== 0) {
                const percentValue = (num / denom) * 100;
                const key = `${deptId}-${metricDef.key}`;
                comparisonMap.set(key, { value: percentValue });
              }
            }
          });
        });
      }
      
      // Build a map of all data by store+dept+metric key
      const dataMap: Record<string, ComparisonData> = {};
      
      // Track brand for each store
      const storeBrands = new Map<string, string>();
      financialEntries.forEach(entry => {
        const storeId = (entry as any)?.departments?.store_id || "";
        const brand = (entry as any)?.departments?.stores?.brands?.name || 
                      (entry as any)?.departments?.stores?.brand || null;
        if (storeId && brand) {
          storeBrands.set(storeId, brand);
        }
      });
      
      // Hoisted so percentage sub-metric synthesis can access aggregated raw keys
      type AvgAgg = { sum: number; count: number };
      const aggregatedByStoreDept = new Map<string, Map<string, number | AvgAgg>>();
      const isMultiMonth = datePeriodType === "full_year" || datePeriodType === "custom_range";

      // For full_year and custom_range, we need to aggregate data first
      if (isMultiMonth) {
        console.log("Aggregating data for multi-month period");
        
        // Group entries by store+dept and collect raw values
        // NOTE: sub-metrics that are percentage-based should be averaged (not summed) across months.
        const allMetricDefs = getMetricsForBrand(null);

        financialEntries.forEach(entry => {
          const storeId = (entry as any)?.departments?.store_id || "";
          const deptId = (entry as any)?.departments?.id;
          const key = `${storeId}-${deptId}`;

          if (!aggregatedByStoreDept.has(key)) {
            aggregatedByStoreDept.set(key, new Map());
          }

          const storeMetrics = aggregatedByStoreDept.get(key)!;
          const metricKey = entry.metric_name as string;
          const numericValue = entry.value ? Number(entry.value) : 0;

          // For sub-metrics that roll up to a percentage parent, average the percentage values.
          if (metricKey?.startsWith("sub:")) {
            const parts = metricKey.split(":");
            const parentKey = parts.length >= 2 ? parts[1] : "";
            const parentDef = allMetricDefs.find((d: any) => d.key === parentKey);

            if (parentDef?.type === "percentage") {
              const existing = storeMetrics.get(metricKey);
              if (existing && typeof existing === "object") {
                existing.sum += numericValue;
                existing.count += 1;
              } else {
                storeMetrics.set(metricKey, { sum: numericValue, count: 1 });
              }
              return;
            }
          }

          // Default: sum dollars and non-sub percentages (base percentages will be recalculated below)
          const currentValue = storeMetrics.get(metricKey);
          const currentNum = typeof currentValue === "number" ? currentValue : 0;
          storeMetrics.set(metricKey, currentNum + numericValue);
        });
        
        // Now create entries with recalculated percentages
        aggregatedByStoreDept.forEach((storeMetrics, storeDeptKey) => {
          // Find the first entry for this store/dept to get metadata
          const sampleEntry = financialEntries.find(e => 
            `${(e as any)?.departments?.store_id}-${(e as any)?.departments?.id}` === storeDeptKey
          );
          
          if (!sampleEntry) return;
          
          const storeId = (sampleEntry as any)?.departments?.store_id || "";
          const storeName = (sampleEntry as any)?.departments?.stores?.name || "";
          const deptId = (sampleEntry as any)?.departments?.id;
          const deptName = (sampleEntry as any)?.departments?.name;
          const storeBrand = storeBrands.get(storeId) || null;
          
          // Helper: read aggregated values (numbers or AvgAgg)
          const getAggValue = (k: string): number => {
            const v = storeMetrics.get(k);
            if (v === undefined || v === null) return 0;
            if (typeof v === "number") return v;
            return v.count > 0 ? v.sum / v.count : 0;
          };

          // Some statements only import sub-metrics (sub:<parentKey>:...) and omit the
          // parent totals (e.g., total_sales, gp_net). Backfill those parent totals by
          // summing the sub-metrics so comparisons don't show N/A.
          const backfillParentTotalsFromSubMetrics = () => {
            const sums = new Map<string, number>();

            for (const [k, v] of storeMetrics) {
              if (!k.startsWith("sub:")) continue;
              const parts = k.split(":");
              const parentKey = parts.length >= 2 ? parts[1] : "";
              if (!parentKey) continue;

              // Skip percentage-type parents — they must be derived from formula, not summed
              const parentDef = getMetricDef(parentKey, null);
              if (parentDef?.type === 'percentage') continue;

              const numeric = typeof v === "number" ? v : v.count > 0 ? v.sum / v.count : 0;
              sums.set(parentKey, (sums.get(parentKey) || 0) + (numeric || 0));
            }

            for (const [parentKey, sum] of sums) {
              if (storeMetrics.get(parentKey) === undefined) {
                storeMetrics.set(parentKey, sum);
              }
            }
          };

          backfillParentTotalsFromSubMetrics();

          // Process each metric
          storeMetrics.forEach((_aggregatedValue, metricKey) => {
            const metricDef = getMetricDef(metricKey, storeBrand);
            let finalValue: number = getAggValue(metricKey);

            // Recalculate percentages from aggregated dollar values (base metrics)
            if (metricDef?.type === "percentage" && metricDef?.calculation) {
              const calc = metricDef.calculation;
              if ("numerator" in calc && "denominator" in calc) {
                const num = getAggValue(calc.numerator);
                const denom = getAggValue(calc.denominator);
                finalValue = denom !== 0 ? (num / denom) * 100 : 0;
              }
            }

            const metricName = metricKey.startsWith("sub:") ? metricKey : (keyToName.get(metricKey) || metricKey);
            const entryKey = `${storeId}-${deptId}-${metricKey}`;

            // Get comparison baseline for this metric
            const comparisonKey = `${deptId}-${metricKey}`;
            const comparisonInfo = comparisonMap.get(comparisonKey);

            dataMap[entryKey] = {
              storeId,
              storeName,
              departmentId: deptId,
              departmentName: deptName,
              metricName,
              value: finalValue,
              target: comparisonInfo?.value || null,
              variance: null,
            };

            // Calculate variance
            if (comparisonInfo?.value !== undefined && comparisonInfo?.value !== null) {
              const baseline = comparisonInfo.value;
              if (baseline !== 0) {
                const variance = ((finalValue - baseline) / Math.abs(baseline)) * 100;
                const shouldReverse = comparisonMode === "targets" && metricDef?.targetDirection === "below";
                dataMap[entryKey].variance = shouldReverse ? -variance : variance;
              }
            }
          });

          // Calculate derived dollar metrics using brand-specific formulas
          const storeBrandMetrics =
            brandMetricDefs.get(
              storeBrand?.toLowerCase()?.includes("ford")
                ? "Ford"
                : storeBrand?.toLowerCase()?.includes("nissan")
                  ? "Nissan"
                  : storeBrand?.toLowerCase()?.includes("mazda")
                    ? "Mazda"
                    : "GMC",
            ) || keyToDef;

          storeBrandMetrics.forEach((metricDef: any) => {
            if (metricDef.type === "dollar" && metricDef.calculation) {
              const calc = metricDef.calculation;
              let calculatedValue: number | null = null;

              if (calc.type === "subtract") {
                const base = getAggValue(calc.base);
                calculatedValue = base;
                (calc.deductions || []).forEach((d: string) => {
                  calculatedValue! -= getAggValue(d);
                });
              } else if (calc.type === "complex") {
                const base = getAggValue(calc.base);
                calculatedValue = base;
                (calc.deductions || []).forEach((d: string) => {
                  calculatedValue! -= getAggValue(d);
                });
                (calc.additions || []).forEach((a: string) => {
                  calculatedValue! += getAggValue(a);
                });
              }

              if (calculatedValue !== null) {
                // Store calculated value for use in percentage calculations
                storeMetrics.set(metricDef.key, calculatedValue);
              }
            }
          });
          
          // Recalculate percentages again after derived dollar metrics are computed
          storeBrandMetrics.forEach((metricDef: any) => {
            if (metricDef.type === 'percentage' && metricDef.calculation) {
              const calc = metricDef.calculation;
              if ('numerator' in calc && 'denominator' in calc) {
                const num = getAggValue(calc.numerator);
                const denom = getAggValue(calc.denominator);
                
                if (denom !== 0) {
                  const finalValue = (num / denom) * 100;
                  const metricName = metricDef.name;
                  const entryKey = `${storeId}-${deptId}-${metricDef.key}`;
                  const comparisonKey = `${deptId}-${metricDef.key}`;
                  const comparisonInfo = comparisonMap.get(comparisonKey);
                  
                  dataMap[entryKey] = {
                    storeId,
                    storeName,
                    departmentId: deptId,
                    departmentName: deptName,
                    metricName,
                    value: finalValue,
                    target: comparisonInfo?.value || null,
                    variance: null,
                  };
                  
                  // Calculate variance
                  if (comparisonInfo?.value && comparisonInfo.value !== 0) {
                    const variance = ((finalValue - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
                    const shouldReverse = comparisonMode === "targets" && metricDef.targetDirection === 'below';
                    dataMap[entryKey].variance = shouldReverse ? -variance : variance;
                  }
                }
              }
            }
          });
        });
      } else {
        // Single month - process entries directly
        financialEntries.forEach(entry => {
          const metricName = (() => {
            const k = entry.metric_name as string;
            // For sub-metrics, preserve the raw DB key to avoid display name collisions
            // (e.g., both sub:gp_net:001:NAME and sub:total_sales:001:NAME produce "↳ NAME")
            return k.startsWith("sub:") ? k : (keyToName.get(k) || k);
          })();
          if (entry.metric_name === 'total_direct_expenses') {
            console.log("Found total_direct_expenses entry:", {
              metric_name: entry.metric_name,
              mapped_name: metricName,
              value: entry.value,
              store: (entry as any)?.departments?.stores?.name,
              dept: (entry as any)?.departments?.name
            });
          }
          const storeId = (entry as any)?.departments?.store_id || "";
          const storeName = (entry as any)?.departments?.stores?.name || "";
          const deptId = (entry as any)?.departments?.id;
          const deptName = (entry as any)?.departments?.name;
          const key = `${storeId}-${deptId}-${entry.metric_name}`;
          const storeBrand = storeBrands.get(storeId) || null;
          
          // Get comparison baseline for this metric
          const comparisonKey = `${deptId}-${entry.metric_name}`;
          const comparisonInfo = comparisonMap.get(comparisonKey);
          
          dataMap[key] = {
            storeId,
            storeName,
            departmentId: deptId,
            departmentName: deptName,
            metricName,
            value: entry.value !== null && entry.value !== undefined ? Number(entry.value) : null,
            target: comparisonInfo?.value || null,
            variance: null,
          };
          
          // Calculate variance if both value and comparison baseline exist
          if (dataMap[key].value !== null && dataMap[key].target !== null) {
            const value = dataMap[key].value!;
            const baseline = dataMap[key].target!;
            const metricDef = getMetricDef(entry.metric_name, storeBrand);
            
            if (baseline !== 0) {
              const variance = ((value - baseline) / Math.abs(baseline)) * 100;
              // Reverse sign if target direction is "below" (lower is better)
              const shouldReverse = comparisonMode === "targets" && metricDef?.targetDirection === 'below';
              dataMap[key].variance = shouldReverse ? -variance : variance;
            }
          }
        });

        // Backfill missing parent totals from sub-metrics for single-month comparisons.
        // Murray Merritt-style imports can have only sub:* rows with no parent metric rows.
        const subSumsByStoreDept = new Map<string, Map<string, number>>();

        financialEntries.forEach(e => {
          const k = e.metric_name as string;
          if (!k?.startsWith("sub:")) return;

          const storeId = (e as any)?.departments?.store_id || "";
          const deptId = (e as any)?.departments?.id;
          if (!storeId || !deptId) return;

          const parts = k.split(":");
          const parentKey = parts.length >= 2 ? parts[1] : "";
          if (!parentKey) return;

          const pairKey = `${storeId}|${deptId}`;
          if (!subSumsByStoreDept.has(pairKey)) subSumsByStoreDept.set(pairKey, new Map());

          const m = subSumsByStoreDept.get(pairKey)!;
          m.set(parentKey, (m.get(parentKey) || 0) + (e.value ? Number(e.value) : 0));
        });

        subSumsByStoreDept.forEach((parentSums, pairKey) => {
          const [storeId, deptId] = pairKey.split("|");

          // Grab metadata from any existing entry in this store/dept
          const sample = Object.values(dataMap).find(d => d.storeId === storeId && String(d.departmentId) === deptId);
          if (!sample) return;

          const storeBrand = storeBrands.get(storeId) || null;

          parentSums.forEach((sum, parentKey) => {
            const existingKey = `${storeId}-${deptId}-${parentKey}`;
            if (dataMap[existingKey]) return;

            // Skip percentage-type parents — they must be derived from formula, not summed
            const parentDef = getMetricDef(parentKey, storeBrand);
            if (parentDef?.type === 'percentage') return;

            const metricName = keyToName.get(parentKey) || parentKey;

            const comparisonKey = `${deptId}-${parentKey}`;
            const comparisonInfo = comparisonMap.get(comparisonKey);
            const metricDef = getMetricDef(parentKey, storeBrand);

            const entry: ComparisonData = {
              storeId,
              storeName: sample.storeName,
              departmentId: deptId,
              departmentName: sample.departmentName,
              metricName,
              value: sum,
              target: comparisonInfo?.value || null,
              variance: null,
            };

            if (entry.target !== null && entry.target !== 0) {
              const variance = ((sum - entry.target) / Math.abs(entry.target)) * 100;
              const shouldReverse = comparisonMode === "targets" && metricDef?.targetDirection === "below";
              entry.variance = shouldReverse ? -variance : variance;
            }

            dataMap[existingKey] = entry;
          });
        });
      }
      
      // If Fixed Combined, aggregate Parts and Service data
      if (isFixedCombined) {
        const combinedByStore = new Map<string, Map<string, number>>();
        
        // First pass: aggregate base dollar values from Parts and Service (only metrics without calculations)
        Object.values(dataMap).forEach(entry => {
          const isParts = entry.departmentName?.toLowerCase().includes('parts');
          const isService = entry.departmentName?.toLowerCase().includes('service');
          
          if (isParts || isService) {
            const metricKey = nameToKey.get(entry.metricName);
            const storeBrand = storeBrands.get(entry.storeId) || null;
            const metricDef = metricKey ? getMetricDef(metricKey, storeBrand) : null;
            
            // Only aggregate base dollar metrics (those without calculation formulas)
            if (metricKey && metricDef?.type === 'dollar' && !metricDef.calculation) {
              if (!combinedByStore.has(entry.storeId)) {
                combinedByStore.set(entry.storeId, new Map());
              }
              const storeMetrics = combinedByStore.get(entry.storeId)!;
              const currentValue = storeMetrics.get(metricKey) || 0;
              storeMetrics.set(metricKey, currentValue + (entry.value || 0));
            }
          }
        });
        
        // Helper function to calculate derived metrics with brand-specific formulas
        const calculateDerivedMetric = (storeMetrics: Map<string, number>, metricDef: any): number => {
          if (!metricDef.calculation) return 0;
          
          const calc = metricDef.calculation;
          
          if ('numerator' in calc && 'denominator' in calc) {
            // Simple ratio calculation (typically for percentages but could be dollar amounts)
            const num = storeMetrics.get(calc.numerator) || 0;
            const denom = storeMetrics.get(calc.denominator) || 0;
            return denom !== 0 ? (num / denom) * 100 : 0;
          } else if (calc.type === 'subtract') {
            // Subtraction calculation
            const base = storeMetrics.get(calc.base) || 0;
            const deductions = (calc.deductions || []).reduce((sum: number, key: string) => {
              return sum + (storeMetrics.get(key) || 0);
            }, 0);
            return base - deductions;
          } else if (calc.type === 'complex') {
            // Complex calculation with additions and deductions
            const base = storeMetrics.get(calc.base) || 0;
            const deductions = (calc.deductions || []).reduce((sum: number, key: string) => {
              return sum + (storeMetrics.get(key) || 0);
            }, 0);
            const additions = (calc.additions || []).reduce((sum: number, key: string) => {
              return sum + (storeMetrics.get(key) || 0);
            }, 0);
            return base - deductions + additions;
          }
          
          return 0;
        };
        
        // Second pass: calculate derived dollar metrics using brand-specific formulas
        combinedByStore.forEach((storeMetrics, storeId) => {
          const storeBrand = storeBrands.get(storeId) || null;
          const storeBrandMetrics = brandMetricDefs.get(
            storeBrand?.toLowerCase()?.includes('ford') ? 'Ford' :
            storeBrand?.toLowerCase()?.includes('nissan') ? 'Nissan' :
            storeBrand?.toLowerCase()?.includes('mazda') ? 'Mazda' : 'GMC'
          ) || keyToDef;
          
          storeBrandMetrics.forEach((metricDef: any) => {
            if (metricDef.type === 'dollar' && metricDef.calculation) {
              const calculatedValue = calculateDerivedMetric(storeMetrics, metricDef);
              storeMetrics.set(metricDef.key, calculatedValue);
            }
          });
        });
        
        // Third pass: create final data with both dollar and percentage metrics
        const newDataMap: Record<string, ComparisonData> = {};
        
        combinedByStore.forEach((storeMetrics, storeId) => {
          const storeName = Object.values(dataMap).find(d => d.storeId === storeId)?.storeName || '';
          const storeBrand = storeBrands.get(storeId) || null;
          
          // Process all selected metrics
          selectedMetricNames.forEach(metricName => {
            const metricKey = nameToKey.get(metricName);
            if (!metricKey) return;
            
            const metricDef = getMetricDef(metricKey, storeBrand);
            if (!metricDef) return;
            
            let finalValue: number;
            
            if (metricDef.type === 'dollar') {
              // Use aggregated or calculated dollar value
              finalValue = storeMetrics.get(metricKey) || 0;
            } else if (metricDef.type === 'percentage') {
              // Calculate percentage from dollar values
              finalValue = calculateDerivedMetric(storeMetrics, metricDef);
            } else {
              finalValue = 0;
            }
            
            const key = `${storeId}-fixed-combined-${metricKey}`;
            newDataMap[key] = {
              storeId,
              storeName,
              departmentId: undefined,
              departmentName: 'Fixed Combined',
              metricName,
              value: finalValue,
              target: null,
              variance: null,
            };
          });
        });
        
        // Replace dataMap with combined data
        Object.keys(dataMap).forEach(key => delete dataMap[key]);
        Object.assign(dataMap, newDataMap);
      }
      
      // Group by store+department for calculations
      const storeDeptPairs = new Set<string>();
      Object.values(dataMap).forEach(item => {
        storeDeptPairs.add(`${item.storeId}|${item.departmentId}`);
      });
      
      // Calculate derived metrics for each store+dept
      // Use a single pass over ALL brand metrics in config order (which respects dependencies).
      // Update allValues inline so downstream metrics (e.g., Return on Gross) can see
      // upstream derived metrics (e.g., Department Profit) calculated earlier in the same pass.
      storeDeptPairs.forEach(pair => {
        const [storeId, deptId] = pair.split('|');
        const storeBrand = storeBrands.get(storeId) || null;
        
        // Get all existing values for this store+dept
        const allValues = new Map<string, number>();
        Object.entries(dataMap).forEach(([key, data]) => {
          if (data.storeId === storeId && data.departmentId === deptId && data.value !== null) {
            const metricKey = nameToKey.get(data.metricName);
            if (metricKey) allValues.set(metricKey, data.value);
          }
        });
        
        const sampleEntry = Object.values(dataMap).find(
          d => d.storeId === storeId && d.departmentId === deptId
        );
        if (!sampleEntry) return;
        
        // Iterate ALL brand metrics in config order (ensures dependencies resolve naturally)
        const storeBrandMetrics = getMetricsForBrand(storeBrand);
        storeBrandMetrics.forEach((metricDef: any) => {
          if (!metricDef.calculation) return;
          
          const metricKey = metricDef.key;
          // Skip if already has a value from DB
          if (allValues.has(metricKey)) return;
          
          // Calculate the value
          let value: number | null = null;
          const calc = metricDef.calculation;
          
          if ('numerator' in calc && 'denominator' in calc) {
            const num = allValues.get(calc.numerator);
            const denom = allValues.get(calc.denominator);
            if (num !== undefined && denom !== undefined && denom !== 0) {
              value = (num / denom) * 100;
            }
          } else if (calc.type === 'subtract') {
            const base = allValues.get(calc.base);
            if (base !== undefined) {
              value = base;
              calc.deductions.forEach((d: string) => {
                const val = allValues.get(d);
                if (val !== undefined) value! -= val;
              });
            }
          } else if (calc.type === 'complex') {
            const base = allValues.get(calc.base);
            if (base !== undefined) {
              value = base;
              calc.deductions.forEach((d: string) => {
                const val = allValues.get(d);
                if (val !== undefined) value! -= val;
              });
              calc.additions.forEach((a: string) => {
                const val = allValues.get(a);
                if (val !== undefined) value! += val;
              });
            }
          }
          
          if (value !== null) {
            // Always update allValues so downstream metrics can use this result
            allValues.set(metricKey, value);
            
            // Only add to dataMap if this metric is selected for display
            const metricName = metricDef.name;
            if (selectedMetricNames.includes(metricName)) {
              const key = `${storeId}-${deptId}-${metricKey}`;
              if (!dataMap[key]) {
                const comparisonKey = `${deptId}-${metricKey}`;
                const comparisonInfo = comparisonMap.get(comparisonKey);
                
                dataMap[key] = {
                  storeId,
                  storeName: sampleEntry.storeName,
                  departmentId: deptId,
                  departmentName: sampleEntry.departmentName,
                  metricName,
                  value,
                  target: comparisonInfo?.value || null,
                  variance: null,
                };
                
                if (comparisonInfo && comparisonInfo.value !== 0) {
                  const variance = ((value - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
                  const shouldReverse = comparisonMode === "targets" && metricDef.targetDirection === 'below';
                  dataMap[key].variance = shouldReverse ? -variance : variance;
                }
              }
            }
          }
        });
      });
      

      // If the user selected sub-metrics under a percentage parent (e.g. "Sales Expense %"),
      // the underlying imported sub-metrics are usually stored under the NUMERATOR key
      // (e.g. sub:sales_expense:*). We therefore compute those selected sub-rows as % values
      // using the parent's denominator (e.g. GP Net).
      const percentSubSelections = selectedMetrics
        .filter((id) => id.startsWith("sub:"))
        .map((id) => {
          const parts = id.split(":");
          if (parts.length < 3) return null;

          const parentKey = parts[1];
          const subName = parts.slice(parts.length >= 4 ? 3 : 2).join(":");
          // Use detected brand's definitions so Nissan/Honda/etc. parents are found
          const parentDef = keyToDef.get(parentKey);

          if (!parentDef || parentDef.type !== "percentage" || !parentDef.calculation) return null;
          if (!("numerator" in parentDef.calculation) || !("denominator" in parentDef.calculation)) return null;

          return {
            selectionId: id,
            displayName: selectionIdToDisplayName(id),
            parentKey,
            subName,
            numeratorKey: parentDef.calculation.numerator,
            denominatorKey: parentDef.calculation.denominator,
          };
        })
        .filter(Boolean) as Array<{
        selectionId: string;
        displayName: string;
        parentKey: string;
        subName: string;
        numeratorKey: string;
        denominatorKey: string;
      }>;

      if (percentSubSelections.length > 0) {
        storeDeptPairs.forEach((pair) => {
          const [storeId, deptId] = pair.split("|");

          // Rebuild the values map for this store/dept using RAW DB keys.
          // We avoid nameToKey for sub-metrics because multiple sub-metrics across
          // different parents share the same display name (e.g. "↳ CUST. MECH. LABOUR"),
          // so nameToKey can only return one raw key per display name, losing the other.
          const allValues = new Map<string, number>();

          // 1. Add parent metric values from dataMap (no collision for non-sub metrics)
          Object.values(dataMap).forEach((d) => {
            if (d.storeId === storeId && d.departmentId === deptId && d.value !== null && d.value !== undefined) {
              const k = nameToKey.get(d.metricName);
              if (k && !k.startsWith("sub:")) allValues.set(k, d.value);
            }
          });

          // 2. Add ALL sub-metric values directly using raw DB keys,
          //    bypassing the lossy nameToKey display-name lookup entirely.
          if (isMultiMonth) {
            // Multi-month: read from aggregated storeMetrics (already keyed by raw DB key)
            const storeDeptAgg = aggregatedByStoreDept.get(`${storeId}-${deptId}`);
            if (storeDeptAgg) {
              for (const [k, v] of storeDeptAgg) {
                if (!k.startsWith("sub:")) continue;
                const numeric = typeof v === "number" ? v : (v.count > 0 ? v.sum / v.count : 0);
                allValues.set(k, numeric);
              }
            }
          } else {
            // Single-month: read directly from financialEntries
            financialEntries.forEach((entry) => {
              const rawKey = entry.metric_name as string;
              if (!rawKey?.startsWith("sub:")) return;
              const entryStoreId = (entry as any)?.departments?.store_id || "";
              const entryDeptId = (entry as any)?.departments?.id;
              if (entryStoreId !== storeId || entryDeptId !== deptId) return;
              const val = entry.value !== null ? Number(entry.value) : null;
              if (val !== null) allValues.set(rawKey, val);
            });
          }

          const sampleEntry = Object.values(dataMap).find((d) => d.storeId === storeId && d.departmentId === deptId);
          if (!sampleEntry) return;

          percentSubSelections.forEach((sel) => {
            // Find the imported numerator sub-metric that matches this subName
            let rawSubMetricKey: string | null = null;
            let subDollarValue: number | null = null;

            for (const [k, v] of allValues) {
              if (!k.startsWith(`sub:${sel.numeratorKey}:`)) continue;
              const parts = k.split(":");
              const importedSubName = parts.length >= 4 ? parts.slice(3).join(":") : "";
              if (importedSubName === sel.subName) {
                rawSubMetricKey = k;
                subDollarValue = v;
                break;
              }
            }

            if (!rawSubMetricKey || subDollarValue === null) return;

            // Try to find a matching sub-metric denominator first (e.g., sub:total_sales:001:CUST. MECH. LABOUR)
            // Fall back to parent denominator total if no sub-metric denominator exists
            let denom = 0;
            for (const [k, v] of allValues) {
              if (!k.startsWith(`sub:${sel.denominatorKey}:`)) continue;
              const parts = k.split(":");
              const importedSubName = parts.length >= 4 ? parts.slice(3).join(":") : "";
              if (importedSubName === sel.subName) {
                denom = v;
                break;
              }
            }
            if (denom === 0) {
              denom = allValues.get(sel.denominatorKey) || 0;
            }
            if (denom === 0) return;

            const percentValue = (subDollarValue / denom) * 100;
            const dataKey = `${storeId}-${deptId}-${sel.selectionId}`;

            const existing = dataMap[dataKey];
            dataMap[dataKey] = {
              storeId,
              storeName: sampleEntry.storeName,
              departmentId: deptId,
              departmentName: sampleEntry.departmentName,
              metricName: sel.selectionId,
              value: percentValue,
              target: existing?.target ?? null,
              variance: existing?.variance ?? null,
            };
          });
        });

        // After synthesis, remove the original raw-dollar numerator entries that were
        // replaced by synthesized percentage entries, to prevent duplicate rows.
        if (percentSubSelections.length > 0) {
          const keysToRemove: string[] = [];
          for (const dmKey of Object.keys(dataMap)) {
            // dmKey = storeId-deptId-rawMetricName
            const lastDash = dmKey.indexOf("-", dmKey.indexOf("-") + 1);
            if (lastDash < 0) continue;
            const rawMetricName = dmKey.substring(lastDash + 1);
            if (!rawMetricName.startsWith("sub:")) continue;

            // Check if this raw key is a numerator sub-metric that was replaced
            for (const sel of percentSubSelections) {
              if (!rawMetricName.startsWith(`sub:${sel.numeratorKey}:`)) continue;
              const parts = rawMetricName.split(":");
              const importedSubName = parts.length >= 4 ? parts.slice(3).join(":") : "";
              if (importedSubName === sel.subName) {
                keysToRemove.push(dmKey);
                break;
              }
            }
          }
          keysToRemove.forEach((k) => delete dataMap[k]);
        }
      }

      // Build complete list of all store+dept combinations from initial department IDs
      const allDepts = new Map<string, { storeId: string; storeName: string; deptId: string; deptName: string }>();
      
      
      // First pass: collect all store+dept info from entries
      financialEntries.forEach(entry => {
        const storeId = (entry as any)?.departments?.store_id || "";
        const storeName = (entry as any)?.departments?.stores?.name || "";
        const deptId = (entry as any)?.departments?.id;
        const deptName = (entry as any)?.departments?.name;
        
        if (storeId && deptId) {
          const key = `${storeId}-${deptId}`;
          if (!allDepts.has(key)) {
            allDepts.set(key, { storeId, storeName, deptId, deptName });
          }
        }
      });
      
      // Ensure ALL metrics in dataMap are included (even if not in selectedMetrics) for proper calculations
      // But only display selectedMetrics in final output
      const allMetricKeys = Array.from(keyToName.keys());
      
      // For each store+dept, ensure placeholders exist for all base metrics needed for calculations
      allDepts.forEach(({ storeId, storeName, deptId, deptName }) => {
        allMetricKeys.forEach(metricKey => {
          const metricName = keyToName.get(metricKey);
          if (!metricName) return;
          
          const key = `${storeId}-${deptId}-${metricKey}`;
          
          // Only add placeholder if it doesn't exist
          if (!dataMap[key]) {
            // Check if this metric is in selected metrics - if not, only add if it's needed for calculations
            const metricDef = keyToDef.get(metricKey); // now uses detected brand
            const isSelected = selectedMetricNames.includes(metricName);
            
            // Add placeholder for selected metrics or metrics needed for calculations
            if (isSelected) {
              const comparisonKey = `${deptId}-${metricKey}`;
              const comparisonInfo = comparisonMap.get(comparisonKey);
              
              dataMap[key] = {
                storeId,
                storeName,
                departmentId: deptId,
                departmentName: deptName,
                metricName,
                value: null,
                target: comparisonInfo?.value || null,
                variance: null,
              };
            }
          }
        });
      });
      
      // Filter to only selected metrics.
      // Most rows are keyed by their display name (selectedMetricNames), but some computed
      // rows (like percentage sub-metrics) are keyed by the original selectionId.
      // Dollar sub-metrics from DB may have an order index (sub:parent:0:name) that
      // doesn't match the selectionId format (sub:parent:name), so we also match by parts.
      const result = Object.values(dataMap).filter((item) => {
        if (selectedMetricNames.includes(item.metricName) || selectedMetrics.includes(item.metricName)) {
          return true;
        }
        // Match DB sub-metric keys (with order index) to selected sub-metrics
        const parsed = extractSubMetricParts(item.metricName);
        if (parsed) {
          return subMetricSelectionMap.has(`${parsed.parentKey}|${parsed.subName}`);
        }
        return false;
      });
      
      console.log("DealerComparison - Final comparison data:", result.length, "entries");
      console.log("DealerComparison - Has Total Direct Expenses?", result.some(r => r.metricName === "Total Direct Expenses"));
      console.log("DealerComparison - Total Direct Expenses entries:", result.filter(r => r.metricName === "Total Direct Expenses"));
      setComparisonData(result);
      setLastRefresh(new Date());
    }
  }, [financialEntries, financialTargets, yearOverYearData, prevYearAvgData, metricType, selectedMetrics, comparisonMode, datePeriodType]);

  useEffect(() => {
    if (metricType !== "financial" && kpiDefinitions && scorecardEntries) {
      const updatedData = scorecardEntries
        .map(entry => {
          const kpi = kpiDefinitions.find(k => k.id === entry.kpi_id);
          if (!kpi || !selectedMetrics.includes(kpi.name)) return null;
          
          return {
            storeId: (kpi as any)?.departments?.store_id || "",
            storeName: (kpi as any)?.departments?.stores?.name || "",
            departmentId: kpi.department_id,
            departmentName: (kpi as any)?.departments?.name,
            metricName: kpi.name,
            value: entry.actual_value ? Number(entry.actual_value) : null,
            target: kpi.target_value ? Number(kpi.target_value) : null,
            variance: entry.variance ? Number(entry.variance) : null,
          };
        })
        .filter(Boolean) as ComparisonData[];
      setComparisonData(updatedData);
      setLastRefresh(new Date());
    }
  }, [kpiDefinitions, scorecardEntries, metricType, selectedMetrics]);

  const handleManualRefresh = () => {
    if (metricType === "financial") {
      refetchFinancial();
    } else if (metricType === "dept_info") {
      // No refetch needed for questionnaire - data is static
      setLastRefresh(new Date());
    } else {
      refetchKPIs();
      refetchScorecard();
    }
  };

  // Group data by store (use storeIds passed from Enterprise)
  const uniqueStoreIds = useMemo(() => {
    return storeIds;
  }, [storeIds]);

  const storeData = comparisonData.reduce((acc, item) => {
    if (!acc[item.storeId]) {
      acc[item.storeId] = {
        storeName: item.storeName,
        metrics: {},
      };
    }
    if (!acc[item.storeId].metrics[item.metricName]) {
      acc[item.storeId].metrics[item.metricName] = {
        value: item.value,
        target: item.target,
        variance: item.variance,
      };
    }
    // Also index by matching selectionId for sub-metrics so render lookup succeeds
    const parsed = extractSubMetricParts(item.metricName);
    if (parsed) {
      const selId = subMetricSelectionMap.get(`${parsed.parentKey}|${parsed.subName}`);
      if (selId && !acc[item.storeId].metrics[selId]) {
        acc[item.storeId].metrics[selId] = {
          value: item.value,
          target: item.target,
          variance: item.variance,
        };
      }
    }
    return acc;
  }, {} as Record<string, { storeName: string; metrics: Record<string, { value: number | null; target: number | null; variance: number | null }> }>);

  // Sort stores by the selected metric (best/highest values first = left side)
  let stores = Object.entries(storeData);
  
  if (sortByMetric) {
    // Convert sortByMetric (full selection ID) to display name for data lookup
    const sortDisplayName = selectionIdToDisplayName(sortByMetric);
    stores = stores.sort(([, aData], [, bData]) => {
      const aValue = aData.metrics[sortDisplayName]?.value ?? -Infinity;
      const bValue = bData.metrics[sortDisplayName]?.value ?? -Infinity;
      // Sort descending (highest/best first on the left)
      return bValue - aValue;
    });
  }

  // Three-column comparison mode (YOY, Prev Year Avg, Prev Year Quarter) for single months
  const isThreeColumnMode = (comparisonMode === "year_over_year" || comparisonMode === "prev_year_avg" || comparisonMode === "prev_year_quarter") && datePeriodType === "month";
  const yoyCurrentYear = selectedMonth ? parseInt(selectedMonth.split("-")[0]) : new Date().getFullYear();
  const yoyPrevYear = yoyCurrentYear - 1;
  const comparisonColumnLabel: string | number = (() => {
    if (comparisonMode === "prev_year_avg") return `${yoyPrevYear} Avg`;
    if (comparisonMode === "prev_year_quarter") return `${yoyPrevYear} Q${selectedComparisonQuarter} Avg`;
    return yoyPrevYear;
  })();

  // Calculate data completeness for each store
  const storeDataCompleteness = useMemo(() => {
    if (!financialEntries || financialEntries.length === 0) return {};
    
    // Get months in the selected period
    let expectedMonths: string[] = [];
    const currentDate = new Date();
    const currentMonth = format(currentDate, 'yyyy-MM');
    
    if (datePeriodType === "month") {
      expectedMonths = [selectedMonth || currentMonth];
    } else if (datePeriodType === "full_year") {
      const year = selectedYear || currentDate.getFullYear();
      // Only expect months up to current month if it's the current year
      const maxMonth = year === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12;
      for (let m = 1; m <= maxMonth; m++) {
        expectedMonths.push(`${year}-${String(m).padStart(2, '0')}`);
      }
    } else if (datePeriodType === "custom_range" && startMonth && endMonth) {
      let current = new Date(startMonth + '-01');
      const end = new Date(endMonth + '-01');
      while (current <= end) {
        const monthStr = format(current, 'yyyy-MM');
        // Don't expect future months
        if (monthStr <= currentMonth) {
          expectedMonths.push(monthStr);
        }
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    // Group entries by store and track which months have data
    const completeness: Record<string, { 
      monthsWithData: Set<string>;
      expectedMonths: string[];
      lastCompleteMonth: string | null;
      isComplete: boolean;
    }> = {};
    
    financialEntries.forEach(entry => {
      const storeId = (entry as any)?.departments?.store_id;
      if (!storeId) return;
      
      if (!completeness[storeId]) {
        completeness[storeId] = {
          monthsWithData: new Set(),
          expectedMonths,
          lastCompleteMonth: null,
          isComplete: false,
        };
      }
      
      if (entry.month && entry.value !== null) {
        completeness[storeId].monthsWithData.add(entry.month);
      }
    });
    
    // Calculate last complete month for each store
    Object.values(completeness).forEach(store => {
      const sortedMonths = [...store.monthsWithData].sort();
      store.lastCompleteMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;
      store.isComplete = expectedMonths.every(m => store.monthsWithData.has(m));
    });
    
    return completeness;
  }, [financialEntries, datePeriodType, selectedMonth, selectedYear, startMonth, endMonth]);

  const formatMonthShort = (month: string) => {
    const date = new Date(month + '-15');
    return format(date, 'MMM yyyy');
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return "secondary";
    // Green: 10% or more above target
    if (variance >= 10) return "default"; // Green indicator
    // Yellow: Within ±10% of target  
    if (variance >= -10) return "secondary"; // Yellow indicator
    // Red: More than 10% below target
    return "destructive"; // Red indicator
  };

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null) return "N/A";

    // Sub-metrics are stored/processed using a selectionId form: "sub:<parentKey>:<subName>"
    if (metricName.startsWith("sub:")) {
      const parts = metricName.split(":");
      const parentKey = parts.length >= 2 ? parts[1] : "";
      const allDefs = getAllBrandMetricDefs();
      const parentDef = allDefs.find((d: any) => d.key === parentKey);

      if (parentDef?.type === "percentage") {
        return `${value.toFixed(1)}%`;
      }

      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }

    // Get metric definition to check type
    const metrics = getAllBrandMetricDefs();
    const metricDef = metrics.find((m: any) => m.name === metricName);

    // Check if it's a percentage metric by type or name
    if (metricDef?.type === "percentage" || metricName.includes("%") || metricName.toLowerCase().includes("percent")) {
      return `${value.toFixed(1)}%`;
    }

    // Format as currency for dollar metrics
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format difference values with +/- sign
  const formatDiffValue = (diff: number, metricName: string): string => {
    const sign = diff >= 0 ? "+" : "";
    if (metricName.startsWith("sub:")) {
      const parts = metricName.split(":");
      const parentKey = parts.length >= 2 ? parts[1] : "";
      const allDefs = getAllBrandMetricDefs();
      const parentDef = allDefs.find((d: any) => d.key === parentKey);
      if (parentDef?.type === "percentage") {
        return `${sign}${diff.toFixed(1)}%`;
      }
      return `${sign}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(diff)}`;
    }
    const metrics = getAllBrandMetricDefs();
    const metricDef = metrics.find((m: any) => m.name === metricName);
    if (metricDef?.type === "percentage" || metricName.includes("%") || metricName.toLowerCase().includes("percent")) {
      return `${sign}${diff.toFixed(1)}%`;
    }
    return `${sign}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(diff)}`;
  };

  // Determine if a positive diff is favorable for a metric
  const isDiffFavorable = (diff: number, selectionId: string): boolean => {
    const allDefs = getAllBrandMetricDefs();
    const parsed = extractSubMetricParts(selectionId);
    if (parsed) {
      const parentDef = allDefs.find((d: any) => d.key === parsed.parentKey);
      if (parentDef?.targetDirection === "below") return diff < 0;
      return diff > 0;
    }
    const metricDef = allDefs.find((d: any) => d.name === selectionId);
    if (metricDef?.targetDirection === "below") return diff < 0;
    return diff > 0;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[2000px] mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/enterprise")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">
              {filterName ? `${filterName}` : "Dealer Comparison Dashboard"}
            </h1>
            <p className="text-muted-foreground">
              <span className="font-medium">{brandDisplayName}</span>
              {selectedDepartmentNames.length > 0 && (
                <>
                  {" • "}
                  <span className="font-medium">{selectedDepartmentNames.join(", ")}</span>
                </>
              )}
              {" • "}Comparing {uniqueStoreIds.length} stores across {selectedMetrics.length} {metricType === "dept_info" ? "questions" : "metrics"}
              {metricType !== "dept_info" && selectedMonth && ` • ${selectedMonth.substring(0, 7) === selectedMonth ? 
                format(new Date(selectedMonth + '-15'), 'MMMM yyyy') : 
                format(new Date(selectedMonth), 'MMMM yyyy')}`}
              {metricType !== "dept_info" && comparisonMode !== "none" && (
                <>
                  {" • "}
                  {comparisonMode === "targets" && "vs Store Targets"}
                  {comparisonMode === "year_over_year" && "vs Year over Year"}
                  {comparisonMode === "prev_year_avg" && `vs ${yoyPrevYear} Avg`}
                  {comparisonMode === "prev_year_quarter" && `vs ${yoyPrevYear} Q${selectedComparisonQuarter} Avg`}
                </>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refreshing every 60s
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            className="gap-2"
            disabled={metricType !== "dept_info" ? stores.length === 0 : (!questionnaireAnswers || questionnaireAnswers.length === 0)}
          >
            <Mail className="h-4 w-4" />
            Email Report
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {metricType === "dept_info" ? "Service Dept Info Comparison" : "Side-by-Side Comparison"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricType === "dept_info" ? (
              <QuestionnaireComparisonTable
                data={questionnaireAnswers || []}
                selectedQuestions={selectedMetrics}
                loading={questionnaireLoading}
              />
            ) : stores.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <p className="text-lg font-semibold text-muted-foreground">No data available</p>
                <p className="text-sm text-muted-foreground">
                  There are no financial entries for the selected period.
                  <br />
                  Please select a different date range or add financial data.
                </p>
                <Button onClick={() => navigate("/enterprise")} variant="outline">
                  Return to Enterprise View
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 border-b-2" rowSpan={isThreeColumnMode ? 2 : 1}>
                        <div className="text-base font-bold">Metric</div>
                      </TableHead>
                      {stores.map(([storeId, store]) => {
                        const completeness = storeDataCompleteness[storeId];
                        return (
                          <TableHead key={storeId} className="text-center min-w-[200px] border-b-2" colSpan={isThreeColumnMode ? 3 : 1}>
                            <div className="text-base font-bold">{store.storeName}</div>
                            {completeness && metricType === "financial" && !completeness.isComplete && (
                              <div className="flex justify-center mt-1">
                                <DataCoverageBadge 
                                  monthsWithData={completeness.monthsWithData.size} 
                                  totalMonths={completeness.expectedMonths.length} 
                                />
                              </div>
                            )}
                            {completeness && metricType === "financial" && datePeriodType !== "month" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center gap-1 mt-1">
                                      {completeness.isComplete ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {completeness.lastCompleteMonth 
                                          ? `Thru ${formatMonthShort(completeness.lastCompleteMonth)}`
                                          : 'No data'}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      <p className="font-medium mb-1">
                                        {completeness.isComplete 
                                          ? 'All months have data' 
                                          : `${completeness.monthsWithData.size} of ${completeness.expectedMonths.length} months have data`}
                                      </p>
                                      <p className="text-muted-foreground">
                                        Latest: {completeness.lastCompleteMonth 
                                          ? formatMonthShort(completeness.lastCompleteMonth) 
                                          : 'None'}
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableHead>
                        );
                      })}
                      <TableHead className="text-center min-w-[200px] border-b-2" rowSpan={isThreeColumnMode ? 2 : 1}>
                        <div className="text-sm font-semibold">Notes</div>
                      </TableHead>
                    </TableRow>
                    {isThreeColumnMode && (
                      <TableRow>
                        {stores.map(([storeId]) => (
                          <Fragment key={storeId}>
                            <TableHead className="text-center text-xs font-semibold border-b-2 px-2 min-w-[100px]">{yoyCurrentYear}</TableHead>
                            <TableHead className="text-center text-xs font-semibold border-b-2 px-2 min-w-[100px]">{comparisonColumnLabel}</TableHead>
                            <TableHead className="text-center text-xs font-semibold border-b-2 px-2 min-w-[80px]">Diff</TableHead>
                          </Fragment>
                        ))}
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {orderedSelectedMetrics.map((selectionId) => {
                      // Convert selection ID to display name for rendering
                      const displayName = selectionIdToDisplayName(selectionId);
                      const isSortedRow = sortByMetric && selectionId === sortByMetric;
                      const isSubMetric = selectionId.startsWith('sub:') || displayName.startsWith('↳ ');
                      const isParent = parentMetricKeys.has(selectionId);
                      return (
                      <TableRow key={selectionId} className={`${isSortedRow ? "bg-primary/10" : ""} ${isSubMetric ? "bg-muted/50" : ""} ${isParent ? "bg-primary/5" : ""}`}>
                        <TableCell className={`font-medium sticky left-0 z-10 ${isSortedRow ? "bg-primary/10 font-semibold text-primary" : isSubMetric ? "bg-muted pl-6 text-muted-foreground" : isParent ? "bg-primary/5 font-semibold border-l-2 border-primary" : "bg-background"}`}>
                          {displayName}
                        </TableCell>
                        {stores.map(([storeId, store]) => {
                          // Lookup data by selectionId first, then by display name (dollar sub-metrics
                          // are stored under their display name e.g. "↳ ABSENTEE COMPENSATION")
                          let metricData = store.metrics[selectionId] || store.metrics[displayName];

                          if (isThreeColumnMode) {
                            const curValue = metricData?.value ?? null;
                            const lyValue = metricData?.target ?? null;
                            const diff = (curValue !== null && lyValue !== null) ? curValue - lyValue : null;
                            const favorable = diff !== null ? isDiffFavorable(diff, selectionId) : null;
                            return (
                              <Fragment key={storeId}>
                                <TableCell className="text-center px-2">
                                  <span className="font-semibold">{formatValue(curValue, selectionId)}</span>
                                </TableCell>
                                <TableCell className="text-center px-2 text-muted-foreground">
                                  {formatValue(lyValue, selectionId)}
                                </TableCell>
                                <TableCell className={`text-center px-2 font-medium ${diff !== null ? (favorable ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                                  {diff !== null ? formatDiffValue(diff, selectionId) : '-'}
                                </TableCell>
                              </Fragment>
                            );
                          }

                          return (
                            <TableCell key={storeId} className="text-center">
                              {metricData ? (
                                <div className="space-y-2">
                                  <div className="text-lg font-semibold">
                                    {formatValue(metricData.value, selectionId)}
                                  </div>
                                  {metricData.target !== null && (
                                    <div className="text-xs text-muted-foreground">
                                      {comparisonMode === "year_over_year" ? "LY" : comparisonMode === "prev_year_avg" ? `${yoyPrevYear} Avg` : comparisonMode === "prev_year_quarter" ? `${yoyPrevYear} Q${selectedComparisonQuarter}` : "Target"}: {formatValue(metricData.target, selectionId)}
                                    </div>
                                  )}
                                  {metricData.variance !== null && (
                                    <Badge variant={getVarianceColor(metricData.variance)}>
                                      {metricData.variance >= 0 ? "+" : ""}
                                      {metricData.variance.toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No data</span>
                              )}
                            </TableCell>
                          );
                        })}
                        {/* Notes cell */}
                        <TableCell className="px-2">
                          <div className="flex items-center gap-1.5">
                            {noteNumberMap[selectionId] && (
                              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: '#7c3aed' }}>
                                {noteNumberMap[selectionId]}
                              </span>
                            )}
                            <input
                              type="text"
                              value={rowNotes[selectionId] || ''}
                              onChange={(e) => setRowNotes(prev => ({ ...prev, [selectionId]: e.target.value }))}
                              placeholder="Add note..."
                              className="w-full min-w-[140px] bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-primary focus:outline-none text-sm py-0.5 placeholder:text-muted-foreground/40"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Dialog */}
      <EmailComparisonDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        storeIds={uniqueStoreIds}
        stores={metricType === "dept_info" 
          ? Array.from(new Set(questionnaireAnswers?.map(a => `${a.storeName}|${a.departmentName}`) || [])).map(key => {
              const [storeName, departmentName] = key.split('|');
              return {
                storeId: key,
                storeName,
                departmentName,
                monthsWithData: [],
                lastCompleteMonth: null,
                isComplete: true,
              };
            })
          : stores.map(([storeId, store]) => {
              const completeness = storeDataCompleteness[storeId];
              return {
                storeId,
                storeName: store.storeName,
                monthsWithData: completeness ? Array.from(completeness.monthsWithData) : [],
                lastCompleteMonth: completeness?.lastCompleteMonth || null,
                isComplete: completeness?.isComplete || false,
              };
            })
        }
        metrics={orderedSelectedMetrics.map(selectionId => {
          const displayName = selectionIdToDisplayName(selectionId);
          return {
            metricName: selectionId,
            displayName,
            isPercentage: (() => {
              if (selectionId.startsWith("sub:")) {
                const parts = selectionId.split(":");
                const parentKey = parts.length >= 2 ? parts[1] : "";
                const allDefs = getAllBrandMetricDefs();
                const parentDef = allDefs.find((d: any) => d.key === parentKey);
                return parentDef?.type === "percentage";
              }
              const allDefs = getAllBrandMetricDefs();
              const metricDef = allDefs.find((d: any) => d.name === selectionId);
              return metricDef?.type === "percentage" || selectionId.includes("%");
            })(),
            lowerIsBetter: (() => {
              const allDefs = getAllBrandMetricDefs();
              const parsed = extractSubMetricParts(selectionId);
              if (parsed) {
                const parentDef = allDefs.find((d: any) => d.key === parsed.parentKey);
                return parentDef?.targetDirection === "below";
              }
              const metricDef = allDefs.find((d: any) => d.name === selectionId);
              return metricDef?.targetDirection === "below";
            })(),
            storeValues: stores.reduce((acc, [storeId, store]) => {
              // Use same lookup as render: try selectionId first, then displayName
              const metricData = store.metrics[selectionId] || store.metrics[displayName];
              acc[storeId] = metricData || { value: null, target: null, variance: null };
              return acc;
            }, {} as Record<string, { value: number | null; target: number | null; variance: number | null }>),
          };
        })}
        questionnaireData={metricType === "dept_info" ? questionnaireAnswers : undefined}
        metricType={metricType}
        selectedMetrics={orderedSelectedMetrics}
        datePeriodType={datePeriodType}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        startMonth={startMonth}
        endMonth={endMonth}
        comparisonMode={comparisonMode}
        filterName={filterName}
        brandDisplayName={brandDisplayName}
        selectedDepartmentNames={selectedDepartmentNames}
        isYoyMonth={isThreeColumnMode}
        yoyCurrentYear={yoyCurrentYear}
        yoyPrevYear={comparisonColumnLabel}
        rowNotes={rowNotes}
      />
    </div>
  );
}
