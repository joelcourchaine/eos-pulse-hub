import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Pencil,
  Printer,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Stage {
  id: string;
  title: string;
  display_order: number;
}

interface Step {
  id: string;
  stage_id: string;
  title: string;
  instructions: string | null;
  definition_of_done: string | null;
  owner_role: string | null;
  estimated_minutes: number | null;
  display_order: number;
  is_sub_process: boolean;
  parent_step_id: string | null;
}

interface Attachment {
  id: string;
  step_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  display_order: number;
}

interface ProcessData {
  id: string;
  title: string;
  description: string | null;
  department_id: string;
  category: { name: string } | null;
  owner: { full_name: string } | null;
}

const ProcessDetail = () => {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [process, setProcess] = useState<ProcessData | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeStage, setActiveStage] = useState<string>("");
  const [editing, setEditing] = useState(searchParams.get("edit") === "true");
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [dropTargetStepId, setDropTargetStepId] = useState<string | null>(null);
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const [dropTargetStageId, setDropTargetStageId] = useState<string | null>(null);

  useEffect(() => {
    if (processId) fetchAll();
  }, [processId]);

  const fetchAll = async () => {
    if (!processId) return;
    setLoading(true);

    const [procRes, stagesRes, userRes] = await Promise.all([
      supabase
        .from("processes")
        .select("id, title, description, department_id, category:process_categories(name), owner:profiles!processes_owner_id_fkey(full_name)")
        .eq("id", processId)
        .single(),
      supabase
        .from("process_stages")
        .select("*")
        .eq("process_id", processId)
        .order("display_order"),
      supabase.auth.getUser(),
    ]);

    if (procRes.error || !procRes.data) {
      navigate("/dashboard");
      return;
    }

    setProcess(procRes.data as unknown as ProcessData);

    const stagesData = (stagesRes.data || []) as Stage[];
    setStages(stagesData);

    if (stagesData.length > 0) {
      setActiveStage(stagesData[0].id);
      // Fetch all steps for all stages
      const stageIds = stagesData.map((s) => s.id);
      const [stepsRes, attachRes] = await Promise.all([
        supabase
          .from("process_steps")
          .select("*")
          .in("stage_id", stageIds)
          .order("display_order"),
        supabase
          .from("process_step_attachments")
          .select("*")
          .in(
            "step_id",
            // We need step ids but we don't have them yet, so we'll fetch attachments after
            []
          ),
      ]);
      const stepsData = (stepsRes.data || []) as Step[];
      setSteps(stepsData);

      // Now fetch attachments for all steps
      if (stepsData.length > 0) {
        const { data: attData } = await supabase
          .from("process_step_attachments")
          .select("*")
          .in("step_id", stepsData.map((s) => s.id))
          .order("display_order");
        setAttachments((attData || []) as Attachment[]);
      }
    }

    // Check edit permission
    if (userRes.data?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userRes.data.user.id)
        .single();
      if (profile) {
        const editRoles = ["super_admin", "store_gm", "department_manager", "fixed_ops_manager"];
        setCanEdit(editRoles.includes(profile.role));
      }
    }

    setLoading(false);
  };

  // ---- Edit Actions ----
  const addStage = async () => {
    if (!processId) return;
    const { data, error } = await supabase
      .from("process_stages")
      .insert({ process_id: processId, title: "New Stage", display_order: stages.length })
      .select()
      .single();
    if (data) {
      setStages((prev) => [...prev, data as Stage]);
      setActiveStage(data.id);
    }
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const deleteStage = async (stageId: string) => {
    await supabase.from("process_stages").delete().eq("id", stageId);
    setStages((prev) => prev.filter((s) => s.id !== stageId));
    setSteps((prev) => prev.filter((s) => s.stage_id !== stageId));
    if (activeStage === stageId) {
      const remaining = stages.filter((s) => s.id !== stageId);
      setActiveStage(remaining.length > 0 ? remaining[0].id : "");
    }
  };

  const updateStageTitleLocal = (stageId: string, title: string) => {
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, title } : s)));
  };

  const saveStageTitle = async (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    await supabase.from("process_stages").update({ title: stage.title }).eq("id", stageId);
  };

  const addStep = async (stageId: string, parentStepId?: string) => {
    const stageSteps = steps.filter((s) => s.stage_id === stageId && !s.is_sub_process);
    const { data, error } = await supabase
      .from("process_steps")
      .insert({
        stage_id: stageId,
        title: "New Step",
        display_order: stageSteps.length,
        is_sub_process: !!parentStepId,
        parent_step_id: parentStepId || null,
      })
      .select()
      .single();
    if (data) setSteps((prev) => [...prev, data as Step]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  // Local-only state update (no DB call) — used on every keystroke
  const updateStepLocal = (stepId: string, updates: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  // Persist to DB — called on blur
  const saveStep = async (stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    await supabase.from("process_steps").update({
      title: step.title,
      instructions: step.instructions,
      definition_of_done: step.definition_of_done,
      owner_role: step.owner_role,
      estimated_minutes: step.estimated_minutes,
    }).eq("id", stepId);
  };

  const deleteStep = async (stepId: string) => {
    await supabase.from("process_steps").delete().eq("id", stepId);
    setSteps((prev) => prev.filter((s) => s.id !== stepId && s.parent_step_id !== stepId));
  };

  const handleFileUpload = async (stepId: string, file: File) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${processId}/${stepId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("process-attachments")
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }

    const { data, error } = await supabase
      .from("process_step_attachments")
      .insert({
        step_id: stepId,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type,
        display_order: attachments.filter((a) => a.step_id === stepId).length,
      })
      .select()
      .single();

    if (data) setAttachments((prev) => [...prev, data as Attachment]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const deleteAttachment = async (att: Attachment) => {
    await supabase.storage.from("process-attachments").remove([att.file_path]);
    await supabase.from("process_step_attachments").delete().eq("id", att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  };

  const getSignedUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from("process-attachments")
      .createSignedUrl(filePath, 3600);
    return data?.signedUrl || "";
  };

  // ---- Drag & Drop Helpers ----
  const persistStageOrder = async (reordered: Stage[]) => {
    await Promise.all(
      reordered.map((s, i) =>
        supabase.from("process_stages").update({ display_order: i }).eq("id", s.id)
      )
    );
  };

  const persistStepOrder = async (reordered: Step[]) => {
    await Promise.all(
      reordered.map((s, i) =>
        supabase.from("process_steps").update({ display_order: i }).eq("id", s.id)
      )
    );
  };

  const handleStepDrop = (targetStep: Step) => {
    if (!dragStepId || dragStepId === targetStep.id) return;
    const stageSteps = steps
      .filter((s) => s.stage_id === targetStep.stage_id && !s.is_sub_process)
      .sort((a, b) => a.display_order - b.display_order);
    const fromIdx = stageSteps.findIndex((s) => s.id === dragStepId);
    const toIdx = stageSteps.findIndex((s) => s.id === targetStep.id);
    if (fromIdx === -1 || toIdx === -1) return;
    const moved = stageSteps.splice(fromIdx, 1)[0];
    stageSteps.splice(toIdx, 0, moved);
    const updatedSteps = stageSteps.map((s, i) => ({ ...s, display_order: i }));
    setSteps((prev) => {
      const other = prev.filter(
        (s) => s.stage_id !== targetStep.stage_id || s.is_sub_process
      );
      return [...other, ...updatedSteps];
    });
    persistStepOrder(updatedSteps);
    setDragStepId(null);
    setDropTargetStepId(null);
  };

  const handleStageDrop = (targetStageId: string) => {
    if (!dragStageId || dragStageId === targetStageId) return;
    const ordered = [...stages].sort((a, b) => a.display_order - b.display_order);
    const fromIdx = ordered.findIndex((s) => s.id === dragStageId);
    const toIdx = ordered.findIndex((s) => s.id === targetStageId);
    if (fromIdx === -1 || toIdx === -1) return;
    const moved = ordered.splice(fromIdx, 1)[0];
    ordered.splice(toIdx, 0, moved);
    const updated = ordered.map((s, i) => ({ ...s, display_order: i }));
    setStages(updated);
    persistStageOrder(updated);
    setDragStageId(null);
    setDropTargetStageId(null);
  };

  // ---- Render Helpers ----
  const renderStep = (step: Step, index: number) => {
    const subSteps = steps.filter((s) => s.parent_step_id === step.id);
    const stepAttachments = attachments.filter((a) => a.step_id === step.id);

    return (
      <Card
        key={step.id}
        className={`relative transition-colors ${
          dropTargetStepId === step.id && dragStepId !== step.id
            ? "border-t-2 border-primary"
            : ""
        } ${dragStepId === step.id ? "opacity-50" : ""}`}
        onDragOver={(e) => {
          if (!editing || !dragStepId || step.is_sub_process) return;
          e.preventDefault();
          setDropTargetStepId(step.id);
        }}
        onDragLeave={() => setDropTargetStepId(null)}
        onDrop={(e) => {
          e.preventDefault();
          if (!editing || step.is_sub_process) return;
          handleStepDrop(step);
        }}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            {editing && (
              <div
                className="pt-1 cursor-grab text-muted-foreground"
                draggable={!step.is_sub_process}
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDragStepId(step.id);
                }}
                onDragEnd={() => {
                  setDragStepId(null);
                  setDropTargetStepId(null);
                }}
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              {/* Title */}
              {editing ? (
                <Input
                  className="font-semibold"
                  value={step.title}
                  onChange={(e) => updateStepLocal(step.id, { title: e.target.value })}
                  onBlur={() => saveStep(step.id)}
                />
              ) : (
                <h4 className="font-semibold text-foreground">{step.title}</h4>
              )}

              {/* Instructions */}
              {editing ? (
                <Textarea
                  placeholder="Instructions (use each line as a bullet)..."
                  value={step.instructions || ""}
                  onChange={(e) => updateStepLocal(step.id, { instructions: e.target.value })}
                  onBlur={() => saveStep(step.id)}
                  rows={3}
                />
              ) : step.instructions ? (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {step.instructions.split("\n").filter(Boolean).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : null}

              {/* Definition of Done */}
              {editing ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Definition of Done</label>
                  <Textarea
                    placeholder="What must be true before moving on..."
                    value={step.definition_of_done || ""}
                    onChange={(e) => updateStepLocal(step.id, { definition_of_done: e.target.value })}
                    onBlur={() => saveStep(step.id)}
                    rows={2}
                  />
                </div>
              ) : step.definition_of_done ? (
                <div className="flex items-start gap-2 p-3 rounded-md bg-success/10 border border-success/20">
                  <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <p className="text-sm">{step.definition_of_done}</p>
                </div>
              ) : null}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-2">
                {editing ? (
                  <>
                    <Input
                      className="w-32 h-8 text-xs"
                      placeholder="Owner role"
                      value={step.owner_role || ""}
                      onChange={(e) => updateStepLocal(step.id, { owner_role: e.target.value })}
                      onBlur={() => saveStep(step.id)}
                    />
                    <Input
                      type="number"
                      className="w-24 h-8 text-xs"
                      placeholder="Minutes"
                      value={step.estimated_minutes ?? ""}
                      onChange={(e) =>
                        updateStepLocal(step.id, {
                          estimated_minutes: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      onBlur={() => saveStep(step.id)}
                    />
                  </>
                ) : (
                  <>
                    {step.owner_role && <Badge variant="secondary">{step.owner_role}</Badge>}
                    {step.estimated_minutes && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {step.estimated_minutes} min
                      </Badge>
                    )}
                  </>
                )}
              </div>

              {/* Attachments */}
              {(stepAttachments.length > 0 || editing) && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {stepAttachments.map((att) => (
                      <AttachmentThumbnail
                        key={att.id}
                        attachment={att}
                        editing={editing}
                        onEnlarge={(url) => setEnlargedImage(url)}
                        onDelete={() => deleteAttachment(att)}
                        getSignedUrl={getSignedUrl}
                      />
                    ))}
                  </div>
                  {editing && (
                    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Add image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(step.id, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Sub-processes */}
              {subSteps.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-3.5 w-3.5" />
                    {subSteps.length} sub-process{subSteps.length > 1 ? "es" : ""}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 ml-4 border-l-2 border-muted pl-4 space-y-3">
                    {subSteps.map((sub, si) => renderStep(sub, si))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {editing && !step.is_sub_process && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => addStep(step.stage_id, step.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Sub-process
                </Button>
              )}
              {editing && (
                <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => deleteStep(step.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!process) return null;

  const activeSteps = steps.filter((s) => s.stage_id === activeStage && !s.is_sub_process);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" className="mt-1" onClick={() => navigate(`/processes?dept=${process.department_id}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                My Processes › {process.category?.name}
              </p>
              <h1 className="text-2xl font-bold text-foreground">{process.title}</h1>
              {process.description && (
                <p className="text-sm text-muted-foreground mt-1">{process.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button
                variant={editing ? "default" : "outline"}
                size="sm"
                onClick={() => setEditing(!editing)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {editing ? "Done" : "Edit"}
              </Button>
            )}
          </div>
        </div>

        {/* Stages Tabs */}
        {stages.length > 0 ? (
          <Tabs value={activeStage} onValueChange={setActiveStage}>
            <div className="flex items-center gap-2 mb-6">
              <TabsList className="flex-1 h-auto flex-wrap justify-start items-center">
                {stages.map((stage, idx) => (
                  <React.Fragment key={stage.id}>
                    <TabsTrigger
                      value={stage.id}
                      className={`relative max-w-[12rem] ${
                        editing ? "cursor-grab" : ""
                      } ${dragStageId === stage.id ? "opacity-50" : ""} ${
                        dropTargetStageId === stage.id && dragStageId !== stage.id
                          ? "ring-2 ring-primary"
                          : ""
                      }`}
                      title={stage.title}
                      draggable={editing}
                      onDragStart={(e) => {
                        if (!editing) return;
                        setDragStageId(stage.id);
                      }}
                      onDragEnd={() => {
                        setDragStageId(null);
                        setDropTargetStageId(null);
                      }}
                      onDragOver={(e) => {
                        if (!editing || !dragStageId) return;
                        e.preventDefault();
                        setDropTargetStageId(stage.id);
                      }}
                      onDragLeave={() => setDropTargetStageId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!editing) return;
                        handleStageDrop(stage.id);
                      }}
                    >
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="bg-transparent border-none outline-none text-sm font-medium w-40 text-center"
                            value={stage.title}
                            onChange={(e) => updateStageTitleLocal(stage.id, e.target.value)}
                            onBlur={() => saveStageTitle(stage.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {stages.length > 1 && (
                            <button
                              className="text-destructive hover:text-destructive/80"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteStage(stage.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="truncate block">{stage.title}</span>
                      )}
                    </TabsTrigger>
                    {idx < stages.length - 1 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mx-1" />
                    )}
                  </React.Fragment>
                ))}
              </TabsList>
              {editing && (
                <Button variant="outline" size="sm" onClick={addStage}>
                  <Plus className="h-4 w-4 mr-1" /> Stage
                </Button>
              )}
            </div>

            {stages.map((stage) => (
              <TabsContent key={stage.id} value={stage.id} className="space-y-4">
                {steps
                  .filter((s) => s.stage_id === stage.id && !s.is_sub_process)
                  .map((step, i) => renderStep(step, i))}

                {editing && (
                  <Button variant="outline" className="w-full" onClick={() => addStep(stage.id)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Step
                  </Button>
                )}

                {!editing &&
                  steps.filter((s) => s.stage_id === stage.id && !s.is_sub_process).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-12">
                      No steps defined for this stage yet.
                    </p>
                  )}
              </TabsContent>
            ))}
          </Tabs>
        ) : editing ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Add your first stage to get started.</p>
            <Button onClick={addStage}>
              <Plus className="h-4 w-4 mr-2" /> Add Stage
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-12">
            This process has no stages yet.
          </p>
        )}
      </div>

      {/* Enlarged image dialog */}
      <Dialog open={!!enlargedImage} onOpenChange={() => setEnlargedImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          {enlargedImage && (
            <img src={enlargedImage} alt="Attachment" className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---- Attachment Thumbnail ----
const AttachmentThumbnail = ({
  attachment,
  editing,
  onEnlarge,
  onDelete,
  getSignedUrl,
}: {
  attachment: Attachment;
  editing: boolean;
  onEnlarge: (url: string) => void;
  onDelete: () => void;
  getSignedUrl: (path: string) => Promise<string>;
}) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    getSignedUrl(attachment.file_path).then(setUrl);
  }, [attachment.file_path]);

  if (!url) return <div className="h-16 w-16 rounded bg-muted animate-pulse" />;

  return (
    <div className="relative group">
      <img
        src={url}
        alt={attachment.file_name}
        className="h-16 w-16 rounded object-cover cursor-pointer border"
        onClick={() => onEnlarge(url)}
      />
      {editing && (
        <button
          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onDelete}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default ProcessDetail;
