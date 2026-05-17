/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { socket } from "./lib/socket";
import { api } from "./lib/api";
import React, { useState, useEffect } from "react";
import Auth from "./pages/Auth";
import JoinGroup from "./pages/JoinGroup";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Assignments from "./pages/Assignments";
import Budget from "./pages/Budget";
import Feed from "./pages/Feed";
import Study from "./pages/Study";
import Settings from "./pages/Settings";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Home, Receipt, BookOpen, Activity, Wallet, BookMarked, SettingsIcon } from "lucide-react";

import { Toaster } from "react-hot-toast";
import { AnimatePresence, motion } from "motion/react";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

// Custom hook to play sound
function useGlitterSound() {
  const playSound = () => {
    try {
      const audio = new Audio("https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8b81ee08f.mp3?filename=magic-dust-1-98779.mp3");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch(e) {}
  };
  return playSound;
}

function FloatingSparkles() {
  const sparkles = Array.from({ length: 15 });
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {sparkles.map((_, i) => {
        const randomXStart = Math.random() * 100;
        const randomXEnd = randomXStart + (Math.random() * 20 - 10);
        const emoji = ['✨', '🌸', '🎀', '🫧'][Math.floor(Math.random() * 4)];
        const delay = Math.random() * 15;
        const duration = Math.random() * 10 + 15;
        
        return (
          <motion.div
            key={i}
            className="absolute text-xl opacity-40 drop-shadow-sm"
            initial={{ 
              y: "110vh", 
              x: `${randomXStart}vw`,
              rotate: 0,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              y: "-10vh",
              x: `${randomXEnd}vw`,
              rotate: 360
            }}
            transition={{ 
              duration: duration,
              repeat: Infinity,
              ease: "linear",
              delay: delay
            }}
          >
            {emoji}
          </motion.div>
        );
      })}
    </div>
  );
}

function DormPet() {
  const playSound = useGlitterSound();
  const [mood, setMood] = useState('🐱');
  
  const interact = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound();
    setMood(m => m === '🐱' ? '😻' : '🐱');
    setTimeout(() => setMood('🐱'), 2000);
  };
  
  return (
    <motion.div 
      drag
      dragMomentum={false}
      className="fixed top-20 right-4 sm:right-8 lg:right-16 z-50 cursor-grab active:cursor-grabbing drop-shadow-md text-4xl pointer-events-auto"
      whileHover={{ scale: 1.2, rotate: [0, -10, 10, -10, 0] }}
      whileTap={{ scale: 0.9 }}
      onClick={interact}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 12, delay: 1 }}
    >
      <div className="bg-white/80 backdrop-blur-md px-3 py-2 rounded-t-3xl rounded-bl-3xl border border-white/50 border-b-0 shadow-sm relative group">
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/90 text-xs font-bold px-2 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap text-pink-500 shadow-sm">
          {mood === '🐱' ? 'Pet me!' : 'Purr~'}
        </div>
        {mood}
      </div>
    </motion.div>
  );
}

