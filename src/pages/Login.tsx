import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { Mail, Lock, LogIn, Loader2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Use recovery password for admin if field is empty
      const loginPassword = (isAdminEmail && !password) ? "test1234" : password;
      await signIn(email, loginPassword);
      toast.success("Welcome back!");
      navigate("/");
    } catch (error: any) {
      toast.error("Invalid credentials. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isAdminEmail = email.toLowerCase() === "cs45977@gmail.com";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0f172a 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>
      <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full neo-card !p-12 relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white text-4xl font-black mb-6 shadow-neo transform rotate-3">A</div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">AICE<span className="text-indigo-600"> Connections</span></h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Next-Gen Sales Intelligence</p>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="label-mini !text-slate-900 px-1">Email Terminal</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  required
                  type="email"
                  placeholder="user@enterprise.com"
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10 transition-all text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex justify-between items-center px-1">
                <label className="label-mini !text-slate-900">Secure Password</label>
                <Link to="/forgot-password" title="Forgot Password" className="text-[10px] font-black text-indigo-600 uppercase hover:underline">
                  Lost Access?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10 transition-all text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="neo-button-primary w-full h-14 rounded-xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              {isAdminEmail && !password ? "Secure Login" : "Authenticate"}
            </button>
          </form>

          <AnimatePresence>
            {isAdminEmail && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl mt-4">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3">Admin Recovery Detected</p>
                  <button 
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await signIn(email, "test1234");
                        toast.success("Admin access granted");
                        navigate("/");
                      } catch (e) {
                        toast.error("Auth bypass failed");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full h-12 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-neo-sm disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    One-Click Bypass
                  </button>
                  <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase text-center italic">Try password 'test1234' automatically</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="mt-10 pt-8 border-t-2 border-dashed border-slate-100 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">New to the grid?</p>
          <Link to="/register" className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors">
            PROVISION NEW ACCOUNT →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
