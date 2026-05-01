import { useAuth } from "../lib/auth";
import { Chrome, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function Login() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] p-6 relative overflow-hidden">
      {/* Decorative patterns */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0f172a 2px, transparent 2px)', backgroundSize: '32px 32px' }}></div>
      <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full neo-card !p-12 relative z-10 text-center"
      >
        <div className="mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white text-4xl font-black mb-6 shadow-neo transform rotate-3">A</div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">AICE<span className="text-indigo-600"> Connections</span></h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Next-Gen Sales Intelligence</p>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 text-left">
            <h2 className="label-mini !text-slate-900 mb-4">Core Operating Systems</h2>
            <ul className="space-y-3 font-bold text-xs text-slate-600 uppercase tracking-tight">
              {[
                "Autonomous Research Agent",
                "Personalization Synthesis",
                "Workspace Direct Export",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <button 
            className="neo-button-primary w-full h-14 rounded-xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest"
            onClick={signIn}
          >
            <Chrome className="w-5 h-5" />
            Connect via Google SSO
          </button>
          
          <div className="pt-4 flex flex-col items-center gap-2">
            <span className="label-mini">Enterprise Restricted Access</span>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div>)}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
