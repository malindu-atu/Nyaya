"use client"; // Required because we use useState, useEffect, and useRouter (client-side hooks)

import Image from "next/image";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useResetPasswordLogic } from "@/lib/ResetPasswordForm";

export default function ResetPasswordForm() {
  const {
    password, setPassword,
    currentPassword, setCurrentPassword,
    confirmPassword, setConfirmPassword,
    loading, strength,
    errorMsg,
    showPassword, setShowPassword,
    showConfirmPassword, setShowConfirmPassword,
    showCurrentPassword, setShowCurrentPassword,
    checkStrength, handleUpdate,
    router
  } = useResetPasswordLogic();

  return (
    // Outer container ensures the card is centered on all screen sizes
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      
      {/* Main Card Container*/}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        
        {/*Nyaya Logo*/}
        <div className="flex justify-center mb-4">
          <Image 
            src="/Nyaya_logo_temp.png" 
            alt="NYAYA Logo" 
            width={80} 
            height={80} 
            className="rounded-full shadow-sm" 
          />
        </div>

        <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">Set New Password</h2>
        <p className="text-sm text-gray-500 text-center mb-8">
          Enter a strong password to secure your Nyaya account.
        </p>

        <form onSubmit={handleUpdate} className="space-y-6">

          {/* CURRENT PASSWORD FIELD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter current password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]"
              />

              {/* The Toggle Button */}
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-[#c5a059]"
              >
                {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/*New Password Field*/}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              {/* Icon placement: Absolute positioning inside a relative container */}
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type={showPassword ? "text" : "password"} // Dynamic type switching
                placeholder="Min. 6 characters" 
                required 
                autoFocus // Automatically focuses the input when the page loads
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black border-[#c5a059]"
                onChange={(e) => {
                  const newPassword = e.target.value;
                  setPassword(newPassword); // Updates the password state
                  checkStrength(newPassword); // Actually triggers the bar to move!
                }}
              />

              {/* The Toggle Button */}
              <button
                type="button" // CRITICAL: must be "button" so it doesn't submit the form
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-[#c5a059] transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button> 
              
            </div>

            {/*Strength Meter Visuals */}
            {password && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      strength === 1 ? "w-1/4 bg-red-500" :
                      strength === 2 ? "w-2/4 bg-orange-500" :
                      strength === 3 ? "w-3/4 bg-yellow-500" :
                      strength === 4 ? "w-full bg-green-500" : "w-0"
                    }`}
                  />
                </div>
                <p className={`text-[10px] mt-1 font-bold uppercase tracking-wider ${
                  strength <= 1 ? "text-red-500" : strength <= 3 ? "text-orange-500" : "text-green-500"
                }`}>
                  Strength: {strength <= 1 ? "Weak" : strength <= 3 ? "Fair" : "Strong"}
                </p>
              </div>
            )}
            </div>

            {/* Inline Error Message Display */}
          {errorMsg && (
            <p className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded border border-red-200 mt-4">
              {errorMsg}
            </p>
          )}

        {/* Confirm Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
            <input 
              type={showConfirmPassword ? "text" : "password"} // Dynamic type 
              required
              placeholder="••••••••" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-black transition-colors border-[#c5a059] `}/>

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

          {/* Submit Button: 
              Changes appearance when 'loading' to prevent double-submissions.
          */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#1e293b] text-white py-3 rounded-xl font-semibold hover:bg-[#c5a059] transition shadow-lg shadow-blue-100 disabled:bg-blue-300"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>

        {/* Redirect to Profile Button */}
        <button 
          type="button" 
          onClick={() => router.push("/dashboard/profile")} // Redirects to the profile path
          className="w-full bg-[#1e293b] text-white py-3 rounded-xl font-semibold hover:bg-[#c5a059] transition shadow-lg shadow-blue-100"
        >
          Back to Profile
        </button>
        </form>

      </div>
    </div>
  );
}
  