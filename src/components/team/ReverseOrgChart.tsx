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

interface LeafCluster {
  id: string;
  parentId: string;
  position: string;
  members: TeamMember[];
}

const POSITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  service_director: { bg: "hsl(230 55% 28%)", text: "hsl(0 0% 100%)", border: "hsl(230 55% 38%)" },
  fixed_ops_manager: { bg: "hsl(200 60% 33%)", text: "hsl(0 0% 100%)", border: "hsl(200 60% 43%)" },
  service_manager: { bg: "hsl(215 60% 25%)", text: "hsl(0 0% 100%)", border: "hsl(215 60% 35%)" },
  foreman: { bg: "hsl(174 84% 32%)", text: "hsl(0 0% 100%)", border: "hsl(174 84% 42%)" },
  dispatcher: { bg: "hsl(170 77% 59%)", text: "hsl(215 25% 15%)", border: "hsl(170 77% 49%)" },
  advisor: { bg: "hsl(142 71% 45%)", text: "hsl(0 0% 100%)", border: "hsl(142 71% 55%)" },
  junior_advisor: { bg: "hsl(142 55% 62%)", text: "hsl(215 25% 15%)", border: "hsl(142 55% 52%)" },
  internal_advisor: { bg: "hsl(160 50% 45%)", text: "hsl(0 0% 100%)", border: "hsl(160 50% 55%)" },
  bdc_coordinator: { bg: "hsl(290 50% 48%)", text: "hsl(0 0% 100%)", border: "hsl(290 50% 58%)" },
  technician: { bg: "hsl(25 95% 53%)", text: "hsl(0 0% 100%)", border: "hsl(25 95% 63%)" },
  red_seal_technician: { bg: "hsl(22 90% 42%)", text: "hsl(0 0% 100%)", border: "hsl(22 90% 52%)" },
  lube_technician: { bg: "hsl(32 75% 55%)", text: "hsl(0 0% 100%)", border: "hsl(32 75% 65%)" },
  apprentice_1: { bg: "hsl(45 96% 58%)", text: "hsl(30 40% 15%)", border: "hsl(45 96% 48%)" },
  apprentice_2: { bg: "hsl(42 92% 52%)", text: "hsl(30 40% 15%)", border: "hsl(42 92% 42%)" },
  apprentice_3: { bg: "hsl(38 88% 46%)", text: "hsl(0 0% 100%)", border: "hsl(38 88% 36%)" },
  apprentice_4: { bg: "hsl(34 85% 40%)", text: "hsl(0 0% 100%)", border: "hsl(34 85% 30%)" },
  porter: { bg: "hsl(220 9% 64%)", text: "hsl(0 0% 100%)", border: "hsl(220 9% 74%)" },
  warranty_admin: { bg: "hsl(271 81% 56%)", text: "hsl(0 0% 100%)", border: "hsl(271 81% 66%)" },
  detailer: { bg: "hsl(48 96% 53%)", text: "hsl(215 25% 15%)", border: "hsl(48 96% 43%)" },
  administrative: { bg: "hsl(215 14% 50%)", text: "hsl(0 0% 100%)", border: "hsl(215 14% 60%)" },
  cashier: { bg: "hsl(340 65% 55%)", text: "hsl(0 0% 100%)", border: "hsl(340 65% 65%)" },
  detail_manager: { bg: "hsl(35 80% 42%)", text: "hsl(0 0% 100%)", border: "hsl(35 80% 52%)" },
};

