import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SCENE_HEADLINES } from "./constants";
import { enter, px } from "./helpers";
import { StackBadges, Wordmark } from "./shared";

export const HookScene = () => {
  const frame = useCurrentFrame();
  const logo = enter(frame, 0, 18);
  const problem = enter(frame, 12, 20);
  const promise = enter(frame, 32, 22);

  return (
    <AbsoluteFill className="scene hookScene">
      <div
        className="hookLogoWrap"
        style={{
          opacity: logo,
          transform: `scale(${0.9 + logo * 0.1})`,
        }}
      >
        <Wordmark large />
      </div>
      <h1
        className="hookProblem"
        style={{
          opacity: problem,
          transform: `translateY(${px((1 - problem) * 20)})`,
        }}
      >
        {SCENE_HEADLINES.hook.problem}
      </h1>
      <p
        className="hookPromise"
        style={{
          opacity: promise,
          transform: `translateY(${px((1 - promise) * 16)})`,
        }}
      >
        {SCENE_HEADLINES.hook.promise}
      </p>
      <StackBadges delay={52} />
    </AbsoluteFill>
  );
};
