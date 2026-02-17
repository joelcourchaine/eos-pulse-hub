
-- Fix clone function to trim title
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
BEGIN
  INSERT INTO processes (department_id, title, description, category_id, created_by, is_active, display_order)
  SELECT target_department_id, TRIM(title), description, category_id, cloned_by, is_active, display_order
  FROM processes WHERE id = source_process_id
  RETURNING id INTO new_process_id;

  FOR source_stage IN
    SELECT * FROM process_stages WHERE process_id = source_process_id ORDER BY display_order
  LOOP
    INSERT INTO process_stages (process_id, title, display_order)
    VALUES (new_process_id, source_stage.title, source_stage.display_order)
    RETURNING id INTO new_stage_id;

    FOR source_step IN
      SELECT * FROM process_steps WHERE stage_id = source_stage.id AND parent_step_id IS NULL ORDER BY display_order
    LOOP
      INSERT INTO process_steps (stage_id, title, instructions, definition_of_done, display_order, is_sub_process, owner_role, estimated_minutes)
      VALUES (new_stage_id, source_step.title, source_step.instructions, source_step.definition_of_done, source_step.display_order, source_step.is_sub_process, source_step.owner_role, source_step.estimated_minutes)
      RETURNING id INTO new_step_id;

      INSERT INTO process_steps (stage_id, title, instructions, definition_of_done, display_order, is_sub_process, parent_step_id, owner_role, estimated_minutes)
      SELECT new_stage_id, cs.title, cs.instructions, cs.definition_of_done, cs.display_order, cs.is_sub_process, new_step_id, cs.owner_role, cs.estimated_minutes
      FROM process_steps cs WHERE cs.parent_step_id = source_step.id ORDER BY cs.display_order;
    END LOOP;
  END LOOP;

  RETURN new_process_id;
END;
$$;
