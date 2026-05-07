import React from "react";
import { useAuth } from "../lib/auth";
import { LogOut, User as UserIcon, LayoutDashboard, Users, Shield, Search, Spade, Mail, TrendingUp, Zap, BookOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function Navbar() {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const [configStatus, setConfigStatus] = React.useState<{ geminiKey: boolean, env: string, build?: string } | null>(null);
  const buildVersion = configStatus?.build || "v1.0.47";

  React.useEffect(() => {
    if (role === "admin") {
      fetch("/api/config/status")
        .then(res => res.json())
        .then(data => setConfigStatus(data))
        .catch(() => {});
    }
  }, [role]);

  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;
  
  const getNavLinkClass = (path: string, activeClass: string = "bg-indigo-50 text-indigo-700") => {
    const baseClass = "px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2";
    return isActive(path) 
      ? `${baseClass} ${activeClass}` 
      : `${baseClass} hover:bg-slate-100 text-slate-600`;
  };

  return (
    <nav className="bg-white border-b-2 border-slate-900 sticky top-0 z-50">
      {role === "admin" && (
        <div className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.3em] py-1 px-6 text-center flex items-center justify-center gap-4">
          <span>Internal Build {buildVersion} • Administrative Console ({configStatus?.env || "..."})</span>
          {configStatus && !configStatus.geminiKey && (
            <span className="bg-red-500 px-2 py-0.5 rounded animate-pulse">
              ⚠️ Gemini Key Missing in {configStatus.env === 'development' ? 'Workspace' : 'Deployment'}
            </span>
          )}
        </div>
      )}
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-black shadow-neo-sm transform group-hover:-rotate-3 transition-transform">
              <Spade className="w-5 h-5 fill-current" />
            </div>
            <span className="font-black text-xl tracking-tighter uppercase">AI<span className="text-indigo-600">-</span>CE</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-2">
            <Link to="/" className={getNavLinkClass("/")}>
               <Users className={`w-4 h-4 ${isActive("/") ? "text-indigo-600" : "text-slate-400"}`} />
               Prospects
            </Link>
            <Link to="/find-prospects" className={getNavLinkClass("/find-prospects")}>
               <Search className={`w-4 h-4 ${isActive("/find-prospects") ? "text-indigo-600" : "text-slate-400"}`} /> 
               Discovery
            </Link>
            <Link to="/bulk-discovery" className={getNavLinkClass("/bulk-discovery")}>
               <Zap className={`w-4 h-4 ${isActive("/bulk-discovery") ? "text-indigo-600" : "text-slate-400"}`} /> 
               Bulk
            </Link>
            <Link to="/intelligence" className={getNavLinkClass("/intelligence")}>
               <LayoutDashboard className={`w-4 h-4 ${isActive("/intelligence") ? "text-indigo-600" : "text-slate-400"}`} /> 
               Intelligence
            </Link>
            <Link to="/contacts" className={getNavLinkClass("/contacts")}>
               <TrendingUp className={`w-4 h-4 ${isActive("/contacts") ? "text-indigo-600" : "text-slate-400"}`} />
               Insights
            </Link>
            <Link to="/unsent-drafts" className={getNavLinkClass("/unsent-drafts", "bg-indigo-50 text-indigo-700 shadow-neo-sm border border-indigo-200")}>
              <Mail className={`w-4 h-4 ${isActive("/unsent-drafts") ? "text-indigo-700" : "text-indigo-400"}`} />
              Drafts
            </Link>
            <Link to="/docs" className={getNavLinkClass("/docs")}>
              <BookOpen className={`w-4 h-4 ${isActive("/docs") ? "text-indigo-600" : "text-slate-400"}`} />
              Docs
            </Link>
            {role === "admin" && (
              <Link to="/admin" className={`px-3 py-1.5 rounded-lg text-sm font-black transition-colors flex items-center gap-2 ${isActive("/admin") ? "bg-indigo-100 text-indigo-800" : "text-indigo-600 hover:bg-indigo-50"}`}>
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/profile" className="hidden sm:flex items-center gap-3 pr-4 border-r border-slate-200 group">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1 group-hover:text-indigo-600 transition-colors">Authenticated as</p>
              <p className="text-xs font-bold truncate max-w-[150px]">{user.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-900 overflow-hidden flex items-center justify-center group-hover:border-indigo-600 transition-colors">
              <UserIcon className="w-4 h-4 text-slate-600" />
            </div>
          </Link>
          <button 
            onClick={logout} 
            className="neo-button-outline !px-3 !py-1 text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
