import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MonthlyData {
  month: string;
  value: number;
}

interface WeightResult {
  month_number: number;
  month_name: string;
  sales_value: number;
  weight: number; // 0-100 percentage
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function useWeightedBaseline(departmentId: string | undefined, priorYear: number) {
  // Fetch prior year's monthly total_sales
  const { data: priorYearSales, isLoading } = useQuery({
    queryKey: ['prior-year-sales', departmentId, priorYear],
    queryFn: async () => {
      if (!departmentId) return [];
      
      const { data, error } = await supabase
        .from('financial_entries')
        .select('month, value')
        .eq('department_id', departmentId)
        .eq('metric_name', 'total_sales')
        .gte('month', `${priorYear}-01`)
        .lte('month', `${priorYear}-12`);
      
      if (error) throw error;
      return data as MonthlyData[];
    },
    enabled: !!departmentId,
  });

  // Calculate weights based on sales distribution
  const calculatedWeights = useMemo((): WeightResult[] => {
    if (!priorYearSales || priorYearSales.length === 0) {
      // Return equal distribution if no prior year data
      return MONTH_NAMES.map((name, index) => ({
        month_number: index + 1,
        month_name: name,
        sales_value: 0,
        weight: 100 / 12, // Equal distribution ~8.33%
      }));
    }

    // Sum all sales
    const totalSales = priorYearSales.reduce((sum, entry) => sum + (entry.value || 0), 0);
    
    if (totalSales === 0) {
      return MONTH_NAMES.map((name, index) => ({
        month_number: index + 1,
        month_name: name,
        sales_value: 0,
        weight: 100 / 12,
      }));
    }

    // Create a map of month to value
    const salesByMonth = new Map<number, number>();
    priorYearSales.forEach(entry => {
      const monthNum = parseInt(entry.month.split('-')[1], 10);
      salesByMonth.set(monthNum, entry.value || 0);
    });

    // Calculate weight for each month
    return MONTH_NAMES.map((name, index) => {
      const monthNum = index + 1;
      const salesValue = salesByMonth.get(monthNum) || 0;
      const weight = (salesValue / totalSales) * 100;
      
      return {
        month_number: monthNum,
        month_name: name,
        sales_value: salesValue,
        weight: Math.round(weight * 100) / 100, // Round to 2 decimals
      };
    });
  }, [priorYearSales]);

  // Calculate weighted baseline for a given annual target
  const calculateMonthlyBaseline = (annualValue: number): Map<string, number> => {
    const result = new Map<string, number>();
    const forecastYear = priorYear + 1;
    
    calculatedWeights.forEach(w => {
      const monthStr = `${forecastYear}-${String(w.month_number).padStart(2, '0')}`;
      const monthValue = (annualValue * w.weight) / 100;
      result.set(monthStr, Math.round(monthValue * 100) / 100);
    });
    
    return result;
  };

  // Get YTD average based on available data
  const getYTDAverage = (metricName: string, currentYearData: MonthlyData[]): number => {
    const relevantData = currentYearData.filter(d => d.value !== null);
    if (relevantData.length === 0) return 0;
    
    const total = relevantData.reduce((sum, d) => sum + (d.value || 0), 0);
    return total / relevantData.length;
  };

  // Redistribute weights when one is changed (keeping total at 100%)
  const redistributeWeights = (
    currentWeights: { month_number: number; weight: number; is_locked: boolean }[],
    changedMonth: number,
    newWeight: number
  ): { month_number: number; weight: number }[] => {
    const lockedMonths = currentWeights.filter(w => w.is_locked || w.month_number === changedMonth);
    const unlockedMonths = currentWeights.filter(w => !w.is_locked && w.month_number !== changedMonth);
    
    // Calculate remaining weight to distribute
    const lockedTotal = lockedMonths
      .filter(w => w.month_number !== changedMonth)
      .reduce((sum, w) => sum + w.weight, 0);
    const remainingWeight = 100 - newWeight - lockedTotal;
    
    if (unlockedMonths.length === 0) {
      // All months are locked, can't redistribute
      return currentWeights.map(w => 
        w.month_number === changedMonth 
          ? { month_number: w.month_number, weight: newWeight }
          : { month_number: w.month_number, weight: w.weight }
      );
    }

    // Distribute remaining weight proportionally among unlocked months
    const unlockedTotal = unlockedMonths.reduce((sum, w) => sum + w.weight, 0);
    
    return currentWeights.map(w => {
      if (w.month_number === changedMonth) {
        return { month_number: w.month_number, weight: newWeight };
      }
      if (w.is_locked) {
        return { month_number: w.month_number, weight: w.weight };
      }
      // Proportionally adjust unlocked months
      const proportion = unlockedTotal > 0 ? w.weight / unlockedTotal : 1 / unlockedMonths.length;
      const adjustedWeight = remainingWeight * proportion;
      return { month_number: w.month_number, weight: Math.round(adjustedWeight * 100) / 100 };
    });
  };

  return {
    calculatedWeights,
    isLoading,
    calculateMonthlyBaseline,
    getYTDAverage,
    redistributeWeights,
    priorYearTotal: priorYearSales?.reduce((sum, d) => sum + (d.value || 0), 0) ?? 0,
  };
}
