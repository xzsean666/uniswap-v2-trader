import { describe, it, expect, beforeEach } from "vitest";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import {
  generateKeeperWallet,
  fetchKeeperGasBalance,
  fundKeeperGas,
  clearKeeperWallet,
} from "../../src/services/trading/keeper-manager";
import {
  sendSetKeeperTransaction,
  sendRemoveKeeperTransaction,
  UNISWAP_V2_PROXY_TRADER_ABI,
} from "../../src/contracts/proxy-trader";
import { executeKeeperSwap } from "../../src/services/trading/keeper-executor";
import { approveToken } from "../../src/services/trading/token-approval";
import type { EIP1193Provider } from "../../src/wallet/ethereum";

describe("Live Local Hardhat Node End-to-End Integration Test", () => {
  const RPC_URL = "http://127.0.0.1:8545";
  const CHAIN_ID = 31337;

  // Local Hardhat default test accounts
  const DEPLOYER_PK: Hex =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const USER_PK: Hex =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  const deployerAccount = privateKeyToAccount(DEPLOYER_PK);
  const userAccount = privateKeyToAccount(USER_PK);

  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(RPC_URL),
  });

  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain: hardhat,
    transport: http(RPC_URL),
  });

  const userWallet = createWalletClient({
    account: userAccount,
    chain: hardhat,
    transport: http(RPC_URL),
  });

  // Mock EIP-1193 Provider connected to local node for user actions
  const userEip1193Provider: EIP1193Provider = {
    request: async (args: { method: string; params?: any }): Promise<any> => {
      if (args.method === "eth_sendTransaction") {
        const tx = (args.params as any[])[0];
        const hash = await userWallet.sendTransaction({
          to: tx.to,
          data: tx.data || "0x",
          value: tx.value ? BigInt(tx.value) : 0n,
        });
        return hash;
      }
      if (args.method === "eth_chainId") {
        return "0x7a69"; // 31337
      }
      throw new Error(`Unsupported method in mock provider: ${args.method}`);
    },
  };

  const PROXY_TRADER_ADDRESS: Address = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
  const ROUTER_ADDRESS: Address = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

  let tokenAAddress: Address;
  let tokenBAddress: Address;

  beforeEach(() => {
    clearKeeperWallet();
  });

  it("should deploy mock tokens, set up keeper, fund gas, bind on-chain, approve, and execute silent trade", async (ctx) => {
    // 0. Verify local Hardhat node connectivity
    let isConnected = false;
    try {
      const chainId = await publicClient.getChainId();
      if (chainId === CHAIN_ID) {
        isConnected = true;
      }
    } catch {
      // Node is offline
    }

    if (!isConnected) {
      console.warn(
        "⚠️ 本地 Hardhat 节点未运行 (http://127.0.0.1:8545)，跳过本地网络集成测试。可随时启动节点: cd /ssd0/git/uniswap-v2-trader-contract && pnpm hardhat node"
      );
      ctx.skip();
      return;
    }

    // 1. Deploy MockERC20 tokens for the swap test
    const mockErc20Artifact = await import(
      "/ssd0/git/uniswap-v2-trader-contract/artifacts/contracts/test/MockERC20.sol/MockERC20.json"
    );

    const tokenATx = await deployerWallet.deployContract({
      abi: mockErc20Artifact.abi,
      bytecode: mockErc20Artifact.bytecode as Hex,
      args: ["Token A", "TKA", 18],
    });
    const tokenAReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenATx });
    tokenAAddress = tokenAReceipt.contractAddress!;

    const tokenBTx = await deployerWallet.deployContract({
      abi: mockErc20Artifact.abi,
      bytecode: mockErc20Artifact.bytecode as Hex,
      args: ["Token B", "TKB", 18],
    });
    const tokenBReceipt = await publicClient.waitForTransactionReceipt({ hash: tokenBTx });
    tokenBAddress = tokenBReceipt.contractAddress!;

    expect(tokenAAddress).toBeDefined();
    expect(tokenBAddress).toBeDefined();

    // Mint 1000 TokenA to user
    const mintAmount = parseUnits("1000", 18);
    const mintTx = await deployerWallet.writeContract({
      address: tokenAAddress,
      abi: mockErc20Artifact.abi,
      functionName: "mint",
      args: [userAccount.address, mintAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: mintTx });

    // Seed Router with TokenB liquidity so it can fulfill swaps
    const seedAmount = parseUnits("10000", 18);
    const seedTx = await deployerWallet.writeContract({
      address: tokenBAddress,
      abi: mockErc20Artifact.abi,
      functionName: "mint",
      args: [ROUTER_ADDRESS, seedAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: seedTx });

    // 2. Generate local Keeper wallet
    const keeper = generateKeeperWallet();
    expect(keeper.address).toBeDefined();
    expect(keeper.privateKey).toBeDefined();

    // 3. Fund Keeper with Gas from user wallet
    const fundTxHash = await fundKeeperGas(
      userEip1193Provider,
      userAccount.address,
      keeper.address,
      "0.1"
    );
    expect(fundTxHash.startsWith("0x")).toBe(true);
    await publicClient.waitForTransactionReceipt({ hash: fundTxHash });

    // Verify Keeper Gas balance
    const keeperGas = await fetchKeeperGasBalance(keeper.address, RPC_URL);
    expect(keeperGas.balanceWei).toBe(parseEther("0.1"));
    expect(keeperGas.isLowGas).toBe(false);

    // 4. Bind Keeper to ProxyTrader on-chain
    const bindTxHash = await sendSetKeeperTransaction(
      userEip1193Provider,
      userAccount.address,
      PROXY_TRADER_ADDRESS,
      keeper.address
    );
    await publicClient.waitForTransactionReceipt({ hash: bindTxHash });

    // Verify on-chain binding using read contract
    const onChainKeeper = await publicClient.readContract({
      address: PROXY_TRADER_ADDRESS,
      abi: UNISWAP_V2_PROXY_TRADER_ABI,
      functionName: "keepers",
      args: [userAccount.address],
    });
    expect(onChainKeeper.toLowerCase()).toBe(keeper.address.toLowerCase());

    // 5. User approves TokenA to ProxyTrader
    const tradeAmount = parseUnits("10", 18);
    const approveTxHash = await approveToken(
      userEip1193Provider,
      userAccount.address,
      PROXY_TRADER_ADDRESS,
      tokenAAddress,
      tradeAmount
    );
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

    // 6. Execute Silent Automated Trade using Keeper private key (Zero wallet popup!)
    const expectedOut = tradeAmount; // 1:1 on MockRouter
    const tradeResult = await executeKeeperSwap({
      keeperPrivateKey: keeper.privateKey,
      proxyAddress: PROXY_TRADER_ADDRESS,
      userAddress: userAccount.address,
      tokenIn: tokenAAddress,
      tokenOut: tokenBAddress,
      amountIn: tradeAmount,
      expectedAmountOut: expectedOut,
      slippagePercent: 1.0,
      chainId: CHAIN_ID,
      rpcUrl: RPC_URL,
    });

    expect(tradeResult.txHash).toBeDefined();
    expect(tradeResult.keeperAddress.toLowerCase()).toBe(keeper.address.toLowerCase());
    expect(tradeResult.userAddress.toLowerCase()).toBe(userAccount.address.toLowerCase());

    // Wait for trade receipt on local chain
    const swapReceipt = await publicClient.waitForTransactionReceipt({
      hash: tradeResult.txHash,
    });
    expect(swapReceipt.status).toBe("success");

    // 7. Assert Zero-Theft Guarantee: User received TokenB directly
    const userTokenBBalance = (await publicClient.readContract({
      address: tokenBAddress,
      abi: mockErc20Artifact.abi,
      functionName: "balanceOf",
      args: [userAccount.address],
    })) as bigint;

    expect(userTokenBBalance).toBeGreaterThanOrEqual(expectedOut);

    // Assert Zero-Residual Guarantee: ProxyTrader contract holds 0 residual tokens
    const proxyTokenABalance = (await publicClient.readContract({
      address: tokenAAddress,
      abi: mockErc20Artifact.abi,
      functionName: "balanceOf",
      args: [PROXY_TRADER_ADDRESS],
    })) as bigint;
    const proxyTokenBBalance = (await publicClient.readContract({
      address: tokenBAddress,
      abi: mockErc20Artifact.abi,
      functionName: "balanceOf",
      args: [PROXY_TRADER_ADDRESS],
    })) as bigint;

    expect(proxyTokenABalance).toBe(0n);
    expect(proxyTokenBBalance).toBe(0n);

    // 8. Verify Keeper paid the gas
    const updatedKeeperGas = await fetchKeeperGasBalance(keeper.address, RPC_URL);
    expect(updatedKeeperGas.balanceWei).toBeLessThan(parseEther("0.1"));

    // 9. Remove Keeper binding and verify on-chain
    const removeTxHash = await sendRemoveKeeperTransaction(
      userEip1193Provider,
      userAccount.address,
      PROXY_TRADER_ADDRESS
    );
    await publicClient.waitForTransactionReceipt({ hash: removeTxHash });

    const removedKeeper = await publicClient.readContract({
      address: PROXY_TRADER_ADDRESS,
      abi: UNISWAP_V2_PROXY_TRADER_ABI,
      functionName: "keepers",
      args: [userAccount.address],
    });
    expect(removedKeeper).toBe("0x0000000000000000000000000000000000000000");
  });
});
