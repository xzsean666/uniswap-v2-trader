#!/usr/bin/env bash
set -e

# ==============================================================================
# 本地 Hardhat 节点端到端联调全自动测试脚本
# 用途: 自动检测/启动本地节点、部署代理合约与路由、执行前端端到端测试并安全清理
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACT_DIR="${CONTRACT_DIR:-/ssd0/git/uniswap-v2-trader-contract}"
PORT=8545
RPC_URL="http://127.0.0.1:${PORT}"
NODE_SPAWNED=0
NODE_PID=""

echo "========================================================"
echo "    Uniswap V2 Trader - 本地合约节点全自动联调测试      "
echo "========================================================"
echo "[1/4] 检查合约仓库路径: ${CONTRACT_DIR}"

if [ ! -d "${CONTRACT_DIR}" ]; then
  echo "❌ 错误: 未找到合约仓库目录: ${CONTRACT_DIR}"
  exit 1
fi

cleanup() {
  if [ "$NODE_SPAWNED" -eq 1 ] && [ -n "$NODE_PID" ]; then
    echo ""
    echo "🧹 清理退出: 正在停止后台 Hardhat 本地节点 (PID: ${NODE_PID})..."
    kill "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
    echo "✅ 本地节点已安全关闭"
  fi
}
trap cleanup EXIT INT TERM

# 检查 8545 端口是否已经运行
check_node_ready() {
  curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "${RPC_URL}" 2>/dev/null | grep -q "result"
}

echo "[2/4] 探测本地 RPC 节点连通性 (${RPC_URL})..."
if check_node_ready; then
  echo "ℹ️  检测到端口 ${PORT} 已有运行中的本地节点，复用现有节点"
else
  echo "🚀 本地未运行节点，正在后台拉起 Hardhat 节点 (Chain ID: 31337)..."
  (cd "${CONTRACT_DIR}" && pnpm hardhat node > /dev/null 2>&1) &
  NODE_PID=$!
  NODE_SPAWNED=1

  # 等待节点就绪 (最长等待 15 秒)
  WAIT_COUNT=0
  until check_node_ready; do
    sleep 0.5
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ "$WAIT_COUNT" -ge 30 ]; then
      echo "❌ 错误: 本地 Hardhat 节点启动超时 (超过 15 秒)"
      exit 1
    fi
  done
  echo "✅ Hardhat 本地节点启动成功 (PID: ${NODE_PID})"
fi

echo "[3/4] 部署代理合约与 Mock 路由至本地 localhost 网络..."
(cd "${CONTRACT_DIR}" && pnpm hardhat run scripts/deploy.ts --network localhost)

echo ""
echo "[4/4] 运行前端端到端真实链上联调测试..."
cd "${FRONTEND_DIR}"
pnpm vitest run tests/integration/live-local-node.test.ts

echo ""
echo "========================================================"
echo "🎉 恭喜！本地真实节点端到端闭环测试全部通过！"
echo "========================================================"
