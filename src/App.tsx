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
import AgentPage from "@/pages/AgentPage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function RootRedirect() {
  const navigate = useNavigate();
  const hasOAuthHash =
    typeof window !== "undefined" && window.location.hash.includes("access_token");

  useEffect(() => {
    if (!hasOAuthHash) return;
    // Poll briefly for Supabase to process the hash and set the session,
    // then clean the URL and navigate to the dashboard.
    let cancelled = false;
    const start = Date.now();
    const interval = setInterval(async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session || Date.now() - start > 5000) {
        clearInterval(interval);
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/dashboard", { replace: true });
      }
    }, 100);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasOAuthHash, navigate]);

  if (hasOAuthHash) {
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/agent" element={<ProtectedRoute><AppLayout><AgentPage /></AppLayout></ProtectedRoute>} />
      <Route path="/newsletter" element={<ProtectedRoute><AppLayout><NewsletterPage /></AppLayout></ProtectedRoute>} />
      <Route path="/library" element={<ProtectedRoute><AppLayout><LibraryPage /></AppLayout></ProtectedRoute>} />
      <Route path="/library/:id" element={<ProtectedRoute><AppLayout><InputDetailPage /></AppLayout></ProtectedRoute>} />
      <Route path="/voice" element={<ProtectedRoute><AppLayout><VoicePage /></AppLayout></ProtectedRoute>} />
      <Route path="/generator" element={<ProtectedRoute><AppLayout><GeneratorPage /></AppLayout></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><AppLayout><HistoryPage /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><AppLayout><InstallPage /></AppLayout></ProtectedRoute>} />
      <Route path="/mcp" element={<ProtectedRoute><AppLayout><McpPage /></AppLayout></ProtectedRoute>} />
      <Route path="/unsubscribe" element={<UnsubscribePage />} />
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
