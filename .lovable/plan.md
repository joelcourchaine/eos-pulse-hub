
## Move the stats bar inline below the org chart

**The problem:** The stats bar is `fixed` at the bottom of the viewport — it floats disconnected from the org chart content, appearing too far away especially when the chart doesn't fill the full screen height.

**Fix:** Remove the `fixed` positioning entirely. Instead, place the stats bar as a natural inline element **inside `<main>`**, centered below the `<ReverseOrgChart>`. This way it sits directly beneath the chart regardless of screen size.

**Changes to `src/pages/MyTeam.tsx`:**

1. Move the stats bar IIFE from its own block (lines 153–196) into `<main>` below the chart (line 149–151).
2. Change the container from `fixed bottom-4 left-1/2 -translate-x-1/2 ... z-50` to `mx-auto mt-6 w-fit` so it naturally centers itself beneath the chart.

```tsx
<main className="p-4 md:p-6">
  <ReverseOrgChart members={members} onSelectMember={handleSelectMember} />
  {/* Stats bar inline below chart */}
  {(() => {
    ...
    return (
      <div className="mx-auto mt-6 w-fit flex flex-wrap items-stretch bg-card/90 backdrop-blur border rounded-xl shadow-lg max-w-[90vw] overflow-hidden">
        ...
      </div>
    );
  })()}
</main>
```

Single file, two small changes: move the block + swap the positioning classes.
