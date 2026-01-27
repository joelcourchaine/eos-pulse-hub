import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  LayoutDashboard,
  Calendar,
  Target,
  Megaphone,
  FileSignature,
  Ticket,
  Building2,
  GitCompare,
  FileSpreadsheet,
} from "lucide-react";

export const AdminNavDropdown = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      label: "Dashboard",
      items: [
        { name: "Admin Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
      ],
    },
    {
      label: "Content",
      items: [
        { name: "Announcements", icon: Megaphone, path: "/admin/announcements" },
        { name: "Signatures", icon: FileSignature, path: "/admin/signatures" },
      ],
    },
    {
      label: "Configuration",
      items: [
        { name: "KPI Rules", icon: Target, path: "/admin/kpi-rules" },
        { name: "Scorecard Mapper", icon: FileSpreadsheet, path: "/admin/scorecard-mapper" },
      ],
    },
    {
      label: "Support",
      items: [
        { name: "Support Tickets", icon: Ticket, path: "/admin/tickets" },
      ],
    },
    {
      label: "Reporting",
      items: [
        { name: "Enterprise", icon: Building2, path: "/enterprise" },
        { name: "Dealer Comparison", icon: GitCompare, path: "/dealer-comparison" },
      ],
    },
    {
      label: "Services",
      items: [
        { name: "Consulting Scheduler", icon: Calendar, path: "/admin/consulting" },
      ],
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Admin</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        {menuItems.map((section, sectionIndex) => (
          <div key={section.label}>
            {sectionIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {section.label}
            </DropdownMenuLabel>
            {section.items.map((item) => (
              <DropdownMenuItem
                key={item.path}
                onClick={() => navigate(item.path)}
                className="cursor-pointer"
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.name}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
