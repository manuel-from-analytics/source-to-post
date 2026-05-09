import { useState, useEffect } from "react";
import { Copy, Check, Key, Plug, Terminal, RefreshCw, Bot, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateAgentKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `pfk_${b64}`;
}

type AgentKeyRow = { id: string; name: string; created_at: string; last_used_at: string | null };

export default function McpPage() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [agentKeys, setAgentKeys] = useState<AgentKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [freshAgentKey, setFreshAgentKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  const loadAgentKeys = async () => {
    const { data } = await supabase.from("agent_api_keys").select("id, name, created_at, last_used_at").order("created_at", { ascending: false });
    setAgentKeys((data as AgentKeyRow[]) || []);
  };
  useEffect(() => { if (session) loadAgentKeys(); }, [session]);

  const createAgentKey = async () => {
    if (!newKeyName.trim() || !session?.user) return;
    setCreatingKey(true);
    try {
      const key = generateAgentKey();
      const hash = await sha256Hex(key);
      const { error } = await supabase.from("agent_api_keys").insert({ user_id: session.user.id, name: newKeyName.trim(), key_hash: hash });
      if (error) throw error;
      setFreshAgentKey(key);
      setNewKeyName("");
      await loadAgentKeys();
      toast.success("Agent key creada. Cópiala ahora; no se mostrará de nuevo.");
    } catch (e: any) {
      toast.error(e.message || "Error al crear");
    } finally {
      setCreatingKey(false);
    }
  };

  const deleteAgentKey = async (id: string) => {
    const { error } = await supabase.from("agent_api_keys").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await loadAgentKeys();
  };

  const mcpUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server`;

  useEffect(() => {
    if (session?.access_token) {
      setToken(session.access_token);
    }
  }, [session]);

  const refreshToken = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        toast.error(t("mcp.tokenRefreshError"));
        return;
      }
      setToken(data.session.access_token);
      toast.success(t("mcp.tokenRefreshed"));
    } catch {
      toast.error(t("mcp.tokenRefreshError"));
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success(t("mcp.copied"));
    setTimeout(() => setCopied(null), 2000);
  };

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const claudeConfig = JSON.stringify({
    "mcpServers": {
      "postflow": {
        "url": mcpUrl,
        "headers": {
          "Authorization": `Bearer ${anonKey}`,
          "x-user-token": token
        }
      }
    }
  }, null, 2);

  const cursorConfig = JSON.stringify({
    "mcpServers": {
      "postflow": {
        "url": mcpUrl,
        "headers": {
          "Authorization": `Bearer ${anonKey}`,
          "x-user-token": token
        }
      }
    }
  }, null, 2);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("mcp.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("mcp.subtitle")}</p>
      </div>

      {/* Token Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-primary" />
            {t("mcp.tokenTitle")}
          </CardTitle>
          <CardDescription>{t("mcp.tokenDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="bg-muted rounded-lg p-3 text-xs font-mono break-all whitespace-pre-wrap max-h-24 overflow-y-auto text-foreground">
              {token || t("mcp.noToken")}
            </pre>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(token, "token")}
              disabled={!token}
            >
              {copied === "token" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {t("mcp.copyToken")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshToken}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t("mcp.refreshToken")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("mcp.tokenWarning")}</p>
        </CardContent>
      </Card>

      {/* URL Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plug className="h-5 w-5 text-primary" />
            {t("mcp.urlTitle")}
          </CardTitle>
          <CardDescription>{t("mcp.urlDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted rounded-lg p-3 text-sm font-mono text-foreground break-all">
              {mcpUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(mcpUrl, "url")}
            >
              {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Claude Desktop Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="h-5 w-5 text-primary" />
            {t("mcp.claudeTitle")}
          </CardTitle>
          <CardDescription>{t("mcp.claudeDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("mcp.claudeInstructions")}</p>
          <div className="relative">
            <pre className="bg-muted rounded-lg p-3 text-xs font-mono break-all whitespace-pre-wrap text-foreground">
              {claudeConfig}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(claudeConfig, "claude")}
            >
              {copied === "claude" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cursor Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="h-5 w-5 text-primary" />
            {t("mcp.cursorTitle")}
          </CardTitle>
          <CardDescription>{t("mcp.cursorDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("mcp.cursorInstructions")}</p>
          <div className="relative">
            <pre className="bg-muted rounded-lg p-3 text-xs font-mono break-all whitespace-pre-wrap text-foreground">
              {cursorConfig}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard(cursorConfig, "cursor")}
            >
              {copied === "cursor" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("mcp.toolsTitle")}</CardTitle>
          <CardDescription>{t("mcp.toolsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {[
              { name: "list_inputs", desc: "mcp.tool.listInputs" },
              { name: "get_input", desc: "mcp.tool.getInput" },
              { name: "create_input", desc: "mcp.tool.createInput" },
              { name: "delete_input", desc: "mcp.tool.deleteInput" },
              { name: "list_posts", desc: "mcp.tool.listPosts" },
              { name: "get_post", desc: "mcp.tool.getPost" },
              { name: "generate_post", desc: "mcp.tool.generatePost" },
              { name: "save_post", desc: "mcp.tool.savePost" },
              { name: "update_post", desc: "mcp.tool.updatePost" },
              { name: "delete_post", desc: "mcp.tool.deletePost" },
              { name: "list_voices", desc: "mcp.tool.listVoices" },
              { name: "list_newsletters", desc: "mcp.tool.listNewsletters" },
              { name: "get_newsletter", desc: "mcp.tool.getNewsletter" },
            ].map((tool) => (
              <div key={tool.name} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                <code className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded shrink-0">
                  {tool.name}
                </code>
                <span className="text-sm text-muted-foreground">{t(tool.desc)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
