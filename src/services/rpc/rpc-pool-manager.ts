/**
 * High-Availability RPC Node Pool Manager & Dynamic User RPC Injection Service
 *
 * Provides:
 * 1. Multi-cluster built-in reliable RPC endpoints (BSC Testnet, BSC Mainnet, Localhost)
 * 2. Persistent user custom RPC configuration (localStorage)
 * 3. Live latency testing (ping / block height check / chainId validation)
 * 4. Active failover pool calculation & SDK injection synchronization
 */

export type RpcNodeType = "archive" | "standard";

export interface RpcEndpointItem {
  url: string;
  label?: string;
  chainId: number;
  nodeType: RpcNodeType;
  enabled: boolean;
  isCustom: boolean;
  latencyMs?: number;
  blockNumber?: bigint;
  lastChecked?: number;
  error?: string;
}

// BSC Testnet Archive RPCs (Verified for 28,800+ blocks lookback)
export const DEFAULT_BSC_TESTNET_ARCHIVE_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bsc-testnet.drpc.org",
] as const;

// BSC Testnet Standard / Full RPCs (For realtime blocks, multicall, and transactions)
export const DEFAULT_BSC_TESTNET_STANDARD_RPCS = [
  "https://bsc-testnet-dataseed.bnbchain.org",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://data-seed-prebsc-1-s2.binance.org:8545",
  "https://data-seed-prebsc-2-s2.binance.org:8545",
] as const;

export const DEFAULT_BSC_TESTNET_RPCS = [
  "https://bsc-testnet-dataseed.bnbchain.org",
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bsc-testnet.drpc.org",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://data-seed-prebsc-1-s2.binance.org:8545",
  "https://data-seed-prebsc-2-s2.binance.org:8545",
] as const;

// BSC Mainnet Archive RPCs
export const DEFAULT_BSC_MAINNET_ARCHIVE_RPCS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc.drpc.org",
] as const;

// BSC Mainnet Standard / Full RPCs
export const DEFAULT_BSC_MAINNET_STANDARD_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://binance.llamarpc.com",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://rpc.ankr.com/bsc",
] as const;

export const DEFAULT_BSC_MAINNET_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-rpc.publicnode.com",
  "https://binance.llamarpc.com",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc.drpc.org",
  "https://rpc.ankr.com/bsc",
] as const;

export const DEFAULT_LOCALHOST_ARCHIVE_RPCS = [
  "http://127.0.0.1:8545",
] as const;

export const DEFAULT_LOCALHOST_STANDARD_RPCS = [
  "http://127.0.0.1:8545",
] as const;

export const DEFAULT_LOCALHOST_RPCS = [
  "http://127.0.0.1:8545",
] as const;

/**
 * Determine if a given RPC endpoint is an archive node by domain/url signature
 */
export function isArchiveRpcUrl(url: string): boolean {
  const norm = url.toLowerCase();
  return (
    norm.includes("publicnode.com") ||
    norm.includes("drpc.org") ||
    norm.includes("archive") ||
    norm.includes("127.0.0.1") ||
    norm.includes("localhost")
  );
}

const STORAGE_KEY_CUSTOM_RPCS = "uniswap_v2_trader_custom_rpcs_v1";
const STORAGE_KEY_DISABLED_RPCS = "uniswap_v2_trader_disabled_rpcs_v1";

type PoolChangeListener = (chainId: number, urls: string[]) => void;

class RpcPoolManagerClass {
  private customEndpoints: Map<string, RpcEndpointItem> = new Map();
  private disabledUrls: Set<string> = new Set();
  private latencyCache: Map<string, { latencyMs: number; blockNumber?: bigint; lastChecked: number; error?: string }> = new Map();
  private listeners: Set<PoolChangeListener> = new Set();
  private initialized = false;

  constructor() {
    this.initFromStorage();
  }

