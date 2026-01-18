import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [adhocName, setAdhocName] = useState('');
  const [adhocDepartment, setAdhocDepartment] = useState('');
  const [contactNames, setContactNames] = useState('');
  const [callValue, setCallValue] = useState('');

  const isEdit = !!editClient;

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['all-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, brand')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch departments for selected store
  const { data: departments } = useQuery({
    queryKey: ['store-departments', selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('store_id', selectedStoreId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStoreId && open,
  });

  useEffect(() => {
    if (editClient && open) {
      setClientType(editClient.is_adhoc ? 'adhoc' : 'dealer');
      setContactNames(editClient.contact_names || '');
      setCallValue(editClient.call_value.toString());
      
      if (editClient.is_adhoc) {
        setAdhocName(editClient.name);
        setAdhocDepartment(editClient.department_name || '');
        setSelectedStoreId('');
        setSelectedDepartmentId('');
      } else {
        setAdhocName('');
        setAdhocDepartment('');
        // For existing dealers, we'll need to match by name
        // This is a simplified approach - in edit mode we keep the text values
      }
    } else if (open) {
      resetForm();
    }
  }, [editClient, open]);

  const resetForm = () => {
    setClientType('dealer');
    setSelectedStoreId('');
    setSelectedDepartmentId('');
    setAdhocName('');
    setAdhocDepartment('');
    setContactNames('');
    setCallValue('');
  };

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    setSelectedDepartmentId(''); // Reset department when store changes
  };

  const getSelectedStoreName = () => {
    const store = stores?.find(s => s.id === selectedStoreId);
    return store?.name || '';
  };

  const getSelectedDepartmentName = () => {
    const dept = departments?.find(d => d.id === selectedDepartmentId);
    return dept?.name || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let clientName = '';
    let departmentName = '';

    if (clientType === 'dealer') {
      if (!selectedStoreId) {
        toast.error("Please select a dealership");
        return;
      }
      clientName = getSelectedStoreName();
      departmentName = getSelectedDepartmentName();
    } else {
      if (!adhocName.trim()) {
        toast.error("Client name is required");
        return;
      }
      clientName = adhocName.trim();
      departmentName = adhocDepartment.trim();
    }

    setLoading(true);

    const clientData = {
      name: clientName,
      department_name: departmentName || null,
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

          {clientType === 'dealer' ? (
            <>
              <div className="space-y-2">
                <Label>Dealership *</Label>
                <Select value={selectedStoreId} onValueChange={handleStoreChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a dealership" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores?.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name} {store.brand && `(${store.brand})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select 
                  value={selectedDepartmentId} 
                  onValueChange={setSelectedDepartmentId}
                  disabled={!selectedStoreId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedStoreId ? "Select a department" : "Select dealership first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="adhocName">Client Name *</Label>
                <Input
                  id="adhocName"
                  value={adhocName}
                  onChange={(e) => setAdhocName(e.target.value)}
                  placeholder="e.g., Industry Conference"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adhocDept">Department / Category</Label>
                <Input
                  id="adhocDept"
                  value={adhocDepartment}
                  onChange={(e) => setAdhocDepartment(e.target.value)}
                  placeholder="e.g., Training, Consulting"
                />
              </div>
            </>
          )}

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