const POSITION_LABELS: Record<string, string> = {
  service_director: "Service Director",
  fixed_ops_manager: "Fixed Ops Manager",
  service_manager: "Service Manager",
  foreman: "Foreman / Shop Foreman",
  dispatcher: "Dispatcher",
  advisor: "Advisor",
  junior_advisor: "Junior Advisor",
  internal_advisor: "Internal Advisor",
  bdc_coordinator: "BDC Coordinator",
  technician: "Technician",
  red_seal_technician: "Red Seal Technician",
  lube_technician: "Lube Technician",
  apprentice_1: "1st Year Apprentice",
  apprentice_2: "2nd Year Apprentice",
  apprentice_3: "3rd Year Apprentice",
  apprentice_4: "4th Year Apprentice",
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
  members.forEach((m) => memberMap.set(m.id, { member: m, children: [] }));
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

function buildClusterMap(roots: TreeNode[]): Map<string, LeafCluster> {
  const clusters = new Map<string, LeafCluster>();

  function walk(node: TreeNode) {
    // Group leaf children by position
    const leafByPos: Record<string, TreeNode[]> = {};
    node.children.forEach((child) => {
      if (child.children.length === 0) {
        if (!leafByPos[child.member.position]) leafByPos[child.member.position] = [];
        leafByPos[child.member.position].push(child);
      } else {
        walk(child);
      }
    });

    Object.entries(leafByPos).forEach(([pos, group]) => {
      if (group.length >= 2) {
        const id = `cluster_${node.member.id}_${pos}`;
        clusters.set(id, {
          id,
          parentId: node.member.id,
          position: pos,
          members: group.map((n) => n.member),
        });
      }
    });
  }

  roots.forEach(walk);
  return clusters;
}

// Which cluster (if any) does a member belong to?
function buildMemberClusterIndex(clusters: Map<string, LeafCluster>): Map<string, string> {
  const index = new Map<string, string>();
  clusters.forEach((c) => c.members.forEach((m) => index.set(m.id, c.id)));
  return index;
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

interface PositionedCluster {
  cluster: LeafCluster;
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

const LEAF_SLOT_WIDTH = 48;
const CLUSTER_SLOT_WIDTH = 160;
const SLOT_GAP = 12;

function getSubtreeLeafWidth(node: TreeNode, clusterMap: Map<string, LeafCluster>): number {
  if (node.children.length === 0) {
    return LEAF_SLOT_WIDTH;
  }

  const leafByPos: Record<string, TreeNode[]> = {};
  const nonLeafChildren: TreeNode[] = [];

  node.children.forEach((child) => {
    if (child.children.length === 0) {
      if (!leafByPos[child.member.position]) leafByPos[child.member.position] = [];
      leafByPos[child.member.position].push(child);
    } else {
      nonLeafChildren.push(child);
    }
  });

  let total = 0;
  const posGroups = Object.values(leafByPos);
  posGroups.forEach((group) => {
    total += (group.length >= 2 ? CLUSTER_SLOT_WIDTH : group.length * LEAF_SLOT_WIDTH) + SLOT_GAP;
  });
  nonLeafChildren.forEach((child) => {
    total += getSubtreeLeafWidth(child, clusterMap) + SLOT_GAP;
  });
  // Remove the trailing gap from the last slot
  if (posGroups.length + nonLeafChildren.length > 0) total -= SLOT_GAP;
  return total;
}

function layoutTree(roots: TreeNode[], clusterMap: Map<string, LeafCluster>): {
  levels: PositionedNode[][];
  clusterLevelMap: Map<number, PositionedCluster[]>;
  totalWidth: number;
} {
  roots.forEach(sortChildren);

  const posMap = new Map<TreeNode, number>();
  // clusterPos maps cluster id → x
  const clusterPos = new Map<string, number>();

  const layoutSubtree = (node: TreeNode, startX: number): number => {
    const leafByPos: Record<string, TreeNode[]> = {};
    const nonLeafChildren: TreeNode[] = [];

    node.children.forEach((child) => {
      if (child.children.length === 0) {
        if (!leafByPos[child.member.position]) leafByPos[child.member.position] = [];
        leafByPos[child.member.position].push(child);
      } else {
        nonLeafChildren.push(child);
      }
    });

    if (node.children.length === 0) {
      posMap.set(node, startX + LEAF_SLOT_WIDTH / 2);
      return LEAF_SLOT_WIDTH;
    }

    let offset = startX;

    // Layout clusters first (sorted by position key for consistency)
    const sortedPosKeys = Object.keys(leafByPos).sort();
    const allSlotCount = sortedPosKeys.length + nonLeafChildren.length;
    let slotIndex = 0;

    sortedPosKeys.forEach((pos) => {
      const group = leafByPos[pos];
      if (group.length >= 2) {
        const clusterId = `cluster_${node.member.id}_${pos}`;
        clusterPos.set(clusterId, offset + CLUSTER_SLOT_WIDTH / 2);
        offset += CLUSTER_SLOT_WIDTH;
      } else {
        // single leaf — individual slot
        group.forEach((child) => {
          posMap.set(child, offset + LEAF_SLOT_WIDTH / 2);
          offset += LEAF_SLOT_WIDTH;
        });
      }
      slotIndex++;
      if (slotIndex < allSlotCount) offset += SLOT_GAP;
    });

    // Layout non-leaf children
    nonLeafChildren.forEach((child) => {
      const w = layoutSubtree(child, offset);
      offset += w;
      slotIndex++;
      if (slotIndex < allSlotCount) offset += SLOT_GAP;
    });

    // Center the parent over ALL children (clusters + non-leaf)
    const allXPositions: number[] = [];

    sortedPosKeys.forEach((pos) => {
      const group = leafByPos[pos];
      if (group.length >= 2) {
        const clusterId = `cluster_${node.member.id}_${pos}`;
        allXPositions.push(clusterPos.get(clusterId)!);
      } else {
        group.forEach((child) => allXPositions.push(posMap.get(child)!));
      }
    });
    nonLeafChildren.forEach((child) => {
      if (posMap.has(child)) allXPositions.push(posMap.get(child)!);
    });

    const minX = Math.min(...allXPositions);
    const maxX = Math.max(...allXPositions);
    posMap.set(node, (minX + maxX) / 2);

    return offset - startX;
  };

  let totalOffset = 0;
  roots.forEach((root) => {
    totalOffset += layoutSubtree(root, totalOffset);
  });

  // BFS levels
  const bfsLevels: TreeNode[][] = [];
  let currentNodes = roots;
  while (currentNodes.length > 0) {
    bfsLevels.push(currentNodes);
    const next: TreeNode[] = [];
    currentNodes.forEach((n) => next.push(...n.children));
    currentNodes = next;
  }
  bfsLevels.reverse();

  // Build cluster level map: which BFS level do clusters appear at?
  // Clusters appear at level 0 (leaf level = reversed index 0)
  // We need to figure out which reversed level clusters belong to.
  // Clusters belong to the level of their members (leaves = bfsLevels[0] before reverse = last level)
  // After reverse, level index 0 = leaves.
  const memberToLevelIndex = new Map<string, number>();
  bfsLevels.forEach((level, li) => {
    level.forEach((node) => memberToLevelIndex.set(node.member.id, li));
  });

  const clusterLevelMap = new Map<number, PositionedCluster[]>();
  clusterMap.forEach((cluster) => {
    const x = clusterPos.get(cluster.id);
    if (x === undefined) return;
    // The level is the same as the leaf members' level
    const li = memberToLevelIndex.get(cluster.members[0].id);
    if (li === undefined) return;
    if (!clusterLevelMap.has(li)) clusterLevelMap.set(li, []);
    clusterLevelMap.get(li)!.push({ cluster, x });
  });

  const levels: PositionedNode[][] = bfsLevels.map((level) =>
    level
      .filter((node) => posMap.has(node)) // skip clustered leaf nodes
      .map((node) => ({ node, x: posMap.get(node)! }))
  );

  return { levels, clusterLevelMap, totalWidth: totalOffset };
}

// ── LeafPill ────────────────────────────────────────────────────────────────

interface LeafPillProps {
  member: TeamMember;
  showNames: boolean;
  onSelect: (member: TeamMember) => void;
  size?: number;
}

const LeafPill = ({ member, showNames, onSelect, size = 36 }: LeafPillProps) => {
  const primaryColors = POSITION_COLORS[member.position] || POSITION_COLORS.porter;
  const secondaryColors = member.position_secondary ? (POSITION_COLORS[member.position_secondary] || null) : null;
  const isDual = !!secondaryColors;
  const isVacant = member.status === "vacant";
  const initials = getInitials(member.name);
  const firstName = member.name.split(" ")[0].slice(0, 8);

  const bgStyle = isDual
    ? `linear-gradient(135deg, ${primaryColors.bg} 50%, ${secondaryColors!.bg} 50%)`
    : primaryColors.bg;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-110 hover:shadow-md select-none flex-shrink-0"
          style={{
            background: bgStyle,
            color: primaryColors.text,
            width: size,
            height: size,
            fontSize: 11,
            fontWeight: 700,
            border: isVacant ? `2px dashed ${primaryColors.border}` : `1px solid ${primaryColors.border}`,
            opacity: isVacant ? 0.7 : 1,
          }}
          onClick={() => onSelect(member)}
        >
          {showNames ? (
            <span style={{ fontSize: 9, fontWeight: 600, whiteSpace: "nowrap", padding: "0 4px" }}>{firstName}</span>
          ) : (
            initials
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs" sideOffset={8}>
        <p className="font-semibold">{member.name}</p>
        <p className="opacity-75">{POSITION_LABELS[member.position] || member.position}</p>
        {isVacant && <p className="italic opacity-60">Vacant</p>}
      </TooltipContent>
    </Tooltip>
  );
};

// ── BalloonCluster ───────────────────────────────────────────────────────────

interface BalloonClusterProps {
  cluster: LeafCluster;
  showNames: boolean;
  onSelect: (member: TeamMember) => void;
  divRef: (el: HTMLDivElement | null) => void;
}

const BalloonCluster = ({ cluster, showNames, onSelect, divRef }: BalloonClusterProps) => {
  const colors = POSITION_COLORS[cluster.position] || POSITION_COLORS.porter;
  const maxPerRow = 4;
  const pillSize = 34;

  return (
    <div
      ref={divRef}
      style={{
        border: `1.5px dashed ${colors.border}`,
        borderRadius: 12,
        padding: "5px 7px",
        display: "flex",
        flexWrap: "wrap",
        gap: 3,
        justifyContent: "center",
        width: CLUSTER_SLOT_WIDTH - 10,
        background: "transparent",
      }}
    >
      {cluster.members.map((member) => (
        <LeafPill key={member.id} member={member} showNames={showNames} onSelect={onSelect} size={pillSize} />
      ))}
    </div>
  );
};

// ── OrgNode ──────────────────────────────────────────────────────────────────

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

  if (isLeaf && !headcountOnly) {
    return <LeafPill member={node.member} showNames={showNames} onSelect={onSelect} />;
  }

  if (headcountOnly) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg font-medium cursor-pointer transition-transform hover:scale-105"
        style={{ background: bgStyle, color: primaryColors.text, minWidth: 70, padding: "8px 12px", fontSize: 12 }}
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

// ── ReverseOrgChart ──────────────────────────────────────────────────────────

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
  const clusterMap = useMemo(() => buildClusterMap(tree), [tree]);
  const memberClusterIndex = useMemo(() => buildMemberClusterIndex(clusterMap), [clusterMap]);
  const layout = useMemo(() => layoutTree(tree, clusterMap), [tree, clusterMap]);

  const warnings = useMemo(() => {
    const msgs: string[] = [];
    function check(nodes: TreeNode[]) {
      nodes.forEach((n) => {
        const count = getDirectReportCount(n);
        if (count >= 10) msgs.push(`${n.member.name} has ${count} direct reports — span of control exceeds recommended leadership capacity.`);
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
      const containerWidth = containerRef.current.offsetWidth - 64;
      const chartWidth = layout.totalWidth;
      if (chartWidth <= 0) return;
      const fitZoom = Math.min(1, containerWidth / chartWidth);
      setZoom(Math.max(0.2, fitZoom));
      autoZoomSet.current = true;
    }, 150);
    return () => clearTimeout(timer);
  }, [layout.totalWidth]);

  // Calculate SVG lines
  useEffect(() => {
    const calcLines = () => {
      if (!chartRef.current) return;
      const chartRect = chartRef.current.getBoundingClientRect();
      const newLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

      members.forEach((m) => {
        if (!m.reports_to) return;

        const parentEl = nodeRefs.current.get(m.reports_to);
        if (!parentEl) return;
        const pRect = parentEl.getBoundingClientRect();
        const parentX = pRect.left + pRect.width / 2 - chartRect.left;
        const parentY = pRect.top - chartRect.top;

        // Is this member part of a cluster?
        const clusterId = memberClusterIndex.get(m.id);
        if (clusterId) {
          // Only draw one line per cluster (from the first member)
          const cluster = clusterMap.get(clusterId)!;
          if (cluster.members[0].id !== m.id) return; // only first member draws the line
          const clusterEl = nodeRefs.current.get(clusterId);
          if (!clusterEl) return;
          const cRect = clusterEl.getBoundingClientRect();
          newLines.push({
            x1: parentX,
            y1: parentY,
            x2: cRect.left + cRect.width / 2 - chartRect.left,
            y2: cRect.bottom - chartRect.top,
          });
        } else {
          // Individual leaf or non-leaf
          const childEl = nodeRefs.current.get(m.id);
          if (!childEl) return;
          const cRect = childEl.getBoundingClientRect();
          newLines.push({
            x1: parentX,
            y1: parentY,
            x2: cRect.left + cRect.width / 2 - chartRect.left,
            y2: cRect.bottom - chartRect.top,
          });
        }
      });

      setLines(newLines);
    };

    const timer = setTimeout(calcLines, 150);
    return () => clearTimeout(timer);
  }, [members, zoom, showNames, headcountOnly, memberClusterIndex, clusterMap]);

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No team members yet. Add your first team member to build the org chart.</p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
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
          {headcountOnly && (
            <span className="text-xs font-semibold bg-primary text-primary-foreground rounded px-2 py-0.5 ml-1">
              {members.length} total
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Tip: hover over circles to see names</span>
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
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="hsl(var(--border))" strokeWidth={1.5} />
            ))}
          </svg>

          {/* Levels: top = leaves, bottom = roots */}
          <div className="flex flex-col items-center gap-5 relative" style={{ zIndex: 1 }}>
            {layout.levels.map((level, li) => {
              if (headcountOnly) {
                const grouped: Record<string, typeof level> = {};
                level.forEach((pn) => {
                  const pos = pn.node.member.position;
                  if (!grouped[pos]) grouped[pos] = [];
                  grouped[pos].push(pn);
                });
                // Also fold in clustered leaf members (technicians, porters, etc.)
                const clustersAtLevelHC = layout.clusterLevelMap.get(li) || [];
                clustersAtLevelHC.forEach((pc) => {
                  const pos = pc.cluster.position;
                  if (!grouped[pos]) grouped[pos] = [];
                  pc.cluster.members.forEach((m) => grouped[pos].push({ node: { member: m, children: [] }, x: 0 }));
                });
                return (
                  <div key={li} className="flex flex-wrap justify-center gap-3">
                    {Object.entries(grouped).map(([pos, nodes]) => {
                      const colors = POSITION_COLORS[pos] || POSITION_COLORS.porter;
                      return (
                        <div key={pos} className="flex flex-col items-center justify-center rounded-lg font-medium"
                          style={{ backgroundColor: colors.bg, color: colors.text, minWidth: 80, padding: "8px 16px" }}>
                          <span className="font-bold" style={{ fontSize: 18 }}>{nodes.length}</span>
                          <span className="opacity-80" style={{ fontSize: 10 }}>{POSITION_LABELS[pos] || pos}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const clustersAtLevel = layout.clusterLevelMap.get(li) || [];
              const isLeafLevel = level.every((pn) => pn.node.children.length === 0) || clustersAtLevel.length > 0;

              // Compute a dynamic row height based on the tallest cluster at this level
              let rowHeight = isLeafLevel ? 44 : 62;
              if (!headcountOnly && clustersAtLevel.length > 0) {
                const maxRows = Math.max(...clustersAtLevel.map((pc) => Math.ceil(pc.cluster.members.length / 4)));
                rowHeight = Math.max(rowHeight, maxRows * 38 + 20);
              }

              return (
                <div key={li} className="relative" style={{ width: layout.totalWidth, height: rowHeight, marginBottom: 12 }}>
                  {/* Render non-clustered nodes */}
                  {level.map((pn) => (
                    <div
                      key={pn.node.member.id}
                      ref={(el) => setNodeRef(pn.node.member.id, el as HTMLDivElement | null)}
                      className="absolute"
                      style={{ left: pn.x, top: 0, transform: "translateX(-50%)" }}
                    >
                      <OrgNode node={pn.node} showNames={showNames} headcountOnly={headcountOnly} onSelect={onSelectMember} />
                    </div>
                  ))}

                  {/* Render balloon clusters */}
                  {!headcountOnly && clustersAtLevel.map((pc) => (
                    <div
                      key={pc.cluster.id}
                      className="absolute"
                      style={{ left: pc.x, top: 0, transform: "translateX(-50%)" }}
                    >
                      <BalloonCluster
                        cluster={pc.cluster}
                        showNames={showNames}
                        onSelect={onSelectMember}
                        divRef={(el) => setNodeRef(pc.cluster.id, el as HTMLDivElement | null)}
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
    </TooltipProvider>
  );
};
