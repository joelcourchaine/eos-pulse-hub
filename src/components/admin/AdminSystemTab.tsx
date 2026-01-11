import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Shield, HardDrive, Plus, Store, AlertCircle } from "lucide-react";

export const AdminSystemTab = () => {
  const systemHealth = [
    { name: "Database", status: "Healthy", icon: Database, color: "text-green-500" },
    { name: "Authentication", status: "Operational", icon: Shield, color: "text-green-500" },
    { name: "Storage", status: "Available", icon: HardDrive, color: "text-green-500" },
  ];

  const quickActions = [
    { label: "Create Store Group", icon: Plus, disabled: true },
    { label: "Add Store", icon: Store, disabled: true },
    { label: "View Error Logs", icon: AlertCircle, disabled: true },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemHealth.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                  <span className="font-medium">{item.name}</span>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                >
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="w-full justify-start"
                disabled={action.disabled}
              >
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
                {action.disabled && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    Coming Soon
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
