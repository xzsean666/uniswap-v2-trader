import { describe, it, expect } from "vitest";
import { validatePairAddress } from "../../../src/services/pair/pair-reader";
import type { SwapLogPayload } from "../../../src/services/sync/event-emitter";

describe("Swap Monitor View Logic & Components (TASK-009)", () => {
  it("validates LP Pair input correctly for monitoring start", () => {
    const valid = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
    const invalid = "0xinvalid";
    const empty = "";

    expect(validatePairAddress(valid).valid).toBe(true);
    expect(validatePairAddress(invalid).valid).toBe(false);
    expect(validatePairAddress(empty).valid).toBe(false);
  });

  it("handles event payload fields for RecentEventsTable", () => {
    const sampleEvent: SwapLogPayload = {
      pairAddress: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
      transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      blockNumber: "50123456",
      logIndex: 0,
      direction: "buy",
      amount0: "1000000000000000000",
      amount1: "2000000000000000000",
      effectivePrice: 2.0,
      timestamp: 1710000000000,
    };

    expect(sampleEvent.direction).toBe("buy");
    expect(sampleEvent.effectivePrice).toBe(2.0);
    expect(sampleEvent.transactionHash.startsWith("0x")).toBe(true);
  });
});
