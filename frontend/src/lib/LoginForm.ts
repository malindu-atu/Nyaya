"use client"; 

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export function useLoginLogic() {
  const router = useRouter();
  const [email, setEmail] = useState(""); // Use Email for Supabase Auth
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(""); // State to store the error text   
  const [successMsg, setSuccessMsg] = useState(""); // State to store the success text
  const [showPassword, setShowPassword] = useState(false);  //State to toggle password visibility

const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setErrorMsg(""); // Clear old errors

  let loginEmail = email; // Staring with whatever the user typed

  // 1. CHECK IF INPUT IS A USERNAME (doesn't contain '@')
  if (!email.includes("@")) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email") 
      .eq("username", email)
      .single();

    if (profileError || !profile) {
      //Setting the appropriate error message to display in the UI
      setErrorMsg("Username not found. Please check or use your email.");      
      setLoading(false);
      return;
    }
    
    loginEmail = profile.email; // Switch to the actual email found in DB
  }

  // 2. PROCEED WITH SUPABASE LOGIN
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: password,
  });

  if (error || !authData.user) {
    setErrorMsg(error?.message || "Login failed");
    setLoading(false);
    return; // Stop here if login fails
  }

  // 3.Check User Role for Redirection
  const { data: userProfile, error: roleError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  //FINAL REDIRECT LOGIC
  if (roleError || !userProfile) {
    // If we can't find a role, default to student dashboard
    router.push("/dashboard"); 
    return;
  }

  // 4. Redirect based on role
  if (userProfile.role === "admin") {
    router.push("/admin/dashboard"); // Route to admin panel
  } else {
    router.push("/dashboard"); // Route to student panel
  }
};

//Handling forgot password
const handleForgotPassword = async () => {
  setErrorMsg(""); // Clear old errors
  
  if (!email) {
    alert("Please enter your email or username first!");
    return;
  }

  setLoading(true);
  let resetEmail = email;

  try {
    // 1. If it's a username (no '@'), find the email in the database
    if (!email.includes("@")) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", email)
        .single();

      if (profileError || !profile) {
        throw new Error("Username not found. Please enter a valid username or email.");
      }
      resetEmail = profile.email;
    }

    // 2. Trigger the Supabase Reset
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (error) throw error;

    setSuccessMsg("Check your inbox! We've sent a reset link to your linked email.");
    
  } catch (error: any) {
    setErrorMsg(error.message);
  } finally {
    setLoading(false);
  }
};

  // Google Login 
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        // This forces the "Select an Account" screen
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      alert("Error: " + error.message);
    }
  };

  return {
    email, setEmail,
    password, setPassword,
    loading, errorMsg,
    showPassword, setShowPassword,
    handleLogin,
    handleForgotPassword,
    handleGoogleLogin, successMsg
  };
}
