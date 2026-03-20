"use client";
import QuizHistory from "@/components/QuizHistory";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Quiz History Page
 * Route: /dashboard/quiz-history
 * Responsibility: Provides the page wrapper and a back button for navigation.
 */
export default function QuizHistoryPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation: Simple back link to return to the main dashboard */}
        <button 
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-gray-400 hover:text-blue-600 transition-colors mb-8 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm">Back to Dashboard</span>
        </button>

        {/* The Actual History List Component */}
        <QuizHistory />
        
      </div>
    </div>
  );
}