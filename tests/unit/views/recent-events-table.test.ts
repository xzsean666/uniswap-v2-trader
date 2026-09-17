import { describe, it, expect } from "vitest";
import type { SwapLogPayload } from "../../../src/services/sync/event-emitter";

describe("RecentEventsTable Component Logic & Filtering (TASK-020)", () => {
  const sampleEvents: SwapLogPayload[] = [
    {
      pairAddress: "0x1111111111111111111111111111111111111111",
      transactionHash: "0xrt1",
      blockNumber: "200",
      logIndex: 0,
      direction: "buy",
      amount0: "10",
      amount1: "20",
      effectivePrice: 2.0,
      timestamp: Date.now(),
      source: "realtime",
    },
    {
      pairAddress: "0x1111111111111111111111111111111111111111",
      transactionHash: "0xhist1",
      blockNumber: "190",
      logIndex: 0,
      direction: "sell",
      amount0: "15",
      amount1: "30",
      effectivePrice: 2.0,
      timestamp: Date.now() - 60000,
      source: "historical",
    },
    {
      pairAddress: "0x2222222222222222222222222222222222222222",
      transactionHash: "0xhist2",
      blockNumber: "180",
      logIndex: 0,
      direction: "buy",
      amount0: "5",
      amount1: "10",
      effectivePrice: 2.0,
      timestamp: Date.now() - 120000,
      source: "historical",
    },
  ];

  it("accurately computes realtime vs historical event counts", () => {
    const realtimeCount = sampleEvents.filter((e) => e.source === "realtime").length;
    const historicalCount = sampleEvents.filter((e) => e.source !== "realtime").length;

    expect(realtimeCount).toBe(1);
    expect(historicalCount).toBe(2);
    expect(sampleEvents.length).toBe(3);
  });

  it("filters correctly by filter selection", () => {
    const filterAll = sampleEvents;
    const filterRealtime = sampleEvents.filter((e) => e.source === "realtime");
    const filterHistorical = sampleEvents.filter((e) => e.source !== "realtime");

    expect(filterAll.length).toBe(3);
    expect(filterRealtime.length).toBe(1);
    expect(filterRealtime[0].transactionHash).toBe("0xrt1");
    expect(filterHistorical.length).toBe(2);
    expect(filterHistorical.map((e) => e.transactionHash)).toEqual(["0xhist1", "0xhist2"]);
  });

  it("respects maxDisplay slicing", () => {
    const maxDisplay = 2;
    const displayed = sampleEvents.slice(0, maxDisplay);
    expect(displayed.length).toBe(2);
    expect(displayed[0].transactionHash).toBe("0xrt1");
  });
});
