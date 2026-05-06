import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  doc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp, 
  where 
} from "firebase/firestore";
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
  Plus,
  Linkedin,
  Phone,
  ChevronDown,
  StickyNote,
  MessageSquare,
  Terminal,
  Trash2
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export function ContactDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [contact, setContact] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "",
    company: "",
    linkedin: "",
    phone: ""
  });
  const [outreach, setOutreach] = useState<any[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isResearchExpanded, setIsResearchExpanded] = useState(false);
  
  const [campaignSubject, setCampaignSubject] = useState("");
  const [generatedDraft, setGeneratedDraft] = useState("");

  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const [personas, setPersonas] = useState<any[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [suggestedGoals, setSuggestedGoals] = useState<string[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("research");

  useEffect(() => {
    if (!id) return;

    const contactRef = doc(db, "contacts", id);
    const unsubContact = onSnapshot(contactRef, (snap) => {
      if (snap.exists()) {
        const data = snap.id ? { id: snap.id, ...snap.data() } : snap.data();
        setContact(data);
        setEditForm({
          name: data.name || "",
          email: data.email || "",
          role: data.role || "",
          company: data.company || "",
          linkedin: data.linkedin || "",
          phone: data.phone || ""
        });
      } else {
        navigate("/");
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `contacts/${id}`);
    });

    const outreachQuery = query(
      collection(db, "contacts", id, "outreach"),
      orderBy("createdAt", "desc")
    );
    const unsubOutreach = onSnapshot(outreachQuery, (snap) => {
      setOutreach(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `contacts/${id}/outreach`);
    });

    const notesQuery = query(
      collection(db, "contacts", id, "notes"),
      orderBy("createdAt", "desc")
    );
    const unsubNotes = onSnapshot(notesQuery, (snap) => {
      setNotes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `contacts/${id}/notes`);
    });

    if (user) {
      const personasQuery = query(collection(db, "users", user.uid, "personas"), orderBy("createdAt", "desc"));
      const unsubPersonas = onSnapshot(personasQuery, (snap) => {
        const userPersonas = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setPersonas(userPersonas);
        const defaultP = userPersonas.find(p => p.isDefault);
        if (defaultP) setSelectedPersona(defaultP);
      });
      return () => {
        unsubContact();
        unsubOutreach();
        unsubNotes();
        unsubPersonas();
      };
    }

    return () => {
      unsubContact();
      unsubOutreach();
      unsubNotes();
    };
  }, [id, user]);

  useEffect(() => {
    if (contact?.researchSummary && suggestedGoals.length === 0 && !goalsLoading) {
      loadSuggestedGoals();
    }
  }, [contact?.researchSummary]);

  const loadSuggestedGoals = async () => {
    if (!contact?.researchSummary) return;
    setGoalsLoading(true);
    try {
      const goals = await import("../lib/gemini").then(m => m.generateSuggestedGoals(contact, contact.researchSummary));
      setSuggestedGoals(goals);
    } catch (error) {
      console.error(error);
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleResearch = async () => {
    if (!contact) return;
    setResearchLoading(true);
    try {
      const promptOverride = selectedPersona?.customPrompts?.research;
      const personaContext = selectedPersona ? {
        agentName: selectedPersona.agentName,
        agentRole: selectedPersona.agentRole,
        agentEmail: selectedPersona.agentEmail
      } : undefined;
      
      const summary = await researchContact(contact, promptOverride, personaContext);
      const contactRef = doc(db, "contacts", id!);
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
      const promptOverride = selectedPersona?.customPrompts?.outreach;
      const personaContext = selectedPersona ? {
        agentName: selectedPersona.agentName,
        agentRole: selectedPersona.agentRole,
        agentEmail: selectedPersona.agentEmail
      } : undefined;

      const draft = await generateEmail(campaignSubject, contact.researchSummary || "No research findings yet.", contact, promptOverride, personaContext);
      setGeneratedDraft(draft);
      toast.success("Email draft generated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate email.");
    } finally {
      setGenLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !id || !user) return;
    setNoteLoading(true);
    try {
      const noteRef = collection(db, "contacts", id, "notes");
      await addDoc(noteRef, {
        contactId: id,
        text: newNote,
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setNewNote("");
      toast.success("Note added");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `contacts/${id}/notes`);
    } finally {
      setNoteLoading(false);
    }
  };

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        const outreachRef = collection(db, "contacts", id!, "outreach");
        await addDoc(outreachRef, {
          contactId: id,
          subject: campaignSubject,
          emailBody: generatedDraft,
          status: "draft",
          docUrl: data.url,
          createdBy: user?.uid,
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

  const normalizeUrl = (url: string) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, "contacts", id), {
        ...editForm,
        linkedin: normalizeUrl(editForm.linkedin),
        updatedAt: new Date().toISOString()
      });
      setIsEditing(false);
      toast.success("Contact updated successfully");
    } catch (error) {
      toast.error("Failed to update contact");
    } finally {
      setSaveLoading(false);
    }
  };

  if (!contact) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-6">
        <Link to="/" className="flex items-center gap-2 group text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Return to Pipeline
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Vertical Sub-navigation - Compact with Hover Expansion */}
        <aside className="w-14 lg:sticky lg:top-24 z-50 shrink-0 group h-auto">
          <div className="flex flex-col gap-1 p-1 bg-white border-2 border-slate-900 rounded-xl shadow-neo-sm overflow-hidden transition-all duration-300 w-12 group-hover:w-44 absolute lg:relative bg-white">
            <NavTab vertical active={activeTab === 'research'} onClick={() => scrollToSection('research')} icon={<Sparkles className="w-4 h-4 shrink-0" />} label="Research" />
            <NavTab vertical active={activeTab === 'ai-engine'} onClick={() => scrollToSection('ai-engine')} icon={<Terminal className="w-4 h-4 shrink-0" />} label="AI Engine" />
            <NavTab vertical active={activeTab === 'notes'} onClick={() => scrollToSection('notes')} icon={<StickyNote className="w-4 h-4 shrink-0" />} label="Notes" />
            <NavTab vertical active={activeTab === 'history'} onClick={() => scrollToSection('history')} icon={<History className="w-4 h-4 shrink-0" />} label="History" />
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-3 w-full">
        {/* Profile / Header Area */}
        <header className="neo-card border-b-4 border-slate-900 shadow-none overflow-hidden !p-0">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.form 
                key="edit-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleUpdateContact}
                className="p-2 bg-indigo-50 flex flex-wrap items-end gap-2"
              >
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[9px] font-black uppercase text-indigo-600 block mb-0.5 ml-1">Name *</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5 ml-1">Email</label>
                  <input 
                    type="email" 
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5 ml-1">Role</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5 ml-1">Company</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                    value={editForm.company}
                    onChange={e => setEditForm({ ...editForm, company: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5 ml-1">LinkedIn</label>
                  <input 
                    type="text" 
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                    value={editForm.linkedin}
                    onChange={e => setEditForm({ ...editForm, linkedin: e.target.value })}
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-[9px] font-black uppercase text-slate-400 block mb-0.5 ml-1">Phone</label>
                  <input 
                    type="tel" 
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold focus:border-indigo-500 outline-none"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-1.5 pb-0.5">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="h-8 px-3 bg-white border border-slate-300 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saveLoading}
                    className="h-8 px-3 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    {saveLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div 
                key="header-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between !py-2 !px-6 w-full"
              >
                <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="label-mini !text-[8px] mb-0.5">Active Prospect</span>
                    <div className="flex items-center gap-4">
                      <h1 className="text-2xl font-black uppercase tracking-tighter">{contact.name}</h1>
                      <div className="flex items-center gap-2">
                        <a 
                          href={`mailto:${contact.email}`}
                          className="p-1.5 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded transition-all text-slate-500"
                          title={contact.email}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                        {contact.linkedin && (
                          <a 
                            href={contact.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-slate-100 hover:bg-[#0A66C2] hover:text-white rounded transition-all text-[#0A66C2]"
                            title="LinkedIn Profile"
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {contact.phone && (
                          <a 
                            href={`tel:${contact.phone}`}
                            className="p-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white rounded transition-all text-slate-500"
                            title={contact.phone}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="h-8 w-[2px] bg-slate-100"></div>
                  <div className="flex flex-col">
                    <span className="label-mini !text-[8px] mb-0.5">Account & Role</span>
                    <p className="font-black text-sm uppercase tracking-tight text-slate-600">
                      {contact.company} <span className="text-slate-300 mx-1">•</span> <span className="text-indigo-600">{contact.role || 'Prospect'}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="h-9 px-3 bg-white border-2 border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-indigo-400 text-slate-600 hover:text-indigo-600 transition-all flex items-center gap-2"
                  >
                    Edit Profile
                  </button>
                  <button 
                    onClick={handleResearch} 
                    disabled={researchLoading}
                    className="h-9 px-3 bg-white border-2 border-slate-200 rounded-lg text-[10px] uppercase tracking-widest flex items-center gap-2 hover:border-indigo-400 hover:text-indigo-600 transition-all font-black"
                  >
                    {researchLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Search className="w-4 h-4" />}
                    Refresh
                  </button>
                  <button className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-neo-sm hover:translate-y-[-2px] active:translate-y-0 transition-all">
                    <Plus className="w-4 h-4" />
                    New outreach
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Research Agent Findings - Full Width & Expandable */}
        <section id="research" className="neo-card relative overflow-hidden bg-white scroll-mt-24">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 -translate-y-16 translate-x-16 rounded-full blur-2xl"></div>
          
          <div className="flex justify-between items-center mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="font-black text-lg uppercase tracking-tight">Technical Research Agent Findings</h2>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border border-slate-100 ${contact.researchSummary ? 'bg-green-50' : 'bg-slate-50'}`}>
              <div className={`w-2 h-2 rounded-full ${contact.researchSummary ? 'bg-green-500 animate-pulse' : 'bg-slate-200'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {contact.researchSummary ? "Insights Ready" : "Unsynced"}
              </span>
            </div>
          </div>

          <div className="relative z-10">
            {contact.researchSummary ? (
              <div className="space-y-4">
                <div className={`p-5 bg-indigo-50/30 border border-indigo-100 rounded-2xl transition-all duration-500 ${isResearchExpanded ? 'max-h-[2000px]' : 'max-h-[140px]'} overflow-hidden relative`}>
                  <div className="markdown-body text-sm leading-relaxed text-slate-700 font-medium">
                    <ReactMarkdown>{contact.researchSummary}</ReactMarkdown>
                  </div>
                  
                  {!isResearchExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-indigo-50/80 to-transparent flex items-end justify-center pb-2">
                       <button 
                        onClick={() => setIsResearchExpanded(true)}
                        className="px-4 py-1.5 bg-white border-2 border-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-neo-sm hover:translate-y-[-1px] transition-all"
                      >
                        Read Full Research Findings
                      </button>
                    </div>
                  )}
                </div>

                {isResearchExpanded && (
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setIsResearchExpanded(false)}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 underline underline-offset-4"
                    >
                      Collapse Insights
                    </button>
                  </div>
                )}
                
                <div className="flex items-center gap-2 px-4 py-2 border border-slate-100 rounded-xl bg-slate-50/50">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Source Context:</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight italic">
                    Public search indices, indexed enterprise data, and social professional signatures.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-10 px-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Agent idle. Use 'Refresh' above to synthesize findings.
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-12 gap-3">
          {/* AI Generation Box */}
          <section id="ai-engine" className="col-span-12 lg:col-span-8 neo-card !p-0 flex flex-col overflow-hidden scroll-mt-24">
            <div className="p-4 border-b-2 border-slate-900 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase bg-indigo-600 text-white px-2 py-1 rounded shadow-neo-sm">AI Engine</span>
                
                <div className="relative persona-selector">
                  <select 
                    className="appearance-none bg-indigo-50 text-indigo-700 text-[10px] font-bold px-3 py-1 pr-6 rounded uppercase tracking-tighter outline-none cursor-pointer hover:bg-indigo-100 transition-colors"
                    value={selectedPersona?.id || ""}
                    onChange={(e) => {
                      const p = personas.find(p => p.id === e.target.value);
                      setSelectedPersona(p || null);
                    }}
                  >
                    <option value="">Default: Google Customer Engineer</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-indigo-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {selectedPersona && (
                  <div className="flex items-center gap-1.5 p-1 bg-white border border-indigo-100 rounded text-[8px] font-black uppercase text-indigo-400 tracking-tighter">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Custom Prompts Active
                  </div>
                )}
              </div>
              {genLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
            </div>

            <div className="p-8 flex-1 flex flex-col gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="label-mini flex items-center gap-2">
                    Outreach Goal / Theme
                  </label>
                  {suggestedGoals.length > 0 && (
                    <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Suggested Goals</span>
                  )}
                </div>

                {/* Suggested Goals chips */}
                {suggestedGoals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {suggestedGoals.map((goal, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setCampaignSubject(goal)}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-[9px] font-bold text-slate-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all uppercase tracking-tight"
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                )}

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

              <div className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl p-6 relative group overflow-hidden min-h-[300px]">
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

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
            {/* Notes Section */}
            <section id="notes" className="neo-card scroll-mt-24 h-[400px] flex flex-col !p-0 overflow-hidden">
               <div className="p-4 bg-white border-b-2 border-slate-900 flex items-center justify-between">
                  <h2 className="label-mini flex items-center gap-2">
                    <StickyNote className="w-4 h-4" />
                    Internal Notes
                  </h2>
                  <span className="text-[9px] font-black uppercase text-slate-300">{notes.length} logs</span>
               </div>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative group">
                       <p className="text-xs font-bold text-slate-700 leading-relaxed mb-2 whitespace-pre-wrap">{note.text}</p>
                       <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-[8px] font-black uppercase text-slate-400">{new Date(note.createdAt).toLocaleDateString()} at {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <button 
                            onClick={async () => {
                              if (window.confirm("Delete note?")) {
                                try {
                                  await deleteDoc(doc(db, "contacts", id!, "notes", note.id));
                                  toast.success("Note deleted");
                                } catch (e) {
                                  toast.error("Failed to delete note");
                                }
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 hover:text-red-500 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                       </div>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-xs py-10">
                      <MessageSquare className="w-6 h-6 mb-2" />
                      No notes yet
                    </div>
                  )}
               </div>

               <div className="p-4 bg-slate-50 border-t-2 border-slate-900">
                  <form onSubmit={handleAddNote} className="relative">
                    <textarea 
                      placeholder="Add a new note..."
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-slate-900 transition-all min-h-[60px] pr-10"
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                    />
                    <button 
                      type="submit"
                      disabled={noteLoading || !newNote.trim()}
                      className="absolute right-2 bottom-2 p-1.5 bg-slate-900 text-white rounded-lg hover:bg-indigo-600 transition-all shadow-neo-sm disabled:opacity-50"
                    >
                      {noteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </form>
               </div>
            </section>

            {/* History Log */}
            <section id="history" className="neo-card relative overflow-hidden group h-[300px] flex flex-col scroll-mt-24 !p-0">
               <div className="p-4 bg-white border-b-2 border-slate-900">
                  <h2 className="label-mini flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Outreach History
                  </h2>
               </div>
              <div className="space-y-4 relative z-10 overflow-y-auto p-4 flex-1 custom-scrollbar">
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
            <section className="neo-card bg-slate-900 text-white flex flex-col justify-center items-center text-center hover:bg-indigo-600 transition-colors cursor-default p-6 h-[180px]">
              <div className="text-5xl font-black mb-1">92%</div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60">Personalization Strength</p>
              <div className="mt-6 flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
                  <span className="text-[8px] font-black uppercase">Live Agent Active</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

function NavTab({ active, onClick, icon, label, vertical = false }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, vertical?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
        vertical ? "w-full justify-start overflow-hidden" : "whitespace-nowrap"
      } ${
        active 
        ? "bg-slate-900 text-white shadow-neo-sm" 
        : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      <span className={`transition-opacity duration-300 ${vertical ? "opacity-0 group-hover:opacity-100 whitespace-nowrap" : ""}`}>
        {label}
      </span>
    </button>
  );
}
