"use client";

import Image from "next/image";
import Link from "next/link";
import { useSignUpSuccessLogic } from "@/lib/SignUpSuccess";

export default function SignUpSuccess() {
  const { firstName, surname, username, email } = useSignUpSuccessLogic();

  return (
    <div className="flex flex-col items-center bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in duration-300">
      {/* NYAYA Logo */}
      <div className="flex justify-center mb-4">
        <Image 
          src="/Nyaya_logo_temp.png"
          alt="NYAYA Logo" 
          width={80}           
          height={80}          
          className="rounded-full shadow-sm" 
        />
      </div>

      <h2 className="text-2xl font-bold text-[#1a2b4b] mb-1">User Created!</h2>
      <p className="text-gray-400 text-sm mb-8">Your Nyaya account is ready to use.</p>
      
      <div className="w-full space-y-4 mb-10">
        <div className="bg-[#f4f7fa] p-4 rounded-xl">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</p>
          <p className="text-[#1a2b4b] font-medium">{firstName} {surname}</p>
        </div>
        
        <div className="bg-[#f4f7fa] p-4 rounded-xl">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Username</p>
          <p className="text-[#1a2b4b] font-medium">{username}</p>
        </div>

        <div className="bg-[#f4f7fa] p-4 rounded-xl">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
          <p className="text-[#1a2b4b] font-medium">{email}</p>
        </div>
      </div>

      <Link 
        href="/login" 
        className="w-full bg-[#0f172a] hover:bg-[#c5a059] text-white font-bold py-3 rounded-xl text-center transition-all shadow-md active:scale-95"
      >
        Login to Nyaya
      </Link>
    </div>
  );
}
