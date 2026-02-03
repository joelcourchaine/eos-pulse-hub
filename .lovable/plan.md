
# Show Re-import Option for Statements from Sibling Departments

## Problem
When a new department is added after a financial statement has been uploaded, the new department doesn't have an attachment record. Users have to know to go to the original department and trigger a re-import, which isn't discoverable.

## Solution
Show a "sibling attachment" icon in the drop zone when another department at the same store has an attachment for that month. Clicking it allows re-importing from that file.

## Implementation

### 1. Modify `FinancialSummary.tsx` - Fetch All Store Attachments

**Changes to `fetchAttachments` function (~lines 231-248):**

| Current | New |
|---------|-----|
| Queries only `departmentId` | Queries all departments at `storeId` |
| Single map of `{ [monthId]: attachment }` | Two maps: `attachments` (current dept) and `siblingAttachments` (other depts) |

```typescript
// New state
const [siblingAttachments, setSiblingAttachments] = useState<{ 
  [monthId: string]: { 
    id: string; 
    file_name: string; 
    file_path: string; 
    file_type: string;
    department_name: string;
  } 
}>({});

// Updated fetchAttachments
const fetchAttachments = useCallback(async () => {
  if (!departmentId || !storeId) return;
  
  // Fetch attachments for ALL departments at this store
  const { data } = await supabase
    .from('financial_attachments')
    .select('id, month_identifier, file_name, file_path, file_type, department_id, departments!inner(name)')
    .in('department_id', /* all dept IDs at this store */);
  
  // Split into current department and sibling attachments
  // ...
}, [departmentId, storeId]);
```

### 2. Add New Prop to `MonthDropZone.tsx`

**New prop for sibling attachment:**

```typescript
interface MonthDropZoneProps {
  // ... existing props
  
  /** Attachment from another department at the same store */
  siblingAttachment?: {
    file_name: string;
    file_path: string;
    file_type: string;
    department_name: string;
  } | null;
}
```

### 3. Modify `MonthDropZone.tsx` - Show Sibling Attachment Icon

**Add new UI element (~line 744):**

When `!attachment && siblingAttachment`, show a dashed/faded paperclip icon:

```tsx
{/* Sibling attachment indicator - show when this dept has no attachment but another dept does */}
{!attachment && !isUploading && siblingAttachment && (
  <div className="absolute -top-1 -right-1 z-20">
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground rounded-full p-0.5 border border-dashed border-muted-foreground/50 bg-background hover:bg-muted transition-colors">
                <FileSpreadsheet className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Statement available from {siblingAttachment.department_name}</p>
            <p className="text-xs text-muted-foreground">{siblingAttachment.file_name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleImportFromSibling}>
          <RefreshCw className="h-3 w-3 mr-2" />
          Import from {siblingAttachment.department_name}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
)}
```

### 4. Add Import From Sibling Handler

**New function in `MonthDropZone.tsx`:**

```typescript
const handleImportFromSibling = async () => {
  if (!siblingAttachment || !storeId || !storeBrand) return;
  
  setIsUploading(true);
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    
    // Download the sibling's file
    const { data: fileData, error } = await supabase.storage
      .from("financial-attachments")
      .download(siblingAttachment.file_path);
    
    if (error || !fileData) throw new Error("Failed to download file");
    
    const file = new File([fileData], siblingAttachment.file_name, { type: fileData.type });
    
    // Process using existing processBrandExcel (creates attachments for ALL departments)
    await processBrandExcel(file, siblingAttachment.file_path, user.id, storeBrand);
    
    toast({
      title: "Import complete",
      description: `Imported data from ${siblingAttachment.department_name}'s statement`,
    });
    
    onAttachmentChange();
  } catch (error: any) {
    toast({
      title: "Import failed",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setIsUploading(false);
  }
};
```

### 5. Pass Sibling Attachments in `FinancialSummary.tsx`

**Update all MonthDropZone usages:**

```tsx
<MonthDropZone
  monthIdentifier={month.identifier}
  departmentId={departmentId}
  storeId={storeId || undefined}
  storeBrand={storeBrand || undefined}
  attachment={attachments[month.identifier]}
  siblingAttachment={siblingAttachments[month.identifier]}  // NEW
  onAttachmentChange={() => {
    fetchAttachments();
    loadFinancialData();
    refetchSubMetrics();
  }}
  // ... rest of props
>
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/financial/FinancialSummary.tsx` | Add `siblingAttachments` state, update `fetchAttachments`, pass new prop to MonthDropZone |
| `src/components/financial/MonthDropZone.tsx` | Add `siblingAttachment` prop, render dashed icon, add `handleImportFromSibling` function |

## Visual Design

```text
Current Department View (Parts - newly added)

┌─────────────────────────────────────────────────┐
│  Jan 2025    Feb 2025    Mar 2025              │
│  ┌───────┐   ┌───────┐   ┌───────┐             │
│  │  📎̲   │   │  📎̲   │   │       │  <- Dashed │
│  │       │   │       │   │       │     icon    │
│  └───────┘   └───────┘   └───────┘             │
└─────────────────────────────────────────────────┘

Clicking dashed icon shows:
┌──────────────────────────────────┐
│ Import from Service              │
└──────────────────────────────────┘
```

## Testing

1. Create a store with Service department
2. Upload financial statement for Jan 2025
3. Add Parts department
4. Navigate to Parts → verify dashed icon appears for Jan 2025
5. Click dashed icon → select "Import from Service"
6. Verify Parts now has its own attachment and imported data
