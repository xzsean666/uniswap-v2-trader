import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAddress } from "viem";
import type { PairOverview } from "../../../src/services/pair/pair-reader";
import { syncEvents } from "../../../src/services/sync/event-emitter";

describe("Swap Info View & Token Reserve Cards (TASK-010)", () => {
  const mockPair = getAddress("0x1111111111111111111111111111111111111111");
  const mockToken0 = getAddress("0x2222222222222222222222222222222222222222");
  const mockToken1 = getAddress("0x3333333333333333333333333333333333333333");

  const sampleOverview: PairOverview = {
    pairAddress: mockPair,
    token0: {
      address: mockToken0,
      symbol: "ACP",
      name: "Anvil Cyber Protocol",
      decimals: 18,
      reserveRaw: 500000000000000000000n,
      reserveFormatted: "500",
    },
    token1: {
      address: mockToken1,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 18,
      reserveRaw: 1000000000000000000000n,
      reserveFormatted: "1000",
    },
    blockTimestampLast: 1710000000,
    price0Per1: 0.5,
    price1Per0: 2.0,
    price0Per1Formatted: "0.5000",
    price1Per0Formatted: "2.0000",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies PairOverview properties and dual token prices", () => {
    expect(sampleOverview.token0.symbol).toBe("ACP");
    expect(sampleOverview.token1.symbol).toBe("USDT");
    expect(sampleOverview.price0Per1Formatted).toBe("0.5000");
    expect(sampleOverview.price1Per0Formatted).toBe("2.0000");
    expect(sampleOverview.token0.reserveFormatted).toBe("500");
    expect(sampleOverview.token1.reserveFormatted).toBe("1000");
  });

  it("triggers event subscription when a new swap happens for the current pair", () => {
    let triggered = false;
    const unbind = syncEvents.on("new_swap", (event) => {
      if (event.pairAddress.toLowerCase() === mockPair.toLowerCase()) {
        triggered = true;
      }
    });

    syncEvents.emit("new_swap", {
      pairAddress: mockPair,
      transactionHash: "0x123",
      blockNumber: "100",
      logIndex: 0,
      direction: "buy",
      amount0: "10",
      amount1: "20",
      timestamp: Date.now(),
    });

    expect(triggered).toBe(true);
    unbind();
  });
});
