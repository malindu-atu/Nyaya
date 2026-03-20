"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user?.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/dashboard"); // Kick out non-admins
      } else {
        setIsAdmin(true);
      }
    }
    checkAdmin();
  }, [router]);

  if (!isAdmin) return <p>Verifying admin access...</p>;

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold">Nyaya Admin Control Panel</h1>
      {/* Admin features go here */}
    </div>
  );
}