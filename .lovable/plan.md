
## Fix white-on-white text in routine add input

The `AddRoutineItemInline` input sits inside the dark navy `RoutineDrawer`. The default `bg-background` / `text-foreground` CSS variables resolve to the light theme values in that context, making typed text invisible (white on white).

**Fix:** Add explicit color overrides to the `Input` className in `AddRoutineItemInline.tsx`:
- `bg-white/10` — semi-transparent white tint so it reads as a dark field
- `text-white` — typed text always white
- `placeholder:text-white/40` — placeholder readable but dimmer
- `border-white/20` — subtle border

Single line change in `src/components/routines/AddRoutineItemInline.tsx`, line 131:
```
className="h-8 text-sm bg-white/10 text-white placeholder:text-white/40 border-white/20"
```
