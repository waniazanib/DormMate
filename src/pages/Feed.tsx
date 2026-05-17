import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { socket } from "../lib/socket";
import { Plus, X, Users, Trash, Activity, Wind, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

type ActivityJoin = {
   id: string;
   post_id: string;
   user_id: string;
};

type ActivityPost = {
   id: string;
   user_id: string;
   university: string;
   content: string;
   category: string;
   expires_at: string;
   created_at: string;
   user: { id: string, name: string };
   joins: ActivityJoin[];
};

const CATEGORIES = ["All", "Study", "Food", "Sports", "Chill", "Other"];

const CAT_COLORS: Record<string, string> = {
  Study: "bg-blue-100 text-blue-700",
  Food: "bg-orange-100 text-orange-700",
  Sports: "bg-green-100 text-green-700",
  Chill: "bg-purple-100 text-purple-700",
  Other: "bg-gray-100 text-gray-700"
};

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time ticker
  const [tick, setTick] = useState(0);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Study");
  const [duration, setDuration] = useState(60);

  const fetchPosts = async () => {
     if (!user?.university) return;
     setError(null);
     try {
       const res = await api.get(`/feed/${user.university}`);
       setPosts(res.data.posts);
     } catch (error: any) {
       console.error(error);
       setError("Failed to load feed items.");
       toast.error("Could not load feed.");
     } finally {
       setLoading(false);
     }
  };

  useEffect(() => {
    fetchPosts();

    if (!user?.university) return;

    // Socket setup
    socket.connect();
    socket.emit("join_university", user.university);

    const handleFeedUpdate = (newPost: ActivityPost) => {
       setPosts((prev) => {
          if (prev.find(p => p.id === newPost.id)) return prev;
          return [newPost, ...prev].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
       });
    };

    const handleExpired = (postId: string) => {
       setPosts(prev => prev.filter(p => p.id !== postId));
    };

    const handleJoinCount = ({ postId, count }: { postId: string, count: number }) => {
       setPosts(prev => prev.map(p => {
          if (p.id === postId) {
             const fillerJoins = Array(count).fill({} as any);
             return { ...p, joins: fillerJoins };
          }
          return p;
       }));
    };

    socket.on("feed_updated", handleFeedUpdate);
    socket.on("activity_expired", handleExpired);
    socket.on("join_count_updated", handleJoinCount);

    return () => {
       socket.off("feed_updated", handleFeedUpdate);
       socket.off("activity_expired", handleExpired);
       socket.off("join_count_updated", handleJoinCount);
       socket.disconnect();
    };
  }, [user]);

  // Tick every minute to update timers
  useEffect(() => {
     const interval = setInterval(() => {
        setTick(t => t + 1);
        // Also manually filter out local expired posts
        const now = new Date().getTime();
        setPosts(prev => prev.filter(p => new Date(p.expires_at).getTime() > now));
     }, 60000);
     return () => clearInterval(interval);
  }, []);

  const handlePost = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!content.trim() || !user?.university) {
       toast.error("Content is required.");
       return;
     }

     try {
       const res = await api.post("/feed/post", {
          university: user.university,
          content,
          category,
          durationMinutes: duration
       });
       
       setContent("");
       setCategory("Study");
       setDuration(60);
       setIsModalOpen(false);
       toast.success("Posted to feed!");

       // Emit to others
       socket.emit("new_activity_post", { university: user.university, post: res.data.post });

       // Optimistically add to self
       setPosts(prev => [res.data.post, ...prev]);
     } catch (error) {
        console.error(error);
        toast.error("Failed to post.");
     }
  };

  const handleJoin = async (postId: string) => {
     try {
        const res = await api.post(`/feed/join/${postId}`);
        // Optimistically update
        setPosts(prev => prev.map(p => {
           if (p.id === postId) {
             return { ...p, joins: [...p.joins, { id: 'temp', post_id: postId, user_id: user!.id }] };
           }
           return p;
        }));
        toast.success("Joined activity!");
        
        socket.emit("join_activity", { university: user!.university, postId, count: res.data.count });
     } catch (error) {
        console.error("Join failed or already joined", error);
        toast.error("Could not join activity.");
     }
  };

  const handleDelete = async (postId: string) => {
    try {
       await api.delete(`/feed/${postId}`);
       setPosts(prev => prev.filter(p => p.id !== postId));
       toast.success("Post deleted");
       // Route emits activity_expired as well! Others will see it gone
    } catch (error) {
       console.error("Delete failed", error);
       toast.error("Could not delete post");
    }
  }

  const getTimeLeft = (expiresAt: string) => {
     const ms = new Date(expiresAt).getTime() - new Date().getTime();
     if (ms <= 0) return "Expired";
     const mins = Math.floor(ms / 60000);
     const hrs = Math.floor(mins / 60);
     if (hrs > 0) {
        return `${hrs}h ${mins % 60}m left`;
     }
     return `${mins}m left`;
  };

  const getTimeAgo = (createdAt: string) => {
     const ms = new Date().getTime() - new Date(createdAt).getTime();
     const mins = Math.max(1, Math.floor(ms / 60000));
     if (mins < 60) return `${mins}m ago`;
     const hrs = Math.floor(mins / 60);
     return `${hrs}h ago`;
  };

  const activePosts = posts.filter(p => filter === "All" || p.category === filter);

  if (loading) {
    return (
      <div className="pb-24 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="h-10 w-48 bg-black/5 animate-pulse rounded-full"></div>
        </div>
        <div className="flex gap-2 mb-4 overflow-x-hidden">
          {[1,2,3,4,5].map(i => (
             <div key={i} className="h-10 w-24 bg-black/5 animate-pulse rounded-full shrink-0"></div>
          ))}
        </div>
        <div className="space-y-4">
           {[1,2,3].map(i => (
              <div key={i} className="h-40 bg-black/5 animate-pulse rounded-3xl"></div>
           ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
       <div className="flex flex-col items-center justify-center py-20 px-6 text-center h-[60vh]">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-sm border border-red-200">
             <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-dm-midnight mb-2">Oops! Something went wrong</h2>
          <p className="text-dm-midnight/60 font-medium mb-6 text-sm">{error}</p>
          <button 
             onClick={fetchPosts}
             className="px-6 py-3 bg-dm-midnight text-white rounded-xl font-bold hover:bg-dm-midnight/90 transition-colors shadow-sm active:scale-95"
          >
             Try Again
          </button>
       </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-10 h-10 bg-dm-midnight text-white rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0 border-2 border-dm-beige"
        >
          <Plus strokeWidth={3} size={20} />
        </button>
        <h1 className="text-3xl font-extrabold text-dm-midnight">Social Feed</h1>
      </div>

      {/* Filter Bar */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide">
         {CATEGORIES.map(cat => (
           <button 
             key={cat}
             onClick={() => setFilter(cat)}
             className={`px-5 py-2.5 rounded-full font-bold whitespace-nowrap transition-all text-sm ${
               filter === cat 
                 ? "bg-dm-midnight text-white shadow-md transform scale-105"
                 : "bg-white text-dm-midnight/60 hover:bg-dm-beige/50 border border-black/5"
             }`}
           >
             {cat}
           </button>
         ))}
      </div>

      {/* Feed */}
      <div className="space-y-4 relative">
         {activePosts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[32px] shadow-sm border border-black/5 p-6 flex flex-col items-center">
               <div className="w-20 h-20 bg-dm-beige/50 rounded-full flex items-center justify-center mb-4 text-dm-midnight/20">
                  <Wind size={40} />
               </div>
               <h3 className="font-extrabold text-dm-midnight text-xl mb-2">No Activity Right Now</h3>
               <p className="text-dm-midnight/50 font-bold w-3/4">It's quiet in {user?.university}. Be the first to start an activity!</p>
               <button 
                 onClick={() => setIsModalOpen(true)}
                 className="mt-6 px-6 py-3 bg-dm-moss text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-transform shadow-sm"
               >
                 Start Activity
               </button>
            </div>
         ) : (
            activePosts.map((post) => {
               const haveIJoined = post.joins.some(j => j.user_id === user?.id);
               return (
                 <div key={post.id} className="bg-white rounded-3xl p-5 shadow-sm border border-black/5 relative group transition-all hover:shadow-md">
                   {post.user_id === user?.id && (
                     <button 
                       onClick={() => {
                          if (confirm("Delete this post?")) handleDelete(post.id);
                       }} 
                       className="absolute top-4 right-4 p-2 text-dm-midnight/20 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                     >
                       <Trash size={16} />
                     </button>
                   )}
                   <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-extrabold text-dm-midnight text-lg">{post.user.name}</p>
                        <p className="text-xs font-bold text-dm-midnight/40 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-dm-moss/50"></span>{getTimeAgo(post.created_at)}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-widest ${CAT_COLORS[post.category] || CAT_COLORS.Other} mr-8 lg:mr-0`}>
                        {post.category}
                      </span>
                   </div>
                   
                   <p className="text-dm-midnight font-medium text-lg leading-snug mb-5">
                      {post.content}
                   </p>

                   <div className="flex justify-between items-center bg-dm-beige/30 rounded-2xl p-3 border border-dm-beige">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-dm-midnight/40 uppercase tracking-widest mb-0.5">Expires in</span>
                        <span className="font-black text-sm text-dm-midnight">
                          {getTimeLeft(post.expires_at)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1.5 text-dm-midnight/60 font-bold text-sm bg-white px-3 py-1.5 rounded-lg border border-black/5 shadow-sm">
                           <Users size={16} />
                           {post.joins.length}
                         </div>
                         {haveIJoined ? (
                            <button disabled className="bg-dm-midnight/5 text-dm-midnight/40 px-5 py-2 rounded-xl font-bold text-sm border border-dashed border-black/10">
                               Joined
                            </button>
                         ) : (
                            <button onClick={() => handleJoin(post.id)} className="bg-dm-midnight text-white px-5 py-2 rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-sm">
                               Join
                            </button>
                         )}
                      </div>
                   </div>
                 </div>
               )
            })
         )}
      </div>



      {/* Post Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-dm-midnight/40 backdrop-blur-sm transition-all pb-12 sm:pb-4">
           <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl relative border-4 border-dm-beige">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 text-dm-midnight/40 hover:text-dm-midnight"><X size={24} /></button>
              <h2 className="text-2xl font-extrabold text-dm-midnight mb-6">Start Activity</h2>
              
              <form onSubmit={handlePost} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2 flex justify-between">
                     <span>What's up?</span>
                     <span className={content.length > 140 ? "text-red-500" : ""}>{content.length}/140</span>
                  </label>
                  <textarea 
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    required 
                    maxLength={140}
                    rows={3}
                    placeholder="Anyone want to grab pizza?" 
                    className="w-full px-5 py-4 rounded-2xl bg-dm-beige/30 border border-transparent outline-none font-semibold resize-none focus:ring-4 focus:ring-dm-moss/20 transition-all text-dm-midnight" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-4 rounded-xl bg-dm-beige/30 border-none outline-none font-bold text-sm focus:ring-4 focus:ring-dm-moss/20">
                      <option value="Study">Study 📚</option>
                      <option value="Food">Food 🍕</option>
                      <option value="Sports">Sports 🏀</option>
                      <option value="Chill">Chill 🛋️</option>
                      <option value="Other">Other 📝</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Expires In</label>
                    <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full px-4 py-4 rounded-xl bg-dm-beige/30 border-none outline-none font-bold text-sm focus:ring-4 focus:ring-dm-moss/20">
                      <option value={30}>30 mins</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={content.length === 0 || content.length > 140}
                  className="w-full py-4 bg-dm-moss text-white rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all mt-4 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Post to Feed
                </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
