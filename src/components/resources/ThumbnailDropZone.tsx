import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getThumbnailSrc } from "./googleDrive";

interface ThumbnailDropZoneProps {
  thumbnailUrl: string;
  onThumbnailChange: (url: string) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const ThumbnailDropZone = ({
  thumbnailUrl,
  onThumbnailChange,
}: ThumbnailDropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a valid image (JPEG, PNG, GIF, or WebP)");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setIsUploading(true);
    setPreviewError(false);

    try {
      // Generate unique filename
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("resource-thumbnails")
        .upload(filename, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("resource-thumbnails")
        .getPublicUrl(filename);

      onThumbnailChange(urlData.publicUrl);
      toast.success("Thumbnail uploaded");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload thumbnail");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadFile(files[0]);
      }
    },
    [onThumbnailChange]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onThumbnailChange("");
    setPreviewError(false);
  };

  const displayUrl = thumbnailUrl ? getThumbnailSrc(thumbnailUrl) : null;

  return (
    <div className="space-y-2">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors cursor-pointer",
          "flex flex-col items-center justify-center min-h-[160px] p-4",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Uploading...</span>
          </div>
        ) : displayUrl && !previewError ? (
          <div className="relative w-full">
            <img
              src={displayUrl}
              alt="Thumbnail preview"
              className="max-h-[140px] mx-auto rounded object-contain"
              onError={() => setPreviewError(true)}
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-0 right-0 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {previewError ? (
              <>
                <ImageIcon className="h-8 w-8" />
                <span className="text-sm">Preview unavailable</span>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove URL
                </button>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">
                  Drop image here or click to upload
                </span>
                <span className="text-xs">
                  Recommended: 640×320px • Max 2MB
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
