import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { STACK_BADGES, TOTAL_FRAMES } from "./constants";
import { enter, exit, px } from "./helpers";

export const Background = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 34], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 18% 12%, rgba(220,38,38,0.14), transparent 26%), radial-gradient(circle at 84% 24%, rgba(37,99,235,0.12), transparent 25%), linear-gradient(135deg, #FAFAF8 0%, #F4F3F0 48%, #EFEDE8 100%)",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        className="grain"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(28,25,23,0.05) 1px, transparent 1px), linear-gradient(45deg, rgba(28,25,23,0.035) 1px, transparent 1px)",
          backgroundPosition: `${px(drift)} ${px(drift * 0.6)}`,
          backgroundSize: "42px 42px",
          opacity: 0.75,
        }}
      />
      <AbsoluteFill className="vignette" />
    </AbsoluteFill>
  );
};

export const Wordmark = ({ large = false }: { large?: boolean }) => {
  const frame = useCurrentFrame();
  const logoScale = spring({
    frame: Math.max(0, frame - 4),
    fps: 30,
    config: { damping: 18, stiffness: 120 },
  });
  const markSize = large ? 54 : 42;
  const fontSize = large ? 26 : 28;

  return (
    <div className="wordmark" style={{ alignItems: "center", display: "flex", gap: 14 }}>
      <div
        className="logoMark"
        style={{
          alignItems: "center",
          background: "#dc2626",
          borderRadius: 10,
          boxShadow: "0 18px 42px rgba(220,38,38,0.28)",
          color: "#ffffff",
          display: "flex",
          fontSize,
          fontWeight: 800,
          height: markSize,
          justifyContent: "center",
          letterSpacing: "-0.06em",
          transform: `scale(${logoScale})`,
          width: markSize,
        }}
      >
        O
      </div>
      <div
        style={{
          color: "#1c1917",
          display: "flex",
          flexDirection: "column",
          fontWeight: 800,
          lineHeight: 0.92,
        }}
      >
        <span style={{ fontSize: large ? 34 : 27 }}>Ornet</span>
        <span style={{ color: "#78716c", fontSize: large ? 16 : 14, letterSpacing: "0.18em" }}>
          ERP
        </span>
      </div>
    </div>
  );
};

export const TopBar = () => {
  const frame = useCurrentFrame();
  const opacity = enter(frame, 6, 20) * exit(frame, TOTAL_FRAMES - 40, 40);

  return (
    <div
      className="topbar"
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "space-between",
        left: 86,
        opacity,
        position: "absolute",
        right: 86,
        top: 58,
        zIndex: 20,
      }}
    >
      <Wordmark />
      <div
        style={{
          color: "#78716c",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.18em",
        }}
      >
        SECURITY OPERATIONS ERP
      </div>
    </div>
  );
};

export const SceneLabel = ({ index, title }: { index: string; title: string }) => (
  <div className="sceneLabel">
    <span>{index}</span>
    <b>{title}</b>
  </div>
);

export const StackBadges = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();

  return (
    <div className="stackPills">
      {STACK_BADGES.map((badge, index) => {
        const progress = enter(frame, delay + index * 8, 16);

        return (
          <span
            className="stackPill"
            key={badge}
            style={{
              opacity: progress,
              transform: `translateY(${px((1 - progress) * 12)})`,
            }}
          >
            {badge}
          </span>
        );
      })}
    </div>
  );
};

export const ProgressRail = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="progressRail"
      style={{
        background: "rgba(28,25,23,0.08)",
        borderRadius: 999,
        bottom: 48,
        height: 4,
        left: 86,
        overflow: "hidden",
        position: "absolute",
        right: 86,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, #dc2626, #2563eb, #7c3aed)",
          borderRadius: 999,
          height: "100%",
          width: `${progress}%`,
        }}
      />
    </div>
  );
};
