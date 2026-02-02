import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Table2, 
  Presentation, 
  FileType, 
  Globe, 
  Video, 
  ExternalLink,
  Eye,
  Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getThumbnailSrc } from "./googleDrive";

export type ResourceType = 'google_doc' | 'spreadsheet' | 'powerpoint' | 'pdf' | 'weblink' | 'video';
export type ResourceCategory = 'training' | 'templates' | 'guides' | 'best_practices' | 'processes' | 'reports';

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  url: string | null;
  file_path: string | null;
  thumbnail_url: string | null;
  category: ResourceCategory;
  tags: string[];
  department_type_id: string | null;
  view_count: number;
  department_types?: { name: string } | null;
}

const RESOURCE_TYPE_CONFIG: Record<ResourceType, { icon: typeof FileText; label: string; className: string }> = {
  google_doc: { icon: FileText, label: 'Google Doc', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  spreadsheet: { icon: Table2, label: 'Spreadsheet', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  powerpoint: { icon: Presentation, label: 'Presentation', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  pdf: { icon: FileType, label: 'PDF', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  weblink: { icon: Globe, label: 'Web Link', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  video: { icon: Video, label: 'Video', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
};

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  training: 'Training',
  templates: 'Templates',
  guides: 'Guides',
  best_practices: 'Best Practices',
  processes: 'Processes',
  reports: 'Reports',
};

interface ResourceCardProps {
  resource: Resource;
  onView: (resource: Resource) => void;
  onEdit?: (resource: Resource) => void;
  canEdit?: boolean;
}

export const ResourceCard = ({ resource, onView, onEdit, canEdit }: ResourceCardProps) => {
  const typeConfig = RESOURCE_TYPE_CONFIG[resource.resource_type];
  const TypeIcon = typeConfig.icon;
  const thumbnailSrc = getThumbnailSrc(resource.thumbnail_url);

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-primary/30">
      {/* Thumbnail area */}
      <div className="relative h-40 bg-gradient-to-br from-muted/50 to-muted overflow-hidden">
        {thumbnailSrc ? (
          <img 
            src={thumbnailSrc} 
            alt={resource.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        {/* Type badge overlay */}
        <Badge className={cn("absolute top-3 left-3", typeConfig.className)}>
          <TypeIcon className="h-3 w-3 mr-1" />
          {typeConfig.label}
        </Badge>
        {/* Edit button for super admins */}
        {canEdit && onEdit && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(resource);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Department & Category tags */}
        <div className="flex flex-wrap gap-1.5">
          {resource.department_types?.name && (
            <Badge variant="outline" className="text-xs">
              {resource.department_types.name}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {CATEGORY_LABELS[resource.category]}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {resource.title}
        </h3>

        {/* Description */}
        {resource.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {resource.description}
          </p>
        )}

        {/* Tags */}
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {resource.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {resource.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{resource.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            {resource.view_count} views
          </div>
          <Button size="sm" onClick={() => onView(resource)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
