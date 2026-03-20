"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient"; 

/**
 * QuizHistory Component
 * Logic: Fetches all rows from 'quiz_history' for the logged-in user.
 * Design: Renders a vertical list of cards with conditional coloring based on score.
 */
export function useQuizHistoryLogic() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- MODAL STATES FOR DELETING HISTORY ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"confirm" | "password">("confirm");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchHistory = async () => {
    // 1. Identify the current user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Query the 'quiz_history' table
    // We order by 'completed_at' descending to show the most recent quizzes at the top
    const { data, error } = await supabase
      .from("quiz_history")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false });

    if (!error) {
      setHistory(data || []);
    } else {
      console.error("Error fetching quiz history:", error.message);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // --- LOGIC TO RESET HISTORY ---
  const handleResetHistory = async () => {
    setIsDeleting(true);
    setErrorMsg("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("User session not found.");

      // 1. Verify Password by trying to sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (authError) {
        setErrorMsg("Incorrect password. Please try again.");
        setIsDeleting(false);
        return;
      }

      // 2. Delete History Rows
      const { error: deleteHistoryError } = await supabase
        .from("quiz_history")
        .delete()
        .eq("user_id", user.id);

      if (deleteHistoryError) throw deleteHistoryError;

      // 3. Reset User Stats to Zero
      const { error: statsError } = await supabase
        .from("user_stats")
        .update({
          total_quizzes_taken: 0,
          average_score: 0,
          accuracy_rate: 0,
          highest_score: 0,
          lowest_score: 0,
          time_spent_per_quiz_seconds: 0,
          total_quizzing_time_seconds: 0
        })
        .eq("id", user.id);

      if (statsError) throw statsError;

      // Success! Close modal and refresh UI
      setIsDeleteModalOpen(false);
      setDeleteStep("confirm");
      setDeletePassword("");
      fetchHistory(); // Refresh the list (will show empty state)
      
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while resetting data.");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    history,
    loading,
    isDeleteModalOpen, setIsDeleteModalOpen,
    deleteStep, setDeleteStep,
    deletePassword, setDeletePassword,
    showDeletePassword, setShowDeletePassword,
    isDeleting,
    errorMsg, setErrorMsg,
    handleResetHistory
  };
}

