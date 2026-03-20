"use client"; // Required because we use useState, useEffect, and useRouter (client-side hooks)

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export function useResetPasswordLogic() {
  // State to hold the new password string
  const [password, setPassword] = useState("");

  // State to hold the current password string
  const [currentPassword, setCurrentPassword] = useState("");

  // State to handle button loading UI during the async database call
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [confirmPassword, setConfirmPassword] = useState(""); //Confirm Password
  const [strength, setStrength] = useState(0); // To set password strength
  const [errorMsg, setErrorMsg] = useState(""); //To set error msg
  const [showPassword, setShowPassword] = useState(false); //State to toggle password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); //State to toggle confirm password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false); //State to toggle current password visibility

  // Function to calculate strength score (0 to 4)
  const checkStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 6) score++; 
    if (pw.length >= 10) score++; 
    if (/[0-9]/.test(pw)) score++; 
    if (/[!@#$%^&*]/.test(pw)) score++; 
    setStrength(score);
  };

  /**
   * handleUpdate: Sends the new password to Supabase.
   * This works because the user arrives here via a 'recovery' magic link
   * which grants them a temporary session to update their user data.
   */
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(""); // Clear old errors
    
    // 1. Validation Checks
    if (strength < 2) {
      setErrorMsg("Password is too weak. Strength must be at least 'Fair'.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
        // --- STEP 1: MANUALLY VERIFY CURRENT PASSWORD ---
        // We try to sign in with the user's email and the current password they typed.
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: user?.email || "",
            password: currentPassword,
        });

        if (verifyError) {
            throw new Error("Current password is incorrect.");
        }

        // --- STEP 2: UPDATE TO NEW PASSWORD ---
        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        });

        if (updateError) throw updateError;

        // SUCCESS
        setErrorMsg("Password updated successfully! Logging out...");
        
        setTimeout(async () => {
            await supabase.auth.signOut();
            router.push("/login");
        }, 2000);

        } catch (error: any) {
        setErrorMsg(error.message);
        setLoading(false);
        }
    };

    return {
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
    };
}