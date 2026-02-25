import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface TeamMember {
  id: string;
  store_id: string;
  name: string;
  position: string;
  position_secondary: string | null;
  reports_to: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TreeNode {
  member: TeamMember;
  children: TreeNode[];
}

const POSITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  service_manager: { bg: "hsl(215 60% 25%)", text: "hsl(0 0% 100%)", border: "hsl(215 60% 35%)" },
  foreman: { bg: "hsl(174 84% 32%)", text: "hsl(0 0% 100%)", border: "hsl(174 84% 42%)" },
  dispatcher: { bg: "hsl(170 77% 59%)", text: "hsl(215 25% 15%)", border: "hsl(170 77% 49%)" },
  advisor: { bg: "hsl(142 71% 45%)", text: "hsl(0 0% 100%)", border: "hsl(142 71% 55%)" },
  junior_advisor: { bg: "hsl(142 55% 62%)", text: "hsl(215 25% 15%)", border: "hsl(142 55% 52%)" },
  internal_advisor: { bg: "hsl(160 50% 45%)", text: "hsl(0 0% 100%)", border: "hsl(160 50% 55%)" },
  technician: { bg: "hsl(25 95% 53%)", text: "hsl(0 0% 100%)", border: "hsl(25 95% 63%)" },
  porter: { bg: "hsl(220 9% 64%)", text: "hsl(0 0% 100%)", border: "hsl(220 9% 74%)" },
  warranty_admin: { bg: "hsl(271 81% 56%)", text: "hsl(0 0% 100%)", border: "hsl(271 81% 66%)" },
  detailer: { bg: "hsl(48 96% 53%)", text: "hsl(215 25% 15%)", border: "hsl(48 96% 43%)" },
  administrative: { bg: "hsl(215 14% 50%)", text: "hsl(0 0% 100%)", border: "hsl(215 14% 60%)" },
  cashier: { bg: "hsl(340 65% 55%)", text: "hsl(0 0% 100%)", border: "hsl(340 65% 65%)" },
  detail_manager: { bg: "hsl(35 80% 42%)", text: "hsl(0 0% 100%)", border: "hsl(35 80% 52%)" },
};

