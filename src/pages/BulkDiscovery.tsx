import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, doc, setDoc } from "firebase/firestore";
import { searchProspects, generateCompanyIntelligence } from "../lib/gemini";
import { Upload, FileText, Play, CheckCircle2, AlertCircle, Loader2, History, Trash2, Database, ExternalLink, Zap, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import Papa from "papaparse";

interface CompanyRow {
  name: string;
  url: string;
  linkedin?: string;
}

interface BatchRecord {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  total: number;
  processed: number;
  results: any[];
  personaId?: string;
  createdBy: string;
  createdAt: string;
}

export function BulkDiscovery() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState("");
  const [results, setResults] = useState<any[]>([]);
  
  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [globalRequirements, setGlobalRequirements] = useState("Search for C-Suite Executives, Members of the Board, and Vice Presidents in the company.");
  const [manualRequirements, setManualRequirements] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch global settings
  useEffect(() => {
    return onSnapshot(doc(db, "settings", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalRequirements(docSnap.data().defaultDiscoveryRequirements || globalRequirements);
      }
    });
  }, []);

  // Fetch personas
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "personas"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonas(pList);
      if (pList.length > 0 && !selectedPersonaId) {
        const defaultPersona = pList.find((p: any) => p.isDefault) || pList[0];
        setSelectedPersonaId(defaultPersona.id);
      }
    });
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      Papa.parse(uploadedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const mapped = results.data.map((row: any) => ({
            name: row["Account Name"] || row.name || row.Company || row.company || "",
            url: row.Website || row.website || row.url || "",
            linkedin: row.LinkedIn || row.linkedin || ""
          })).filter(c => c.name && c.url);
          
          if (mapped.length === 0) {
            toast.error("No valid company data found in CSV. Ensure you have 'Account Name' and 'Website' columns.");
          } else {
            setCompanies(mapped);
            toast.success(`Loaded ${mapped.length} companies for discovery`);
          }
        }
      });
    }
  };

  const startBatchProcessing = async () => {
    if (companies.length === 0) return;
    setProcessing(true);
    setProgress(0);
    setResults([]);

    const selectedPersona = personas.find(p => p.id === selectedPersonaId);
    const personaContext = selectedPersona ? {
      agentName: selectedPersona.agentName,
      agentRole: selectedPersona.agentRole,
      agentEmail: selectedPersona.agentEmail
    } : undefined;

    const requirements = manualRequirements || selectedPersona?.customDiscoveryRequirements || globalRequirements;

    const batchId = `batch-${Date.now()}`;
    const allResults: any[] = [];

    try {
      // Create initial batch record
      await setDoc(doc(db, "bulkDiscoveries", batchId), {
        id: batchId,
        name: `Discovery Batch: ${file?.name || "Manual"}`,
        status: "processing",
        total: companies.length,
        processed: 0,
        results: [],
        personaId: selectedPersonaId || null,
        createdBy: user?.uid,
        createdAt: new Date().toISOString()
      });

      for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        setCurrentAction(`Scanning ${company.name}...`);
        
        try {
          // Normalize URL
          const url = company.url.startsWith("http") ? company.url : `https://${company.url}`;
          const normalized = { ...company, url };

          // 1. Search Prospects
          const prospects = await searchProspects(normalized, requirements, personaContext);
          
          // 2. Generate Intelligence
          setCurrentAction(`Generating report for ${company.name}...`);
          const intelligence = await generateCompanyIntelligence(normalized, personaContext);

          // 3. Auto-add prospects to contacts
          for (const p of prospects) {
             const prospectEmail = p.email || `${p.name.toLowerCase().replace(/\s+/g, '.')}@example.com`; // Fallback for auto-add
             await setDoc(doc(db, "contacts", `${p.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`), {
               name: p.name,
               email: prospectEmail,
               company: company.name,
               role: p.title,
               linkedin: p.linkedin || "",
               labels: ["bulk prospect", "automated"],
               createdBy: user?.uid,
               updatedAt: new Date().toISOString()
             });
          }

          const result = {
            company: company.name,
            url: normalized.url,
            prospectCount: prospects.length,
            intelligence: intelligence.substring(0, 100) + "...",
            status: "success"
          };

          allResults.push(result);
          
          // Save individual discovery
          await addDoc(collection(db, "discoveries"), {
            companyName: company.name,
            companyUrl: normalized.url,
            linkedinUrl: company.linkedin || "",
            criteria: requirements,
            results: prospects,
            intelligence,
            personaId: selectedPersonaId || null,
            createdBy: user?.uid,
            createdAt: new Date().toISOString()
          });

          // Save to global Companies collection with versioning
          const companyKey = company.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
          await setDoc(doc(db, "companies", companyKey), {
            id: companyKey,
            name: company.name,
            url: normalized.url,
            linkedinUrl: company.linkedin || "",
            latestIntelligence: intelligence,
            summary: intelligence.substring(0, 200) + "...",
            personaId: selectedPersonaId || null,
            createdBy: user?.uid,
            updatedAt: new Date().toISOString()
          });

          // Add to reports subcollection for versioning
          await addDoc(collection(db, "companies", companyKey, "reports"), {
            content: intelligence,
            personaId: selectedPersonaId || null,
            personaName: selectedPersona?.name || "Standard Agent",
            instructions: requirements,
            createdBy: user?.uid,
            createdAt: new Date().toISOString()
          });

        } catch (error) {
          console.error(`Failed discovery for ${company.name}:`, error);
          allResults.push({
            company: company.name,
            status: "failed",
            error: "Agent processing failed"
          });
        }

        setProgress(Math.round(((i + 1) / companies.length) * 100));
        
        // Update batch record
        await setDoc(doc(db, "bulkDiscoveries", batchId), {
          processed: i + 1,
          results: allResults,
          status: i + 1 === companies.length ? "completed" : "processing"
        }, { merge: true });
      }

      setResults(allResults);
      toast.success("Bulk discovery batch completed!");
    } catch (error) {
      console.error("Batch error:", error);
      toast.error("Critical error during batch processing.");
    } finally {
      setProcessing(false);
      setCurrentAction("");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Bulk Discovery Engine</h1>
        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600" /> Transform CSVs into Intelligence
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          {!processing ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="neo-card"
            >
              <div className="space-y-6">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-4 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-indigo-400 hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".csv"
                  />
                  <div className="w-16 h-16 bg-white border-2 border-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-6 transition-transform">
                    <Upload className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-black uppercase mb-1">Upload Company CSV</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Supports headers: Account Name, Website, LinkedIn</p>
                </div>

                {companies.length > 0 && (
                  <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Loaded Companies ({companies.length})</h4>
                      <button onClick={() => setCompanies([])} className="text-[10px] font-black uppercase text-red-500 hover:underline">Clear List</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {companies.map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-white">
                           <span className="text-xs font-bold text-slate-700">{c.name}</span>
                           <span className="text-[10px] font-mono text-slate-400">{c.url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="label-mini !text-slate-900 border-indigo-200">Discovery Requirements</label>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Optional Override</span>
                  </div>
                  <textarea 
                    className="w-full p-4 bg-white border-2 border-slate-900 rounded-xl font-bold focus:outline-none focus:shadow-neo-sm"
                    rows={4}
                    placeholder="Leave blank to use default instructions..."
                    value={manualRequirements}
                    onChange={(e) => setManualRequirements(e.target.value)}
                  />
                  {!manualRequirements && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight italic">
                      Will fallback to: {personas.find(p => p.id === selectedPersonaId)?.customDiscoveryRequirements || globalRequirements}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="label-mini !text-slate-900 border-indigo-200">Persona Profile</label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {personas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPersonaId(p.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          selectedPersonaId === p.id 
                            ? "border-indigo-600 bg-indigo-50 shadow-neo-sm" 
                            : "border-slate-100 bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                         <p className={`text-[10px] font-black uppercase truncate ${selectedPersonaId === p.id ? "text-indigo-700" : "text-slate-500"}`}>{p.name}</p>
                         <p className="text-[8px] font-bold text-slate-400 truncate">{p.agentRole}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={startBatchProcessing}
                  disabled={companies.length === 0}
                  className="neo-button-primary w-full h-16 rounded-2xl flex items-center justify-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
                >
                  <Play className="w-5 h-5 fill-current" /> Initialize Batch Discovery
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="neo-card flex flex-col items-center justify-center py-20">
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Processing Batch...</span>
                  <span className="text-xl font-black text-slate-900">{progress}%</span>
                </div>
                <div className="w-full h-6 bg-slate-100 border-2 border-slate-900 rounded-full overflow-hidden mb-8 shadow-neo-sm">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-indigo-600"
                  />
                </div>
                <div className="text-center">
                   <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                   <p className="text-lg font-black uppercase tracking-tight mb-1">{currentAction}</p>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Do not close this window</p>
                </div>
              </div>
            </div>
          )}

          {results.length > 0 && !processing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <h3 className="text-2xl font-black uppercase tracking-tight mb-4">Batch Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((r, i) => (
                  <div key={i} className="neo-card !p-4 bg-white flex items-center justify-between">
                    <div>
                      <h4 className="font-black uppercase text-sm tracking-tight">{r.company}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {r.status === "success" ? `${r.prospectCount} Prospects Found` : r.error}
                      </p>
                    </div>
                    {r.status === "success" ? (
                      <div className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center border border-green-100">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center border border-red-100">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="space-y-6">
          <div className="neo-card !border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" /> Batch Specifications
            </h3>
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-[9px] font-black text-indigo-400 uppercase mb-2">Capabilities</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600 mt-0.5" />
                    <p className="text-[10px] font-bold text-slate-700">Individual Prospect Search per Company</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600 mt-0.5" />
                    <p className="text-[10px] font-bold text-slate-700">Custom Strategic Intelligence Report</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600 mt-0.5" />
                    <p className="text-[10px] font-bold text-slate-700">Automatic Global Repository Linking</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">CSV Requirements</p>
                <code className="block text-[10px] p-2 bg-white rounded border border-slate-100 mb-2">
                  Account Name, Website, LinkedIn (optional)
                </code>
                <p className="text-[9px] font-medium text-slate-500 leading-relaxed uppercase">
                  Avoid batching more than 50 companies at once to stay within AI generation speed limits.
                </p>
              </div>
            </div>
          </div>

          <div className="neo-card bg-indigo-600 text-white relative overflow-hidden">
             <div className="relative z-10">
               <h3 className="text-lg font-black uppercase tracking-tight mb-2">Intelligence Sync</h3>
               <p className="text-xs font-bold text-white/80 uppercase leading-relaxed mb-6">
                 All results from this batch are automatically synced to the Global Companies Intelligence repository.
               </p>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]">
                 <DATABASE_ICON className="w-4 h-4" /> Centralized Hub
               </div>
             </div>
             <div className="absolute -right-4 -bottom-4 opacity-10">
               <Zap className="w-32 h-32" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DATABASE_ICON({ className }: { className?: string }) {
  return <Database className={className} />;
}
