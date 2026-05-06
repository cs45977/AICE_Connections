import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { generateDiscoveryQuestions, searchProspects } from "../lib/gemini";
import { Search, Building2, Globe, Linkedin, MessageSquare, Loader2, UserPlus, ArrowRight, CheckCircle2, ExternalLink, Plus, Sparkles, History, Trash2, RefreshCw, ChevronRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Prospect {
  name: string;
  title: string;
  department: string;
  linkedin: string | null;
  source: string | null;
  insight: string;
}

interface DiscoveryRecord {
  id: string;
  companyName: string;
  companyUrl: string;
  linkedinUrl: string;
  criteria: string;
  results: Prospect[];
  personaId?: string;
  createdBy: string;
  createdAt: string;
}

type Step = "input" | "questioning" | "searching" | "results" | "error";

export function FindProspects() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState({ name: "", url: "", linkedin: "" });
  const [aiQuestions, setAiQuestions] = useState("");
  const [userCriteria, setUserCriteria] = useState("");
  const [results, setResults] = useState<Prospect[] | string>([]);
  const [addedProspects, setAddedProspects] = useState<Set<string>>(new Set());
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<string | null>(null);
  
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [globalRequirements, setGlobalRequirements] = useState("Search for C-Suite Executives, Members of the Board, and Vice Presidents in the company.");

  // Fetch global settings
  useEffect(() => {
    return onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalRequirements(docSnap.data().defaultDiscoveryRequirements || "Search for C-Suite Executives, Members of the Board, and Vice Presidents in the company.");
      }
    });
  }, []);

  // Sync criteria with persona selection
  useEffect(() => {
    if (activeDiscoveryId) return; // Don't overwrite if recalling history

    const selectedPersona = personas.find(p => p.id === selectedPersonaId);
    if (selectedPersona?.customDiscoveryRequirements) {
      setUserCriteria(selectedPersona.customDiscoveryRequirements);
    } else {
      setUserCriteria(globalRequirements);
    }
  }, [selectedPersonaId, personas, globalRequirements, activeDiscoveryId]);

  // Fetch personas
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "personas"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonas(pList);
      // Set default persona if available and none selected
      if (pList.length > 0 && !selectedPersonaId) {
        const defaultPersona = pList.find((p: any) => p.isDefault) || pList[0];
        setSelectedPersonaId(defaultPersona.id);
      }
    });
  }, [user]);

  // Fetch existing contacts to mark as added
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "contacts"),
      where("createdBy", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const names = new Set(snapshot.docs.map(doc => doc.data().name as string));
      setAddedProspects(names);
    });

    return () => unsubscribe();
  }, [user]);

  const [history, setHistory] = useState<DiscoveryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch history
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, "discoveries"),
      where("createdBy", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DiscoveryRecord[];
      setHistory(records);
    });

    return () => unsubscribe();
  }, [user]);

  const normalizeUrl = (url: string) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const handleStartDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // If manual criteria was already entered or we want to ensure it's set if not recalled
    if (!userCriteria) {
      const selectedPersona = personas.find(p => p.id === selectedPersonaId);
      setUserCriteria(selectedPersona?.customDiscoveryRequirements || globalRequirements);
    }
    
    // Normalize URLs
    const normalizedCompany = {
      ...company,
      url: normalizeUrl(company.url),
      linkedin: normalizeUrl(company.linkedin)
    };
    
    try {
      const selectedPersona = personas.find(p => p.id === selectedPersonaId);
      const personaContext = selectedPersona ? {
        agentName: selectedPersona.agentName,
        agentRole: selectedPersona.agentRole,
        agentEmail: selectedPersona.agentEmail
      } : undefined;

      const questions = await generateDiscoveryQuestions(normalizedCompany, personaContext);
      setAiQuestions(questions);
      setStep("questioning");
      // Update state with normalized values for consistency
      setCompany(normalizedCompany);
    } catch (err: any) {
      const msg = err.message || "The discovery agent failed to initialize. This could be due to network issues or API limits.";
      setError(msg);
      setStep("error");
      toast.error("Initialization Failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePerformSearch = async () => {
    setLoading(true);
    setError(null);
    setStep("searching");
    try {
      const selectedPersona = personas.find(p => p.id === selectedPersonaId);
      const personaContext = selectedPersona ? {
        agentName: selectedPersona.agentName,
        agentRole: selectedPersona.agentRole,
        agentEmail: selectedPersona.agentEmail
      } : undefined;

      const prospectResults = await searchProspects(company, userCriteria, personaContext);
      const safeResults = Array.isArray(prospectResults) ? prospectResults : [];
      setResults(safeResults);
      
      if (activeDiscoveryId) {
        // Update existing discovery
        await updateDoc(doc(db, "discoveries", activeDiscoveryId), {
          results: safeResults,
          criteria: userCriteria,
          personaId: selectedPersonaId || null,
          updatedAt: new Date().toISOString()
        });
        toast.success("Discovery refreshed and updated.");
      } else {
        // Save new discovery session
        const docRef = await addDoc(collection(db, "discoveries"), {
          companyName: company.name,
          companyUrl: company.url,
          linkedinUrl: company.linkedin,
          criteria: userCriteria,
          results: safeResults,
          personaId: selectedPersonaId || null,
          createdBy: user?.uid,
          createdAt: new Date().toISOString()
        });
        setActiveDiscoveryId(docRef.id);
      }

      setStep("results");
    } catch (err: any) {
      const msg = err.message || "The scan agent encountered a critical error while processing global intelligence data.";
      setError(msg);
      setStep("error");
      toast.error("Search Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRecallDiscovery = (record: DiscoveryRecord) => {
    setCompany({
      name: record.companyName,
      url: record.companyUrl,
      linkedin: record.linkedinUrl || ""
    });
    setUserCriteria(record.criteria);
    setResults(record.results);
    setSelectedPersonaId(record.personaId || "");
    setActiveDiscoveryId(record.id);
    setStep("results");
    setShowHistory(false);
  };

  const handleDeleteDiscovery = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this discovery history?")) return;
    
    try {
      await deleteDoc(doc(db, "discoveries", id));
      toast.success("Discovery deleted.");
      if (activeDiscoveryId === id) {
        setStep("input");
        setActiveDiscoveryId(null);
      }
    } catch (error) {
      toast.error("Failed to delete record.");
    }
  };

  const handleNewDiscovery = () => {
    setStep("input");
    setActiveDiscoveryId(null);
    setCompany({ name: "", url: "", linkedin: "" });
    setResults([]);
    setUserCriteria("");
  };

  const handleQuickAdd = async (prospect: Prospect) => {
    try {
      await addDoc(collection(db, "contacts"), {
        name: prospect.name,
        role: prospect.title,
        company: company.name,
        linkedin: prospect.linkedin || "",
        phone: "",
        email: "", // Set as blank for manual verification
        discoveryPersonaId: selectedPersonaId || null,
        createdBy: user?.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setAddedProspects(prev => new Set(prev).add(prospect.name));
      toast.success(`${prospect.name} added to your list.`);
    } catch (error) {
      toast.error("Failed to add prospect.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-12">
      <div className="flex-1">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Prospect Discovery</h1>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
              <Search className="w-3 h-3" /> AI-Powered Market Intelligence
            </p>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="lg:hidden p-3 bg-white border-2 border-slate-200 rounded-xl"
          >
            <History className="w-5 h-5 text-indigo-600" />
          </button>
        </div>

      <AnimatePresence mode="wait">
        {step === "input" && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="neo-card"
          >
            <form onSubmit={handleStartDiscovery} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="label-mini !text-slate-900 border-indigo-200">Target Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10"
                      placeholder="e.g. Acme Corp"
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label-mini !text-slate-900 border-indigo-200">Company Website</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      type="text"
                      className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10"
                      placeholder="e.g. company.com"
                      value={company.url}
                      onChange={(e) => setCompany({ ...company, url: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-mini !text-slate-900 border-indigo-200">Company LinkedIn (Optional)</label>
                <div className="relative">
                  <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10"
                    placeholder="linkedin.com/company/..."
                    value={company.linkedin}
                    onChange={(e) => setCompany({ ...company, linkedin: e.target.value })}
                  />
                </div>
              </div>

              {/* Persona Selection */}
              {personas.length > 0 && (
                <div className="space-y-2">
                  <label className="label-mini !text-slate-900 border-indigo-200">Executive Persona Context</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {personas.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPersonaId(p.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                          selectedPersonaId === p.id 
                            ? "border-indigo-600 bg-indigo-50 shadow-neo-sm" 
                            : "border-slate-100 bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <p className={`text-[10px] font-black uppercase truncate ${selectedPersonaId === p.id ? "text-indigo-700" : "text-slate-500"}`}>
                          {p.name}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 truncate">{p.agentRole}</p>
                        {selectedPersonaId === p.id && (
                          <div className="absolute -top-2 -right-2 bg-indigo-600 text-white rounded-full p-0.5 shadow-neo-sm">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedPersonaId("")}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        selectedPersonaId === "" 
                          ? "border-indigo-600 bg-indigo-50 shadow-neo-sm" 
                          : "border-slate-100 bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <p className={`text-[10px] font-black uppercase truncate ${selectedPersonaId === "" ? "text-indigo-700" : "text-slate-500"}`}>
                        Default
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 truncate">General Assistant</p>
                    </button>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="neo-button-primary w-full h-14 rounded-xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
                Consult Discovery Agent
              </button>
            </form>
          </motion.div>
        )}

        {step === "questioning" && (
          <motion.div 
            key="questioning"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="space-y-8"
          >
            <div className="bg-indigo-600 text-white p-8 rounded-2xl shadow-neo transform rotate-1">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase mb-4 tracking-tighter">Clarifying Target Profiles</h3>
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{aiQuestions}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            <div className="neo-card !border-indigo-600">
               <label className="label-mini !text-slate-900 border-indigo-200 mb-4 inline-block">Your Requirements</label>
               <textarea 
                 rows={4}
                 className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-4 ring-indigo-500/10 mb-6"
                 placeholder="e.g. I am looking for VPs of Product and Engineering based in North America who focus on AI infrastructure..."
                 value={userCriteria}
                 onChange={(e) => setUserCriteria(e.target.value)}
               />
               <div className="flex gap-4">
                 <button 
                   onClick={() => setStep("input")}
                   className="px-6 py-4 rounded-xl border-2 border-slate-200 font-bold uppercase text-xs tracking-widest hover:bg-slate-50"
                 >
                   Back
                 </button>
                 <button 
                   onClick={handlePerformSearch}
                   disabled={loading || !userCriteria}
                   className="neo-button-primary flex-1 rounded-xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
                 >
                   {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                   Launch Global Scan
                 </button>
               </div>
            </div>
          </motion.div>
        )}

        {step === "searching" && (
          <motion.div 
            key="searching"
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="relative mb-8">
              <div className="w-24 h-24 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Globe className="w-8 h-8 text-indigo-600 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Scanning Intelligence Grid</h2>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Accessing real-time corporate directories & social profiles...</p>
          </motion.div>
        )}

        {step === "error" && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="neo-card border-red-200 bg-red-50/30 text-center py-12"
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 text-red-900">Agent Connection Failed</h2>
            <div className="max-w-md mx-auto mb-8">
              <p className="text-sm font-bold text-red-700/80 leading-relaxed uppercase tracking-tight">
                {error}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => setStep("input")}
                className="px-8 py-4 bg-white border-2 border-red-200 text-red-600 font-black uppercase text-xs tracking-widest rounded-xl hover:bg-red-50 transition-all"
              >
                Reset Agent
              </button>
              <button 
                onClick={() => aiQuestions ? setStep("questioning") : handleStartDiscovery({ preventDefault: () => {} } as any)}
                className="px-8 py-4 bg-red-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-red-700 shadow-neo-sm active:translate-y-0.5 transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Retry Connection
              </button>
            </div>
          </motion.div>
        )}

        {step === "results" && (
          <motion.div 
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white">
                    <CheckCircle2 className="w-6 h-6" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Current Findings</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{company.name} Scan Results</p>
                 </div>
               </div>
               <div className="flex gap-3">
                 <button 
                  onClick={handlePerformSearch}
                  disabled={loading}
                  className="h-10 px-4 bg-white border-2 border-indigo-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 transition-all disabled:opacity-50"
                 >
                   <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
                 </button>
                 <button 
                   onClick={handleNewDiscovery}
                   className="h-10 px-4 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 flex items-center gap-2 transition-all"
                 >
                   <Plus className="w-3 h-3" /> New Discovery
                 </button>
               </div>
            </div>

            {/* Context/Criteria Display */}
            <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-3 h-3 text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Scan Parameters</span>
              </div>
              <p className="text-sm font-bold text-slate-700 leading-relaxed italic">"{userCriteria}"</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {Array.isArray(results) ? (
                results.map((prospect, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="neo-card bg-white hover:border-indigo-400 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black uppercase tracking-tight">{prospect.name}</h3>
                          {addedProspects.has(prospect.name) && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[8px] font-black uppercase tracking-widest rounded-full">In Your List</span>
                          )}
                          {prospect.linkedin && (
                            <a 
                              href={prospect.linkedin} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-indigo-50 rounded-md transition-colors"
                            >
                              <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{prospect.title} • {prospect.department}</p>
                        <div className="flex items-start gap-2 pt-2">
                          <Sparkles className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-500 font-medium italic">"{prospect.insight}"</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {prospect.source && (
                          <a 
                            href={prospect.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-10 px-4 flex items-center gap-2 border-2 border-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all"
                          >
                            Source <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          onClick={() => handleQuickAdd(prospect)}
                          disabled={addedProspects.has(prospect.name)}
                          className={`h-12 px-6 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
                            addedProspects.has(prospect.name) 
                              ? "bg-green-50 text-green-600 border-2 border-green-100" 
                              : "bg-slate-900 text-white hover:bg-indigo-600 shadow-neo-sm active:translate-y-0.5"
                          }`}
                        >
                          {addedProspects.has(prospect.name) ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Added
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" /> Quick Add
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="neo-card bg-white">
                  <div className="markdown-body">
                    <ReactMarkdown>{results as string}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-neo border-4 border-white">
               <div className="flex items-start gap-4">
                 <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                    <UserPlus className="w-6 h-6" />
                 </div>
                 <div>
                   <h3 className="text-lg font-black uppercase mb-1 tracking-tighter">Importing Prospects</h3>
                   <p className="text-slate-400 font-bold text-xs mb-6 mb-2">Review the results above and use the "New Contact" page to add promising leads to your workspace.</p>
                   <button 
                     onClick={() => window.open("/contacts/new", "_blank")}
                     className="bg-white text-slate-900 px-6 py-3 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-indigo-50 transition-colors flex items-center gap-2"
                   >
                     Open Contact Creator <ArrowRight className="w-4 h-4" />
                   </button>
                 </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* History Sidebar */}
      <div className={`w-full lg:w-80 shrink-0 space-y-6 ${showHistory ? 'block' : 'hidden lg:block'}`}>
        <div className="sticky top-6">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" /> Discovery Vault
            </h3>
            <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">{history.length}</span>
          </div>

          <div className="space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No previous scans found</p>
              </div>
            ) : (
              history.map((record) => (
                <div 
                  key={record.id}
                  onClick={() => handleRecallDiscovery(record)}
                  className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-neo-sm ${
                    activeDiscoveryId === record.id 
                      ? "bg-indigo-50 border-indigo-400" 
                      : "bg-white border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 overflow-hidden">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 truncate">{record.companyName}</p>
                      <p className="text-xs font-bold text-slate-600 truncate mb-2">{record.criteria}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[8px] font-black text-slate-400 uppercase">{new Date(record.createdAt).toLocaleDateString()}</span>
                        <span className="text-[8px] font-black text-indigo-400 uppercase">
                          {Array.isArray(record.results) ? record.results.length : 0} Prospects
                        </span>
                        {record.personaId && personas.find(p => p.id === record.personaId) && (
                          <span className="text-[8px] font-black text-amber-500 uppercase flex items-center gap-1">
                            <Sparkles className="w-2 h-2" />
                            {personas.find(p => p.id === record.personaId).name}
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteDiscovery(record.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
