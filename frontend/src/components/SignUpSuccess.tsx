"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useSignUpSuccessLogic } from '@/lib/SignUpSuccess';

export default function SignUpSuccess() {
  // Destructure data from the logic hook
  const { firstName, surname, username, email } = useSignUpSuccessLogic();

  return (
    /* This container ensures the card stays exactly 450px wide, matching your Signup form */
    <div className="w-[450px] bg-white rounded-3xl shadow-xl p-10 flex flex-col items-center mx-auto">
      
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
        {/* Full Name Field */}
        <div className="bg-[#f4f7fa] p-4 rounded-xl">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</p>
          <p className="text-[#1a2b4b] font-medium">{firstName} {surname}</p>
        </div>
        
        {/* Username Field */}
        <div className="bg-[#f4f7fa] p-4 rounded-xl">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Username</p>
          <p className="text-[#1a2b4b] font-medium">{username}</p>
        </div>

        {/* Email Field */}
        <div className="bg-[#f4f7fa] p-4 rounded-xl">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Email Address</p>
          <p className="text-[#1a2b4b] font-medium">{email}</p>
        </div>
      </div>

      {/* Back to login Button */}
      <Link 
        href="/login" 
        className="w-full bg-[#0f172a] hover:bg-[#c5a059] text-white font-bold py-3 rounded-xl text-center transition-all shadow-md active:scale-95"
      >
        Login to Nyaya
      </Link>
    </div>
  );
}