"use client";

import { User, Mail, Lock, UserCircle, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useSignUpLogic } from "@/lib/SignUpForm";

export default function SignUpForm() {
  const {
    formData,
    handleChange,
    strength,
    checkStrength,
    showPassword, setShowPassword,
    showConfirmPassword, setShowConfirmPassword,
    errorMsg,
    handleSubmit
  } = useSignUpLogic();

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">

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

      <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Create Nyaya Account</h2>
      
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* First Name & Surname */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input 
              name = "firstName"
              value={formData.firstName}
              onChange={handleChange}
              type="text" 
              required
              placeholder="John" 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]" name="firstName" onChange={handleChange} />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
            <input 
              name = "surname"
              value={formData.surname}
              onChange={handleChange}
              type="text" 
              required
              placeholder="Doe" 
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]" name="surname" onChange={handleChange} />
          </div>
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              name = "email"
              value={formData.email}
              onChange={handleChange}
              type="email" 
              required
              placeholder="john@example.com" 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]" />
          </div>
        </div>

        {/* Username Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <div className="relative">
            <UserCircle className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              name = "username"
              value={formData.username}
              onChange={handleChange}
              type="text" 
              required
              placeholder="johndoe123" 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]" />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              name = "password"
              value={formData.password}
              onChange={(e) => {
                handleChange(e); // Keep your existing data update
                checkStrength(e.target.value); // Add strength check
             }}
              type={showPassword ? "text" : "password"} // Dynamic type              
              placeholder="••••••••" 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]" />

              {/* Toggle Button */}
              <button
                type="button" // Important: prevents form submission
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-[#c5a059]"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
          </div>
        </div>

        {/* Only show the strength meter if the user has started typing */}
        {formData.password && (
          <>
            {/* Password Strength Bar */}
            <div className="mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  strength === 0 ? "w-0" :
                  strength === 1 ? "w-1/4 bg-red-500" :
                  strength === 2 ? "w-2/4 bg-orange-500" :
                  strength === 3 ? "w-3/4 bg-yellow-500" :
                  "w-full bg-green-500"
                }`}
              />
            </div>

            {/* Strength Label */}
            <p className="text-[10px] mt-1 font-medium uppercase tracking-wider text-gray-400">
              Strength: 
              <span className={
                strength <= 1 ? "text-red-500" : 
                strength <= 3 ? "text-orange-500" : 
                "text-green-500"
              }>
                {strength <= 1 ? " Weak" : strength <= 3 ? " Fair" : " Strong"}
              </span>
            </p>
          </>
        )}

        {/* Confirm Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              name = "confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              type={showConfirmPassword ? "text" : "password"} // Dynamic type              required
              placeholder="••••••••" 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]" />

              {/* Toggle Button */}
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-[#c5a059]"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>

          </div>
        </div>

        {/* Inline Error Message */}
        {errorMsg && (
          <div className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded border border-red-200 mb-2">
            {errorMsg}
          </div>
        )}

        <button className="w-full bg-[#0f172a] text-white py-2 rounded-lg font-semibold hover:bg-[#c5a059] transition">
          Create Account
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Already have an account? <a href="/login" className="text-[#0f172a] font-semibold hover:underline">Log in</a>
      </p>
    </div>
  );
}