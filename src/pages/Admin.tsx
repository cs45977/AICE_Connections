import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { collection, query, doc, updateDoc, deleteDoc, onSnapshot, orderBy, writeBatch, setDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { Shield, Users, Building2, Database, Trash2, Edit2, Check, X, Search, MoreVertical, Terminal, Info, Zap, FileText, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

type Tab = "users" | "contacts" | "prompts" | "settings";

const DEFAULT_GLOBAL_REQUIREMENTS = "Search for C-Suite Executives, Members of the Board, and Vice Presidents in the company.";

const DEFAULT_SEED_PROMPTS = [
  {
    id: "researchContact",
    name: "Contact Research",
    description: "Used to synthesize insights about a prospect from web search results.",
    variables: "name, email, role, company",
    template: `Perform research on this contact and their company to find relevant sales personalization insights.
Contact Name: {{name}}
Email: {{email}}
Role: {{role}}
Company: {{company}}

Provide a list of 5 key insights, recent company news, or professional highlights that a sales person could use to personalize an outreach email.
Format the response as bullet points.`
  },
  {
    id: "generateEmail",
    name: "Email Generation",
    description: "Used to draft personalized outreach emails based on research data.",
    variables: "subject, name, role, company, researchSummary",
    template: `You are an expert Google Customer Engineer. Your goal is to write a highly personalized, consultative, and value-driven sales outreach email.

Outreach Subject/Goal: {{subject}}
Contact Name: {{name}}
Contact Role: {{role}}
Contact Company: {{company}}

Research Insights:
{{researchSummary}}

Write the email draft. Use a professional yet conversational tone. Incorporate at least 2 specific research insights.

Structure:
1. Professional Greeting
2. Personalized Hook (based on research)
3. Value Prop (connected to their role/company)
4. Soft Call to Action
5. Professional Closing`
  },
  {
    id: "generateDiscoveryQuestions",
    name: "Discovery Guardrail",
    description: "Generates clarifying questions for users during prospect discovery.",
    variables: "companyName, companyUrl",
    template: `You are a sales discovery agent. A user wants to find prospects at {{companyName}} ({{companyUrl}}).
Your goal is to ask 2-3 specific questions to help narrow down what kind of prospects they are looking for (e.g. "Are you looking for decision makers in IT or Marketing?", "Should they be based in a specific region?").
Provide the output as a list of questions. Keep it brief and professional.`
  },
  {
    id: "searchProspects",
    name: "Prospect Search",
    description: "The primary engine for finding and verifying real prospects at a company.",
    variables: "companyName, companyUrl, criteria",
    template: `Find potential prospect names and their job titles for the company {{companyName}} ({{companyUrl}}) based on these criteria: {{criteria}}.
You MUST search the web for real people if possible. 
Provide a list of 5-8 potential prospects.

Format the output as a JSON list of objects. Each object should have:
- name: Full Name
- title: Job Title
- department: Likely focus/department
- linkedin: A professional LinkedIn URL if found, or null
- source: A URL to the source of this information or the company website profile if found, or null
- insight: A brief 1-sentence insight on why they match the criteria

At the end, state that contact emails should be verified independently.`
  }
];

export function Admin() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [seeding, setSeeding] = useState(false);
  const [globalReq, setGlobalReq] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (role !== "admin") return;

    if (activeTab === "settings") {
      const unsub = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
        if (docSnap.exists()) {
          setGlobalReq(docSnap.data().defaultDiscoveryRequirements || DEFAULT_GLOBAL_REQUIREMENTS);
        } else {
          setGlobalReq(DEFAULT_GLOBAL_REQUIREMENTS);
        }
        setLoading(false);
      });
      return () => unsub();
    }

    setLoading(true);
    let q;
    
    if (activeTab === "users") {
      q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    } else if (activeTab === "contacts") {
      q = query(collection(db, "contacts"), orderBy("updatedAt", "desc"));
    } else if (activeTab === "prompts") {
      q = query(collection(db, "prompts"), orderBy("name", "asc"));
    }

    if (q) {
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setData(docs);
          setLoading(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, activeTab);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      setData([]);
      setLoading(false);
    }
  }, [activeTab, role]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt) return;

    try {
      await updateDoc(doc(db, "prompts", editingPrompt.id), {
        template: editingPrompt.template,
        updatedAt: new Date().toISOString()
      });
      toast.success("Prompt template updated");
      setEditingPrompt(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `prompts/${editingPrompt.id}`);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(doc(db, "settings", "global"), {
        id: "global",
        defaultDiscoveryRequirements: globalReq,
        updatedAt: new Date().toISOString()
      });
      toast.success("Global settings updated");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/global");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSeedPrompts = async () => {
    setSeeding(true);
    const toastId = toast.loading("Initializing system prompts...");
    
    try {
      const batch = writeBatch(db);
      DEFAULT_SEED_PROMPTS.forEach(p => {
        const ref = doc(db, "prompts", p.id);
        batch.set(ref, {
          name: p.name,
          description: p.description,
          variables: p.variables,
          template: p.template,
          updatedAt: new Date().toISOString()
        });
      });
      
      await batch.commit();
      toast.success("Default prompts initialized successfully", { id: toastId });
    } catch (error) {
      toast.error("Failed to seed prompts.", { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, "prompts/seed");
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const path = activeTab === "users" ? "users" : (activeTab === "contacts" ? "contacts" : "prompts");
      await deleteDoc(doc(db, path, id));
      toast.success("Record deleted");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${activeTab}/${id}`);
    }
  };

  if (role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-white border-2 border-slate-900 shadow-neo rounded-xl">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2 uppercase">Access Denied</h1>
          <p className="text-slate-600 font-bold">You need administrator privileges to view this section.</p>
        </div>
      </div>
    );
  }

  const filteredData = data.filter(item => {
    const searchStr = JSON.stringify(item).toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Command Center</h1>
          <div className="flex items-center gap-4">
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Admin Dashboard & Global Manager</p>
            <Link to="/admin/requirements" className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100">
               <FileText className="w-3 h-3" />
               Technical Specs
            </Link>
          </div>
        </div>
        <div className="flex gap-2 p-1 bg-white border-2 border-slate-900 rounded-xl shadow-neo-sm">
          <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users className="w-4 h-4" />} label="Users" />
          <TabButton active={activeTab === "contacts"} onClick={() => setActiveTab("contacts")} icon={<Database className="w-4 h-4" />} label="Contacts" />
          <TabButton active={activeTab === "prompts"} onClick={() => setActiveTab("prompts")} icon={<Terminal className="w-4 h-4" />} label="Prompts" />
          <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<Settings className="w-4 h-4" />} label="Settings" />
        </div>
      </div>

      {activeTab === "prompts" && data.length === 0 && !loading && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-8 bg-white border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center text-center shadow-neo-sm"
        >
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-xl font-black uppercase mb-2">No Prompts Found</h3>
          <p className="text-slate-500 font-bold mb-6 max-w-md">Initialize the system with the default AI prompt templates used for research, search, and outreach.</p>
          <button 
            onClick={handleSeedPrompts}
            disabled={seeding}
            className="px-8 py-3 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-slate-900 shadow-neo transition-all flex items-center gap-2"
          >
            {seeding ? "Initializing..." : "Seed Default Prompts"}
          </button>
        </motion.div>
      )}

      {editingPrompt && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-indigo-50 border-2 border-slate-900 rounded-2xl shadow-neo"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black uppercase tracking-tight">Edit Prompt: {editingPrompt.name}</h3>
            <button onClick={() => setEditingPrompt(null)} className="p-2 hover:bg-white rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleUpdatePrompt} className="space-y-4">
            <div>
              <label className="label-mini !text-indigo-600 mb-2">Template</label>
              <textarea 
                className="w-full h-64 bg-white border-2 border-slate-900 rounded-xl p-4 font-mono text-sm focus:outline-none focus:shadow-neo-sm"
                value={editingPrompt.template}
                onChange={e => setEditingPrompt({ ...editingPrompt, template: e.target.value })}
              />
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/50 rounded-lg">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                Variables are supported using double curly braces (e.g., {"{{variable_name}}"}). Be careful when modifying template structure.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="px-8 py-3 bg-indigo-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-slate-900 shadow-neo-sm transition-all">
                Update Template
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="mb-8">
        {activeTab !== "settings" && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search across all records..."
              className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-900 rounded-xl shadow-neo-sm font-bold focus:outline-none focus:ring-4 ring-indigo-500/10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {activeTab === "settings" ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-slate-900 rounded-2xl p-8 shadow-neo"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-neo-sm">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Global Discovery Defaults</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master instructions for the Prospect Discovery engine</p>
            </div>
          </div>

          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div className="space-y-2">
              <label className="label-mini !text-slate-900 border-indigo-200">Default "Your Requirements" Instruction</label>
              <p className="text-xs text-slate-500 font-medium mb-2 leading-relaxed">
                This instruction is used as the default starting point for all users when they open the "Find Prospects" tool.
              </p>
              <textarea 
                className="w-full h-40 bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 font-bold text-slate-700 focus:outline-none focus:border-indigo-600 transition-all"
                value={globalReq}
                onChange={e => setGlobalReq(e.target.value)}
                placeholder="Enter the default search requirements..."
              />
            </div>

            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={savingSettings}
                className="px-10 py-4 bg-indigo-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-slate-900 shadow-neo transition-all flex items-center gap-2"
              >
                {savingSettings ? "Saving Settings..." : "Save Instructions"}
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        <div className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-neo">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-slate-900">
                  {activeTab === "users" && (
                    <>
                      <th className="px-6 py-4 font-black uppercase text-xs">User / Email</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Role</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Created</th>
                      <th className="px-6 py-4 font-black uppercase text-xs text-right">Actions</th>
                    </>
                  )}
                  {activeTab === "contacts" && (
                    <>
                      <th className="px-6 py-4 font-black uppercase text-xs">Contact</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Company</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Created By</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Updated</th>
                      <th className="px-6 py-4 font-black uppercase text-xs text-right">Actions</th>
                    </>
                  )}
                  {activeTab === "prompts" && (
                    <>
                      <th className="px-6 py-4 font-black uppercase text-xs">Prompt Name</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Description</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Variables</th>
                      <th className="px-6 py-4 font-black uppercase text-xs">Updated</th>
                      <th className="px-6 py-4 font-black uppercase text-xs text-right">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-bold text-slate-500 uppercase text-xs tracking-widest">Scanning Databases...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center font-bold text-slate-400 italic">
                      No records found matching your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      {activeTab === "users" && (
                        <>
                          <td className="px-6 py-4">
                            <div className="font-bold">{item.displayName || "Unknown User"}</div>
                            <div className="text-xs text-slate-500 font-medium">{item.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              value={item.role} 
                              onChange={(e) => handleUpdateRole(item.id, e.target.value)}
                              className="bg-white border text-xs font-bold py-1 px-2 rounded-lg cursor-pointer focus:ring-2 ring-indigo-500"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === "contacts" && (
                        <>
                          <td className="px-6 py-4 font-bold">
                            {item.name}
                            <div className="text-[10px] text-slate-400 font-mono">{item.email}</div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600">{item.company}</td>
                          <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">{item.createdBy}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400">
                             {new Date(item.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                      {activeTab === "prompts" && (
                        <>
                          <td className="px-6 py-4">
                            <div className="font-bold uppercase tracking-tight text-indigo-600">{item.name}</div>
                            <div className="text-[9px] font-mono text-slate-400">{item.id}</div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-600 max-w-xs">{item.description}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {item.variables?.split(',').map((v: string) => (
                                <span key={v} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black rounded border border-slate-200 uppercase">{v.trim()}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-400">
                             {new Date(item.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => setEditingPrompt(item)}
                              className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-tight transition-all ${
        active ? "bg-slate-900 text-white shadow-neo-sm" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