  private initFromStorage(): void {
    if (this.initialized) return;
    if (typeof window === "undefined" || !window.localStorage) {
      this.initialized = true;
      return;
    }

    try {
      const storedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM_RPCS);
      if (storedCustom) {
        const parsed: RpcEndpointItem[] = JSON.parse(storedCustom);
        for (const item of parsed) {
          if (item && item.url) {
            this.customEndpoints.set(this.normalizeUrl(item.url), {
              ...item,
              url: this.normalizeUrl(item.url),
              isCustom: true,
            });
          }
        }
      }

      const storedDisabled = localStorage.getItem(STORAGE_KEY_DISABLED_RPCS);
      if (storedDisabled) {
        const parsedDisabled: string[] = JSON.parse(storedDisabled);
        for (const url of parsedDisabled) {
          this.disabledUrls.add(this.normalizeUrl(url));
        }
      }
    } catch (err) {
      console.warn("Failed to load custom RPC pool from storage:", err);
    } finally {
      this.initialized = true;
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const customList = Array.from(this.customEndpoints.values());
      localStorage.setItem(STORAGE_KEY_CUSTOM_RPCS, JSON.stringify(customList));
      localStorage.setItem(STORAGE_KEY_DISABLED_RPCS, JSON.stringify(Array.from(this.disabledUrls)));
    } catch (err) {
      console.warn("Failed to save RPC settings to storage:", err);
    }
  }

  public normalizeUrl(url: string): string {
    return url.trim().replace(/\/+$/, "");
  }

  /**
   * Return the list of built-in default RPCs for a chain ID
   */
  public getDefaultRpcUrls(chainId?: number): readonly string[] {
    if (chainId === 31337) return DEFAULT_LOCALHOST_RPCS;
    if (chainId === 56) return DEFAULT_BSC_MAINNET_RPCS;
    return DEFAULT_BSC_TESTNET_RPCS;
  }

  /**
   * Return default verified Archive RPCs for a chain ID
   */
  public getDefaultArchiveRpcUrls(chainId?: number): readonly string[] {
    if (chainId === 31337) return DEFAULT_LOCALHOST_ARCHIVE_RPCS;
    if (chainId === 56) return DEFAULT_BSC_MAINNET_ARCHIVE_RPCS;
    return DEFAULT_BSC_TESTNET_ARCHIVE_RPCS;
  }

  /**
   * Return default high-performance Standard / Full RPCs for a chain ID
   */
  public getDefaultStandardRpcUrls(chainId?: number): readonly string[] {
    if (chainId === 31337) return DEFAULT_LOCALHOST_STANDARD_RPCS;
    if (chainId === 56) return DEFAULT_BSC_MAINNET_STANDARD_RPCS;
    return DEFAULT_BSC_TESTNET_STANDARD_RPCS;
  }

  /**
   * Get all active and enabled Archive RPC URLs for a chain ID
   * Exclusively used for 24h historical backfill and deep state lookbacks!
   */
  public getArchiveRpcUrls(chainId?: number): readonly string[] {
    const targetChainId = chainId ?? 97;
    const result: string[] = [];

    // 1. Custom archive RPCs
    for (const [url, item] of this.customEndpoints.entries()) {
      if (
        item.chainId === targetChainId &&
        item.nodeType === "archive" &&
        item.enabled &&
        !this.disabledUrls.has(url)
      ) {
        if (!result.includes(url)) {
          result.push(url);
        }
      }
    }

    // 2. Default archive RPCs
    const defaults = this.getDefaultArchiveRpcUrls(targetChainId);
    for (const defUrl of defaults) {
      const norm = this.normalizeUrl(defUrl);
      if (!this.disabledUrls.has(norm) && !result.includes(norm)) {
        result.push(norm);
      }
    }

    if (result.length === 0) {
      return [...defaults];
    }

    return result;
  }

  /**
   * Get all active and enabled Standard RPC URLs for a chain ID
   * Exclusively used for realtime polling, block height check, and transactions!
   */
  public getStandardRpcUrls(chainId?: number): readonly string[] {
    const targetChainId = chainId ?? 97;
    const result: string[] = [];

    // 1. Custom standard RPCs
    for (const [url, item] of this.customEndpoints.entries()) {
      if (
        item.chainId === targetChainId &&
        item.nodeType !== "archive" &&
        item.enabled &&
        !this.disabledUrls.has(url)
      ) {
        if (!result.includes(url)) {
          result.push(url);
        }
      }
    }

    // 2. Default standard RPCs
    const defaults = this.getDefaultStandardRpcUrls(targetChainId);
    for (const defUrl of defaults) {
      const norm = this.normalizeUrl(defUrl);
      if (!this.disabledUrls.has(norm) && !result.includes(norm)) {
        result.push(norm);
      }
    }

    if (result.length === 0) {
      return [...defaults];
    }

    return result;
  }

  /**
   * Get all active and enabled RPC URLs for a chain ID (custom first, followed by built-in)
   */
  public getActiveRpcUrls(chainId?: number): readonly string[] {
    const targetChainId = chainId ?? 97;
    const result: string[] = [];

    // 1. Add enabled custom RPCs for this chain
    for (const [url, item] of this.customEndpoints.entries()) {
      if (item.chainId === targetChainId && item.enabled && !this.disabledUrls.has(url)) {
        if (!result.includes(url)) {
          result.push(url);
        }
      }
    }

    // 2. Add enabled default RPCs
    const defaults = this.getDefaultRpcUrls(targetChainId);
    for (const defUrl of defaults) {
      const norm = this.normalizeUrl(defUrl);
      if (!this.disabledUrls.has(norm) && !result.includes(norm)) {
        result.push(norm);
      }
    }

    // Fallback: If all are disabled, return the default pool to avoid complete network outage
    if (result.length === 0) {
      return [...defaults];
    }

    return result;
  }

  /**
   * Get all endpoints with status for a specific chain ID
   */
  public getAllEndpoints(chainId?: number): RpcEndpointItem[] {
    const targetChainId = chainId ?? 97;
    const list: RpcEndpointItem[] = [];
    const seen = new Set<string>();

    // 1. Custom endpoints
    for (const item of this.customEndpoints.values()) {
      if (item.chainId === targetChainId) {
        const norm = this.normalizeUrl(item.url);
        seen.add(norm);
        const cached = this.latencyCache.get(norm);
        list.push({
          ...item,
          nodeType: item.nodeType || (isArchiveRpcUrl(norm) ? "archive" : "standard"),
          url: norm,
          enabled: item.enabled && !this.disabledUrls.has(norm),
          latencyMs: cached?.latencyMs,
          blockNumber: cached?.blockNumber,
          lastChecked: cached?.lastChecked,
          error: cached?.error,
        });
      }
    }

    // 2. Default endpoints
    const defaults = this.getDefaultRpcUrls(targetChainId);
    for (const defUrl of defaults) {
      const norm = this.normalizeUrl(defUrl);
      if (!seen.has(norm)) {
        seen.add(norm);
        const cached = this.latencyCache.get(norm);
        list.push({
          url: norm,
          label: this.getEndpointLabel(norm),
          chainId: targetChainId,
          nodeType: isArchiveRpcUrl(norm) ? "archive" : "standard",
          enabled: !this.disabledUrls.has(norm),
          isCustom: false,
          latencyMs: cached?.latencyMs,
          blockNumber: cached?.blockNumber,
          lastChecked: cached?.lastChecked,
          error: cached?.error,
        });
      }
    }

    return list;
  }

  private getEndpointLabel(url: string): string {
    if (url.includes("bnbchain.org")) return "BNBChain 官方主数据源";
    if (url.includes("publicnode.com")) return "PublicNode 归档公共节点";
    if (url.includes("drpc.org")) return "dRPC 去中心化分布式节点";
    if (url.includes("prebsc-1-s1")) return "Binance 备用数据源 1-S1";
    if (url.includes("prebsc-2-s1")) return "Binance 备用数据源 2-S1";
    if (url.includes("prebsc-1-s2")) return "Binance 备用数据源 1-S2";
    if (url.includes("prebsc-2-s2")) return "Binance 备用数据源 2-S2";
    if (url.includes("binance.org")) return "Binance 官方节点";
    if (url.includes("llamarpc")) return "LlamaNodes 隐私主网节点";
    if (url.includes("defibit")) return "DeFiBit 镜像节点";
    if (url.includes("ninicoin")) return "NiniCoin 镜像节点";
    if (url.includes("ankr.com")) return "Ankr 负载均衡节点";
    if (url.includes("127.0.0.1") || url.includes("localhost")) return "本地测试节点 (Hardhat)";
    return "公用 EVM 节点";
  }

  /**
   * Test latency and block number for a specific RPC URL
   */
  public async testEndpoint(
    rawUrl: string,
    expectedChainId?: number,
    timeoutMs: number = 6000
  ): Promise<{
    success: boolean;
    latencyMs: number;
    blockNumber?: bigint;
    actualChainId?: number;
    error?: string;
  }> {
    const url = this.normalizeUrl(rawUrl);
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
          { jsonrpc: "2.0", id: 2, method: "eth_chainId", params: [] },
        ]),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const elapsed = Math.round(performance.now() - start);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${response.statusText})`);
      }

      const json = await response.json();
      if (!Array.isArray(json)) {
        throw new Error("Invalid RPC JSON batch response");
      }

      const blockResp = json.find((item) => item.id === 1);
      const chainResp = json.find((item) => item.id === 2);

      if (blockResp?.error) {
        throw new Error(`Block error: ${blockResp.error.message}`);
      }

      const blockNumber = blockResp?.result ? BigInt(blockResp.result) : undefined;
      const actualChainId = chainResp?.result ? Number(BigInt(chainResp.result)) : undefined;

      if (expectedChainId !== undefined && actualChainId !== undefined && actualChainId !== expectedChainId) {
        const errStr = `Chain ID mismatch (期望: ${expectedChainId}, 实际: ${actualChainId})`;
        this.latencyCache.set(url, {
          latencyMs: elapsed,
          blockNumber,
          lastChecked: Date.now(),
          error: errStr,
        });
        return {
          success: false,
          latencyMs: elapsed,
          blockNumber,
          actualChainId,
          error: errStr,
        };
      }

      this.latencyCache.set(url, {
        latencyMs: elapsed,
        blockNumber,
        lastChecked: Date.now(),
      });

      return {
        success: true,
        latencyMs: elapsed,
        blockNumber,
        actualChainId,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const elapsed = Math.round(performance.now() - start);
      const errorMsg = err?.name === "AbortError" ? "连接超时 (>6s)" : (err?.message || "连接失败");
      this.latencyCache.set(url, {
        latencyMs: elapsed,
        lastChecked: Date.now(),
        error: errorMsg,
      });
      return {
        success: false,
        latencyMs: elapsed,
        error: errorMsg,
      };
    }
  }

  /**
   * Batch test all endpoints for a chain ID
   */
  public async testAllEndpoints(chainId?: number): Promise<void> {
    const endpoints = this.getAllEndpoints(chainId);
    await Promise.allSettled(
      endpoints.map((ep) => this.testEndpoint(ep.url, chainId))
    );
  }

  /**
   * Add a custom RPC endpoint with pre-validation
   */
  public async addCustomRpc(
    chainId: number,
    rawUrl: string,
    label?: string,
    nodeType?: RpcNodeType
  ): Promise<{
    success: boolean;
    latencyMs?: number;
    blockNumber?: bigint;
    error?: string;
  }> {
    const url = this.normalizeUrl(rawUrl);

    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("wss://")) {
      return {
        success: false,
        error: "RPC 地址必须以 http:// 或 https:// 开头",
      };
    }

    // Verify endpoint connectivity
    const testRes = await this.testEndpoint(url, chainId, 7000);
    if (!testRes.success) {
      return {
        success: false,
        latencyMs: testRes.latencyMs,
        error: testRes.error || "节点连通性测试失败，请检查网络或地址有效性",
      };
    }

    const effectiveNodeType: RpcNodeType =
      nodeType ?? (isArchiveRpcUrl(url) ? "archive" : "standard");

    const item: RpcEndpointItem = {
      url,
      label: label?.trim() || "自定义节点",
      chainId,
      nodeType: effectiveNodeType,
      enabled: true,
      isCustom: true,
      latencyMs: testRes.latencyMs,
      blockNumber: testRes.blockNumber,
      lastChecked: Date.now(),
    };

    this.customEndpoints.set(url, item);
    this.disabledUrls.delete(url);
    this.saveToStorage();
    this.notifyChange(chainId);

    return {
      success: true,
      latencyMs: testRes.latencyMs,
      blockNumber: testRes.blockNumber,
    };
  }

  /**
   * Remove a custom RPC endpoint
   */
  public removeCustomRpc(chainId: number, rawUrl: string): void {
    const url = this.normalizeUrl(rawUrl);
    if (this.customEndpoints.has(url)) {
      this.customEndpoints.delete(url);
      this.disabledUrls.delete(url);
      this.latencyCache.delete(url);
      this.saveToStorage();
      this.notifyChange(chainId);
    }
  }

  /**
   * Enable or disable an RPC endpoint
   */
  public toggleRpc(chainId: number, rawUrl: string, enabled: boolean): void {
    const url = this.normalizeUrl(rawUrl);
    if (enabled) {
      this.disabledUrls.delete(url);
      if (this.customEndpoints.has(url)) {
        const item = this.customEndpoints.get(url)!;
        item.enabled = true;
      }
    } else {
      this.disabledUrls.add(url);
      if (this.customEndpoints.has(url)) {
        const item = this.customEndpoints.get(url)!;
        item.enabled = false;
      }
    }
    this.saveToStorage();
    this.notifyChange(chainId);
  }

  /**
   * Reset RPC endpoints to defaults for given chain
   */
  public resetToDefaults(chainId: number): void {
    for (const [url, item] of Array.from(this.customEndpoints.entries())) {
      if (item.chainId === chainId) {
        this.customEndpoints.delete(url);
        this.disabledUrls.delete(url);
      }
    }
    const defaults = this.getDefaultRpcUrls(chainId);
    for (const defUrl of defaults) {
      this.disabledUrls.delete(this.normalizeUrl(defUrl));
    }
    this.saveToStorage();
    this.notifyChange(chainId);
  }

  /**
   * Subscribe to RPC pool updates
   */
  public onPoolChange(listener: PoolChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyChange(chainId: number): void {
    const active = this.getActiveRpcUrls(chainId);
    for (const listener of this.listeners) {
      try {
        listener(chainId, [...active]);
      } catch (err) {
        console.error("Error in RPC pool listener:", err);
      }
    }
  }
}

export const RpcPoolManager = new RpcPoolManagerClass();
