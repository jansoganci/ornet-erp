import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { SCENE_HEADLINES } from "./constants";
import { enter, px } from "./helpers";
import { StackBadges, Wordmark } from "./shared";

export const UpworkCloseScene = () => {
  const local = useCurrentFrame();
  const wordmarkScale = spring({
    frame: Math.max(0, local - 6),
    fps: 30,
    config: { damping: 18, stiffness: 120 },
  });
  const tagline = enter(local, 22, 20);
  const cta = enter(local, 48, 18);
  const glow = enter(local, 70, 24);
  const pillars = [
    { delay: 36, label: "Operations", text: "Field and office unified" },
    { delay: 46, label: "Revenue", text: "Subscriptions and collections" },
    { delay: 56, label: "Intelligence", text: "SIM invoice analysis" },
  ];

  return (
    <AbsoluteFill className="scene closingScene upworkCloseScene">
      <div
        className="redGlow"
        style={{
          opacity: 0.42 + glow * 0.58,
          transform: `scale(${0.82 + glow * 0.18})`,
        }}
      />
      <div
        className="closingWordmark"
        style={{
          opacity: wordmarkScale,
          transform: `scale(${0.86 + wordmarkScale * 0.14})`,
        }}
      >
        <Wordmark large />
      </div>
      <h2
        style={{
          opacity: tagline,
          transform: `translateY(${px((1 - tagline) * 18)})`,
        }}
      >
        Ornet ERP keeps security operations accountable.
      </h2>
      <div className="closingPillars">
        {pillars.map((pillar) => {
          const progress = enter(local, pillar.delay, 16);

          return (
            <div
              className="closingPillar"
              key={pillar.label}
              style={{
                opacity: progress,
                transform: `translateY(${px((1 - progress) * 16)})`,
              }}
            >
              <strong>{pillar.label}</strong>
              {pillar.text}
            </div>
          );
        })}
      </div>
      <p
        className="upworkCta"
        style={{
          opacity: cta,
          transform: `translateY(${px((1 - cta) * 12)})`,
        }}
      >
        {SCENE_HEADLINES.close}
      </p>
      <StackBadges delay={64} />
    </AbsoluteFill>
  );
};
