import Link from 'next/link';

export default async function Home() {
  const res = await fetch("http://127.0.0.1:8000/quizzes", {
    cache: "no-store"
  });
  const quizzes = await res.json();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">Nyaya Quiz</h1>
          <p className="text-xl text-gray-600">Choose a quiz and test your knowledge</p>
          <div className="mt-4">
            <Link 
              href="/history"
              className="inline-block bg-white hover:bg-gray-50 text-indigo-600 font-semibold py-2 px-6 rounded-lg shadow-md transition-colors border-2 border-indigo-200"
            >
              View Your History
            </Link>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <Link
              key={quiz.id}
              href={`/quiz/${quiz.id}`}
              className="bg-white rounded-xl shadow-lg p-6 border-2 border-transparent hover:border-indigo-500 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4 mx-auto">
                <span className="text-3xl">📝</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3 text-center">{quiz.title}</h2>
              <p className="text-gray-600 text-sm mb-4 text-center line-clamp-2">{quiz.description}</p>
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">{quiz.question_count} questions</span>
                <span className="text-indigo-600 font-semibold">Start →</span>
              </div>
              {quiz.question_count === 0 && (
                <div className="mt-2 text-center">
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Coming Soon</span>
                </div>
              )}
            </Link>
          ))}
        </div>
        
        {quizzes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-xl text-gray-500">No quizzes available yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
