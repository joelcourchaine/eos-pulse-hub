import { ResourceCard, Resource } from "./ResourceCard";
import { BookOpen, SearchX } from "lucide-react";

interface ResourceGridProps {
  resources: Resource[];
  isLoading: boolean;
  onViewResource: (resource: Resource) => void;
  searchQuery?: string;
}

export const ResourceGrid = ({ resources, isLoading, onViewResource, searchQuery }: ResourceGridProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card animate-pulse">
            <div className="h-40 bg-muted" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-2/3 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        {searchQuery ? (
          <>
            <SearchX className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">No resources found</h3>
            <p className="text-muted-foreground max-w-md">
              We couldn't find any resources matching "{searchQuery}". Try adjusting your search or filters.
            </p>
          </>
        ) : (
          <>
            <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">No resources yet</h3>
            <p className="text-muted-foreground max-w-md">
              Resources will appear here once they're added. Check back soon!
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {resources.map((resource) => (
        <ResourceCard
          key={resource.id}
          resource={resource}
          onView={onViewResource}
        />
      ))}
    </div>
  );
};
