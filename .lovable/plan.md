

# Add Drag-and-Drop Thumbnail Upload for Resources

## Overview
Replace the simple URL text input for thumbnails with a visual drag-and-drop zone that allows admins to either drop an image file directly or enter a URL. Uploaded images will be stored in Supabase Storage.

## Current State
- Thumbnail input is a plain text field requiring a URL
- Users must host images elsewhere (e.g., Google Drive) and paste URLs
- No visual preview until the resource is saved

## Proposed Solution

### User Experience
1. **Drop Zone UI**: A visual area showing:
   - Current thumbnail preview (if set)
   - "Drop image here or click to upload" prompt
   - Alternative "or paste URL" option
2. **Drag and Drop**: Drag an image file onto the zone to upload
3. **Click to Browse**: Click the zone to open a file picker
4. **URL Fallback**: Keep a small text input below for pasting URLs (Google Drive, etc.)
5. **Preview**: Show the thumbnail preview immediately after upload/URL entry
6. **Remove Option**: "X" button to clear the thumbnail

### Technical Implementation

#### 1. Create Storage Bucket
Create a new `resource-thumbnails` public bucket for storing uploaded thumbnails.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-thumbnails', 'resource-thumbnails', true);

-- RLS policy: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload resource thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-thumbnails');

-- RLS policy: Allow anyone to view (public bucket)
CREATE POLICY "Anyone can view resource thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resource-thumbnails');

-- RLS policy: Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete resource thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-thumbnails');
```

#### 2. Create ThumbnailDropZone Component
**New file: `src/components/resources/ThumbnailDropZone.tsx`**

Features:
- Accept `thumbnailUrl` and `onThumbnailChange` props
- Handle drag events (`onDragOver`, `onDragLeave`, `onDrop`)
- Upload file to `resource-thumbnails` bucket
- Return public URL to parent component
- Show loading state during upload
- Preview current thumbnail
- Support click-to-browse as well as drag-and-drop

```typescript
interface ThumbnailDropZoneProps {
  thumbnailUrl: string;
  onThumbnailChange: (url: string) => void;
}
```

#### 3. Update ResourceManagementDialog
**File: `src/components/resources/ResourceManagementDialog.tsx`**

Replace the simple thumbnail URL input (lines 261-271) with:
- The new `ThumbnailDropZone` component
- A smaller "or paste URL" text input below
- Both methods update the same `thumbnailUrl` state

### File Changes

| File | Changes |
|------|---------|
| Migration | Create `resource-thumbnails` bucket with RLS policies |
| `src/components/resources/ThumbnailDropZone.tsx` | **New file** - Drag-and-drop upload component |
| `src/components/resources/ResourceManagementDialog.tsx` | Replace URL input with ThumbnailDropZone + fallback URL input |

### UI Mockup

```text
+------------------------------------------+
|                                          |
|     [Image Preview or Placeholder]       |
|                                          |
|   Drop image here or click to upload     |
|                                          |
|              [x Remove]                  |
+------------------------------------------+
        — or paste thumbnail URL —
+------------------------------------------+
| https://...                              |
+------------------------------------------+
```

### Technical Notes

1. **File Naming**: Use `{resourceId or timestamp}-{Date.now()}.{ext}` for unique filenames
2. **File Validation**: Accept only image types (`image/*`), max 2MB
3. **Google Drive URLs**: The existing URL input still supports pasting Drive links which get normalized
4. **Cleanup**: Old thumbnails should be deleted from storage when replaced (if they were uploaded to our bucket)
5. **Recommended Size**: Show hint "Recommended: 640x320px for best results"

