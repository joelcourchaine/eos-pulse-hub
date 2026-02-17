
# Deploy "Customer Journey" Process to All Service Departments

## What This Does

This will:
1. **Copy the "Customer Journey" process** (with all 10 stages and 9 steps) from Winnipeg Chevrolet's Service Department to all 29 other service departments that don't already have it.
2. **Auto-deploy to future service departments** by adding a database trigger that fires whenever a new department is created with a "Service Department" type.

## Source Process Details

- **Process**: "Customer Journey" (Winnipeg Chevrolet Service Dept)
- **Category**: Serve the Customer
- **Stages (10)**: Appointment Booking, Arrival & Write Up, Dispatch & Shop Control, Diagnosis & Inspection, Estimate & Authorization, Parts Procurement, Repair Execution, Quality Control, Delivery & Payment, CSI Follow Up
- **Steps (9)**: 8 detailed steps under Appointment Booking + 1 placeholder step in Arrival & Write Up

## Technical Plan

### Step 1: Database function for cloning a process to a target department

Create a SQL function `clone_process_to_department(source_process_id, target_department_id, cloned_by)` that:
- Inserts a new `processes` row copying title, description, category_id from the source
- Inserts all `process_stages` with matching titles and display_order
- Inserts all `process_steps` under the correct new stage IDs, preserving title, instructions, definition_of_done, display_order, is_sub_process, and parent-child relationships

### Step 2: Run the clone for existing 29 service departments

Execute the function once for each of the 29 service departments that don't yet have the process.

### Step 3: Auto-deploy trigger for new service departments

Create a database trigger on the `departments` table that fires after insert. When a new department with `department_type_id` matching "Service Department" is created, the trigger will automatically call the clone function using the Winnipeg Chevrolet process as the source template.

### Step 4: No code changes needed

This is entirely a database-level operation -- no frontend changes required.
