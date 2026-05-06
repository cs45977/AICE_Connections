import React, { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, orderBy, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { Plus, Search, Mail, ExternalLink, Calendar, Sparkles, Upload, Download, Linkedin, Phone } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import Papa from "papaparse";
import { toast } from "sonner";

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [contacts, setContacts] = useState<any[]>([]);
  const isInsightsView = location.pathname === "/contacts";
  const [recentOutreach, setRecentOutreach] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [personas, setPersonas] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "personas"));
    const unsub = onSnapshot(q, (snap) => {
      const pMap: Record<string, any> = {};
      snap.docs.forEach(doc => {
        pMap[doc.id] = doc.data();
      });
      setPersonas(pMap);
    });
    return () => unsub();
  }, [user]);

  const handleDownloadTemplate = () => {
    const csvContent = "Name,Email,Job Title,Company,LinkedIn URL,Phone\nJohn Doe,john@example.com,CTO,Acme Corp,https://linkedin.com/in/johndoe,+15550000000";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "prospects_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let successCount = 0;
        let skipCount = 0;
        
        for (const row of results.data as any[]) {
          const name = row["Name"] || row["name"];
          const email = row["Email"] || row["email"];
          const role = row["Job Title"] || row["role"] || row["title"] || "";
          const company = row["Company"] || row["company"] || "";
          const linkedin = row["LinkedIn URL"] || row["linkedin"] || "";
          const phone = row["Phone"] || row["phone"] || "";

          if (!name || !email) {
            skipCount++;
            continue;
          }

          try {
            await addDoc(collection(db, "contacts"), {
              name,
              email,
              role,
              company,
              linkedin,
              phone,
              createdBy: user.uid,
              updatedAt: new Date().toISOString(),
            });
            successCount++;
          } catch (error) {
            console.error("Error adding contact", error);
            try {
              handleFirestoreError(error, OperationType.CREATE, "contacts");
            } catch (err) {
               // handleFirestoreError throws, so we catch its error so the loop doesn't break
            }
            skipCount++;
          }
        }
        
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        
        if (successCount > 0) {
          toast.success(`Successfully imported ${successCount} prospects`);
        }
        if (skipCount > 0) {
          toast.error(`Skipped ${skipCount} invalid rows (missing name or email)`);
        }
      },
      error: (error) => {
        toast.error("Failed to parse CSV file");
        setUploading(false);
      }
    });
  };

  useEffect(() => {
    const contactsQuery = query(
      collection(db, "contacts"),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(contactsQuery, (snap) => {
      setContacts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "contacts");
    });

    return () => unsub();
  }, []);

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-2 border-slate-900">
        <div>
          <h1 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">
            {isInsightsView ? "Performance Analytics" : "Master Pipeline"}
          </h1>
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-black tracking-tighter uppercase">
              {isInsightsView ? "Pipeline Insights" : "Prospects"}
            </h2>
            <span className="px-3 py-1 bg-slate-900 text-white rounded text-xs font-bold font-mono">{contacts.length} Total</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input 
              type="text" 
              placeholder="Filter by name or account..." 
              className="pl-10 h-10 w-72 bg-white border-2 border-slate-900 rounded-lg text-sm font-medium focus:outline-none focus:shadow-neo-sm transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={uploading}
              className="neo-button-outline flex items-center gap-2 rounded-lg text-xs tracking-widest disabled:opacity-50"
              title="Import CSV"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "..." : "Import"}
            </button>
            <button 
              onClick={handleDownloadTemplate}
              className="neo-button-outline flex items-center gap-2 rounded-lg text-xs tracking-widest"
              title="Download CSV Template"
            >
              <Download className="w-4 h-4" />
            </button>
            <Link to="/contact/new" className="neo-button-primary flex items-center gap-2 rounded-lg text-xs tracking-widest">
              <Plus className="w-4 h-4" />
              Add Prospect
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Main List Section */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div className="neo-card !p-0 overflow-hidden">
            <div className="grid grid-cols-[1fr,1.5fr,1fr,80px] px-6 py-4 bg-slate-50 border-b-2 border-slate-900">
              <div className="label-mini !text-slate-900">Name</div>
              <div className="label-mini !text-slate-900">Account & Title</div>
              <div className="label-mini !text-slate-900 text-right">Last Sync</div>
              <div></div>
            </div>
            
            <div className="divide-y-2 divide-slate-100">
              {filteredContacts.map((contact, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  key={contact.id} 
                  className="grid grid-cols-[1fr,1.5fr,1fr,80px] px-6 py-5 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/contact/${contact.id}`)}
                >
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase tracking-tight">{contact.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <a 
                        href={`mailto:${contact.email}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold text-slate-400 font-mono italic hover:text-indigo-600 transition-colors"
                      >
                        {contact.email}
                      </a>
                      {contact.linkedin && (
                        <a 
                          href={contact.linkedin} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-slate-100 rounded transition-colors text-[#0A66C2]"
                        >
                          <Linkedin className="w-3 h-3" />
                        </a>
                      )}
                      {contact.phone && (
                        <a 
                          href={`tel:${contact.phone}`} 
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-900"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{contact.company}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-black uppercase text-slate-500">
                        {contact.role || 'Contact'}
                      </span>
                      {contact.discoveryPersonaId && personas[contact.discoveryPersonaId] && (
                        <span className="px-1.5 py-0.5 bg-indigo-100 border border-indigo-200 rounded text-[9px] font-black uppercase text-indigo-700 flex items-center gap-1">
                          <Sparkles className="w-2 h-2" />
                          {personas[contact.discoveryPersonaId].name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-slate-400">
                      {new Date(contact.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-2 bg-indigo-600 text-white rounded shadow-neo-sm">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </motion.div>
              ))}
              {filteredContacts.length === 0 && (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300">
                    <Search className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No matches found in your pipeline</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar / Stats Section */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="neo-card bg-indigo-600 text-white flex items-center justify-between">
            <div>
              <p className="label-mini !text-indigo-200 mb-1">Conversion Potential</p>
              <p className="text-3xl font-black tracking-tighter">74.2%</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
              <Mail className="w-6 h-6" />
            </div>
          </div>

          <div className="neo-card !p-5">
            <h3 className="label-mini !text-slate-900 mb-6 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Campaign Velocity
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-xs font-bold">Today</span>
                <span className="text-xs font-black font-mono">0 drafts</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-xs font-bold">This Week</span>
                <span className="text-xs font-black font-mono">0 sent</span>
              </div>
            </div>
          </div>

          <div className="neo-card flex-1 flex flex-col items-center justify-center text-center bg-slate-900 text-white relative overflow-hidden group">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-neo-sm relative z-10">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="font-black uppercase tracking-tight text-lg relative z-10">AI Insights Ready</h4>
            <p className="text-xs text-slate-400 mt-2 font-medium px-10 relative z-10">Leverage the research agent to unlock hyper-personalized outreach strategies.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
