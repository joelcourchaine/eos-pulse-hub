import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Lock, Unlock, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ForecastDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName: string;
}

// Mock data for UI preview
const mockWeights = [
  { month: 'Jan', original: 7.2, adjusted: 7.2, locked: false },
  { month: 'Feb', original: 6.8, adjusted: 6.8, locked: false },
  { month: 'Mar', original: 8.1, adjusted: 8.1, locked: false },
  { month: 'Apr', original: 8.5, adjusted: 8.5, locked: false },
  { month: 'May', original: 9.2, adjusted: 9.2, locked: false },
  { month: 'Jun', original: 9.8, adjusted: 9.8, locked: false },
  { month: 'Jul', original: 8.9, adjusted: 8.9, locked: false },
  { month: 'Aug', original: 8.4, adjusted: 8.4, locked: false },
  { month: 'Sep', original: 8.6, adjusted: 8.6, locked: false },
  { month: 'Oct', original: 8.2, adjusted: 8.2, locked: false },
  { month: 'Nov', original: 7.8, adjusted: 7.8, locked: false },
  { month: 'Dec', original: 8.5, adjusted: 8.5, locked: false },
];

const mockMetrics = [
  { name: 'Total Sales', jan: 380000, feb: 360000, mar: 420000, q1: 1160000, year: 4800000, hasSubMetrics: true, isExpanded: false },
  { name: 'GP Net', jan: 108000, feb: 102000, mar: 119000, q1: 329000, year: 1370000, hasSubMetrics: false },
  { name: 'GP %', jan: 28.4, feb: 28.3, mar: 28.3, q1: 28.4, year: 28.5, isPercent: true, hasSubMetrics: false },
  { name: 'Sales Expense', jan: 45000, feb: 43000, mar: 50000, q1: 138000, year: 580000, hasSubMetrics: true },
  { name: 'Semi-Fixed Exp', jan: 12000, feb: 11500, mar: 13000, q1: 36500, year: 150000, hasSubMetrics: false },
  { name: 'Fixed Expense', jan: 31250, feb: 31250, mar: 31250, q1: 93750, year: 375000, hasSubMetrics: false },
  { name: 'Dept Profit', jan: 19750, feb: 16250, mar: 24750, q1: 60750, year: 265000, hasSubMetrics: false },
];

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatValue = (value: number, isPercent?: boolean) => {
  if (isPercent) return `${value.toFixed(1)}%`;
  return formatCurrency(value);
};