function Layout() {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState(0);
  const location = useLocation();
  const playSound = useGlitterSound();

  useEffect(() => {
    if (user?.id) {
       socket.connect();
       socket.emit("join_user", user.id);

       const fetchReqs = () => {
         api.get(`/study/sessions/${user.id}`).then((res: any) => {
           const incoming = res.data.requests.filter((r: any) => r.receiver_id === user.id && r.status === "pending");
           setPendingRequests(incoming.length);
         }).catch(() => {});
       };

       fetchReqs();

       const handleUpdate = () => {
         fetchReqs();
       };

       socket.on("new_study_request", handleUpdate);
       socket.on("study_request_responded", handleUpdate);
       socket.on("study_request_cancelled", handleUpdate);

       return () => {
          socket.off("new_study_request", handleUpdate);
          socket.off("study_request_responded", handleUpdate);
          socket.off("study_request_cancelled", handleUpdate);
       };
    }
  }, [user]);

  const navItems: Array<{ to: string, icon: React.ReactNode, label: string, badge?: number }> = [
    { to: "/", icon: <Home size={24} />, label: "Home" },
    { to: "/expenses", icon: <Receipt size={24} />, label: "Splits" },
    { to: "/assignments", icon: <BookOpen size={24} />, label: "Tasks" },
    { to: "/budget", icon: <Wallet size={24} />, label: "Budget" },
    { to: "/feed", icon: <Activity size={24} />, label: "Feed" },
    { to: "/study", icon: <BookMarked size={24} />, label: "Study", badge: pendingRequests },
    { to: "/settings", icon: <SettingsIcon size={24} />, label: "Settings" }
  ];

  return (
    <div 
      className="min-h-screen bg-[#FFF0F5] sm:flex sm:justify-start transition-all duration-700" 
    >
      <FloatingSparkles />
      
      <Toaster position="bottom-center" />
      <DormPet />

      {/* Left Sidebar (Desktop) */}
      <div className="hidden sm:flex flex-col w-48 lg:w-56 shrink-0 bg-white/60 backdrop-blur-[10px] border border-white/50 h-[calc(100vh-2rem)] rounded-[2rem] sticky top-4 m-4 p-4 z-50 shadow-sm">
        <div className="text-xl font-black text-pink-500 mb-6 flex items-center gap-3 drop-shadow-sm px-2 mt-2">
          ✨ DormLife
        </div>
        <nav className="flex flex-col gap-2 overflow-y-auto no-scrollbar pb-4 flex-1">
          {navItems.filter(item => item.label !== "Settings").map(item => (
            <NavItemSidebar key={item.to} {...item} />
          ))}
          <div className="mt-auto pt-2">
            {navItems.filter(item => item.label === "Settings").map(item => (
              <NavItemSidebar key={item.to} {...item} />
            ))}
          </div>
        </nav>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 w-full relative min-h-screen z-10 mx-auto flex flex-col">
        <main className="px-4 sm:px-8 pt-8 pb-32 sm:pb-12 w-full max-w-2xl mx-auto xl:max-w-4xl overflow-hidden flex-1">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
              >
                <div onClick={playSound}>
                  <Outlet />
                </div>
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
        
        {/* Global Bottom Navigation (Mobile Only) */}
        <div className="sm:hidden fixed bottom-4 left-0 right-0 px-4 z-50 pointer-events-none flex justify-center">
          <nav className="w-full bg-white/90 backdrop-blur-md rounded-[2rem] p-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 flex justify-between pointer-events-auto overflow-x-auto gap-1 no-scrollbar">
            {navItems.map(item => (
              <NavItemMobile key={item.to} {...item} />
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

function NavItemSidebar({ to, icon, label, badge }: { to: string, icon: React.ReactNode, label: string, badge?: number }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  const playSound = useGlitterSound();
  
  return (
    <Link 
      onClick={playSound}
      to={to} 
      className={`relative flex items-center gap-3 px-4 h-12 rounded-[1.25rem] transition-all duration-300 ${
        isActive 
          ? "bg-gradient-to-tr from-rose-200 to-pink-100 text-dm-midnight shadow-md scale-[1.02]" 
          : "text-dm-midnight/50 hover:bg-white/60 hover:scale-[1.02]"
      }`}
    >
      <div className={`${isActive ? 'text-pink-600 drop-shadow-sm' : ''} scale-90`}>
        {icon}
      </div>
      <span className="font-bold text-base">{label}</span>
      {badge && badge > 0 ? (
        <span className="absolute right-3 w-5 h-5 bg-pink-400 text-white rounded-full text-[9px] flex items-center justify-center font-bold shadow-sm animate-bounce">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function NavItemMobile({ to, icon, label, badge }: { to: string, icon: React.ReactNode, label: string, badge?: number }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  const playSound = useGlitterSound();
  
  return (
    <Link 
      onClick={playSound}
      to={to} 
      className={`relative shrink-0 flex flex-col items-center justify-center w-[4.5rem] sm:w-[5.5rem] h-14 sm:h-16 rounded-[1.5rem] transition-all duration-300 ${
        isActive 
          ? "bg-gradient-to-tr from-rose-200 to-pink-100 text-dm-midnight shadow-md scale-105" 
          : "text-dm-midnight/50 hover:bg-white/60 hover:scale-105"
      }`}
    >
      {badge && badge > 0 ? (
        <span className="absolute top-0 right-2 w-5 h-5 bg-pink-400 text-white rounded-full text-[10px] flex items-center justify-center font-bold shadow-sm animate-bounce">
          {badge}
        </span>
      ) : null}
      <div className={`${isActive ? 'text-pink-600 drop-shadow-sm' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] sm:text-xs font-bold mt-1 max-w-full truncate px-1">{label}</span>
    </Link>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-dm-midnight bg-dm-beige">
        <div className="animate-pulse w-16 h-16 bg-dm-moss rounded-full"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={!user ? <Auth /> : <Navigate to="/" />} />
      <Route path="/join" element={user && !user?.dorm_group_id ? <JoinGroup /> : <Navigate to="/" />} />
      
      {/* Protected Routes inside Layout */}
      <Route element={user?.dorm_group_id ? <Layout /> : <Navigate to={user ? "/join" : "/auth"} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/study" element={<Study />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

