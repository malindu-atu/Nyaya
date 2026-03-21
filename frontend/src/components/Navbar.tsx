"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  LayoutDashboard, 
  User, 
  BookOpen, 
  ClipboardCheck 
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [dashboardHref, setDashboardHref] = useState("/dashboard");

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") {
        setDashboardHref("/admin/dashboard");
      } else {
        setDashboardHref("/dashboard");
      }
    };

    checkRole();
  }, []);

  const hideOnPaths = ["/login", "/signup", "/signup_success"];
  if (hideOnPaths.includes(pathname)) return null;

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#0f172a] backdrop-blur-md border-b border-[#0f172a]">
      <div className="w-full px-4 h-16 flex items-center justify-between">
        
        <Link href="/" className="flex items-center gap-2 group">
          <Image 
            src="/Nyaya_logo_temp.png" 
            alt="Nyaya Logo" 
            width={40} 
            height={40} 
            className="rounded-full shadow-sm group-hover:scale-105 transition-transform" 
          />
          <span className="font-bold text-xl text-white group-hover:text-[#c5a059] transition-colors">
            Nyaya
          </span>
        </Link>

        <div className="flex items-center gap-2 md:gap-6">

          <NavLink 
            href="/" 
            icon={<BookOpen size={18} />} 
            label="Citation Manager" 
            active={pathname === "/"} 
          />

          <NavLink 
            href="/quiz" 
            icon={<ClipboardCheck size={18} />} 
            label="Revision Quiz" 
            active={pathname === "/quiz"} 
          />

          <NavLink 
            href={dashboardHref} 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
            active={pathname === "/dashboard" || pathname === "/admin/dashboard"} 
          />

          <NavLink 
            href="/dashboard/profile-display" 
            icon={<User size={18} />} 
            label="Profile" 
            active={pathname.includes("/profile")} 
          />

        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, icon, label, active }: { href: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-1.5 text-xs md:text-sm font-semibold transition-all px-3 py-2 rounded-lg ${
        active 
          ? 'text-[#c5a059] bg-[#fdf8ef]' 
          : 'text-gray-500 hover:text-[#1e293b] hover:bg-gray-50'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
