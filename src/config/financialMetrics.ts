export interface FinancialMetric {
  name: string;
  key: string;
  type: "dollar" | "percentage";
  description: string;
  targetDirection: "above" | "below";
  // For percentage metrics, define how to calculate from dollar amounts
  calculation?: {
    numerator: string;
    denominator: string;
  } | {
    type: "subtract";
    base: string;
    deductions: string[];
  } | {
    type: "complex";
    base: string;
    deductions: string[];
    additions: string[];
  };
  // New: Flag indicating this metric has expandable sub-metrics
  hasSubMetrics?: boolean;
}

export const GMC_CHEVROLET_METRICS: FinancialMetric[] = [
  { 
    name: "Total Sales", 
    key: "total_sales", 
    type: "dollar", 
    description: "Total revenue for the period", 
    targetDirection: "above" 
  },
  { 
    name: "GP Net", 
    key: "gp_net", 
    type: "dollar", 
    description: "Gross profit after costs", 
    targetDirection: "above" 
  },
  { 
    name: "GP %", 
    key: "gp_percent", 
    type: "percentage", 
    description: "Gross profit margin", 
    targetDirection: "above",
    calculation: {
      numerator: "gp_net",
      denominator: "total_sales"
    }
  },
  { 
    name: "Sales Expense", 
    key: "sales_expense", 
    type: "dollar", 
    description: "Total sales expenses", 
    targetDirection: "below" 
  },
{ 
    name: "Sales Expense %", 
    key: "sales_expense_percent", 
    type: "percentage", 
    description: "Sales expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "sales_expense",
      denominator: "gp_net"
    },
    hasSubMetrics: true
  },
  { 
    name: "Semi Fixed Expense", 
    key: "semi_fixed_expense", 
    type: "dollar", 
    description: "Semi-fixed expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Semi Fixed Expense %", 
    key: "semi_fixed_expense_percent", 
    type: "percentage", 
    description: "Semi-fixed expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "semi_fixed_expense",
      denominator: "gp_net"
    },
    hasSubMetrics: true
  },
  { 
    name: "Net Selling Gross", 
    key: "net_selling_gross", 
    type: "dollar", 
    description: "GP Net less Sales Expense less Semi Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense", "semi_fixed_expense"]
    }
  },
  { 
    name: "Total Fixed Expense", 
    key: "total_fixed_expense", 
    type: "dollar", 
    description: "Total fixed expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Department Profit", 
    key: "department_profit", 
    type: "dollar", 
    description: "GP Net less Sales Expense less Semi Fixed Expense less Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense", "semi_fixed_expense", "total_fixed_expense"]
    }
  },
  { 
    name: "Parts Transfer", 
    key: "parts_transfer", 
    type: "dollar", 
    description: "Internal parts transfers", 
    targetDirection: "above" 
  },
  { 
    name: "Net Operating Profit", 
    key: "net", 
    type: "dollar", 
    description: "Department Profit plus Parts Transfer", 
    targetDirection: "above",
    calculation: {
      type: "complex",
      base: "department_profit",
      deductions: [],
      additions: ["parts_transfer"]
    }
  },
  { 
    name: "Return on Gross", 
    key: "return_on_gross", 
    type: "percentage", 
    description: "Department Profit divided by GP Net", 
    targetDirection: "above",
    calculation: {
      numerator: "department_profit",
      denominator: "gp_net"
    }
  },
];

