import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Resource, ResourceType, ResourceCategory } from "./ResourceCard";
import { normalizeGoogleDriveImageUrl } from "./googleDrive";
import { ThumbnailDropZone } from "./ThumbnailDropZone";

interface DepartmentType {
  id: string;
  name: string;
}

interface StoreGroup {
  id: string;
  name: string;
}

interface ResourceManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource?: Resource | null;
  departmentTypes: DepartmentType[];
  storeGroups?: StoreGroup[];
  onSuccess: () => void;
}

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'google_doc', label: 'Google Doc' },
  { value: 'spreadsheet', label: 'Spreadsheet' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'pdf', label: 'PDF' },
  { value: 'weblink', label: 'Web Link' },
  { value: 'video', label: 'Video' },
];

const CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: 'training', label: 'Training' },
  { value: 'templates', label: 'Templates' },
  { value: 'guides', label: 'Guides' },
  { value: 'best_practices', label: 'Best Practices' },
  { value: 'processes', label: 'Processes' },
  { value: 'reports', label: 'Reports' },
  { value: 'branding', label: 'Branding' },
];

export const ResourceManagementDialog = ({
  open,
  onOpenChange,
  resource,
  departmentTypes,
  storeGroups = [],
  onSuccess,
}: ResourceManagementDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("weblink");
  const [category, setCategory] = useState<ResourceCategory>("guides");
  const [url, setUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [departmentTypeId, setDepartmentTypeId] = useState<string | null>(null);
  const [storeGroupId, setStoreGroupId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [searchableContent, setSearchableContent] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!resource;

  useEffect(() => {
    if (resource) {
      setTitle(resource.title);
      setDescription(resource.description || "");
      setResourceType(resource.resource_type);
      setCategory(resource.category);
      setUrl(resource.url || "");
      setThumbnailUrl(resource.thumbnail_url || "");
      setDepartmentTypeId(resource.department_type_id);
      setStoreGroupId(resource.store_group_id);
      setTags(resource.tags || []);
    } else {
      resetForm();
    }
  }, [resource, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setResourceType("weblink");
    setCategory("guides");
    setUrl("");
    setThumbnailUrl("");
    setDepartmentTypeId(null);
    setStoreGroupId(null);
    setTags([]);
    setTagInput("");
    setSearchableContent("");
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) {
      toast.error("Title and URL are required");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const normalizedThumb = normalizeGoogleDriveImageUrl(thumbnailUrl.trim()) || null;

      const resourceData = {
        title: title.trim(),
        description: description.trim() || null,
        resource_type: resourceType,
        category,
        url: url.trim(),
        thumbnail_url: normalizedThumb,
        department_type_id: departmentTypeId,
        store_group_id: storeGroupId,
        tags,
        searchable_content: searchableContent.trim() || null,
        created_by: user?.id,
      };

      if (isEditing && resource) {
        const { error } = await supabase
          .from("resources")
          .update(resourceData)
          .eq("id", resource.id);

        if (error) throw error;
        toast.success("Resource updated successfully");
      } else {
        const { error } = await supabase
          .from("resources")
          .insert(resourceData);

        if (error) throw error;
        toast.success("Resource added successfully");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving resource:", error);
      toast.error(error.message || "Failed to save resource");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Resource" : "Add New Resource"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter resource title"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this resource"
              rows={3}
            />
          </div>

          {/* Type & Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Resource Type *</Label>
              <Select value={resourceType} onValueChange={(v) => setResourceType(v as ResourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ResourceCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">Resource URL *</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Thumbnail */}
          <div className="space-y-2">
            <Label>Thumbnail (optional)</Label>
            <ThumbnailDropZone
              thumbnailUrl={thumbnailUrl}
              onThumbnailChange={setThumbnailUrl}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>— or paste URL —</span>
            </div>
            <Input
              id="thumbnail"
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://... (Google Drive, external URL)"
              className="text-sm"
            />
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Department (optional)</Label>
            <Select 
              value={departmentTypeId || "all"} 
              onValueChange={(v) => setDepartmentTypeId(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentTypes.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Store Group */}
          {storeGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Store Group (optional)</Label>
              <Select 
                value={storeGroupId || "all"} 
                onValueChange={(v) => setStoreGroupId(v === "all" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {storeGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Restrict this resource to users in a specific group.
              </p>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Searchable content */}
          <div className="space-y-2">
            <Label htmlFor="searchable">Additional Searchable Content (optional)</Label>
            <Textarea
              id="searchable"
              value={searchableContent}
              onChange={(e) => setSearchableContent(e.target.value)}
              placeholder="Add keywords or content to improve search (e.g., copy key points from the document)"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This helps users find this resource when searching for related terms.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Add Resource"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
