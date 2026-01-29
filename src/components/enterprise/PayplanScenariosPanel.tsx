import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, DollarSign, Edit, Plus, Trash2 } from "lucide-react";
import { usePayplanScenarios, PayplanScenario, CreatePayplanScenarioInput } from "@/hooks/usePayplanScenarios";
import { PayplanScenarioDialog } from "./PayplanScenarioDialog";
import { getMetricsForBrand } from "@/config/financialMetrics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PayplanScenariosPanelProps {
  className?: string;
}

export function PayplanScenariosPanel({ className }: PayplanScenariosPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<PayplanScenario | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    scenarios,
    isLoading,
    createScenario,
    updateScenario,
    deleteScenario,
    toggleScenarioActive,
  } = usePayplanScenarios();

  const metrics = getMetricsForBrand(null);
  const keyToName = new Map(metrics.map((m: any) => [m.key, m.name]));

  const formatRuleSummary = (scenario: PayplanScenario) => {
    const monthlyBase = scenario.base_salary_annual / 12;
    const rules = scenario.commission_rules.rules || [];
    
    if (rules.length === 0) {
      return `$${monthlyBase.toLocaleString()}/mo base`;
    }

    const ruleDesc = rules
      .map((r) => {
        const metricName = keyToName.get(r.source_metric) || r.source_metric;
        return `${(r.rate * 100).toFixed(1)}% of ${metricName}`;
      })
      .join(" + ");

    return `$${monthlyBase.toLocaleString()}/mo base + ${ruleDesc}`;
  };

  const handleSave = (input: CreatePayplanScenarioInput) => {
    if (editingScenario) {
      updateScenario.mutate(
        { id: editingScenario.id, ...input },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setEditingScenario(null);
          },
        }
      );
    } else {
      createScenario.mutate(input, {
        onSuccess: () => {
          setDialogOpen(false);
        },
      });
    }
  };

  const handleEdit = (scenario: PayplanScenario, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingScenario(scenario);
    setDialogOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteScenario.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleToggleActive = (scenario: PayplanScenario) => {
    toggleScenarioActive.mutate({
      id: scenario.id,
      is_active: !scenario.is_active,
    });
  };

  const activeCount = scenarios.filter((s) => s.is_active).length;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-3 h-auto hover:bg-accent/50"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium">Payplan Scenarios</span>
              {activeCount > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {activeCount} active
                </span>
              )}
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-3 pb-3 space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-2">Loading...</div>
          ) : scenarios.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">
              No scenarios yet. Create one to model compensation.
            </div>
          ) : (
            <div className="space-y-1">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="flex items-start gap-2 p-2 rounded-md hover:bg-accent/30 group"
                >
                  <Checkbox
                    id={`scenario-${scenario.id}`}
                    checked={scenario.is_active}
                    onCheckedChange={() => handleToggleActive(scenario)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={`scenario-${scenario.id}`}
                      className="text-sm font-medium cursor-pointer block truncate"
                    >
                      {scenario.name}
                    </label>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatRuleSummary(scenario)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleEdit(scenario, e)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(scenario.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setEditingScenario(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Scenario
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <PayplanScenarioDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingScenario(null);
        }}
        scenario={editingScenario}
        onSave={handleSave}
        isSaving={createScenario.isPending || updateScenario.isPending}
      />

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scenario?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this payplan scenario. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
