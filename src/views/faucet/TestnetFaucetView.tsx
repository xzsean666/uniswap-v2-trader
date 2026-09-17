import React, { useState, useEffect, useCallback } from "react";
import {
  Droplets,
  ExternalLink,
  PlusCircle,
  AlertCircle,
  Sparkles,
  Coins,
  Radio,
  Zap,
  RefreshCw,
  Copy,
  Check,
  Shield,
  HelpCircle,
  Fuel,
} from "lucide-react";
import {
  formatUnits,
  parseUnits,
  encodeFunctionData,
  parseAbi,
  formatEther,
  type Address,
} from "viem";
import { CyberCard } from "../../components/ui/CyberCard";
import { CyberButton } from "../../components/ui/CyberButton";
import { useWallet } from "../../wallet/WalletContext";
import { useNotification } from "../../components/notification/NotificationContext";
import { useActivePair } from "../../context/ActivePairContext";
import { useKeeper } from "../../context/KeeperContext";
import { multicallRead } from "../../evm/multicall";
import { waitForTransactionReceipt } from "../../services/trading/trade-dispatcher";
import { checkAllowance, approveToken } from "../../services/trading/token-approval";
import { formatAddress, getBscScanAddressUrl } from "../../wallet/ethereum";

// Testnet Pair & Token Constants
export const TESTNET_CONFIG = {
  chainId: 97,
  networkName: "BSC Testnet (Chapel)",
  rpcUrl: "https://bsc-testnet-dataseed.bnbchain.org",
  pairAddress: "0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02" as Address,
  routerAddress: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" as Address,
  proxyTraderAddress: "0x3c43ac2680e9a4fc387a31ea47f9a88eee8b1b13" as Address,
  tokenA: {
    address: "0xd26cdc2d33bda34c07f01c459ab32a2bf4c9f441" as Address,
    name: "Alpha Token",
    symbol: "ALPHA",
    decimals: 18,
    defaultAmount: "500",
  },
  tokenB: {
    address: "0x7a939029997569074973b1ee95118d387f171863" as Address,
    name: "Beta Token",
    symbol: "BETA",
    decimals: 18,
    defaultAmount: "1000",
  },
  officialFaucets: [
    {
      name: "BNB Chain 官方测试网水龙头",
      url: "https://www.bnbchain.org/en/testnet-faucet",
      desc: "支持每日领 0.1 ~ 0.3 tBNB 测试燃料",
    },
    {
      name: "BNB Chain Discord 水龙头",
      url: "https://discord.gg/bnbchain",
      desc: "#testnet-faucet 频道发送 /faucet <地址>",
    },
    {
      name: "QuickNode BSC Testnet Faucet",
      url: "https://faucet.quicknode.com/binance-smart-chain/bnb-testnet",
      desc: "免费快速领取测试网燃料",
    },
  ],
};

const MOCK_ERC20_ABI = parseAbi([
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
]);

interface TestnetFaucetViewProps {
  onNavigate?: (tab: string, subTab?: string) => void;
}

