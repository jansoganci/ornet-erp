import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SCENE_HEADLINES } from "./constants";
import { enter, px } from "./helpers";
import { SceneLabel } from "./shared";

export const OperationsScene = () => {
  const local = useCurrentFrame();
  const board = enter(local, 6, 20);
  const badge = enter(local, 68, 16);
  const callout = enter(local, 88, 16);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const lanes = [
    {
      name: "Ahmet K.",
      workload: 82,
      cards: [
        { label: "CCTV install", type: "install", delay: 28 },
        { label: "Alarm service", type: "service", delay: 48 },
      ],
    },
    {
      name: "Mehmet D.",
      workload: 64,
      cards: [
        { label: "Access control", type: "service", delay: 34 },
        { label: "Monthly visit", type: "maintenance", delay: 54 },
      ],
    },
    {
      name: "Ali R.",
      workload: 72,
      cards: [
        { label: "Sensor install", type: "install", delay: 40 },
        { label: "Site audit", type: "maintenance", delay: 60 },
      ],
    },
  ];

  return (
    <AbsoluteFill className="scene operationsScene">
      <SceneLabel index="02" title={SCENE_HEADLINES.operations} />
      <div
        className="opsBoard"
        style={{
          opacity: board,
          transform: `translateY(${px((1 - board) * 24)})`,
        }}
      >
        <div className="opsBoardHeader">
          <span>Operations Board</span>
          <span>Week 21</span>
        </div>
        <div className="opsDayHeaders">
          {days.map((day) => (
            <span className="opsDayHeader" key={day}>
              {day}
            </span>
          ))}
        </div>
        {lanes.map((lane, laneIndex) => {
          const laneProgress = enter(local, 18 + laneIndex * 6, 16);
          const meter = enter(local, 50 + laneIndex * 6, 20);

          return (
            <div
              className="techLane"
              key={lane.name}
              style={{
                opacity: laneProgress,
                transform: `translateX(${px((1 - laneProgress) * -18)})`,
              }}
            >
              <div className="laneLabel">{lane.name}</div>
              <div>
                <div className="laneCards">
                  {lane.cards.map((card) => {
                    const cardProgress = enter(local, card.delay, 14);

                    return (
                      <span
                        className={`planCard ${card.type}`}
                        key={`${lane.name}-${card.label}`}
                        style={{
                          opacity: cardProgress,
                          transform: `translateY(${px((1 - cardProgress) * 12)})`,
                        }}
                      >
                        {card.label}
                      </span>
                    );
                  })}
                </div>
                <div className="meterRow">
                  <div className="meterTrack">
                    <div
                      className="meterFill"
                      style={{ width: `${lane.workload * meter}%` }}
                    />
                  </div>
                  <span className="meterLabel">{lane.workload}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="importBadge"
        style={{
          opacity: badge,
          transform: `translateX(${px((1 - badge) * 40)})`,
        }}
      >
        15 jobs planned &rarr; 3 dispatched
      </div>
      <div
        className="opsCallout"
        style={{
          opacity: callout,
          transform: `translateX(-50%) translateY(${px((1 - callout) * 16)})`,
        }}
      >
        Conflicts avoided — automatic dispatch
      </div>
    </AbsoluteFill>
  );
};
