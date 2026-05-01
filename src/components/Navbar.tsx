import { useAuth } from "../lib/auth";
import { LogOut, User as UserIcon, LayoutDashboard, Users } from "lucide-react";
import { Link } from "react-router-dom";

export function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="bg-white border-b-2 border-slate-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-black shadow-neo-sm transform group-hover:-rotate-3 transition-transform">A</div>
            <span className="font-black text-xl tracking-tighter uppercase">AICE<span className="text-indigo-600"> Connections</span></span>
          </Link>
          
          <div className="hidden md:flex items-center gap-2">
            <Link to="/" className="px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">Prospects</Link>
            <Link to="/contacts" className="px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors">Insights</Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Authenticated as</p>
              <p className="text-xs font-bold truncate max-w-[150px]">{user.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-900"></div>
          </div>
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
