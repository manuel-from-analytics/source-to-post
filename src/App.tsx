import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
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
import NotFound from "@/pages/NotFound";
import { clearStoredAuthDestination, readStoredAuthDestination } from "@/lib/auth-navigation";

const queryClient = new QueryClient();

function RootRedirect() {
  const { user, loading } = useAuth();

  // The auth SDK owns URL detection and the one-time OAuth code exchange,
  // so we only wait for it to settle before routing.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const next = readStoredAuthDestination();
  clearStoredAuthDestination();
  return <Navigate to={next} replace />;
}


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/index" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/auth/callback" element={<Navigate to="/" replace />} />
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
