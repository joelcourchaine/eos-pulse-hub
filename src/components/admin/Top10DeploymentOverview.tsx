import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2, Store, CheckCircle2, XCircle, LayoutList } from "lucide-react";

interface Column {
  key: string;
  label: string;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  columns: Column[];
  department_type_id: string | null;
  department_type?: { id: string; name: string } | null;
}

interface Top10DeploymentOverviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template;
}

interface DeploymentData {
  groupId: string;
  groupName: string;
  stores: {
    storeId: string;
    storeName: string;
    departments: {
      departmentId: string;
      departmentName: string;
      hasTemplate: boolean;
      listId?: string;
    }[];
  }[];
}

export const Top10DeploymentOverview = ({
  open,
  onOpenChange,
  template,
}: Top10DeploymentOverviewProps) => {
  const { data: deploymentData, isLoading } = useQuery({
    queryKey: ["template-deployment-overview", template.id, template.title],
    queryFn: async () => {
      // Get all store groups with their stores and departments
      const { data: groups, error: groupsError } = await supabase
        .from("store_groups")
        .select("id, name")
        .order("name");
      if (groupsError) throw groupsError;

      // Get all stores with their departments
      let deptQuery = supabase
        .from("departments")
        .select(`
          id,
          name,
          department_type_id,
          store:stores!inner(
            id,
            name,
            group_id
          )
        `);

      // Filter by department type if template has one
      if (template.department_type_id) {
        deptQuery = deptQuery.eq("department_type_id", template.department_type_id);
      }

      const { data: departments, error: deptError } = await deptQuery;
      if (deptError) throw deptError;

      // Get all deployed lists with this template title
      const { data: deployedLists, error: listsError } = await supabase
        .from("top_10_lists")
        .select("id, department_id")
        .eq("title", template.title);
      if (listsError) throw listsError;

      const deployedDeptIds = new Set(deployedLists?.map((l) => l.department_id) || []);
      const listByDeptId = new Map(deployedLists?.map((l) => [l.department_id, l.id]) || []);

      // Build the deployment data structure
      const result: DeploymentData[] = [];

      for (const group of groups || []) {
        const storesInGroup = new Map<string, { storeId: string; storeName: string; departments: any[] }>();

        for (const dept of departments || []) {
          const store = dept.store as unknown as { id: string; name: string; group_id: string };
          if (store.group_id !== group.id) continue;

          if (!storesInGroup.has(store.id)) {
            storesInGroup.set(store.id, {
              storeId: store.id,
              storeName: store.name,
              departments: [],
            });
          }

          storesInGroup.get(store.id)!.departments.push({
            departmentId: dept.id,
            departmentName: dept.name,
            hasTemplate: deployedDeptIds.has(dept.id),
            listId: listByDeptId.get(dept.id),
          });
        }

        if (storesInGroup.size > 0) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            stores: Array.from(storesInGroup.values()).sort((a, b) =>
              a.storeName.localeCompare(b.storeName)
            ),
          });
        }
      }

      return result;
    },
    enabled: open,
  });

  const getGroupStats = (group: DeploymentData) => {
    let total = 0;
    let deployed = 0;
    for (const store of group.stores) {
      for (const dept of store.departments) {
        total++;
        if (dept.hasTemplate) deployed++;
      }
    }
    return { total, deployed };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutList className="h-5 w-5" />
            Deployment Overview
          </DialogTitle>
          <DialogDescription>
            See which stores have "{template.title}" deployed
            {template.department_type?.name && ` to ${template.department_type.name}s`}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !deploymentData || deploymentData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No matching departments found.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {deploymentData.map((group) => {
                const { total, deployed } = getGroupStats(group);
                const allDeployed = deployed === total;

                return (
                  <AccordionItem
                    key={group.groupId}
                    value={group.groupId}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{group.groupName}</span>
                        <Badge
                          variant={allDeployed ? "default" : "secondary"}
                          className="ml-auto mr-2"
                        >
                          {deployed}/{total} deployed
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {group.stores.map((store) => (
                          <div key={store.storeId} className="border rounded-md p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Store className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">{store.storeName}</span>
                            </div>
                            <div className="space-y-1 ml-6">
                              {store.departments.map((dept) => (
                                <div
                                  key={dept.departmentId}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  {dept.hasTemplate ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <span
                                    className={
                                      dept.hasTemplate ? "" : "text-muted-foreground"
                                    }
                                  >
                                    {dept.departmentName}
                                  </span>
                                  {dept.hasTemplate && (
                                    <Badge variant="outline" className="ml-auto text-xs">
                                      Deployed
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
