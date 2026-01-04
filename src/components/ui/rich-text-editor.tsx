import { useRef, useState, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Type or paste (Cmd+V) your notes here...",
  className
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Tight allowlist for sanitization
  const purifyConfig = useMemo(() => ({
    ALLOWED_TAGS: [
      "p", "br", "div", "span",
      "b", "strong", "i", "em", "u",
      "ul", "ol", "li",
      "blockquote",
      "h1", "h2", "h3",
      "a",
      "img"
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel",
      "src", "alt",
      "style"
    ],
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["svg", "math", "script", "iframe", "object", "embed", "link", "meta"],
    KEEP_CONTENT: false
  }), []);

  const sanitizeHtml = (html: string) => {
    const clean = DOMPurify.sanitize(html ?? "", purifyConfig);

    // Extra guardrail: ensure anchors are safe
    const tmp = document.createElement("div");
    tmp.innerHTML = clean;

    tmp.querySelectorAll("a").forEach((a) => {
      const href = (a.getAttribute("href") || "").trim();
      const isSafe =
        href.startsWith("/") ||
        href.startsWith("#") ||
        /^https?:\/\//i.test(href) ||
        /^mailto:/i.test(href) ||
        /^tel:/i.test(href);

      if (!isSafe) a.removeAttribute("href");

      if (a.getAttribute("target") === "_blank") {
        const rel = (a.getAttribute("rel") || "").toLowerCase();
        const needed = ["noopener", "noreferrer"];
        const merged = Array.from(new Set([...rel.split(/\s+/).filter(Boolean), ...needed]));
        a.setAttribute("rel", merged.join(" "));
      }
    });

    return tmp.innerHTML;
  };

  const emitChange = () => {
    if (!editorRef.current) return;
    const dirty = editorRef.current.innerHTML;
    const clean = sanitizeHtml(dirty);

    if (clean !== dirty) editorRef.current.innerHTML = clean;
    onChange(clean);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        setIsUploading(true);

        try {
          const fileExt = file.type.split("/")[1];
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error } = await supabase.storage
            .from("note-attachments")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: false
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from("note-attachments")
            .getPublicUrl(filePath);

          const img = document.createElement("img");
          img.src = publicUrl;
          img.alt = "Pasted image";
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          img.style.display = "block";
          img.style.margin = "8px 0";

          if (editorRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.insertNode(img);
              range.collapse(false);
            } else {
              editorRef.current.appendChild(img);
            }

            emitChange();
          }

          toast({ title: "Success", description: "Image pasted successfully" });
        } catch (error) {
          console.error("Error uploading image:", error);
          toast({
            title: "Error",
            description: "Failed to upload image",
            variant: "destructive"
          });
        } finally {
          setIsUploading(false);
        }

        return;
      }
    }

    // Sanitize HTML paste
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");

    if (html) {
      e.preventDefault();
      const clean = sanitizeHtml(html);
      document.execCommand("insertHTML", false, clean);
      emitChange();
      return;
    }

    if (text) {
      e.preventDefault();
      document.execCommand("insertText", false, text);
      emitChange();
    }
  };

  const handleInput = () => {
    emitChange();
  };

  // Sanitize value before setting innerHTML
  useEffect(() => {
    if (!editorRef.current) return;

    const cleanValue = sanitizeHtml(value ?? "");
    if (editorRef.current.innerHTML !== cleanValue) {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const startOffset = range?.startOffset;
      const endOffset = range?.endOffset;

      editorRef.current.innerHTML = cleanValue;

      if (range && startOffset !== undefined && endOffset !== undefined) {
        try {
          const newRange = document.createRange();
          const textNode = editorRef.current.firstChild;
          if (textNode) {
            newRange.setStart(textNode, Math.min(startOffset, textNode.textContent?.length || 0));
            newRange.setEnd(textNode, Math.min(endOffset, textNode.textContent?.length || 0));
            selection?.removeAllRanges();
            selection?.addRange(newRange);
          }
        } catch {
          // Cursor restoration failed, ignore
        }
      }
    }
  }, [value]);

  return (
    <div className="relative">
      <div
        ref={editorRef}
        contentEditable
        onPaste={handlePaste}
        onInput={handleInput}
        suppressContentEditableWarning
        className={cn(
          "min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "prose prose-sm max-w-none",
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2",
          className
        )}
        data-placeholder={placeholder}
        style={{
          position: 'relative',
        }}
      />
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          cursor: text;
        }
      `}</style>
    </div>
  );
};
