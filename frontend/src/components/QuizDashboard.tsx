"use client";

import { LayoutDashboard, PlayCircle, Trophy, Clock, Target, BarChart2, LogOut, User, History, Calendar, Mail } from "lucide-react";
import Image from "next/image";
import { useQuizDashboardLogic } from "@/lib/QuizDashboard";

export default function QuizDashboard() {
  const { 
    userProfile, 
    userStats, 
    loading, 
    formatTime, 
    handleLogout, 
    router 
  } = useQuizDashboardLogic();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading Nyaya Dashboard...</div>;
  }

  return (
    
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* --- LEFT COLUMN: PROFILE & QUICK ACTIONS --- */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              
              {/* Avatar Section */}
              <div className="relative h-28 w-28 mb-6">
                {userProfile?.avatar_url && userProfile.avatar_url !== "/Nyaya_logo_temp.png" ? (
                  <Image
                    src={userProfile.avatar_url}
                    alt="Profile"
                    fill
                    className="rounded-full border-4 border-gray-50 object-cover shadow-sm"
                  />
                ) : (
                  <div className="h-full w-full bg-[#308194] rounded-full flex items-center justify-center text-white text-4xl font-bold uppercase">
                    {userProfile?.first_name?.charAt(0) || "U"}{userProfile?.last_name?.charAt(0) || ""}
                  </div>
                )}
              </div>

              {/* Header: Full Name */}
              <h1 className="text-2xl font-bold text-slate-900 mb-6">
                {userProfile?.first_name} {userProfile?.surname}
              </h1>

              {/* Profile Info List */}
              <div className="w-full space-y-5 border-t border-gray-100 pt-6 text-left">
                
                {/* Username Row */}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Username</p>
                    <p className="text-sm font-semibold text-slate-700">{userProfile?.username || "user"}</p>
                  </div>
                </div>

                {/* Email Row */}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Email Address</p>
                    <p className="text-sm font-semibold text-slate-700">{userProfile?.email || "Not provided"}</p>
                  </div>
                </div>

                {/* Joined Date Row */}
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Member Since</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {userProfile?.created_at 
                        ? new Date(userProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : userProfile ? "Date Missing" : "Loading..."} 
                    </p>
                  </div>
                </div>

                  <div className="w-full flex flex-col items-center gap-7 pt-6 border-t border-gray-100">
    
                    {/* Edit Profile Button */}
                    <button 
                      onClick={() => router.push("/dashboard/profile")}
                      className="w-full max-w-[220px] flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#0f172a] text-white-700 py-3 rounded-2xl font-bold transition-all active:scale-95 group border border-gray-100 shadow-sm"
                    >
                      <User size={18} className="group-hover:scale-110 transition-transform" />
                      <span className="text-sm whitespace-nowrap">Edit Profile</span>
                    </button>

                    {/* Sign Out Button (Now directly below) */}
                    <button 
                      onClick={handleLogout}
                      className="w-full max-w-[220px] flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-2xl font-bold transition-all active:scale-95 group border border-red-100 shadow-sm"
                    >
                      <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                      <span className="text-sm whitespace-nowrap">Sign Out</span>
                    </button>
                    
                  </div>
              </div>
            </div>
          </div>

        {/* --- RIGHT COLUMN: STATS & STRETCHED BUTTONS --- */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          <h1 className="text-2xl font-bold text-[#1e293b] text-center w-full mb-2">
            Nyaya Quiz Dashboard
          </h1>

          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard 
              title="Total Quizzes Taken" 
              value={userStats?.total_quizzes_taken || 0} 
              icon={<LayoutDashboard className="text-[#1e293b]" />} 
              color="bg-[#c5a059]"
            />
            <StatCard 
              title="Average Score" 
              value={`${userStats?.average_score || 0}%`} 
              icon={<BarChart2 className="text-[#1e293b]" />} 
              color="bg-[#c5a059]"
            />
            <StatCard 
              title="Accuracy Rate" 
              value={`${userStats?.accuracy_rate || 0}%`} 
              icon={<Target className="text-[#1e293b]" />} 
              color="bg-[#c5a059]"
            />

            {/* Score Range Block */}
            <StatCard 
              title="Score Range (Low - High)" 
              value={`${userStats?.lowest_score || 0}% - ${userStats?.highest_score || 0}%`} 
              icon={<Trophy className="text-[#1e293b]" />} 
              color="bg-[#c5a059]"
            />

            <StatCard 
              title="Time Spent per Quiz" 
              value={formatTime(userStats?.time_spent_per_quiz_seconds)} 
              icon={<Clock className="text-[#1e293b]" />} 
              color="bg-[#c5a059]"
            />
            <StatCard 
              title="Total Quizzing Time" 
              value={formatTime(userStats?.total_quizzing_time_seconds)} 
              icon={<Clock className="text-[#1e293b]" />} 
              color="bg-[#c5a059]"
            />
          </div>

          {/* --- FULL WIDTH MOTIVATIONAL CARD --- */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-all">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-800 leading-tight">
                {userStats?.average_score >= 80 ? "Excellent work! You're mastering the material. Keep pushing for that 100%!" :
                userStats?.average_score >= 50 ? "Good progress! You have a solid foundation. Consistency is the key to mastery." :
                userStats?.average_score > 0 ? "Keep practicing! Every mistake is a learning opportunity. You've got this." :
                "Welcome to Nyaya! Start your first quiz to begin your journey toward legal mastery."}
              </h3>
            </div>
          </div>

          {/* --- FULL WIDTH STRETCHED BUTTONS ROW --- */}
          {/* We move this OUTSIDE the grid so it can span the full width of the column */}
          <div className="flex flex-row items-center justify-between gap-3 w-full mt-2">
  
              {/* History Button (50%) */}
              <button 

                onClick={() => router.push("/dashboard/quiz-history")}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#0f172a] text-white py-4 py-4 rounded-2xl font-bold transition-all active:scale-95 group border border-gray-100 shadow-sm"
              >
                <History size={18} className="group-hover:rotate-[-10deg] transition-transform" />
                <span className="text-sm whitespace-nowrap">History</span>
              </button>

              {/* Start Quiz Button (50%) */}
              <button 
                className="flex-1 flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#0f172a] text-white py-4 rounded-2xl font-bold transition-all shadow-md active:scale-95 group"
              >
                <PlayCircle size={20} className="group-hover:translate-x-1 transition-transform" />
                <span className="text-sm whitespace-nowrap">Start Quiz</span>
              </button>

            </div>

        </div>
      </div>
    </div>
  );

  function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-shadow">
        <div className={`p-4 ${color} rounded-2xl`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-black text-gray-800">{value}</p>
        </div>
      </div>
    );
  }
}

  