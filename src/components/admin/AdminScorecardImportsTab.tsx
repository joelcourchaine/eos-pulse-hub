import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScorecardImportProfilesPanel } from "./ScorecardImportProfilesPanel";
import { ScorecardColumnMappingsPanel } from "./ScorecardColumnMappingsPanel";
import { ScorecardUserAliasesPanel } from "./ScorecardUserAliasesPanel";
import { ScorecardImportLogsPanel } from "./ScorecardImportLogsPanel";
import { Upload, Settings, Users, History } from "lucide-react";

export const AdminScorecardImportsTab = () => {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Scorecard Import Configuration
        </CardTitle>
        <CardDescription>
          Configure how DMS reports are parsed and matched to KPIs and users
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="profiles" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profiles" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Import Profiles
            </TabsTrigger>
            <TabsTrigger value="mappings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Column Mappings
            </TabsTrigger>
            <TabsTrigger value="aliases" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Aliases
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Import Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profiles">
            <ScorecardImportProfilesPanel
              selectedProfileId={selectedProfileId}
              onSelectProfile={setSelectedProfileId}
            />
          </TabsContent>

          <TabsContent value="mappings">
            <ScorecardColumnMappingsPanel
              selectedProfileId={selectedProfileId}
              onSelectProfile={setSelectedProfileId}
            />
          </TabsContent>

          <TabsContent value="aliases">
            <ScorecardUserAliasesPanel
              selectedStoreId={selectedStoreId}
              onSelectStore={setSelectedStoreId}
            />
          </TabsContent>

          <TabsContent value="logs">
            <ScorecardImportLogsPanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
