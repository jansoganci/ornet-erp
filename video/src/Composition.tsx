import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";

const sceneDurations = {
  intro: 120,
  fieldFlow: 155,
  operations: 165,
  revenue: 145,
  simIntelligence: 135,
  guardrail: 170,
  financeView: 120,
  close: 125,
};

export const TOTAL_FRAMES =
  Object.values(sceneDurations).reduce((total, duration) => total + duration, 0) -
  (Object.keys(sceneDurations).length - 1) * 28;

const enter = (frame: number, from: number, duration = 24) =>
  interpolate(frame, [from, from + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const exit = (frame: number, from: number, duration = 24) =>
  interpolate(frame, [from, from + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

const px = (value: number) => `${value}px`;

const formatUsd = (value: number) =>
  `$${value.toLocaleString("en-US")}`;

const timing = springTiming({ config: { damping: 120 } });

const Background = () => {
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
      <AbsoluteFill
        className="vignette"
        style={{
          background:
            "radial-gradient(circle at center, transparent 50%, rgba(28,25,23,0.13) 100%), linear-gradient(180deg, rgba(28,25,23,0.04), transparent 24%, rgba(28,25,23,0.08))",
        }}
      />
    </AbsoluteFill>
  );
};

const Wordmark = () => {
  const frame = useCurrentFrame();
  const logoScale = spring({
    frame: Math.max(0, frame - 8),
    fps: 30,
    config: { damping: 18, stiffness: 120 },
  });

  return (
    <div
      className="wordmark"
      style={{
        alignItems: "center",
        display: "flex",
        gap: 14,
      }}
    >
      <div
        className="logoMark"
        style={{
          alignItems: "center",
          background: "#dc2626",
          borderRadius: 10,
          boxShadow: "0 18px 42px rgba(220,38,38,0.28)",
          color: "#ffffff",
          display: "flex",
          fontSize: 28,
          fontWeight: 800,
          height: 42,
          justifyContent: "center",
          letterSpacing: "-0.06em",
          transform: `scale(${logoScale})`,
          width: 42,
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
        <span style={{ fontSize: 27 }}>Ornet</span>
        <span style={{ color: "#78716c", fontSize: 14, letterSpacing: "0.18em" }}>
          ERP
        </span>
      </div>
    </div>
  );
};

const TopBar = () => {
  const frame = useCurrentFrame();
  const opacity =
    enter(frame, 8, 26) *
    exit(frame, TOTAL_FRAMES - 50, 50);

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

const SceneLabel = ({ index, title }: { index: string; title: string }) => (
  <div className="sceneLabel">
    <span>{index}</span>
    <b>{title}</b>
  </div>
);

const ProgressRail = () => {
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

const IntroScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const kicker = enter(local, 8, 18);
  const headline = enter(local, 20, 18);
  const proofPills = [
    {
      delay: 38,
      label: "Operations Hub",
      text: "connects field and office",
    },
    {
      delay: 52,
      label: "Revenue Engine",
      text: "subscriptions, proposals, collections",
    },
    {
      delay: 66,
      label: "SIM Intelligence",
      text: "invoice analysis, cost control",
    },
  ];

  return (
    <AbsoluteFill className="scene introScene">
      <SceneLabel
        index="01"
        title="One ERP for security operations, subscriptions, and finance"
      />
      <div className="introStack">
        <p
          className="kicker"
          style={{
            opacity: kicker,
            transform: `translateY(${px((1 - kicker) * 18)})`,
          }}
        >
          Built for security companies
        </p>
        <h1
          style={{
            opacity: headline,
            transform: `translateY(${px((1 - headline) * 24)})`,
          }}
        >
          Security operations,
          <br />
          subscriptions,
          <br />
          and finance.
        </h1>
        <div className="proofPills">
          {proofPills.map((pill) => {
            const progress = enter(local, pill.delay, 18);

            return (
              <div
                className="proofPill"
                key={pill.label}
                style={{
                  opacity: progress,
                  transform: `translateY(${px((1 - progress) * 18)})`,
                }}
              >
                <strong>{pill.label}</strong> {pill.text}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FieldFlowScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const customer = enter(local, 6, 24);
  const workOrder = enter(local, 22, 24);
  const checklist = enter(local, 38, 20);
  const connector = enter(local, 58, 30);
  const callout = enter(local, 110, 18);
  const statusChips = [
    { label: "Open", className: "open", delay: 82 },
    { label: "In Progress", className: "inProgress", delay: 94 },
    { label: "Completed", className: "completed", delay: 106 },
  ];

  return (
    <AbsoluteFill className="scene fieldFlowScene">
      <SceneLabel
        index="02"
        title="Field teams and office teams stay on the same record"
      />
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
      <div
        className="connectorRail"
        style={{
          left: 590,
          top: 650,
          width: 760,
        }}
      >
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
            const chipProgress = enter(local, chip.delay, 14);

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

const OperationsScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const board = enter(local, 8, 22);
  const badge = enter(local, 104, 18);
  const callout = enter(local, 128, 18);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const lanes = [
    {
      name: "Ahmet K.",
      workload: 82,
      cards: [
        { label: "CCTV install", type: "install", delay: 46 },
        { label: "Alarm service", type: "service", delay: 70 },
        { label: "Panel check", type: "maintenance", delay: 94 },
      ],
    },
    {
      name: "Mehmet D.",
      workload: 64,
      cards: [
        { label: "Access control", type: "service", delay: 54 },
        { label: "Monthly visit", type: "maintenance", delay: 78 },
      ],
    },
    {
      name: "Ali R.",
      workload: 72,
      cards: [
        { label: "Sensor install", type: "install", delay: 62 },
        { label: "Site audit", type: "maintenance", delay: 86 },
      ],
    },
  ];

  return (
    <AbsoluteFill className="scene operationsScene">
      <SceneLabel index="03" title="Plan the day before problems reach the customer" />
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
          const laneProgress = enter(local, 28 + laneIndex * 8, 18);
          const meter = enter(local, 72 + laneIndex * 7, 24);

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
                    const cardProgress = enter(local, card.delay, 16);

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

const RevenueScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const opacity = enter(local, 6);
  const kpi = enter(local, 6, 32);
  const subscriptionStack = enter(local, 24, 22);
  const collectionTable = enter(local, 44, 24);
  const overduePulse =
    local >= 68
      ? interpolate((local - 68) % 28, [0, 14, 28], [0, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        })
      : 0;
  const revision = enter(local, 92, 20);
  const mrrValue = Math.round(
    interpolate(local, [6, 52], [0, 184500], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }),
  );
  const collectionRows = [
    { customer: "Aydin Plaza", amount: "$42,000", status: "paid" },
    { customer: "North Gate Sites", amount: "$36,500", status: "pending" },
    { customer: "Atlas Residence", amount: "$28,000", status: "overdue" },
    { customer: "Marmara Logistics", amount: "$18,750", status: "paid" },
  ];
  const subscriptions = [
    { label: "Active contracts", value: "128", delay: 24 },
    { label: "Collection rate", value: "94%", delay: 32 },
    { label: "Renewals this month", value: "17", delay: 40 },
  ];
  const sparkline = [34, 46, 42, 58, 64, 78];

  return (
    <AbsoluteFill className="scene revenueScene" style={{ opacity }}>
      <SceneLabel
        index="04"
        title="Recurring revenue, collections, and revisions in one flow"
      />
      <div
        className="kpiHero"
        style={{
          opacity: kpi,
          transform: `translateY(${px((1 - kpi) * 24)}) scale(${0.96 + kpi * 0.04})`,
        }}
      >
        <strong>{formatUsd(mrrValue)}</strong>
        <span>Monthly Recurring Revenue</span>
      </div>
      <div
        style={{
          display: "grid",
          gap: 10,
          left: 190,
          position: "absolute",
          top: 465,
          width: 330,
        }}
      >
        {subscriptions.map((item, index) => {
          const progress = enter(local, item.delay, 18);

          return (
            <div
              key={item.label}
              style={{
                alignItems: "center",
                background: "rgba(255,255,255,0.74)",
                border: "1px solid rgba(28,25,23,0.1)",
                borderRadius: 12,
                boxShadow: "0 16px 42px rgba(28,25,23,0.08)",
                display: "flex",
                justifyContent: "space-between",
                opacity: progress * subscriptionStack,
                padding: "13px 16px",
                transform: `translateX(${px((1 - progress) * -22)})`,
              }}
            >
              <span
                style={{
                  color: "#78716c",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </span>
              <b
                style={{
                  color: index === 1 ? "#059669" : "#1c1917",
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  fontSize: 20,
                }}
              >
                {item.value}
              </b>
            </div>
          );
        })}
      </div>
      <div
        className="collectionTable"
        style={{
          opacity: collectionTable,
          transform: `translateX(${px((1 - collectionTable) * -56)})`,
        }}
      >
        <div className="collectionHeader">
          <span>Customer</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        {collectionRows.map((row) => {
          const isOverdue = row.status === "overdue";

          return (
            <div
              className={`collectionRow${isOverdue ? " overdueRow" : ""}`}
              key={row.customer}
              style={
                isOverdue
                  ? {
                      borderColor: `rgba(185, 28, 28, ${0.3 + overduePulse * 0.45})`,
                      boxShadow: `0 0 ${Math.round(overduePulse * 22)}px rgba(185, 28, 28, ${
                        overduePulse * 0.22
                      })`,
                    }
                  : undefined
              }
            >
              <span>{row.customer}</span>
              <span className="amount">{row.amount}</span>
              <span>
                <i className={`collectionChip ${row.status}`}>{row.status}</i>
              </span>
            </div>
          );
        })}
      </div>
      <div
        className="revisionCard"
        style={{
          opacity: revision,
          transform: `translateX(${px((1 - revision) * 42)})`,
        }}
      >
        Price revision ready: <b>$1,200 → $1,400</b>
      </div>
      <div className="revSparkline">
        {sparkline.map((height, index) => {
          const progress = enter(local, 106 + index * 4, 18);

          return (
            <i
              aria-hidden="true"
              key={`${height}-${index}`}
              style={{ height: `${height * progress}px` }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const SimIntelligenceScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const upload = spring({
    frame: Math.max(0, local - 8),
    fps: 30,
    config: { damping: 16, stiffness: 120 },
  });
  const progress = enter(local, 30, 34);
  const inventory = enter(local, 52, 22);
  const matrix = enter(local, 74, 18);
  const alerts = enter(local, 96, 16);
  const chart = enter(local, 112, 20);
  const pulse =
    local >= 96
      ? interpolate((local - 96) % 24, [0, 12, 24], [0, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        })
      : 0;
  const comparisonRows = [
    {
      line: "532 410 88 12",
      invoice: "$240",
      inventory: "$240",
      matched: true,
      delay: 74,
    },
    {
      line: "533 104 72 19",
      invoice: "$310",
      inventory: "Missing",
      matched: false,
      delay: 82,
    },
    {
      line: "537 902 44 08",
      invoice: "$190",
      inventory: "$165",
      matched: false,
      delay: 90,
    },
    {
      line: "539 118 63 44",
      invoice: "$220",
      inventory: "$220",
      matched: true,
      delay: 98,
    },
  ];
  const tariffBars = [
    { label: "M2M", height: 82, delay: 112 },
    { label: "IoT", height: 118, delay: 118 },
    { label: "Static", height: 142, delay: 124 },
    { label: "Fleet", height: 96, delay: 130 },
  ];

  return (
    <AbsoluteFill className="scene simScene">
      <SceneLabel index="05" title="SIM invoices are checked against live inventory" />
      <div
        className="uploadCard"
        style={{
          opacity: upload,
          transform: `translateY(${px((1 - upload) * -44)}) scale(${0.96 + upload * 0.04})`,
        }}
      >
        <div className="uploadIcon">📄</div>
        <strong>Turkcell Invoice.pdf</strong>
        <span>Parsing SIM lines, tariffs, and operator totals</span>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div
        style={{
          left: 160,
          opacity: inventory,
          position: "absolute",
          top: 535,
          transform: `translateY(${px((1 - inventory) * 18)})`,
        }}
      >
        <div className="statusStack">
          <span className="statusChip completed">Live inventory</span>
          <span className="statusChip inProgress">312 active SIMs</span>
          <span className="statusChip open">Operator invoice</span>
        </div>
      </div>
      <div
        className="comparisonMatrix"
        style={{
          opacity: matrix,
          transform: `translateY(${px((1 - matrix) * 24)})`,
        }}
      >
        <div className="matrixHeader">
          <span>SIM line</span>
          <span>Invoice</span>
          <span>Inventory</span>
          <span />
        </div>
        {comparisonRows.map((row) => {
          const rowProgress = enter(local, row.delay, 14);

          return (
            <div
              className="matrixRow"
              key={row.line}
              style={{
                opacity: rowProgress,
                transform: `translateX(${px((1 - rowProgress) * -14)})`,
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
      <div className="alertStack">
        <span
          className="alertChip error"
          style={{
            boxShadow: `0 0 ${Math.round(10 + pulse * 22)}px rgba(220, 38, 38, ${
              0.12 + pulse * 0.2
            })`,
            opacity: alerts,
            transform: `translateX(${px((1 - alerts) * -20)})`,
          }}
        >
          3 lines not in inventory
        </span>
        <span
          className="alertChip warning"
          style={{
            opacity: alerts,
            transform: `translateX(${px((1 - alerts) * -20)})`,
          }}
        >
          2 lines cost increase
        </span>
      </div>
      <div
        className="tariffChart"
        style={{
          opacity: chart,
          transform: `translateY(${px((1 - chart) * 22)})`,
        }}
      >
        {tariffBars.map((bar) => {
          const barProgress = enter(local, bar.delay, 18);

          return (
            <div className="tariffBar" key={bar.label}>
              <i aria-hidden="true" style={{ height: `${bar.height * barProgress}px` }} />
              <span className="barLabel">{bar.label}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const GuardrailScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const passIn = enter(local, 145, 20);

  const numbers = [
    { p: "$184,500", a: "$184.5K" },
    { p: "$42,300", a: "$42.3K" },
    { p: "$12,800", a: "$12.8K" },
    { p: "+18.4%", a: "18.4%" },
    { p: "$8,200", a: "$8.2K" },
  ];

  const counter = Math.min(
    numbers.length,
    Math.max(0, Math.floor((local - 80) / 12)),
  );

  const phase1 = local < 40;
  const phase2 = local >= 40 && local < 80;
  const phase3 = local >= 80;

  const failFlashOpacity = phase1
    ? enter(local, 0, 12) * exit(local, 30, 10)
    : 0;

  const phase1Opacity = phase1 ? 1 : 0;
  const phase2Opacity = phase2
    ? enter(local - 40, 4, 14) * exit(local - 40, 28, 12)
    : 0;
  const phase3Opacity = phase3 ? enter(local - 80, 0, 18) : 0;

  return (
    <AbsoluteFill className="scene guardrailScene">
      <SceneLabel index="06" title="Every reported number is verified before it ships" />

      {phase1 && (
        <div className="verifyList" style={{ opacity: phase1Opacity }}>
          <div className="verifyListInner">
            <div className="verifyingRow">
              <span className="pandasVal">$184,500</span>
              <span className="arrow">→</span>
              <span className="aiVal mismatch">$185.4K</span>
              <span className="check" style={{ color: "#dc2626" }}>
                ✗
              </span>
            </div>
            <div className="failFlash" style={{ opacity: failFlashOpacity }}>
              MISMATCH
            </div>
          </div>
        </div>
      )}

      {phase2 && (
        <div className="retryText" style={{ opacity: phase2Opacity }}>
          Retrying with reinforced prompt…
        </div>
      )}

      {phase3 && (
        <>
          <div className="verifyList" style={{ opacity: phase3Opacity }}>
            <div className="verifyListInner">
              {numbers.map((number, index) => {
                const revealed = index < counter;

                return (
                  <div
                    className="verifyingRow"
                    key={`${number.p}-${number.a}`}
                    style={{
                      opacity: revealed ? 1 : 0.2,
                      transform: revealed ? "translateX(0)" : "translateX(-10px)",
                      transition: "opacity 0.3s, transform 0.3s",
                    }}
                  >
                    <span className="pandasVal">{number.p}</span>
                    <span className="arrow">→</span>
                    <span className="aiVal">{number.a}</span>
                    <span className="check">{revealed ? "✓" : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="counterBadge" style={{ opacity: phase3Opacity }}>
            {counter} / 5 numbers verified ✓
          </div>

          <div
            className="passedBanner"
            style={{
              opacity: passIn,
              transform: `scale(${0.92 + passIn * 0.08})`,
            }}
          >
            <strong>Guardrail passed</strong>
            <span>Every reported number independently verified</span>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

const FinanceViewScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const opacity = enter(local, 6);
  const dashboard = enter(local, 6, 24);
  const kpiProgress = enter(local, 28, 34);
  const comparison = enter(local, 72, 18);
  const exportCue = enter(local, 92, 18);
  const profitGlow = enter(local, 100, 16);
  const incomeValue = Math.round(327400 * kpiProgress);
  const expenseValue = Math.round(189200 * kpiProgress);
  const profitValue = Math.round(138200 * kpiProgress);
  const sourceCards = [
    { icon: "↻", label: "Subscriptions", amount: "$184,500", delay: 48 },
    { icon: "§", label: "Proposals", amount: "$82,600", delay: 56 },
    { icon: "✓", label: "Work Orders", amount: "$38,700", delay: 64 },
    { icon: "SIM", label: "SIM Rental", amount: "$21,600", delay: 72 },
  ];

  return (
    <AbsoluteFill className="scene financeViewScene" style={{ opacity }}>
      <SceneLabel
        index="07"
        title="From operations to ledger-ready financial insight"
      />
      <div
        className="dashboardFrame"
        style={{
          opacity: dashboard,
          transform: `translateY(${px((1 - dashboard) * 26)}) scale(${
            0.96 + dashboard * 0.04
          })`,
        }}
      >
        <div className="dashKPIRow">
          <div className="kpiBlock">
            <strong className="income">{formatUsd(incomeValue)}</strong>
            <span>Total Income</span>
          </div>
          <div className="kpiBlock">
            <strong className="expense">{formatUsd(expenseValue)}</strong>
            <span>Total Expenses</span>
          </div>
          <div
            className="kpiBlock"
            style={{
              borderRadius: 14,
              boxShadow: `0 0 ${Math.round(profitGlow * 34)}px rgba(5, 150, 105, ${
                profitGlow * 0.28
              })`,
            }}
          >
            <strong className="profit">{formatUsd(profitValue)}</strong>
            <span>Net Profit</span>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 24,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "grid",
              gap: 14,
              gridTemplateColumns: "140px 1fr 92px",
              opacity: comparison,
            }}
          >
            <b style={{ color: "#059669", fontSize: 13 }}>Income</b>
            <div
              style={{
                background: "#d1fae5",
                borderRadius: 99,
                height: 14,
                overflow: "hidden",
              }}
            >
              <i
                aria-hidden="true"
                style={{
                  background: "linear-gradient(90deg, #059669, #34d399)",
                  borderRadius: 99,
                  display: "block",
                  height: "100%",
                  width: `${comparison * 100}%`,
                }}
              />
            </div>
            <strong className="monoLine" style={{ color: "#059669", fontSize: 15 }}>
              $327.4K
            </strong>
          </div>
          <div
            style={{
              alignItems: "center",
              display: "grid",
              gap: 14,
              gridTemplateColumns: "140px 1fr 92px",
              opacity: comparison,
            }}
          >
            <b style={{ color: "#dc2626", fontSize: 13 }}>Expenses</b>
            <div
              style={{
                background: "#fee2e2",
                borderRadius: 99,
                height: 14,
                overflow: "hidden",
              }}
            >
              <i
                aria-hidden="true"
                style={{
                  background: "linear-gradient(90deg, #dc2626, #f87171)",
                  borderRadius: 99,
                  display: "block",
                  height: "100%",
                  width: `${comparison * 58}%`,
                }}
              />
            </div>
            <strong className="monoLine" style={{ color: "#dc2626", fontSize: 15 }}>
              $189.2K
            </strong>
          </div>
        </div>
        <div className="sourceGrid">
          {sourceCards.map((source) => {
            const sourceProgress = enter(local, source.delay, 16);

            return (
              <div
                className="sourceCard"
                key={source.label}
                style={{
                  opacity: sourceProgress,
                  transform: `translateY(${px((1 - sourceProgress) * 16)})`,
                }}
              >
                <div className="sourceIcon">{source.icon}</div>
                <b>{source.label}</b>
                <strong>{source.amount}</strong>
              </div>
            );
          })}
        </div>
        <div
          className="exportCue"
          style={{
            opacity: exportCue,
            transform: `translateY(${px((1 - exportCue) * 12)})`,
          }}
        >
          ↓ Download financial report
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ClosingScene = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const wordmarkScale = spring({
    frame: Math.max(0, local - 8),
    fps: 30,
    config: { damping: 18, stiffness: 120 },
  });
  const tagline = enter(local, 26, 22);
  const glow = enter(local, 90, 26);
  const pillars = [
    {
      delay: 48,
      label: "Operations",
      text: "Field and office unified",
    },
    {
      delay: 60,
      label: "Revenue",
      text: "Subscriptions and collections",
    },
    {
      delay: 72,
      label: "Intelligence",
      text: "SIM and invoice analysis",
    },
  ];

  return (
    <AbsoluteFill className="scene closingScene">
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
        <Wordmark />
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
          const progress = enter(local, pillar.delay, 18);

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
    </AbsoluteFill>
  );
};

export const OrnetShowcase = () => {
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
        <TransitionSeries.Sequence durationInFrames={sceneDurations.intro}>
          <IntroScene />
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
        <TransitionSeries.Sequence durationInFrames={sceneDurations.revenue}>
          <RevenueScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.simIntelligence}>
          <SimIntelligenceScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-left" })}
          timing={timing}
        />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.guardrail}>
          <GuardrailScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={wipe()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.financeView}>
          <FinanceViewScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={sceneDurations.close}>
          <ClosingScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <ProgressRail />
    </AbsoluteFill>
  );
};
