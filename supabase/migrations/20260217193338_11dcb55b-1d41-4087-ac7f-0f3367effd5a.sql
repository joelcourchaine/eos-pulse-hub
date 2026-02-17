
-- Step 1: Create the clone function
CREATE OR REPLACE FUNCTION public.clone_process_to_department(
  source_process_id uuid,
  target_department_id uuid,
  cloned_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_process_id uuid;
  source_stage RECORD;
  new_stage_id uuid;
  source_step RECORD;
  new_step_id uuid;
  step_id_map jsonb := '{}'::jsonb;
BEGIN
  -- 1. Clone the process row
  INSERT INTO processes (department_id, title, description, category_id, created_by, is_active, display_order)
  SELECT target_department_id, title, description, category_id, cloned_by, is_active, display_order
  FROM processes WHERE id = source_process_id
  RETURNING id INTO new_process_id;

  -- 2. Clone stages
  FOR source_stage IN
    SELECT * FROM process_stages WHERE process_id = source_process_id ORDER BY display_order
  LOOP
    INSERT INTO process_stages (process_id, title, display_order)
    VALUES (new_process_id, source_stage.title, source_stage.display_order)
    RETURNING id INTO new_stage_id;

    -- 3. Clone steps (parent steps first, then children)
    FOR source_step IN
      SELECT * FROM process_steps
      WHERE stage_id = source_stage.id AND parent_step_id IS NULL
      ORDER BY display_order
    LOOP
      INSERT INTO process_steps (stage_id, title, instructions, definition_of_done, display_order, is_sub_process, owner_role, estimated_minutes)
      VALUES (new_stage_id, source_step.title, source_step.instructions, source_step.definition_of_done, source_step.display_order, source_step.is_sub_process, source_step.owner_role, source_step.estimated_minutes)
      RETURNING id INTO new_step_id;

      step_id_map := step_id_map || jsonb_build_object(source_step.id::text, new_step_id::text);

      -- Clone child steps
      INSERT INTO process_steps (stage_id, title, instructions, definition_of_done, display_order, is_sub_process, parent_step_id, owner_role, estimated_minutes)
      SELECT new_stage_id, cs.title, cs.instructions, cs.definition_of_done, cs.display_order, cs.is_sub_process, new_step_id, cs.owner_role, cs.estimated_minutes
      FROM process_steps cs
      WHERE cs.parent_step_id = source_step.id
      ORDER BY cs.display_order;
    END LOOP;
  END LOOP;

  RETURN new_process_id;
END;
$$;

-- Step 2: Deploy to all existing service departments that don't have "Customer Journey"
DO $$
DECLARE
  dept RECORD;
  service_type_id uuid;
  source_id uuid := 'e098f763-9255-4995-b739-68c71a16904c';
BEGIN
  SELECT id INTO service_type_id FROM department_types WHERE name = 'Service Department' LIMIT 1;

  FOR dept IN
    SELECT d.id FROM departments d
    WHERE d.department_type_id = service_type_id
    AND NOT EXISTS (
      SELECT 1 FROM processes p WHERE p.department_id = d.id AND p.title = 'Customer Journey'
    )
  LOOP
    PERFORM clone_process_to_department(source_id, dept.id, NULL);
  END LOOP;
END;
$$;

-- Step 3: Auto-deploy trigger for new service departments
CREATE OR REPLACE FUNCTION public.auto_deploy_customer_journey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_type_id uuid;
  source_id uuid := 'e098f763-9255-4995-b739-68c71a16904c';
BEGIN
  SELECT id INTO service_type_id FROM department_types WHERE name = 'Service Department' LIMIT 1;

  IF NEW.department_type_id = service_type_id THEN
    PERFORM clone_process_to_department(source_id, NEW.id, NULL);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_deploy_customer_journey
AFTER INSERT ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.auto_deploy_customer_journey();
