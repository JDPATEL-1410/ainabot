import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import SetupPage from "./pages/SetupPage";
import DashboardPage from "./pages/DashboardPage";
import InboxPage from "./pages/InboxPage";
import ContactsPage from "./pages/ContactsPage";
import TemplatesPage from "./pages/TemplatesPage";
import CampaignsPage from "./pages/CampaignsPage";
import AutomationsPage from "./pages/AutomationsPage";
import TeamPage from "./pages/TeamPage";
import SettingsPage from "./pages/SettingsPage";
import BillingPage from "./pages/BillingPage";
import AdminPage from "./pages/AdminPage";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function WorkspaceRoute({ children }) {
  const { user, workspace, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.workspace_id) return <Navigate to="/setup" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
      <Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />

      <Route path="/dashboard" element={<WorkspaceRoute><DashboardPage /></WorkspaceRoute>} />
      <Route path="/inbox" element={<WorkspaceRoute><InboxPage /></WorkspaceRoute>} />
      <Route path="/contacts" element={<WorkspaceRoute><ContactsPage /></WorkspaceRoute>} />
      <Route path="/templates" element={<WorkspaceRoute><TemplatesPage /></WorkspaceRoute>} />
      <Route path="/campaigns" element={<WorkspaceRoute><CampaignsPage /></WorkspaceRoute>} />
      <Route path="/automations" element={<WorkspaceRoute><AutomationsPage /></WorkspaceRoute>} />
      <Route path="/team" element={<WorkspaceRoute><TeamPage /></WorkspaceRoute>} />
      <Route path="/settings" element={<WorkspaceRoute><SettingsPage /></WorkspaceRoute>} />
      <Route path="/billing" element={<WorkspaceRoute><BillingPage /></WorkspaceRoute>} />
      <Route path="/admin" element={<WorkspaceRoute><AdminPage /></WorkspaceRoute>} />

      <Route path="*" element={<Navigate to={user?.workspace_id ? "/dashboard" : user ? "/setup" : "/login"} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
