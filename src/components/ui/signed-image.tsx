import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "./skeleton";

interface SignedImageProps {
  bucket: string;
  path: string | null;
  alt?: string;
  className?: string;
  expiresIn?: number; // seconds, default 300 (5 minutes)
}

/**
 * Displays an image from a private Supabase storage bucket using signed URLs.
 * Handles both file paths and legacy full URLs.
 */
export const SignedImage = ({ 
  bucket, 
  path, 
  alt = "Image", 
  className = "",
  expiresIn = 300 
}: SignedImageProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    const generateSignedUrl = async () => {
      setLoading(true);
      setError(false);

      try {
        // Check if it's already a full URL (legacy data)
        if (path.startsWith("http://") || path.startsWith("https://")) {
          // Extract file path from legacy URL
          // Format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
          const urlParts = path.split(`/storage/v1/object/public/${bucket}/`);
          if (urlParts.length === 2) {
            const filePath = urlParts[1];
            const { data, error: signError } = await supabase.storage
              .from(bucket)
              .createSignedUrl(filePath, expiresIn);

            if (signError || !data?.signedUrl) {
              console.error("Failed to create signed URL:", signError);
              setError(true);
              return;
            }
            setSignedUrl(data.signedUrl);
          } else {
            // Unknown URL format, try using directly
            setSignedUrl(path);
          }
        } else {
          // It's a file path
          const { data, error: signError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, expiresIn);

          if (signError || !data?.signedUrl) {
            console.error("Failed to create signed URL:", signError);
            setError(true);
            return;
          }
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error generating signed URL:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    generateSignedUrl();
  }, [bucket, path, expiresIn]);

  if (!path) return null;

  if (loading) {
    return <Skeleton className={`${className} min-h-[100px]`} />;
  }

  if (error || !signedUrl) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted text-muted-foreground text-sm p-4 rounded`}>
        Failed to load image
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
};
