import { useState, useEffect, useMemo, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TrendingUp, TrendingDown, Loader2, RotateCcw, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useForecast } from '@/hooks/forecast/useForecast';
import { useWeightedBaseline } from '@/hooks/forecast/useWeightedBaseline';
import { useForecastCalculations } from '@/hooks/forecast/useForecastCalculations';
import { useSubMetrics } from '@/hooks/useSubMetrics';
import { ForecastWeightsPanel } from './forecast/ForecastWeightsPanel';
import { ForecastDriverInputs } from './forecast/ForecastDriverInputs';
import { ForecastResultsGrid } from './forecast/ForecastResultsGrid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FormattedCurrency, formatCurrency } from '@/components/ui/formatted-currency';

const FORECAST_YEAR_KEY = 'forecast-selected-year';

interface ForecastDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName: string;
}

export function ForecastDrawer({ open, onOpenChange, departmentId, departmentName }: ForecastDrawerProps) {
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear + 1];
  
  // Initialize from localStorage or default to current year
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem(FORECAST_YEAR_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (yearOptions.includes(parsed)) return parsed;
    }
    return currentYear;
  });

  const forecastYear = selectedYear;
  const priorYear = forecastYear - 1;

  // Persist year selection
  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year, 10);
    setSelectedYear(yearNum);
    localStorage.setItem(FORECAST_YEAR_KEY, year);
    // Reset state when year changes
    driversInitialized.current = false;
    driversLoadedFromDb.current = false;
    overridesLoadedFromDb.current = false;
    setSubMetricOverrides([]);
    setGrowth(0);
  };
  const [view, setView] = useState<'monthly' | 'quarter' | 'annual'>('monthly');
  const [visibleMonthStart, setVisibleMonthStart] = useState(0);

  // Driver states - simplified to single growth slider
  const [growth, setGrowth] = useState(0);
  const [salesExpense, setSalesExpense] = useState(0); // Annual sales expense in dollars
  const [fixedExpense, setFixedExpense] = useState(0);

  // Baseline values for comparison
  const [baselineSalesExpense, setBaselineSalesExpense] = useState<number | undefined>();
  const [baselineFixedExpense, setBaselineFixedExpense] = useState<number | undefined>();

  // Sub-metric overrides: user-defined annual values
  const [subMetricOverrides, setSubMetricOverrides] = useState<{ subMetricKey: string; parentKey: string; overriddenAnnualValue: number }[]>([]);

  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailView, setEmailView] = useState<'monthly' | 'quarter' | 'annual'>('monthly');
  const [sendToMyself, setSendToMyself] = useState(true);
  const [customEmail, setCustomEmail] = useState('');
  const [includeSubMetrics, setIncludeSubMetrics] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Track if drivers have changed for auto-save
  const driversInitialized = useRef(false);
  const driversLoadedFromDb = useRef(false);
  const overridesLoadedFromDb = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const driverSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const overrideSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef(false);

  const markDirty = () => {
    isDirtyRef.current = true;
  };

  // Hooks
  const queryClient = useQueryClient();

  const {
    forecast,
    entries,
    weights,
    driverSettings,
    subMetricOverrides: savedOverrides,
    isLoading,
    createForecast,
    updateWeight,
    resetWeights,
    updateEntry,
    bulkUpdateEntries,
    saveDriverSettings,
    bulkSaveSubMetricOverrides,
    deleteAllSubMetricOverrides,
    deleteDriverSettings,
    resetAllEntries,
  } = useForecast(departmentId, forecastYear);

  // Use prior year (forecastYear - 1) for weight distribution
  const baselineYear = forecastYear - 1;

  const {
    calculatedWeights,
    isLoading: weightsLoading,
  } = useWeightedBaseline(departmentId, baselineYear);

  const resetWeightsToCalculated = async () => {
    if (!forecast?.id) return;
    if (!weights || weights.length === 0) return;
    if (!calculatedWeights || calculatedWeights.length === 0) return;

    const updates = weights.map(async (w) => {
      const cw = calculatedWeights.find((x) => x.month_number === w.month_number);
      if (!cw) return;

      const { error } = await supabase
        .from('forecast_weights')
        .update({
          original_weight: cw.weight,
          adjusted_weight: cw.weight,
          is_locked: false,
        })
        .eq('id', w.id);

      if (error) throw error;
    });

    await Promise.all(updates);
    await queryClient.invalidateQueries({ queryKey: ['forecast-weights', forecast.id] });
    toast.success('Weights reset to original');
  };
  const { data: priorYearData } = useQuery({
    queryKey: ['prior-year-financial', departmentId, priorYear],
    queryFn: async () => {
      if (!departmentId) return [];

      // Only fetch main metrics (not sub-metrics) - sub-metrics are loaded separately via useSubMetrics.
      // This avoids hitting the Supabase 1000 row limit which would silently truncate later months.
      const { data, error } = await supabase
        .from('financial_entries')
        .select('month, metric_name, value')
        .eq('department_id', departmentId)
        .gte('month', `${priorYear}-01`)
        .lte('month', `${priorYear}-12`)
        .not('metric_name', 'like', 'sub:%');

      if (error) throw error;
      return data;
    },
    enabled: !!departmentId,
  });

  // Keep forecast baseline in sync when spreadsheets are imported (they write financial_entries).
  // Without this, React Query can hold onto stale prior-year data and the forecast won't update.
  useEffect(() => {
    if (!departmentId) return;

    const getYearFromMonth = (m?: string) => {
      if (!m) return null;
      const y = parseInt(String(m).slice(0, 4), 10);
      return Number.isFinite(y) ? y : null;
    };

    const channel = supabase
      .channel(`financial-entries:${departmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_entries',
          filter: `department_id=eq.${departmentId}`,
        },
        (payload) => {
          const rowNew = payload.new as any;
          const rowOld = payload.old as any;

          const changedMonth: string | undefined = rowNew?.month ?? rowOld?.month;
          const changedYear = getYearFromMonth(changedMonth);

          // Forecast baselines depend on the *prior year* and the weights depend on baselineYear (which = priorYear).
          if (changedYear === priorYear) {
            queryClient.invalidateQueries({ queryKey: ['prior-year-financial', departmentId, priorYear] });
            queryClient.invalidateQueries({ queryKey: ['baseline-year-sales', departmentId, priorYear] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, priorYear, queryClient]);

  // Fetch store brand for metric definitions
  const { data: storeBrand } = useQuery({
    queryKey: ['department-store-brand', departmentId],
    queryFn: async () => {
      if (!departmentId) return null;

      // Get department's store
      const { data: dept, error: deptError } = await supabase
        .from('departments')
        .select('store_id')
        .eq('id', departmentId)
        .maybeSingle();

      if (deptError || !dept?.store_id) return null;

      // Get store's brand
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('brand, brand_id, brands:brand_id(name)')
        .eq('id', dept.store_id)
        .maybeSingle();

      if (storeError || !store) return null;

      // Prefer brand_id -> brands.name, fallback to store.brand
      const brandsData = store.brands as { name: string } | null;
      return brandsData?.name || store.brand || null;
    },
    enabled: !!departmentId,
  });
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const priorYearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return `${priorYear}-${String(m).padStart(2, '0')}`;
    });
  }, [priorYear]);

  // Fetch sub-metrics using the existing sub-metric naming convention (sub:{parent}:{order}:{name})
  const { subMetrics: subMetricEntries } = useSubMetrics(departmentId, priorYearMonths);

  // Convert prior year data to baseline map
  const baselineData = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    priorYearData?.forEach((entry) => {
      // Skip sub-metrics (they're handled separately)
      if (entry.metric_name.startsWith('sub:')) return;
      
      if (!map.has(entry.month)) {
        map.set(entry.month, new Map());
      }
      const monthMap = map.get(entry.month)!;
      const existingValue = monthMap.get(entry.metric_name) || 0;
      // Sum values for the same metric in the same month
      monthMap.set(entry.metric_name, existingValue + (entry.value || 0));
    });

    return map;
  }, [priorYearData]);

  // Convert sub-metrics to baseline format for calculations hook
  const subMetricBaselines = useMemo(() => {
    if (!subMetricEntries || subMetricEntries.length === 0) return [];

    const grouped = new Map<
      string,
      { parentKey: string; name: string; orderIndex: number; values: Map<string, number> }
    >();

    for (const entry of subMetricEntries) {
      const key = `${entry.parentMetricKey}:${entry.orderIndex}:${entry.name}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          parentKey: entry.parentMetricKey,
          name: entry.name,
          orderIndex: entry.orderIndex,
          values: new Map(),
        });
      }
      grouped.get(key)!.values.set(entry.monthIdentifier, entry.value ?? 0);
    }

    return Array.from(grouped.values()).map((g) => ({
      parentKey: g.parentKey,
      name: g.name,
      orderIndex: g.orderIndex,
      monthlyValues: g.values,
    }));
  }, [subMetricEntries]);

  // Use the calculations hook
  const {
    monthlyValues,
    quarterlyValues,
    annualValues,
    subMetricForecasts,
    months,
    metricDefinitions,
    distributeQuarterToMonths,
    impliedGrowth,
  } = useForecastCalculations({
    entries,
    weights,
    baselineData,
    subMetricBaselines,
    subMetricOverrides,
    forecastYear,
    growth,
    salesExpense,
    fixedExpense,
    brand: storeBrand,
  });

  // Keep latest computed values in refs so the auto-save effect
  // doesn't need to depend on large Map objects (which change identity often).
  const latestMonthlyValuesRef = useRef(monthlyValues);
  const latestEntriesRef = useRef(entries);

  useEffect(() => {
    latestMonthlyValuesRef.current = monthlyValues;
  }, [monthlyValues]);

  useEffect(() => {
    latestEntriesRef.current = entries;
  }, [entries]);

  // Create forecast if it doesn't exist when drawer opens
  useEffect(() => {
    if (open && !forecast && !isLoading && calculatedWeights.length > 0 && !createForecast.isPending) {
      const initialWeights = calculatedWeights.map(w => ({
        month_number: w.month_number,
        weight: w.weight,
      }));
      createForecast.mutate(initialWeights);
    }
  }, [open, forecast, isLoading, calculatedWeights, createForecast.isPending]);

  // Initialize driver values from baseline data OR from saved settings
  useEffect(() => {
    // First, try to load from saved driver settings
    if (driverSettings && !driversLoadedFromDb.current && forecast) {
      if (driverSettings.growth_percent !== null) {
        setGrowth(driverSettings.growth_percent);
      }
      if (driverSettings.sales_expense !== null) {
        setSalesExpense(driverSettings.sales_expense);
      }
      if (driverSettings.fixed_expense !== null) {
        setFixedExpense(driverSettings.fixed_expense);
      }
      driversLoadedFromDb.current = true;
      driversInitialized.current = true;
    }
  }, [driverSettings, forecast]);

  // Initialize baseline values from prior year data
  useEffect(() => {
    if (priorYearData && priorYearData.length > 0) {
      // Calculate prior year totals to set baseline values
      const totals: Record<string, number> = {};
      priorYearData.forEach(entry => {
        totals[entry.metric_name] = (totals[entry.metric_name] || 0) + (entry.value || 0);
      });

      if (totals.sales_expense) {
        setBaselineSalesExpense(totals.sales_expense);
        // Only set initial value if not loaded from DB
        if (!driversLoadedFromDb.current) {
          setSalesExpense(totals.sales_expense);
        }
      }
      if (totals.total_fixed_expense) {
        setBaselineFixedExpense(totals.total_fixed_expense);
        // Only set initial value if not loaded from DB
        if (!driversLoadedFromDb.current) {
          setFixedExpense(totals.total_fixed_expense);
        }
      }

      driversInitialized.current = true;
    }
  }, [priorYearData]);

  // Load saved sub-metric overrides from database
  useEffect(() => {
    if (savedOverrides && savedOverrides.length > 0 && !overridesLoadedFromDb.current && forecast) {
      const loadedOverrides = savedOverrides.map(o => ({
        subMetricKey: o.sub_metric_key,
        parentKey: o.parent_metric_key,
        overriddenAnnualValue: o.overridden_annual_value,
      }));
      setSubMetricOverrides(loadedOverrides);
      overridesLoadedFromDb.current = true;
    }
  }, [savedOverrides, forecast]);

  // Auto-save driver settings when they change
  useEffect(() => {
    if (!forecast?.id) return;
    if (!driversInitialized.current) return;
    if (!driversLoadedFromDb.current && !driverSettings) {
      // First time, no saved settings yet - only save if user made changes
      return;
    }

    // Debounce driver settings save
    if (driverSaveTimerRef.current) {
      clearTimeout(driverSaveTimerRef.current);
    }

    driverSaveTimerRef.current = setTimeout(() => {
      saveDriverSettings.mutate({
        growthPercent: growth,
        salesExpense: salesExpense,
        fixedExpense: fixedExpense,
      });
    }, 800);

    return () => {
      if (driverSaveTimerRef.current) {
        clearTimeout(driverSaveTimerRef.current);
      }
    };
  }, [forecast?.id, growth, salesExpense, fixedExpense, driversInitialized.current]);

  // Auto-save sub-metric overrides when they change
  useEffect(() => {
    if (!forecast?.id) return;
    if (!overridesLoadedFromDb.current && savedOverrides?.length === 0 && subMetricOverrides.length === 0) {
      return;
    }

    // Debounce override save
    if (overrideSaveTimerRef.current) {
      clearTimeout(overrideSaveTimerRef.current);
    }

    overrideSaveTimerRef.current = setTimeout(() => {
      if (subMetricOverrides.length > 0) {
        bulkSaveSubMetricOverrides.mutate(subMetricOverrides.map(o => ({
          subMetricKey: o.subMetricKey,
          parentMetricKey: o.parentKey,
          overriddenAnnualValue: o.overriddenAnnualValue,
        })));
      }
    }, 800);

    return () => {
      if (overrideSaveTimerRef.current) {
        clearTimeout(overrideSaveTimerRef.current);
      }
    };
  }, [forecast?.id, subMetricOverrides]);


  const overridesSignature = useMemo(() => {
    return subMetricOverrides
      .map((o) => `${o.subMetricKey}:${o.overriddenAnnualValue}`)
      .join('|');
  }, [subMetricOverrides]);

  // Sync growth slider with implied growth when sub-metric overrides or locked entries change
  // This ensures the slider reflects the actual growth implied by edits
  const lastSyncedOverridesSignature = useRef<string | null>(null);
  const lastSyncedImpliedGrowth = useRef<number | null>(null);

  // Track locked entries to detect when main metrics are edited
  const lockedEntriesSignature = useMemo(() => {
    return entries
      .filter(e => e.is_locked)
      .map(e => `${e.month}:${e.metric_name}:${e.forecast_value}`)
      .join('|');
  }, [entries]);

  // For stores without sub-metrics: only sync Growth slider when edits actually imply a growth change.
  // Editing GP% alone should NOT drive Growth (it changes GP Net via ratio and can create a feedback loop).
  const hasLockedGrowthDrivers = useMemo(() => {
    return entries.some(
      (e) =>
        e.is_locked &&
        (e.metric_name === 'total_sales' || e.metric_name === 'gp_net')
    );
  }, [entries]);

  useEffect(() => {
    if (!driversInitialized.current) return;
    if (impliedGrowth === undefined) return;

    // For stores with sub-metric overrides, sync when overrides change
    if (subMetricOverrides.length > 0) {
      if (lastSyncedOverridesSignature.current === overridesSignature) return;

      if (Math.abs(impliedGrowth - growth) > 0.1) {
        lastSyncedOverridesSignature.current = overridesSignature;
        lastSyncedImpliedGrowth.current = impliedGrowth;
        setGrowth(impliedGrowth);
      }
      return;
    }

    // For stores WITHOUT sub-metrics: only sync when Total Sales / GP Net were directly edited.
    if (!hasLockedGrowthDrivers) return;

    // Only sync if the implied growth is significantly different and has changed
    if (
      lastSyncedImpliedGrowth.current !== null &&
      Math.abs(impliedGrowth - lastSyncedImpliedGrowth.current) < 0.1
    ) {
      return;
    }

    if (Math.abs(impliedGrowth - growth) > 0.1) {
      lastSyncedImpliedGrowth.current = impliedGrowth;
      setGrowth(impliedGrowth);
    }
  // NOTE: `growth` is intentionally excluded from deps to prevent an infinite loop.
  // We use lastSyncedImpliedGrowth ref to track what we've already synced.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    impliedGrowth,
    overridesSignature,
    subMetricOverrides.length,
    lockedEntriesSignature,
    hasLockedGrowthDrivers,
  ]);

  const weightsSignature = useMemo(() => {
    return (weights ?? [])
      .map((w) => `${w.month_number}:${w.adjusted_weight}:${w.is_locked}`)
      .join('|');
  }, [weights]);


  // Auto-save forecast entries when inputs change (drivers/weights/overrides)
  useEffect(() => {
    if (!open) return;
    if (!forecast || !driversInitialized.current) return;
    if (!isDirtyRef.current) return;
    if (bulkUpdateEntries.isPending) return;

    // Debounce auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const currentMonthlyValues = latestMonthlyValuesRef.current;
      const currentEntries = latestEntriesRef.current;

      // Build updates from calculated values (skip locked, skip no-op writes)
      const updates: { month: string; metricName: string; forecastValue: number; baselineValue?: number }[] = [];
      const EPS = 0.0001;

      currentMonthlyValues.forEach((metrics, month) => {
        metrics.forEach((result, metricKey) => {
          const entry = currentEntries.find((e) => e.month === month && e.metric_name === metricKey);
          if (entry?.is_locked) return;

          const nextForecast = result.value;
          const nextBaseline = result.baseline_value;

          const prevForecast = entry?.forecast_value ?? null;
          const prevBaseline = entry?.baseline_value ?? null;

          const forecastChanged = prevForecast === null ? true : Math.abs(prevForecast - nextForecast) > EPS;
          const baselineChanged =
            nextBaseline === undefined
              ? false
              : prevBaseline === null
                ? true
                : Math.abs(prevBaseline - nextBaseline) > EPS;

          if (!entry || forecastChanged || baselineChanged) {
            updates.push({
              month,
              metricName: metricKey,
              forecastValue: nextForecast,
              baselineValue: nextBaseline,
            });
          }
        });
      });

      if (updates.length > 0) {
        bulkUpdateEntries.mutate(updates, {
          onSuccess: () => {
            isDirtyRef.current = false;
          },
        });
      }
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    open,
    forecast?.id,
    growth,
    salesExpense,
    fixedExpense,
    weightsSignature,
    overridesSignature,
  ]);

  // Handle cell edits - do NOT auto-lock; locking is only via explicit user action
  const handleCellEdit = (month: string, metricName: string, value: number) => {
    if (view === 'quarter') {
      // Distribute to months (no auto-lock)
      const distributions = distributeQuarterToMonths(month as 'Q1' | 'Q2' | 'Q3' | 'Q4', metricName, value);
      distributions.forEach((d) => {
        updateEntry.mutate({ month: d.month, metricName, forecastValue: d.value });
      });
    } else {
      updateEntry.mutate({ month, metricName, forecastValue: value });
    }
  };

  // Handle lock toggle for individual cell
  const handleToggleLock = (month: string, metricName: string) => {
    const entry = entries.find(e => e.month === month && e.metric_name === metricName);
    const currentLocked = entry?.is_locked ?? false;
    updateEntry.mutate({ month, metricName, isLocked: !currentLocked });
  };

  // Handle locking/unlocking entire row (all months for a metric)
  const handleLockRow = (metricName: string, lock: boolean) => {
    const updates: { month: string; metricName: string; forecastValue: number; isLocked: boolean }[] = [];
    
    months.forEach((month) => {
      // When unlocking, preserve the stored forecast_value from the database entry
      // Don't use monthlyValues which comes from the calculation engine
      const existingEntry = entries.find(e => e.month === month && e.metric_name === metricName);
      const storedValue = existingEntry?.forecast_value;
      
      // When locking, use the current calculated value; when unlocking, keep the stored value
      if (lock) {
        const monthData = monthlyValues.get(month);
        const metricData = monthData?.get(metricName);
        const currentValue = metricData?.value ?? 0;
        updates.push({
          month,
          metricName,
          forecastValue: currentValue,
          isLocked: true,
        });
      } else if (storedValue !== null && storedValue !== undefined) {
        // Only update the lock status, preserve the stored value
        updates.push({
          month,
          metricName,
          forecastValue: storedValue,
          isLocked: false,
        });
      }
      // If no stored value and unlocking, skip - nothing to preserve
    });
    
    if (updates.length > 0) {
      bulkUpdateEntries.mutate(updates);
    }
  };

  // Handle month navigation
  const handleMonthNavigate = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && visibleMonthStart > 0) {
      setVisibleMonthStart(visibleMonthStart - 1);
    } else if (direction === 'next' && visibleMonthStart < 6) {
      setVisibleMonthStart(visibleMonthStart + 1);
    }
  };

  // Handle sub-metric annual value edit
  const handleSubMetricEdit = (subMetricKey: string, parentKey: string, newAnnualValue: number) => {
    setSubMetricOverrides(prev => {
      const existingIndex = prev.findIndex(o => o.subMetricKey === subMetricKey);
      let updated = [...prev];
      
      if (existingIndex >= 0) {
        updated[existingIndex] = { subMetricKey, parentKey, overriddenAnnualValue: newAnnualValue };
      } else {
        updated = [...updated, { subMetricKey, parentKey, overriddenAnnualValue: newAnnualValue }];
      }
      
      // Extract sub-metric name for matching
      const parts = subMetricKey.split(':');
      const subMetricNameRaw = parts.length >= 4 ? parts.slice(3).join(':') : parts.slice(2).join(':');
      const normalizeName = (name: string) => name.trim().toLowerCase();
      const subMetricName = normalizeName(subMetricNameRaw);
      
      // When editing GP Net, remove any existing GP% override for the same sub-metric name
      // This allows GP% to be derived from the new GP Net value
      if (parentKey === 'gp_net') {
        updated = updated.filter(o => {
          if (o.parentKey !== 'gp_percent') return true;
          const gpParts = o.subMetricKey.split(':');
          const gpNameRaw = gpParts.length >= 4 ? gpParts.slice(3).join(':') : gpParts.slice(2).join(':');
          return normalizeName(gpNameRaw) !== subMetricName;
        });
      }
      
      // When editing GP%, calculate the new GP Net for the same sub-metric
      // GP Net = Total Sales × (GP% / 100)
      if (parentKey === 'gp_percent') {
        // Find the matching total_sales sub-metric to calculate GP Net
        const gpNetSubMetrics = subMetricForecasts?.get('gp_net') || [];
        const totalSalesSubMetrics = subMetricForecasts?.get('total_sales') || [];
        
        // Find matching GP Net and Total Sales sub-metrics by name
        const matchingGpNet = gpNetSubMetrics.find(sm => {
          const smParts = sm.key.split(':');
          const smName = smParts.length >= 4 ? smParts.slice(3).join(':') : smParts.slice(2).join(':');
          return normalizeName(smName) === subMetricName;
        });
        
        const matchingTotalSales = totalSalesSubMetrics.find(sm => {
          const smParts = sm.key.split(':');
          const smName = smParts.length >= 4 ? smParts.slice(3).join(':') : smParts.slice(2).join(':');
          return normalizeName(smName) === subMetricName;
        });
        
        if (matchingGpNet && matchingTotalSales) {
          // Get the current or overridden Total Sales value
          const totalSalesOverride = updated.find(o => o.subMetricKey === matchingTotalSales.key);
          const totalSalesValue = totalSalesOverride?.overriddenAnnualValue ?? matchingTotalSales.annualValue;
          
          // Calculate new GP Net = Total Sales × (new GP% / 100)
          const newGpNetValue = totalSalesValue * (newAnnualValue / 100);
          
          // Add/update GP Net override
          const gpNetOverrideIndex = updated.findIndex(o => o.subMetricKey === matchingGpNet.key);
          if (gpNetOverrideIndex >= 0) {
            updated[gpNetOverrideIndex] = { 
              subMetricKey: matchingGpNet.key, 
              parentKey: 'gp_net', 
              overriddenAnnualValue: newGpNetValue 
            };
          } else {
            updated.push({ 
              subMetricKey: matchingGpNet.key, 
              parentKey: 'gp_net', 
              overriddenAnnualValue: newGpNetValue 
            });
          }
        }
      }
      
      return updated;
    });
    markDirty();
  };

  // Handle main metric annual value edit (for metrics without sub-metrics)
  // Distribute the annual value across months using the current weight distribution
  // For percentage metrics, set the same value for all months
  // Special handling for GP%: recalculate GP Net and scale sub-metrics proportionally
  const handleMainMetricAnnualEdit = (metricKey: string, newAnnualValue: number) => {
    if (!weights || weights.length === 0) return;
    
    // Find the metric definition to check if it's a percentage
    const metricDef = metricDefinitions.find(m => m.key === metricKey);
    const isPercent = metricDef?.type === 'percent';
    
    // Special handling for GP%: recalculate GP Net for each month based on current Total Sales
    // Do NOT auto-lock - user must explicitly lock if desired
    if (metricKey === 'gp_percent') {
      const updates: { month: string; metricName: string; forecastValue: number }[] = [];
      
      // For each month, calculate GP Net from the current Total Sales × target GP%
      months.forEach((month) => {
        const monthData = monthlyValues.get(month);
        const totalSalesEntry = monthData?.get('total_sales');
        // Use the current value for Total Sales
        const totalSalesValue = totalSalesEntry?.value ?? 0;
        
        // Set GP% for this month (NOT locked)
        updates.push({
          month,
          metricName: 'gp_percent',
          forecastValue: newAnnualValue,
        });
        
        // Calculate GP Net = Total Sales × (target GP% / 100) (NOT locked)
        const calculatedGpNet = totalSalesValue * (newAnnualValue / 100);
        updates.push({
          month,
          metricName: 'gp_net',
          forecastValue: calculatedGpNet,
        });
      });
      
      // Bulk update all months for both GP% and GP Net
      bulkUpdateEntries.mutate(updates);
      
      // Get current GP Net to calculate scale factor for sub-metrics
      const currentGpNetData = annualValues.get('gp_net');
      const currentGpNet = currentGpNetData?.value ?? 0;
      
      // Calculate new annual GP Net (sum of all monthly calculated values)
      const newAnnualGpNet = months.reduce((sum, month) => {
        const monthData = monthlyValues.get(month);
        const totalSalesValue = monthData?.get('total_sales')?.value ?? 0;
        return sum + (totalSalesValue * (newAnnualValue / 100));
      }, 0);
      
      const scaleFactor = currentGpNet > 0 ? newAnnualGpNet / currentGpNet : 1;
      
      // Scale all GP Net sub-metrics proportionally
      const gpNetSubMetrics = subMetricForecasts?.get('gp_net') || [];
      
      setSubMetricOverrides(prev => {
        let updated = [...prev];
        
        for (const sm of gpNetSubMetrics) {
          const existingOverride = updated.find(o => o.subMetricKey === sm.key);
          const currentSubMetricValue = existingOverride?.overriddenAnnualValue ?? sm.annualValue;
          const newSubMetricValue = currentSubMetricValue * scaleFactor;
          
          const overrideIndex = updated.findIndex(o => o.subMetricKey === sm.key);
          if (overrideIndex >= 0) {
            updated[overrideIndex] = { 
              subMetricKey: sm.key, 
              parentKey: 'gp_net', 
              overriddenAnnualValue: newSubMetricValue 
            };
          } else {
            updated.push({ 
              subMetricKey: sm.key, 
              parentKey: 'gp_net', 
              overriddenAnnualValue: newSubMetricValue 
            });
          }
        }
        
        // Remove any GP% sub-metric overrides since they should now derive from GP Net
        updated = updated.filter(o => o.parentKey !== 'gp_percent');
        
        return updated;
      });
      
      markDirty();
      return;
    }
    
    // Special handling for GP Net: scale sub-metrics proportionally and let GP% derive from new ratio
    if (metricKey === 'gp_net') {
      // Get current GP Net to calculate scale factor
      const currentGpNetData = annualValues.get('gp_net');
      const currentGpNet = currentGpNetData?.value ?? 0;
      const scaleFactor = currentGpNet > 0 ? newAnnualValue / currentGpNet : 1;
      
      // Scale all GP Net sub-metrics proportionally
      const gpNetSubMetrics = subMetricForecasts?.get('gp_net') || [];
      
      setSubMetricOverrides(prev => {
        let updated = [...prev];
        
        for (const sm of gpNetSubMetrics) {
          const existingOverride = updated.find(o => o.subMetricKey === sm.key);
          const currentSubMetricValue = existingOverride?.overriddenAnnualValue ?? sm.annualValue;
          const newSubMetricValue = currentSubMetricValue * scaleFactor;
          
          const overrideIndex = updated.findIndex(o => o.subMetricKey === sm.key);
          if (overrideIndex >= 0) {
            updated[overrideIndex] = { 
              subMetricKey: sm.key, 
              parentKey: 'gp_net', 
              overriddenAnnualValue: newSubMetricValue 
            };
          } else {
            updated.push({ 
              subMetricKey: sm.key, 
              parentKey: 'gp_net', 
              overriddenAnnualValue: newSubMetricValue 
            });
          }
        }
        
        // Remove any GP% sub-metric overrides since GP% will derive from the new GP Net
        updated = updated.filter(o => o.parentKey !== 'gp_percent');
        
        return updated;
      });
      
      markDirty();
      return;
    }
    
    // Special handling for Sales Expense %: calculate dollar amounts based on GP Net
    if (metricKey === 'sales_expense_percent') {
      const updates: { month: string; metricName: string; forecastValue: number }[] = [];
      
      months.forEach((month) => {
        const monthData = monthlyValues.get(month);
        const gpNetValue = monthData?.get('gp_net')?.value ?? 0;
        
        // Set Sales Expense % for this month
        updates.push({
          month,
          metricName: 'sales_expense_percent',
          forecastValue: newAnnualValue,
        });
        
        // Calculate Sales Expense $ = GP Net × (Sales Expense % / 100)
        const calculatedSalesExpense = gpNetValue * (newAnnualValue / 100);
        updates.push({
          month,
          metricName: 'sales_expense',
          forecastValue: calculatedSalesExpense,
        });
      });
      
      // Bulk update all months for both Sales Expense % and Sales Expense $
      bulkUpdateEntries.mutate(updates);
      
      // Update the driver state to reflect the new annual dollar amount
      const newAnnualSalesExpense = months.reduce((sum, month) => {
        const gpNetValue = monthlyValues.get(month)?.get('gp_net')?.value ?? 0;
        return sum + (gpNetValue * (newAnnualValue / 100));
      }, 0);
      setSalesExpense(newAnnualSalesExpense);
      
      markDirty();
      return;
    }
    
    // Calculate total weight
    const totalWeight = weights.reduce((sum, w) => sum + (w.adjusted_weight || 0), 0);
    if (totalWeight === 0 && !isPercent) return;
    
    // Build all updates at once - do NOT auto-lock
    const updates: { month: string; metricName: string; forecastValue: number }[] = [];
    
    weights.forEach((w) => {
      const monthStr = `${forecastYear}-${String(w.month_number).padStart(2, '0')}`;
      
      // For percentages, set the same value for all months
      // For currency, distribute proportionally to weights
      const monthValue = isPercent 
        ? newAnnualValue 
        : newAnnualValue * ((w.adjusted_weight || 0) / totalWeight);
      
      updates.push({
        month: monthStr,
        metricName: metricKey,
        forecastValue: monthValue,
      });
    });
    
    // Bulk update all months at once instead of 12 separate mutations
    bulkUpdateEntries.mutate(updates);
    
    markDirty();
  };

  // Reset entire forecast to baseline values
  const handleResetForecast = async () => {
    if (baselineSalesExpense !== undefined) setSalesExpense(baselineSalesExpense);
    if (baselineFixedExpense !== undefined) setFixedExpense(baselineFixedExpense);
    setGrowth(0);
    
    // Clear all sub-metric overrides (local state and database)
    setSubMetricOverrides([]);
    driversLoadedFromDb.current = false;
    overridesLoadedFromDb.current = false;
    driversInitialized.current = false;
    
    // Delete saved driver settings, sub-metric overrides, and reset all entries from database
    try {
      await Promise.all([
        deleteDriverSettings.mutateAsync(),
        deleteAllSubMetricOverrides.mutateAsync(),
        resetAllEntries.mutateAsync(),
      ]);
    } catch (e) {
      console.error('Failed to delete saved settings:', e);
    }
    
    // Invalidate baseline queries to fetch fresh prior year data
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['prior-year-financial', departmentId, priorYear] }),
      queryClient.invalidateQueries({ queryKey: ['baseline-year-sales', departmentId, forecastYear] }),
      queryClient.invalidateQueries({ queryKey: ['sub-metrics', departmentId, priorYear] }),
      queryClient.invalidateQueries({ queryKey: ['forecast', departmentId, forecastYear] }),
    ]);
    
    // Reset weights to current calculated distribution
    resetWeightsToCalculated().catch((e) => {
      console.error(e);
      toast.error('Failed to reset weights');
    });
    
    toast.success('Forecast reset to baseline');
  };

  // Send forecast email
  const handleSendForecastEmail = async () => {
    const trimmedCustom = customEmail.trim().toLowerCase();
    const isValidCustomEmail = trimmedCustom && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedCustom);
    
    // If custom email is filled, use that. Otherwise use logged in user's email if sendToMyself is checked.
    let recipients: string[] = [];
    
    if (isValidCustomEmail) {
      recipients = [trimmedCustom];
    } else if (sendToMyself && currentUser?.email) {
      recipients = [currentUser.email];
    }
    
    if (recipients.length === 0) {
      toast.error('Please enter a valid email or check "Send to myself"');
      return;
    }

    setSendingEmail(true);
    try {
      // Ensure the email reflects exactly what's on screen by flushing the latest computed grid
      // values into forecast_entries before sending.
      if (forecast && !bulkUpdateEntries.isPending) {
        const updates: { month: string; metricName: string; forecastValue: number; baselineValue?: number }[] = [];
        latestMonthlyValuesRef.current.forEach((metrics, month) => {
          metrics.forEach((result, metricKey) => {
            updates.push({
              month,
              metricName: metricKey,
              forecastValue: result.value,
              baselineValue: result.baseline_value,
            });
          });
        });
        if (updates.length > 0) {
          await bulkUpdateEntries.mutateAsync(updates);
          isDirtyRef.current = false;
        }
      }

      const { data, error } = await supabase.functions.invoke('send-forecast-email', {
        body: {
          departmentId,
          forecastYear,
          view: emailView,
          customRecipients: recipients,
          includeSubMetrics,
        },
      });

      if (error) throw error;

      toast.success('Forecast email sent successfully');
      setEmailDialogOpen(false);
      setCustomEmail('');
      setSendToMyself(true);
    } catch (error: any) {
      console.error('Error sending forecast email:', error);
      toast.error(error.message || 'Failed to send forecast email');
    } finally {
      setSendingEmail(false);
    }
  };

  // Get Net Selling Gross for comparison
  const forecastNetSellingGross = annualValues.get('net_selling_gross')?.value || 0;
  const baselineNetSellingGross = annualValues.get('net_selling_gross')?.baseline_value || 0;
  const nsgVariance = forecastNetSellingGross - baselineNetSellingGross;
  const nsgVariancePercent = baselineNetSellingGross !== 0 ? (nsgVariance / Math.abs(baselineNetSellingGross)) * 100 : 0;

  // Get department profit for comparison
  const forecastDeptProfit = annualValues.get('department_profit')?.value || 0;
  const baselineDeptProfit = annualValues.get('department_profit')?.baseline_value || 0;
  const profitVariance = forecastDeptProfit - baselineDeptProfit;
  const profitVariancePercent = baselineDeptProfit !== 0 ? (profitVariance / Math.abs(baselineDeptProfit)) * 100 : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              Forecast
              <Select value={String(selectedYear)} onValueChange={handleYearChange}>
                <SelectTrigger className="w-24 h-8 text-lg font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              — {departmentName}
            </SheetTitle>
            <div className="flex items-center gap-2 mr-8">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEmailDialogOpen(true)}
                disabled={!forecast}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetForecast}
                disabled={!forecast}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button 
                size="sm" 
                disabled={!forecast || bulkUpdateEntries.isPending}
                onClick={() => {
                  const updates: { month: string; metricName: string; forecastValue: number; baselineValue?: number }[] = [];
                  
                  monthlyValues.forEach((metrics, month) => {
                    metrics.forEach((result, metricKey) => {
                      updates.push({
                        month,
                        metricName: metricKey,
                        forecastValue: result.value,
                        baselineValue: result.baseline_value,
                      });
                    });
                  });
                  
                  if (updates.length > 0) {
                    bulkUpdateEntries.mutate(updates, {
                      onSuccess: () => {
                        toast.success('Forecast saved');
                      },
                    });
                  }
                }}
              >
                {bulkUpdateEntries.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Forecast'
                )}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {isLoading || weightsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* View Toggle */}
            <div className="flex gap-2">
              {(['monthly', 'quarter', 'annual'] as const).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView(v)}
                  className="capitalize"
                >
                  {v}
                </Button>
              ))}
            </div>

            {/* Weight Distribution Panel */}
            <ForecastWeightsPanel
              weights={weights}
              calculatedWeights={calculatedWeights}
              onUpdateWeight={(monthNumber, adjustedWeight, isLocked) => {
                markDirty();
                updateWeight.mutate({ monthNumber, adjustedWeight, isLocked });
              }}
              onResetWeights={() => {
                markDirty();
                resetWeightsToCalculated().catch((e) => {
                  console.error(e);
                  toast.error('Failed to reset weights');
                });
              }}
              isUpdating={updateWeight.isPending}
            />

            {/* Key Drivers - Simplified to single growth slider */}
            <ForecastDriverInputs
              growth={growth}
              salesExpense={salesExpense}
              fixedExpense={fixedExpense}
              baselineSalesExpense={baselineSalesExpense}
              baselineFixedExpense={baselineFixedExpense}
              onGrowthChange={(v) => {
                markDirty();
                setGrowth(v);
              }}
              onSalesExpenseChange={(v) => {
                markDirty();
                setSalesExpense(v);
              }}
              onFixedExpenseChange={(v) => {
                markDirty();
                setFixedExpense(v);
              }}
            />

            {/* Forecast Results Grid */}
            <ForecastResultsGrid
              view={view}
              monthlyValues={monthlyValues}
              quarterlyValues={quarterlyValues}
              annualValues={annualValues}
              metricDefinitions={metricDefinitions}
              months={months}
              subMetrics={subMetricForecasts}
              visibleMonthStart={visibleMonthStart}
              forecastYear={forecastYear}
              priorYear={priorYear}
              onCellEdit={handleCellEdit}
              onToggleLock={handleToggleLock}
              onLockRow={handleLockRow}
              onMonthNavigate={handleMonthNavigate}
              onSubMetricEdit={handleSubMetricEdit}
              onMainMetricAnnualEdit={handleMainMetricAnnualEdit}
              departmentId={departmentId}
            />

            {/* Year Over Year Comparison */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h3 className="font-semibold mb-3">Year Over Year Comparison</h3>
              <div className="grid grid-cols-2 gap-6">
                {/* Net Selling Gross - Left */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">Net Selling Gross:</span>
                    <FormattedCurrency value={forecastNetSellingGross} className="font-medium" />
                    <span className="text-muted-foreground text-sm">vs <FormattedCurrency value={baselineNetSellingGross} /> prior</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2",
                    nsgVariance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {nsgVariance >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <FormattedCurrency value={nsgVariance} showSign className="font-semibold" />
                    {(forecastNetSellingGross >= 0) === (baselineNetSellingGross >= 0) && baselineNetSellingGross !== 0 && (
                      <span className="font-semibold">({nsgVariancePercent.toFixed(1)}%)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <FormattedCurrency value={nsgVariance / 12} showSign /> per month variance
                  </div>
                </div>
                
                {/* Dept Profit - Right */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground">Dept Profit:</span>
                    <FormattedCurrency value={forecastDeptProfit} className="font-medium" />
                    <span className="text-muted-foreground text-sm">vs <FormattedCurrency value={baselineDeptProfit} /> prior</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2",
                    profitVariance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {profitVariance >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <FormattedCurrency value={profitVariance} showSign className="font-semibold" />
                    {(forecastDeptProfit >= 0) === (baselineDeptProfit >= 0) && baselineDeptProfit !== 0 && (
                      <span className="font-semibold">({profitVariancePercent.toFixed(1)}%)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <FormattedCurrency value={profitVariance / 12} showSign /> per month variance
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Forecast Report</DialogTitle>
            <DialogDescription>
              Send the {forecastYear} forecast report via email
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Report View</Label>
              <RadioGroup value={emailView} onValueChange={(v) => setEmailView(v as typeof emailView)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="view-monthly" />
                  <Label htmlFor="view-monthly" className="font-normal">Monthly - Shows all 12 months</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="quarter" id="view-quarter" />
                  <Label htmlFor="view-quarter" className="font-normal">Quarterly - Shows Q1-Q4 summary</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="annual" id="view-annual" />
                  <Label htmlFor="view-annual" className="font-normal">Annual - Shows year totals only</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Send To</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-to-myself"
                  checked={sendToMyself}
                  onCheckedChange={(checked) => setSendToMyself(checked === true)}
                  disabled={!!customEmail.trim()}
                />
                <Label htmlFor="send-to-myself" className="font-normal cursor-pointer">
                  Send to myself {currentUser?.email && <span className="text-muted-foreground">({currentUser.email})</span>}
                </Label>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Input
                type="email"
                placeholder="Enter custom email address"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
              />
              {customEmail.trim() && (
                <p className="text-xs text-muted-foreground">
                  Custom email will be used instead of "Send to myself"
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="include-submetrics" 
                checked={includeSubMetrics} 
                onCheckedChange={(checked) => setIncludeSubMetrics(checked === true)}
              />
              <Label htmlFor="include-submetrics" className="font-normal cursor-pointer">
                Include sub-metric details
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendForecastEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
