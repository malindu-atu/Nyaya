"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, ChevronDown, ChevronUp,
  LogOut, BookOpen, CheckCircle, XCircle, Loader2
} from "lucide-react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Option {
  text: string;
  is_correct: boolean;
}

interface Question {
  text: string;
  explanation: string;
  options: Option[];
}

interface NewQuizForm {
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  duration_minutes: number;
  questions: Question[];
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  duration_minutes: number;
  created_at: string;
  question_count: number;
}

// ── Empty form factory ────────────────────────────────────────────────────────
function emptyQuestion(): Question {
  return {
    text: "",
    explanation: "",
    options: [
      { text: "", is_correct: true },
      { text: "", is_correct: false },
      { text: "", is_correct: false },
      { text: "", is_correct: false },
    ],
  };
}

function emptyForm(): NewQuizForm {
  return {
    title: "",
    description: "",
    difficulty: "Medium",
    duration_minutes: 10,
    questions: [emptyQuestion()],
  };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewQuizForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        router.push("/dashboard");
      } else {
        setIsAdmin(true);
        setLoading(false);
        fetchQuizzes();
      }
    }
    checkAdmin();
  }, [router]);

  // ── Fetch quizzes ───────────────────────────────────────────────────────────
  async function fetchQuizzes() {
    setQuizzesLoading(true);
    const { data: quizData } = await supabase
      .from("quizzes2")
      .select("id, title, description, difficulty, duration_minutes, created_at")
      .order("created_at", { ascending: false });

    if (quizData) {
      const withCounts = await Promise.all(
        quizData.map(async (q) => {
          const { count } = await supabase
            .from("questions")
            .select("*", { count: "exact", head: true })
            .eq("quiz_id", q.id);
          return { ...q, question_count: count ?? 0 };
        })
      );
      setQuizzes(withCounts);
    }
    setQuizzesLoading(false);
  }

  // ── Delete quiz ─────────────────────────────────────────────────────────────
  async function handleDelete(quizId: string) {
    if (!confirm("Are you sure you want to delete this quiz? This cannot be undone.")) return;
    setDeletingId(quizId);
    await supabase.from("quizzes2").delete().eq("id", quizId);
    setQuizzes(prev => prev.filter(q => q.id !== quizId));
    setDeletingId(null);
  }

  // ── Form helpers ────────────────────────────────────────────────────────────
  function updateQuestion(qi: number, text: string) {
    setForm(f => {
      const qs = [...f.questions];
      qs[qi] = { ...qs[qi], text };
      return { ...f, questions: qs };
    });
  }

  function updateExplanation(qi: number, explanation: string) {
    setForm(f => {
      const qs = [...f.questions];
      qs[qi] = { ...qs[qi], explanation };
      return { ...f, questions: qs };
    });
  }

  function updateOption(qi: number, oi: number, text: string) {
    setForm(f => {
      const qs = [...f.questions];
      const opts = [...qs[qi].options];
      opts[oi] = { ...opts[oi], text };
      qs[qi] = { ...qs[qi], options: opts };
      return { ...f, questions: qs };
    });
  }

  function setCorrectOption(qi: number, oi: number) {
    setForm(f => {
      const qs = [...f.questions];
      const opts = qs[qi].options.map((o, idx) => ({ ...o, is_correct: idx === oi }));
      qs[qi] = { ...qs[qi], options: opts };
      return { ...f, questions: qs };
    });
  }

  function addQuestion() {
    setForm(f => ({ ...f, questions: [...f.questions, emptyQuestion()] }));
  }

  function removeQuestion(qi: number) {
    setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== qi) }));
  }

  // ── Submit new quiz ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitMsg(null);

    if (!form.title.trim()) {
      setSubmitMsg({ type: "error", text: "Quiz title is required." });
      return;
    }
    for (let qi = 0; qi < form.questions.length; qi++) {
      const q = form.questions[qi];
      if (!q.text.trim()) {
        setSubmitMsg({ type: "error", text: `Question ${qi + 1} text is required.` });
        return;
      }
      if (q.options.some(o => !o.text.trim())) {
        setSubmitMsg({ type: "error", text: `All options in question ${qi + 1} must be filled.` });
        return;
      }
      if (!q.options.some(o => o.is_correct)) {
        setSubmitMsg({ type: "error", text: `Question ${qi + 1} must have one correct answer.` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: quiz, error: quizError } = await supabase
        .from("quizzes2")
        .insert({
          title: form.title.trim(),
          description: form.description.trim(),
          difficulty: form.difficulty,
          duration_minutes: form.duration_minutes,
        })
        .select()
        .single();

      if (quizError || !quiz) throw new Error(quizError?.message || "Failed to create quiz");

      for (const q of form.questions) {
        const { data: question, error: qError } = await supabase
          .from("questions")
          .insert({
            quiz_id: quiz.id,
            question_text: q.text.trim(),
            explanation: q.explanation.trim(),
          })
          .select()
          .single();

        if (qError || !question) throw new Error(qError?.message || "Failed to create question");

        const { error: oError } = await supabase
          .from("options")
          .insert(
            q.options.map(o => ({
              question_id: question.id,
              option_text: o.text.trim(),
              is_correct: o.is_correct,
            }))
          );

        if (oError) throw new Error(oError.message);
      }

      setSubmitMsg({ type: "success", text: `Quiz "${form.title}" created successfully!` });
      setForm(emptyForm());
      setShowForm(false);
      fetchQuizzes();
    } catch (err: any) {
      setSubmitMsg({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#c5a059]" size={40} />
      </div>
    );
  }

  if (!isAdmin) return null;

  const difficultyColors: Record<string, string> = {
    Easy: "bg-green-50 text-green-700",
    Medium: "bg-yellow-50 text-yellow-700",
    Hard: "bg-red-50 text-red-700",
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <div className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Image src="/Nyaya_logo_temp.png" alt="Nyaya" width={40} height={40} className="rounded-full" />
          <div>
            <p className="font-bold text-lg leading-tight">Nyaya Admin</p>
            <p className="text-xs text-[#c5a059]">Control Panel</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0f172a]">Quiz Management</h1>
            <p className="text-gray-500 mt-1">Add, view and delete quizzes</p>
          </div>
          <button
            onClick={() => { setShowForm(f => !f); setSubmitMsg(null); }}
            className="flex items-center gap-2 bg-[#0f172a] hover:bg-[#c5a059] text-white px-5 py-3 rounded-xl font-semibold transition"
          >
            <Plus size={18} />
            {showForm ? "Cancel" : "Add Quiz"}
          </button>
        </div>

        {/* Success/Error message */}
        {submitMsg && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            submitMsg.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {submitMsg.type === "success" ? <CheckCircle size={20} /> : <XCircle size={20} />}
            {submitMsg.text}
          </div>
        )}

        {/* ── Add Quiz Form ─────────────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h2 className="text-xl font-bold text-[#0f172a]">New Quiz</h2>

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Quiz Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Fundamental Rights in Sri Lanka"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-gray-800"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this quiz..."
                rows={2}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-gray-800 resize-none"
              />
            </div>

            {/* Difficulty + Duration */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as any }))}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-gray-800 bg-white"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Estimated Time (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={form.duration_minutes}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 10 }))}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-gray-800"
                />
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-700">Questions</h3>

              {form.questions.map((q, qi) => (
                <div key={qi} className="border border-gray-100 rounded-xl p-5 bg-gray-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#c5a059] uppercase tracking-wider">
                      Question {qi + 1}
                    </span>
                    {form.questions.length > 1 && (
                      <button onClick={() => removeQuestion(qi)} className="text-red-400 hover:text-red-600 transition">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Question text */}
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => updateQuestion(qi, e.target.value)}
                    placeholder="Enter question text..."
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-gray-800 bg-white"
                  />

                  {/* Explanation */}
                  <input
                    type="text"
                    value={q.explanation}
                    onChange={e => updateExplanation(qi, e.target.value)}
                    placeholder="Explanation shown after answer is selected..."
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#c5a059] outline-none text-gray-800 bg-white text-sm"
                  />

                  {/* Options */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Options — click circle to mark correct answer
                    </p>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-3">
                        <button
                          onClick={() => setCorrectOption(qi, oi)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                            opt.is_correct
                              ? "border-green-500 bg-green-500"
                              : "border-gray-300 hover:border-[#c5a059]"
                          }`}
                        >
                          {opt.is_correct && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={e => updateOption(qi, oi, e.target.value)}
                          placeholder={`Option ${oi + 1}`}
                          className="flex-1 p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#c5a059] outline-none text-gray-800 bg-white text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={addQuestion}
                className="w-full border-2 border-dashed border-gray-300 hover:border-[#c5a059] text-gray-500 hover:text-[#c5a059] py-3 rounded-xl font-medium transition flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add Another Question
              </button>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-[#0f172a] hover:bg-[#c5a059] text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? "Creating..." : "Create Quiz"}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm()); setSubmitMsg(null); }}
                className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Quiz List ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-[#0f172a]">
            All Quizzes
            <span className="ml-2 text-sm font-normal text-gray-400">({quizzes.length})</span>
          </h2>

          {quizzesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[#c5a059]" size={32} />
            </div>
          ) : quizzes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <BookOpen className="mx-auto mb-4 text-gray-300" size={48} />
              <p className="text-gray-500 font-medium">No quizzes yet.</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Quiz" to create your first one.</p>
            </div>
          ) : (
            quizzes.map(quiz => (
              <div key={quiz.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[#0f172a] text-lg truncate">{quiz.title}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${difficultyColors[quiz.difficulty] || "bg-gray-100 text-gray-600"}`}>
                        {quiz.difficulty}
                      </span>
                    </div>
                    {quiz.description && (
                      <p className="text-gray-500 text-sm mt-0.5 truncate">{quiz.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-400">
                        {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-gray-400">{quiz.duration_minutes} min</span>
                      <span className="text-xs text-gray-400">
                        Created {new Date(quiz.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => setExpandedQuiz(expandedQuiz === quiz.id ? null : quiz.id)}
                      className="p-2 text-gray-400 hover:text-[#0f172a] hover:bg-gray-50 rounded-lg transition"
                    >
                      {expandedQuiz === quiz.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <button
                      onClick={() => handleDelete(quiz.id)}
                      disabled={deletingId === quiz.id}
                      className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      {deletingId === quiz.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Delete
                    </button>
                  </div>
                </div>

                {expandedQuiz === quiz.id && <QuizDetails quizId={quiz.id} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Quiz Details ──────────────────────────────────────────────────────────────
function QuizDetails({ quizId }: { quizId: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: qs } = await supabase
        .from("questions")
        .select("id, question_text, explanation")
        .eq("quiz_id", quizId);

      if (qs) {
        const withOptions = await Promise.all(
          qs.map(async (q) => {
            const { data: opts } = await supabase
              .from("options")
              .select("option_text, is_correct")
              .eq("question_id", q.id)
              .order("option_text");
            return { ...q, options: opts ?? [] };
          })
        );
        setQuestions(withOptions);
      }
      setLoading(false);
    }
    load();
  }, [quizId]);

  if (loading) {
    return (
      <div className="border-t border-gray-100 p-4 flex justify-center">
        <Loader2 className="animate-spin text-[#c5a059]" size={20} />
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
      {questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-xs font-bold text-[#c5a059] uppercase tracking-wider mb-2">Question {i + 1}</p>
          <p className="font-medium text-[#0f172a] mb-3">{q.question_text}</p>
          <div className="space-y-1.5">
            {q.options.map((opt: any, oi: number) => (
              <div key={oi} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                opt.is_correct ? "bg-green-50 text-green-800 font-medium" : "text-gray-600"
              }`}>
                {opt.is_correct
                  ? <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
                  : <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0" />}
                {opt.option_text}
              </div>
            ))}
          </div>
          {q.explanation && (
            <p className="text-xs text-gray-500 mt-3 italic px-1">💡 {q.explanation}</p>
          )}
        </div>
      ))}
    </div>
  );
}
