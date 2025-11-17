import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

type FilterMode = "group" | "brand" | "custom";

export default function Enterprise() {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<FilterMode>("group");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);

  const { data: storeGroups } = useQuery({
    queryKey: ["store_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_groups")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*, store_groups(name), brands(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleBrandSelection = (brandId: string) => {
    setSelectedBrandIds(prev =>
      prev.includes(brandId)
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
    );
  };

  const getFilteredStores = () => {
    if (!stores) return [];
    
    switch (filterMode) {
      case "group":
        if (selectedGroupIds.length === 0) return [];
        return stores.filter(store => 
          store.group_id && selectedGroupIds.includes(store.group_id)
        );
      case "brand":
        if (selectedBrandIds.length === 0) return [];
        return stores.filter(store => 
          store.brand_id && selectedBrandIds.includes(store.brand_id)
        );
      case "custom":
        return stores.filter(store => selectedStoreIds.includes(store.id));
      default:
        return [];
    }
  };

  const filteredStores = getFilteredStores();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Enterprise View</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Filter Stores</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={filterMode}
                onValueChange={(v) => setFilterMode(v as FilterMode)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="group">Group</TabsTrigger>
                  <TabsTrigger value="brand">Brand</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>

                <TabsContent value="group" className="mt-4">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {storeGroups?.map((group) => (
                        <div key={group.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`group-${group.id}`}
                            checked={selectedGroupIds.includes(group.id)}
                            onCheckedChange={() => toggleGroupSelection(group.id)}
                          />
                          <label
                            htmlFor={`group-${group.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {group.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="brand" className="mt-4">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {brands?.map((brand) => (
                        <div key={brand.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`brand-${brand.id}`}
                            checked={selectedBrandIds.includes(brand.id)}
                            onCheckedChange={() => toggleBrandSelection(brand.id)}
                          />
                          <label
                            htmlFor={`brand-${brand.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {brand.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="custom" className="mt-4">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {stores?.map((store) => (
                        <div key={store.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`store-${store.id}`}
                            checked={selectedStoreIds.includes(store.id)}
                            onCheckedChange={() => toggleStoreSelection(store.id)}
                          />
                          <label
                            htmlFor={`store-${store.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {store.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>
                Store Comparison
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredStores.length} stores selected)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredStores.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Select stores to view comparison data
                </div>
              ) : (
                <div className="space-y-4">
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {filteredStores.map((store) => (
                        <div
                          key={store.id}
                          className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold">{store.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {store.location}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              {store.brands?.name && (
                                <div className="text-muted-foreground">
                                  {store.brands.name}
                                </div>
                              )}
                              {store.store_groups?.name && (
                                <div className="text-muted-foreground">
                                  {store.store_groups.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
