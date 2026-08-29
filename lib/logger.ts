import { getEnv } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Centralized logging utility
 * Respects LOG_LEVEL env var
 * Structured output for better debugging
 */
class Logger {
  private minLevel: LogLevel = "info";

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    try {
      const env = getEnv();
      this.minLevel = (env.LOG_LEVEL ?? "info") as LogLevel;
    } catch {
      // If env validation fails, use default
      this.minLevel = "info";
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private format(entry: LogEntry): string {
    const { level, timestamp, message, context } = entry;
    const prefix = `[${timestamp}] ${level.toUpperCase()}`;
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `${prefix}: ${message}${contextStr}`;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      const entry: LogEntry = {
        level: "debug",
        timestamp: new Date().toISOString(),
        message,
        context,
      };
      console.debug(this.format(entry));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      const entry: LogEntry = {
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        context,
      };
      console.log(this.format(entry));
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      const entry: LogEntry = {
        level: "warn",
        timestamp: new Date().toISOString(),
        message,
        context,
      };
      console.warn(this.format(entry));
    }
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      const entry: LogEntry = {
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        context: {
          ...context,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
      console.error(this.format(entry));
    }
  }
}

export const logger = new Logger();