// Ford-specific metrics (includes Dealer Salary)
export const FORD_METRICS: FinancialMetric[] = [
  { 
    name: "Total Sales", 
    key: "total_sales", 
    type: "dollar", 
    description: "Total revenue for the period", 
    targetDirection: "above" 
  },
  { 
    name: "GP Net", 
    key: "gp_net", 
    type: "dollar", 
    description: "Gross profit after costs", 
    targetDirection: "above" 
  },
  { 
    name: "GP %", 
    key: "gp_percent", 
    type: "percentage", 
    description: "Gross profit margin", 
    targetDirection: "above",
    calculation: {
      numerator: "gp_net",
      denominator: "total_sales"
    }
  },
  { 
    name: "Sales Expense", 
    key: "sales_expense", 
    type: "dollar", 
    description: "Total sales expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Sales Expense %", 
    key: "sales_expense_percent", 
    type: "percentage", 
    description: "Sales expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "sales_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Adjusted Selling Gross", 
    key: "adjusted_selling_gross", 
    type: "dollar", 
    description: "Net Selling Gross including part gross transfer", 
    targetDirection: "above" 
  },
  { 
    name: "Net Selling Gross", 
    key: "net_selling_gross", 
    type: "dollar", 
    description: "GP Net less Sales Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense"]
    }
  },
  { 
    name: "Total Fixed Expense", 
    key: "total_fixed_expense", 
    type: "dollar", 
    description: "Total fixed expenses", 
    targetDirection: "below",
    hasSubMetrics: true
  },
  { 
    name: "Total Fixed Expense %", 
    key: "total_fixed_expense_percent", 
    type: "percentage", 
    description: "Fixed expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "total_fixed_expense",
      denominator: "gp_net"
    },
    hasSubMetrics: true
  },
  { 
    name: "Department Profit", 
    key: "department_profit", 
    type: "dollar", 
    description: "GP Net less Sales Expense less Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense", "total_fixed_expense"]
    }
  },
  { 
    name: "Dealer Salary", 
    key: "dealer_salary", 
    type: "dollar", 
    description: "Dealer salary expense", 
    targetDirection: "below" 
  },
  { 
    name: "Parts Transfer", 
    key: "parts_transfer", 
    type: "dollar", 
    description: "Adjusted Selling Gross less Net Selling Gross", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "adjusted_selling_gross",
      deductions: ["net_selling_gross"]
    }
  },
  { 
    name: "Net Operating Profit", 
    key: "net", 
    type: "dollar", 
    description: "Department Profit less Dealer Salary plus Parts Transfer", 
    targetDirection: "above",
    calculation: {
      type: "complex",
      base: "department_profit",
      deductions: ["dealer_salary"],
      additions: ["parts_transfer"]
    }
  },
  { 
    name: "Return on Gross", 
    key: "return_on_gross", 
    type: "percentage", 
    description: "Department Profit divided by GP Net", 
    targetDirection: "above",
    calculation: {
      numerator: "department_profit",
      denominator: "gp_net"
    }
  },
];

// Nissan-specific metrics
export const NISSAN_METRICS: FinancialMetric[] = [
  { 
    name: "Total Sales", 
    key: "total_sales", 
    type: "dollar", 
    description: "Total revenue for the period", 
    targetDirection: "above",
    hasSubMetrics: true  // This metric has expandable sub-line items
  },
  { 
    name: "GP Net", 
    key: "gp_net", 
    type: "dollar", 
    description: "Gross profit after costs", 
    targetDirection: "above" 
  },
  { 
    name: "GP %", 
    key: "gp_percent", 
    type: "percentage", 
    description: "Gross profit margin", 
    targetDirection: "above",
    calculation: {
      numerator: "gp_net",
      denominator: "total_sales"
    }
  },
  { 
    name: "Sales Expense", 
    key: "sales_expense", 
    type: "dollar", 
    description: "Total sales expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Sales Expense %", 
    key: "sales_expense_percent", 
    type: "percentage", 
    description: "Sales expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "sales_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Total Direct Expenses", 
    key: "total_direct_expenses", 
    type: "dollar", 
    description: "Total direct expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Semi Fixed Expense", 
    key: "semi_fixed_expense", 
    type: "dollar", 
    description: "Total Direct Expenses less Sales Expense", 
    targetDirection: "below",
    calculation: {
      type: "subtract",
      base: "total_direct_expenses",
      deductions: ["sales_expense"]
    }
  },
  { 
    name: "Semi Fixed Expense %", 
    key: "semi_fixed_expense_percent", 
    type: "percentage", 
    description: "Semi-fixed expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "semi_fixed_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Net Selling Gross", 
    key: "net_selling_gross", 
    type: "dollar", 
    description: "GP Net less Total Direct Expenses", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["total_direct_expenses"]
    }
  },
  { 
    name: "Total Fixed Expense", 
    key: "total_fixed_expense", 
    type: "dollar", 
    description: "Total fixed expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Department Profit", 
    key: "department_profit", 
    type: "dollar", 
    description: "Net Selling Gross less Total Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "net_selling_gross",
      deductions: ["total_fixed_expense"]
    }
  },
  { 
    name: "Return on Gross", 
    key: "return_on_gross", 
    type: "percentage", 
    description: "Department Profit divided by GP Net", 
    targetDirection: "above",
    calculation: {
      numerator: "department_profit",
      denominator: "gp_net"
    }
  },
];

