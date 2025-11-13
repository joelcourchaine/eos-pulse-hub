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
    name: "GP%", 
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
    name: "Personnel Expense", 
    key: "personnel_expense", 
    type: "dollar", 
    description: "Total labor costs", 
    targetDirection: "below" 
  },
  { 
    name: "Personnel Expense %", 
    key: "personnel_expense_percent", 
    type: "percentage", 
    description: "Labor costs as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "personnel_expense",
      denominator: "gp_net"
    }
  },
  { 
    name: "Total Semi-Fixed Expense", 
    key: "total_semi_fixed_expense", 
    type: "dollar", 
    description: "Total semi-fixed expenses", 
    targetDirection: "below" 
  },
  { 
    name: "Total Semi-Fixed Expense %", 
    key: "total_semi_fixed_expense_percent", 
    type: "percentage", 
    description: "Semi-fixed expenses as % of GP Net", 
    targetDirection: "below",
    calculation: {
      numerator: "total_semi_fixed_expense",
      denominator: "gp_net"
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
    description: "Department profit after all expenses", 
    targetDirection: "above" 
  },
  { 
    name: "Parts Transfer", 
    key: "parts_transfer", 
    type: "dollar", 
    description: "Internal parts transfers", 
    targetDirection: "above" 
  },
  { 
    name: "Net", 
    key: "net", 
    type: "dollar", 
    description: "Net profit/loss", 
    targetDirection: "above" 
  },
];

// You can add additional brand configurations here
export const OTHER_METRICS: FinancialMetric[] = [
  // Define metrics for other brands as needed
  ...GMC_CHEVROLET_METRICS // Default to GMC/Chevrolet for now
];

export const getMetricsForBrand = (brand: string | null): FinancialMetric[] => {
  if (!brand) return GMC_CHEVROLET_METRICS;
  
  switch (brand.toUpperCase()) {
    case 'GMC':
    case 'CHEVROLET':
      return GMC_CHEVROLET_METRICS;
    case 'OTHER':
      return OTHER_METRICS;
    default:
      return GMC_CHEVROLET_METRICS;
  }
};