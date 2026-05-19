import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SCENE_HEADLINES } from "./constants";
import { enter, px } from "./helpers";
import { SceneLabel } from "./shared";

export const FieldFlowScene = () => {
  const local = useCurrentFrame();
  const customer = enter(local, 4, 20);
  const workOrder = enter(local, 16, 20);
  const checklist = enter(local, 28, 18);
  const connector = enter(local, 42, 24);
  const callout = enter(local, 72, 16);
  const statusChips = [
    { label: "Open", className: "open", delay: 58 },
    { label: "In Progress", className: "inProgress", delay: 66 },
    { label: "Completed", className: "completed", delay: 74 },
  ];

  return (
    <AbsoluteFill className="scene fieldFlowScene">
      <SceneLabel index="01" title={SCENE_HEADLINES.fieldFlow} />
      <div
        className="dataCard customerCard"
        style={{
          left: 160,
          opacity: customer,
          top: 300,
          transform: `translateX(${px((1 - customer) * -72)})`,
        }}
      >
        <span className="cardLabel">Customer Record</span>
        <div className="cardTitle">Aydin Plaza Security</div>
        <div className="cardDetail">
          Maslak Mah. Buyukdere Cd. No: 233
          <br />
          +90 212 555 0198
        </div>
      </div>
      <div
        className="dataCard workOrderCard"
        style={{
          left: 230,
          opacity: workOrder,
          top: 560,
          transform: `translateX(${px((1 - workOrder) * -72)})`,
        }}
      >
        <span className="cardLabel">Open Work Order</span>
        <div className="cardTitle">Camera signal loss</div>
        <div className="cardDetail monoLine">WO-2026-0418</div>
        <div className="cardDetail">Assigned to field team today</div>
      </div>
      <div
        className="dataCard checklistPanel"
        style={{
          left: 600,
          opacity: checklist,
          top: 710,
          transform: `translateY(${px((1 - checklist) * 22)})`,
        }}
      >
        <span className="cardLabel">Daily Checklist</span>
        <div className="checklistRows">
          <span>Site arrival confirmed</span>
          <span>Fault photo uploaded</span>
          <span>Office notified</span>
        </div>
      </div>
      <div className="connectorRail" style={{ left: 590, top: 650, width: 760 }}>
        <i style={{ transform: `scaleX(${connector})` }} />
      </div>
      <div
        className="dataCard recordPanel"
        style={{
          left: 1400,
          opacity: connector,
          top: 390,
          transform: `translateX(${px((1 - connector) * 34)})`,
        }}
      >
        <span className="cardLabel">System Record</span>
        <div className="cardTitle">Synced operations view</div>
        <div className="cardDetail monoLine">CUSTOMER-AYD-103</div>
        <div className="statusStack">
          {statusChips.map((chip) => {
            const chipProgress = enter(local, chip.delay, 12);

            return (
              <span
                className={`statusChip ${chip.className}`}
                key={chip.label}
                style={{
                  opacity: chipProgress,
                  transform: `translateY(${px((1 - chipProgress) * 10)})`,
                }}
              >
                {chip.label}
              </span>
            );
          })}
        </div>
      </div>
      <div
        className="syncCallout"
        style={{
          opacity: callout,
          position: "absolute",
          right: 150,
          top: 710,
          transform: `translateY(${px((1 - callout) * 18)})`,
        }}
      >
        Field and office synced.
      </div>
    </AbsoluteFill>
  );
};
