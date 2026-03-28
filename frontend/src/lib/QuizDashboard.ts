"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export function useQuizDashboardLogic() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Helper to convert seconds to "Xm Ys"
  const formatTime = (seconds: number) => {
    if (!seconds) return "0m 0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getDashboardData = useCallback(async () => {
    // 1. Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.push("/login");
      return;
    }

    // 2. Fetch Profile and Stats in parallel
    const [profileRes, statsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("user_stats").select("*").eq("id", user.id).single(),
    ]);

    setUserProfile(profileRes.data);
    setUserStats(statsRes.data);
    setLoading(false);
  }, [router]);

  // Initial load
  useEffect(() => {
    getDashboardData();
  }, [getDashboardData]);

  // Re-fetch whenever the tab regains focus (e.g. user returns from /quiz)
  useEffect(() => {
    const handleFocus = () => {
      getDashboardData();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [getDashboardData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return {
    userProfile,
    userStats,
    loading,
    formatTime,
    handleLogout,
    router,
    refreshStats: getDashboardData,
  };
}