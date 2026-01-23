import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarIcon, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TravelPeriod, TravelDestination } from "@/hooks/useTravelPeriods";

interface TravelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  travel?: TravelPeriod | null;
  destinations: TravelDestination[];
  getDestinationColor: (name: string) => string;
  onSave: (data: { destination: string; start_date: string; end_date: string; notes?: string }) => void;
  onUpdate: (data: { id: string; destination?: string; start_date?: string; end_date?: string; notes?: string | null }) => void;
  onDelete: (id: string) => void;
}

export function TravelDialog({
  open,
  onOpenChange,
  travel,
  destinations,
  getDestinationColor,
  onSave,
  onUpdate,
  onDelete,
}: TravelDialogProps) {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const isEditing = !!travel;

  // Reset form when dialog opens/closes or travel changes
  useEffect(() => {
    if (open) {
      if (travel) {
        setDestination(travel.destination);
        setStartDate(parseISO(travel.start_date));
        setEndDate(parseISO(travel.end_date));
        setNotes(travel.notes || "");
      } else {
        setDestination("");
        setStartDate(undefined);
        setEndDate(undefined);
        setNotes("");
      }
    }
  }, [open, travel]);

  const handleSave = () => {
    if (!destination.trim()) {
      toast.error("Please enter a destination");
      return;
    }
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }
    if (!endDate) {
      toast.error("Please select an end date");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be after start date");
      return;
    }

    const data = {
      destination: destination.trim(),
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      notes: notes.trim() || undefined,
    };

    if (isEditing) {
      onUpdate({ id: travel.id, ...data });
    } else {
      onSave(data);
    }
    
    onOpenChange(false);
    toast.success(isEditing ? "Travel updated" : "Travel added");
  };

  const handleDelete = () => {
    if (travel) {
      onDelete(travel.id);
      onOpenChange(false);
      toast.success("Travel deleted");
    }
  };

  // Color preview based on current destination
  const previewColor = destination ? getDestinationColor(destination) : "#94a3b8";

  // Get unique destination suggestions
  const existingDestinations = destinations.map(d => d.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Travel" : "Add Travel"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Destination input with color preview */}
          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded-full border shrink-0"
                style={{ backgroundColor: previewColor }}
              />
              <Input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Calgary, Toronto"
                list="destinations-list"
              />
              <datalist id="destinations-list">
                {existingDestinations.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            {existingDestinations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {existingDestinations.slice(0, 5).map(name => (
                  <button
                    key={name}
                    type="button"
                    className="px-2 py-0.5 text-xs rounded-full border hover:bg-muted transition-colors"
                    style={{ borderColor: getDestinationColor(name) + '40', backgroundColor: getDestinationColor(name) + '15' }}
                    onClick={() => setDestination(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover open={startOpen} onOpenChange={setStartOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Select start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    setStartOpen(false);
                    // Auto-set end date if not set
                    if (!endDate && date) {
                      setEndDate(date);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover open={endOpen} onOpenChange={setEndOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Select end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date);
                    setEndOpen(false);
                  }}
                  disabled={(date) => startDate ? date < startDate : false}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this trip..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {isEditing ? (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? "Update" : "Add Travel"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
