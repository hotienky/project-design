"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Children, isValidElement } from "react";

/** The projects grid: cards rise in one after another and fade out when deleted. */
export function MotionGrid({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial mode="popLayout">
          {Children.map(children, (child, i) =>
            isValidElement(child) ? (
              <motion.li
                key={child.key ?? i}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 24,
                  delay: Math.min(i, 8) * 0.05,
                }}
                whileHover={{ y: -3 }}
              >
                {child}
              </motion.li>
            ) : null,
          )}
        </AnimatePresence>
      </ul>
    </MotionConfig>
  );
}
