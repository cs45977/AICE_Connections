import React, { useState } from "react";
import { useAuth } from "../lib/auth";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { UserPlus, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(formData.email, formData.password, formData.name);
      toast.success("Account created successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
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
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-black mb-6 shadow-neo transform rotate-3">R</div>
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-2">Initialize Account</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Join the Intelligence Network</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="label-mini !text-slate-900 px-1">Full Name</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                required
                type="text"
                placeholder="John Doe"
                className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10 transition-all text-sm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="label-mini !text-slate-900 px-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                required
                type="email"
                placeholder="email@company.com"
                className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10 transition-all text-sm"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="label-mini !text-slate-900 px-1">Access Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                required
                type="password"
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10 transition-all text-sm"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="neo-button-primary w-full h-14 rounded-xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
            Provision Account
          </button>
        </form>

        <p className="mt-8 text-center text-xs font-bold text-slate-400">
          ALREADY A MEMBER? <Link to="/login" className="text-indigo-600 hover:underline">SIGN IN HERE</Link>
        </p>
      </motion.div>
    </div>
  );
}
