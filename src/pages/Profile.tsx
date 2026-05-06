import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { db, auth } from "../lib/firebase";
import { 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDocs,
  Timestamp 
} from "firebase/firestore";
import { updateProfile, updateEmail, updatePassword } from "firebase/auth";
import { 
  User as UserIcon, 
  Mail, 
  Lock, 
  Save, 
  Plus, 
  Trash2, 
  Terminal, 
  Sparkles, 
  ShieldCheck,
  Loader2,
  ChevronRight,
  Info,
  Settings,
  Users,
  X,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export function Profile() {
  const { user, role } = useAuth();
  
  // Personal Info State
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [personalLoading, setPersonalLoading] = useState(false);

  // Personas State
  const [personas, setPersonas] = useState<any[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [editingPersona, setEditingPersona] = useState<any>(null);
  const [showPersonaForm, setShowPersonaForm] = useState(false);
  const [personaForm, setPersonaForm] = useState({
    name: "",
    agentName: "",
    agentRole: "",
    agentEmail: "",
    description: "",
    researchPrompt: "",
    outreachPrompt: "",
    isDefault: false
  });

  // System Defaults
  const [systemPrompts, setSystemPrompts] = useState<any[]>([]);
  const [viewingPrompt, setViewingPrompt] = useState<any>(null);

  const copyPromptText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Prompt copied to clipboard!");
  };

  useEffect(() => {
    if (!user) return;

    // Load custom personas
    const personaQuery = query(
      collection(db, "users", user.uid, "personas"),
      orderBy("createdAt", "desc")
    );
    const unsubPersonas = onSnapshot(personaQuery, (snap) => {
      const userPersonas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonas(userPersonas);
      setLoadingPersonas(false);
    });

    return () => unsubPersonas();
  }, [user]);

  // Seed standard agent if it doesn't exist
  useEffect(() => {
    async function seedInitialPersona() {
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (!userData?.hasSeededStandardAgent) {
          const standardAgentRef = doc(db, "users", user.uid, "personas", "standard-agent");
          const standardAgentSnap = await getDoc(standardAgentRef);

          if (!standardAgentSnap.exists()) {
            try {
              await setDoc(standardAgentRef, {
                name: "Standard Agent",
                agentName: user.displayName || "Google Cloud Expert",
                agentRole: "Google Customer Engineer",
                agentEmail: user.email || "",
                description: "Default persona for technical sales outreach and research.",
                customPrompts: {
                  research: "",
                  outreach: ""
                },
                isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
              toast.info("Standard persona created");
            } catch (err) {
              console.error("Failed to set standard agent persona", err);
              // If this fails, we might still want to proceed to mark seeded if it was permissions on subcollection
            }
          }
          
          if (userSnap.exists()) {
            await updateDoc(userRef, { hasSeededStandardAgent: true });
          } else {
            // User doc missing - initialize it properly to satisfy isValidUser on create
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "",
              role: "user",
              createdAt: new Date().toISOString(),
              hasSeededStandardAgent: true
            });
          }
        }
      } catch (e) {
        console.error("Failed to seed persona", e);
      }
    }
    seedInitialPersona();
  }, [user]);

  useEffect(() => {
    // Load system prompts for reference
    const loadSystemPrompts = async () => {
      const snap = await getDocs(collection(db, "prompts"));
      setSystemPrompts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    loadSystemPrompts();
  }, [user]);

  const handleUpdatePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPersonalLoading(true);

    try {
      // Update Auth Profile
      if (displayName !== user.displayName) {
        await updateProfile(auth.currentUser!, { displayName });
      }

      // Update Auth Email (requires fresh login usually, but let's try)
      if (email !== user.email) {
        await updateEmail(auth.currentUser!, email);
      }

      // Update Password
      if (newPassword) {
        await updatePassword(auth.currentUser!, newPassword);
        setNewPassword("");
      }

      // Sync to Firestore User record
      await updateDoc(doc(db, "users", user.uid), {
        displayName,
        email,
        profileUpdated: new Date().toISOString()
      });

      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error("Updating email/password requires a recent login. Please re-authenticate.");
      } else {
        toast.error("Failed to update profile: " + error.message);
      }
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPersonalLoading(true);

    try {
      const personaData = {
        name: personaForm.name,
        agentName: personaForm.agentName,
        agentRole: personaForm.agentRole,
        agentEmail: personaForm.agentEmail,
        description: personaForm.description,
        customPrompts: {
          research: personaForm.researchPrompt,
          outreach: personaForm.outreachPrompt
        },
        isDefault: personaForm.isDefault,
        updatedAt: new Date().toISOString()
      };

      if (editingPersona) {
        await updateDoc(doc(db, "users", user.uid, "personas", editingPersona.id), personaData);
        toast.success("Persona updated");
      } else {
        await addDoc(collection(db, "users", user.uid, "personas"), {
          ...personaData,
          createdAt: new Date().toISOString()
        });
        toast.success("Persona created");
      }

      // If this is default, unset others
      if (personaForm.isDefault) {
        const otherDefaults = personas.filter(p => p.isDefault && (!editingPersona || p.id !== editingPersona.id));
        for (const p of otherDefaults) {
          await updateDoc(doc(db, "users", user.uid, "personas", p.id), { isDefault: false });
        }
      }

      setShowPersonaForm(false);
      setEditingPersona(null);
      setPersonaForm({
        name: "",
        agentName: "",
        agentRole: "",
        agentEmail: "",
        description: "",
        researchPrompt: "",
        outreachPrompt: "",
        isDefault: false
      });
    } catch (error) {
      toast.error("Failed to save persona");
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!user || !window.confirm("Delete this persona?")) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "personas", id));
      toast.success("Persona deleted");
    } catch (error) {
      toast.error("Failed to delete persona");
    }
  };

  const openEditPersona = (p: any) => {
    setEditingPersona(p);
    setPersonaForm({
      name: p.name,
      agentName: p.agentName || "",
      agentRole: p.agentRole || "",
      agentEmail: p.agentEmail || "",
      description: p.description || "",
      researchPrompt: p.customPrompts?.research || "",
      outreachPrompt: p.customPrompts?.outreach || "",
      isDefault: p.isDefault || false
    });
    setShowPersonaForm(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row gap-12">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 space-y-2">
          <div className="mb-8">
            <h1 className="text-3xl font-black uppercase tracking-tighter">Profile</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account Settings</p>
          </div>
          
          <button className="w-full flex items-center justify-between p-3 bg-white border-2 border-slate-900 rounded-xl shadow-neo-sm font-black uppercase text-xs tracking-widest text-indigo-600">
            <div className="flex items-center gap-3">
              <UserIcon className="w-4 h-4" />
              General
            </div>
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button className="w-full flex items-center justify-between p-3 bg-white border-2 border-slate-200 rounded-xl font-black uppercase text-xs tracking-widest text-slate-400 hover:border-slate-900 hover:text-slate-900 transition-all">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4" />
              Personas
            </div>
            <ChevronRight className="w-4 h-4" />
          </button>

          {role === "admin" && (
            <div className="mt-8 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-black uppercase text-indigo-600">Admin Privileges</span>
              </div>
              <p className="text-[9px] font-bold text-indigo-400 uppercase leading-tight italic">
                You have global power to manage system-level prompts and users.
              </p>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 space-y-12">
          
          {/* General Information */}
          <section className="space-y-6">
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">Personal Information</h2>
              <Settings className="w-5 h-5 text-slate-300" />
            </div>

            <form onSubmit={handleUpdatePersonalInfo} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-2xl border-2 border-slate-900 shadow-neo">
              <div className="space-y-2">
                <label className="label-mini flex items-center gap-2">
                  <UserIcon className="w-3 h-3" /> Full Name
                </label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="label-mini flex items-center gap-2">
                  <Mail className="w-3 h-3" /> Email Address
                </label>
                <input 
                  type="email" 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="label-mini flex items-center gap-2">
                  <Lock className="w-3 h-3" /> New Password
                </label>
                <input 
                  type="password" 
                  placeholder="Leave blank to keep same"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>

              <div className="md:col-span-2 pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={personalLoading}
                  className="px-8 py-3 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-slate-900 shadow-neo transition-all flex items-center gap-2"
                >
                  {personalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </section>

          {/* AI Personas & Prompts Command Center */}
          <section className="space-y-6">
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2">
              <h2 className="text-2xl font-black uppercase tracking-tight">AI Personas & Prompts</h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingPersona(null);
                    setPersonaForm({
                      name: "",
                      agentName: "",
                      agentRole: "",
                      agentEmail: "",
                      description: "",
                      researchPrompt: "",
                      outreachPrompt: "",
                      isDefault: false
                    });
                    setShowPersonaForm(!showPersonaForm);
                  }}
                  className="p-2 bg-white border-2 border-slate-900 rounded-lg hover:bg-slate-50 transition-colors shadow-neo-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-500 max-w-2xl uppercase tracking-tighter italic">
              Define custom personas and specific AI instructions. If a user persona isn't defined, the system defaults to "Google Customer Engineer" with standard templates.
            </p>

            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="wait">
                {showPersonaForm && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-8 bg-indigo-50 border-2 border-slate-900 rounded-2xl shadow-neo relative z-10"
                  >
                    <form onSubmit={handleSavePersona} className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black uppercase tracking-tight">{editingPersona ? "Edit Persona" : "New Custom Persona"}</h3>
                        <button type="button" onClick={() => setShowPersonaForm(false)} className="text-slate-400 hover:text-slate-900"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="label-mini">Persona Title / Nickname</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Sales Ninja, Tech Consultant"
                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                            value={personaForm.name}
                            onChange={e => setPersonaForm({...personaForm, name: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="label-mini">Target Agent Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. John Doe, Sarah Cloud"
                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                            value={personaForm.agentName}
                            onChange={e => setPersonaForm({...personaForm, agentName: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="label-mini">Target Agent Role</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Account Executive"
                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                            value={personaForm.agentRole}
                            onChange={e => setPersonaForm({...personaForm, agentRole: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="label-mini">Target Agent Email</label>
                          <input 
                            type="email" 
                            placeholder="e.g. john@company.com"
                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                            value={personaForm.agentEmail}
                            onChange={e => setPersonaForm({...personaForm, agentEmail: e.target.value})}
                          />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <label className="label-mini">Persona Bio / Description</label>
                          <textarea 
                            placeholder="Brief context for this persona's style and goals"
                            className="w-full h-24 p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-slate-900 transition-all"
                            value={personaForm.description}
                            onChange={e => setPersonaForm({...personaForm, description: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-3 bg-white/50 rounded-xl border-t border-l border-white">
                          <div className="flex items-center gap-2 mb-3">
                            <Terminal className="w-4 h-4 text-indigo-600" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest">Custom Prompts Command Center</h4>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="label-mini !text-[9px]">Research Prompt Override</label>
                              <textarea 
                                placeholder="Instructions for technical contact research..."
                                className="w-full h-32 p-4 bg-white border-2 border-slate-100 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900 transition-all"
                                value={personaForm.researchPrompt}
                                onChange={e => setPersonaForm({...personaForm, researchPrompt: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="label-mini !text-[9px]">Email Outreach Prompt Override</label>
                              <textarea 
                                placeholder="Instructions for email drafting..."
                                className="w-full h-32 p-4 bg-white border-2 border-slate-100 rounded-xl text-xs font-mono focus:outline-none focus:border-slate-900 transition-all"
                                value={personaForm.outreachPrompt}
                                onChange={e => setPersonaForm({...personaForm, outreachPrompt: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
                           <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                           <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight leading-normal">
                             Leaving prompts blank will use the system defaults. You can see default templates in the section below.
                           </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input 
                            type="checkbox"
                            className="w-5 h-5 rounded border-2 border-slate-900 text-indigo-600 focus:ring-0"
                            checked={personaForm.isDefault}
                            onChange={e => setPersonaForm({...personaForm, isDefault: e.target.checked})}
                          />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Set as primary persona</span>
                        </label>

                        <button 
                          type="submit"
                          className="px-8 py-3 bg-slate-900 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-indigo-600 shadow-neo transition-all"
                        >
                          {editingPersona ? "Update Persona" : "Create Persona"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Persona List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {personas.map((p) => (
                  <div key={p.id} className="p-6 bg-white border-2 border-slate-200 rounded-2xl group hover:border-slate-900 transition-all relative overflow-hidden">
                    {p.isDefault && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-neo-sm">
                        Primary
                      </div>
                    )}
                    <h3 className="text-lg font-black uppercase tracking-tight mb-1">{p.name}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-tight mb-6">{p.description || "No description"}</p>
                    
                    <div className="flex gap-4 mb-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black uppercase text-slate-300">Research</span>
                        <div className={`w-8 h-1 rounded-full ${p.customPrompts?.research ? 'bg-indigo-400' : 'bg-slate-100'}`}></div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black uppercase text-slate-300">Outreach</span>
                        <div className={`w-8 h-1 rounded-full ${p.customPrompts?.outreach ? 'bg-indigo-400' : 'bg-slate-100'}`}></div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                      <button 
                        onClick={() => openEditPersona(p)}
                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline"
                      >
                        Edit Persona
                      </button>
                      <button 
                        onClick={() => handleDeletePersona(p.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Reference: System Defaults */}
          <section className="space-y-6 pt-12 border-t-2 border-dashed border-slate-200">
            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
              <Terminal className="w-5 h-5 text-indigo-400" />
              System Default Prompts Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemPrompts.map((p) => (
                <button 
                  key={p.id} 
                  onClick={() => setViewingPrompt(p)}
                  className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-left hover:border-slate-900 hover:bg-white transition-all group"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black uppercase text-indigo-600">{p.name}</span>
                    <span className="text-[8px] font-mono text-slate-400">{p.id}</span>
                  </div>
                  <div className="bg-white group-hover:bg-slate-50 border border-slate-100 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar transition-colors">
                    <pre className="text-[9px] font-mono text-slate-500 whitespace-pre-wrap">{p.template}</pre>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 group-hover:text-indigo-600 transition-colors">Click to view & copy</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* System Prompt Viewer Modal */}
      <AnimatePresence>
        {viewingPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-3xl bg-white border-4 border-slate-900 rounded-3xl shadow-neo p-8 relative"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">{viewingPrompt.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Default Template ({viewingPrompt.id})</p>
                </div>
                <button 
                  onClick={() => setViewingPrompt(null)}
                  className="p-2 bg-slate-100 rounded-full hover:bg-slate-900 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="label-mini">Prompt Template</label>
                  <textarea 
                    readOnly
                    className="w-full h-96 p-6 bg-slate-50 border-2 border-slate-900 rounded-2xl text-xs font-mono leading-relaxed focus:outline-none resize-none custom-scrollbar"
                    value={viewingPrompt.template}
                  />
                </div>

                <div className="flex justify-between items-center pt-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Info className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase tracking-tight">Variables like {'{name}'} are replaced at runtime.</span>
                  </div>
                  <button 
                    onClick={() => copyPromptText(viewingPrompt.template)}
                    className="px-8 py-3 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-slate-900 shadow-neo transition-all flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Template
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
