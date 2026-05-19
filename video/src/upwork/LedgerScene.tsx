import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SCENE_HEADLINES } from "./constants";
import { enter, px } from "./helpers";
import { SceneLabel } from "./shared";

const ledgerSteps = [
  { label: "Subscription payment", value: "Paid", delay: 8 },
  { label: "Income row in ledger", value: "Recorded", delay: 48 },
  { label: "VAT · COGS · SIM batch", value: "Aligned", delay: 88 },
];

export const LedgerScene = () => {
  const local = useCurrentFrame();
  const flowIn = enter(local, 4, 18);
  const footnote = enter(local, 120, 20);

  return (
    <AbsoluteFill className="scene ledgerScene">
      <SceneLabel index="04" title={SCENE_HEADLINES.ledger} />
      <div
        className="ledgerFlow"
        style={{
          opacity: flowIn,
          transform: `translateY(${px((1 - flowIn) * 24)})`,
        }}
      >
        {ledgerSteps.map((step, index) => {
          const stepIn = enter(local, step.delay, 20);
          const showArrow = index < ledgerSteps.length - 1;
          const arrowScale = showArrow ? enter(local, step.delay + 28, 16) : 0;

          return (
            <div className="ledgerStepGroup" key={step.label}>
              <div
                className="ledgerStep"
                style={{
                  opacity: stepIn,
                  transform: `scale(${0.94 + stepIn * 0.06})`,
                }}
              >
                <span className="ledgerStepLabel">{step.label}</span>
                <strong className="ledgerStepValue">{step.value}</strong>
                {stepIn > 0.8 ? <span className="ledgerCheck">✓</span> : null}
              </div>
              {showArrow ? (
                <div
                  className="ledgerArrow"
                  style={{
                    opacity: arrowScale,
                    transform: `scaleX(${arrowScale})`,
                  }}
                >
                  →
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <p
        className="ledgerFootnote"
        style={{
          opacity: footnote,
          transform: `translateY(${px((1 - footnote) * 14)})`,
        }}
      >
        One source of truth: <strong>financial_transactions</strong>
      </p>
    </AbsoluteFill>
  );
};
