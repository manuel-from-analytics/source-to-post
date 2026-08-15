import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage, SignupPage } from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import LibraryPage from "@/pages/LibraryPage";
import InputDetailPage from "@/pages/InputDetailPage";
import GeneratorPage from "@/pages/GeneratorPage";
import HistoryPage from "@/pages/HistoryPage";
import SettingsPage from "@/pages/SettingsPage";
import VoicePage from "@/pages/VoicePage";
import NewsletterPage from "@/pages/NewsletterPage";
import InstallPage from "@/pages/InstallPage";
import McpPage from "@/pages/McpPage";
import PerformancePage from "@/pages/PerformancePage";
import AgentPage from "@/pages/AgentPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import OAuthConsentPage from "@/pages/OAuthConsent";
import AuthCallback from "@/pages/AuthCallback";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  return raw;
}

function RootRedirect() {
  const navigate = useNavigate();
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const hasOAuthResponse = [
    "access_token",
    "refresh_token",
    "code",
    "error",
    "error_description",
  ].some((key) => hashParams.has(key) || queryParams.has(key));

  useEffect(() => {
    if (!hasOAuthResponse) return;
    let cancelled = false;

    const finishOAuth = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
      const code = queryParams.get("code");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }

      const deadline = Date.now() + 15_000;
      let authenticated = false;
      while (!cancelled && Date.now() < deadline) {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) {
          authenticated = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (cancelled) return;

      let next = "/dashboard";
      try {
        next = safeNext(sessionStorage.getItem("postflow:next"));
        sessionStorage.removeItem("postflow:next");
      } catch { /* ignore */ }
      window.history.replaceState(null, "", window.location.pathname);
      navigate(authenticated ? next : "/login", { replace: true });
    };

    void finishOAuth();
    return () => {
      cancelled = true;
    };
  }, [hasOAuthResponse, navigate]);

  if (hasOAuthResponse) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  return <Navigate to="/dashboard" replace />;
}


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/index" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/agent" element={<ProtectedRoute><AppLayout><AgentPage /></AppLayout></ProtectedRoute>} />
      <Route path="/newsletter" element={<ProtectedRoute><AppLayout><NewsletterPage /></AppLayout></ProtectedRoute>} />
      <Route path="/library" element={<ProtectedRoute><AppLayout><LibraryPage /></AppLayout></ProtectedRoute>} />
      <Route path="/library/:id" element={<ProtectedRoute><AppLayout><InputDetailPage /></AppLayout></ProtectedRoute>} />
      <Route path="/voice" element={<ProtectedRoute><AppLayout><VoicePage /></AppLayout></ProtectedRoute>} />
      <Route path="/generator" element={<ProtectedRoute><AppLayout><GeneratorPage /></AppLayout></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><AppLayout><HistoryPage /></AppLayout></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute><AppLayout><PerformancePage /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><AppLayout><InstallPage /></AppLayout></ProtectedRoute>} />
      <Route path="/mcp" element={<ProtectedRoute><AppLayout><McpPage /></AppLayout></ProtectedRoute>} />
      <Route path="/unsubscribe" element={<UnsubscribePage />} />
      <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <AppRoutes />
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
