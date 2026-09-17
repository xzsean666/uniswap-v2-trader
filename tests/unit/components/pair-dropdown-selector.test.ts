import { describe, it, expect } from "vitest";
import type { PairSubscription } from "../../../src/storage/subscription-store";
import { validatePairAddress } from "../../../src/services/pair/pair-reader";
import { getPresetPairs } from "../../../src/services/pair/pair-resolver";

describe("PairDropdownSelector Logic & Filter Unit Tests", () => {
  const mockSubscriptions: PairSubscription[] = [
    {
      pairAddress: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
      token0Address: "0xToken0A",
      token0Symbol: "ALPHA",
      token1Address: "0xToken1B",
      token1Symbol: "BETA",
      status: "active",
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      pairAddress: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
      token0Address: "0xToken0C",
      token0Symbol: "WBNB",
      token1Address: "0xToken1D",
      token1Symbol: "USDT",
      status: "inactive",
      createdAt: 2000,
      updatedAt: 2000,
    },
  ];

  it("filters subscriptions by token symbol query (case-insensitive)", () => {
    const query = "alpha";
    const filtered = mockSubscriptions.filter((sub) => {
      const s0 = sub.token0Symbol.toLowerCase();
      const s1 = sub.token1Symbol.toLowerCase();
      const combined = `${s0}/${s1}`;
      const addr = sub.pairAddress.toLowerCase();
      const q = query.toLowerCase();
      return (
        s0.includes(q) ||
        s1.includes(q) ||
        combined.includes(q) ||
        addr.includes(q)
      );
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].token0Symbol).toBe("ALPHA");
  });

  it("filters subscriptions by LP pair contract address prefix", () => {
    const query = "0x6725";
    const filtered = mockSubscriptions.filter((sub) => {
      const addr = sub.pairAddress.toLowerCase();
      return addr.includes(query.toLowerCase());
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0].pairAddress).toBe("0x6725F303b657a9451d8BA641348b6761A6CC7a17");
  });

  it("identifies unadded preset pairs that match search query", () => {
    const presets = getPresetPairs(56);
    const query = "Cake";
    const matching = presets.filter((p) => {
      const alreadyInSubs = mockSubscriptions.some(
        (s) => s.pairAddress.toLowerCase() === p.pairAddress.toLowerCase()
      );
      if (alreadyInSubs) return false;
      const s0 = p.token0Symbol.toLowerCase();
      const s1 = p.token1Symbol.toLowerCase();
      const label = p.label.toLowerCase();
      const q = query.toLowerCase();
      return s0.includes(q) || s1.includes(q) || label.includes(q);
    });

    expect(matching.length).toBeGreaterThan(0);
    expect(matching.some((m) => m.token0Symbol === "CAKE" || m.token1Symbol === "CAKE")).toBe(true);
  });

  it("detects new valid 40-hex LP address entered directly in search input", () => {
    const newLpInput = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    const validation = validatePairAddress(newLpInput);
    expect(validation.valid).toBe(true);
    expect(validation.checksummed).toBeDefined();

    const exists = mockSubscriptions.some(
      (s) => s.pairAddress.toLowerCase() === validation.checksummed?.toLowerCase()
    );
    expect(exists).toBe(false);
  });
});
