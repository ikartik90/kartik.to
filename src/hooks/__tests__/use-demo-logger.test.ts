// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DemoLoggerProvider,
  formatLoggerArg,
  formatLoggerArgs,
  formatLoggerJson,
  useDemoLogger,
  useDemoLoggerEntries,
} from "../use-demo-logger";

describe("formatLoggerArg", () => {
  it("returns strings unchanged", () => {
    expect(formatLoggerArg("hello")).toBe("hello");
  });

  it("serializes objects as indented JSON", () => {
    expect(formatLoggerArg({ status: "valid" })).toBe(
      '{\n  "status": "valid"\n}',
    );
  });
});

describe("formatLoggerJson", () => {
  it("pretty-prints objects with two-space indentation", () => {
    expect(formatLoggerJson({ kind: "single", date: "2026-06-29" })).toBe(
      '{\n  "kind": "single",\n  "date": "2026-06-29"\n}',
    );
  });
});

describe("formatLoggerArgs", () => {
  it("joins formatted args with spaces", () => {
    expect(formatLoggerArgs(["a", { b: 1 }])).toBe('a {\n  "b": 1\n}');
  });
});

describe("useDemoLogger", () => {
  it("no-ops outside a provider", () => {
    const { result } = renderHook(() => useDemoLogger());

    expect(() => {
      result.current.log("hello");
      result.current.warn("warn");
      result.current.error("error");
    }).not.toThrow();
  });

  it("appends entries through the provider", () => {
    const { result } = renderHook(
      () => ({
        logger: useDemoLogger(),
        entries: useDemoLoggerEntries(),
      }),
      { wrapper: DemoLoggerProvider },
    );

    act(() => {
      result.current.logger.log("parsed value");
      result.current.logger.error("parse failed");
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]).toMatchObject({
      level: "log",
      message: "parsed value",
    });
    expect(result.current.entries[1]).toMatchObject({
      level: "error",
      message: "parse failed",
    });
  });

  it("updates the status line in place", () => {
    const { result } = renderHook(
      () => ({
        logger: useDemoLogger(),
        entries: useDemoLoggerEntries(),
      }),
      { wrapper: DemoLoggerProvider },
    );

    act(() => {
      result.current.logger.setStatus("error", "Could not parse input");
      result.current.logger.setStatus("log", '{"kind":"single","date":"2026-06-29"}');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toMatchObject({
      key: "status",
      level: "log",
      message: '{"kind":"single","date":"2026-06-29"}',
    });
  });

  it("clears the status line", () => {
    const { result } = renderHook(
      () => ({
        logger: useDemoLogger(),
        entries: useDemoLoggerEntries(),
      }),
      { wrapper: DemoLoggerProvider },
    );

    act(() => {
      result.current.logger.setStatus("error", "Could not parse input");
      result.current.logger.clearStatus();
    });

    expect(result.current.entries).toHaveLength(0);
  });
});
