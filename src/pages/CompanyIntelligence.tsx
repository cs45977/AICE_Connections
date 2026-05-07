import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, getDoc, where } from "firebase/firestore";
import { Search, Building2, ExternalLink, Linkedin, Info, Zap, ChevronRight, FileText, Globe, Sparkles, LayoutDashboard, Database, ArrowLeft, Loader2, History, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";

interface Report {
  id: string;
  content: string;
  personaId: string;
  personaName: string;
  instructions: string;
  createdAt: string;
}

interface Prospect {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  linkedin: string;
  labels: string[];
}

interface Company {
  id: string;
  name: string;
  url: string;
  linkedinUrl?: string;
  latestIntelligence: string;
  summary: string;
  personaId?: string;
  createdBy: string;
  updatedAt: string;
}

export function CompanyIntelligence() {
  const { user } = useAuth();
  const { companyId: routeId } = useParams();
  const navigate = useNavigate();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Fetch companies
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "companies"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Company[];
      setCompanies(list);
      setLoading(false);
    });
  }, [user]);

  // Fetch company specific data (Reports & Prospects)
  useEffect(() => {
    if (!viewingCompany || !user) return;

    // Reports History
    const reportsQ = query(collection(db, "companies", viewingCompany.id, "reports"), orderBy("createdAt", "desc"));
    const unsubReports = onSnapshot(reportsQ, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Report[];
      setReports(list);
      if (list.length > 0 && !selectedReportId) {
        setSelectedReportId(list[0].id);
      }
    });

    // Company Prospects
    const prospectsQ = query(collection(db, "contacts"), where("company", "==", viewingCompany.name));
    const unsubProspects = onSnapshot(prospectsQ, (snap) => {
      setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Prospect[]);
    });

    return () => {
      unsubReports();
      unsubProspects();
    };
  }, [viewingCompany, user]);

  const activeReport = reports.find(r => r.id === selectedReportId) || (reports.length > 0 ? reports[0] : null);

  // Handle direct link to company
  useEffect(() => {
    if (routeId) {
      const found = companies.find(c => c.id === routeId);
      if (found) {
        setViewingCompany(found);
      } else {
        // Fallback for direct page load if list not ready
        const fetchCompany = async () => {
          const snap = await getDoc(doc(db, "companies", routeId));
          if (snap.exists()) {
            setViewingCompany({ id: snap.id, ...snap.data() } as Company);
          }
        };
        fetchCompany();
      }
    } else {
      setViewingCompany(null);
    }
  }, [routeId, companies]);

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.latestIntelligence && c.latestIntelligence.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (viewingCompany) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <button 
          onClick={() => navigate("/intelligence")}
          className="mb-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Intelligence Hub
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border-2 border-slate-900 rounded-3xl p-8 shadow-neo">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-neo-sm transform -rotate-3">
                {viewingCompany.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">{viewingCompany.name}</h1>
                <div className="flex items-center gap-4">
                  <a href={viewingCompany.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                    <Globe className="w-3 h-3" /> {new URL(viewingCompany.url).hostname}
                  </a>
                  {viewingCompany.linkedinUrl && (
                    <a href={viewingCompany.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                      <Linkedin className="w-3 h-3" /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Link 
                to={`/find-prospects?company=${encodeURIComponent(viewingCompany.name)}`}
                className="h-14 px-8 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-900 shadow-neo transition-all flex items-center gap-2"
              >
                <Search className="w-4 h-4" /> Run New Scan
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Left Sidebar: Version History */}
            <div className="space-y-6">
              <div className="neo-card !border-slate-200">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" /> Version History
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedReportId === report.id
                          ? "border-indigo-600 bg-indigo-50 shadow-neo-sm"
                          : "border-slate-100 bg-white hover:border-indigo-200"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[10px] font-black uppercase text-indigo-600">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-800 line-clamp-1">{report.personaName}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-1 italic line-clamp-2">"{report.instructions}"</p>
                    </button>
                  ))}
                  {reports.length === 0 && (
                    <p className="text-center text-[10px] font-black text-slate-400 uppercase py-4">No historical versions</p>
                  )}
                </div>
              </div>

              <div className="neo-card !border-slate-200">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" /> Internal Prospects
                </h3>
                <div className="space-y-3">
                  {prospects.map((p) => (
                    <Link
                      key={p.id}
                      to={`/contact/${p.id}`}
                      className="block p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-white transition-all group"
                    >
                      <p className="text-xs font-black uppercase text-slate-900 group-hover:text-indigo-600">{p.name}</p>
                      <p className="text-[10px] font-bold text-slate-500 line-clamp-1">{p.role}</p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {p.labels?.map(l => (
                          <span key={l} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase rounded">{l}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                  {prospects.length === 0 && (
                    <p className="text-[10px] font-black text-slate-400 uppercase text-center py-4">No prospects found</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="neo-card bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <FileText className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-6">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight"> Strategic Intelligence Report</h2>
                      <div className="flex items-center gap-4 mt-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                          Generated by: {activeReport?.personaName || "Strategic Advisor"}
                        </p>
                        <span className="text-slate-300">|</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                          Date: {activeReport ? new Date(activeReport.createdAt).toLocaleString() : "Latest"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {activeReport && (
                    <div className="mb-8 p-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl">
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">Persona Context & Instructions</p>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed italic">"{activeReport.instructions}"</p>
                    </div>
                  )}
                  
                  <div className="markdown-body">
                    <ReactMarkdown>{activeReport?.content || viewingCompany.latestIntelligence}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Intelligence Hub</h1>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-indigo-600" /> Centralized Corporate Knowledge Base
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Filter by company or keyword..."
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:border-slate-900 transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
          <p className="font-black uppercase text-xs tracking-widest text-slate-400">Accessing Vault...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="neo-card border-dashed text-center py-20">
           <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
           <p className="text-xl font-black uppercase text-slate-400">Internal Database Empty</p>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Run discoveries to populate intelligence reports</p>
           <Link to="/find-prospects" className="mt-8 inline-flex px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-900 shadow-neo transition-all">Start First Scan</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredCompanies.map((c) => (
            <motion.div 
              key={c.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -5 }}
              className="neo-card !p-0 bg-white group cursor-pointer overflow-hidden border-2 border-slate-900"
              onClick={() => navigate(`/intelligence/${c.id}`)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex gap-2">
                    {c.url && <Globe className="w-4 h-4 text-slate-300" />}
                    {c.linkedinUrl && <Linkedin className="w-4 h-4 text-slate-300" />}
                  </div>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                <p className="text-xs font-bold text-slate-500 line-clamp-3 mb-6 leading-relaxed">
                  {c.summary}
                </p>
              </div>
              <div className="bg-slate-50 border-t-2 border-slate-900 px-6 py-3 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(c.updatedAt).toLocaleDateString()}</span>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">View Report <ChevronRight className="w-3 h-3" /></span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
