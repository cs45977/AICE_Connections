import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  Search, 
  Users, 
  Shield, 
  User as UserIcon, 
  LogOut,
  Spade,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { useAuth } from "../lib/auth";

export function Sidebar() {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  const navItems = [
    { name: "Prospects", path: "/contacts", icon: Users },
    { name: "Discovery", path: "/find-prospects", icon: Search },
    { name: "Admin", path: "/admin", icon: Shield, adminOnly: true },
    { name: "Profile", path: "/profile", icon: UserIcon },
  ];

  if (!user) return null;

  return (
    <motion.aside
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial={false}
      animate={{ width: isHovered ? 240 : 80 }}
      className="fixed left-0 top-0 h-screen bg-white border-r-2 border-slate-900 z-[60] flex flex-col shadow-[4px_0_0_0_rgba(15,23,42,0.05)]"
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center px-6 border-b-2 border-slate-900 overflow-hidden shrink-0">
        <Link to="/" className="flex items-center gap-4 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-black shadow-neo-sm transform hover:-rotate-3 transition-transform">
            <Spade className="w-5 h-5 fill-current" />
          </div>
          <AnimatePresence mode="wait">
            {isHovered && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-black text-xl tracking-tighter uppercase whitespace-nowrap"
              >
                AI<span className="text-indigo-600">-</span>CE
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          if (item.adminOnly && role !== "admin") return null;
          const isActive = location.pathname === item.path || (item.path === "/contacts" && location.pathname === "/");
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all group relative ${
                isActive 
                  ? "bg-slate-900 text-white shadow-neo-sm ring-2 ring-slate-900" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "group-hover:text-indigo-600"}`} />
              
              <AnimatePresence>
                {isHovered && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>

              {!isHovered && isActive && (
                <motion.div 
                  layoutId="active-indicator"
                  className="absolute left-0 w-1 h-6 bg-indigo-600 rounded-r-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Section (User & Logout) */}
      <div className="p-4 border-t-2 border-slate-900 space-y-2 bg-white">
        <Link 
          to="/profile"
          className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-50 transition-all group overflow-hidden"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-900 flex items-center justify-center shrink-0 group-hover:border-indigo-600 transition-colors">
            <UserIcon className="w-5 h-5 text-slate-600" />
          </div>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col whitespace-nowrap"
              >
                <span className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Account</span>
                <span className="text-xs font-bold truncate max-w-[140px]">{user.email}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        <button
          onClick={logout}
          className="w-full flex items-center gap-4 p-3 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-all group overflow-hidden"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <AnimatePresence>
            {isHovered && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
