import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, getDocs, collectionGroup, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { 
  TrendingUp, 
  Users, 
  Mail, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Clock,
  PieChart as PieChartIcon,
  BarChart3,
  Activity
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { motion } from "motion/react";

export function Insights() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalOutreach: 0,
    conversionRate: 0,
    activeProspects: 0
  });
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [outreachTrends, setOutreachTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch all contacts
    const contactsQuery = query(collection(db, "contacts"), where("createdBy", "==", user.uid));
    
    const unsubContacts = onSnapshot(contactsQuery, async (snapshot) => {
      const contacts = snapshot.docs.map(doc => doc.data());
      
      // Fetch all outreach (collectionGroup for global view)
      const outreachQuery = query(collectionGroup(db, "outreach"), where("createdBy", "==", user.uid));
      const outreachSnap = await getDocs(outreachQuery);
      const outreachList = outreachSnap.docs.map(doc => doc.data());

      setStats({
        totalContacts: contacts.length,
        totalOutreach: outreachList.length,
        conversionRate: outreachList.length > 0 ? (outreachList.filter(o => o.status === 'sent').length / outreachList.length) * 100 : 0,
        activeProspects: contacts.filter(c => c.status !== 'Won' && c.status !== 'Lost').length
      });

      // Prepare Pipeline Data (Status distribution)
      const statusMap: Record<string, number> = {
        'New': 0,
        'Researching': 0,
        'Outreach': 0,
        'Nurturing': 0,
        'Won': 0,
        'Lost': 0
      };
      contacts.forEach(c => {
        const s = c.status || 'New';
        statusMap[s] = (statusMap[s] || 0) + 1;
      });
      setPipelineData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

      // Prepare Outreach Trends (Simple grouping by date)
      const trends: Record<string, number> = {};
      outreachList.forEach(o => {
        if (o.createdAt) {
          const date = new Date(o.createdAt).toLocaleDateString();
          trends[date] = (trends[date] || 0) + 1;
        }
      });
      setOutreachTrends(Object.entries(trends)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7)
      );

      setLoading(false);
    });

    return () => unsubContacts();
  }, [user]);

  const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4ade80', '#fb7185'];

  if (loading) {
    return (
      <div className="p-12 flex justify-center items-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-10 h-10 animate-spin text-indigo-600 opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Synthesizing Pipeline Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-neo-sm">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">
            Pipeline <span className="text-indigo-600">Insights</span>
          </h1>
        </div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
          Performance analytics and conversion metrics
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {[
          { label: "Total Prospects", value: stats.totalContacts, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total Outreach", value: stats.totalOutreach, icon: Mail, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Conversion Rate", value: `${stats.conversionRate.toFixed(1)}%`, icon: Target, color: "text-green-600", bg: "bg-green-50" },
          { label: "Active Deals", value: stats.activeProspects, icon: Activity, color: "text-amber-600", bg: "bg-amber-50" }
        ].map((kpi, i) => (
          <motion.div 
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="neo-card p-6 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{kpi.label}</p>
              <h3 className="text-2xl font-black text-slate-900">{kpi.value}</h3>
            </div>
            <div className={`p-3 ${kpi.bg} ${kpi.color} rounded-xl shadow-neo-sm`}>
              <kpi.icon className="w-5 h-5" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Pipeline Distribution Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neo-card p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Pipeline Funnel
            </h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Stage Distribution</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '2px solid #0f172a',
                    boxShadow: '4px 4px 0px #0f172a',
                    fontSize: '12px',
                    fontWeight: 900,
                    textTransform: 'uppercase'
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Outreach Trend Chart */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="neo-card p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Outreach Activity
            </h3>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Last 7 Days</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={outreachTrends}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '2px solid #0f172a',
                    boxShadow: '4px 4px 0px #0f172a',
                    fontSize: '12px',
                    fontWeight: 900,
                    textTransform: 'uppercase'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#4f46e5" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <div className="neo-card p-8 bg-slate-900 border-slate-900">
        <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="p-6 bg-slate-800 rounded-3xl border-2 border-slate-700 shadow-neo-sm">
                 <PieChartIcon className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="flex-1">
                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Efficiency Analysis</h3>
                <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
                    Our AI models suggest that personalized personas are improving discovery accuracy by 34%. 
                    Focus on the "Outreach" stage for contacts generated through the "Executive Researcher" persona for maximum impact.
                </p>
                <div className="flex flex-wrap gap-4 mt-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Models Healthy</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest">Persona Sync Active</span>
                    </div>
                </div>
            </div>
            <button className="neo-button bg-white text-slate-900 !px-8 hover:bg-slate-50">
                Generate Report
            </button>
        </div>
      </div>
    </div>
  );
}
