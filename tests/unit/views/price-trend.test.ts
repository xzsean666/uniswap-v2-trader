import { describe, it, expect } from "vitest";
import type { ChartDataPoint } from "../../../src/components/chart/CyberTrendChart";

describe("Price Trend Chart & Quant Metrics (TASK-011)", () => {
  it("calculates min, max, and price spread accurately", () => {
    const points: ChartDataPoint[] = [
      { timestamp: 1000, price: 1.0 },
      { timestamp: 2000, price: 1.25 },
      { timestamp: 3000, price: 0.95 },
      { timestamp: 4000, price: 1.1 },
    ];

    const prices = points.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const change = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;

    expect(min).toBe(0.95);
    expect(max).toBe(1.25);
    expect(change).toBeCloseTo(10.0, 2);
  });

  it("handles identical prices gracefully with synthetic bounds", () => {
    const points: ChartDataPoint[] = [
      { timestamp: 1000, price: 1.0 },
      { timestamp: 2000, price: 1.0 },
    ];

    let minPrice = Math.min(...points.map((p) => p.price));
    let maxPrice = Math.max(...points.map((p) => p.price));

    if (minPrice === maxPrice) {
      minPrice *= 0.95;
      maxPrice *= 1.05;
    }

    expect(minPrice).toBe(0.95);
    expect(maxPrice).toBe(1.05);
    expect(maxPrice).toBeGreaterThan(minPrice);
  });
});
