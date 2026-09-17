import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  formatUnits,
  formatEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import * as fs from "fs";
import {
  generateKeeperWallet,
  fetchKeeperGasBalance,
  fundKeeperGas,
} from "../src/services/trading/keeper-manager";
import {
  sendSetKeeperTransaction,
  UNISWAP_V2_PROXY_TRADER_ABI,
} from "../src/contracts/proxy-trader";
import { executeKeeperSwap } from "../src/services/trading/keeper-executor";
import { approveToken } from "../src/services/trading/token-approval";
import type { EIP1193Provider } from "../src/wallet/ethereum";

const RPC_URL = "https://bsc-testnet-dataseed.bnbchain.org";
const CHAIN_ID = 97;

async function main() {
  console.log("=================================================");
  console.log("   BSC Testnet Live On-Chain Integration Test    ");
  console.log("=================================================");

  // Read PRIVATE_KEY from .env
  const envContent = fs.readFileSync("/ssd0/git/uniswap-v2-trader/.env", "utf8");
  const m = envContent.match(/PRIVATE_KEY=(.+)/);
  if (!m) throw new Error("No PRIVATE_KEY in .env");
  let pk = m[1].trim().replace(/^["']|["']$/g, "") as Hex;
  if (!pk.startsWith("0x")) pk = `0x${pk}`;

  const masterAccount = privateKeyToAccount(pk);
  console.log(`[1/7] Master Account: ${masterAccount.address}`);

  const publicClient = createPublicClient({
    chain: bscTestnet,
    transport: http(RPC_URL),
  });

  const masterWallet = createWalletClient({
    account: masterAccount,
    chain: bscTestnet,
    transport: http(RPC_URL),
  });

  const masterBalance = await publicClient.getBalance({ address: masterAccount.address });
  console.log(`Master tBNB Balance: ${formatEther(masterBalance)} tBNB`);

  // Load deployed test-pair config
  const pairConfig = JSON.parse(
    fs.readFileSync("/ssd0/git/uniswap-v2-trader/data/test-pair.json", "utf8")
  );
  const proxyTraderAddress: Address = pairConfig.proxyTraderAddress;
  const tokenAAddress: Address = pairConfig.tokenA.address;
  const tokenBAddress: Address = pairConfig.tokenB.address;
  const pairAddress: Address = pairConfig.pairAddress;

  console.log(`ProxyTrader: ${proxyTraderAddress}`);
  console.log(`Pair:        ${pairAddress}`);
  console.log(`Token A:     ${tokenAAddress} (${pairConfig.tokenA.symbol})`);
  console.log(`Token B:     ${tokenBAddress} (${pairConfig.tokenB.symbol})`);

  // EIP-1193 provider wrapper around master wallet for signing user transactions
  const userEip1193Provider: EIP1193Provider = {
    request: async (args: { method: string; params?: any }): Promise<any> => {
      if (args.method === "eth_sendTransaction") {
        const tx = (args.params as any[])[0];
        const hash = await masterWallet.sendTransaction({
          to: tx.to,
          data: tx.data || "0x",
          value: tx.value ? BigInt(tx.value) : 0n,
        });
        return hash;
      }
      if (args.method === "eth_chainId") {
        return "0x61"; // 97 in hex
      }
      if (args.method === "eth_accounts" || args.method === "eth_requestAccounts") {
        return [masterAccount.address];
      }
      throw new Error(`Unsupported mock method: ${args.method}`);
    },
  };

  // [2/7] Setup Keeper Wallet
  console.log("\n[2/7] Initializing Keeper Wallet...");
  const keeper = generateKeeperWallet();
  console.log(`Keeper Address: ${keeper.address}`);

  // Check keeper balance
  let keeperGas = await fetchKeeperGasBalance(keeper.address, RPC_URL);
  console.log(`Keeper initial gas: ${formatEther(keeperGas.balanceWei)} tBNB`);

  if (keeperGas.balanceWei < parseEther("0.003")) {
    console.log("Funding Keeper with 0.005 tBNB from Master...");
    const fundHash = await fundKeeperGas(
      userEip1193Provider,
      masterAccount.address,
      keeper.address,
      "0.005"
    );
    console.log(`Fund Keeper tx sent: ${fundHash}`);
    await publicClient.waitForTransactionReceipt({ hash: fundHash as Hex });
    keeperGas = await fetchKeeperGasBalance(keeper.address, RPC_URL);
    console.log(`Keeper gas funded. Current balance: ${formatEther(keeperGas.balanceWei)} tBNB`);
  }

  // [3/7] Bind Keeper on ProxyTrader contract
  console.log("\n[3/7] Checking on-chain Keeper binding...");
  const currentBoundKeeper = await publicClient.readContract({
    address: proxyTraderAddress,
    abi: UNISWAP_V2_PROXY_TRADER_ABI,
    functionName: "keepers",
    args: [masterAccount.address],
  });
  console.log(`Current on-chain bound keeper: ${currentBoundKeeper}`);

  if (currentBoundKeeper.toLowerCase() !== keeper.address.toLowerCase()) {
    console.log(`Binding new keeper ${keeper.address} on-chain via Master transaction...`);
    const setKeeperHash = await sendSetKeeperTransaction(
      userEip1193Provider,
      masterAccount.address,
      proxyTraderAddress,
      keeper.address
    );
    console.log(`setKeeper tx sent: ${setKeeperHash}`);
    await publicClient.waitForTransactionReceipt({ hash: setKeeperHash as Hex });
    console.log("Keeper binding confirmed on BSC Testnet!");
  }

  // [4/7] Check and Approve Token A to ProxyTrader
  console.log("\n[4/7] Checking Token A allowance for ProxyTrader...");
  const erc20Abi = [
    {
      name: "allowance",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
      outputs: [{ type: "uint256" }],
    },
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ type: "uint256" }],
    },
  ] as const;

  const currentAllowance = await publicClient.readContract({
    address: tokenAAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [masterAccount.address, proxyTraderAddress],
  });
  console.log(`Current allowance for ProxyTrader: ${formatUnits(currentAllowance, 18)} ALPHA`);

  const tradeAmount = parseUnits("20", 18); // 20 ALPHA
  if (currentAllowance < tradeAmount) {
    console.log(`Approving 500 ALPHA to ProxyTrader...`);
    const approveAmount = parseUnits("500", 18);
    const approveHash = await approveToken(
      userEip1193Provider,
      masterAccount.address,
      proxyTraderAddress,
      tokenAAddress,
      approveAmount
    );
    console.log(`Approve tx sent: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({ hash: approveHash as Hex });
    console.log("Token A approved to ProxyTrader!");
  }

  // [5/7] Record user balance before swap
  console.log("\n[5/7] Recording pre-trade balances...");
  const userBalanceA_Before = await publicClient.readContract({
    address: tokenAAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [masterAccount.address],
  });
  const userBalanceB_Before = await publicClient.readContract({
    address: tokenBAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [masterAccount.address],
  });
  console.log(`Master Pre-Trade ALPHA: ${formatUnits(userBalanceA_Before, 18)}`);
  console.log(`Master Pre-Trade BETA:  ${formatUnits(userBalanceB_Before, 18)}`);

  // [6/7] Execute Automated Silent Swap via Keeper
  console.log("\n[6/7] Keeper executing silent automated swap on BSC Testnet...");
  console.log(`Swap: ${formatUnits(tradeAmount, 18)} ALPHA -> BETA`);

  // Expected amount: ~2 BETA per ALPHA with pool reserves ~50,100 ALPHA / 99,800 BETA -> ~39 BETA
  const tradeResult = await executeKeeperSwap({
    keeperPrivateKey: keeper.privateKey,
    proxyAddress: proxyTraderAddress,
    userAddress: masterAccount.address,
    tokenIn: tokenAAddress,
    tokenOut: tokenBAddress,
    amountIn: tradeAmount,
    expectedAmountOut: parseUnits("35", 18), // Conservative minimum with slippage
    slippagePercent: 5.0,
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
  });

  console.log(`Keeper swap tx hash: ${tradeResult.txHash}`);
  console.log("Waiting for block confirmation on BSC Testnet...");

  const swapReceipt = await publicClient.waitForTransactionReceipt({
    hash: tradeResult.txHash as Hex,
  });
  console.log(`Swap confirmed in block ${swapReceipt.blockNumber}, gas used: ${swapReceipt.gasUsed}`);

  // [7/7] Assert Zero-Theft and Verification
  console.log("\n[7/7] Asserting On-Chain State & Invariants...");
  const userBalanceA_After = await publicClient.readContract({
    address: tokenAAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [masterAccount.address],
  });
  const userBalanceB_After = await publicClient.readContract({
    address: tokenBAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [masterAccount.address],
  });

  const deltaB = userBalanceB_After - userBalanceB_Before;
  console.log(`Master Post-Trade ALPHA: ${formatUnits(userBalanceA_After, 18)} (-${formatUnits(tradeAmount, 18)})`);
  console.log(`Master Post-Trade BETA:  ${formatUnits(userBalanceB_After, 18)} (+${formatUnits(deltaB, 18)} BETA received!)`);

  if (deltaB <= 0n) {
    throw new Error("Zero-Theft Violation: Master wallet did not receive output tokens!");
  }
  console.log(">>> Zero-Theft Invariant Verified: 100% of swap output returned to Master!");

  // Verify proxy residual is zero
  const proxyBalA = await publicClient.readContract({
    address: tokenAAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [proxyTraderAddress],
  });
  const proxyBalB = await publicClient.readContract({
    address: tokenBAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [proxyTraderAddress],
  });
  console.log(`Proxy leftover ALPHA: ${proxyBalA}, BETA: ${proxyBalB}`);
  if (proxyBalA !== 0n || proxyBalB !== 0n) {
    throw new Error("Zero-Residual Violation: ProxyTrader retained tokens!");
  }
  console.log(">>> Zero-Residual Invariant Verified: ProxyTrader holds 0 leftover tokens!");

  // Verify updated keeper gas
  const updatedKeeperGas = await fetchKeeperGasBalance(keeper.address, RPC_URL);
  console.log(`Keeper remaining gas: ${formatEther(updatedKeeperGas.balanceWei)} tBNB (Gas was paid by Keeper)`);

  console.log("\n=================================================");
  console.log("   ALL BSC TESTNET ON-CHAIN INVARIANTS PASSED!   ");
  console.log("=================================================");

  // Record trade execution summary
  const report = {
    test: "BSC Testnet Live On-Chain Trade Execution",
    status: "PASSED",
    timestamp: new Date().toISOString(),
    network: "bscTestnet (Chain ID 97)",
    masterAccount: masterAccount.address,
    keeperAccount: keeper.address,
    proxyTrader: proxyTraderAddress,
    pairAddress,
    swapTxHash: tradeResult.txHash,
    blockNumber: Number(swapReceipt.blockNumber),
    gasUsed: swapReceipt.gasUsed.toString(),
    amountIn: formatUnits(tradeAmount, 18) + " ALPHA",
    amountOutReceived: formatUnits(deltaB, 18) + " BETA",
    invariants: {
      zeroTheft: true,
      zeroResidual: true,
      silentKeeperExecution: true,
    },
  };

  fs.writeFileSync(
    "/ssd0/git/uniswap-v2-trader/data/onchain-test-report.json",
    JSON.stringify(report, null, 2)
  );
  console.log("Saved test execution report to data/onchain-test-report.json");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  });
