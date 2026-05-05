import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Mail, Key, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setIsSent(true);
      toast.success("Reset link sent if account exists");
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0f172a 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full neo-card !p-12 relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-black mb-6 shadow-neo transform -rotate-3">
             <Key className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">Access Recovery</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Reset your secure key</p>
        </div>

        {isSent ? (
          <div className="text-center space-y-6">
            <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-2xl">
               <p className="text-sm font-bold text-indigo-900 leading-relaxed">
                 An authentication reset link has been dispatched to <span className="underline">{email}</span>. Please check your inbox.
               </p>
            </div>
            <Link to="/login" className="flex items-center justify-center gap-2 text-xs font-black uppercase text-slate-500 hover:text-slate-900 transition-colors">
               <ArrowLeft className="w-4 h-4" /> Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="label-mini !text-slate-900 px-1">Registered Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  required
                  type="email"
                  placeholder="email@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10 transition-all text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="neo-button-primary w-full h-14 rounded-xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
              Send Reset Link
            </button>

            <p className="text-center">
              <Link to="/login" className="text-xs font-black uppercase text-slate-400 hover:text-slate-900 transition-colors">
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
