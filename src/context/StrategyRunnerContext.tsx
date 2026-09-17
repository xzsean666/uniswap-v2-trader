import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { type Address } from "viem";
import { useActivePair } from "./ActivePairContext";
import { useKeeper } from "./KeeperContext";
import { useWallet } from "../hooks/useWallet";
import { useNotification } from "../components/notification/NotificationContext";
import { StrategyStore } from "../strategies/strategy-store";
import type {
  AutoTradeConfig,
  AutoTradeExecutionRecord,
} from "../strategies/auto-trade-types";
import {
  evaluateAndExecuteAutoTrade,
  type RunnerExecutionOutcome,
} from "../strategies/strategy-runner";
import { syncEvents } from "../services/sync/event-emitter";

export type RunnerStatus =
  | "idle"
  | "monitoring"
  | "cooldown"
  | "executing"
  | "warning";

export interface StrategyRunnerContextState {
  status: RunnerStatus;
  statusMessage: string;
  isAutoActive: boolean;
  basePrice: number | null;
  cooldownRemaining: number;
  recentExecutions: AutoTradeExecutionRecord[];
  applyAndActivateStrategy: (config: AutoTradeConfig, currentPrice: number) => void;
  stopStrategy: () => void;
  updateBasePrice: (price: number) => void;
  recordExecution: (record: AutoTradeExecutionRecord) => void;
}

const StrategyRunnerContext = createContext<StrategyRunnerContextState | null>(null);

