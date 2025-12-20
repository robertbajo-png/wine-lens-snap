export const logError = (error: unknown, context?: string) => {
  // Placeholder for centralized logging (G2). For now, forward to console.
  console.error(`[Error]${context ? ` (${context})` : ""}:`, error);
};
