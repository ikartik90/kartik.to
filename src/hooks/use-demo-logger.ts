"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type DemoLoggerLevel = "log" | "info" | "warn" | "error";

export interface DemoLoggerEntry {
  id: string;
  key?: string;
  level: DemoLoggerLevel;
  message: string;
  timestamp: number;
}

export const DEMO_LOGGER_STATUS_KEY = "status";

interface DemoLoggerContextValue {
  entries: DemoLoggerEntry[];
  append: (level: DemoLoggerLevel, args: unknown[]) => void;
  upsert: (key: string, level: DemoLoggerLevel, args: unknown[]) => void;
  remove: (key: string) => void;
}

const DemoLoggerContext = createContext<DemoLoggerContextValue | null>(null);

export function formatLoggerJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatLoggerArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  return formatLoggerJson(arg);
}

export function formatLoggerArgs(args: unknown[]): string {
  return args.map(formatLoggerArg).join(" ");
}

export function DemoLoggerProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<DemoLoggerEntry[]>([]);
  const idRef = useRef(0);

  const append = useCallback((level: DemoLoggerLevel, args: unknown[]) => {
    setEntries((previous) => [
      ...previous,
      {
        id: String(++idRef.current),
        level,
        message: formatLoggerArgs(args),
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const upsert = useCallback(
    (key: string, level: DemoLoggerLevel, args: unknown[]) => {
      const message = formatLoggerArgs(args);

      setEntries((previous) => {
        const existingIndex = previous.findIndex((entry) => entry.key === key);

        if (existingIndex >= 0) {
          const next = [...previous];
          next[existingIndex] = {
            ...next[existingIndex],
            level,
            message,
            timestamp: Date.now(),
          };
          return next;
        }

        return [
          ...previous,
          {
            id: key,
            key,
            level,
            message,
            timestamp: Date.now(),
          },
        ];
      });
    },
    [],
  );

  const remove = useCallback((key: string) => {
    setEntries((previous) => previous.filter((entry) => entry.key !== key));
  }, []);

  const value = useMemo(
    () => ({ entries, append, upsert, remove }),
    [entries, append, upsert, remove],
  );

  return createElement(DemoLoggerContext.Provider, { value }, children);
}

export function useDemoLoggerEntries(): DemoLoggerEntry[] {
  return useContext(DemoLoggerContext)?.entries ?? [];
}

export function useDemoLogger() {
  const context = useContext(DemoLoggerContext);
  // Mirror the latest context callbacks into refs so the memoized log helpers
  // below stay referentially stable (empty deps) while always calling through
  // to the current provider. Synced in an effect — writing refs during render
  // is unsafe (react-hooks/refs).
  const appendRef = useRef(context?.append);
  const upsertRef = useRef(context?.upsert);
  const removeRef = useRef(context?.remove);
  useEffect(() => {
    appendRef.current = context?.append;
    upsertRef.current = context?.upsert;
    removeRef.current = context?.remove;
  });

  const log = useCallback((...args: unknown[]) => {
    appendRef.current?.("log", args);
  }, []);

  const info = useCallback((...args: unknown[]) => {
    appendRef.current?.("info", args);
  }, []);

  const warn = useCallback((...args: unknown[]) => {
    appendRef.current?.("warn", args);
  }, []);

  const error = useCallback((...args: unknown[]) => {
    appendRef.current?.("error", args);
  }, []);

  const setStatus = useCallback((level: DemoLoggerLevel, ...args: unknown[]) => {
    upsertRef.current?.(DEMO_LOGGER_STATUS_KEY, level, args);
  }, []);

  const clearStatus = useCallback(() => {
    removeRef.current?.(DEMO_LOGGER_STATUS_KEY);
  }, []);

  return useMemo(
    () => ({ log, info, warn, error, setStatus, clearStatus }),
    [log, info, warn, error, setStatus, clearStatus],
  );
}
