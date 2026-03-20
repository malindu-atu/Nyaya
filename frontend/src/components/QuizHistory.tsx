"use client";

import { Clock, Trophy, Calendar, Award, RotateCcw, ShieldCheck, Eye, EyeOff, History } from "lucide-react";
import Image from "next/image";
import { useQuizHistoryLogic } from "@/lib/QuizHistory";

export default function QuizHistory() {
  const {
    history,
    loading,
    isDeleteModalOpen, setIsDeleteModalOpen,
    deleteStep, setDeleteStep,
    deletePassword, setDeletePassword,
    showDeletePassword, setShowDeletePassword,
    isDeleting,
    errorMsg, setErrorMsg,
    handleResetHistory
  } = useQuizHistoryLogic();

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">Loading your history...</div>;

  return (
    <div className="space-y-6">
      {/* Header section with total count */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Quiz History</h2>
        
        <div className="flex items-center gap-3">
          <span className="bg-blue-50 text-[#0f172a] px-3 py-1 rounded-full text-xs font-bold">
            {history.length} Total Attempts
          </span>

          {/* RESET HISTORY BUTTON */}
          <button 
            onClick={() => { setIsDeleteModalOpen(true); setDeleteStep("confirm"); setErrorMsg(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl font-semibold text-sm hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
          >
            <RotateCcw size={16} />
            Reset History
          </button>
        </div>
      </div>


      {/* Conditional Rendering: Check if history has data */}
      {history.length > 0 ? (
        <div className="grid gap-4">
          {history.map((quiz) => (
            <div 
              key={quiz.id} 
              className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
              {/* Unified Score Badge (Single Color Coding) */}
              <div className="h-14 w-14 shrink-0 rounded-2xl flex flex-col items-center justify-center border border-slate-100 bg-[#c5a059] text-[#0f172a] transition-colors hover:bg-slate-100">
                <span className="text-lg font-black leading-tight">{quiz.score}%</span>
                <span className="text-[10px] uppercase font-black opacity-70 tracking-tighter">Score</span>
              </div>

                <div>
                  <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {quiz.quiz_name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    {/* Format the date to a readable UK format */}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={12} />
                      {new Date(quiz.completed_at).toLocaleDateString('en-GB')}
                    </span>
                    {/* Calculate minutes and seconds from raw seconds */}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
                      {Math.floor(quiz.time_taken_seconds / 60)}m {quiz.time_taken_seconds % 60}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side: Questions count */}
              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                <div className="text-left md:text-right">
                  <p className="text-sm font-bold text-gray-700">
                    {Math.round((quiz.score / 100) * quiz.total_questions)} / {quiz.total_questions} Correct
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Performance</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State: Shown if user has zero records in quiz_history */
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
          <Award size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="text-gray-500 font-medium">No quiz records found.</p>
          <p className="text-sm text-gray-400 mt-1">Complete a quiz to see your history here!</p>
        </div>
      )}

      {/* --- RESET QUIZ HISTORY SECURITY MODAL --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-orange-100 animate-in fade-in zoom-in duration-200">
            
            {/* STEP 1: CONFIRM RESET */}
            {deleteStep === "confirm" && (
              <div className="text-center">
                <div className="mx-auto w-16 h-16 bg-[#c5a059] text-[#0f172a] rounded-full flex items-center justify-center mb-4">
                  <History size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Clear Quiz History?</h3>
                <p className="text-sm text-slate-500 mb-6 px-2">
                  This will permanently erase your past scores and reset your dashboard stats to zero. **This action cannot be undone.**
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setIsDeleteModalOpen(false); setDeleteStep("confirm"); }}
                    className="flex-1 py-3 bg-[#d4b06a] rounded-xl font-bold text-white-600 hover:bg-[#c5a059] transition-all active:scale-95"
                  >
                    Keep History
                  </button>
                  <button 
                    onClick={() => setDeleteStep("password")}
                    className="flex-1 py-3 bg-[#1e293b] rounded-xl font-bold text-white hover:bg-[#0f172a] transition-all active:scale-95 shadow-lg shadow-orange-100"
                  >
                    Yes, Reset
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PASSWORD VERIFICATION */}
            {deleteStep === "password" && (
              <>
                <div className="flex justify-center mb-4">
                  <Image src="/Nyaya_logo_temp.png" alt="NYAYA Logo" width={60} height={60} className="rounded-full shadow-sm" />
                </div>

                <div className="flex items-center gap-3 text-slate-800 mb-4 justify-center">
                  <ShieldCheck size={24} className="text-[#c5a059]" />
                  <h3 className="text-lg font-bold">Security Check</h3>
                </div>
                
                <p className="text-sm text-slate-600 text-center mb-6">
                  Please enter your password to confirm you want to reset your statistics.
                </p>

                {errorMsg && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-[11px] font-bold uppercase rounded-xl border border-red-100">
                    {errorMsg}
                  </div>
                )}

                {/* PASSWORD INPUT */}
                <div className="relative mb-6">
                  <input 
                    type={showDeletePassword ? "text" : "password"} 
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="w-full p-3 pr-12 border border-[#c5a059] rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-black transition-all bg-slate-50/50"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-[#c5a059] transition-colors"
                  >
                    {showDeletePassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteStep("confirm")} 
                    className="flex-1 py-3 bg-[#d4b06a]  rounded-xl text-white-600 font-bold hover:bg-[#c5a059] transition active:scale-95"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleResetHistory}
                    disabled={isDeleting}
                    className="flex-1 py-3 bg-[#1e293b] rounded-xl text-white font-bold hover:bg-[#0f172a] transition disabled:bg-orange-300 active:scale-95 shadow-lg shadow-orange-100"
                  >
                    {isDeleting ? "Resetting..." : "Reset Now"}
                  </button> 
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}