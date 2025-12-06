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
    targetDirection: "below" 
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
    description: "Department Profit less Dealer Salary less Parts Transfer", 
    targetDirection: "above",
    calculation: {
      type: "subtract",
      base: "department_profit",
      deductions: ["dealer_salary", "parts_transfer"]
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

// You can add additional brand configurations here
export const OTHER_METRICS: FinancialMetric[] = [
  // Define metrics for other brands as needed
  ...GMC_CHEVROLET_METRICS // Default to GMC/Chevrolet for now
];

export const getMetricsForBrand = (brand: string | null): FinancialMetric[] => {
  if (brand?.toLowerCase().includes('nissan')) {
    return NISSAN_METRICS;
  }
  if (brand?.toLowerCase().includes('ford')) {
    return FORD_METRICS;
  }
  if (brand?.toLowerCase().includes('mazda')) {
    return MAZDA_METRICS;
  }
  return GMC_CHEVROLET_METRICS;
};