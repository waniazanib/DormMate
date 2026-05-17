import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [allowance, setAllowance] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<{email?: boolean, password?: boolean, name?: boolean, university?: boolean, allowance?: boolean}>({});
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const errors: any = {};
    if (!email.trim() || !email.includes("@")) errors.email = true;
    if (!password.trim()) errors.password = true;

    if (!isLogin) {
      if (!name.trim()) errors.name = true;
      if (!university.trim()) errors.university = true;
      if (!allowance || isNaN(parseFloat(allowance)) || parseFloat(allowance) < 0) errors.allowance = true;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please correctly fill out highlighted fields");
      return;
    }

    try {
      if (isLogin) {
        const res = await api.post("/auth/login", { email, password });
        login(res.data.token, res.data.user);
        navigate("/");
      } else {
        const res = await api.post("/auth/register", {
          name,
          email,
          password,
          university,
          monthly_allowance: parseFloat(allowance)
        });
        login(res.data.token, res.data.user);
        navigate("/");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-sm max-w-md w-full p-8 text-center border-4 border-dm-beige/50">
        <h1 className="text-4xl font-extrabold text-dm-midnight mb-2">DormMate</h1>
        <p className="text-dm-moss font-semibold mb-8">Your dorm, sorted.</p>
        
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold border ${formErrors.name ? "border-red-500" : "border-transparent"}`}
              />
              <input
                type="text"
                placeholder="University"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold border ${formErrors.university ? "border-red-500" : "border-transparent"}`}
              />
              <input
                type="number"
                placeholder="Monthly Allowance"
                min="0"
                step="0.01"
                value={allowance}
                onChange={(e) => setAllowance(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold border ${formErrors.allowance ? "border-red-500" : "border-transparent"}`}
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold border ${formErrors.email ? "border-red-500" : "border-transparent"}`}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full px-5 py-4 rounded-2xl bg-dm-beige/30 outline-none focus:ring-4 focus:ring-dm-moss/30 transition-all font-semibold border ${formErrors.password ? "border-red-500" : "border-transparent"}`}
          />

          <button
            type="submit"
            className="w-full py-4 bg-dm-moss text-white rounded-2xl font-bold text-lg hover:scale-[1.02] hover:shadow-lg transition-all active:scale-95"
          >
            {isLogin ? "Hop In" : "Get Started"}
          </button>
        </form>

        <button 
          onClick={() => {
            setIsLogin(!isLogin);
            setFormErrors({});
          }}
          className="mt-6 text-dm-dark-green font-semibold opacity-70 hover:opacity-100 transition-opacity"
        >
          {isLogin ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