export const TestnetFaucetView: React.FC<TestnetFaucetViewProps> = ({ onNavigate }) => {
  const { address, provider, isConnected, isBscTestnet, switchToBsc } = useWallet();
  const { showNotification } = useNotification();
  const { setPairAddressInput, startListening } = useActivePair();

  // Balances
  const [nativeBalance, setNativeBalance] = useState<string>("0");
  const [alphaBalance, setAlphaBalance] = useState<string>("0");
  const [betaBalance, setBetaBalance] = useState<string>("0");
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);

  // Allowance to Proxy Trader
  const [alphaAllowance, setAlphaAllowance] = useState<bigint | null>(null);
  const [betaAllowance, setBetaAllowance] = useState<bigint | null>(null);
  const [isApprovingA, setIsApprovingA] = useState<boolean>(false);
  const [isApprovingB, setIsApprovingB] = useState<boolean>(false);

  // Minting state
  const [mintAmountA, setMintAmountA] = useState<string>(TESTNET_CONFIG.tokenA.defaultAmount);
  const [mintAmountB, setMintAmountB] = useState<string>(TESTNET_CONFIG.tokenB.defaultAmount);
  const [isMintingA, setIsMintingA] = useState<boolean>(false);
  const [isMintingB, setIsMintingB] = useState<boolean>(false);

  // Keeper gas funding state & handler
  const {
    keeper,
    keeperBalance,
    refreshBalance: refreshKeeperBalance,
    fundGas,
  } = useKeeper();
  const [isFundingKeeperGas, setIsFundingKeeperGas] = useState<boolean>(false);

  const handleQuickFundKeeper = async (amount: string) => {
    if (!isConnected) {
      showNotification({
        status: "failed",
        title: "请先连接钱包",
        message: "需要使用主钱包向打工小号划拨 tBNB 燃料",
      });
      return;
    }
    setIsFundingKeeperGas(true);
    try {
      showNotification({
        status: "broadcasting",
        title: "正在划拨 Keeper 燃料...",
        message: `正在向打工小号转账 ${amount} tBNB`,
      });
      const txHash = await fundGas(amount);
      showNotification({
        status: "pending",
        title: "燃料划转交易已广播",
        message: "正在等待区块节点打包确认...",
        txHash,
      });
      await waitForTransactionReceipt(txHash, 30000, 2000);
      showNotification({
        status: "success",
        title: "燃料划转成功",
        message: `打工小号已成功接收 ${amount} tBNB，可无感执行静默交易！`,
        txHash,
      });
      await Promise.all([refreshBalances(), refreshKeeperBalance()]);
    } catch (err: any) {
      showNotification({
        status: "failed",
        title: "燃料划转失败",
        message: err?.message || "用户取消或转账失败",
      });
    } finally {
      setIsFundingKeeperGas(false);
    }
  };

  // Copy helpers
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Refresh user token balances and proxy allowances
  const refreshBalances = useCallback(async () => {
    if (!address || !isConnected) return;
    setIsLoadingBalances(true);

    try {
      // 1. Fetch tBNB native balance via eth_getBalance
      if (provider) {
        try {
          const rawHex = (await provider.request({
            method: "eth_getBalance",
            params: [address, "latest"],
          })) as string;
          if (rawHex) {
            setNativeBalance(parseFloat(formatEther(BigInt(rawHex))).toFixed(4));
          }
        } catch {
          // ignore transient rpc error
        }
      }

      // 2. Fetch ALPHA and BETA balances via Multicall
      const results = await multicallRead([
        {
          target: TESTNET_CONFIG.tokenA.address,
          abi: MOCK_ERC20_ABI,
          functionName: "balanceOf",
          args: [address as Address],
        },
        {
          target: TESTNET_CONFIG.tokenB.address,
          abi: MOCK_ERC20_ABI,
          functionName: "balanceOf",
          args: [address as Address],
        },
      ]);

      if (results[0].success && results[0].result !== undefined) {
        setAlphaBalance(
          parseFloat(
            formatUnits(results[0].result as bigint, TESTNET_CONFIG.tokenA.decimals)
          ).toLocaleString(undefined, { maximumFractionDigits: 2 })
        );
      }
      if (results[1].success && results[1].result !== undefined) {
        setBetaBalance(
          parseFloat(
            formatUnits(results[1].result as bigint, TESTNET_CONFIG.tokenB.decimals)
          ).toLocaleString(undefined, { maximumFractionDigits: 2 })
        );
      }

      // 3. Fetch allowance for Proxy Trader
      try {
        const [allowA, allowB] = await Promise.all([
          checkAllowance(
            address as Address,
            TESTNET_CONFIG.proxyTraderAddress,
            TESTNET_CONFIG.tokenA.address
          ),
          checkAllowance(
            address as Address,
            TESTNET_CONFIG.proxyTraderAddress,
            TESTNET_CONFIG.tokenB.address
          ),
        ]);
        setAlphaAllowance(allowA);
        setBetaAllowance(allowB);
      } catch {
        // ignore allowance check failure
      }
    } catch (err) {
      console.error("Failed to refresh balances:", err);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [address, isConnected, provider]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Approve token to Proxy Trader contract
  const handleApproveProxy = async (tokenKey: "A" | "B") => {
    if (!isConnected || !address || !provider) {
      showNotification({
        status: "failed",
        title: "未连接钱包",
        message: "请先连接 Web3 钱包后再执行授权。",
      });
      return;
    }

    const isTokenA = tokenKey === "A";
    const token = isTokenA ? TESTNET_CONFIG.tokenA : TESTNET_CONFIG.tokenB;
    const setIsApproving = isTokenA ? setIsApprovingA : setIsApprovingB;

    setIsApproving(true);
    try {
      showNotification({
        status: "broadcasting",
        title: `正在发起 ${token.symbol} 授权...`,
        message: `请在 MetaMask 中确认授权给代理交易合约 (${formatAddress(TESTNET_CONFIG.proxyTraderAddress)})`,
      });

      const txHash = await approveToken(
        provider,
        address as Address,
        TESTNET_CONFIG.proxyTraderAddress,
        token.address
      );

      showNotification({
        status: "pending",
        title: `${token.symbol} 授权已广播`,
        message: "正在等待区块节点打包确认...",
        txHash,
      });

      await waitForTransactionReceipt(txHash, 30000, 2000);

      showNotification({
        status: "success",
        title: `${token.symbol} 授权成功`,
        message: `代理合约已获得 ${token.symbol} 额度，AI 自动交易与 Keeper 静默交易已就绪！`,
        txHash,
      });

      await refreshBalances();
    } catch (err: any) {
      showNotification({
        status: "failed",
        title: `${token.symbol} 授权失败`,
        message: err?.message || "用户取消或交易回滚",
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Mint mock tokens
  const handleMint = async (tokenKey: "A" | "B") => {
    if (!isConnected || !address || !provider) {
      showNotification({
        status: "failed",
        title: "未连接钱包",
        message: "请先连接 Web3 钱包后再领水。",
      });
      return;
    }

    if (!isBscTestnet) {
      showNotification({
        status: "failed",
        title: "网络错误",
        message: "请先将钱包网络切换至 BSC 测试网 (Chain ID: 97)。",
      });
      return;
    }

    const isTokenA = tokenKey === "A";
    const token = isTokenA ? TESTNET_CONFIG.tokenA : TESTNET_CONFIG.tokenB;
    const amountStr = isTokenA ? mintAmountA : mintAmountB;
    const setMinting = isTokenA ? setIsMintingA : setIsMintingB;

    const amountNum = parseFloat(amountStr);
    if (!amountNum || amountNum <= 0) {
      showNotification({
        status: "failed",
        title: "输入数量无效",
        message: "请输入大于 0 的有效领水数量。",
      });
      return;
    }

    setMinting(true);
    showNotification({
      status: "broadcasting",
      title: `正在发起 ${token.symbol} 领水交易...`,
      message: "请在钱包中确认领取测试代币",
    });

    try {
      const amountBigInt = parseUnits(amountStr, token.decimals);
      const data = encodeFunctionData({
        abi: MOCK_ERC20_ABI,
        functionName: "mint",
        args: [address as Address, amountBigInt],
      });

      const txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: token.address,
            data,
          },
        ],
      })) as `0x${string}`;

      showNotification({
        status: "pending",
        title: `${token.symbol} 领水交易已广播`,
        message: "正在等待 BSC 测试网打包确认...",
        txHash,
      });

      const receipt = await waitForTransactionReceipt(txHash, 45000, 2000);

      if (receipt.status === "success") {
        showNotification({
          status: "success",
          title: `成功领取 ${amountStr} ${token.symbol}！`,
          message: `交易成功打包于区块 #${receipt.blockNumber.toString()}`,
          txHash,
        });
        await refreshBalances();
      } else {
        showNotification({
          status: "failed",
          title: "领水交易执行回滚",
          message: "交易未成功上链，请重试。",
          txHash,
        });
      }
    } catch (err: any) {
      showNotification({
        status: "failed",
        title: "领水失败",
        message: err?.message || "用户取消签名或网络错误",
      });
    } finally {
      setMinting(false);
    }
  };

  // Add token to wallet
  const handleWatchAsset = async (token: typeof TESTNET_CONFIG.tokenA) => {
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
          },
        },
      });
    } catch (err: any) {
      console.warn("Failed to watch asset:", err);
    }
  };

  // Preload test pair and navigate
  const handleLoadAndNavigate = async (targetTab: string, subTab?: string) => {
    setPairAddressInput(TESTNET_CONFIG.pairAddress);
    try {
      await startListening(TESTNET_CONFIG.pairAddress);
    } catch {
      // handled
    }
    if (onNavigate) {
      onNavigate(targetTab, subTab);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <CyberCard className="bg-gradient-to-br from-cyber-card/90 via-slate-900/90 to-cyber-cardInner/90 border-cyber-border space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyber-cyan border border-cyan-500/30">
              <Droplets className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center space-x-2">
                <span>BSC 测试网水龙头中心</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyber-cyan border border-cyan-500/40 font-mono">
                  Chain ID: 97
                </span>
              </h3>
              <p className="text-xs text-cyber-textMuted">
                一键申领测试代币、获取官方 tBNB 燃料，快速体验量化交易与风控
              </p>
            </div>
          </div>

          <CyberButton
            variant="outline"
            size="sm"
            onClick={refreshBalances}
            disabled={isLoadingBalances}
            className="text-xs text-slate-400 hover:text-cyber-cyan"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1 ${isLoadingBalances ? "animate-spin" : ""}`}
            />
            <span>刷新余额</span>
          </CyberButton>
        </div>

        {/* Current Wallet State Pill */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block mb-0.5">当前测试钱包</span>
            <span className="text-slate-200 font-semibold truncate block">
              {address ? formatAddress(address) : "未连接钱包"}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block mb-0.5">tBNB 燃料余额</span>
            <span
              className={`font-semibold truncate block ${
                parseFloat(nativeBalance) < 0.005 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {nativeBalance} tBNB
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">当前网络状态</span>
              <span
                className={`font-semibold flex items-center space-x-1 ${
                  isBscTestnet ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isBscTestnet ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  }`}
                />
                <span>{isBscTestnet ? "BSC 测试网已就绪" : "网络不匹配"}</span>
              </span>
            </div>
            {!isBscTestnet && (
              <button
                type="button"
                onClick={switchToBsc}
                className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] hover:bg-amber-500/30"
              >
                切至测试网
              </button>
            )}
          </div>
        </div>

        {/* Low Gas Warning & Official Faucets */}
        {parseFloat(nativeBalance) < 0.005 && (
          <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-start space-x-2.5 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-1.5 flex-1">
              <span className="font-semibold block">
                提示: 您的主钱包 tBNB 燃料偏低，可能无法支付链上交互的 Gas 费用。
              </span>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {TESTNET_CONFIG.officialFaucets.map((faucet, idx) => (
                  <a
                    key={idx}
                    href={faucet.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30"
                  >
                    <span>{faucet.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Keeper Gas Quick Allocation Bar */}
        {keeper && (
          <div className="p-3 bg-slate-950/70 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Fuel className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-200 font-semibold text-xs">
                    本地打工小号 (Keeper) 燃料:
                  </span>
                  <span className="font-mono text-slate-400 text-[11px]">
                    {formatAddress(keeper.address)}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] mt-0.5">
                  <span className="text-slate-400">当前余额:</span>
                  <span
                    className={`font-mono font-bold ${
                      keeperBalance?.isLowGas ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {keeperBalance?.formatted ?? "0.0000"} tBNB
                  </span>
                  {keeperBalance?.isLowGas ? (
                    <span className="text-amber-400 text-[10px]">
                      (燃料偏低，建议划拨)
                    </span>
                  ) : (
                    <span className="text-emerald-400 text-[10px]">
                      (充足，已就绪静默交易)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 self-end sm:self-auto">
              <span className="text-[11px] text-slate-400 mr-1">快捷划拨燃料:</span>
              {["0.002", "0.005", "0.01"].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={isFundingKeeperGas || !isConnected}
                  onClick={() => handleQuickFundKeeper(amt)}
                  className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded text-xs font-mono transition-colors disabled:opacity-50 flex items-center space-x-1"
                >
                  <Fuel className="w-3 h-3 text-amber-400" />
                  <span>+{amt} tBNB</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CyberCard>

      {/* Mock Tokens Faucet Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Token A: ALPHA */}
        <CyberCard className="border-cyber-border space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-cyber-cyan/10 text-cyber-cyan">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100 font-mono">
                  {TESTNET_CONFIG.tokenA.symbol}
                </h4>
                <span className="text-[10px] text-cyber-textMuted">
                  {TESTNET_CONFIG.tokenA.name}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">我的钱包余额</span>
              <span className="text-xs font-mono font-bold text-cyber-cyan">
                {alphaBalance} {TESTNET_CONFIG.tokenA.symbol}
              </span>
            </div>
          </div>

          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <span className="truncate mr-2">
                合约: {formatAddress(TESTNET_CONFIG.tokenA.address)}
              </span>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(TESTNET_CONFIG.tokenA.address, "tokenA")
                  }
                  className="p-1 hover:text-cyber-cyan rounded"
                  title="复制合约地址"
                >
                  {copiedKey === "tokenA" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={getBscScanAddressUrl(TESTNET_CONFIG.tokenA.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 hover:text-cyber-cyan rounded"
                  title="在 BscScan 查看"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                领水数量 (ALPHA)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  step="10"
                  value={mintAmountA}
                  onChange={(e) => setMintAmountA(e.target.value)}
                  className="flex-1 bg-cyber-cardInner border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-100 outline-none focus:border-cyber-cyan"
                  placeholder="500"
                />
                <div className="flex space-x-1 text-[11px] font-mono">
                  {["200", "500", "1000"].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMintAmountA(amt)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <CyberButton
                variant="cyan"
                size="sm"
                loading={isMintingA}
                onClick={() => handleMint("A")}
                className="flex-1 text-xs py-1.5 min-w-[110px]"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                <span>一键领水 (Mint)</span>
              </CyberButton>

              <CyberButton
                variant="outline"
                size="sm"
                loading={isApprovingA}
                onClick={() => handleApproveProxy("A")}
                className={`text-xs py-1.5 ${
                  alphaAllowance !== null && alphaAllowance > 0n
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                }`}
                title="授权给代理交易合约 UniswapV2ProxyTrader (0x3c43...1b13)"
              >
                <span>{alphaAllowance !== null && alphaAllowance > 0n ? "✓ 已授权代理" : "授权代理"}</span>
              </CyberButton>

              <CyberButton
                variant="outline"
                size="sm"
                onClick={() => handleWatchAsset(TESTNET_CONFIG.tokenA)}
                className="text-xs py-1.5 border-slate-700 hover:border-cyber-cyan"
                title="添加到 MetaMask 钱包资产列表"
              >
                <span>+ 钱包</span>
              </CyberButton>
            </div>
          </div>
        </CyberCard>

        {/* Token B: BETA */}
        <CyberCard className="border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100 font-mono">
                  {TESTNET_CONFIG.tokenB.symbol}
                </h4>
                <span className="text-[10px] text-cyber-textMuted">
                  {TESTNET_CONFIG.tokenB.name}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">我的钱包余额</span>
              <span className="text-xs font-mono font-bold text-rose-400">
                {betaBalance} {TESTNET_CONFIG.tokenB.symbol}
              </span>
            </div>
          </div>

          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <span className="truncate mr-2">
                合约: {formatAddress(TESTNET_CONFIG.tokenB.address)}
              </span>
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(TESTNET_CONFIG.tokenB.address, "tokenB")
                  }
                  className="p-1 hover:text-cyber-cyan rounded"
                  title="复制合约地址"
                >
                  {copiedKey === "tokenB" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={getBscScanAddressUrl(TESTNET_CONFIG.tokenB.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 hover:text-cyber-cyan rounded"
                  title="在 BscScan 查看"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                领水数量 (BETA)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  step="10"
                  value={mintAmountB}
                  onChange={(e) => setMintAmountB(e.target.value)}
                  className="flex-1 bg-cyber-cardInner border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-100 outline-none focus:border-rose-400"
                  placeholder="1000"
                />
                <div className="flex space-x-1 text-[11px] font-mono">
                  {["500", "1000", "2000"].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMintAmountB(amt)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <CyberButton
                variant="danger"
                size="sm"
                loading={isMintingB}
                onClick={() => handleMint("B")}
                className="flex-1 text-xs py-1.5 min-w-[110px]"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                <span>一键领水 (Mint)</span>
              </CyberButton>

              <CyberButton
                variant="outline"
                size="sm"
                loading={isApprovingB}
                onClick={() => handleApproveProxy("B")}
                className={`text-xs py-1.5 ${
                  betaAllowance !== null && betaAllowance > 0n
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                }`}
                title="授权给代理交易合约 UniswapV2ProxyTrader (0x3c43...1b13)"
              >
                <span>{betaAllowance !== null && betaAllowance > 0n ? "✓ 已授权代理" : "授权代理"}</span>
              </CyberButton>

              <CyberButton
                variant="outline"
                size="sm"
                onClick={() => handleWatchAsset(TESTNET_CONFIG.tokenB)}
                className="text-xs py-1.5 border-slate-700 hover:border-rose-400"
                title="添加到 MetaMask 钱包资产列表"
              >
                <span>+ 钱包</span>
              </CyberButton>
            </div>
          </div>
        </CyberCard>
      </div>

      {/* Deployed Test Pair & Fast-Track Actions */}
      <CyberCard className="border-cyber-border space-y-3 bg-gradient-to-br from-slate-900/90 to-cyber-card/90">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-cyber-cyan" />
            <span className="font-bold text-sm text-slate-100">
              已部署测试交易对 (PancakeSwap V2 LP)
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            流动性充足 (50K ALPHA / 100K BETA)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-cyber-cardInner/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">LP 合约地址</span>
            <div className="flex items-center space-x-1">
              <span className="text-slate-200">
                {formatAddress(TESTNET_CONFIG.pairAddress)}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(TESTNET_CONFIG.pairAddress, "pair")}
                className="p-1 hover:text-cyber-cyan"
              >
                {copiedKey === "pair" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-cyber-cardInner/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">初始兑换基准价</span>
            <span className="text-cyber-cyan font-bold">1 ALPHA ≈ 1.98 BETA</span>
          </div>
        </div>

        {/* Quick Jump Action Buttons */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <span className="text-[11px] text-cyber-textMuted block">
            测试快捷通道: 领水后一键载入该交易对并跳转进行功能测试
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <CyberButton
              variant="outline"
              size="sm"
              onClick={() => handleLoadAndNavigate("monitor")}
              className="text-xs py-2 flex items-center justify-center space-x-1.5 hover:border-cyber-cyan"
            >
              <Radio className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>1. 载入并监听 Swap</span>
            </CyberButton>

            <CyberButton
              variant="outline"
              size="sm"
              onClick={() => handleLoadAndNavigate("strategy", "reverse")}
              className="text-xs py-2 flex items-center justify-center space-x-1.5 hover:border-cyber-cyan"
            >
              <Shield className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>2. 测试反买反卖/风控</span>
            </CyberButton>

            <CyberButton
              variant="outline"
              size="sm"
              onClick={() => handleLoadAndNavigate("strategy", "auto")}
              className="text-xs py-2 flex items-center justify-center space-x-1.5 hover:border-cyber-cyan"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>3. 测试 AI 自动交易</span>
            </CyberButton>
          </div>
        </div>
      </CyberCard>

      {/* Testing Steps Checklist */}
      <CyberCard className="border-slate-800 space-y-2 text-xs">
        <div className="flex items-center space-x-2 text-slate-200 font-semibold border-b border-slate-800/80 pb-2">
          <HelpCircle className="w-4 h-4 text-cyber-cyan" />
          <span>测试网快速通关验证流程 (Testing Guide)</span>
        </div>

        <div className="space-y-1.5 text-slate-400 text-[11px]">
          <div className="flex items-start space-x-2">
            <span className="font-bold text-cyber-cyan">步骤 1:</span>
            <span>连接钱包并确认 tBNB 余额，使用上方按钮点击领水 500 ALPHA 和 1000 BETA。</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold text-cyber-cyan">步骤 2:</span>
            <span>点击上方卡片的「授权代理」，向已部署的代理交易合约 (<span className="text-slate-200 font-mono">0x3c43...1b13</span>) 预先授予代币划扣额度。</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold text-cyber-cyan">步骤 3:</span>
            <span>点击下方“1. 载入并监听 Swap”，观察双代币储备池同步与 24h 价格走势图。</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold text-cyber-cyan">步骤 4:</span>
            <span>点击“2. 测试反买反卖/风控”，将价格下限保底设为 3.50，点击模拟验证风控拦截。</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold text-cyber-cyan">步骤 5:</span>
            <span>将保底价格调回 0.50，点击模拟并执行，发起真实链上买入并在 BscScan 查证。</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="font-bold text-cyber-cyan">步骤 6:</span>
            <span>生成打工小号 (Keeper) 并转入微量燃料 (如 0.005 tBNB)，绑定代理合约后体验免弹窗全自动静默量化。</span>
          </div>
        </div>
      </CyberCard>
    </div>
  );
};
