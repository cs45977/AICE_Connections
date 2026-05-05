import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Dashboard } from "./pages/Dashboard";
import { ContactDetail } from "./pages/ContactDetail";
import { NewContact } from "./pages/NewContact";
import { FindProspects } from "./pages/FindProspects";
import { Admin } from "./pages/Admin";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Navbar } from "./components/Navbar";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin opacity-20" />
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <Navbar />
      <main>
        {children}
      </main>
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin opacity-20" />
    </div>
  );
  
  if (!user || role !== "admin") return <Navigate to="/" />;
  
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <Navbar />
      <main>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } 
          />
          <Route 
            path="/contacts" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/find-prospects" 
            element={
              <ProtectedRoute>
                <FindProspects />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/contact/new" 
            element={
              <ProtectedRoute>
                <NewContact />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/contact/:id" 
            element={
              <ProtectedRoute>
                <ContactDetail />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
