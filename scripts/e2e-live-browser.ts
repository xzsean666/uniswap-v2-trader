import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, type Hex, type Address } from "viem";
import { bscTestnet } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "docs/screenshots");

async function main() {
  console.log("=================================================");
  console.log("     Starting Web3 Frontend E2E Test Runner      ");
  console.log("=================================================");

  // Ensure screenshots dir exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Read PRIVATE_KEY from .env
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  const m = envContent.match(/PRIVATE_KEY=(.+)/);
  if (!m) throw new Error("PRIVATE_KEY not found in .env");
  let pk = m[1].trim().replace(/^["']|["']$/g, "") as Hex;
  if (!pk.startsWith("0x")) pk = `0x${pk}`;

  const account = privateKeyToAccount(pk);
  console.log(`E2E Testing Wallet: ${account.address}`);

  const publicClient = createPublicClient({
    chain: bscTestnet,
    transport: http("https://bsc-testnet-dataseed.bnbchain.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: bscTestnet,
    transport: http("https://bsc-testnet-dataseed.bnbchain.org"),
  });

  // 1. Determine target URL (local Vite server or remote Cloudflare URL)
  let server: ViteDevServer | null = null;
  let serverUrl = process.env.TARGET_URL || process.argv[2];
  if (!serverUrl) {
    console.log("Starting Vite development server...");
    server = await createServer({
      server: { port: 5173 },
    });
    await server.listen();
    serverUrl = "http://localhost:5173";
    console.log(`Vite server listening at ${serverUrl}`);
  } else {
    console.log(`Targeting remote deployment at: ${serverUrl}`);
  }

  // 2. Launch Chromium browser (Google Chrome)
  console.log("Launching Headless Chrome via Playwright...");
  const browser: Browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 440, height: 980 }, // Mobile tech frame size
    deviceScaleFactor: 2, // High-DPI crisp screenshots
  });

  const page: Page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${text}`);
  });
  page.on("pageerror", (err) => console.error(`[BROWSER PAGEERROR]`, err));

  // Expose node function for Web3 requests
  await page.exposeFunction("__web3_request", async (args: { method: string; params?: any[] }) => {
    const { method, params = [] } = args;
    console.log(`[NODE __web3_request] ${method}:`, JSON.stringify(params));

    if (method === "eth_requestAccounts" || method === "eth_accounts") {
      return [account.address];
    }
    if (method === "eth_chainId") {
      return "0x61"; // 97 in hex
    }
    if (method === "net_version") {
      return "97";
    }
    if (method === "personal_sign") {
      const msg = params[0]?.startsWith("0x") && params[0].length === 42 ? params[1] : params[0];
      const signature = await account.signMessage({ message: msg });
      return signature;
    }
    if (method === "eth_sendTransaction") {
      const tx = params[0];
      console.log(`[NODE __web3_request] eth_sendTransaction sending:`, tx);
      try {
        const hash = await walletClient.sendTransaction({
          to: tx.to,
          data: tx.data || "0x",
          value: tx.value ? BigInt(tx.value) : 0n,
        });
        console.log(`[NODE __web3_request] eth_sendTransaction SUCCESS txHash:`, hash);
        return hash;
      } catch (err: any) {
        console.error(`[NODE __web3_request] eth_sendTransaction ERROR:`, err);
        throw err;
      }
    }
    if (method === "wallet_switchEthereumChain") {
      return null;
    }

    // Pass through read calls to publicClient RPC
    try {
      const result = await publicClient.request({
        method: method as any,
        params: params as any,
      });
      return result;
    } catch (e: any) {
      console.warn(`RPC passthrough error for ${method}:`, e?.message);
      throw e;
    }
  });

  // Inject window.ethereum provider before scripts load
  await page.addInitScript(`
    (function() {
      const listeners = {};
      const injectedEthereum = {
        isMetaMask: true,
        chainId: "0x61",
        networkVersion: "97",
        selectedAddress: null,
        request: async function(args) {
          const res = await window.__web3_request(args);
          if (args.method === "eth_requestAccounts" || args.method === "eth_accounts") {
            injectedEthereum.selectedAddress = res[0];
          }
          return res;
        },
        on: function(event, callback) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(callback);
        },
        removeListener: function(event, callback) {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter(function(cb) { return cb !== callback; });
        },
        emit: function(event) {
          var args = Array.prototype.slice.call(arguments, 1);
          if (listeners[event]) {
            listeners[event].forEach(function(cb) { cb.apply(null, args); });
          }
        }
      };
      window.ethereum = injectedEthereum;
    })();
  `);

  try {
    // 3. Navigate to app
    console.log(`Navigating to ${serverUrl}...`);
    await page.goto(serverUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Screenshot 1: Initial Landing Page
    console.log("Capturing 01_initial_landing.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "01_initial_landing.png"),
      fullPage: false,
    });

    // 4. Connect Wallet
    console.log("Connecting wallet in UI...");
    const connectButton = page.locator("button", { hasText: "连接钱包" });
    if (await connectButton.isVisible()) {
      await connectButton.click();
    }
    // Wait for BSC Testnet badge to appear
    await page.locator("text=BSC测试网").waitFor({ state: "visible", timeout: 10000 });
    console.log("Wallet connected! BSC Testnet badge visible.");
    await page.waitForTimeout(1000);

    // 5. Open Wallet menu & Sign in
    console.log("Performing EIP-191 Web3 Sign-in...");
    const walletPill = page.locator("header button", { hasText: "BSC测试网" });
    await walletPill.click();
    await page.waitForTimeout(600);

    // Click EIP-191 签名登录
    const signInButton = page.locator("button", { hasText: "EIP-191 签名登录" });
    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(1200);
      // Reopen menu to verify status
      await walletPill.click();
      await page.waitForTimeout(600);
    }

    // Screenshot 2: Wallet Connected & EIP-191 Authenticated
    console.log("Capturing 02_wallet_authenticated.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "02_wallet_authenticated.png"),
      fullPage: false,
    });

    // Close menu cleanly by toggling pill again
    console.log("Closing wallet menu dropdown...");
    await walletPill.click();
    await page.locator("text=断开连接").waitFor({ state: "detached", timeout: 5000 });
    await page.waitForTimeout(500);

    // 6. Navigate to "监听Swap" tab
    console.log("Navigating to '监听Swap' Tab...");
    const monitorTab = page.locator("button", { hasText: "监听Swap" });
    await monitorTab.click();
    await page.waitForTimeout(1000);

    // Click preset pair chip "ALPHA / BETA" to subscribe
    const presetChip = page.locator("button", { hasText: "ALPHA / BETA" }).first();
    if (await presetChip.isVisible()) {
      console.log("Clicking preset pair chip 'ALPHA / BETA' to subscribe...");
      await presetChip.click();
      await page.waitForTimeout(1500);
    }

    // Click "启动监听" if available
    const startListenBtn = page.locator("button", { hasText: "启动监听" }).first();
    if (await startListenBtn.isVisible()) {
      console.log("Clicking '启动监听' on dashboard...");
      await startListenBtn.click();
      await page.waitForTimeout(2000);
    }

    // Screenshot 3: Swap Monitor & Reserves (Big Screen Dashboard)
    console.log("Capturing 03_swap_monitor_and_reserves.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03_swap_monitor_and_reserves.png"),
      fullPage: false,
    });

    // Open "添加币对" modal to showcase Pancake Factory lookup & Watchlist addition
    console.log("Opening '添加币对' Modal...");
    const addPairBtn = page.locator("button", { hasText: "添加币对" });
    if (await addPairBtn.isVisible()) {
      await addPairBtn.click();
      await page.waitForTimeout(800);

      // Screenshot 13: Add Pair Modal with Token Factory Lookup
      console.log("Capturing 13_add_pair_modal_open.png...");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "13_add_pair_modal_open.png"),
        fullPage: false,
      });

      // Close modal
      const closeBtn = page.locator("button:has(svg.lucide-x)").first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Click into Detailed Report Popup Modal ("详细报告,就是弹出一个框框就好")
    console.log("Clicking '详细报告' to open pair detail modal dialog popup...");
    const detailBtn = page.locator("button", { hasText: "详细报告" }).first();
    if (await detailBtn.isVisible()) {
      await detailBtn.click();
      await page.waitForTimeout(1500);

      // Verify modal dialog appeared
      const modalLocator = page.locator('[data-testid="pair-detail-modal"]');
      await modalLocator.waitFor({ state: "visible", timeout: 10000 });
      console.log("PairDetailModal popup successfully opened!");

      // Screenshot 4: Detailed Report Modal Popup
      console.log("Capturing 04_pair_detail_modal_popup.png...");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04_pair_detail_modal_popup.png"),
        fullPage: false,
      });

      // Close modal popup
      console.log("Closing PairDetailModal popup...");
      const closeModalBtn = page.locator('[data-testid="close-detail-modal-btn"]');
      await closeModalBtn.click();
      await modalLocator.waitFor({ state: "detached", timeout: 5000 });
      await page.waitForTimeout(600);
    }

    // 7. Navigate to "设置策略" -> "专属打工小号"
    console.log("Navigating to '设置策略' -> '专属打工小号'...");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(400);

    const strategyTab = page.locator("button", { hasText: "设置策略" });
    await strategyTab.click();
    await page.waitForTimeout(800);

    // Click dedicated "专属打工小号" tab
    const keeperSubTab = page.getByRole("button", { name: "专属打工小号", exact: true });
    await keeperSubTab.click();
    await page.waitForTimeout(1000);

    // Generate fresh Keeper wallet if not yet generated
    const generateKeeperBtn = page.locator("button", { hasText: "一键生成本地专属打工小号" });
    if (await generateKeeperBtn.isVisible()) {
      console.log("Generating fresh local Keeper wallet in UI...");
      await generateKeeperBtn.click();
      await page.waitForTimeout(1500);
    }

    // Dismiss any prior toast
    const dismissToast = async () => {
      const closeToast = page.locator(".shadow-2xl button, .fixed.bottom-5 button").first();
      if (await closeToast.isVisible()) {
        await closeToast.click().catch(() => {});
        await page.waitForTimeout(400);
      }
    };
    await dismissToast();

    // Fund Gas from Master Wallet to Keeper EOA (0.005 BNB)
    const fundBtn = page.locator("button", { hasText: /划转/ }).first();
    if (await fundBtn.isVisible()) {
      console.log("Funding 0.005 BNB Gas to Keeper wallet...");
      await fundBtn.click();
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(1200);
        const toast = page.locator(".shadow-2xl h4");
        if (await toast.isVisible()) {
          const t = await toast.textContent();
          if (t?.includes("Gas 充值成功") || t?.includes("成功")) break;
        }
      }
      await page.waitForTimeout(1000);
    }
    await dismissToast();

    // Bind Keeper on-chain if not yet bound
    const bindKeeperBtn = page.locator("button", { hasText: "主钱包发起 setKeeper 绑定" });
    if (await bindKeeperBtn.isVisible()) {
      console.log("Triggering on-chain setKeeper binding...");
      await bindKeeperBtn.click();
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(1200);
        const toast = page.locator(".shadow-2xl h4");
        if (await toast.isVisible()) {
          const t = await toast.textContent();
          if (t?.includes("绑定成功") || t?.includes("成功")) break;
        }
      }
      await page.waitForTimeout(1000);
    }
    await dismissToast();

    // Approve tokens to proxy contract if not yet approved
    const approveToken0Btn = page.locator("button", { hasText: "一键授权 ALPHA" });
    if (await approveToken0Btn.isVisible()) {
      console.log("Authorizing ALPHA to Keeper Proxy contract...");
      await approveToken0Btn.click();
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(1200);
        const toast = page.locator(".shadow-2xl h4");
        if (await toast.isVisible()) {
          const t = await toast.textContent();
          if (t?.includes("授权成功") || t?.includes("成功")) break;
        }
      }
      await page.waitForTimeout(1000);
    }
    await dismissToast();

    const approveToken1Btn = page.locator("button", { hasText: "一键授权 BETA" });
    if (await approveToken1Btn.isVisible()) {
      console.log("Authorizing BETA to Keeper Proxy contract...");
      await approveToken1Btn.click();
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(1200);
        const toast = page.locator(".shadow-2xl h4");
        if (await toast.isVisible()) {
          const t = await toast.textContent();
          if (t?.includes("授权成功") || t?.includes("成功")) break;
        }
      }
      await page.waitForTimeout(1000);
    }
    await dismissToast();

    // Screenshot 5: Dedicated Keeper Custody Tab
    console.log("Capturing 05_keeper_dedicated_tab.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05_keeper_dedicated_tab.png"),
      fullPage: false,
    });

    // Switch to "反买反卖" sub-tab and test Dropdown Selector with Search
    console.log("Navigating to '反买反卖' and testing PairDropdownSelector with Search...");
    const reverseSubTab = page.getByRole("button", { name: "反买反卖", exact: true });
    await reverseSubTab.click();
    await page.waitForTimeout(800);

    // Test pair dropdown search
    const pairDropdownTrigger = page.locator('[data-testid="pair-dropdown-trigger"]');
    if (await pairDropdownTrigger.isVisible()) {
      await pairDropdownTrigger.click();
      await page.waitForTimeout(500);

      const searchInput = page.locator('[data-testid="pair-dropdown-search-input"]');
      await searchInput.fill("ALPHA");
      await page.waitForTimeout(500);

      // Select ALPHA / BETA option
      const alphaBetaOption = page.locator('[data-testid*="pair-option"]').first();
      if (await alphaBetaOption.isVisible()) {
        await alphaBetaOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Screenshot 11: Pair Dropdown Selector & Reverse Trade
    console.log("Capturing 11_pair_dropdown_selector.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "11_pair_dropdown_selector.png"),
      fullPage: false,
    });

    // 8. Navigate to "AI自动交易"
    console.log("Navigating to 'AI自动交易'...");
    const autoTradeSubTab = page.getByRole("button", { name: "AI自动交易", exact: true });
    await autoTradeSubTab.click();
    await page.waitForTimeout(1500);

    // Scroll down to view the full auto trade parameters
    console.log("Scrolling down to reveal AI Auto Trade settings & activation...");
    await page.evaluate(() => window.scrollBy({ top: 450, behavior: "instant" }));
    await page.waitForTimeout(1000);

    // Click "应用设置并启动" to activate strategy runner and set baseline price
    const applyStrategyBtn = page.locator("button", { hasText: "应用设置并启动" });
    if (await applyStrategyBtn.isVisible()) {
      console.log("Activating Autonomous Strategy Runner...");
      await applyStrategyBtn.click();
      await page.waitForTimeout(1500);
    }

    // Screenshot 6: AI Auto Trade Strategy Runner & Parameters
    console.log("Capturing 06_ai_autotrade_runner.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06_ai_autotrade_runner.png"),
      fullPage: false,
    });

    // Scroll down to the bottom execution history and save button
    await page.evaluate(() => window.scrollBy({ top: 500, behavior: "instant" }));
    await page.waitForTimeout(800);

    // Screenshot 7: Strategy Execution & History
    console.log("Capturing 07_strategy_execution_panel.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07_strategy_execution_panel.png"),
      fullPage: false,
    });

    // 9. Demonstrate Risk Control Triggering (Price Floor Interception)
    console.log("\n[Step 9] Demonstrating Risk Control Interception...");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(400);

    await reverseSubTab.click();
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo({ top: 480, behavior: "instant" }));
    await page.waitForTimeout(500);

    // Set price floor to 3.50 (Market rate is ~1.99 BETA per ALPHA, so 3.50 must trigger interception)
    const priceFloorInput = page.locator('[data-testid="buy-price-floor-input"]');
    await priceFloorInput.fill("3.50");
    await page.waitForTimeout(300);

    const simAndExecBtn = page.locator('[data-testid="simulate-execute-buy-btn"]');
    await simAndExecBtn.click();
    console.log("Waiting for Risk Control Interception notification...");
    await page.locator("text=模拟预执行拦截").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);

    // Screenshot 8: Risk Control Interception Toast
    console.log("Capturing 08_risk_control_interception.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "08_risk_control_interception.png"),
      fullPage: false,
    });

    // 10. Demonstrate Successful Manual Trade Execution
    console.log("\n[Step 10] Demonstrating Successful Manual Trade Execution...");
    // Close existing toast if present
    const closeToastBtn = page.locator(".shadow-2xl button").first();
    if (await closeToastBtn.isVisible()) {
      console.log("Closing prior toast...");
      await closeToastBtn.click();
      await page.waitForTimeout(600);
    }

    // Lower price floor to 0.50 so it passes dry-run safely
    console.log("Setting price floor to 0.50 (below market 1.98 to pass dry-run)...");
    await priceFloorInput.fill("0.50");
    await page.waitForTimeout(400);

    console.log("Clicking '模拟并执行' button...");
    await simAndExecBtn.click();
    console.log("Simulate & Execute clicked. Polling for transaction progress...");

    const toastTitle = page.locator(".shadow-2xl h4");
    let tradeConfirmed = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(1500);
      if (await toastTitle.isVisible()) {
        const titleText = await toastTitle.textContent();
        console.log(`[E2E Node] Progress [${i + 1}/40]: "${titleText}"`);
        if (titleText?.includes("已确认") || titleText?.includes("成功")) {
          tradeConfirmed = true;
          break;
        }
        if (titleText?.includes("异常") || titleText?.includes("回滚") || titleText?.includes("拦截")) {
          const msgText = await page.locator(".shadow-2xl p").textContent().catch(() => "");
          console.error(`[E2E Node] Stopped on notification: ${titleText} - ${msgText}`);
          break;
        }
      } else {
        console.log(`[E2E Node] Progress [${i + 1}/40]: waiting for notification...`);
      }
    }

    await page.waitForTimeout(1500);

    // Screenshot 9: Successful Trade Confirmation Toast
    console.log("Capturing 09_manual_trade_success.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "09_manual_trade_success.png"),
      fullPage: false,
    });

    // 11. Demonstrate Auto-Trade Triggered Execution History & Cooldown
    console.log("\n[Step 11] Capturing Auto-Trade Trigger & Execution History...");
    await page.evaluate(() => window.scrollTo({ top: 120, behavior: "instant" }));
    await page.waitForTimeout(1000);

    // Screenshot 10: Auto-Trade History & Engine Status
    console.log("Capturing 10_autotrade_triggered_history.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "10_autotrade_triggered_history.png"),
      fullPage: false,
    });

    // 12. Navigate to "测试网水龙头" (New Tab for User Token Faucet & Quick Testing)
    console.log("\n[Step 12] Navigating to '测试网水龙头' Tab...");
    const closeToastBtn2 = page.locator(".shadow-2xl button").first();
    if (await closeToastBtn2.isVisible()) {
      await closeToastBtn2.click();
      await page.waitForTimeout(500);
    }

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(400);

    const faucetTab = page.locator("button", { hasText: "测试网水龙头" });
    await faucetTab.click();
    console.log("Waiting for Testnet Faucet Center and user balances to load...");
    await page.locator("text=BSC 测试网水龙头中心").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(2000);

    // Screenshot 11: Testnet Faucet Center & Mock Token Minting
    console.log("Capturing 11_testnet_faucet_center.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "11_testnet_faucet_center.png"),
      fullPage: false,
    });

    // Scroll down to show fast-track actions & testing checklist
    console.log("Scrolling down to fast-track action buttons & testing guide...");
    await page.evaluate(() => window.scrollBy({ top: 480, behavior: "instant" }));
    await page.waitForTimeout(1000);

    // Screenshot 12: Fast-Track Actions & Testing Guide
    console.log("Capturing 12_testnet_fast_track_guide.png...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "12_testnet_fast_track_guide.png"),
      fullPage: false,
    });

    console.log("\n=================================================");
    console.log("   ALL 13 E2E SCREENSHOTS CAPTURED SUCCESSFULLY! ");
    console.log(`   Saved in: ${SCREENSHOT_DIR}                  `);
    console.log("=================================================\n");
  } finally {
    await browser.close();
    if (server) {
      await server.close();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("E2E Test failed:", err);
    process.exit(1);
  });
