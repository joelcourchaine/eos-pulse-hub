import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface ConsultingClient {
  id: string;
  name: string;
  department_name: string | null;
  contact_names: string | null;
  call_value: number;
  is_adhoc: boolean;
  is_active: boolean;
  sort_order: number;
}

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editClient?: ConsultingClient | null;
}

export function AddClientDialog({ open, onOpenChange, editClient }: AddClientDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<'dealer' | 'adhoc'>('dealer');
  const [name, setName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [contactNames, setContactNames] = useState('');
  const [callValue, setCallValue] = useState('');

  const isEdit = !!editClient;

  useEffect(() => {
    if (editClient) {
      setClientType(editClient.is_adhoc ? 'adhoc' : 'dealer');
      setName(editClient.name);
      setDepartmentName(editClient.department_name || '');
      setContactNames(editClient.contact_names || '');
      setCallValue(editClient.call_value.toString());
    } else {
      resetForm();
    }
  }, [editClient, open]);

  const resetForm = () => {
    setClientType('dealer');
    setName('');
    setDepartmentName('');
    setContactNames('');
    setCallValue('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Client name is required");
      return;
    }

    setLoading(true);

    const clientData = {
      name: name.trim(),
      department_name: departmentName.trim() || null,
      contact_names: contactNames.trim() || null,
      call_value: parseFloat(callValue) || 0,
      is_adhoc: clientType === 'adhoc',
    };

    try {
      if (isEdit && editClient) {
        const { error } = await supabase
          .from('consulting_clients')
          .update(clientData)
          .eq('id', editClient.id);

        if (error) throw error;
        toast.success("Client updated successfully");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('consulting_clients')
          .insert({
            ...clientData,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success("Client added successfully");
      }

      queryClient.invalidateQueries({ queryKey: ['consulting-clients'] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Client Type</Label>
            <RadioGroup 
              value={clientType} 
              onValueChange={(v) => setClientType(v as 'dealer' | 'adhoc')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dealer" id="dealer" />
                <Label htmlFor="dealer" className="cursor-pointer">Dealership</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="adhoc" id="adhoc" />
                <Label htmlFor="adhoc" className="cursor-pointer">Ad-Hoc</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">
              {clientType === 'dealer' ? 'Dealership Name' : 'Client Name'} *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={clientType === 'dealer' ? 'e.g., Winnipeg Chevrolet' : 'e.g., Industry Conference'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department Name</Label>
            <Input
              id="department"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="e.g., Service, Parts, Sales"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contacts">Contact Names</Label>
            <Input
              id="contacts"
              value={contactNames}
              onChange={(e) => setContactNames(e.target.value)}
              placeholder="e.g., Craig H, Mike S"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value per Call ($)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={callValue}
              onChange={(e) => setCallValue(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Client')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
