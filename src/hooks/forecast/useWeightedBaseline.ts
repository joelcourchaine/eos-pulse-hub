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

export function useWeightedBaseline(departmentId: string | undefined, baselineYear: number) {
  // Fetch baseline year's monthly total_sales
  // Try the specified year first, then fall back to prior years if incomplete
  const { data: baselineYearSales, isLoading } = useQuery({
    queryKey: ['baseline-year-sales', departmentId, baselineYear],
    queryFn: async () => {
      if (!departmentId) return [];
      
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-12
      
      // First try the baseline year
      let { data, error } = await supabase
        .from('financial_entries')
        .select('month, value')
        .eq('department_id', departmentId)
        .eq('metric_name', 'total_sales')
        .gte('month', `${baselineYear}-01`)
        .lte('month', `${baselineYear}-12`);
      
      if (error) throw error;
      
      // Check if we have a complete year of data (all 12 months with reasonable values)
      // If baseline year is current year, exclude current month as it may be incomplete
      if (data && data.length > 0) {
        const monthsWithData = new Set<number>();
        
        data.forEach(entry => {
          const monthNum = parseInt(entry.month.split('-')[1], 10);
          // Skip current month if baseline year is current year (incomplete data)
          if (baselineYear === currentYear && monthNum >= currentMonth) {
            return;
          }
          if (entry.value && entry.value > 0) {
            monthsWithData.add(monthNum);
          }
        });
        
        // Filter out current/future months if baseline year is current year
        if (baselineYear === currentYear) {
          data = data.filter(entry => {
            const monthNum = parseInt(entry.month.split('-')[1], 10);
            return monthNum < currentMonth;
          });
        }
        
        // If we have at least 6 months of data, use it
        if (monthsWithData.size >= 6) {
          return data as MonthlyData[];
        }
      }
      
      // Fall back to prior year if baseline year has insufficient data
      const priorYear = baselineYear - 1;
      const priorResult = await supabase
        .from('financial_entries')
        .select('month, value')
        .eq('department_id', departmentId)
        .eq('metric_name', 'total_sales')
        .gte('month', `${priorYear}-01`)
        .lte('month', `${priorYear}-12`);
      
      if (priorResult.error) throw priorResult.error;
      
      // If prior year has data, use it
      if (priorResult.data && priorResult.data.length > 0) {
        return priorResult.data as MonthlyData[];
      }
      
      // Last resort: return whatever we have from baseline year
      return data as MonthlyData[];
    },
    enabled: !!departmentId,
  });

  // Calculate weights based on sales distribution
  const calculatedWeights = useMemo((): WeightResult[] => {
    if (!baselineYearSales || baselineYearSales.length === 0) {
      // Return equal distribution if no baseline data
      return MONTH_NAMES.map((name, index) => ({
        month_number: index + 1,
        month_name: name,
        sales_value: 0,
        weight: Math.round((100 / 12) * 100) / 100, // Equal distribution ~8.33%
      }));
    }

    // Sum all sales
    const totalSales = baselineYearSales.reduce((sum, entry) => sum + (entry.value || 0), 0);
    
    if (totalSales === 0) {
      return MONTH_NAMES.map((name, index) => ({
        month_number: index + 1,
        month_name: name,
        sales_value: 0,
        weight: Math.round((100 / 12) * 100) / 100,
      }));
    }

    // Create a map of month to value
    const salesByMonth = new Map<number, number>();
    baselineYearSales.forEach(entry => {
      const monthNum = parseInt(entry.month.split('-')[1], 10);
      const currentValue = salesByMonth.get(monthNum) || 0;
      salesByMonth.set(monthNum, currentValue + (entry.value || 0));
    });

    // Calculate weight for each month (only months with data)
    const monthsWithData = Array.from(salesByMonth.keys());
    
    return MONTH_NAMES.map((name, index) => {
      const monthNum = index + 1;
      const salesValue = salesByMonth.get(monthNum) || 0;
      
      // If this month has no data but others do, distribute equally among missing months
      let weight: number;
      if (salesValue > 0) {
        weight = (salesValue / totalSales) * 100;
      } else if (monthsWithData.length < 12 && monthsWithData.length > 0) {
        // For months without data, we'll assign 0 weight and normalize later
        weight = 0;
      } else {
        weight = 100 / 12;
      }
      
      return {
        month_number: monthNum,
        month_name: name,
        sales_value: salesValue,
        weight: Math.round(weight * 100) / 100, // Round to 2 decimals
      };
    });
  }, [baselineYearSales]);

  // Calculate weighted baseline for a given annual target
  const calculateMonthlyBaseline = (annualValue: number, forecastYear: number): Map<string, number> => {
    const result = new Map<string, number>();
    
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
    baselineYearTotal: baselineYearSales?.reduce((sum, d) => sum + (d.value || 0), 0) ?? 0,
  };
}
