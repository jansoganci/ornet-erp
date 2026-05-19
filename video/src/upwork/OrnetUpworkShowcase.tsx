import { AbsoluteFill } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { sceneDurations } from "./constants";
import { timing } from "./helpers";
import { Background, ProgressRail, TopBar } from "./shared";
import { HookScene } from "./HookScene";
import { FieldFlowScene } from "./FieldFlowScene";
import { OperationsScene } from "./OperationsScene";
import { RevenueSimScene } from "./RevenueSimScene";
import { LedgerScene } from "./LedgerScene";
import { UpworkCloseScene } from "./UpworkCloseScene";

export { MAX_FRAMES, TOTAL_FRAMES } from "./constants";

export const OrnetUpworkShowcase = () => {
  return (
    <AbsoluteFill
      style={{
        color: "#1c1917",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <Background />
      <TopBar />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={sceneDurations.hook}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.fieldFlow}>
          <FieldFlowScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.operations}>
          <OperationsScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.revenueSim}>
          <RevenueSimScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.ledger}>
          <LedgerScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.close}>
          <UpworkCloseScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <ProgressRail />
    </AbsoluteFill>
  );
};
