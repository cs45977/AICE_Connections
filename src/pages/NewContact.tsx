import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export function NewContact() {
  const { companyId, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    company: "",
    linkedin: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    setLoading(true);
    try {
      const contactsRef = collection(db, "companies", companyId, "contacts");
      const docRef = await addDoc(contactsRef, {
        ...form,
        companyId,
        createdBy: user?.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success("Contact added successfully!");
      navigate(`/contact/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `companies/${companyId}/contacts`);
      toast.error("Failed to add contact.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="mb-8">
        <Link to="/" className="flex items-center gap-2 group text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Cancel Initialization
        </Link>
      </div>

      <div className="neo-card !p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-slate-50 -translate-y-20 translate-x-20 rotate-45 border-2 border-slate-900"></div>
        
        <header className="mb-12 relative z-10">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-6 shadow-neo-sm">
            <UserPlus className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Initialize Prospect</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Create a new entry in your master sales indices.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="label-mini">Subject Identity</label>
              <input 
                required 
                placeholder="Full Name" 
                className="w-full h-14 bg-slate-50 border-2 border-slate-900 rounded-xl px-4 text-sm font-bold focus:outline-none focus:bg-white focus:shadow-neo-sm transition-all"
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
              />
            </div>
            <div className="space-y-3">
              <label className="label-mini">Primary Comms</label>
              <input 
                required 
                type="email" 
                placeholder="email@example.com" 
                className="w-full h-14 bg-slate-50 border-2 border-slate-900 rounded-xl px-4 text-sm font-bold focus:outline-none focus:bg-white focus:shadow-neo-sm transition-all"
                value={form.email} 
                onChange={e => setForm({ ...form, email: e.target.value })} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="label-mini">Designation</label>
              <input 
                placeholder="e.g. Head of Infrastructure" 
                className="w-full h-14 bg-slate-50 border-2 border-slate-900 rounded-xl px-4 text-sm font-bold focus:outline-none focus:bg-white focus:shadow-neo-sm transition-all"
                value={form.role} 
                onChange={e => setForm({ ...form, role: e.target.value })} 
              />
            </div>
            <div className="space-y-3">
              <label className="label-mini">Account Assignment</label>
              <input 
                required 
                placeholder="Company Name" 
                className="w-full h-14 bg-slate-50 border-2 border-slate-900 rounded-xl px-4 text-sm font-bold focus:outline-none focus:bg-white focus:shadow-neo-sm transition-all"
                value={form.company} 
                onChange={e => setForm({ ...form, company: e.target.value })} 
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="label-mini">Intelligence Link (LinkedIn)</label>
            <input 
              type="url" 
              placeholder="https://linkedin.com/in/prospect-profile" 
              className="w-full h-14 bg-slate-50 border-2 border-slate-900 rounded-xl px-4 text-sm font-bold focus:outline-none focus:bg-white focus:shadow-neo-sm transition-all"
              value={form.linkedin} 
              onChange={e => setForm({ ...form, linkedin: e.target.value })} 
            />
          </div>

          <div className="pt-8">
            <button 
              type="submit" 
              disabled={loading} 
              className="neo-button-primary w-full h-16 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.2em]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              Provision Contact Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