// Hyundai-specific metrics (like Nissan but without Semi Fixed Expense)
export const HYUNDAI_METRICS: FinancialMetric[] = NISSAN_METRICS.filter(
  metric => metric.key !== 'semi_fixed_expense' && metric.key !== 'semi_fixed_expense_percent'
);

// Genesis uses same metrics as Hyundai
export const GENESIS_METRICS: FinancialMetric[] = HYUNDAI_METRICS;

// Mazda-specific metrics (excludes Parts Transfer and Net Operating Profit)
export const MAZDA_METRICS: FinancialMetric[] = [
  { 
    name: "Total Sales", 
    key: "total_sales", 
    type: "dollar", 
    description: "Total revenue for the period", 
    targetDirection: "above" 
  },
  { 
    name: "GP Net", 
    key: "gp_net", 
    type: "dollar", 
    description: "Gross profit after costs", 
    targetDirection: "above" 
  },
  { 
    name: "GP %", 
    key: "gp_percent", 
    type: "percentage", 
    description: "Gross profit margin", 
    targetDirection: "above",
    calculation: {
      numerator: "gp_net",
      denominator: "total_sales"
    }
  },
  { 
    name: "Sales Expense", 
    key: "sales_expense", 
    type: "dollar", 
    description: "Total sales expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Sales Expense %", 
    key: "sales_expense_percent", 
    type: "percentage", 
    description: "Sales expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "sales_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Semi Fixed Expense", 
    key: "semi_fixed_expense", 
    type: "dollar", 
    description: "Semi-fixed expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Semi Fixed Expense %", 
    key: "semi_fixed_expense_percent", 
    type: "percentage", 
    description: "Semi-fixed expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "semi_fixed_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Net Selling Gross", 
    key: "net_selling_gross", 
    type: "dollar", 
    description: "GP Net less Sales Expense less Semi Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense", "semi_fixed_expense"]
    }
  },
  { 
    name: "Total Fixed Expense", 
    key: "total_fixed_expense", 
    type: "dollar", 
    description: "Total fixed expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Department Profit", 
    key: "department_profit", 
    type: "dollar", 
    description: "GP Net less Sales Expense less Semi Fixed Expense less Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense", "semi_fixed_expense", "total_fixed_expense"]
    }
  },
  { 
    name: "Return on Gross", 
    key: "return_on_gross", 
    type: "percentage", 
    description: "Department Profit divided by GP Net", 
    targetDirection: "above",
    calculation: {
      numerator: "department_profit",
      denominator: "gp_net"
    }
  },
];

