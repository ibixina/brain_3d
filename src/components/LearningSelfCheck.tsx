import { useId, useState } from "react";
import checks from "../learning-self-checks.json" with { type: "json" };
import { learningCheckIsCorrect } from "../learning-check";
import type { LearningSelfCheck as Check } from "../learning";
import "./learning-self-check.css";

export default function LearningSelfCheck({ pathId }: { pathId: string }) {
  const check = (checks as Record<string, Check>)[pathId];
  if (!check) return null;
  return <LearningSelfCheckForm key={pathId} check={check} />;
}

function LearningSelfCheckForm({ check }: { check: Check }) {
  const groupName = useId();
  const [answer, setAnswer] = useState<number | null>(null);
  const isCorrect = answer !== null && learningCheckIsCorrect(check, answer);
  return (
    <details className="learning-self-check">
      <summary>Quick recall · check what you learned</summary>
      <fieldset>
        <legend>{check.question}</legend>
        {check.options.map((option, index) => (
          <label key={option}>
            <input
              type="radio"
              name={groupName}
              checked={answer === index}
              onChange={() => setAnswer(index)}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
      {answer !== null && (
        <p role="status" className={isCorrect ? "learning-check-correct" : "learning-check-review"}>
          {isCorrect ? check.correctFeedback : check.incorrectFeedback}
        </p>
      )}
    </details>
  );
}
