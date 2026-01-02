import * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FormattedCurrencyProps {
  value: number;
  className?: string;
  showSign?: boolean; // Show +/- prefix
}

/**
 * Formats a number as abbreviated currency (e.g., $6.2M)
 */
export const formatCurrency = (value: number, showSign = false) => {
  const prefix = showSign ? (value >= 0 ? '+' : '') : '';
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000) {
    return `${prefix}$${(value / 1000000).toFixed(1)}M`;
  }
  if (absValue >= 1000) {
    return `${prefix}$${(value / 1000).toFixed(0)}K`;
  }
  return `${prefix}$${value.toFixed(0)}`;
};

/**
 * Formats a number as full currency with commas (e.g., $6,200,000)
 */
export const formatFullCurrency = (value: number, showSign = false) => {
  const prefix = showSign ? (value >= 0 ? '+' : '') : '';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  
  return showSign && value >= 0 ? `+${formatted}` : formatted;
};

/**
 * Component that displays abbreviated currency with full value on hover
 */
export function FormattedCurrency({ value, className, showSign = false }: FormattedCurrencyProps) {
  const abbreviated = formatCurrency(value, showSign);
  const full = formatFullCurrency(value, showSign);
  const absValue = Math.abs(value);
  
  // Only show tooltip if abbreviation was applied (value >= 1000)
  const wasAbbreviated = absValue >= 1000;
  
  if (!wasAbbreviated) {
    return <span className={cn(className)}>{abbreviated}</span>;
  }
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span className={cn("cursor-help", className)}>{abbreviated}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-sm">
          {full}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