const POSITION_LABELS: Record<string, string> = {
  service_manager: "Service Manager",
  foreman: "Foreman / Shop Foreman",
  dispatcher: "Dispatcher",
  advisor: "Advisor",
  junior_advisor: "Junior Advisor",
  internal_advisor: "Internal Advisor",
  technician: "Technician",
  porter: "Porter",
  warranty_admin: "Warranty Admin",
  detailer: "Detailer",
  administrative: "Administrative",
  cashier: "Cashier",
  detail_manager: "Detail Manager",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildTree(members: TeamMember[]): TreeNode[] {
  const memberMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  members.forEach((m) => {
    memberMap.set(m.id, { member: m, children: [] });
  });

  members.forEach((m) => {
    const node = memberMap.get(m.id)!;
    if (m.reports_to && memberMap.has(m.reports_to)) {
      memberMap.get(m.reports_to)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function getDirectReportCount(node: TreeNode): number {
  return node.children.length;
}

function getSpanWarning(count: number): { color: string; message: string | null } {
  if (count >= 10) return { color: "hsl(0 84% 60%)", message: "Span of control exceeds recommended leadership capacity." };
  if (count >= 7) return { color: "hsl(38 92% 50%)", message: null };
  return { color: "transparent", message: null };
}

interface PositionedNode {
  node: TreeNode;
  x: number;
}

function sortChildren(node: TreeNode) {
  node.children.sort((a, b) => {
    const posCmp = a.member.position.localeCompare(b.member.position);
    if (posCmp !== 0) return posCmp;
    return a.member.name.localeCompare(b.member.name);
  });
  node.children.forEach(sortChildren);
}

// Leaf nodes get a much smaller slot to keep widths compact
const LEAF_SLOT_WIDTH = 48;
const NODE_SLOT_WIDTH = 130;

function getSubtreeLeafWidth(node: TreeNode): number {
  if (node.children.length === 0) return LEAF_SLOT_WIDTH;
  return node.children.reduce((sum, child) => sum + getSubtreeLeafWidth(child), 0);
}

function layoutTree(roots: TreeNode[]): { levels: PositionedNode[][]; totalWidth: number } {
  roots.forEach(sortChildren);

  const posMap = new Map<TreeNode, number>();

  const layoutSubtree = (node: TreeNode, startX: number): number => {
    const width = getSubtreeLeafWidth(node);
    if (node.children.length === 0) {
      posMap.set(node, startX + LEAF_SLOT_WIDTH / 2);
      return LEAF_SLOT_WIDTH;
    }

    let offset = startX;
    node.children.forEach((child) => {
      offset += layoutSubtree(child, offset);
    });

    const firstChildX = posMap.get(node.children[0])!;
    const lastChildX = posMap.get(node.children[node.children.length - 1])!;
    posMap.set(node, (firstChildX + lastChildX) / 2);

    return width;
  };

  let totalOffset = 0;
  roots.forEach((root) => {
    totalOffset += layoutSubtree(root, totalOffset);
  });

  const bfsLevels: TreeNode[][] = [];
  let currentNodes = roots;
  while (currentNodes.length > 0) {
    bfsLevels.push(currentNodes);
    const next: TreeNode[] = [];
    currentNodes.forEach((n) => next.push(...n.children));
    currentNodes = next;
  }
  bfsLevels.reverse();

  let totalWidth = 0;
  const levels: PositionedNode[][] = bfsLevels.map((level) =>
    level.map((node) => {
      const x = posMap.get(node)!;
      if (x + 1 > totalWidth) totalWidth = x + 1;
      return { node, x };
    })
  );

  return { levels, totalWidth: totalOffset };
}

interface OrgNodeProps {
  node: TreeNode;
  showNames: boolean;
  headcountOnly: boolean;
  onSelect: (member: TeamMember) => void;
}

const OrgNode = ({ node, showNames, headcountOnly, onSelect }: OrgNodeProps) => {
  const isLeaf = node.children.length === 0;
  const primaryColors = POSITION_COLORS[node.member.position] || POSITION_COLORS.porter;
  const secondaryColors = node.member.position_secondary ? (POSITION_COLORS[node.member.position_secondary] || null) : null;
  const directReports = getDirectReportCount(node);
  const spanWarning = getSpanWarning(directReports);
  const isVacant = node.member.status === "vacant";
  const isDual = !!secondaryColors;

  const bgStyle = isDual
    ? `linear-gradient(135deg, ${primaryColors.bg} 50%, ${secondaryColors!.bg} 50%)`
    : primaryColors.bg;

  // Compact pill for leaf nodes
  if (isLeaf && !headcountOnly) {
    const initials = getInitials(node.member.name);
    const firstName = node.member.name.split(" ")[0].slice(0, 8);
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-110 hover:shadow-md select-none"
              style={{
                background: bgStyle,
                color: primaryColors.text,
                width: 36,
                height: 36,
                fontSize: 11,
                fontWeight: 700,
                border: isVacant ? `2px dashed ${primaryColors.border}` : `1px solid ${primaryColors.border}`,
                opacity: isVacant ? 0.7 : 1,
                flexShrink: 0,
              }}
              onClick={() => onSelect(node.member)}
            >
              {showNames ? (
                <span style={{ fontSize: 9, fontWeight: 600, whiteSpace: "nowrap", padding: "0 4px" }}>{firstName}</span>
              ) : (
                initials
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-semibold">{node.member.name}</p>
            <p className="opacity-75">{POSITION_LABELS[node.member.position] || node.member.position}</p>
            {isVacant && <p className="italic opacity-60">Vacant</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (headcountOnly) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg font-medium cursor-pointer transition-transform hover:scale-105"
        style={{
          background: bgStyle,
          color: primaryColors.text,
          minWidth: 70,
          padding: "8px 12px",
          fontSize: 12,
        }}
        onClick={() => onSelect(node.member)}
      >
        <span>{POSITION_LABELS[node.member.position] || node.member.position}</span>
        {isDual && (
          <span className="opacity-80" style={{ fontSize: 9 }}>
            / {POSITION_LABELS[node.member.position_secondary!] || node.member.position_secondary}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg font-medium cursor-pointer transition-all hover:scale-105 hover:shadow-md"
      style={{
        background: bgStyle,
        color: primaryColors.text,
        borderWidth: isVacant ? 2 : spanWarning.color !== "transparent" ? 3 : 1,
        borderStyle: isVacant ? "dashed" : "solid",
        borderColor: isVacant ? primaryColors.border : spanWarning.color !== "transparent" ? spanWarning.color : primaryColors.border,
        minWidth: 110,
        padding: "10px 14px",
        boxShadow: spanWarning.color !== "transparent" ? `0 0 8px ${spanWarning.color}` : undefined,
      }}
      onClick={() => onSelect(node.member)}
    >
      {showNames && (
        <span className="font-semibold truncate" style={{ fontSize: 13, maxWidth: 130 }}>
          {node.member.name}
        </span>
      )}
      <span className="opacity-80 mt-0.5" style={{ fontSize: 10 }}>
        {POSITION_LABELS[node.member.position] || node.member.position}
        {isDual && ` / ${POSITION_LABELS[node.member.position_secondary!] || node.member.position_secondary}`}
      </span>
      {isVacant && <span className="opacity-70 italic mt-0.5" style={{ fontSize: 9 }}>Vacant</span>}
      {spanWarning.message && (
        <span className="mt-1 text-center leading-tight" style={{ fontSize: 9, color: spanWarning.color === "hsl(0 84% 60%)" ? "hsl(0 0% 100%)" : primaryColors.text }}>
          ⚠ {directReports} reports
        </span>
      )}
    </div>
  );
};

interface ReverseOrgChartProps {
  members: TeamMember[];
  onSelectMember: (member: TeamMember) => void;
}

export const ReverseOrgChart = ({ members, onSelectMember }: ReverseOrgChartProps) => {
  const [zoom, setZoom] = useState(1);
  const [showNames, setShowNames] = useState(true);
  const [headcountOnly, setHeadcountOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
  const autoZoomSet = useRef(false);

  const tree = useMemo(() => buildTree(members), [members]);
  const layout = useMemo(() => layoutTree(tree), [tree]);

  // Span of control warnings
  const warnings = useMemo(() => {
    const msgs: string[] = [];
    function check(nodes: TreeNode[]) {
      nodes.forEach((n) => {
        const count = getDirectReportCount(n);
        if (count >= 10) {
          msgs.push(`${n.member.name} has ${count} direct reports — span of control exceeds recommended leadership capacity.`);
        }
        check(n.children);
      });
    }
    check(tree);
    return msgs;
  }, [tree]);

  const setNodeRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  }, []);

  // Auto-fit zoom on mount
  useEffect(() => {
    if (autoZoomSet.current) return;
    const timer = setTimeout(() => {
      if (!containerRef.current || !chartRef.current) return;
      const containerWidth = containerRef.current.offsetWidth - 64; // padding
      const chartWidth = layout.totalWidth;
      if (chartWidth <= 0) return;
      const fitZoom = Math.min(1, containerWidth / chartWidth);
      const clamped = Math.max(0.2, fitZoom);
      setZoom(clamped);
      autoZoomSet.current = true;
    }, 150);
    return () => clearTimeout(timer);
  }, [layout.totalWidth]);

  // Calculate lines after render
  useEffect(() => {
    const calcLines = () => {
      if (!chartRef.current) return;
      const chartRect = chartRef.current.getBoundingClientRect();
      const newLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

      members.forEach((m) => {
        if (m.reports_to) {
          const childEl = nodeRefs.current.get(m.id);
          const parentEl = nodeRefs.current.get(m.reports_to);
          if (childEl && parentEl) {
            const cRect = childEl.getBoundingClientRect();
            const pRect = parentEl.getBoundingClientRect();
            newLines.push({
              x1: pRect.left + pRect.width / 2 - chartRect.left,
              y1: pRect.top - chartRect.top,
              x2: cRect.left + cRect.width / 2 - chartRect.left,
              y2: cRect.bottom - chartRect.top,
            });
          }
        }
      });
      setLines(newLines);
    };

    const timer = setTimeout(calcLines, 120);
    return () => clearTimeout(timer);
  }, [members, zoom, showNames, headcountOnly]);

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No team members yet. Add your first team member to build the org chart.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.15, z - 0.1))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { autoZoomSet.current = false; setZoom(1); }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="show-names" checked={showNames} onCheckedChange={setShowNames} />
          <Label htmlFor="show-names" className="text-xs">Show Names</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="headcount-only" checked={headcountOnly} onCheckedChange={setHeadcountOnly} />
          <Label htmlFor="headcount-only" className="text-xs">Headcount Only</Label>
        </div>

        <span className="text-xs text-muted-foreground">Tip: hover over small circles to see names</span>
      </div>

      {/* Warnings */}
      {warnings.map((w, i) => (
        <div key={i} className="bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 text-sm text-destructive">
          ⚠ {w}
        </div>
      ))}

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(POSITION_LABELS).map(([key, label]) => {
          const c = POSITION_COLORS[key];
          return (
            <Badge key={key} variant="outline" className="text-[10px] gap-1 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c.bg }} />
              {label}
            </Badge>
          );
        })}
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="overflow-auto border rounded-lg bg-background">
        <div
          ref={chartRef}
          className="relative p-8"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center", minWidth: layout.totalWidth }}
        >
          {/* SVG lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {lines.map((l, i) => (
              <line
                key={i}
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="hsl(var(--border))"
                strokeWidth={1.5}
              />
            ))}
          </svg>

          {/* Levels rendered top (leaves) to bottom (root) */}
          <div className="flex flex-col items-center gap-5 relative" style={{ zIndex: 1 }}>
            {layout.levels.map((level, li) => {
              if (headcountOnly) {
                const grouped: Record<string, PositionedNode[]> = {};
                level.forEach((pn) => {
                  const pos = pn.node.member.position;
                  if (!grouped[pos]) grouped[pos] = [];
                  grouped[pos].push(pn);
                });

                return (
                  <div key={li} className="flex flex-wrap justify-center gap-3">
                    {Object.entries(grouped).map(([pos, nodes]) => {
                      const colors = POSITION_COLORS[pos] || POSITION_COLORS.porter;
                      return (
                        <div
                          key={pos}
                          className="flex flex-col items-center justify-center rounded-lg font-medium"
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            minWidth: 80,
                            padding: "8px 16px",
                          }}
                        >
                          <span className="font-bold" style={{ fontSize: 18 }}>{nodes.length}</span>
                          <span className="opacity-80" style={{ fontSize: 10 }}>{POSITION_LABELS[pos] || pos}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Is this the leaf level? (all nodes in this level have no children)
              const isLeafLevel = level.every((pn) => pn.node.children.length === 0);

              return (
                <div
                  key={li}
                  className="relative"
                  style={{ width: layout.totalWidth, height: isLeafLevel ? 40 : 62 }}
                >
                  {level.map((pn) => (
                    <div
                      key={pn.node.member.id}
                      ref={(el) => setNodeRef(pn.node.member.id, el)}
                      className="absolute"
                      style={{
                        left: pn.x,
                        top: 0,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <OrgNode
                        node={pn.node}
                        showNames={showNames}
                        headcountOnly={headcountOnly}
                        onSelect={onSelectMember}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