export const StrategyRunnerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { activePair } = useActivePair();
  const { keeper, isSilentEnabled, isBoundToCurrentProxy, proxyAddress, refreshBalance } = useKeeper();
  const { address, isConnected, isBscTestnet, chainId } = useWallet();
  const { showNotification } = useNotification();

  const [status, setStatus] = useState<RunnerStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("策略未启动，请在面板设置并应用");
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [recentExecutions, setRecentExecutions] = useState<AutoTradeExecutionRecord[]>([]);

  // Refs for tracking mutable states inside asynchronous event callbacks
  const activePairAddress = activePair?.pairAddress;
  const configRef = useRef<AutoTradeConfig | null>(null);
  const isInFlightRef = useRef(false);
  const inFlightStartRef = useRef(0);
  const lastExecutedAtRef = useRef(0);

  // Load config and execution records on pair change
  useEffect(() => {
    if (activePairAddress) {
      const loaded = StrategyStore.loadAutoTrade(activePairAddress);
      configRef.current = loaded;
      if (loaded.basePrice && loaded.basePrice > 0) {
        setBasePrice(loaded.basePrice);
      } else if (activePair?.price1Per0) {
        setBasePrice(activePair.price1Per0);
      }
      const execs = StrategyStore.loadExecutions(activePairAddress);
      setRecentExecutions(execs);
    }
  }, [activePairAddress, activePair?.price1Per0]);

  const recordExecution = useCallback(
    (record: AutoTradeExecutionRecord) => {
      setRecentExecutions((prev) => {
        const updated = [record, ...prev.filter((r) => r.id !== record.id)].slice(0, 30);
        if (activePairAddress) {
          StrategyStore.saveExecutions(activePairAddress, updated);
        }
        return updated;
      });
    },
    [activePairAddress]
  );

  // Check if either buy or sell auto strategy is active
  const isAutoActive = Boolean(
    configRef.current &&
      ((configRef.current.buy.active && configRef.current.buy.auto) ||
        (configRef.current.sell.active && configRef.current.sell.auto))
  );

  // Periodic cooldown countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const cooldownSec = configRef.current?.cooldownSeconds ?? 30;
      const elapsed = (Date.now() - lastExecutedAtRef.current) / 1000;
      if (lastExecutedAtRef.current > 0 && elapsed < cooldownSec) {
        const rem = Math.ceil(cooldownSec - elapsed);
        setCooldownRemaining(rem);
        if (status !== "executing") {
          setStatus("cooldown");
          setStatusMessage(`交易冷却中，剩余 ${rem} 秒...`);
        }
      } else {
        setCooldownRemaining(0);
        if (isAutoActive) {
          setStatus("monitoring");
          setStatusMessage("AI 自动化策略监控中，等待价格波动达成触发阈值...");
        } else {
          setStatus("idle");
          setStatusMessage("策略未启动，请在面板设置并点击应用");
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoActive, status]);

  // Main evaluation and execution handler
  const handleMarketTick = useCallback(
    async (currentPrice: number) => {
      if (!configRef.current || !activePair) return;
      const currentConfig = configRef.current;

      const hasAutoSide =
        (currentConfig.buy.active && currentConfig.buy.auto) ||
        (currentConfig.sell.active && currentConfig.sell.auto);

      if (!hasAutoSide) {
        return;
      }

      if (!isConnected || !address || !isBscTestnet) {
        setStatus("warning");
        setStatusMessage("请连接主钱包并切换至 BSC 测试网以启用自动交易");
        return;
      }

      if (!keeper || !isSilentEnabled || !isBoundToCurrentProxy) {
        setStatus("warning");
        setStatusMessage("打工小号 (Keeper) 未激活、未绑定代理合约或未开启静默交易");
        return;
      }

      if (isInFlightRef.current) {
        // Watchdog: If in-flight for more than 60 seconds, auto-release to prevent deadlock
        if (Date.now() - inFlightStartRef.current > 60000) {
          console.warn("[Watchdog] In-flight execution lock exceeded 60s, auto-releasing lock.");
          isInFlightRef.current = false;
        } else {
          return;
        }
      }

      const cooldownSec = currentConfig.cooldownSeconds ?? 30;
      if (
        lastExecutedAtRef.current > 0 &&
        Date.now() - lastExecutedAtRef.current < cooldownSec * 1000
      ) {
        return;
      }

      const effectiveBasePrice = basePrice && basePrice > 0 ? basePrice : currentPrice;

      try {
        isInFlightRef.current = true;
        inFlightStartRef.current = Date.now();
        setStatus("executing");
        setStatusMessage("价格波动达成！Keeper 正在免弹窗静默广播交易...");

        const outcome: RunnerExecutionOutcome = await evaluateAndExecuteAutoTrade({
          config: { ...currentConfig, basePrice: effectiveBasePrice },
          currentPrice,
          token0Address: activePair.token0.address,
          token1Address: activePair.token1.address,
          token0Decimals: activePair.token0.decimals,
          token1Decimals: activePair.token1.decimals,
          masterAddress: address as Address,
          proxyAddress,
          keeper,
          isSilentEnabled,
          isBoundToProxy: isBoundToCurrentProxy,
          chainId: chainId ?? 97,
          lastExecutedAt: lastExecutedAtRef.current,
          isInFlight: false,
        });

        if (outcome.executed && outcome.record) {
          lastExecutedAtRef.current = Date.now();
          setRecentExecutions((prev) => [outcome.record!, ...prev.slice(0, 19)]);
          refreshBalance();

          if (outcome.newBasePrice) {
            setBasePrice(outcome.newBasePrice);
            const updatedConfig: AutoTradeConfig = {
              ...currentConfig,
              basePrice: outcome.newBasePrice,
            };
            configRef.current = updatedConfig;
            StrategyStore.saveAutoTrade(updatedConfig);
          }

          showNotification({
            status: "success",
            title: `AI 全自动量化交易已执行 (${outcome.side === "buy" ? "反向买入" : "反向卖出"})`,
            message: `数量: ${outcome.amount} | 原因: ${outcome.record.reason} | 基准价已平移至 ${outcome.newBasePrice?.toFixed(4)}`,
            txHash: outcome.record.txHash,
          });

          setStatus("cooldown");
          setStatusMessage(`交易已成交！进入 ${cooldownSec} 秒防连环冷却期`);
        } else if (outcome.triggered && !outcome.executed) {
          // Trigger condition met but rejected by guard (e.g. allowance / price floor)
          setStatus("warning");
          setStatusMessage(outcome.reason || "触发被风控拦截");
          showNotification({
            status: "failed",
            title: "全自动交易拦截",
            message: outcome.reason || "风控保护生效，未执行交易",
          });
        }
      } catch (err: any) {
        setStatus("warning");
        setStatusMessage(`自动交易执行异常: ${err?.message || "未知错误"}`);
      } finally {
        isInFlightRef.current = false;
        inFlightStartRef.current = 0;
      }
    },
    [
      activePair,
      isConnected,
      address,
      isBscTestnet,
      keeper,
      isSilentEnabled,
      isBoundToCurrentProxy,
      proxyAddress,
      chainId,
      basePrice,
      refreshBalance,
      showNotification,
    ]
  );

  // Subscribe to real-time new_swap events
  useEffect(() => {
    const unbind = syncEvents.on("new_swap", (payload) => {
      if (
        activePairAddress &&
        payload.pairAddress.toLowerCase() === activePairAddress.toLowerCase()
      ) {
        if (payload.effectivePrice && payload.effectivePrice > 0) {
          handleMarketTick(payload.effectivePrice);
        }
      }
    });

    return () => {
      unbind();
    };
  }, [activePairAddress, handleMarketTick]);

  // Activate and apply strategy
  const applyAndActivateStrategy = useCallback(
    (newConfig: AutoTradeConfig, currentPrice: number) => {
      const nextBasePrice = currentPrice > 0 ? currentPrice : newConfig.basePrice || 1.0;
      const updated: AutoTradeConfig = {
        ...newConfig,
        basePrice: nextBasePrice,
      };

      configRef.current = updated;
      StrategyStore.saveAutoTrade(updated);
      setBasePrice(nextBasePrice);

      const hasAuto =
        (updated.buy.active && updated.buy.auto) ||
        (updated.sell.active && updated.sell.auto);

      if (hasAuto) {
        setStatus("monitoring");
        setStatusMessage(
          `策略已激活！基准锚定价格: ${nextBasePrice.toFixed(4)}，正在实时监控价格波动...`
        );
      } else {
        setStatus("idle");
        setStatusMessage("策略已保存，未开启自动交易开关");
      }
    },
    []
  );

  const stopStrategy = useCallback(() => {
    if (!configRef.current) return;
    const stopped: AutoTradeConfig = {
      ...configRef.current,
      buy: { ...configRef.current.buy, active: false },
      sell: { ...configRef.current.sell, active: false },
    };
    configRef.current = stopped;
    StrategyStore.saveAutoTrade(stopped);
    setStatus("idle");
    setStatusMessage("自动交易已停止");
  }, []);

  const updateBasePrice = useCallback(
    (newPrice: number) => {
      if (newPrice <= 0) return;
      setBasePrice(newPrice);
      if (configRef.current) {
        const updated = { ...configRef.current, basePrice: newPrice };
        configRef.current = updated;
        StrategyStore.saveAutoTrade(updated);
      }
    },
    []
  );

  return (
    <StrategyRunnerContext.Provider
      value={{
        status,
        statusMessage,
        isAutoActive,
        basePrice,
        cooldownRemaining,
        recentExecutions,
        recordExecution,
        applyAndActivateStrategy,
        stopStrategy,
        updateBasePrice,
      }}
    >
      {children}
    </StrategyRunnerContext.Provider>
  );
};

export const useStrategyRunner = (): StrategyRunnerContextState => {
  const context = useContext(StrategyRunnerContext);
  if (!context) {
    throw new Error("useStrategyRunner must be used within a StrategyRunnerProvider");
  }
  return context;
};
