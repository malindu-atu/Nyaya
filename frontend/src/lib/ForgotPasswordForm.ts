"use client"; // Required because we use useState, useEffect, and useRouter (client-side hooks)

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// Changed to a named export and renamed to 'useUpdatePassword'
export function useUpdatePassword() {
  // State to hold the new password string
  const [password, setPassword] = useState("");
  // State to handle button loading UI during the async database call
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [confirmPassword, setConfirmPassword] = useState(""); //Confirm Password
  const [strength, setStrength] = useState(0); // To set password strength
  const [errorMsg, setErrorMsg] = useState(""); //To set error msg
  const [showPassword, setShowPassword] = useState(false); //State to toggle password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); //State to toggle confirmpassword visibility

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
    e.preventDefault(); // Prevents the default browser form submission (page reload)

    // Validate Password Strength (Must be at least 'Fair')
    if (strength < 2) {
      setErrorMsg("Password is too weak. Strength must be at least 'Fair'.");
      return;
    }

    // Confirm Password Match Check
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match!");
      return;
    }

    setLoading(true);

    // Supabase built-in method to update user credentials
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      // Common errors include: link expired, or password doesn't meet requirements
      setErrorMsg("Error: " + error.message);
      setLoading(false);
    } else {
      //Setiing the appropriate error message to display in the UI
      setErrorMsg("Password updated successfully!");
      
      /** * Best Practice: Log the user out after a reset.
       * This clears the temporary recovery session and forces a fresh login 
       * with the new credentials for security.
       */
      await supabase.auth.signOut();
      router.push("/login"); // Redirect to the login page
    }
  };

  // This returns the "Backend" data to the "Frontend"
  return {
    password, setPassword,
    confirmPassword, setConfirmPassword,
    loading, strength,
    errorMsg, setErrorMsg,
    showPassword, setShowPassword,
    showConfirmPassword, setShowConfirmPassword,
    checkStrength, handleUpdate
  };
}