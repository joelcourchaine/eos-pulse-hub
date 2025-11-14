import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Building2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface LogoUploadProps {
  storeId: string | null;
  userRole: string;
}

export function LogoUpload({ storeId, userRole }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const isAdmin = userRole === 'super_admin' || userRole === 'store_gm';

  const { data: store } = useQuery({
    queryKey: ['store', storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data, error } = await supabase
        .from('stores')
        .select('logo_url')
        .eq('id', storeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!storeId) throw new Error("No store selected");

      // Delete old logo if exists
      if (store?.logo_url) {
        const oldFileName = store.logo_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('store-logos')
            .remove([oldFileName]);
        }
      }

      // Upload to storage with unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${storeId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('store-logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('store-logos')
        .getPublicUrl(fileName);

      // Update store record
      const { error: updateError } = await supabase
        .from('stores')
        .update({ logo_url: publicUrl })
        .eq('id', storeId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      toast.success("Logo uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ['store', storeId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload logo: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("No store selected");
      if (!store?.logo_url) throw new Error("No logo to delete");

      // Delete from storage
      const fileName = store.logo_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('store-logos')
          .remove([fileName]);
      }

      // Update store record
      const { error: updateError } = await supabase
        .from('stores')
        .update({ logo_url: null })
        .eq('id', storeId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Logo deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['store', storeId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete logo: ${error.message}`);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="relative h-[88px] flex items-center justify-center bg-muted/30 rounded-md">
          {store?.logo_url ? (
            <img 
              src={store.logo_url} 
              alt="Dealership Logo" 
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
          )}
          
          {isAdmin && (
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-md">
              <label htmlFor="logo-upload" className="cursor-pointer">
                <Button 
                  variant="secondary" 
                  size="sm"
                  disabled={uploading || deleteMutation.isPending}
                  asChild
                >
                  <span>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {store?.logo_url ? 'Change' : 'Upload'}
                  </span>
                </Button>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading || deleteMutation.isPending}
                />
              </label>
              {store?.logo_url && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => deleteMutation.mutate()}
                  disabled={uploading || deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Delete"
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
