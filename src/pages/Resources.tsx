import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResourceSearch } from "@/components/resources/ResourceSearch";
import { ResourceGrid } from "@/components/resources/ResourceGrid";
import { ResourceManagementDialog } from "@/components/resources/ResourceManagementDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import type { Resource, ResourceCategory, ResourceType } from "@/components/resources/ResourceCard";

interface DepartmentType {
  id: string;
  name: string;
}

interface StoreGroup {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
  group_id: string | null;
}

const Resources = () => {
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [departmentTypes, setDepartmentTypes] = useState<DepartmentType[]>([]);
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();
  const [userStoreId, setUserStoreId] = useState<string | null>(null);
  const [userStoreGroupId, setUserStoreGroupId] = useState<string | null>(null);
  const { isSuperAdmin } = useUserRole(userId);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<ResourceType | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Fetch user's profile to get store info
        const { data: profile } = await supabase
          .from("profiles")
          .select("store_id, store_group_id")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setUserStoreId(profile.store_id);
          setUserStoreGroupId(profile.store_group_id);
        }
      }
    };
    
    loadUserData();
    fetchDepartmentTypes();
    fetchStoreGroups();
    fetchStores();
  }, []);

  useEffect(() => {
    fetchResources();
  }, [searchQuery, selectedCategory, selectedDepartment, selectedType]);

  const fetchDepartmentTypes = async () => {
    const { data } = await supabase
      .from("department_types")
      .select("id, name")
      .order("display_order");
    
    if (data) setDepartmentTypes(data);
  };

  const fetchStoreGroups = async () => {
    const { data } = await supabase
      .from("store_groups")
      .select("id, name")
      .order("name");
    
    if (data) setStoreGroups(data);
  };

  const fetchStores = async () => {
    const { data } = await supabase
      .from("stores")
      .select("id, name, group_id")
      .order("name");
    
    if (data) setStores(data);
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("resources")
        .select(`
          id,
          title,
          description,
          resource_type,
          url,
          file_path,
          thumbnail_url,
          category,
          tags,
          department_type_id,
          store_group_id,
          store_id,
          view_count,
          created_by,
          department_types (name),
          store_groups (name)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (selectedCategory) {
        query = query.eq("category", selectedCategory);
      }

      if (selectedDepartment) {
        query = query.eq("department_type_id", selectedDepartment);
      }

      if (selectedType) {
        query = query.eq("resource_type", selectedType);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      let filteredData = (data || []) as Resource[];
      
      // Client-side filtering to include tag matches (Supabase doesn't support ilike on arrays)
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredData = filteredData.filter(resource => 
          resource.title?.toLowerCase().includes(lowerQuery) ||
          resource.description?.toLowerCase().includes(lowerQuery) ||
          resource.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
      }
      
      setResources(filteredData);
    } catch (error) {
      console.error("Error fetching resources:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResource = useCallback(async (resource: Resource) => {
    // Increment view count
    supabase
      .from("resources")
      .update({ view_count: resource.view_count + 1 })
      .eq("id", resource.id)
      .then();

    // Open resource in new tab
    const url = resource.url || resource.file_path;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleEditResource = useCallback((resource: Resource) => {
    setEditingResource(resource);
    setEditDialogOpen(true);
  }, []);

  const handleAddResource = useCallback(() => {
    setEditingResource(null);
    setEditDialogOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">My Resources</h1>
            </div>
          </div>
          {userId && (
            <Button onClick={handleAddResource}>
              <Plus className="h-4 w-4 mr-2" />
              Add Resource
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-8">
        {/* Hero section */}
        <div className="mb-8 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Resource Library
          </h2>
          <p className="text-muted-foreground">
            Find guides, templates, best practices, and training materials to help you succeed. 
            Search by keyword or filter by department and category.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="mb-8">
          <ResourceSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={setSelectedDepartment}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            departmentTypes={departmentTypes}
          />
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-muted-foreground mb-4">
            {resources.length} resource{resources.length !== 1 ? "s" : ""} found
          </p>
        )}

        {/* Resource grid */}
        <ResourceGrid
          resources={resources}
          isLoading={loading}
          onViewResource={handleViewResource}
          onEditResource={handleEditResource}
          canEdit={isSuperAdmin}
          searchQuery={searchQuery}
          currentUserId={userId}
        />
      </main>

      {/* Resource dialog */}
      <ResourceManagementDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        resource={editingResource}
        departmentTypes={departmentTypes}
        storeGroups={storeGroups}
        stores={stores}
        onSuccess={fetchResources}
        userStoreId={userStoreId}
        userStoreGroupId={userStoreGroupId}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
};

export default Resources;
