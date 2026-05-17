import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, Wallet, AlertCircle, CheckCircle2, ChevronRight, X, Receipt, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, YAxis } from "recharts";
import toast from "react-hot-toast";

type BudgetStatus = {
  monthly_allowance: number;
  total_spent: number;
  remaining_balance: number;
  percentage_used: number;
  forecast: {
    days_until_broke: number;
    projected_runout_date: string | null;
  };
  warning: boolean;
  not_enough_data: boolean;
};

type Expense = {
  id: string;
  title: string;
  amount: string;
  category: string;
  date: string;
};

type Breakdown = {
  category: string;
  total: number;
};

type WeeklyComparison = {
  name: string;
  spent: number;
};

const COLORS = ['#65A30D', '#0F172A', '#F43F5E', '#FBBF24', '#8B5CF6', '#38BDF8'];

export default function Budget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);
  const [weekly, setWeekly] = useState<WeeklyComparison[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isAffordModalOpen, setIsAffordModalOpen] = useState(false);
  
  // Add Expense form
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState("");
  const [formErrors, setFormErrors] = useState<{title?: boolean, amount?: boolean, date?: boolean}>({});
  const [showAllExpenses, setShowAllExpenses] = useState(false);

  // Afford form
  const [affordAmount, setAffordAmount] = useState("");
  const [affordResult, setAffordResult] = useState<{ canAfford: boolean; message: string } | null>(null);

  const fetchData = async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const [statusRes, breakdownRes, expensesRes] = await Promise.all([
        api.get(`/budget/${user.id}`),
        api.get(`/budget/breakdown/${user.id}`),
        api.get(`/budget/expenses/${user.id}`)
      ]);
      setStatus(statusRes.data);
      setBreakdown(breakdownRes.data.breakdown);
      setWeekly(breakdownRes.data.weeklyComparison);
      setExpenses(expensesRes.data.expenses);
    } catch (error) {
      console.error(error);
      setError("Failed to load budget data.");
      toast.error("Could not load budget data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const errors: any = {};
    if (!title.trim()) errors.title = true;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) errors.amount = true;
    if (!date) errors.date = true;
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please correctly fill all highlighted fields.");
      return;
    }
    
    try {
      await api.post("/budget/expense/add", {
         title,
         amount: parseFloat(amount),
         category,
         date: new Date(date).toISOString()
      });
      toast.success("Expense added successfully!");
      setIsExpenseModalOpen(false);
      setTitle("");
      setAmount("");
      setCategory("Food");
      setDate("");
      setFormErrors({});
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add expense");
    }
  };

  const checkAffordability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affordAmount) return;
    try {
      const res = await api.get(`/budget/can-i-afford/${user?.id}?amount=${affordAmount}`);
      setAffordResult(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Could not calculate affordability.");
    }
  };

  const getFormatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  if (loading) {
    return (
      <div className="pb-24 space-y-6">
        <div className="h-10 w-32 bg-black/5 animate-pulse rounded-full mb-6"></div>
        <div className="h-48 bg-black/5 animate-pulse rounded-[32px]"></div>
        <div className="h-16 bg-black/5 animate-pulse rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="h-64 bg-black/5 animate-pulse rounded-3xl"></div>
           <div className="h-64 bg-black/5 animate-pulse rounded-3xl"></div>
        </div>
        <div className="space-y-3">
           <div className="h-8 w-40 bg-black/5 animate-pulse rounded-full mb-4"></div>
           {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-black/5 animate-pulse rounded-2xl"></div>
           ))}
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
       <div className="flex flex-col items-center justify-center py-20 px-6 text-center h-[60vh]">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-sm border border-red-200">
             <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-dm-midnight mb-2">Oops! Something went wrong</h2>
          <p className="text-dm-midnight/60 font-medium mb-6 text-sm">{error || "Could not load budget."}</p>
          <button 
             onClick={fetchData}
             className="px-6 py-3 bg-dm-midnight text-white rounded-xl font-bold hover:bg-dm-midnight/90 transition-colors shadow-sm active:scale-95"
          >
             Try Again
          </button>
       </div>
    );
  }

  const progColor = status.percentage_used > 90 ? "bg-red-500" : status.percentage_used > 75 ? "bg-amber-400" : "bg-dm-moss";

  return (
    <div className="pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setIsExpenseModalOpen(true)}
          className="w-10 h-10 bg-dm-moss text-white rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0 border-2 border-dm-beige"
        >
          <Plus strokeWidth={3} size={20} />
        </button>
        <h1 className="text-3xl font-extrabold text-dm-midnight">Budget</h1>
      </div>

      {status.warning && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl shadow-sm mb-6 flex items-center gap-3 border border-red-200">
           <AlertCircle size={24} className="flex-shrink-0" />
           <p className="font-bold text-sm">Warning: Your spending is too high! You might run out of funds before the end of the month.</p>
        </div>
      )}

      {/* Progress Bar & Forecast */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 shadow-sm mb-6 border border-black/5 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-dm-moss/5 rounded-bl-full -z-10 blur-xl"></div>
         <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-xs font-bold text-dm-midnight/40 uppercase tracking-widest mb-1">Spent this month</p>
              <p className="text-4xl font-black text-dm-midnight">{getFormatCurrency(status.total_spent)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-dm-midnight/40 uppercase tracking-widest mb-1">Remaining</p>
              <p className="text-xl font-bold text-dm-moss bg-dm-moss/10 px-3 py-1 rounded-lg inline-block">{getFormatCurrency(status.remaining_balance)}</p>
            </div>
         </div>

         <div className="h-6 bg-dm-beige/50 rounded-full overflow-hidden mb-6 border border-black/5 p-1 relative">
            <div 
              className={`h-full ${progColor} transition-all duration-1000 rounded-full`} 
              style={{ width: `${Math.min(status.percentage_used, 100)}%` }}
            />
            {status.percentage_used > 0 && (
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-black text-white/90 drop-shadow-md">
                 {Math.round(status.percentage_used)}%
              </span>
            )}
         </div>

         <div className="bg-dm-beige/30 p-4 rounded-2xl flex items-start sm:items-center gap-3 border border-dm-beige">
            <span className="text-2xl mt-1 sm:mt-0">📅</span>
            {status.not_enough_data ? (
              <p className="text-sm font-semibold text-dm-midnight/70 leading-snug">Not enough data yet to calculate forecast.</p>
            ) : status.forecast.projected_runout_date ? (
              <p className="text-sm font-medium text-dm-midnight leading-snug">
                 At this rate, you'll run out on <span className="font-extrabold inline-block mt-1 sm:mt-0 bg-white px-2 py-0.5 rounded shadow-sm">{new Date(status.forecast.projected_runout_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-dm-moss leading-snug">You are on track to have money left over this month!</p>
            )}
         </div>
      </div>

      {/* Can I Afford This? */}
      <button 
        onClick={() => { setIsAffordModalOpen(true); setAffordResult(null); setAffordAmount(""); }}
        className="w-full bg-dm-midnight text-white rounded-2xl p-5 font-bold flex items-center justify-between mb-8 shadow-sm hover:scale-[1.01] active:scale-95 transition-all text-lg"
      >
         <span className="flex items-center gap-3"><Wallet className="text-dm-moss" size={24} /> Can I Afford This?</span>
         <ChevronRight size={24} className="text-white/40" />
      </button>

      {/* Charts */}
      <h2 className="text-xl font-extrabold text-dm-midnight mb-4">Spending Trends</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
         <div className="bg-white rounded-[32px] p-6 shadow-sm border border-black/5 flex flex-col items-center">
            <p className="text-xs font-black text-dm-midnight/40 uppercase tracking-widest mb-4 w-full">By Category</p>
            {breakdown.length > 0 ? (
              <div className="w-full h-56 relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={breakdown}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={90}
                       paddingAngle={5}
                       dataKey="total"
                       stroke="none"
                     >
                       {breakdown.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip 
                       formatter={(value: number) => getFormatCurrency(value)}
                       contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                     />
                   </PieChart>
                 </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-dm-midnight/30 font-bold text-sm bg-dm-beige/20 w-full rounded-3xl border-2 border-dashed border-dm-beige">
                 <PieChartIcon size={32} className="mb-2" />
                 No data yet
              </div>
            )}
         </div>

         <div className="bg-white rounded-[32px] p-6 shadow-sm border border-black/5">
            <p className="text-xs font-black text-dm-midnight/40 uppercase tracking-widest mb-4">Week over Week</p>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    formatter={(value: number) => getFormatCurrency(value)}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="spent" fill="#65A30D" radius={[8, 8, 8, 8]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Expense Log */}
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-xl font-extrabold text-dm-midnight">Recent Expenses</h2>
        {expenses.length > 5 && (
          <button 
            onClick={() => setShowAllExpenses(!showAllExpenses)}
            className="text-xs font-black text-dm-midnight/40 uppercase tracking-widest hover:text-dm-moss transition-colors bg-white px-3 py-1.5 rounded-lg border border-black/5 shadow-sm"
          >
            {showAllExpenses ? "View Less" : "View All"}
          </button>
        )}
      </div>

      <div className="space-y-3">
         {expenses.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-3xl border border-black/5 shadow-sm flex flex-col items-center">
             <div className="w-16 h-16 bg-dm-beige rounded-full flex items-center justify-center mb-4 text-dm-midnight/30">
               <Receipt size={32} />
             </div>
             <p className="text-dm-midnight font-bold">No recent expenses.</p>
             <p className="text-dm-midnight/50 font-medium text-sm mt-1">Log an expense below to see it here.</p>
           </div>
         ) : (
           (showAllExpenses ? expenses : expenses.slice(0, 5)).map((exp) => (
             <div key={exp.id} className="bg-white p-5 rounded-3xl flex justify-between items-center shadow-sm border border-black/5 transition-all hover:shadow-md group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-dm-beige/50 flex items-center justify-center text-dm-midnight font-black text-lg group-hover:scale-110 transition-transform">
                     {exp.category.charAt(0)}
                  </div>
                  <div>
                    <p className="font-extrabold text-dm-midnight text-lg leading-tight mb-0.5">{exp.title}</p>
                    <p className="text-xs font-bold text-dm-midnight/40 uppercase tracking-widest">
                      {new Date(exp.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} • {exp.category}
                    </p>
                  </div>
                </div>
                <div className="font-black text-dm-midnight text-lg">
                  {getFormatCurrency(parseFloat(exp.amount))}
                </div>
             </div>
           ))
         )}
      </div>



      {/* Modals */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-dm-midnight/40 backdrop-blur-sm transition-all pb-12 sm:pb-4">
           <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl relative border-4 border-dm-beige">
              <button onClick={() => setIsExpenseModalOpen(false)} className="absolute top-6 right-6 p-2 text-dm-midnight/40 hover:text-dm-midnight"><X size={24} /></button>
              <h2 className="text-2xl font-extrabold text-dm-midnight mb-6">Log Expense</h2>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-dm-midnight/40 mb-2 ml-2">What did you buy?</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Coffee" className={`w-full px-5 py-4 rounded-xl bg-dm-beige/30 outline-none font-bold focus:ring-4 focus:ring-dm-moss/20 transition-all text-dm-midnight border ${formErrors.title ? "border-red-500" : "border-transparent"}`} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-dm-midnight/40 mb-2 ml-2">Amount</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" className={`w-full px-5 py-4 rounded-xl bg-dm-beige/30 outline-none font-black text-2xl focus:ring-4 focus:ring-dm-moss/20 transition-all text-dm-midnight border ${formErrors.amount ? "border-red-500" : "border-transparent"}`} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-dm-midnight/40 mb-2 ml-2">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-5 py-4 rounded-xl bg-dm-beige/30 border border-transparent outline-none font-bold focus:ring-4 focus:ring-dm-moss/20 transition-all text-dm-midnight appearance-none">
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-dm-midnight/40 mb-2 ml-2">Date</label>
                  <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required className={`w-full px-5 py-4 rounded-xl bg-dm-beige/30 outline-none font-bold focus:ring-4 focus:ring-dm-moss/20 transition-all text-dm-midnight text-sm border ${formErrors.date ? "border-red-500" : "border-transparent"}`} />
                </div>
                <button type="submit" className="w-full py-4 bg-dm-moss text-white rounded-xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all mt-6 shadow-sm">Save Expense</button>
              </form>
           </div>
        </div>
      )}

      {isAffordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dm-midnight/40 backdrop-blur-sm transition-all pb-12 sm:pb-4">
           <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl relative border-4 border-dm-beige">
              <button onClick={() => setIsAffordModalOpen(false)} className="absolute top-6 right-6 p-2 text-dm-midnight/40 hover:text-dm-midnight"><X size={24} /></button>
              <h2 className="text-2xl font-extrabold text-dm-midnight mb-2">Can I Afford This?</h2>
              <p className="text-dm-midnight/50 font-bold text-sm mb-6 pr-8">Enter an amount to see if it fits in your current monthly budget pacing.</p>
              
              <form onSubmit={checkAffordability} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-dm-midnight/30 text-2xl">$</span>
                  <input type="number" step="0.01" value={affordAmount} onChange={e => setAffordAmount(e.target.value)} required placeholder="0.00" className="w-full pl-12 pr-6 py-5 rounded-2xl bg-dm-beige/30 border border-transparent outline-none font-black text-3xl focus:ring-4 focus:ring-dm-midnight/10 transition-all text-dm-midnight" />
                </div>
                <button type="submit" disabled={!affordAmount} className="w-full py-4 bg-dm-midnight text-white rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Calculate</button>
              </form>

              {affordResult && (
                <div className={`mt-6 p-5 rounded-2xl flex items-start gap-4 transition-all animate-in fade-in slide-in-from-bottom-2 ${affordResult.canAfford ? 'bg-dm-moss/10 text-dm-moss border-l-4 border-dm-moss' : 'bg-red-50 text-red-600 border-l-4 border-red-500'}`}>
                  {affordResult.canAfford ? <CheckCircle2 size={24} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={24} className="flex-shrink-0 mt-0.5" />}
                  <div>
                     <h3 className="font-extrabold text-lg mb-1">{affordResult.canAfford ? "Go for it!" : "Hold on!"}</h3>
                     <p className="font-bold text-sm opacity-80 leading-snug">{affordResult.message}</p>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
