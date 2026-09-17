import {
  type AutoTradeConfig,
  type PriceGrowthConfig,
  DEFAULT_TRADE_SIDE_BUY,
  DEFAULT_TRADE_SIDE_SELL,
  DEFAULT_PRICE_GROWTH_CONFIG,
  calculateTargetPrice,
} from "./auto-trade-types";

const AUTO_TRADE_STORAGE_PREFIX = "uniswap_v2_trader_auto_trade_";
const PRICE_GROWTH_STORAGE_PREFIX = "uniswap_v2_trader_price_growth_";

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
}

const memoryFallback = new MemoryStorage();

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // restricted
  }
  return memoryFallback;
}

export class StrategyStore {
  /**
   * Save Auto Trade configuration for a pair
   */
  static saveAutoTrade(config: AutoTradeConfig): void {
    const storage = getStorage();
    const key = `${AUTO_TRADE_STORAGE_PREFIX}${config.pairAddress.toLowerCase()}`;
    storage.setItem(key, JSON.stringify({ ...config, updatedAt: Date.now() }));
  }

  /**
   * Load Auto Trade configuration for a pair
   */
  static loadAutoTrade(pairAddress = "default"): AutoTradeConfig {
    const storage = getStorage();
    const key = `${AUTO_TRADE_STORAGE_PREFIX}${pairAddress.toLowerCase()}`;
    try {
      const raw = storage.getItem(key);
      if (raw) return JSON.parse(raw) as AutoTradeConfig;
    } catch {
      // fallback to default
    }

    return {
      pairAddress,
      buy: { ...DEFAULT_TRADE_SIDE_BUY },
      sell: { ...DEFAULT_TRADE_SIDE_SELL },
      updatedAt: Date.now(),
    };
  }

  /**
   * Save Price Growth configuration for a pair
   */
  static savePriceGrowth(config: PriceGrowthConfig): void {
    const storage = getStorage();
    const key = `${PRICE_GROWTH_STORAGE_PREFIX}${config.pairAddress.toLowerCase()}`;
    storage.setItem(key, JSON.stringify({ ...config, updatedAt: Date.now() }));
  }

  /**
   * Load Price Growth configuration for a pair
   */
  static loadPriceGrowth(pairAddress = "default", currentPrice = 1.0): PriceGrowthConfig {
    const storage = getStorage();
    const key = `${PRICE_GROWTH_STORAGE_PREFIX}${pairAddress.toLowerCase()}`;
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as PriceGrowthConfig;
        return parsed;
      }
    } catch {
      // fallback to default
    }

    return {
      ...DEFAULT_PRICE_GROWTH_CONFIG,
      pairAddress,
      basePrice: currentPrice,
      targetPrice: calculateTargetPrice(currentPrice, DEFAULT_PRICE_GROWTH_CONFIG.dailyGrowthPercent),
      updatedAt: Date.now(),
    };
  }
}
