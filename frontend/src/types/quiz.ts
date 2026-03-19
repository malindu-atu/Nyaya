export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Option {
    id: string;
    text: string;
    isCorrect: boolean;
}

export interface Question {
    id: string;
    text: string;
    options: Option[];
    explanation: string;
}

export interface Quiz {
    id: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    durationMinutes: number;
    questions: Question[];
}
