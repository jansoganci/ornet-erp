/** Locked storyboard — OrnetUpwork composition (max 45s @ 30fps) */
export const SCENE_HEADLINES = {
  hook: {
    problem: "Security companies run on chaos.",
    promise: "One ERP: field → finance.",
  },
  fieldFlow: "Field teams and office teams stay on the same record",
  operations: "Plan the day before problems reach the customer",
  revenueSim: "Recurring revenue and SIM costs in one flow",
  ledger: "Paid subscriptions flow straight into the finance ledger",
  close: "Full-stack SaaS · React · Supabase",
} as const;

export const STACK_BADGES = [
  "React 19",
  "Supabase",
  "TypeScript",
  "Remotion",
] as const;

export const sceneDurations = {
  hook: 195,
  fieldFlow: 225,
  operations: 225,
  revenueSim: 330,
  ledger: 225,
  close: 210,
} as const;

export const TRANSITION_FRAMES = 18;

export const TOTAL_FRAMES =
  Object.values(sceneDurations).reduce((total, duration) => total + duration, 0) -
  (Object.keys(sceneDurations).length - 1) * TRANSITION_FRAMES;

export const MAX_FRAMES = 1350;
