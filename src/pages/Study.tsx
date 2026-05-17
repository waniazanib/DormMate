import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { BookMarked, Search, Clock, Calendar as CalendarIcon, CheckCircle, XCircle, UserPlus, FileQuestion } from "lucide-react";
import toast from "react-hot-toast";

export default function Study() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"matcher" | "availability">("matcher");
  const [loading, setLoading] = useState(true);
  
  // Availability state
  const [availSubject, setAvailSubject] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("16:00");
  const [availFormErrors, setAvailFormErrors] = useState<{subject?: boolean, days?: boolean, start?: boolean, end?: boolean}>({});
  
  // Matcher state
  const [searchSubject, setSearchSubject] = useState("");
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  
  // Requests/Sessions state
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [confirmedSessions, setConfirmedSessions] = useState<any[]>([]);
  const [myAvails, setMyAvails] = useState<any[]>([]);

  // Modal map for sending requests 
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestTarget, setRequestTarget] = useState<any>(null);
  const [proposedTime, setProposedTime] = useState("");
  const [proposedLocation, setProposedLocation] = useState("");
  const [requestFormErrors, setRequestFormErrors] = useState<{time?: boolean, location?: boolean}>({});

  const fetchSessions = async () => {
    if (!user?.id) return;
    try {
      const { data } = await api.get(`/study/sessions/${user.id}`);
      
      const incoming = data.requests.filter((r: any) => r.receiver_id === user.id && r.status === "pending");
      const outgoing = data.requests.filter((r: any) => r.requester_id === user.id && r.status !== "cancelled");
      const confirmed = data.requests.filter((r: any) => r.status === "accepted");

      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setConfirmedSessions(confirmed);
      setMyAvails(data.availability);
      
      // Get unique subjects user has availability for, to auto-populate if we want
      if (data.availability.length > 0 && !searchSubject) {
         setSearchSubject(data.availability[0].subject);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    socket.connect();
    if (user?.id) {
       socket.emit("join_user", user.id);
    }

    const handleNewRequest = (session: any) => {
       toast(`New study request from ${session.requester.name}!`, { icon: '🎉' });
       fetchSessions();
    };

    const handleUpdate = () => {
       fetchSessions();
    };

    socket.on("new_study_request", handleNewRequest);
    socket.on("study_request_responded", handleUpdate);
    socket.on("study_request_cancelled", handleUpdate);

    return () => {
      socket.off("new_study_request", handleNewRequest);
      socket.off("study_request_responded", handleUpdate);
      socket.off("study_request_cancelled", handleUpdate);
    };
  }, [user]);

  const handleSaveAvailability = async () => {
      const errors: any = {};
      if (!availSubject.trim()) errors.subject = true;
      if (selectedDays.length === 0) errors.days = true;
      if (!startTime) errors.start = true;
      if (!endTime) errors.end = true;

      if (Object.keys(errors).length > 0) {
         setAvailFormErrors(errors);
         toast.error("Please completely fill out highlighted fields.");
         return;
      }
     
     try {
        await api.post("/study/availability/set", {
           subject: availSubject,
           days: selectedDays,
           startTime,
           endTime
        });
        toast.success("Availability saved!");
        setAvailSubject("");
        setSelectedDays([]);
        setAvailFormErrors({});
        fetchSessions();
     } catch (error: any) {
        console.error(error);
        toast.error(error.response?.data?.error ? JSON.stringify(error.response.data.error) : "Failed to save availability");
     }
  };

  const handleFindMatches = async () => {
     if (!searchSubject.trim()) {
       toast.error("Please enter a subject to search.");
       return;
     }
     setLoadingMatches(true);
     try {
        const { data } = await api.get(`/study/matches/${user?.id}/${searchSubject}`);
        setMatches(data.matches);
        if (data.matches.length === 0) {
           toast("No matches found.", { icon: "👻" });
        }
     } catch (error) {
        console.error(error);
        toast.error("Failed to find matches");
     } finally {
        setLoadingMatches(false);
     }
  };

  const hasPendingTo = (targetId: string, subject: string) => {
     return outgoingRequests.some(r => r.receiver_id === targetId && r.subject === subject && r.status === "pending");
  };

  const handleSendRequest = async () => {
     const errors: any = {};
     if (!proposedTime) errors.time = true;
     if (!proposedLocation.trim()) errors.location = true;

     if (Object.keys(errors).length > 0) {
       setRequestFormErrors(errors);
       toast.error("Please provide a valid time and location.");
       return;
     }
     
     try {
        if (requestTarget.isReschedule) {
           await api.patch(`/study/request/${requestTarget.sessionId}/reschedule`, {
              proposedTime: new Date(proposedTime).toISOString(),
              location: proposedLocation
           });
           toast.success("Reschedule request sent!");
        } else {
           await api.post("/study/request/send", {
              receiverId: requestTarget.id,
              subject: requestTarget.subject,
              proposedTime: new Date(proposedTime).toISOString(),
              location: proposedLocation
           });
           toast.success("Study request sent!");
        }
        
        setIsRequestModalOpen(false);
        setProposedTime("");
        setProposedLocation("");
        setRequestFormErrors({});
        fetchSessions();
     } catch (error: any) {
        toast.error(error.response?.data?.error ? JSON.stringify(error.response.data.error) : "Error sending request");
     }
  };

  const respondRequest = async (id: string, status: string) => {
     try {
        await api.patch(`/study/request/${id}/respond`, { status });
        if (status === "accepted") toast.success("Request accepted!");
        else toast.success("Request cancelled/declined.");
        fetchSessions();
     } catch (error) {
        console.error(error);
        toast.error("Action failed");
     }
  };

  const handleDeleteAvailability = async (id: string) => {
     try {
        await api.delete(`/study/availability/${id}`);
        toast.success("Availability removed");
        fetchSessions();
     } catch (error) {
        console.error(error);
        toast.error("Failed to delete");
     }
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) {
     return (
        <div className="pb-24 space-y-6">
           <div className="h-10 w-48 bg-black/5 animate-pulse rounded-full mb-6"></div>
           <div className="flex gap-2">
              <div className="flex-1 h-12 bg-black/5 animate-pulse rounded-xl"></div>
              <div className="flex-1 h-12 bg-black/5 animate-pulse rounded-xl"></div>
           </div>
           <div className="h-64 bg-black/5 animate-pulse rounded-[32px]"></div>
           <div className="h-48 bg-black/5 animate-pulse rounded-[32px]"></div>
        </div>
     );
  }

  return (
    <div className="pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-dm-midnight">Study Matcher</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-dm-beige/30 p-1 rounded-2xl mb-6 shadow-xs border border-white/20">
         <button 
           onClick={() => setActiveTab("matcher")}
           className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'matcher' ? 'bg-white shadow-sm text-dm-midnight' : 'text-dm-midnight/40 hover:text-dm-midnight'}`}
         >
           Find Partners
         </button>
         <button 
           onClick={() => setActiveTab("availability")}
           className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'availability' ? 'bg-white shadow-sm text-dm-midnight' : 'text-dm-midnight/40 hover:text-dm-midnight'}`}
         >
           My Availability
         </button>
      </div>

      {activeTab === "availability" && (
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5">
               <h2 className="text-xl font-extrabold text-dm-midnight mb-4">Set Availability</h2>
               
               <div className="space-y-4">
                 <div>
                   <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Subject</label>
                   <input 
                     type="text" 
                     value={availSubject}
                     onChange={e => setAvailSubject(e.target.value)}
                     placeholder="e.g. CS101, Calculus" 
                     className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none border ${availFormErrors.subject ? "border-red-500" : "border-transparent"}`}
                   />
                 </div>
                 
                 <div>
                   <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-2 ${availFormErrors.days ? "text-red-500" : "text-dm-midnight/50"}`}>Days Available</label>
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide py-1 px-1">
                      {dayNames.map((day, idx) => (
                        <button 
                          key={day}
                          onClick={() => setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])}
                          className={`px-4 py-3 rounded-xl text-sm font-bold shrink-0 transition-all ${selectedDays.includes(idx) ? 'bg-dm-midnight text-white shadow-md' : 'bg-dm-beige/30 text-dm-midnight/60 hover:bg-dm-beige text-dm-midnight'}`}
                        >
                          {day}
                        </button>
                      ))}
                   </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Start Time</label>
                     <input 
                       type="time" 
                       value={startTime}
                       onChange={e => setStartTime(e.target.value)}
                       className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none border ${availFormErrors.start ? "border-red-500" : "border-transparent"}`}
                     />
                   </div>
                   <div>
                     <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">End Time</label>
                     <input 
                       type="time" 
                       value={endTime}
                       onChange={e => setEndTime(e.target.value)}
                       className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none border ${availFormErrors.end ? "border-red-500" : "border-transparent"}`}
                     />
                   </div>
                 </div>

                 <button 
                   onClick={handleSaveAvailability}
                   className="w-full py-4 bg-dm-moss text-white rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all mt-4 shadow-sm"
                 >
                   Save Availability
                 </button>
               </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5">
                <h2 className="text-xl font-extrabold text-dm-midnight mb-4">Current Availability</h2>
                {myAvails.length === 0 ? (
                  <div className="text-center py-6 flex flex-col items-center justify-center opacity-60">
                    <CalendarIcon size={32} className="mb-2" />
                    <p className="font-bold text-sm">No availability set yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                     {myAvails.map((avail: any) => (
                        <div key={avail.id} className="p-4 bg-dm-beige/30 rounded-2xl border border-dm-beige flex justify-between items-center group">
                           <div>
                             <p className="font-extrabold text-dm-midnight text-lg">{avail.subject}</p>
                             <p className="text-xs font-bold text-dm-midnight/60">{dayNames[avail.day_of_week]}s • {avail.start_time} - {avail.end_time}</p>
                           </div>
                           <button 
                             onClick={() => handleDeleteAvailability(avail.id)} 
                             className="p-3 text-red-500/50 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                           >
                             <XCircle size={20} />
                           </button>
                        </div>
                     ))}
                  </div>
                )}
            </div>
         </div>
      )}

      {activeTab === "matcher" && (
         <div className="space-y-6">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5">
               <h2 className="text-xl font-extrabold text-dm-midnight mb-4">Find a Study Partner</h2>
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={searchSubject}
                   onChange={e => setSearchSubject(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleFindMatches()}
                   placeholder="Enter subject" 
                   className="flex-1 px-5 py-4 rounded-xl bg-dm-beige/30 focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold outline-none border border-transparent text-sm"
                 />
                 <button onClick={handleFindMatches} className="bg-dm-midnight text-white px-5 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm">
                    <Search size={20} />
                 </button>
               </div>

               {loadingMatches && (
                  <div className="mt-8 space-y-3">
                     <div className="h-24 bg-black/5 animate-pulse rounded-2xl"></div>
                     <div className="h-24 bg-black/5 animate-pulse rounded-2xl"></div>
                  </div>
               )}
               
               {!loadingMatches && matches.length > 0 && (
                  <div className="mt-6 space-y-4">
                     {matches.map(match => (
                        <div key={match.id} className="p-5 bg-white rounded-2xl border border-black/5 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-16 h-16 bg-dm-moss/10 rounded-bl-full -z-10 blur-xl"></div>
                           <div className="flex justify-between items-start">
                              <div>
                                 <h3 className="font-extrabold text-lg text-dm-midnight">{match.name}</h3>
                                 <p className="text-xs font-bold text-dm-moss/80 uppercase tracking-wide mt-1">
                                    Compatibility: {match.score}
                                 </p>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                 <span className="text-[10px] font-bold text-dm-midnight/40 uppercase">Overlapping Slots</span>
                                 <div className="flex flex-col items-end gap-1">
                                   {match.overlappingSlots.map((slot: string, i: number) => (
                                      <span key={i} className="text-xs font-bold bg-dm-beige/30 px-2 py-1 rounded-md text-dm-midnight">
                                         {slot}
                                      </span>
                                   ))}
                                 </div>
                              </div>
                           </div>
                           
                           {hasPendingTo(match.id, searchSubject) ? (
                              <button disabled className="w-full py-3 bg-dm-midnight/5 text-dm-midnight/40 rounded-xl font-bold text-sm mt-2 border border-dashed border-black/10">
                                 Request Pending
                              </button>
                           ) : (
                              <button 
                                onClick={() => { setRequestTarget({ ...match, subject: searchSubject }); setIsRequestModalOpen(true); }}
                                className="w-full py-3 bg-dm-midnight text-white rounded-xl font-bold text-sm mt-2 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
                              >
                                 <UserPlus size={16} /> Send Study Request
                              </button>
                           )}
                        </div>
                     ))}
                  </div>
               )}
               
               {!loadingMatches && matches.length === 0 && searchSubject && (
                 <div className="text-center py-8 mt-4 flex flex-col items-center justify-center opacity-50">
                   <FileQuestion size={32} className="mb-2" />
                   <p className="font-bold text-sm">No matches found right now.</p>
                 </div>
               )}
            </div>

            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
               <div className="bg-white p-6 rounded-[32px] shadow-sm border-2 border-amber-400/50 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-amber-400/10 rounded-br-full -z-10 blur-xl"></div>
                  <h2 className="text-xl font-extrabold text-dm-midnight mb-4 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Incoming Requests
                  </h2>
                  <div className="space-y-3">
                     {incomingRequests.map(req => (
                        <div key={req.id} className="p-4 bg-white rounded-2xl flex flex-col gap-3 border border-black/5 shadow-sm">
                           <div>
                              <p className="font-extrabold text-dm-midnight text-lg">
                                {req.requester.name} <span className="font-medium text-dm-midnight/60 text-base">wants to study</span> {req.subject}
                              </p>
                              <div className="mt-2 space-y-1">
                                <p className="text-xs font-bold text-dm-midnight/70 flex items-center gap-2">
                                  <Clock size={14} className="text-amber-500" /> {new Date(req.proposed_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-xs font-bold text-dm-midnight/70 flex items-center gap-2">
                                  <BookMarked size={14} className="text-amber-500" /> {req.location}
                                </p>
                              </div>
                           </div>
                           <div className="flex gap-2 mt-2">
                              <button onClick={() => respondRequest(req.id, "accepted")} className="flex-1 py-3 bg-dm-moss text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                                <CheckCircle size={16} /> Accept
                              </button>
                              <button onClick={() => respondRequest(req.id, "declined")} className="flex-1 py-3 bg-rose-50 text-rose-500 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:bg-rose-100">
                                <XCircle size={16} /> Decline
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* Confirmed Sessions */}
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5">
                <h2 className="text-xl font-extrabold text-dm-midnight mb-4">Confirmed Sessions</h2>
                {confirmedSessions.length === 0 ? (
                  <p className="text-center py-6 text-dm-midnight/40 font-bold text-sm border-2 border-dashed border-black/5 rounded-2xl">No confirmed sessions yet.</p>
                ) : (
                  <div className="space-y-3">
                     {confirmedSessions.map(sess => {
                        const partner = sess.requester_id === user?.id ? sess.receiver.name : sess.requester.name;
                        return (
                           <div key={sess.id} className="p-5 bg-dm-moss/10 rounded-2xl border border-dm-moss/20 flex flex-col gap-2 transition-all hover:shadow-sm">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <p className="font-extrabold text-dm-midnight text-lg">{sess.subject}</p>
                                    <p className="text-xs font-bold text-dm-moss mt-0.5 uppercase tracking-wide">with {partner}</p>
                                 </div>
                                 <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-black/5">
                                     <button 
                                       title="Reschedule"
                                       onClick={() => {
                                          setRequestTarget({ 
                                            name: partner, 
                                            subject: sess.subject, 
                                            isReschedule: true, 
                                            sessionId: sess.id 
                                          }); 
                                          setIsRequestModalOpen(true);
                                       }}
                                       className="p-2 text-dm-midnight/40 hover:text-dm-midnight rounded-md hover:bg-black/5 transition-colors"
                                     >
                                       <CalendarIcon size={16} />
                                     </button>
                                     <button 
                                       title="Cancel Session"
                                       onClick={() => {
                                         if (confirm("Cancel this session?")) respondRequest(sess.id, "cancelled");
                                       }} 
                                       className="p-2 text-rose-500/50 hover:text-rose-500 rounded-md hover:bg-rose-50 transition-colors"
                                     >
                                       <XCircle size={16} />
                                     </button>
                                 </div>
                              </div>
                              <div className="mt-3 space-y-1">
                                 <p className="text-xs font-bold text-dm-midnight/60 flex items-center gap-2">
                                    <Clock size={14} className="text-dm-moss" /> {new Date(sess.proposed_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                 </p>
                                 <p className="text-xs font-bold text-dm-midnight/60 flex items-center gap-2">
                                    <BookMarked size={14} className="text-dm-moss" /> {sess.location}
                                 </p>
                              </div>
                           </div>
                        )
                     })}
                  </div>
                )}
            </div>

            {/* Outgoing Requests */}
            {outgoingRequests.filter(r => r.status === "pending").length > 0 && (
               <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5 flex flex-col gap-3">
                  <h2 className="text-lg font-extrabold text-dm-midnight mb-1">Pending Sent Requests</h2>
                  <div className="space-y-2">
                     {outgoingRequests.filter(r => r.status === "pending").map(req => (
                        <div key={req.id} className="p-4 bg-dm-beige/30 rounded-2xl flex justify-between items-center bg-white border border-black/5 shadow-sm">
                           <div>
                              <p className="font-bold text-dm-midnight text-sm">To {req.receiver.name}</p>
                              <p className="text-xs font-bold text-dm-midnight/50 mt-0.5">{req.subject}</p>
                           </div>
                           <button onClick={() => respondRequest(req.id, "cancelled")} className="text-xs text-rose-500 font-bold px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg transition-colors hover:bg-rose-100">Cancel</button>
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </div>
      )}

      {/* Request Modal */}
      {isRequestModalOpen && requestTarget && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-dm-midnight/40 backdrop-blur-sm transition-all pb-12 sm:pb-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl relative border-4 border-dm-beige">
               <button onClick={() => setIsRequestModalOpen(false)} className="absolute top-6 right-6 text-dm-midnight/40 hover:text-dm-midnight p-2"><XCircle size={24} /></button>
               <h2 className="text-2xl font-extrabold text-dm-midnight mb-2">
                 {requestTarget.isReschedule ? "Reschedule Session" : "Study Request"}
               </h2>
               <p className="text-dm-midnight/60 font-medium text-sm mb-6 pr-6">Propose a time to study <span className="font-bold text-dm-midnight">{requestTarget.subject}</span> with <span className="font-bold text-dm-midnight">{requestTarget.name}</span>.</p>
               
               <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Time</label>
                    <input 
                      type="datetime-local" 
                      value={proposedTime}
                      onChange={e => setProposedTime(e.target.value)}
                      className={`w-full px-5 py-4 rounded-xl bg-dm-beige/30 outline-none font-bold text-sm focus:ring-4 ring-dm-moss/20 border ${requestFormErrors.time ? "border-red-500" : "border-transparent"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Location</label>
                    <input 
                      type="text" 
                      value={proposedLocation}
                      onChange={e => setProposedLocation(e.target.value)}
                      placeholder="e.g. Main Library Floor 2"
                      className={`w-full px-5 py-4 rounded-xl bg-dm-beige/30 outline-none font-bold text-sm focus:ring-4 ring-dm-moss/20 border ${requestFormErrors.location ? "border-red-500" : "border-transparent"}`}
                    />
                  </div>

                  <button 
                    onClick={handleSendRequest}
                    className="w-full py-4 bg-dm-moss text-white rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-95 transition-all mt-4 shadow-sm"
                  >
                    Send Request
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
