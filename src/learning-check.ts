import type { LearningSelfCheckQuestion } from "./learning";

export function learningCheckIsCorrect(check: LearningSelfCheckQuestion, answer: number) {
  return answer === check.answerIndex;
}
