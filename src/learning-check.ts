import type { LearningSelfCheck } from "./learning";

export function learningCheckIsCorrect(check: LearningSelfCheck, answer: number) {
  return answer === check.answerIndex;
}
