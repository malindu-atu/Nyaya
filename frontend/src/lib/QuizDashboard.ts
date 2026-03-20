
"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    async function getDashboardData() {
      // 1. Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      // 2. Fetch Profile and Stats from your new tables
      const [profileRes, statsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("user_stats").select("*").eq("id", user.id).single()
      ]);

      setUserProfile(profileRes.data);
      setUserStats(statsRes.data);
      setLoading(false);
    }

    getDashboardData();
  }, [router]);

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
    router
  };
}

