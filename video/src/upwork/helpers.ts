import { Easing, interpolate } from "remotion";
import { springTiming } from "@remotion/transitions";

export const enter = (frame: number, from: number, duration = 24) =>
  interpolate(frame, [from, from + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

export const exit = (frame: number, from: number, duration = 24) =>
  interpolate(frame, [from, from + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

export const px = (value: number) => `${value}px`;

export const formatUsd = (value: number) =>
  `$${value.toLocaleString("en-US")}`;

export const timing = springTiming({ config: { damping: 120 } });
