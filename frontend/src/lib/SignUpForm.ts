"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from "../lib/supabaseClient";

export function useSignUpLogic() {

  const router = useRouter();

  //State object to hold all form data
  const [formData, setFormData] = useState({
    firstName: "",
    surname: "",
    username: "",
    email: "",
    password: "",
    confirmPassword:""
  });

  //State to toggle password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState(""); // State to store the error text
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

  const [strength, setStrength] = useState(0);

  // Function to calculate strength score (0 to 4)
  const checkStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 6) score++; // Minimum length
    if (pw.length >= 10) score++; // Bonus for length
    if (/[0-9]/.test(pw)) score++; // PW Contains numbers
    if (/[!@#$%^&*]/.test(pw)) score++; // Contains special characters
    setStrength(score); //Setting the strength state to the calculated score
  };

  //Function to update the state as the user types
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(""); // Clear previous errors

    // Validate Username: No '@' allowed
    if (formData.username.includes("@")) {
      //Setting up the appropriate error message to display in the UI
      setErrorMsg("Usernames cannot contain the '@' symbol. Please choose another.");
      return;
    }

    // Validate Password Strength (Must be at least 'Fair')
    if (strength < 2) {
      setErrorMsg("Password is too weak. Strength must be at least 'Fair'.");
      return;
    }

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      //Setting up the appropriate error message to display in the UI
      setErrorMsg("Passwords do not match!");
      return;
    }

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        first_name: formData.firstName,
        surname: formData.surname,
        username: formData.username,
      },
    },
  });

  if (error) {
    // This will catch "User already registered", "Password too short", etc.
    setErrorMsg(error.message); 
    return; // Stop the code here so it doesn't redirect!
  }

  // Supabase "Fake Success" Check:
  // If email confirmation is ON, Supabase returns data but no session.
  // If the user already exists, sometimes 'data.user' is null or identities are empty.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    //Setting up the appropriate error message to display in the UI
    setErrorMsg("This email is already in use. Please try logging in.");
    return;
  }

  // ONLY redirect if there was no error and it's a new user
  const queryString = new URLSearchParams({
    firstName: formData.firstName,
    surname: formData.surname,
    username: formData.username,
    email: formData.email,
  }).toString();

  router.push(`/signup_success?${queryString}`);
};

return {
    formData,
    handleChange,
    strength,
    checkStrength,
    showPassword, setShowPassword,
    showConfirmPassword, setShowConfirmPassword,
    errorMsg,
    handleSubmit
  };
}