import "server-only";

import { logger } from "@/lib/logger";
import { validateEnvOnStartup } from "@/lib/env";

/**
 * Server initialization - validate environment on startup
 * This is called from app/page.tsx to ensure env is valid before rendering
 */
export function initializeServer() {
  try {
    validateEnvOnStartup();
    logger.info("Server initialized successfully");
  } catch (error) {
    logger.error("Server initialization failed", error);
    throw error;
  }
}