// Honda-specific metrics (like Nissan but without Parts Transfer and Net Operating Profit)
// For November 2025+: Total Direct Expenses - Sales Expense = Semi Fixed Expense
// For October 2025 and earlier: Semi Fixed Expense is manual entry (legacy data)
export const HONDA_METRICS: FinancialMetric[] = [
  { 
    name: "Total Sales", 
    key: "total_sales", 
    type: "dollar", 
    description: "Total revenue for the period", 
    targetDirection: "above" 
  },
  { 
    name: "GP Net", 
    key: "gp_net", 
    type: "dollar", 
    description: "Gross profit after costs", 
    targetDirection: "above" 
  },
  { 
    name: "GP %", 
    key: "gp_percent", 
    type: "percentage", 
    description: "Gross profit margin", 
    targetDirection: "above",
    calculation: {
      numerator: "gp_net",
      denominator: "total_sales"
    }
  },
  { 
    name: "Sales Expense", 
    key: "sales_expense", 
    type: "dollar", 
    description: "Total sales expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Sales Expense %", 
    key: "sales_expense_percent", 
    type: "percentage", 
    description: "Sales expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "sales_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Total Direct Expenses", 
    key: "total_direct_expenses", 
    type: "dollar", 
    description: "Total direct expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Semi Fixed Expense", 
    key: "semi_fixed_expense", 
    type: "dollar", 
    description: "Total Direct Expenses less Sales Expense", 
    targetDirection: "below",
    calculation: {
      type: "subtract",
      base: "total_direct_expenses",
      deductions: ["sales_expense"]
    }
  },
  { 
    name: "Semi Fixed Expense %", 
    key: "semi_fixed_expense_percent", 
    type: "percentage", 
    description: "Semi-fixed expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "semi_fixed_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Net Selling Gross", 
    key: "net_selling_gross", 
    type: "dollar", 
    description: "GP Net less Sales Expense less Semi Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense", "semi_fixed_expense"]
    }
  },
  { 
    name: "Total Fixed Expense", 
    key: "total_fixed_expense", 
    type: "dollar", 
    description: "Total fixed expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Department Profit", 
    key: "department_profit", 
    type: "dollar", 
    description: "GP Net less Sales Expense less Semi Fixed Expense less Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense", "semi_fixed_expense", "total_fixed_expense"]
    }
  },
  { 
    name: "Return on Gross", 
    key: "return_on_gross", 
    type: "percentage", 
    description: "Department Profit divided by GP Net", 
    targetDirection: "above",
    calculation: {
      numerator: "department_profit",
      denominator: "gp_net"
    }
  },
];

// KTRV/Other-specific metrics (like GMC but excludes Parts Transfer and Net Operating Profit)
export const KTRV_METRICS: FinancialMetric[] = GMC_CHEVROLET_METRICS.filter(
  metric => metric.key !== 'parts_transfer' && metric.key !== 'net'
);

// "Other" brand uses same metrics as KTRV (no parts transfer or net operating profit)
export const OTHER_METRICS: FinancialMetric[] = KTRV_METRICS;

// Stellantis-specific metrics (similar to Ford structure - no Semi Fixed Expense)
export const STELLANTIS_METRICS: FinancialMetric[] = [
  { 
    name: "Total Sales", 
    key: "total_sales", 
    type: "dollar", 
    description: "Total revenue for the period", 
    targetDirection: "above" 
  },
  { 
    name: "GP Net", 
    key: "gp_net", 
    type: "dollar", 
    description: "Gross profit after costs", 
    targetDirection: "above" 
  },
  { 
    name: "GP %", 
    key: "gp_percent", 
    type: "percentage", 
    description: "Gross profit margin", 
    targetDirection: "above",
    calculation: {
      numerator: "gp_net",
      denominator: "total_sales"
    }
  },
  { 
    name: "Sales Expense", 
    key: "sales_expense", 
    type: "dollar", 
    description: "Total sales expenses", 
    targetDirection: "below",
    hasSubMetrics: true
  },
  { 
    name: "Sales Expense %", 
    key: "sales_expense_percent", 
    type: "percentage", 
    description: "Sales expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "sales_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Net Selling Gross", 
    key: "net_selling_gross", 
    type: "dollar", 
    description: "GP Net less Sales Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "gp_net",
      deductions: ["sales_expense"]
    }
  },
  { 
    name: "Total Fixed Expense", 
    key: "total_fixed_expense", 
    type: "dollar", 
    description: "Total fixed expenses", 
    targetDirection: "below",
    hasSubMetrics: true
  },
  { 
    name: "Department Profit", 
    key: "department_profit", 
    type: "dollar", 
    description: "Net Selling Gross less Total Fixed Expense", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "net_selling_gross",
      deductions: ["total_fixed_expense"]
    }
  },
  { 
    name: "Parts Transfer", 
    key: "parts_transfer", 
    type: "dollar", 
    description: "Internal parts transfers", 
    targetDirection: "above" 
  },
  { 
    name: "Net Operating Profit", 
    key: "net", 
    type: "dollar", 
    description: "Department Profit plus Parts Transfer", 
    targetDirection: "above",
    calculation: {
      type: "complex",
      base: "department_profit",
      deductions: [],
      additions: ["parts_transfer"]
    }
  },
  { 
    name: "Return on Gross", 
    key: "return_on_gross", 
    type: "percentage", 
    description: "Department Profit divided by GP Net", 
    targetDirection: "above",
    calculation: {
      numerator: "department_profit",
      denominator: "gp_net"
    }
  },
];

