import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Save, History, Mail, Edit2, X, Upload, Trash2, Plus, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryManagementDialog } from "./CategoryManagementDialog";

interface Question {
  id: string;
  question_text: string;
  question_category: string;
  answer_type: string;
  display_order: number;
  answer_description: string | null;
  reference_image_url: string | null;
  department_types?: { id: string; name: string }[];
}

interface DepartmentType {
  id: string;
  name: string;
}

interface Answer {
  id?: string;
  question_id: string;
  answer_value: string | null;
}

interface HistoryEntry {
  id: string;
  question_text: string;
  previous_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by_name: string | null;
}

interface DepartmentQuestionnaireDialogProps {
  departmentId: string;
  departmentName: string;
  departmentTypeId?: string;
  managerEmail?: string;
  isSuperAdmin?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DepartmentQuestionnaireDialog = ({
  departmentId,
  departmentName,
  departmentTypeId,
  managerEmail,
  isSuperAdmin = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DepartmentQuestionnaireDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [departmentTypes, setDepartmentTypes] = useState<DepartmentType[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string; email: string; store_id: string | null; stores: { name: string } | null }[]>([]);
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);
  const [editForm, setEditForm] = useState<{ 
    question_text: string; 
    answer_description: string;
    question_category: string;
    answer_type: string;
    display_order: number;
    department_type_ids: string[];
  }>({ 
    question_text: "", 
    answer_description: "",
    question_category: "",
    answer_type: "text",
    display_order: 0,
    department_type_ids: [],
  });
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (isSuperAdmin) {
        loadDepartmentTypes();
        loadCategories();
      }
      loadQuestionsAndAnswers();
      loadHistory();
      loadProfiles();
    }
  }, [open, departmentId]);

  useEffect(() => {
    if (managerEmail && profiles.length > 0 && !selectedRecipientEmail) {
      setSelectedRecipientEmail(managerEmail);
    }
  }, [managerEmail, profiles]);

  const loadProfiles = async () => {
    try {
      // Get all profiles across all stores, ordered by full name
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, store_id, stores(name)")
        .order("full_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error loading profiles:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("question_categories")
        .select("id, name")
        .order("display_order");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleCategoriesChanged = async () => {
    await loadCategories();
    await loadQuestionsAndAnswers();
  };

  const loadDepartmentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("department_types")
        .select("id, name")
        .order("display_order");

      if (error) throw error;
      setDepartmentTypes(data || []);
    } catch (error) {
      console.error("Error loading department types:", error);
    }
  };

  const loadQuestionsAndAnswers = async () => {
    try {
      // Load questions filtered by department type
      let query = supabase
        .from("department_questions")
        .select(`
          *,
          question_department_types!inner(
            department_type_id,
            department_types(id, name)
          )
        `)
        .eq("is_active", true);

      if (departmentTypeId) {
        query = query.eq("question_department_types.department_type_id", departmentTypeId);
      }

      const { data: questionsData, error: questionsError } = await query.order("display_order");

      if (questionsError) throw questionsError;
      
      const formattedQuestions = questionsData?.map((q: any) => ({
        ...q,
        department_types: q.question_department_types?.map((qdt: any) => qdt.department_types).filter(Boolean) || [],
      })) || [];
      
      setQuestions(formattedQuestions);

      // Load existing answers
      const { data: answersData, error: answersError } = await supabase
        .from("department_answers")
        .select("*")
        .eq("department_id", departmentId);

      if (answersError) throw answersError;

      // Convert answers array to object for easy access
      const answersMap: Record<string, string> = {};
      answersData?.forEach((answer) => {
        answersMap[answer.question_id] = answer.answer_value || "";
      });
      setAnswers(answersMap);
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questionnaire data.",
        variant: "destructive",
      });
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("department_answer_history")
        .select(`
          id,
          previous_value,
          new_value,
          changed_at,
          question_id,
          department_questions!inner(question_text),
          changed_by,
          profiles!department_answer_history_changed_by_fkey(full_name)
        `)
        .eq("department_id", departmentId)
        .order("changed_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedHistory: HistoryEntry[] = data?.map((entry: any) => ({
        id: entry.id,
        question_text: entry.department_questions.question_text,
        previous_value: entry.previous_value,
        new_value: entry.new_value,
        changed_at: entry.changed_at,
        changed_by_name: entry.profiles?.full_name || "Unknown",
      })) || [];

      setHistory(formattedHistory);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upsert all answers
      const upsertPromises = questions.map(async (question) => {
        const answerValue = answers[question.id] || null;
        
        return supabase
          .from("department_answers")
          .upsert({
            department_id: departmentId,
            question_id: question.id,
            answer_value: answerValue,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "department_id,question_id",
          });
      });

      const results = await Promise.all(upsertPromises);
      const errors = results.filter((r) => r.error);
      
      if (errors.length > 0) {
        throw new Error("Some answers failed to save");
      }

      toast({
        title: "Success",
        description: "All answers have been saved successfully.",
      });

      // Reload history to show new changes
      await loadHistory();
    } catch (error) {
      console.error("Error saving answers:", error);
      toast({
        title: "Error",
        description: "Failed to save answers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedRecipientEmail) {
      toast({
        title: "Error",
        description: "Please select a recipient.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const senderProfile = profiles.find(p => p.id === user?.id);
      const senderName = senderProfile?.full_name || "Your manager";

      const { error } = await supabase.functions.invoke("send-questionnaire-email", {
        body: {
          departmentId,
          departmentName,
          managerEmail: selectedRecipientEmail,
          questions,
          senderName,
        },
      });

      if (error) throw error;

      toast({
        title: "Email sent",
        description: `Questionnaire sent to ${selectedRecipientEmail}`,
      });
    } catch (error: any) {
      console.error("Error sending email:", error);
      
      // Check for Resend domain verification error
      const errorMessage = error.message || String(error);
      if (errorMessage.includes("verify a domain") || errorMessage.includes("validation_error")) {
        toast({
          title: "Email Domain Not Verified",
          description: "To send emails to other recipients, you need to verify your domain in Resend. Visit resend.com/domains to set this up.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to send email. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestionId(question.id);
    setIsAddingNew(false);
    setEditForm({
      question_text: question.question_text,
      answer_description: question.answer_description || "",
      question_category: question.question_category,
      answer_type: question.answer_type,
      display_order: question.display_order,
      department_type_ids: question.department_types?.map(dt => dt.id) || [],
    });
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingQuestionId(null);
    setEditForm({
      question_text: "",
      answer_description: "",
      question_category: "",
      answer_type: "text",
      display_order: questions.length + 1,
      department_type_ids: departmentTypeId ? [departmentTypeId] : [],
    });
  };

  const handleCancelEdit = () => {
    setEditingQuestionId(null);
    setIsAddingNew(false);
    setEditForm({ 
      question_text: "", 
      answer_description: "",
      question_category: "",
      answer_type: "text",
      display_order: 0,
      department_type_ids: [],
    });
  };

  const handleSaveQuestion = async (questionId?: string) => {
    if (!editForm.question_text || !editForm.question_category) {
      toast({
        title: "Validation Error",
        description: "Question text and category are required.",
        variant: "destructive",
      });
      return;
    }

    if (editForm.department_type_ids.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one department type.",
        variant: "destructive",
      });
      return;
    }

    try {
      let finalQuestionId = questionId;

      if (isAddingNew) {
        const { data, error } = await supabase
          .from("department_questions")
          .insert({
            question_text: editForm.question_text,
            question_category: editForm.question_category,
            answer_type: editForm.answer_type,
            answer_description: editForm.answer_description || null,
            display_order: editForm.display_order,
          })
          .select()
          .single();

        if (error) throw error;
        finalQuestionId = data.id;
        toast({ title: "Success", description: "Question added successfully." });
      } else if (questionId) {
        const { error } = await supabase
          .from("department_questions")
          .update({
            question_text: editForm.question_text,
            question_category: editForm.question_category,
            answer_type: editForm.answer_type,
            answer_description: editForm.answer_description || null,
            display_order: editForm.display_order,
          })
          .eq("id", questionId);

        if (error) throw error;
        toast({ title: "Success", description: "Question updated successfully." });
      }

      // Update department type associations
      if (finalQuestionId) {
        await supabase
          .from("question_department_types")
          .delete()
          .eq("question_id", finalQuestionId);

        const associations = editForm.department_type_ids.map(typeId => ({
          question_id: finalQuestionId,
          department_type_id: typeId,
        }));

        const { error: assocError } = await supabase
          .from("question_department_types")
          .insert(associations);

        if (assocError) throw assocError;
      }

      await loadQuestionsAndAnswers();
      handleCancelEdit();
    } catch (error) {
      console.error("Error saving question:", error);
      toast({
        title: "Error",
        description: "Failed to save question.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const { error } = await supabase
        .from("department_questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;
      toast({ title: "Success", description: "Question deleted successfully." });
      await loadQuestionsAndAnswers();
    } catch (error) {
      console.error("Error deleting question:", error);
      toast({
        title: "Error",
        description: "Failed to delete question.",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (questionId: string, file: File) => {
    setUploadingImageFor(questionId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${questionId}-${Date.now()}.${fileExt}`;
      const filePath = `question-references/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("note-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("note-attachments")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("department_questions")
        .update({ reference_image_url: publicUrl })
        .eq("id", questionId);

      if (updateError) throw updateError;

      toast({ title: "Success", description: "Reference image uploaded successfully." });
      await loadQuestionsAndAnswers();
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to upload reference image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImageFor(null);
    }
  };

  const handleRemoveImage = async (questionId: string, imageUrl: string) => {
    try {
      const urlParts = imageUrl.split("/");
      const filePath = `question-references/${urlParts[urlParts.length - 1]}`;

      const { error: deleteError } = await supabase.storage
        .from("note-attachments")
        .remove([filePath]);

      if (deleteError) console.error("Error deleting file:", deleteError);

      const { error: updateError } = await supabase
        .from("department_questions")
        .update({ reference_image_url: null })
        .eq("id", questionId);

      if (updateError) throw updateError;

      toast({ title: "Success", description: "Reference image removed." });
      await loadQuestionsAndAnswers();
    } catch (error) {
      console.error("Error removing image:", error);
      toast({
        title: "Error",
        description: "Failed to remove image.",
        variant: "destructive",
      });
    }
  };

  const groupedQuestions = questions.reduce((acc, question) => {
    if (!acc[question.question_category]) {
      acc[question.question_category] = [];
    }
    acc[question.question_category].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  const renderInput = (question: Question) => {
    const value = answers[question.id] || "";

    if (question.answer_type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          placeholder="Enter your answer..."
          className="min-h-[80px]"
        />
      );
    }

    return (
      <Input
        type={question.answer_type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
        placeholder="Enter your answer..."
      />
    );
  };

  const renderQuestionContent = (question: Question) => {
    const isEditing = editingQuestionId === question.id;

    if (isEditing && isSuperAdmin) {
      return (
        <Card className="p-4 mb-4 border-primary">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Question Text *</Label>
                <Input
                  value={editForm.question_text}
                  onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                  placeholder="Enter question..."
                />
              </div>
                     <div className="space-y-2">
                       <Label>Category *</Label>
                       <div className="flex gap-2">
                         <Select 
                           value={editForm.question_category} 
                           onValueChange={(val) => setEditForm({ ...editForm, question_category: val })}
                         >
                           <SelectTrigger className="flex-1">
                             <SelectValue placeholder="Select category..." />
                           </SelectTrigger>
                           <SelectContent>
                             {categories.map((cat) => (
                               <SelectItem key={cat.id} value={cat.name}>
                                 {cat.name}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                         <Button
                           type="button"
                           variant="outline"
                           size="icon"
                           onClick={() => setShowCategoryManagement(true)}
                           title="Manage Categories"
                         >
                           <Settings className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Answer Type</Label>
                <Select value={editForm.answer_type} onValueChange={(val) => setEditForm({ ...editForm, answer_type: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="textarea">Long Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={editForm.display_order}
                  onChange={(e) => setEditForm({ ...editForm, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Answer Description (Help text)</Label>
              <Textarea
                value={editForm.answer_description}
                onChange={(e) => setEditForm({ ...editForm, answer_description: e.target.value })}
                placeholder="Provide guidance on how to answer this question..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Department Types *</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md">
                {departmentTypes.map(type => (
                  <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.department_type_ids.includes(type.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditForm({
                            ...editForm,
                            department_type_ids: [...editForm.department_type_ids, type.id]
                          });
                        } else {
                          setEditForm({
                            ...editForm,
                            department_type_ids: editForm.department_type_ids.filter(id => id !== type.id)
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{type.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => handleSaveQuestion(question.id)} size="sm">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button variant="outline" onClick={handleCancelEdit} size="sm">
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Label htmlFor={question.id} className="flex-1">{question.question_text}</Label>
          {isSuperAdmin && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditQuestion(question)}
                className="h-8 w-8 p-0"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteQuestion(question.id)}
                className="h-8 w-8 p-0 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {question.answer_description && (
          <p className="text-sm text-muted-foreground">{question.answer_description}</p>
        )}
        {question.reference_image_url && (
          <div className="relative">
            <img
              src={question.reference_image_url}
              alt="Reference"
              className="max-w-md rounded-lg border mb-2"
            />
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => handleRemoveImage(question.id, question.reference_image_url!)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {isSuperAdmin && !question.reference_image_url && (
          <div className="mt-2">
            <Label htmlFor={`upload-${question.id}`} className="cursor-pointer">
              <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <Upload className="h-4 w-4" />
                {uploadingImageFor === question.id ? "Uploading..." : "Add reference image"}
              </div>
            </Label>
            <Input
              id={`upload-${question.id}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(question.id, file);
              }}
              disabled={uploadingImageFor === question.id}
            />
          </div>
        )}
        {renderInput(question)}
      </div>
    );
  };

  const dialogContent = (
    <>
      <DialogHeader>
        <DialogTitle>Department Information - {departmentName}</DialogTitle>
        <DialogDescription>
          Answer questions about your department. Changes are tracked automatically.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="questions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="history">Change History</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4">
            {(editingQuestionId !== null || isAddingNew) && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {isAddingNew ? "Adding new question" : "Editing question"} - scroll down to save or cancel
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancelEdit}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel Editing
                </Button>
              </div>
            )}
            <div className="flex gap-2 mb-4">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save All Answers"}
              </Button>
              {isSuperAdmin && (
                <Button 
                  onClick={handleAddNew} 
                  disabled={isAddingNew || editingQuestionId !== null} 
                  variant="outline"
                  title={editingQuestionId !== null ? "Please save or cancel the current question first" : ""}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              )}
              <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border">
                <Label className="text-sm font-medium">Send Questionnaire via Email</Label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="recipient-select" className="text-xs text-muted-foreground">
                      Select Recipient
                    </Label>
                    <Select
                      value={selectedRecipientEmail}
                      onValueChange={setSelectedRecipientEmail}
                    >
                      <SelectTrigger id="recipient-select">
                        <SelectValue placeholder="Choose who to send to..." />
                      </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.email}>
                          {profile.full_name} - {profile.stores?.name || 'No Store'} ({profile.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || !selectedRecipientEmail}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {isSendingEmail ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </div>
            </div>

            {isAddingNew && isSuperAdmin && (
              <Card className="p-4 mb-4 border-primary">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Question Text *</Label>
                      <Input
                        value={editForm.question_text}
                        onChange={(e) => setEditForm({ ...editForm, question_text: e.target.value })}
                        placeholder="Enter question..."
                      />
                    </div>
                     <div className="space-y-2">
                       <Label>Category *</Label>
                       <div className="flex gap-2">
                         <Select 
                           value={editForm.question_category} 
                           onValueChange={(val) => setEditForm({ ...editForm, question_category: val })}
                         >
                           <SelectTrigger className="flex-1">
                             <SelectValue placeholder="Select category..." />
                           </SelectTrigger>
                           <SelectContent>
                             {categories.map((cat) => (
                               <SelectItem key={cat.id} value={cat.name}>
                                 {cat.name}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                         <Button
                           type="button"
                           variant="outline"
                           size="icon"
                           onClick={() => setShowCategoryManagement(true)}
                           title="Manage Categories"
                         >
                           <Settings className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Answer Type</Label>
                      <Select value={editForm.answer_type} onValueChange={(val) => setEditForm({ ...editForm, answer_type: val })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="textarea">Long Text</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Display Order</Label>
                      <Input
                        type="number"
                        value={editForm.display_order}
                        onChange={(e) => setEditForm({ ...editForm, display_order: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Answer Description (Help text)</Label>
                    <Textarea
                      value={editForm.answer_description}
                      onChange={(e) => setEditForm({ ...editForm, answer_description: e.target.value })}
                      placeholder="Provide guidance on how to answer this question..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Department Types *</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md">
                      {departmentTypes.map(type => (
                        <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.department_type_ids.includes(type.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditForm({
                                  ...editForm,
                                  department_type_ids: [...editForm.department_type_ids, type.id]
                                });
                              } else {
                                setEditForm({
                                  ...editForm,
                                  department_type_ids: editForm.department_type_ids.filter(id => id !== type.id)
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{type.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => handleSaveQuestion()} size="sm">
                      <Save className="mr-2 h-4 w-4" />
                      Add Question
                    </Button>
                    <Button variant="outline" onClick={handleCancelEdit} size="sm">
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
              <Collapsible key={category} defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg hover:bg-muted/80">
                  <h3 className="font-semibold">{category}</h3>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {categoryQuestions.map((question) => (
                    <div key={question.id}>
                      {renderQuestionContent(question)}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No changes have been recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{entry.question_text}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Changed by {entry.changed_by_name} on{" "}
                          {new Date(entry.changed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Previous:</p>
                        <p className="text-sm mt-1">{entry.previous_value || "(empty)"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">New:</p>
                        <p className="text-sm mt-1">{entry.new_value || "(empty)"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </>
    );

  // If controlled externally (no trigger button needed)
  if (controlledOpen !== undefined) {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {dialogContent}
          </DialogContent>
        </Dialog>

        {isSuperAdmin && (
          <CategoryManagementDialog
            open={showCategoryManagement}
            onOpenChange={setShowCategoryManagement}
            onCategoriesChanged={handleCategoriesChanged}
          />
        )}
      </>
    );
  }

  // If uncontrolled (has trigger button)
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <ClipboardList className="mr-2 h-4 w-4" />
            Department Info
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {dialogContent}
        </DialogContent>
      </Dialog>

      {isSuperAdmin && (
        <CategoryManagementDialog
          open={showCategoryManagement}
          onOpenChange={setShowCategoryManagement}
          onCategoriesChanged={handleCategoriesChanged}
        />
      )}
    </>
  );
};
