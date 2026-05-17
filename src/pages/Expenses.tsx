import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, CheckCircle2, Circle, Clock, Trash2, ReceiptText, PartyPopper } from "lucide-react";
import toast from "react-hot-toast";

type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: string;
  is_settled: boolean;
  settled_at: string | null;
  user?: { id: string; name: string };
  expense?: { title: string; paid_by: string; amount: string; payer?: { id: string; name: string } };
};

type Expense = {
  id: string;
  title: string;
  amount: string;
  paid_by: string;
  created_at: string;
  is_recurring: boolean;
  recurrence_interval: string | null;
  payer: { id: string; name: string };
  splits: ExpenseSplit[];
};

type GroupMember = {
  id: string;
  name: string;
  email: string;
};

export default function Expenses() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"splits" | "history">("splits");
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  
  // Summary Data
  const [owedToMe, setOwedToMe] = useState<ExpenseSplit[]>([]);
  const [iOwe, setIOwe] = useState<ExpenseSplit[]>([]);
  
  // History Data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  
  // Form State
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(user?.id || "");
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("monthly");
  const [formErrors, setFormErrors] = useState<{title?: boolean, amount?: boolean, split?: boolean}>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    if (!user?.dorm_group_id) return;
    setLoading(true);
    setErrorState(null);
    try {
      const [summaryRes, expensesRes, membersRes] = await Promise.all([
        api.get(`/expenses/summary/${user.id}`),
        api.get(`/expenses/group/${user.dorm_group_id}`),
        api.get(`/groups/${user.dorm_group_id}/members`),
      ]);
      setOwedToMe(summaryRes.data.owedToMe);
      setIOwe(summaryRes.data.iOwe);
      setExpenses(expensesRes.data.expenses);
      setMembers(membersRes.data.members);
      if (splitBetween.length === 0) {
        setSplitBetween(membersRes.data.members.map((m: any) => m.id));
      }
    } catch (error) {
      console.error(error);
      setErrorState("Failed to load expenses. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleSettle = async (splitId: string) => {
    try {
      await api.patch(`/expenses/settle/${splitId}`);
      toast.success("Expense settled!");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to settle expense");
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await api.delete(`/expenses/${expenseId}`);
      toast.success("Expense deleted");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete expense");
    }
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const errors: any = {};
    if (!title.trim()) errors.title = true;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) errors.amount = true;
    if (splitBetween.length === 0) errors.split = true;
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fix the highlighted errors");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.post("/expenses/add", {
        title,
        amount: parseFloat(amount),
        paid_by: paidBy,
        split_between: splitBetween,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurringInterval : null,
      });
      toast.success("Expense added successfully!");
      setIsModalOpen(false);
      setTitle("");
      setAmount("");
      setIsRecurring(false);
      setFormErrors({});
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const myTotalOwed = iOwe.reduce((sum, split) => sum + parseFloat(split.amount_owed), 0);
  const totalOwedToMe = owedToMe.reduce((sum, split) => sum + parseFloat(split.amount_owed), 0);

  if (loading) {
     return (
        <div className="pb-24 space-y-6">
           <div className="h-10 w-48 bg-black/5 animate-pulse rounded-full mb-6"></div>
           <div className="flex gap-4">
              <div className="flex-1 h-32 bg-black/5 animate-pulse rounded-3xl"></div>
              <div className="flex-1 h-32 bg-black/5 animate-pulse rounded-3xl"></div>
           </div>
           <div className="h-12 bg-black/5 animate-pulse rounded-2xl"></div>
           <div className="space-y-4">
              <div className="h-24 bg-black/5 animate-pulse rounded-2xl"></div>
              <div className="h-24 bg-black/5 animate-pulse rounded-2xl"></div>
           </div>
        </div>
     );
  }

  if (errorState) {
     return (
        <div className="pb-24 flex flex-col items-center justify-center pt-20 text-center px-4">
           <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-black">!</span>
           </div>
           <h2 className="text-xl font-bold text-dm-midnight mb-2">Oops!</h2>
           <p className="text-dm-midnight/60 font-medium mb-6">{errorState}</p>
           <button onClick={fetchData} className="px-6 py-3 bg-dm-midnight text-white font-bold rounded-2xl">Try Again</button>
        </div>
     );
  }

  return (
    <div className="pb-24">
      {/* Header Summary */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-10 h-10 bg-dm-midnight text-white rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
          <h1 className="text-3xl font-extrabold text-dm-midnight">Balances</h1>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-black/5 text-center">
            <p className="text-dm-moss font-bold text-sm mb-1 uppercase tracking-wide">You Owe</p>
            <p className="text-3xl font-black text-rose-500">${myTotalOwed.toFixed(2)}</p>
          </div>
          <div className="flex-1 bg-white p-5 rounded-3xl shadow-sm border border-black/5 text-center">
            <p className="text-dm-moss font-bold text-sm mb-1 uppercase tracking-wide">Owed to You</p>
            <p className="text-3xl font-black text-dm-moss">${totalOwedToMe.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/50 p-1 rounded-2xl mb-6 shadow-xs border border-white/20">
        <button 
          onClick={() => setActiveTab("splits")}
          className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'splits' ? 'bg-white text-dm-midnight shadow-sm' : 'text-dm-midnight/40'}`}
        >
          Active Splits
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'history' ? 'bg-white text-dm-midnight shadow-sm' : 'text-dm-midnight/40'}`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === "splits" && (
          <div className="space-y-6">
            {/* IOwe Section */}
            {iOwe.length > 0 && (
              <div>
                <h3 className="font-bold text-dm-rosy mb-3 px-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-dm-rosy"></div> You need to pay
                </h3>
                <div className="space-y-3">
                  {iOwe.map(split => (
                    <div key={split.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-dm-rosy">
                      <div>
                        <p className="font-bold text-dm-midnight text-lg">${parseFloat(split.amount_owed).toFixed(2)}</p>
                        <p className="text-sm font-semibold opacity-70">
                          to <span className="text-dm-dark-green font-bold">{split.expense?.payer?.name}</span> for {split.expense?.title}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleSettle(split.id)}
                        className="bg-dm-rosy/10 text-dm-rosy hover:bg-dm-rosy hover:text-white px-4 py-2 rounded-xl font-bold transition-colors"
                      >
                        Settle
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Owed to Me Section */}
            {owedToMe.length > 0 && (
              <div className="pt-2">
                <h3 className="font-bold text-dm-moss mb-3 px-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-dm-moss"></div> Owed to you
                </h3>
                <div className="space-y-3">
                  {owedToMe.map(split => (
                    <div key={split.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border-l-4 border-dm-moss">
                      <div>
                        <p className="font-bold text-dm-midnight text-lg">${parseFloat(split.amount_owed).toFixed(2)}</p>
                        <p className="text-sm font-semibold opacity-70">
                          from <span className="text-dm-dark-green font-bold">{split.user?.name}</span> for {split.expense?.title}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleSettle(split.id)}
                        className="bg-dm-moss/10 text-dm-moss hover:bg-dm-moss hover:text-white px-4 py-2 rounded-xl font-bold transition-colors"
                      >
                        Mark Paid
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {iOwe.length === 0 && owedToMe.length === 0 && (
              <div className="text-center py-12 px-6 bg-white rounded-[32px] border-2 border-dashed border-black/10 flex flex-col items-center">
                <div className="w-16 h-16 bg-dm-beige rounded-full mb-4 flex items-center justify-center">
                  <PartyPopper className="text-dm-moss opacity-70" size={32} />
                </div>
                <h3 className="text-xl font-bold text-dm-dark-green mb-1">All Settled!</h3>
                <p className="text-dm-midnight/60 font-medium text-sm max-w-xs mx-auto">You don't owe anyone, and nobody owes you. Time to celebrate!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {expenses.length === 0 && (
              <div className="text-center py-12 px-6 bg-white rounded-[32px] border-2 border-dashed border-black/10 flex flex-col items-center">
                <div className="w-16 h-16 bg-dm-beige rounded-full mb-4 flex items-center justify-center">
                  <ReceiptText className="text-dm-midnight/40 text-dm-moss opacity-70" size={32} />
                </div>
                <h3 className="text-xl font-bold text-dm-dark-green mb-1">No History Yet</h3>
                <p className="text-dm-midnight/60 font-medium text-sm max-w-xs mx-auto mb-4">No expenses have been shared yet. Hit the + button to add one.</p>
                <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-dm-midnight text-white font-bold rounded-2xl text-sm">Add Expense</button>
              </div>
            )}
            
            {expenses.map(expense => (
              <div key={expense.id} className="bg-white p-5 rounded-[24px] shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-dm-midnight flex items-center gap-2">
                      {expense.title}
                      {expense.is_recurring && (
                        <span className="bg-dm-midnight/10 text-sm px-2 py-0.5 rounded-md text-dm-midnight capitalize">
                          {expense.recurrence_interval}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs font-semibold text-dm-midnight/50 flex items-center gap-1 mt-1">
                      <Clock size={12} /> {new Date(expense.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="font-black text-xl text-dm-midnight">${parseFloat(expense.amount).toFixed(2)}</p>
                      <p className="text-xs font-bold text-dm-moss">Paid by {expense.payer?.id === user?.id ? "You" : expense.payer?.name}</p>
                    </div>
                    {expense.paid_by === user?.id && (
                      <button onClick={() => handleDelete(expense.id)} className="p-2 text-rose-500/50 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="bg-dm-beige/30 rounded-xl p-3 space-y-2">
                  {expense.splits.map(split => (
                    <div key={split.id} className="flex items-center justify-between text-sm font-semibold">
                      <span className="flex items-center gap-2 text-dm-dark-green">
                        {split.is_settled ? (
                          <CheckCircle2 size={14} className="text-dm-moss" />
                        ) : (
                          <Circle size={14} className="text-dm-rosy/50" />
                        )}
                        {split.user?.id === user?.id ? "You" : split.user?.name}
                      </span>
                      <span className={split.is_settled ? "text-dm-moss line-through opacity-70" : "text-dm-midnight font-bold"}>
                        ${parseFloat(split.amount_owed).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>



      {/* Add Expense Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-dm-midnight/40 backdrop-blur-sm transition-all pb-12 sm:pb-4">
          <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl relative border-4 border-dm-beige max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-extrabold text-dm-midnight mb-6">Add New Expense</h2>
            
            <form onSubmit={submitExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">What was it for?</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. WiFi Bill, Groceries"
                  className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none border ${formErrors.title ? "border-red-500" : "border-transparent"}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">How much?</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-dm-midnight/50 text-lg">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-9 pr-5 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-bold text-lg outline-none border ${formErrors.amount ? "border-red-500" : "border-transparent"}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">Who paid?</label>
                <select 
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-dm-beige/30 border-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none appearance-none"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.id === user?.id ? "Me" : m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">Split between</label>
                <div className={`bg-dm-beige/30 p-2 rounded-2xl space-y-1 border ${formErrors.split ? 'border-red-500' : 'border-transparent'}`}>
                  {members.map(m => (
                    <label key={m.id} className="flex items-center gap-3 p-3 hover:bg-white rounded-xl cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={splitBetween.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSplitBetween([...splitBetween, m.id]);
                          else setSplitBetween(splitBetween.filter(id => id !== m.id));
                        }}
                        className="w-5 h-5 rounded border-dm-moss/50 text-dm-moss focus:ring-dm-moss/30 accent-dm-moss bg-white"
                      />
                      <span className="font-semibold text-dm-midnight">{m.id === user?.id ? "Me" : m.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-dm-beige/30 p-4 rounded-2xl flex items-center justify-between">
                 <label className="font-bold text-dm-midnight flex items-center gap-2">
                    <input 
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-5 h-5 rounded border-dm-moss/50 text-dm-moss focus:ring-dm-moss/30 accent-dm-moss bg-white"
                    />
                    Recurring Expense?
                 </label>
                 
                 {isRecurring && (
                   <select 
                      value={recurringInterval}
                      onChange={(e) => setRecurringInterval(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white border-none font-bold text-sm text-dm-midnight outline-none"
                   >
                     <option value="weekly">Weekly</option>
                     <option value="monthly">Monthly</option>
                   </select>
                 )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-dm-beige/80 text-dm-midnight rounded-2xl font-bold text-lg hover:bg-dm-beige transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-4 bg-dm-moss text-white rounded-2xl font-bold text-lg hover:scale-[1.02] hover:shadow-lg transition-all active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
                >
                  {isSubmitting ? "Adding..." : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
