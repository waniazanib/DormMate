import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function JoinGroup() {
  const [isCreating, setIsCreating] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [university, setUniversity] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<{groupName?: boolean, university?: boolean, inviteCode?: boolean}>({});
  
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const errors: any = {};
    if (isCreating) {
      if (!groupName.trim()) errors.groupName = true;
      if (!university.trim()) errors.university = true;
    } else {
      if (!inviteCode.trim() || inviteCode.length !== 6) errors.inviteCode = true;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fill out the highlighted fields correctly");
      return;
    }

    try {
      if (isCreating) {
        await api.post("/groups/create", { name: groupName, university });
      } else {
        await api.post("/groups/join", { invite_code: inviteCode });
      }
      await refreshUser();
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-sm max-w-md w-full p-8 text-center border-4 border-dm-beige/50">
        <h1 className="text-3xl font-extrabold text-dm-midnight mb-2">Dorm Setup</h1>
        <p className="text-dm-moss font-semibold mb-8">Let's get you connected</p>
        
        {error && (
          <div className="bg-dm-rosy/20 text-dm-rosy p-3 rounded-2xl mb-4 text-sm font-semibold whitespace-pre-wrap text-left">
            {typeof error === "string" 
              ? error 
              : Array.isArray(error) 
                ? error.map((err: any) => err.message).join('\n')
                : JSON.stringify(error, null, 2)
            }
          </div>
        )}

        <div className="flex bg-dm-beige/50 rounded-2xl p-1 mb-6">
          <button 
            className={`flex-1 py-2 rounded-xl font-bold transition-all ${isCreating ? 'bg-white shadow-sm text-dm-midnight' : 'text-dm-dark-green/60'}`}
            onClick={() => {
              setIsCreating(true);
              setFormErrors({});
            }}
          >
            Create Group
          </button>
          <button 
            className={`flex-1 py-2 rounded-xl font-bold transition-all ${!isCreating ? 'bg-white shadow-sm text-dm-midnight' : 'text-dm-dark-green/60'}`}
            onClick={() => {
              setIsCreating(false);
              setFormErrors({});
            }}
          >
            Join Group
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isCreating ? (
            <>
              <input
                type="text"
                placeholder="Dorm / Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold border ${formErrors.groupName ? "border-red-500" : "border-transparent"}`}
              />
              <input
                type="text"
                placeholder="University"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold border ${formErrors.university ? "border-red-500" : "border-transparent"}`}
              />
              <button
                type="submit"
                className="w-full py-4 bg-dm-midnight text-white rounded-2xl font-bold text-lg hover:scale-[1.02] hover:shadow-lg transition-all active:scale-95"
              >
                Create Group
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="ENTER 6-CHAR CODE"
                maxLength={6}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-bold tracking-widest text-center uppercase border ${formErrors.inviteCode ? "border-red-500" : "border-transparent"}`}
              />
              <button
                type="submit"
                className="w-full py-4 bg-dm-rosy text-white rounded-2xl font-bold text-lg hover:scale-[1.02] hover:shadow-lg transition-all active:scale-95"
              >
                Join Now
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
