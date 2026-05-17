import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { LogOut, AlertCircle, Activity, Wind, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [stressScore, setStressScore] = useState<{ score: number, color: string, label: string } | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  const fetchData = async (isMounted = true) => {
    if (!user?.id) return;
    setLoading(true);
    setErrorState(null);
    try {
      const [stressRes, budgetRes] = await Promise.all([
        api.get(`/assignments/stress-score/${user.id}`),
        api.get(`/budget/${user.id}`)
      ]);
      if (isMounted) {
        setStressScore(stressRes.data);
        setBudgetStatus(budgetRes.data);
      }
    } catch (error) {
      if (isMounted) setErrorState("Failed to load dashboard data.");
    }
    
    if (user?.university) {
      try {
        const feedRes = await api.get(`/feed/${user.university}`);
        if (isMounted) {
          setFeed(feedRes.data.posts.slice(0, 3));
        }
      } catch (error) {
        // Just feed failed
      }
    }
    if (isMounted) setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    fetchData(isMounted);

    if (user?.university) {
      socket.connect();
      socket.emit("join_university", user.university);

      const handleFeedUpdate = (newPost: any) => {
         setFeed(prev => {
            if (prev.find(p => p.id === newPost.id)) return prev;
            return [newPost, ...prev].slice(0, 3);
         });
      };

      const handleActivityExpired = (postId: string) => {
         setFeed(prev => prev.filter(p => p.id !== postId));
      };

      socket.on("feed_updated", handleFeedUpdate);
      socket.on("activity_expired", handleActivityExpired);

      return () => {
         isMounted = false;
         socket.off("feed_updated", handleFeedUpdate);
         socket.off("activity_expired", handleActivityExpired);
      };
    }
    
    return () => { isMounted = false; };
  }, [user]);

  const today = useMemo(() => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), []);

  const stressColorClass = useMemo(() => {
    if (!stressScore) return "bg-dm-midnight text-white";
    return stressScore.color === "green" ? "bg-dm-moss text-white" :
           stressScore.color === "yellow" ? "bg-amber-400 text-dm-midnight" :
           stressScore.color === "red" ? "bg-red-500 text-white" : "bg-dm-midnight text-white";
  }, [stressScore?.color]);

  const budgetUsagePercent = useMemo(() => {
    if (!budgetStatus) return 0;
    return Math.round(Math.min(budgetStatus.percentage_used, 100));
  }, [budgetStatus?.percentage_used]);

  const budgetColorClass = useMemo(() => {
    if (!budgetStatus) return "bg-dm-moss";
    return budgetStatus.percentage_used > 90 ? "bg-red-500" : 
           budgetStatus.percentage_used > 75 ? "bg-amber-400" : "bg-dm-moss";
  }, [budgetStatus?.percentage_used]);

  return (
    <div>
      <header className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-dm-midnight">Hey {user?.name?.split(' ')[0]}!</h1>
          <p className="text-dm-moss font-bold opacity-80">{today}</p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-6">
          <div className="h-28 bg-black/5 animate-pulse rounded-[32px]"></div>
          <div className="h-32 bg-black/5 animate-pulse rounded-[32px]"></div>
          <div className="h-48 bg-black/5 animate-pulse rounded-[32px]"></div>
          <div className="space-y-3">
             <div className="h-24 bg-black/5 animate-pulse rounded-2xl"></div>
             <div className="h-24 bg-black/5 animate-pulse rounded-2xl"></div>
          </div>
        </div>
      ) : errorState ? (
        <div className="pb-24 flex flex-col items-center justify-center pt-10 text-center px-4">
           <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl font-black">!</span>
           </div>
           <h2 className="text-xl font-bold text-dm-midnight mb-2">Oops!</h2>
           <p className="text-dm-midnight/60 font-medium mb-6">{errorState}</p>
           <button onClick={() => fetchData(true)} className="px-6 py-3 bg-dm-midnight text-white font-bold rounded-2xl flex items-center gap-2">
             <RefreshCw size={16} /> Try Again
           </button>
        </div>
      ) : (
        <>
          {budgetStatus?.warning && (
            <div className="bg-red-500 text-white p-4 rounded-2xl shadow-sm mb-6 flex items-center gap-3">
               <AlertCircle size={24} />
               <p className="font-bold text-sm">Budget Warning: Spending too fast!</p>
            </div>
          )}

          {budgetStatus && (
            <Link to="/budget" className="block bg-white/90 backdrop-blur-md rounded-[32px] p-6 mb-6 shadow-sm border border-white/50 transition-all hover:scale-[1.02]">
               <div className="flex justify-between items-end mb-2">
                  <span className="font-bold text-dm-midnight/50 uppercase text-xs tracking-wider">Budget Used</span>
                  <span className="font-black text-xl text-dm-midnight">{budgetUsagePercent}%</span>
               </div>
               <div className="h-3 bg-dm-beige/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${budgetColorClass}`} 
                    style={{ width: `${budgetUsagePercent}%` }}
                  />
               </div>
            </Link>
          )}

          {stressScore && (
            <Link to="/assignments" className={`block rounded-[32px] p-6 mb-6 shadow-sm relative overflow-hidden transition-all hover:scale-[1.02] backdrop-blur-md border border-white/20 ${stressColorClass}`}>
               <h2 className="font-bold opacity-90 mb-1">Stress Score</h2>
               <div className="flex items-end justify-between">
                  <span className="text-5xl font-black">{stressScore.score}</span>
                  <span className="font-bold bg-black/10 px-3 py-1 rounded-xl backdrop-blur-sm">{stressScore.label}</span>
               </div>
            </Link>
          )}
          
          <div className="bg-gradient-to-tr from-dm-midnight to-[#1a6b7d] text-white rounded-[32px] p-6 mb-6 shadow-md relative overflow-hidden backdrop-blur-md border border-white/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
            <h2 className="text-xl font-bold opacity-90 mb-1">Your Dorm Group</h2>
            <p className="text-3xl font-extrabold drop-shadow-sm">{user?.dorm_group?.name}</p>
            
            <div className="mt-8 flex items-center justify-between bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <span className="font-semibold opacity-90">Invite Code</span>
              <span className="font-bold tracking-widest text-lg bg-white/20 px-3 py-1 rounded-lg">{user?.dorm_group?.invite_code}</span>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-xl font-extrabold text-dm-midnight drop-shadow-sm">Campus Feed</h2>
              <Link to="/feed" className="text-xs font-bold text-pink-500 uppercase flex items-center gap-1 hover:scale-105 transition-transform">View All ✨</Link>
            </div>
            <div className="space-y-3">
               {feed.length === 0 ? (
                 <div className="text-center py-10 bg-white/90 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm flex items-center justify-center flex-col text-dm-midnight/40 gap-2">
                    <Wind size={32} />
                    <p className="text-sm font-semibold">It's quiet in {user?.university}.</p>
                    <Link to="/feed" className="mt-2 text-xs font-bold bg-dm-midnight text-white px-4 py-2 rounded-xl">Be the first to post</Link>
                 </div>
               ) : (
                 feed.map(post => (
                    <div key={post.id} className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-white/50 flex flex-col gap-2 relative transition-all hover:scale-[1.01]">
                       <div className="flex justify-between items-start">
                         <span className="font-bold text-sm text-dm-midnight">{post.user.name}</span>
                         <span className="text-[10px] font-bold uppercase text-dm-midnight/40 px-2 py-1 bg-pink-100/50 text-pink-600 rounded-md">
                           {post.category}
                         </span>
                       </div>
                       <p className="text-sm font-medium text-dm-midnight/80">{post.content}</p>
                    </div>
                 ))
               )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
