
## What needs to happen

**Database changes only — no code changes needed.**

1. **Delete Jordan Mitchell and Tyler Brooks** from `team_members`
   - Jordan Mitchell: `668cb163-5960-455e-b223-55ef0e07948b`
   - Tyler Brooks: `85a5ea32-1012-47e1-a795-ae1515776610`

2. **Re-parent affected members to Blake Harrison** (`8999accf-6798-4b0a-b5c4-16a262835e97`):
   - Sam Chen (foreman) — currently reports to Tyler Brooks → update to Blake Harrison
   - Avery Kim (warranty_admin) — currently reports to Tyler Brooks → update to Blake Harrison

3. **Set Blake Harrison as root** (no reports_to):
   - Blake Harrison currently reports to Jordan Mitchell → set `reports_to = NULL`

Result: Blake Harrison is the top of the chart, with Sam Chen, Avery Kim, Morgan Davis, Riley Thompson, Casey Williams, and Alex Rivera all reporting to him.
