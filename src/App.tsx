import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import ErrorBoundary from "./components/ErrorBoundary";
import { ActiveAssessmentProvider } from "./contexts/ActiveAssessmentContext";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AuthPage from "./components/auth/AuthPage";
import { Loader2 } from "lucide-react";
import ConsentGate from "./components/legal/ConsentGate";
import LegalPage from "./pages/LegalPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, initialized } = useAuth();
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <AuthPage />;
  return <>{children}</>;
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ActiveAssessmentProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/termos" element={<LegalPage kind="termos" />} />
                  <Route path="/privacidade" element={<LegalPage kind="privacidade" />} />
                  <Route path="/" element={<AuthGate><ConsentGate><Index /></ConsentGate></AuthGate>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </TooltipProvider>
            </ActiveAssessmentProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
