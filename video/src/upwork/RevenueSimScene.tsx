import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SCENE_HEADLINES } from "./constants";
import { enter, formatUsd, px } from "./helpers";
import { SceneLabel } from "./shared";

export const RevenueSimScene = () => {
  const local = useCurrentFrame();
  const panelIn = enter(local, 6, 20);
  const simIn = enter(local, 120, 22);
  const mrrValue = Math.round(
    interpolate(local, [6, 70], [0, 184500], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }),
  );
  const overduePulse =
    local >= 52 && local < 115
      ? interpolate((local - 52) % 24, [0, 12, 24], [0, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        })
      : 0;
  const comparisonRows = [
    { line: "532 410 88 12", invoice: "$240", inventory: "$240", matched: true },
    { line: "533 104 72 19", invoice: "$310", inventory: "Missing", matched: false },
  ];

  return (
    <AbsoluteFill className="scene revenueSimScene">
      <SceneLabel index="03" title={SCENE_HEADLINES.revenueSim} />
      <div
        className="revenueSimSplit"
        style={{
          opacity: panelIn,
          transform: `translateY(${px((1 - panelIn) * 20)})`,
        }}
      >
        <div className="revenueSimCol">
          <div className="kpiHero revenueSimKpi">
            <strong>{formatUsd(mrrValue)}</strong>
            <span>Monthly Recurring Revenue</span>
          </div>
          <div className="collectionTable revenueSimTable">
            <div className="collectionHeader">
              <span>Customer</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            <div
              className="collectionRow overdueRow"
              style={{
                borderColor: `rgba(185, 28, 28, ${0.3 + overduePulse * 0.45})`,
                boxShadow: `0 0 ${Math.round(overduePulse * 18)}px rgba(185, 28, 28, ${
                  overduePulse * 0.2
                })`,
              }}
            >
              <span>Atlas Residence</span>
              <span className="amount">$28,000</span>
              <span>
                <i className="collectionChip overdue">overdue</i>
              </span>
            </div>
            <div className="collectionRow">
              <span>Aydin Plaza</span>
              <span className="amount">$42,000</span>
              <span>
                <i className="collectionChip paid">paid</i>
              </span>
            </div>
          </div>
        </div>
        <div
          className="revenueSimCol simCol"
          style={{
            opacity: simIn,
            transform: `translateX(${px((1 - simIn) * 40)})`,
          }}
        >
          <div className="uploadCard revenueSimUpload">
            <div className="uploadIcon">📄</div>
            <strong>Operator_Invoice.pdf</strong>
            <span>312 active SIMs · invoice vs inventory</span>
          </div>
          <div className="comparisonMatrix revenueSimMatrix">
            <div className="matrixHeader">
              <span>SIM line</span>
              <span>Invoice</span>
              <span>Inventory</span>
              <span />
            </div>
            {comparisonRows.map((row, index) => {
              const rowProgress = enter(local, 130 + index * 10, 14);

              return (
                <div
                  className="matrixRow"
                  key={row.line}
                  style={{
                    opacity: rowProgress,
                    transform: `translateX(${px((1 - rowProgress) * -12)})`,
                  }}
                >
                  <span className="monoLine">{row.line}</span>
                  <span>{row.invoice}</span>
                  <span>{row.inventory}</span>
                  <span className={`matchCheck ${row.matched ? "match" : "noMatch"}`}>
                    {row.matched ? "✓" : "×"}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="alertChip error revenueSimAlert">3 lines not in inventory</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
