import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Settings() {
  const { user, refetchUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [allowance, setAllowance] = useState(user?.monthly_allowance?.toString() || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleUpdateProfile = async () => {
    try {
      await api.patch("/auth/me", {
        name,
        monthly_allowance: parseFloat(allowance)
      });
      toast.success("Profile updated!");
      refetchUser();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error updating profile");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword
      });
      toast.success("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error: any) {
       toast.error(error.response?.data?.error || "Error changing password");
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave your dorm group?")) return;
    try {
      await api.post("/groups/leave");
      toast.success("Left group successfully");
      refetchUser();
    } catch (error: any) {
      toast.error("Error leaving group");
    }
  };

  const handleLogout = () => {
     localStorage.removeItem("token");
     toast.success("Logged out");
     window.location.href = "/auth";
  };

  return (
    <div className="pb-24 max-w-2xl mx-auto sm:px-6">
      <h1 className="text-3xl font-extrabold text-dm-midnight mb-6 px-4 sm:px-0 drop-shadow-sm">Settings</h1>

      <div className="space-y-6">
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[32px] sm:rounded-3xl mx-4 sm:mx-0 shadow-sm border border-white/50">
           <h2 className="text-lg font-bold text-dm-midnight mb-4">Edit Profile</h2>
           <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-black/5 outline-none font-bold text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Monthly Allowance ($)</label>
                <input 
                  type="number" 
                  value={allowance}
                  onChange={e => setAllowance(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-black/5 outline-none font-bold text-sm"
                />
              </div>
              <button 
                onClick={handleUpdateProfile}
                className="w-full py-4 bg-dm-midnight text-white rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-md"
              >
                Save Profile
              </button>
           </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[32px] sm:rounded-3xl mx-4 sm:mx-0 shadow-sm border border-white/50">
           <h2 className="text-lg font-bold text-dm-midnight mb-4">Change Password</h2>
           <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-black/5 outline-none font-bold text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-dm-midnight/50 mb-2 ml-2">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-black/5 outline-none font-bold text-sm"
                />
              </div>
              <button 
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword}
                className="w-full py-4 bg-dm-moss text-white rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-md disabled:opacity-50"
              >
                Update Password
              </button>
           </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md p-6 rounded-[32px] sm:rounded-3xl mx-4 sm:mx-0 shadow-sm border border-white/50">
           <h2 className="text-lg font-bold text-dm-midnight mb-4">Danger Zone</h2>
           <div className="space-y-4">
              <button 
                onClick={handleLeaveGroup}
                className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-sm border border-red-100"
              >
                Leave Dorm Group
              </button>

              <button 
                onClick={handleLogout}
                className="w-full py-4 bg-white/50 text-dm-midnight/60 rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-sm border border-black/5"
              >
                Logout
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
