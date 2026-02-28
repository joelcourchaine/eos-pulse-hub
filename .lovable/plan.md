
## Root cause

The connector line from the Advisor balloon cluster to Jeff is missing due to a **ref timing race**. The `calcLines` effect fires after a 150ms timeout (line 606). If the BalloonCluster's `divRef` hasn't registered by then (React rendering order isn't guaranteed relative to the timeout), `nodeRefs.current.get(clusterId)` returns `undefined` at line 580–581 and the line is silently skipped.

The effect dependency array (line 608) doesn't include `nodeRefs` (it's a ref, not state), so it never re-fires when refs finally mount.

## Fix

**`src/components/team/ReverseOrgChart.tsx`** — two small changes:

1. **Add a `refsVersion` state counter** that increments each time `setNodeRef` registers a new element. This makes React aware of ref changes.

2. **Add `refsVersion` to the `calcLines` dependency array** so the effect re-runs after all cluster elements mount, guaranteeing lines are drawn even if the initial 150ms pass was too early.

```ts
// Add alongside existing state
const [refsVersion, setRefsVersion] = useState(0);

// Update setNodeRef to bump version when new refs arrive
const setNodeRef = useCallback((id: string, el: HTMLDivElement | null) => {
  if (el) {
    nodeRefs.current.set(id, el);
    setRefsVersion((v) => v + 1); // trigger re-calc
  } else {
    nodeRefs.current.delete(id);
  }
}, []);

// Add refsVersion to the calcLines dependency array
}, [members, zoom, showNames, headcountOnly, memberClusterIndex, clusterMap, refsVersion]);
```

**Single file, minimal change.**
