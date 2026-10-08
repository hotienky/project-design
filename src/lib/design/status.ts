/** Implementation progress an agent reports per component (stored in component_status). */
export const COMPONENT_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];
