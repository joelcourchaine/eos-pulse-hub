import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileSignature, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SignatureRequestsPanel } from "@/components/signatures/SignatureRequestsPanel";

interface Store {
  id: string;
  name: string;
}

const Signatures: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        // Check if user is super admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin")
          .maybeSingle();

        if (!roleData) {
          toast({
            variant: "destructive",
            title: "Access denied",
            description: "Only super admins can access this page.",
          });
          navigate("/");
          return;
        }

        setIsSuperAdmin(true);

        // Load all stores
        const { data: storesData, error } = await supabase
          .from("stores")
          .select("id, name")
          .order("name");

        if (error) throw error;
        setStores(storesData || []);

        // Auto-select first store if available
        if (storesData && storesData.length > 0) {
          setSelectedStoreId(storesData[0].id);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load stores.",
        });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [navigate, toast]);

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <FileSignature className="h-6 w-6" />
                <h1 className="text-2xl font-semibold">Signature Requests</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Select Store
          </label>
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a store..." />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStoreId && (
          <SignatureRequestsPanel
            storeId={selectedStoreId}
            storeName={selectedStore?.name}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {!selectedStoreId && (
          <div className="text-center py-12 text-muted-foreground">
            <FileSignature className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Select a store to manage signature requests</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signatures;
