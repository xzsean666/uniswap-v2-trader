import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

interface TestResult {
  step: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

const RESULTS: TestResult[] = [];

function recordResult(step: string, passed: boolean, durationMs: number, message?: string) {
  RESULTS.push({ step, passed, durationMs, message });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${step}] (${durationMs}ms)${message ? ` - ${message}` : ""}`);
}

async function main() {
  const targetUrl =
    process.env.DEPLOY_URL ||
    process.argv[2] ||
    "https://uniswap-v2-trader.pages.dev";

  console.log("=================================================");
  console.log("     Cloudflare Deployment Verification Suite    ");
  console.log("=================================================");
  console.log(`Target URL: ${targetUrl}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log("-------------------------------------------------\n");

  const overallStart = Date.now();

  // ----------------------------------------------------
  // STEP 1: HTTP Status & HTML Structure Check
  // ----------------------------------------------------
  let html = "";
  {
    const start = Date.now();
    try {
      const resp = await fetch(targetUrl, {
        headers: { "User-Agent": "CF-Deployment-Verifier/1.0" },
      });
      const duration = Date.now() - start;

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      html = await resp.text();

      const hasTitle = html.includes("<title>Uniswap V2 Trader");
      const hasRoot = html.includes('id="root"');
      const cfRay = resp.headers.get("cf-ray") || "N/A";
      const server = resp.headers.get("server") || "N/A";

      if (!hasTitle || !hasRoot) {
        throw new Error("HTML body missing title or root element");
      }

      recordResult(
        "HTTP Connectivity & HTML Verification",
        true,
        duration,
        `Status: ${resp.status} OK, Server: ${server}, CF-Ray: ${cfRay}`
      );
    } catch (err: any) {
      recordResult(
        "HTTP Connectivity & HTML Verification",
        false,
        Date.now() - start,
        err.message
      );
      process.exit(1);
    }
  }

  // ----------------------------------------------------
  // STEP 2: Asset Links Accessibility Check
  // ----------------------------------------------------
  {
    const start = Date.now();
    try {
      const assetMatches = [
        ...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
      ].map((m) => m[1]);

      const uniqueAssets = Array.from(new Set(assetMatches));
      console.log(`Discovered ${uniqueAssets.length} static bundle assets.`);

      let failedAssets = 0;
      for (const assetPath of uniqueAssets) {
        const fullAssetUrl = new URL(assetPath, targetUrl).toString();
        const assetResp = await fetch(fullAssetUrl);
        if (!assetResp.ok) {
          console.error(`Asset fetch failed: ${fullAssetUrl} -> ${assetResp.status}`);
          failedAssets++;
        }
      }

      if (failedAssets > 0) {
        throw new Error(`${failedAssets} asset(s) returned non-200 responses`);
      }

      recordResult(
        "Static Assets Integrity",
        true,
        Date.now() - start,
        `All ${uniqueAssets.length} asset bundle files returned 200 OK`
      );
    } catch (err: any) {
      recordResult(
        "Static Assets Integrity",
        false,
        Date.now() - start,
        err.message
      );
    }
  }

  // ----------------------------------------------------
  // STEP 3: Playwright Headless Browser Rendering & DOM Testing
  // ----------------------------------------------------
  {
    const start = Date.now();
    let browser: Browser | null = null;
    try {
      console.log("\nLaunching Headless Chromium for full DApp E2E verification...");
      browser = await chromium.launch({
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
        viewport: { width: 440, height: 980 },
        deviceScaleFactor: 2,
      });

      const page: Page = await context.newPage();

      const pageErrors: string[] = [];
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
        console.error(`[BROWSER PAGEERROR] ${err.message}`);
      });

      // Inject mock Ethereum provider as a pure string literal to prevent esbuild helper injection
      await page.addInitScript(`
        (function() {
          window.ethereum = {
            isMetaMask: true,
            request: function(args) {
              if (args.method === 'eth_accounts' || args.method === 'eth_requestAccounts') {
                return Promise.resolve([]);
              }
              if (args.method === 'eth_chainId') {
                return Promise.resolve('0x61');
              }
              return Promise.resolve(null);
            },
            on: function() {},
            removeListener: function() {}
          };
        })();
      `);

      console.log(`Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });

      // Check root has rendered children
      await page.waitForSelector("#root > div", { timeout: 10000 });

      // Verify header elements
      const connectBtn = await page.waitForSelector("button:has-text('连接钱包')", {
        timeout: 10000,
      });
      if (!connectBtn) throw new Error("Connect Wallet button not found");

      // Verify primary navigation tabs
      const tabs = ["监听Swap", "设置策略", "测试网水龙头"];
      for (const tabText of tabs) {
        const tab = await page.waitForSelector(`button:has-text('${tabText}')`, {
          timeout: 5000,
        });
        if (!tab) throw new Error(`Primary tab "${tabText}" not rendered`);
      }

      // Verify default active Strategy sub-tabs
      const subTabs = ["反买反卖", "AI自动交易", "AI套利机器人"];
      for (const subTabText of subTabs) {
        const subTab = await page.waitForSelector(`button:has-text('${subTabText}')`, {
          timeout: 5000,
        });
        if (!subTab) throw new Error(`Sub-tab "${subTabText}" not rendered`);
      }

      // Test Tab Switching: Click "测试网水龙头"
      console.log("Testing tab switching: clicking '测试网水龙头'...");
      await page.click("button:has-text('测试网水龙头')");
      await page.waitForTimeout(600);
      const faucetTitle = await page.waitForSelector("text=BSC 测试网水龙头中心", {
        timeout: 5000,
      });
      if (!faucetTitle) throw new Error("Faucet view did not render upon tab switch");

      // Test Tab Switching: Click "监听Swap"
      console.log("Testing tab switching: clicking '监听Swap'...");
      await page.click("button:has-text('监听Swap')");
      await page.waitForTimeout(600);

      // Switch back to "设置策略"
      console.log("Testing tab switching: returning to '设置策略'...");
      await page.click("button:has-text('设置策略')");
      await page.waitForTimeout(600);

      // Verify no page errors occurred
      if (pageErrors.length > 0) {
        throw new Error(`Browser encountered ${pageErrors.length} unhandled errors: ${pageErrors.join("; ")}`);
      }

      // Capture screenshot
      const screenshotDir = path.resolve(process.cwd(), "docs/screenshots");
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const screenshotPath = path.resolve(screenshotDir, "cloudflare-live.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Saved live browser screenshot: ${screenshotPath}`);

      recordResult(
        "Playwright Browser E2E Rendering & Interactivity",
        true,
        Date.now() - start,
        "React mounted cleanly, tabs interactive, 0 console errors, screenshot captured"
      );
    } catch (err: any) {
      recordResult(
        "Playwright Browser E2E Rendering & Interactivity",
        false,
        Date.now() - start,
        err.message
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // ----------------------------------------------------
  // Summary
  // ----------------------------------------------------
  const totalDuration = Date.now() - overallStart;
  const allPassed = RESULTS.every((r) => r.passed);

  console.log("\n=================================================");
  console.log(`      Verification Summary: ${allPassed ? "ALL PASSED" : "FAILED"}`);
  console.log("=================================================");
  for (const res of RESULTS) {
    console.log(`- ${res.passed ? "PASS" : "FAIL"}: ${res.step} (${res.durationMs}ms)`);
    if (res.message) console.log(`  Details: ${res.message}`);
  }
  console.log(`Total duration: ${totalDuration}ms`);
  console.log(`Cloudflare Live URL: ${targetUrl}\n`);

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
