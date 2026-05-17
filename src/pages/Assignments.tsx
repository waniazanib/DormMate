import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, Check, Clock, Calendar, ChevronDown, ChevronUp, BookOpenCheck } from "lucide-react";
import toast from "react-hot-toast";

type Assignment = {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  estimated_hours: number;
  is_complete: boolean;
};

type GroupMemberStress = {
  userId: string;
  name: string;
  score: number;
  color: "green" | "yellow" | "red";
  label: string;
};

export default function Assignments() {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stressScore, setStressScore] = useState(0);
  const [stressColor, setStressColor] = useState<"green" | "yellow" | "red">("green");
  const [stressLabel, setStressLabel] = useState("");
  const [groupStress, setGroupStress] = useState<GroupMemberStress[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hours, setHours] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{title?: boolean, subject?: boolean, deadline?: boolean, hours?: boolean}>({});

  const [showCompleted, setShowCompleted] = useState(false);

  // We request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fetchData = async () => {
    if (!user?.id || !user?.dorm_group_id) return;
    try {
      setLoading(true);
      setErrorState(null);
      const [assignRes, myStressRes, groupStressRes] = await Promise.all([
        api.get(`/assignments/${user.id}`),
        api.get(`/assignments/stress-score/${user.id}`),
        api.get(`/assignments/group-stress/${user.dorm_group_id}`)
      ]);
      
      const allAssigns: Assignment[] = assignRes.data.assignments;
      setAssignments(allAssigns.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()));
      
      setStressScore(myStressRes.data.score);
      setStressColor(myStressRes.data.color);
      setStressLabel(myStressRes.data.label);

      setGroupStress(groupStressRes.data.members);

      // Check for notifications right after fetching
      if ("Notification" in window && Notification.permission === "granted") {
        const now = new Date().getTime();
        const urgent = allAssigns.filter(a => !a.is_complete && (new Date(a.deadline).getTime() - now) < 24 * 60 * 60 * 1000);
        if (urgent.length > 0) {
           new Notification("Deadline Warning!", {
             body: `You have ${urgent.length} assignment(s) due within 24 hours.`
           });
        }
      }
    } catch (error) {
      console.error(error);
      setErrorState("Failed to load assignments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Hourly poll for the "cron job" effect in browser
    const intervalId = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [user]);

  const handleComplete = async (id: string) => {
    try {
      await api.patch(`/assignments/${id}/complete`);
      toast.success("Assignment finished! Great job!");
      fetchData();
    } catch (error) {
      console.error("Failed to complete assignment");
      toast.error("Failed to mark as complete");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await api.delete(`/assignments/${id}`);
      toast.success("Assignment deleted");
      fetchData();
    } catch (error) {
      console.error("Failed to delete assignment");
      toast.error("Failed to delete");
    }
  };

  const submitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const errors: any = {};
    if (!title.trim()) errors.title = true;
    if (!subject.trim()) errors.subject = true;
    if (!hours || isNaN(parseInt(hours)) || parseInt(hours) <= 0) errors.hours = true;
    
    if (!deadline) {
      errors.deadline = true;
    } else {
      const selectedDate = new Date(deadline);
      const now = new Date();
      if (selectedDate < now) {
         toast.error("Deadline cannot be in the past.");
         errors.deadline = true;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (!errors.deadline) toast.error("Please fill in all fields correctly");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await api.post("/assignments/add", {
        title,
        subject,
        deadline: new Date(deadline).toISOString(),
        estimated_hours: parseInt(hours, 10),
      });
      toast.success("Assignment added!");
      setIsModalOpen(false);
      setTitle("");
      setSubject("");
      setDeadline("");
      setHours("");
      setFormErrors({});
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCardColor = (dt: string) => {
    const hoursAway = (new Date(dt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursAway < 24) return "border-red-400 bg-red-50";
    if (hoursAway < 72) return "border-yellow-400 bg-yellow-50";
    return "border-transparent bg-white";
  };

  const stressColorClass = 
    stressColor === "green" ? "bg-dm-moss text-white shadow-dm-moss/40" :
    stressColor === "yellow" ? "bg-amber-400 text-dm-midnight shadow-amber-400/40" :
    "bg-red-500 text-white shadow-red-500/40";

  if (loading) {
    return (
      <div className="pb-24 space-y-6">
        <div className="h-10 w-48 bg-black/5 animate-pulse rounded-full mb-6"></div>
        <div className="h-40 bg-black/5 animate-pulse rounded-[32px] mb-8"></div>
        <div className="space-y-4">
          <div className="h-32 bg-black/5 animate-pulse rounded-[24px]"></div>
          <div className="h-32 bg-black/5 animate-pulse rounded-[24px]"></div>
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

  const incomplete = assignments.filter(a => !a.is_complete);
  const complete = assignments.filter(a => a.is_complete);

  return (
    <div className="pb-24">
      {/* Overview */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-10 h-10 bg-dm-midnight text-white rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0"
        >
          <Plus size={20} strokeWidth={3} />
        </button>
        <h1 className="text-3xl font-extrabold text-dm-midnight">Assignments</h1>
      </div>

      <div className={`p-8 rounded-[32px] shadow-lg mb-8 text-center transition-colors duration-500 ${stressColorClass}`}>
        <p className="text-sm font-bold uppercase tracking-wider mb-2 opacity-80">Stress Score</p>
        <div className="text-7xl font-black mb-2">{stressScore}</div>
        <div className="text-xl font-bold bg-black/10 inline-block px-4 py-1.5 rounded-full backdrop-blur-md">
          {stressLabel}
        </div>
      </div>

      {/* Group members' stress */}
      {groupStress.length > 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-dm-midnight mb-3">Roommate Stress Levels</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar">
            {groupStress.filter(m => m.userId !== user?.id).map((member) => (
              <div 
                key={member.userId} 
                className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${
                  member.color === "green" ? "border-dm-moss/30 bg-dm-moss/10 text-dm-moss" :
                  member.color === "yellow" ? "border-amber-400/30 bg-amber-400/10 text-amber-600" :
                  "border-red-500/30 bg-red-500/10 text-red-600"
                }`}
              >
                <div>
                  <p className="font-bold whitespace-nowrap">{member.name.split(' ')[0]}</p>
                  <p className="text-xs font-semibold uppercase">{member.score} • {member.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incomplete */}
      <div className="space-y-4 mb-8">
        {incomplete.length === 0 ? (
          <div className="text-center py-12 px-6 bg-white/50 rounded-3xl border-2 border-dashed border-black/10 flex flex-col items-center">
            <div className="w-16 h-16 bg-dm-beige rounded-full mb-4 flex items-center justify-center">
              <BookOpenCheck className="text-dm-moss opacity-70" size={32} />
            </div>
            <p className="text-dm-midnight font-bold text-xl mb-1">No assignments to do!</p>
            <p className="text-dm-midnight/60 font-medium text-sm">Kick back, relax, or press + to add more.</p>
          </div>
        ) : incomplete.map(a => (
          <div key={a.id} className={`p-5 rounded-[24px] shadow-sm border-2 ${getCardColor(a.deadline)}`}>
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-1 block">
                  {a.subject}
                </span>
                <h3 className="font-extrabold text-xl text-dm-midnight leading-tight mb-2">{a.title}</h3>
                
                <div className="flex flex-col gap-1 mt-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-dm-midnight/70">
                    <Calendar size={14} />
                    {new Date(a.deadline).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-dm-midnight/70">
                    <Clock size={14} />
                    {a.estimated_hours}h estimated
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => handleComplete(a.id)}
                className="w-12 h-12 rounded-full border-2 border-dm-moss text-dm-moss hover:bg-dm-moss hover:text-white flex items-center justify-center transition-all bg-white shadow-sm flex-shrink-0"
              >
                <Check size={20} strokeWidth={3} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Complete */}
      {complete.length > 0 && (
        <div>
          <button 
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center justify-between w-full py-3 px-4 bg-white/60 rounded-2xl font-bold text-dm-midnight/60 hover:bg-white transition-colors border border-black/5"
          >
            Completed ({complete.length})
            {showCompleted ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {showCompleted && (
            <div className="mt-4 space-y-3">
              {complete.map(a => (
                <div key={a.id} className="p-4 rounded-[20px] bg-white opacity-60 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-dm-moss/20 text-dm-moss flex items-center justify-center flex-shrink-0">
                    <Check size={16} strokeWidth={3} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-dm-midnight line-through">{a.title}</h3>
                    <p className="text-xs font-semibold text-dm-midnight/50">{a.subject}</p>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 font-bold px-2 py-1 bg-red-50 rounded-lg">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}



      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-dm-midnight/40 backdrop-blur-sm transition-all pb-12 sm:pb-4">
          <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl relative border-4 border-dm-beige">
            <h2 className="text-2xl font-extrabold text-dm-midnight mb-6">New Assignment</h2>
            
            <form onSubmit={submitAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. History Essay"
                  className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none border ${formErrors.title ? "border-red-500" : "border-transparent"}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">Subject</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. HIST101"
                  className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none border ${formErrors.subject ? "border-red-500" : "border-transparent"}`}
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">Deadline</label>
                  <input 
                    type="datetime-local" 
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={`w-full px-4 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none text-sm border ${formErrors.deadline ? "border-red-500" : "border-transparent"}`}
                  />
                </div>
                
                <div className="w-24">
                  <label className="block text-xs font-bold uppercase tracking-wider text-dm-moss mb-2 ml-2">Hours</label>
                  <input 
                    type="number" 
                    min="1"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Est."
                    className={`w-full px-4 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none text-center border ${formErrors.hours ? "border-red-500" : "border-transparent"}`}
                  />
                </div>
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
                  {isSubmitting ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
