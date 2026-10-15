"use client";

import { formatIdr } from "@/lib/format";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

export function AnimatedIdr({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 120, damping: 24 });
  const display = useTransform(spring, (latest) => formatIdr(latest));

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  if (reduce) {
    return <span>{formatIdr(value)}</span>;
  }

  return <motion.span>{display}</motion.span>;
}
