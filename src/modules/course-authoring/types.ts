export type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  published: number;
  created_at: number;
};
export type Chapter = {
  id: string;
  course_id: string;
  title: string;
  notes: string;
  video_url: string;
  homework: string;
  position: number;
  published: number;
};
export type CodeTest = { input: unknown[]; expected: unknown };
export type Exercise = {
  id: string;
  chapter_id: string;
  title: string;
  kind: "QUIZ" | "CODE";
  prompt: string;
  options: string;
  answer: number;
  starter: string;
  tests: string;
  position: number;
};
