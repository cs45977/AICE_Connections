import React, { useState, useEffect } from "react";
import { 
  collectionGroup, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc 
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { 
  Mail, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  FileText,
  Clock,
  User,
  ArrowRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export function UnsentDrafts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const draftsQuery = query(
      collectionGroup(db, "outreach"),
      where("status", "==", "draft"),
      where("createdBy", "==", user.uid)
    );

    const unsubscribe = onSnapshot(draftsQuery, async (snapshot) => {
      const draftList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        contactId: d.ref.parent.parent?.id
      }));
      setDrafts(draftList);
      setLoading(false);

      // Fetch contact details for these drafts
      const uniqueContactIds = Array.from(new Set(draftList.map(d => d.contactId).filter(Boolean)));
      const newContacts = { ...contacts };
      let changed = false;

      for (const cid of uniqueContactIds) {
        if (cid && !newContacts[cid]) {
          const cDoc = await getDoc(doc(db, "contacts", cid));
          if (cDoc.exists()) {
            newContacts[cid] = cDoc.data();
            changed = true;
          }
        }
      }

      if (changed) {
        setContacts(newContacts);
      }
    }, (error) => {
      console.error("Error fetching drafts:", error);
      toast.error("Failed to load drafts");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleMarkAsSent = async (draft: any) => {
    try {
      const draftRef = doc(db, "contacts", draft.contactId, "outreach", draft.id);
      await updateDoc(draftRef, {
        status: "sent",
        updatedAt: new Date().toISOString()
      });
      toast.success("Draft marked as sent");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleWontSend = async (draft: any) => {
    try {
      const draftRef = doc(db, "contacts", draft.contactId, "outreach", draft.id);
      await updateDoc(draftRef, {
        status: "wont-send",
        updatedAt: new Date().toISOString()
      });
      toast.success("Draft marked as 'Won't Send'");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (draft: any) => {
    if (!window.confirm("Are you sure you want to delete this draft?")) return;
    try {
      const draftRef = doc(db, "contacts", draft.contactId, "outreach", draft.id);
      await deleteDoc(draftRef);
      toast.success("Draft deleted");
    } catch (error) {
      toast.error("Failed to delete draft");
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 opacity-20" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-neo-sm">
            <Mail className="w-5 h-5" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 focus:outline-none">
            Unsent <span className="text-indigo-600">Drafts</span>
          </h1>
        </div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
          Centralized queue for all pending email reachouts
        </p>
      </header>

      {drafts.length === 0 ? (
        <div className="neo-card py-24 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 border-2 border-slate-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-slate-200" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-400">Inbox Zero achieved</h2>
          <p className="text-xs font-bold text-slate-300 mt-2">All drafts have been processed or are waiting for you to write them.</p>
          <Link to="/" className="mt-8 neo-button bg-indigo-600 text-white !px-8">
            Back to Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {drafts.map((draft) => {
              const contact = contacts[draft.contactId];
              return (
                <motion.div 
                  key={draft.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="neo-card flex flex-col md:flex-row md:items-center gap-6 group hover:border-indigo-600 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                        {draft.type || 'Draft'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {new Date(draft.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors mb-1">
                      {draft.subject || "No Subject"}
                    </h3>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 py-1 px-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-500 uppercase">
                        <User className="w-3 h-3" />
                        {contact ? contact.businessName : 'Loading...'}
                      </div>
                      {contact?.website && (
                         <span className="text-[10px] font-medium text-slate-400 italic">
                           {new URL(contact.website).hostname}
                         </span>
                      )}
                    </div>

                    {draft.description && (
                      <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 line-clamp-2 italic border-l-2 border-slate-200">
                        {draft.description}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:pl-6 md:border-l-2 md:border-slate-100">
                    <button 
                      onClick={() => navigate(`/contact/${draft.contactId}`)}
                      className="p-3 bg-white border-2 border-slate-900 rounded-xl hover:bg-slate-50 transition-all shadow-neo-sm group/btn"
                      title="Open Contact Detail"
                    >
                      <ArrowRight className="w-4 h-4 text-slate-900 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                    
                    <button 
                      onClick={() => handleMarkAsSent(draft)}
                      className="px-4 py-2 bg-green-100 border-2 border-green-600 text-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-200 transition-all flex items-center gap-2"
                      title="Mark as Sent"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Sent
                    </button>

                    <button 
                      onClick={() => handleWontSend(draft)}
                      className="px-4 py-2 bg-amber-50 border-2 border-amber-500 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center gap-2"
                      title="Mark as Won't Send"
                    >
                      <XCircle className="w-4 h-4" />
                      Skip
                    </button>

                    <button 
                      onClick={() => handleDelete(draft)}
                      className="p-3 bg-white border-2 border-slate-900 rounded-xl hover:bg-red-50 hover:border-red-600 hover:text-red-600 transition-all shadow-neo-sm"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <footer className="mt-12 pt-8 border-t border-slate-200">
         <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-slate-300">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-indigo-400" />
               Draft Status Valid
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-400" />
               Marking Sent Archivable
            </div>
         </div>
      </footer>
    </div>
  );
}
