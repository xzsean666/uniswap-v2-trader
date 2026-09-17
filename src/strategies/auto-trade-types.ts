export interface TradeSideConfig {
  active: boolean;
  auto: boolean;
  slippage: boolean;
  antiSandwich: boolean;
  antiHoneypot: boolean;
  maxAmount: number;
  minAmount: number;
  priceFloor: number;
  dropThreshold: number;
  dropActive: boolean;
  riseThreshold: number;
  riseActive: boolean;
  taxRate: number;
  taxActive: boolean;
}

export interface AutoTradeConfig {
  pairAddress: string;
  buy: TradeSideConfig;
  sell: TradeSideConfig;
  updatedAt: number;
}

export interface PriceGrowthConfig {
  pairAddress: string;
  active: boolean;
  dailyGrowthPercent: number; // e.g. 5%
  durationHours: number; // e.g. 12 hours
  intervalMinutes: number; // e.g. 30 minutes
  basePrice: number;
  targetPrice: number;
  autoResetDaily: boolean;
  updatedAt: number;
}

export const DEFAULT_TRADE_SIDE_BUY: TradeSideConfig = {
  active: false,
  auto: true,
  slippage: true,
  antiSandwich: true,
  antiHoneypot: true,
  maxAmount: 100,
  minAmount: 50,
  priceFloor: 0.5888,
  dropThreshold: 5,
  dropActive: true,
  riseThreshold: 3,
  riseActive: false,
  taxRate: 1.5,
  taxActive: true,
};

export const DEFAULT_TRADE_SIDE_SELL: TradeSideConfig = {
  active: false,
  auto: true,
  slippage: true,
  antiSandwich: true,
  antiHoneypot: true,
  maxAmount: 80,
  minAmount: 30,
  priceFloor: 0.5888,
  dropThreshold: 7,
  dropActive: false,
  riseThreshold: 5,
  riseActive: true,
  taxRate: 1.5,
  taxActive: false,
};

export const DEFAULT_PRICE_GROWTH_CONFIG: PriceGrowthConfig = {
  pairAddress: "",
  active: false,
  dailyGrowthPercent: 5.0,
  durationHours: 12,
  intervalMinutes: 30,
  basePrice: 1.0,
  targetPrice: 1.05,
  autoResetDaily: true,
  updatedAt: Date.now(),
};

/**
 * Calculate target price based on base price and daily percentage target
 */
export function calculateTargetPrice(basePrice: number, growthPercent: number): number {
  if (basePrice <= 0) return 0;
  return Number((basePrice * (1 + growthPercent / 100)).toFixed(6));
}
