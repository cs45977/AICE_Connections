import React from "react";
import { Search, Zap, Building2, UserPlus, Info, BookOpen, ChevronRight, Menu, MessageSquare, Database, Sparkles, LayoutDashboard, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

const sections = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <BookOpen className="w-5 h-5 text-blue-600" />,
    content: "AI-CE is an advanced Executive Prospecting & Intelligence platform. It leverages AI personas to discover decision-makers and generate deep corporate insights automatically."
  },
  {
    id: "prospect-discovery",
    title: "Prospect Discovery",
    icon: <Search className="w-5 h-5 text-indigo-600" />,
    content: "Run targeted scans for specific companies. Select a persona to tailor the search criteria and generate questions that clarify your ideal prospect profile."
  },
  {
    id: "bulk-discovery",
    title: "Bulk Discovery",
    icon: <Zap className="w-5 h-5 text-amber-500" />,
    content: "Upload a CSV with company names and websites to process multiple companies at once. Prospects found are automatically added to your list with 'bulk prospect' labels."
  },
  {
    id: "company-intelligence",
    title: "Company Intelligence",
    icon: <Database className="w-5 h-5 text-green-600" />,
    content: "View deep-dive reports for every company discovered. Reports are versioned, allowing you to track how intelligence evolves based on different personas or instructions."
  },
  {
    id: "executive-personas",
    title: "Executive Personas",
    icon: <UserPlus className="w-5 h-5 text-purple-600" />,
    content: "Customize AI agents with specific roles (e.g., Strategic Advisor) and requirements. These personas influence how prospects are ranked and intelligence is framed."
  },
  {
    id: "pipeline-analytics",
    title: "Pipeline Analytics",
    icon: <TrendingUp className="w-5 h-5 text-indigo-600" />,
    content: "Track your outreach velocity and Conversion Potential. Our AI evaluates your current pipeline's probability of success based on Persona match quality and contact veracity."
  }
];

export function Documentation() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <div className="w-full lg:w-72 bg-white border-r border-slate-200 p-8 sticky top-0 h-screen hidden lg:block overflow-y-auto">
        <div className="flex items-center gap-3 mb-12">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight">AI-CE Docs</h1>
        </div>

        <nav className="space-y-8">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Core Concepts</h2>
            <ul className="space-y-2">
              {sections.map(s => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-sm font-bold text-slate-600 transition-colors">
                    {s.icon}
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-6 bg-indigo-50 rounded-2xl border-2 border-indigo-100">
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Need Support?</p>
            <p className="text-xs font-bold text-slate-600 mb-4 leading-relaxed">Our AI engineering team is ready to help you optimize your pipeline.</p>
            <button className="w-full py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors">
              Contact Sales
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 max-w-4xl mx-auto px-6 py-12 lg:py-24">
        <header className="mb-16">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full">v1.2.1 Release</span>
            <span className="text-slate-300">/</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Platform Documentation</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">
            Scale Your <span className="text-indigo-600">Enterprise</span> Prospecting
          </h1>
          <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-2xl">
            Learn how to leverage AI-CE's automated intelligence engine to discover, research, and engage with high-value decision makers at scale.
          </p>
        </header>

        <main className="space-y-24">
          {sections.map((s, idx) => (
            <motion.section 
              key={s.id}
              id={s.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="scroll-mt-24"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-neo-sm transform -rotate-3 text-indigo-600">
                  {s.icon}
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight">{s.title}</h2>
              </div>
              
              <div className="neo-card bg-white !p-8 shadow-sm hover:shadow-neo transition-all">
                <p className="text-lg text-slate-600 leading-relaxed font-medium mb-8">
                  {s.content}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Core Features</h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-xs font-bold text-slate-900 uppercase">
                        <ChevronRight className="w-3 h-3 text-indigo-600 mt-0.5" /> Real-time Global Scan
                      </li>
                      <li className="flex items-start gap-2 text-xs font-bold text-slate-900 uppercase">
                        <ChevronRight className="w-3 h-3 text-indigo-600 mt-0.5" /> Persona-based Filtering
                      </li>
                      <li className="flex items-start gap-2 text-xs font-bold text-slate-900 uppercase">
                        <ChevronRight className="w-3 h-3 text-indigo-600 mt-0.5" /> Intelligence Versioning
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Best Practices</h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-xs font-bold text-slate-600 uppercase">
                        <Sparkles className="w-3 h-3 text-amber-500 mt-0.5" /> Use descriptive requirements
                      </li>
                      <li className="flex items-start gap-2 text-xs font-bold text-slate-600 uppercase">
                        <Sparkles className="w-3 h-3 text-amber-500 mt-0.5" /> Regularly sync bulk labels
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.section>
          ))}
        </main>

        <footer className="mt-32 pt-16 border-t font-black border-slate-900 flex flex-col md:flex-row justify-between gap-8 py-12">
           <div>
              <p className="text-2xl uppercase tracking-tighter mb-2">AI-CE Platform</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest">© 2024 Strategic Pipeline Technologies</p>
           </div>
           <div className="flex gap-8">
              <Link to="/" className="text-sm uppercase tracking-widest hover:text-indigo-600">Dashboard</Link>
              <Link to="/find-prospects" className="text-sm uppercase tracking-widest hover:text-indigo-600">Discovery</Link>
              <Link to="/bulk-discovery" className="text-sm uppercase tracking-widest hover:text-indigo-600">Bulk</Link>
           </div>
        </footer>
      </div>
    </div>
  );
}