export function ForecastDrawer({ open, onOpenChange, departmentName }: ForecastDrawerProps) {
  const [weightsOpen, setWeightsOpen] = useState(false);
  const [view, setView] = useState<'monthly' | 'quarter' | 'annual'>('monthly');
  const [salesGrowth, setSalesGrowth] = useState(8.5);
  const [gpPercent, setGpPercent] = useState(28.5);
  const [salesExpPercent, setSalesExpPercent] = useState(42.0);
  const [fixedExpense, setFixedExpense] = useState(375000);
  const [weights, setWeights] = useState(mockWeights);

  const currentYear = new Date().getFullYear();
  const forecastYear = currentYear + 1;

  const toggleWeightLock = (index: number) => {
    setWeights(prev => prev.map((w, i) => 
      i === index ? { ...w, locked: !w.locked } : w
    ));
  };

  const totalWeight = weights.reduce((sum, w) => sum + w.adjusted, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">
              Forecast {forecastYear} — {departmentName}
            </SheetTitle>
            <Button size="sm" className="mr-8">
              Save Forecast
            </Button>
          </div>
        </SheetHeader>

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

          {/* Weight Distribution */}
          <Collapsible open={weightsOpen} onOpenChange={setWeightsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto bg-muted/50">
                <span className="font-semibold">Weight Distribution</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm",
                    Math.abs(totalWeight - 100) > 0.1 ? "text-destructive" : "text-muted-foreground"
                  )}>
                    Total: {totalWeight.toFixed(1)}%
                  </span>
                  {weightsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="font-medium text-muted-foreground">Month</div>
                <div className="font-medium text-muted-foreground">Original</div>
                <div className="font-medium text-muted-foreground">Adjusted</div>
                <div className="font-medium text-muted-foreground text-center">Lock</div>
                {weights.map((w, i) => (
                  <>
                    <div key={`${w.month}-name`} className="py-1">{w.month}</div>
                    <div key={`${w.month}-orig`} className="py-1 text-muted-foreground">{w.original.toFixed(1)}%</div>
                    <div key={`${w.month}-adj`}>
                      <Input
                        type="number"
                        value={w.adjusted}
                        onChange={(e) => {
                          const newVal = parseFloat(e.target.value) || 0;
                          setWeights(prev => prev.map((wt, idx) => 
                            idx === i ? { ...wt, adjusted: newVal } : wt
                          ));
                        }}
                        className="h-7 w-20 text-sm"
                        step="0.1"
                        disabled={w.locked}
                      />
                    </div>
                    <div key={`${w.month}-lock`} className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => toggleWeightLock(i)}
                      >
                        {w.locked ? (
                          <Lock className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3">
                Reset to Original
              </Button>
            </CollapsibleContent>
          </Collapsible>

          {/* Key Drivers */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <h3 className="font-semibold">Key Drivers</h3>
            
            <div className="space-y-4">
              {/* Sales Growth */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sales Growth</span>
                  <span className="font-medium">{salesGrowth > 0 ? '+' : ''}{salesGrowth.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8">-10%</span>
                  <Slider
                    value={[salesGrowth]}
                    onValueChange={([v]) => setSalesGrowth(v)}
                    min={-10}
                    max={25}
                    step={0.5}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8">+25%</span>
                </div>
              </div>

              {/* GP % */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>GP % Target</span>
                  <span className="font-medium">{gpPercent.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8">20%</span>
                  <Slider
                    value={[gpPercent]}
                    onValueChange={([v]) => setGpPercent(v)}
                    min={20}
                    max={40}
                    step={0.5}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8">40%</span>
                </div>
              </div>

              {/* Sales Expense % */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sales Expense %</span>
                  <span className="font-medium">{salesExpPercent.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8">30%</span>
                  <Slider
                    value={[salesExpPercent]}
                    onValueChange={([v]) => setSalesExpPercent(v)}
                    min={30}
                    max={55}
                    step={0.5}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8">55%</span>
                </div>
              </div>

              {/* Fixed Expense */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Fixed Expense (Annual)</span>
                  <span className="font-medium">{formatCurrency(fixedExpense)}</span>
                </div>
                <Input
                  type="number"
                  value={fixedExpense}
                  onChange={(e) => setFixedExpense(parseFloat(e.target.value) || 0)}
                  className="w-full"
                  step={1000}
                />
              </div>
            </div>
          </div>

          {/* Forecast Results Grid */}
          <div className="space-y-2">
            <h3 className="font-semibold">Forecast Results</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Metric</th>
                    {view === 'monthly' && (
                      <>
                        <th className="text-right py-2 px-2 font-medium">Jan</th>
                        <th className="text-right py-2 px-2 font-medium">Feb</th>
                        <th className="text-right py-2 px-2 font-medium">Mar</th>
                      </>
                    )}
                    {view === 'quarter' && (
                      <>
                        <th className="text-right py-2 px-2 font-medium">Q1</th>
                        <th className="text-right py-2 px-2 font-medium">Q2</th>
                        <th className="text-right py-2 px-2 font-medium">Q3</th>
                        <th className="text-right py-2 px-2 font-medium">Q4</th>
                      </>
                    )}
                    <th className="text-right py-2 pl-2 font-medium bg-muted/50">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {mockMetrics.map((metric) => (
                    <tr key={metric.name} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {metric.hasSubMetrics && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={metric.hasSubMetrics ? 'font-medium' : ''}>
                            {metric.name}
                          </span>
                        </div>
                      </td>
                      {view === 'monthly' && (
                        <>
                          <td className="text-right py-2 px-2">{formatValue(metric.jan, metric.isPercent)}</td>
                          <td className="text-right py-2 px-2">{formatValue(metric.feb, metric.isPercent)}</td>
                          <td className="text-right py-2 px-2">{formatValue(metric.mar, metric.isPercent)}</td>
                        </>
                      )}
                      {view === 'quarter' && (
                        <>
                          <td className="text-right py-2 px-2">{formatValue(metric.q1, metric.isPercent)}</td>
                          <td className="text-right py-2 px-2">{formatValue(metric.q1 * 1.05, metric.isPercent)}</td>
                          <td className="text-right py-2 px-2">{formatValue(metric.q1 * 1.08, metric.isPercent)}</td>
                          <td className="text-right py-2 px-2">{formatValue(metric.q1 * 0.95, metric.isPercent)}</td>
                        </>
                      )}
                      <td className="text-right py-2 pl-2 font-medium bg-muted/50">
                        {formatValue(metric.year, metric.isPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Baseline Comparison */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h3 className="font-semibold mb-3">vs Baseline</h3>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Net Profit:</span>
                <span className="ml-2 font-medium">$265K</span>
                <span className="text-muted-foreground mx-1">vs</span>
                <span className="text-muted-foreground">$227K baseline</span>
              </div>
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold">+$38K (+16.7%)</span>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
