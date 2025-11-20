import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Plus, Trash2, Edit2, Save, X, Upload, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

interface Question {
  id: string;
  question_text: string;
  question_category: string;
  answer_type: string;
  display_order: number;
  is_active: boolean;
  answer_description: string | null;
  reference_image_url: string | null;
}

export const QuestionManagementDialog = () => {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    question_text: "",
    question_category: "",
    answer_type: "text",
    answer_description: "",
    display_order: 0,
  });

  useEffect(() => {
    if (open) {
      loadQuestions();
    }
  }, [open]);

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from("department_questions")
        .select("*")
        .order("question_category")
        .order("display_order");

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questions.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (question: Question) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      question_category: question.question_category,
      answer_type: question.answer_type,
      answer_description: question.answer_description || "",
      display_order: question.display_order,
    });
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setFormData({
      question_text: "",
      question_category: "",
      answer_type: "text",
      answer_description: "",
      display_order: questions.length + 1,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormData({
      question_text: "",
      question_category: "",
      answer_type: "text",
      answer_description: "",
      display_order: 0,
    });
  };

  const handleSave = async () => {
    if (!formData.question_text || !formData.question_category) {
      toast({
        title: "Validation Error",
        description: "Question text and category are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isAddingNew) {
        const { error } = await supabase
          .from("department_questions")
          .insert({
            question_text: formData.question_text,
            question_category: formData.question_category,
            answer_type: formData.answer_type,
            answer_description: formData.answer_description || null,
            display_order: formData.display_order,
          });

        if (error) throw error;
        toast({ title: "Success", description: "Question added successfully." });
      } else if (editingId) {
        const { error } = await supabase
          .from("department_questions")
          .update({
            question_text: formData.question_text,
            question_category: formData.question_category,
            answer_type: formData.answer_type,
            answer_description: formData.answer_description || null,
            display_order: formData.display_order,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Success", description: "Question updated successfully." });
      }

      await loadQuestions();
      handleCancel();
    } catch (error) {
      console.error("Error saving question:", error);
      toast({
        title: "Error",
        description: "Failed to save question.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const { error } = await supabase
        .from("department_questions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Question deleted successfully." });
      await loadQuestions();
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
      await loadQuestions();
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
      // Extract file path from URL
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
      await loadQuestions();
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Manage Questions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Department Questions</DialogTitle>
          <DialogDescription>
            Add, edit, or delete questions that departments need to answer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button onClick={handleAddNew} disabled={isAddingNew || editingId !== null}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Question
          </Button>
        </div>

        {(isAddingNew || editingId) && (
          <Card className="p-4 mb-4 border-primary">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Question Text *</Label>
                  <Input
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    placeholder="Enter question..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Input
                    value={formData.question_category}
                    onChange={(e) => setFormData({ ...formData, question_category: e.target.value })}
                    placeholder="e.g., Service Rates"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Answer Type</Label>
                  <Select value={formData.answer_type} onValueChange={(val) => setFormData({ ...formData, answer_type: val })}>
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
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Answer Description (Help text for users)</Label>
                <Textarea
                  value={formData.answer_description}
                  onChange={(e) => setFormData({ ...formData, answer_description: e.target.value })}
                  placeholder="Provide guidance on how to answer this question..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        <ScrollArea className="h-[500px]">
          <div className="space-y-6">
            {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
              <div key={category}>
                <h3 className="font-semibold text-lg mb-3 sticky top-0 bg-background py-2">{category}</h3>
                <div className="space-y-3">
                  {categoryQuestions.map((question) => (
                    <Card key={question.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <p className="font-medium">{question.question_text}</p>
                            <span className="text-xs bg-muted px-2 py-1 rounded">{question.answer_type}</span>
                          </div>
                          {question.answer_description && (
                            <p className="text-sm text-muted-foreground">{question.answer_description}</p>
                          )}
                          {question.reference_image_url ? (
                            <div className="mt-2">
                              <img
                                src={question.reference_image_url}
                                alt="Reference"
                                className="max-w-md rounded-lg border"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={() => handleRemoveImage(question.id, question.reference_image_url!)}
                              >
                                <Trash2 className="mr-2 h-3 w-3" />
                                Remove Image
                              </Button>
                            </div>
                          ) : (
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
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(question)}
                            disabled={editingId !== null || isAddingNew}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(question.id)}
                            disabled={editingId !== null || isAddingNew}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
