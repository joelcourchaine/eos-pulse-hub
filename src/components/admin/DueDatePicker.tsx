import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DueDayConfig, Cadence } from "@/utils/routineDueDate";

interface DueDatePickerProps {
  cadence: Cadence;
  value: DueDayConfig | null;
  onChange: (config: DueDayConfig | null) => void;
}

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

const DAY_OF_MONTH_OPTIONS = [
  ...Array.from({ length: 28 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}${getOrdinalSuffix(i + 1)}`,
  })),
  { value: "last", label: "Last day of month" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const QUARTERLY_OPTIONS = [
  { value: "last", label: "Last day of quarter" },
  { value: "first_15", label: "15th of 1st month" },
  { value: "last_15", label: "15th of last month" },
  { value: "first_last", label: "Last day of 1st month" },
];

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function DueDatePicker({ cadence, value, onChange }: DueDatePickerProps) {
  if (cadence === "daily") {
    return null; // Daily routines don't need due date configuration
  }

  const hasConfig = value !== null;
  const configType = hasConfig ? "specific" : "none";

  const handleModeChange = (mode: string) => {
    if (mode === "none") {
      onChange(null);
    } else {
      // Set default config based on cadence
      switch (cadence) {
        case "weekly":
          onChange({ type: "day_of_week", day: 5 }); // Default to Friday
          break;
        case "monthly":
          onChange({ type: "day_of_month", day: 15 }); // Default to 15th
          break;
        case "quarterly":
          onChange({ type: "day_of_quarter", day: "last" }); // Default to last day
          break;
        case "yearly":
          onChange({ type: "specific_date", month: 12, day: 31 }); // Default to Dec 31
          break;
      }
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
      <Label className="text-sm font-medium">Due Date (Optional)</Label>
      <p className="text-xs text-muted-foreground">
        {getCadenceHelpText(cadence)}
      </p>

      <RadioGroup value={configType} onValueChange={handleModeChange}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="none" id="due-none" />
          <Label htmlFor="due-none" className="font-normal cursor-pointer">
            No specific due date (anytime during the period)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="specific" id="due-specific" />
          <Label htmlFor="due-specific" className="font-normal cursor-pointer">
            Due on a specific day
          </Label>
        </div>
      </RadioGroup>

      {hasConfig && (
        <div className="pl-6 space-y-2">
          {cadence === "weekly" && value?.type === "day_of_week" && (
            <WeeklyPicker value={value.day} onChange={(day) => onChange({ type: "day_of_week", day })} />
          )}

          {cadence === "monthly" && (
            <MonthlyPicker value={value} onChange={onChange} />
          )}

          {cadence === "quarterly" && value?.type === "day_of_quarter" && (
            <QuarterlyPicker value={value} onChange={onChange} />
          )}

          {cadence === "yearly" && value?.type === "specific_date" && (
            <YearlyPicker value={value} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
}

function getCadenceHelpText(cadence: Cadence): string {
  switch (cadence) {
    case "weekly":
      return "When should this routine be completed each week?";
    case "monthly":
      return "When should this routine be completed each month?";
    case "quarterly":
      return "When should this routine be completed each quarter?";
    case "yearly":
      return "When should this routine be completed each year?";
    default:
      return "";
  }
}

function WeeklyPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (day: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Due every</span>
      <Select value={String(value)} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WEEKDAY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MonthlyPicker({
  value,
  onChange,
}: {
  value: DueDayConfig;
  onChange: (config: DueDayConfig) => void;
}) {
  const monthlyType = value.type === "last_weekday" ? "last_weekday" : "day_of_month";
  const currentDay = value.type === "day_of_month" ? String(value.day) : "15";
  const currentWeekday = value.type === "last_weekday" ? String(value.weekday) : "5";

  return (
    <div className="space-y-2">
      <Select value={monthlyType} onValueChange={(v) => {
        if (v === "day_of_month") {
          onChange({ type: "day_of_month", day: 15 });
        } else {
          onChange({ type: "last_weekday", weekday: 5 });
        }
      }}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day_of_month">Specific day of month</SelectItem>
          <SelectItem value="last_weekday">Last weekday of month</SelectItem>
        </SelectContent>
      </Select>

      {monthlyType === "day_of_month" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Due on the</span>
          <Select
            value={currentDay}
            onValueChange={(v) => {
              const day = v === "last" ? "last" : parseInt(v);
              onChange({ type: "day_of_month", day });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OF_MONTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {monthlyType === "last_weekday" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Due on the last</span>
          <Select
            value={currentWeekday}
            onValueChange={(v) => onChange({ type: "last_weekday", weekday: parseInt(v) })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function QuarterlyPicker({
  value,
  onChange,
}: {
  value: DueDayConfig & { type: "day_of_quarter" };
  onChange: (config: DueDayConfig) => void;
}) {
  const isLast = "day" in value && value.day === "last";
  const hasMonthDay = "month" in value && "dayOfMonth" in value;
  
  const currentValue = isLast ? "last" :
    hasMonthDay && value.month === 1 && value.dayOfMonth === 15 ? "first_15" :
    hasMonthDay && value.month === 3 && value.dayOfMonth === 15 ? "last_15" :
    hasMonthDay && value.month === 1 ? "first_last" : "last";

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Due on</span>
      <Select
        value={currentValue}
        onValueChange={(v) => {
          switch (v) {
            case "last":
              onChange({ type: "day_of_quarter", day: "last" });
              break;
            case "first_15":
              onChange({ type: "day_of_quarter", month: 1, dayOfMonth: 15 });
              break;
            case "last_15":
              onChange({ type: "day_of_quarter", month: 3, dayOfMonth: 15 });
              break;
            case "first_last":
              onChange({ type: "day_of_quarter", month: 1, dayOfMonth: 31 });
              break;
          }
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUARTERLY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function YearlyPicker({
  value,
  onChange,
}: {
  value: DueDayConfig & { type: "specific_date" };
  onChange: (config: DueDayConfig) => void;
}) {
  const daysInMonth = getDaysInMonth(value.month);
  const dayOptions = Array.from({ length: daysInMonth }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Due every</span>
      <Select
        value={String(value.month)}
        onValueChange={(v) => {
          const newMonth = parseInt(v);
          const maxDay = getDaysInMonth(newMonth);
          const newDay = Math.min(value.day, maxDay);
          onChange({ type: "specific_date", month: newMonth, day: newDay });
        }}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(value.day)}
        onValueChange={(v) => onChange({ type: "specific_date", month: value.month, day: parseInt(v) })}
      >
        <SelectTrigger className="w-[80px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {dayOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getDaysInMonth(month: number): number {
  // Using a non-leap year as base
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysPerMonth[month - 1] || 31;
}
