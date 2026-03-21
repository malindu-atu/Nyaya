"use client";

import Image from "next/image";
import {
  User,
  Mail,
  Calendar,
  LogOut,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useProfileDisplayLogic } from "@/lib/ProfileDisplay";

export default function ProfileDisplay() {
  // Destructure all required logic from our custom hook
  const { userProfile, loading, handleLogout, router } =
    useProfileDisplayLogic();

  // Show a professional loading spinner while data is being retrieved
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-4">
        <Loader2 className="animate-spin text-[#c5a059]" size={48} />
        <p className="text-gray-500 font-medium animate-pulse">
          Loading Nyaya Profile...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* LEFT SIDE: Big Square Avatar (Span 5) */}
        <div className="md:col-span-5 bg-[#0f172a] flex items-center justify-center p-8 md:p-12">
          <div className="relative h-64 w-64 md:h-80 md:w-80 shadow-2xl">
            {userProfile?.avatar_url &&
            userProfile.avatar_url !== "/Nyaya_logo_temp.png" ? (
              <Image
                src={userProfile.avatar_url}
                alt="Profile"
                fill
                className="rounded-2xl object-cover border-4 border-white/10"
              />
            ) : (
              <div className="h-full w-full bg-[#308194] rounded-2xl flex items-center justify-center text-white text-7xl font-bold uppercase shadow-inner">
                {userProfile?.first_name?.charAt(0) || "U"}
                {userProfile?.surname?.charAt(0) || ""}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Profile Details (Span 7) */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 text-[#c5a059] font-bold text-xs uppercase tracking-[0.2em] mb-3">
              <ShieldCheck size={14} />
              Verified Member
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 leading-tight">
              {userProfile?.first_name}{" "}
              <span className="">{userProfile?.surname}</span>
            </h1>
          </div>

          {/* Info Rows */}
          <div className="grid grid-cols-1 gap-8 mb-12">
            {/* Username */}
            <div className="flex items-center gap-5 group">
              <div className="p-3 bg-gray-50 rounded-2xl text-slate-400 group-hover:bg-[#1e293b] group-hover:text-white transition-all shadow-sm">
                <User size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-0.5">
                  Username
                </p>
                <p className="text-xl font-semibold text-slate-700">
                  {userProfile?.username || "user_nyaya"}
                </p>
              </div>
            </div>

            {/* Email Address */}
            <div className="flex items-center gap-5 group">
              <div className="p-3 bg-gray-50 rounded-2xl text-slate-400 group-hover:bg-[#1e293b] group-hover:text-white transition-all shadow-sm">
                <Mail size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-0.5">
                  Email Address
                </p>
                <p className="text-xl font-semibold text-slate-700">
                  {userProfile?.email || "No email linked"}
                </p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center gap-5 group">
              <div className="p-3 bg-gray-50 rounded-2xl text-slate-400 group-hover:bg-[#1e293b] group-hover:text-white transition-all shadow-sm">
                <Calendar size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-0.5">
                  Member Since
                </p>
                <p className="text-xl font-semibold text-slate-700">
                  {userProfile?.created_at
                    ? new Date(userProfile.created_at).toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric" },
                      )
                    : "January 2026"}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 border-t border-gray-100 pt-10">
            <button
              onClick={() => router.push("/dashboard/profile")}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-[#c5a059] text-white py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-slate-200"
            >
              <User size={18} />
              Edit Account
            </button>

            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 py-4 rounded-2xl font-bold transition-all active:scale-95 border border-red-100"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}