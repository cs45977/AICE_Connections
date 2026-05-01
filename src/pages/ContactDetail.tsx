import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, updateDoc, Timestamp, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { researchContact, generateEmail } from "../lib/gemini";
import { 
  ArrowLeft, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Mail, 
  Send, 
  ExternalLink,
  History,
  FileText,
  Loader2,
  Plus
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export function ContactDetail() {
  const { id } = useParams();
  const { companyId, user } = useAuth();
  const navigate = useNavigate();
  
  const [contact, setContact] = useState<any>(null);
  const [outreach, setOutreach] = useState<any[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  const [campaignSubject, setCampaignSubject] = useState("");
  const [generatedDraft, setGeneratedDraft] = useState("");

  useEffect(() => {
    if (!companyId || !id) return;

    const contactRef = doc(db, "companies", companyId, "contacts", id);
    const unsubContact = onSnapshot(contactRef, (snap) => {
      if (snap.exists()) {
        setContact({ id: snap.id, ...snap.data() });
      } else {
        navigate("/");
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `companies/${companyId}/contacts/${id}`);
    });

    const outreachQuery = query(
      collection(db, "companies", companyId, "contacts", id, "outreach"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    );
    const unsubOutreach = onSnapshot(outreachQuery, (snap) => {
      setOutreach(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `companies/${companyId}/contacts/${id}/outreach`);
    });

    return () => {
      unsubContact();
      unsubOutreach();
    };
  }, [companyId, id]);

  const handleResearch = async () => {
    if (!contact) return;
    setResearchLoading(true);
    try {
      const summary = await researchContact(contact);
      const contactRef = doc(db, "companies", companyId!, "contacts", id!);
      await updateDoc(contactRef, {
        researchSummary: summary,
        updatedAt: new Date().toISOString()
      });
      toast.success("Research completed successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to perform research.");
    } finally {
      setResearchLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!contact || !campaignSubject) {
      toast.error("Please enter a campaign subject.");
      return;
    }
    setGenLoading(true);
    try {
      const draft = await generateEmail(campaignSubject, contact.researchSummary || "No research findings yet.", contact);
      setGeneratedDraft(draft);
      toast.success("Email draft generated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate email.");
    } finally {
      setGenLoading(false);
    }
  };

  const handleExport = async () => {
    if (!generatedDraft || !contact) return;
    setExportLoading(true);
    try {
      // In a real app, we'd get the token from Firebase or a separate OAuth
      // For this MVP, we'll assume the server can handle it if we have the right flow
      // We'll call our server API
      const response = await fetch("/api/export-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: generatedDraft,
          contactName: contact.name,
          accessToken: (auth.currentUser as any).stsTokenManager?.accessToken // Hack for MVP demo
        })
      });

      const data = await response.json();
      if (data.success) {
        // Save to outreach history
        const outreachRef = collection(db, "companies", companyId!, "contacts", id!, "outreach");
        await addDoc(outreachRef, {
          contactId: id,
          subject: campaignSubject,
          emailBody: generatedDraft,
          status: "draft",
          docUrl: data.url,
          createdBy: user?.uid,
          companyId: companyId,
          createdAt: new Date().toISOString()
        });

        toast.success("Push to Google Docs success!");
        window.open(data.url, "_blank");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to export to Google Docs.");
    } finally {
      setExportLoading(false);
    }
  };

  if (!contact) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link to="/" className="flex items-center gap-2 group text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Return to Pipeline
        </Link>
      </div>

      <div className="grid grid-cols-12 grid-rows-6 gap-6 min-h-[800px]">
        {/* Profile / Header Area */}
        <header className="col-span-12 row-span-1 neo-card flex items-center justify-between !py-4">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="label-mini mb-1">Active Prospect</span>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black uppercase tracking-tighter">{contact.name}</h1>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded border border-indigo-200 uppercase">
                  {contact.role || 'Prospect'}
                </span>
              </div>
            </div>
            <div className="h-10 w-[2px] bg-slate-100"></div>
            <div className="flex flex-col">
              <span className="label-mini mb-1">Target Account</span>
              <p className="font-black text-lg uppercase tracking-tight">{contact.company}</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleResearch} 
              disabled={researchLoading}
              className="neo-button-outline text-xs uppercase tracking-widest flex items-center gap-2"
            >
              {researchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Refresh Research
            </button>
            <button className="neo-button-primary text-xs uppercase tracking-widest flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New outreach
            </button>
          </div>
        </header>

        {/* Research Agent Findings */}
        <section className="col-span-4 row-span-5 neo-card flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 -translate-y-16 translate-x-16 rounded-full blur-2xl"></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h2 className="font-black text-lg uppercase tracking-tight">Research Findings</h2>
            <div className={`w-2 h-2 rounded-full ${contact.researchSummary ? 'bg-green-500 animate-pulse' : 'bg-slate-200'}`}></div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative z-10 custom-scrollbar">
            {contact.researchSummary ? (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 border-2 border-indigo-100 rounded-xl">
                  <p className="label-mini !text-indigo-700 mb-2">Automated Synthesis</p>
                  <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                    {contact.researchSummary}
                  </div>
                </div>
                
                <div className="p-4 border-2 border-slate-100 rounded-xl italic text-xs text-slate-400">
                  Data points captured from public social footprints and professional indices.
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6">
                <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">
                  Research queue empty.<br />Initialize agent to continue.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* AI Generation Box */}
        <section className="col-span-8 row-span-4 neo-card !p-0 flex flex-col overflow-hidden">
          <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2 py-1 rounded shadow-neo-sm">AI Engine</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter italic">Persona: Google Customer Engineer</span>
            </div>
            {genLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
          </div>

          <div className="p-8 flex-1 flex flex-col gap-6">
            <div className="space-y-3">
              <label className="label-mini flex items-center gap-2">
                Outreach Goal
              </label>
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder="e.g. Schedule technical overview for their Q4 infrastructure roadmap"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-900 rounded-xl text-sm font-bold focus:outline-none transition-all focus:bg-white focus:shadow-neo-sm"
                  value={campaignSubject}
                  onChange={(e) => setCampaignSubject(e.target.value)}
                />
                <button 
                  onClick={handleGenerate}
                  disabled={genLoading || !contact.researchSummary}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    contact.researchSummary 
                    ? 'bg-slate-900 text-white hover:bg-black' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Draft Email
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl p-6 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <FileText className="w-5 h-5 text-slate-300" />
              </div>
              
              {generatedDraft ? (
                <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
                  <div className="font-mono text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {generatedDraft}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-sm py-20">
                  <Mail className="w-8 h-8 mb-2" />
                  Your generated message will appear here
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t-2 border-slate-900 bg-slate-50 flex justify-end gap-3">
            <button 
              className="neo-button-outline !px-4 !py-2 text-[10px] uppercase tracking-widest disabled:opacity-50"
              onClick={() => setGeneratedDraft("")}
              disabled={!generatedDraft}
            >
              Clear Draft
            </button>
            <button 
              className="neo-button-primary !px-6 !py-2 text-[10px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
              onClick={handleExport}
              disabled={!generatedDraft || exportLoading}
            >
              {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Push to Workspace
            </button>
          </div>
        </section>

        {/* History Log */}
        <section className="col-span-5 row-span-2 neo-card relative overflow-hidden group">
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-slate-50 -translate-x-4 translate-y-4 rounded-full border-2 border-slate-100 group-hover:scale-110 transition-transform"></div>
          <h2 className="label-mini mb-6 flex items-center gap-2">
            <History className="w-4 h-4" />
            Outreach History
          </h2>
          <div className="space-y-4 relative z-10 overflow-y-auto max-h-[120px] pr-2 custom-scrollbar">
            {outreach.map((log) => (
              <div key={log.id} className="flex gap-4 items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black uppercase tracking-tight truncate">{log.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.createdAt).toLocaleDateString()}</span>
                    <span className="text-[9px] font-bold text-indigo-600 uppercase">Google Document</span>
                  </div>
                </div>
                <div className="ml-auto">
                    {log.docUrl && (
                      <a href={log.docUrl} target="_blank" rel="noopener" className="p-2 hover:bg-slate-100 rounded transition-colors group/link">
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover/link:text-slate-900" />
                      </a>
                    )}
                </div>
              </div>
            ))}
            {outreach.length === 0 && (
              <p className="text-xs italic text-slate-400 py-4">No communications logged yet.</p>
            )}
          </div>
        </section>

        {/* Stats / Branding Section */}
        <section className="col-span-3 row-span-2 neo-card bg-slate-900 text-white flex flex-col justify-center items-center text-center hover:bg-indigo-600 transition-colors cursor-default">
           <div className="text-5xl font-black mb-1">92%</div>
           <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60">Personalization Strength</p>
           <div className="mt-8 flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
              <span className="text-[8px] font-black uppercase">Live Agent Active</span>
           </div>
        </section>
      </div>
    </div>
  );
}
