"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  User, 
  BookOpen, 
  ClipboardCheck 
} from "lucide-react";

export default function Navbar() {
  // Hook to get the current URL path for highlighting the active button
  const pathname = usePathname();

  // Array of paths where the Navbar should be hidden (Auth pages)
  const hideOnPaths = ["/login", "/signup", "/signup_success"];
  
  // If the current path is in the hide list, return null (render nothing)
  if (hideOnPaths.includes(pathname)) return null;

  return (
    // 'sticky top-0' keeps the nav at the top. 
    <nav className="sticky top-0 z-50 w-full bg-[#0f172a] backdrop-blur-md border-b border-[#0f172a]">
      <div className="w-full px-4 h-16 flex items-center justify-between">
        
        {/* LOGO SECTION: Links back to the landing page/home */}
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

        {/* NAVIGATION LINKS CONTAINER */}
        <div className="flex items-center gap-2 md:gap-6">
          
          {/* Link to the Citation Management tool */}
          <NavLink 
            href="/citation-manager" 
            icon={<BookOpen size={18} />} 
            label="Citation Manager" 
            active={pathname === "/"} 
          />

          {/* Link to the Revision Quiz section */}
          <NavLink 
            href="/revision-quiz" 
            icon={<ClipboardCheck size={18} />} 
            label="Revision Quiz" 
            active={pathname === "/quiz"} 
          />

          {/* Link to the user's main Dashboard */}
          <NavLink 
            href="/dashboard" 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
            active={pathname === "/dashboard"} 
          />

          {/* Link to the User Profile/Account settings */}
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

/**
 * Reusable NavLink component to keep the code DRY (Don't Repeat Yourself).
 * Manages the hover effects and active state styling for every nav button.
 */
function NavLink({ href, icon, label, active }: { href: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-1.5 text-xs md:text-sm font-semibold transition-all px-3 py-2 rounded-lg ${
        active 
          // Styles for the active page
          ? 'text-[#c5a059] bg-[#fdf8ef]' 
          // Styles for inactive pages (with hover effects)
          : 'text-gray-500 hover:text-[#1e293b] hover:bg-gray-50'
      }`}
    >
      {icon}
      {/* 'hidden sm:inline' hides the text label on mobile to save space, showing only the icon */}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}