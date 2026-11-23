export function quizPassed(expected: number, submitted: unknown) {
  return Number.isInteger(submitted) && submitted === expected;
}
export function completionPercent(total: number, complete: number) {
  return total > 0
    ? Math.round((Math.min(total, Math.max(0, complete)) / total) * 100)
    : 0;
}
export function chapterComplete(
  read: boolean,
  pendingExercises: number,
  homeworkRequired: boolean,
  homeworkStatus?: string,
) {
  return (
    read &&
    pendingExercises === 0 &&
    (!homeworkRequired || homeworkStatus === "ACCEPTED")
  );
}
