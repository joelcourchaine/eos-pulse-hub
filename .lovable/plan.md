

# Add Scorecard Mapper to Admin Navigation Dropdown

## Summary
Add the Visual Scorecard Mapper link to the Admin dropdown menu, making it easily accessible for super admins from anywhere in the application.

## Change Required

### File: `src/components/navigation/AdminNavDropdown.tsx`

Add the Scorecard Mapper to the **Configuration** section alongside KPI Rules:

**Current Configuration section:**
```typescript
{
  label: "Configuration",
  items: [
    { name: "KPI Rules", icon: Target, path: "/admin/kpi-rules" },
  ],
},
```

**Updated Configuration section:**
```typescript
{
  label: "Configuration",
  items: [
    { name: "KPI Rules", icon: Target, path: "/admin/kpi-rules" },
    { name: "Scorecard Mapper", icon: FileSpreadsheet, path: "/admin/scorecard-mapper" },
  ],
},
```

Also add the `FileSpreadsheet` icon to the imports from `lucide-react`.

## Result
Super admins will see "Scorecard Mapper" in the Admin dropdown menu under the Configuration section, providing quick access from any page in the application.

