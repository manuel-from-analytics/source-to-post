import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface GenerateParams {
  input_ids: string[];
  goal?: string;
  tone?: string;
  language?: string;
  length?: string;
  cta?: string;
  target_audience?: string;
  content_focus?: string;
  iteration_prompt?: string;
  previous_content?: string;
  voice_id?: string;
}

export function useGeneratePost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState("");

  const cleanLeadingBrackets = (text: string) =>
    text.replace(/^\s*\[.*?\]\s*/g, "");
  const generate = async (params: GenerateParams) => {
    if (!user) return;
    setIsGenerating(true);
    if (!params.iteration_prompt) setContent("");

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("No autenticado");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-post`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(params),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let accumulated = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) { accumulated += delta; setContent(accumulated); }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) { accumulated += delta; setContent(accumulated); }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Error al generar el post");
    } finally {
      setIsGenerating(false);
    }
  };

  const savePost = async (params: {
    content: string;
    input_id?: string;
    goal?: string;
    tone?: string;
    target_audience?: string;
    title?: string;
    language?: string;
    cta?: string;
    length?: string;
    content_focus?: string;
    voice_id?: string;
  }) => {
    if (!user) return;
    const { error } = await supabase.from("generated_posts").insert({
      user_id: user.id,
      content: params.content,
      input_id: params.input_id || null,
      goal: params.goal || null,
      tone: params.tone || null,
      target_audience: params.target_audience || null,
      title: params.title || null,
      language: params.language || null,
      cta: params.cta || null,
      length: params.length || null,
      content_focus: params.content_focus || null,
      voice_id: params.voice_id || null,
      status: "draft",
    } as any);
    if (error) {
      toast.error("Error al guardar el post");
    } else {
      toast.success("Post guardado como borrador");
      queryClient.invalidateQueries({ queryKey: ["posts-count"] });
    }
  };

  return { generate, savePost, isGenerating, content, setContent };
}
