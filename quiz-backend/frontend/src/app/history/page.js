'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Get user ID from localStorage
const getUserId = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('nyaya_user_id');
};

export default function HistoryPage() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, correct: 0, percentage: 0 });
  const router = useRouter();

  useEffect(() => {
    const userId = getUserId();
    
    if (!userId) {
      setLoading(false);
      return;
    }

    // Fetch user attempts
    fetch(`http://127.0.0.1:8000/attempts/${userId}`)
      .then(res => res.json())
      .then(data => {
        setAttempts(data);
        
        // Calculate stats
        const total = data.reduce((sum, attempt) => sum + attempt.total_questions, 0);
        const correct = data.reduce((sum, attempt) => sum + attempt.score, 0);
        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        setStats({ total, correct, percentage });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading attempts:', err);
        setLoading(false);
      });
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading history...</div>
      </div>
    );
  }

  if (!getUserId()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">No History Yet</h2>
          <p className="text-gray-600 mb-6">
            Start taking quizzes to see your attempt history here!
          </p>
          <Link
            href="/"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Browse Quizzes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Your Quiz History</h1>
          <p className="text-gray-600">Track your progress and performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-indigo-600 mb-2">{stats.total}</div>
            <div className="text-gray-600">Total Questions Answered</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">{stats.correct}</div>
            <div className="text-gray-600">Correct Answers</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">{stats.percentage}%</div>
            <div className="text-gray-600">Success Rate</div>
          </div>
        </div>

        {/* Attempts List */}
        {attempts.length > 0 ? (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Quiz</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700">Score</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="inline-block bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {attempt.title}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                        {attempt.description}
                       </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-gray-800">
                            {attempt.score}/{attempt.total_questions}
                          </span>
                          <span className="text-xs text-gray-500">
                            {attempt.total_questions > 0 ? Math.round((attempt.score / attempt.total_questions) * 100) : 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(attempt.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No Attempts Yet</h3>
            <p className="text-gray-600 mb-6">Start taking quizzes to build your history!</p>
            <Link
              href="/"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Browse Quizzes
            </Link>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
