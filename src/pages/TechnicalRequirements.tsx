import React from "react";
import ReactMarkdown from "react-markdown";
import { FileText, ArrowLeft, Shield, Cpu, Database, Layout, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

const requirementsMarkdown = `
# Executive CRM: Technical Requirements Document (TRD)

## 1. Project Overview
A high-performance Sales Intelligence CRM designed for executive outreach. The system combines AI-driven prospecting, research automation, and persona-driven communication.

---

## 2. Core Architecture
- **Frontend**: React 19 + Vite (Type-stripped ESM)
- **Styling**: Tailwind CSS 4.0 (Neo-Brutalist Design System)
- **Database**: Firebase Cloud Firestore (Enterprise Edition)
- **Authentication**: Firebase Authentication (Google Cloud Identity)
- **AI Engine**: Google Gemini Pro 1.5 (via @google/genai SDK)

---

## 3. Module Specifications

### 3.1. Persona Management
Users can create and manage AI Personas that act as context for all research and outreach generation.
- **Fields**: \`agentName\`, \`agentRole\`, \`agentEmail\`, \`isDefault\`, \`customDiscoveryRequirements\`.
- **Integration**: Injected into Gemini prompt templates as system context.
- **Customization**: Individual personas can define their own default search requirements for more targeted prospecting.

### 3.2. AI Prospecting (Discovery)
- **Logic**: Automated web-search and scraping simulation via Gemini.
- **Persona Context**: Search criteria are refined based on the selected Persona.
- **History**: Discovery sessions are persisted and can be re-opened.
- **Requirements Engine**: Leverages a dual-layer requirement system:
  1. **Global Default**: System-wide baseline (e.g., C-Suite, Board, VP search).
  2. **Persona Override**: Specific targeting instructions based on the active persona.

---

### 3.6. Global System Configuration
Managed via the Admin Command Center.
- **Global Search Requirements**: Editable starting instructions for all discovery sessions.
- **Prompt Management**: Direct control over base AI templates.
- **User Role Management**: Tiered access control (User/Admin).

### 3.3. Sales Pipeline (Prospects)
- **Management**: Full CRUD for contacts.
- **Research**: One-click AI deep-research using Gemini Pro.
- **State Handling**: Multi-stage funnel (New, Researching, Outreach, Nurturing, Won, Lost).

### 3.4. Outreach Engine (AI Drafting)
- **Features**: Personalized email drafting from research data.
- **Draft Queue**: Centralized \`UnsentDrafts\` view for managing pending communications.
- **Actions**: Save Draft, Load Draft, Mark as Sent, Mark as 'Won't Send'.

### 3.5. Pipeline Insights (Analytics)
- **Data Visualization**: Real-time charts using \`Recharts\`.
- **KPIs**: Conversion rates, activity trends, stage distribution.

---

## 4. Security & Compliance
- **Firestore Rules**: Hardened ABAC (Attribute-Based Access Control) rules.
- **PII Isolation**: Strict read/write permissions for user-owned documents.
- **Verification**: Mandatory email verification for write operations.

---

## 5. Deployment Information
- **Environment**: AI Studio Cloud Run Container.
- **Port**: 3000 (Nginx Proxy).
- **HMR**: Disabled for agent-driven stability.
`;

export function TechnicalRequirements() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12 border-b-2 border-slate-900 pb-8 flex items-end justify-between">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <FileText className="w-8 h-8 text-indigo-600" />
             <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 focus:outline-none">
               Technical <span className="text-indigo-600">Specs</span>
             </h1>
           </div>
           <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
             System Architecture & Requirements Document
           </p>
        </div>
        <Link to="/admin" className="neo-button-outline !px-4 !py-2 text-[10px] uppercase tracking-widest flex items-center gap-2">
           <ArrowLeft className="w-4 h-4" />
           Back to Admin
        </Link>
      </header>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="neo-card p-10 bg-white"
      >
        <div className="prose prose-slate max-w-none 
          prose-headings:uppercase prose-headings:tracking-tighter prose-headings:font-black
          prose-h1:text-3xl prose-h2:text-xl prose-h2:border-b-2 prose-h2:border-slate-100 prose-h2:pb-2 prose-h2:mt-12
          prose-li:text-sm prose-li:font-bold prose-li:text-slate-600
          prose-p:text-sm prose-p:leading-relaxed prose-p:text-slate-500
          prose-strong:text-slate-900 prose-strong:font-black
          prose-code:bg-slate-100 prose-code:text-indigo-600 prose-code:px-1 prose-code:rounded prose-code:font-mono
        ">
          <ReactMarkdown>{requirementsMarkdown}</ReactMarkdown>
        </div>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="neo-card p-6 bg-indigo-50 border-indigo-200">
           <Shield className="w-6 h-6 text-indigo-600 mb-4" />
           <h3 className="text-xs font-black uppercase mb-1">Security Audit</h3>
           <p className="text-[10px] font-bold text-indigo-400">Rules deployed & verified</p>
        </div>
        <div className="neo-card p-6 bg-slate-900 border-slate-900">
           <Cpu className="w-6 h-6 text-indigo-400 mb-4" />
           <h3 className="text-xs font-black uppercase mb-1 text-white">AI Models</h3>
           <p className="text-[10px] font-bold text-slate-500">Gemini 1.5 Pro Latency Opt</p>
        </div>
        <div className="neo-card p-6 bg-white">
           <Database className="w-6 h-6 text-slate-900 mb-4" />
           <h3 className="text-xs font-black uppercase mb-1">Data Integrity</h3>
           <p className="text-[10px] font-bold text-slate-400">Firestore Mirroring Active</p>
        </div>
      </div>
    </div>
  );
}
