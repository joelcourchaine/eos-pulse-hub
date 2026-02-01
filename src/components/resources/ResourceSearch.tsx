import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResourceCategory, ResourceType } from "./ResourceCard";

interface DepartmentType {
  id: string;
  name: string;
}

interface ResourceSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: ResourceCategory | null;
  onCategoryChange: (category: ResourceCategory | null) => void;
  selectedDepartment: string | null;
  onDepartmentChange: (departmentId: string | null) => void;
  selectedType: ResourceType | null;
  onTypeChange: (type: ResourceType | null) => void;
  departmentTypes: DepartmentType[];
}

const CATEGORIES: { value: ResourceCategory; label: string }[] = [
  { value: 'training', label: 'Training' },
  { value: 'templates', label: 'Templates' },
  { value: 'guides', label: 'Guides' },
  { value: 'best_practices', label: 'Best Practices' },
  { value: 'processes', label: 'Processes' },
  { value: 'reports', label: 'Reports' },
];

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'google_doc', label: 'Google Docs' },
  { value: 'spreadsheet', label: 'Spreadsheets' },
  { value: 'powerpoint', label: 'Presentations' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'weblink', label: 'Web Links' },
  { value: 'video', label: 'Videos' },
];

export const ResourceSearch = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedDepartment,
  onDepartmentChange,
  selectedType,
  onTypeChange,
  departmentTypes,
}: ResourceSearchProps) => {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, onSearchChange]);

  const hasActiveFilters = selectedCategory || selectedDepartment || selectedType;

  const clearAllFilters = () => {
    onCategoryChange(null);
    onDepartmentChange(null);
    onTypeChange(null);
    setLocalQuery("");
    onSearchChange("");
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for guides, templates, processes..."
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            className="pl-10 pr-10 h-12 text-base"
          />
          {localQuery && (
            <button
              onClick={() => {
                setLocalQuery("");
                onSearchChange("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="lg"
          onClick={() => setShowFilters(!showFilters)}
          className="h-12"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              !
            </Badge>
          )}
        </Button>
      </div>

      {/* Filter panels */}
      {showFilters && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Department filter */}
          <div>
            <h4 className="text-sm font-medium mb-2">Department</h4>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedDepartment === null ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => onDepartmentChange(null)}
              >
                All Departments
              </Badge>
              {departmentTypes.map((dept) => (
                <Badge
                  key={dept.id}
                  variant={selectedDepartment === dept.id ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => onDepartmentChange(dept.id)}
                >
                  {dept.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div>
            <h4 className="text-sm font-medium mb-2">Category</h4>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedCategory === null ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => onCategoryChange(null)}
              >
                All Categories
              </Badge>
              {CATEGORIES.map((cat) => (
                <Badge
                  key={cat.value}
                  variant={selectedCategory === cat.value ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => onCategoryChange(cat.value)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Resource type filter */}
          <div>
            <h4 className="text-sm font-medium mb-2">Resource Type</h4>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedType === null ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => onTypeChange(null)}
              >
                All Types
              </Badge>
              {RESOURCE_TYPES.map((type) => (
                <Badge
                  key={type.value}
                  variant={selectedType === type.value ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => onTypeChange(type.value)}
                >
                  {type.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {/* Active filter chips (shown when filter panel is closed) */}
      {!showFilters && hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {selectedDepartment && (
            <Badge variant="secondary" className="gap-1">
              {departmentTypes.find(d => d.id === selectedDepartment)?.name}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onDepartmentChange(null)} />
            </Badge>
          )}
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1">
              {CATEGORIES.find(c => c.value === selectedCategory)?.label}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onCategoryChange(null)} />
            </Badge>
          )}
          {selectedType && (
            <Badge variant="secondary" className="gap-1">
              {RESOURCE_TYPES.find(t => t.value === selectedType)?.label}
              <X className="h-3 w-3 cursor-pointer" onClick={() => onTypeChange(null)} />
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearAllFilters}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};