export const getMetricsForBrand = (brand: string | null): FinancialMetric[] => {
  if (brand?.toLowerCase().includes('nissan')) {
    return NISSAN_METRICS;
  }
  if (brand?.toLowerCase().includes('hyundai')) {
    return HYUNDAI_METRICS;
  }
  if (brand?.toLowerCase().includes('genesis')) {
    return GENESIS_METRICS;
  }
  if (brand?.toLowerCase().includes('ford')) {
    return FORD_METRICS;
  }
  if (brand?.toLowerCase().includes('mazda')) {
    return MAZDA_METRICS;
  }
  if (brand?.toLowerCase().includes('honda')) {
    return HONDA_METRICS;
  }
  if (brand?.toLowerCase().includes('stellantis') || brand?.toLowerCase().includes('chrysler') || brand?.toLowerCase().includes('jeep') || brand?.toLowerCase().includes('dodge') || brand?.toLowerCase().includes('ram')) {
    return STELLANTIS_METRICS;
  }
  if (brand?.toLowerCase().includes('ktrv') || brand?.toLowerCase() === 'other') {
    return KTRV_METRICS;
  }
  return GMC_CHEVROLET_METRICS;
};

// Helper to check if Honda brand should use legacy (pre-November 2025) metrics
// where Semi Fixed Expense is manual entry instead of calculated
export const isHondaLegacyMonth = (month: string): boolean => {
  // month format is "YYYY-MM" or "MonthName YYYY"
  const monthMatch = month.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1]);
    const monthNum = parseInt(monthMatch[2]);
    // Before November 2025 (2025-11)
    return year < 2025 || (year === 2025 && monthNum < 11);
  }
  
  // Handle "MonthName YYYY" format
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                      'july', 'august', 'september', 'october', 'november', 'december'];
  const parts = month.toLowerCase().split(' ');
  if (parts.length === 2) {
    const monthIdx = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1]);
    if (monthIdx !== -1 && !isNaN(year)) {
      // Before November 2025 (month index 10)
      return year < 2025 || (year === 2025 && monthIdx < 10);
    }
  }
  
  return false;
};

// Get Honda metrics with legacy mode (no calculation for Semi Fixed Expense)
export const getHondaLegacyMetrics = (): FinancialMetric[] => {
  return HONDA_METRICS.map(metric => {
    if (metric.key === 'semi_fixed_expense') {
      // Remove calculation for legacy months - treat as manual entry
      const { calculation, ...rest } = metric;
      return rest;
    }
    // Also hide Total Direct Expenses for legacy months since it's not used
    if (metric.key === 'total_direct_expenses') {
      return null;
    }
    return metric;
  }).filter((m): m is FinancialMetric => m !== null);
};