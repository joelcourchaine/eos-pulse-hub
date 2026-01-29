import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { getMetricsForBrand } from "@/config/financialMetrics";
import {
  PayplanScenario,
  CommissionRule,
  CreatePayplanScenarioInput,
} from "@/hooks/usePayplanScenarios";

interface PayplanScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario?: PayplanScenario | null;
  onSave: (input: CreatePayplanScenarioInput) => void;
  isSaving?: boolean;
}

export function PayplanScenarioDialog({
  open,
  onOpenChange,
  scenario,
  onSave,
  isSaving,
}: PayplanScenarioDialogProps) {
  const [name, setName] = useState("");
  const [baseSalaryInput, setBaseSalaryInput] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState<"monthly" | "annual">("monthly");
  const [rules, setRules] = useState<CommissionRule[]>([]);

  const isEditing = !!scenario;

  // Get available metrics for dropdown
  const metrics = getMetricsForBrand(null).filter(
    (m: any) => m.type === "dollar"
  );

  // Reset form when dialog opens/closes or scenario changes
  useEffect(() => {
    if (open) {
      if (scenario) {
        setName(scenario.name);
        const annualSalary = scenario.base_salary_annual;
        // Default to monthly display
        setBaseSalaryInput((annualSalary / 12).toFixed(0));
        setSalaryPeriod("monthly");
        setRules(scenario.commission_rules.rules || []);
      } else {
        setName("");
        setBaseSalaryInput("");
        setSalaryPeriod("monthly");
        setRules([
          {
            source_metric: "net_selling_gross",
            rate: 0.03,
            min_threshold: null,
            max_threshold: null,
          },
        ]);
      }
    }
  }, [open, scenario]);

  const handleAddRule = () => {
    setRules([
      ...rules,
      {
        source_metric: "net_selling_gross",
        rate: 0.03,
        min_threshold: null,
        max_threshold: null,
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (
    index: number,
    field: keyof CommissionRule,
    value: any
  ) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (rules.length === 0) return;

    const salaryValue = parseFloat(baseSalaryInput) || 0;
    const annualSalary =
      salaryPeriod === "monthly" ? salaryValue * 12 : salaryValue;

    onSave({
      name: name.trim(),
      base_salary_annual: annualSalary,
      commission_rules: { rules },
    });
  };

  const displayAnnualSalary =
    salaryPeriod === "monthly"
      ? (parseFloat(baseSalaryInput) || 0) * 12
      : parseFloat(baseSalaryInput) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Payplan Scenario" : "Create Payplan Scenario"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Scenario Name */}
          <div className="space-y-2">
            <Label htmlFor="scenario-name">Scenario Name</Label>
            <Input
              id="scenario-name"
              placeholder="e.g., Tom - Fixed Ops Manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Base Salary */}
          <div className="space-y-2">
            <Label>Base Salary</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="6,500"
                  value={baseSalaryInput}
                  onChange={(e) => setBaseSalaryInput(e.target.value)}
                />
              </div>
              <span className="text-muted-foreground">per</span>
              <Select
                value={salaryPeriod}
                onValueChange={(v) => setSalaryPeriod(v as "monthly" | "annual")}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              = ${displayAnnualSalary.toLocaleString()}/year
            </p>
          </div>

          {/* Commission Rules */}
          <div className="space-y-3">
            <Label>Commission Rules</Label>
            {rules.map((rule, index) => (
              <div
                key={index}
                className="border rounded-lg p-3 space-y-3 bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Rule {index + 1}</span>
                  {rules.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveRule(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Source Metric</Label>
                    <Select
                      value={rule.source_metric}
                      onValueChange={(v) =>
                        handleRuleChange(index, "source_metric", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {metrics.map((m: any) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Commission Rate (%)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={(rule.rate * 100).toFixed(1)}
                        onChange={(e) =>
                          handleRuleChange(
                            index,
                            "rate",
                            parseFloat(e.target.value) / 100 || 0
                          )
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Min Threshold (optional)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          className="pl-7"
                          placeholder="0"
                          value={rule.min_threshold ?? ""}
                          onChange={(e) =>
                            handleRuleChange(
                              index,
                              "min_threshold",
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Threshold (optional)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          $
                        </span>
                        <Input
                          type="number"
                          className="pl-7"
                          placeholder=""
                          value={rule.max_threshold ?? ""}
                          onChange={(e) =>
                            handleRuleChange(
                              index,
                              "max_threshold",
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddRule}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Rule
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || rules.length === 0 || isSaving}
          >
            {isSaving ? "Saving..." : isEditing ? "Update Scenario" : "Save Scenario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
