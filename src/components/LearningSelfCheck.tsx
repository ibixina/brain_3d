import { useId, useState } from "react";
import checks from "../learning-self-checks.json" with { type: "json" };
import { learningCheckIsCorrect } from "../learning-check";
import { learningSources, type LearningSelfCheck as Check } from "../learning";
import "./learning-self-check.css";

export default function LearningSelfCheck({ pathId }: { pathId: string }) {
  const check = (checks as Record<string, Check>)[pathId];
  if (!check) return null;
  return <LearningSelfCheckForm key={pathId} check={check} />;
}

function LearningSelfCheckForm({ check }: { check: Check }) {
  const groupName = useId();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const question = check.questions[questionIndex];
  if (!question) return null;
  const answer = answers[questionIndex] ?? null;
  const isCorrect = answer !== null && learningCheckIsCorrect(question, answer);
  return (
    <details className="learning-self-check">
      <summary>Quick recall · {check.questions.length} questions</summary>
      {finished ? (
        <div className="learning-check-finished">
          <p role="status">Review complete. You can revisit any answer.</p>
          <button
            onClick={() => {
              setFinished(false);
              setQuestionIndex(0);
            }}
          >
            Review answers
          </button>
        </div>
      ) : (
        <>
          <span className="learning-check-count" aria-live="polite">
            Question {questionIndex + 1} of {check.questions.length}
          </span>
          <span className="learning-check-sr-only" aria-live="polite">
            {question.question}
          </span>
          <fieldset>
            <legend>{question.question}</legend>
            {question.options.map((option, index) => (
              <label key={option}>
                <input
                  type="radio"
                  name={groupName}
                  checked={answer === index}
                  onChange={() =>
                    setAnswers((current) => ({ ...current, [questionIndex]: index }))
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          {answer !== null && (
            <p
              role="status"
              className={isCorrect ? "learning-check-correct" : "learning-check-review"}
            >
              {isCorrect ? question.correctFeedback : question.incorrectFeedback}
            </p>
          )}
          <details className="learning-check-sources">
            <summary>Sources for this answer</summary>
            {question.sourceIds.map((id) => {
              const source = learningSources[id];
              return source ? (
                <a key={id} href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ) : null;
            })}
          </details>
          <nav
            className="learning-check-navigation"
            aria-label="Recall question navigation"
          >
            <button
              disabled={questionIndex === 0}
              onClick={() => setQuestionIndex((index) => index - 1)}
            >
              Previous
            </button>
            <button
              disabled={answer === null}
              onClick={() => {
                if (questionIndex === check.questions.length - 1) setFinished(true);
                else setQuestionIndex((index) => index + 1);
              }}
            >
              {questionIndex === check.questions.length - 1 ? "Finish review" : "Next question"}
            </button>
          </nav>
        </>
      )}
    </details>
  );
}
