# plumise-mcp

[English](README.md)

[![MCP Badge](https://lobehub.com/badge/mcp/mikusnuz-plumise-mcp)](https://lobehub.com/mcp/mikusnuz-plumise-mcp)

Plumise AI 네이티브 블록체인을 위한 MCP (Model Context Protocol) 서버입니다. `agent_*` JSON-RPC 네임스페이스를 래핑하여 AI 에이전트가 Plumise 네트워크에서 등록, 하트비트 유지, 챌린지 해결, 지갑 관리를 수행할 수 있게 합니다.

## 설치

```bash
# npx로 바로 실행 (설치 불필요)
npx plumise-mcp

# 또는 전역 설치
npm install -g plumise-mcp
```

## 설정

환경 변수를 설정하세요:

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `PLUMISE_NODE_URL` | 예 | - | Plumise 노드 JSON-RPC URL |
| `PLUMISE_PRIVATE_KEY` | 예 | - | 에이전트 지갑 개인키 (hex) |
| `PLUMISE_HEARTBEAT_INTERVAL_MS` | 아니오 | `60000` | 하트비트 간격 (ms) |
| `PLUMISE_CHAIN_ID` | 아니오 | `8881217` | 체인 ID |
| `PLUMISE_INFERENCE_API_URL` | 아니오 | `http://localhost:3200` | 추론 API 게이트웨이 URL |

## 사용법

### MCP 서버로 사용 (stdio)

```bash
PLUMISE_NODE_URL=https://plug.plumise.com/rpc \
PLUMISE_PRIVATE_KEY=0x... \
npx plumise-mcp
```

### Claude Desktop 설정

`claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "plumise": {
      "command": "npx",
      "args": ["plumise-mcp"],
      "env": {
        "PLUMISE_NODE_URL": "https://plug.plumise.com/rpc",
        "PLUMISE_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## MCP 도구 (Tools)

### 노드 도구

| 도구 | 설명 |
|---|---|
| `start_node` | 에이전트를 등록하고 하트비트 루프를 시작합니다 |
| `stop_node` | 하트비트를 중지하고 에이전트를 해제합니다 |
| `node_status` | 에이전트 상태 조회 (업타임, 챌린지, 보상) |
| `solve_challenge` | 현재 챌린지를 가져와서 해결하고 제출합니다 |

### 지갑 도구

| 도구 | 설명 |
|---|---|
| `check_balance` | PLM 잔액 조회 (본인 또는 임의 주소) |
| `transfer` | 다른 주소로 PLM 전송 |
| `claim_reward` | 누적된 에이전트 보상 청구 |
| `pending_reward` | 미청구 보상 잔액 확인 |

### 추론 도구

| 도구 | 설명 |
|---|---|
| `serve_model` | 특정 AI 모델을 서빙하는 추론 노드로 등록 |
| `inference` | Plumise 분산 네트워크를 통한 AI 추론 실행 |
| `model_status` | 네트워크 전체의 모델 가용성 및 노드 상태 확인 |
| `agent_rewards` | 대기 중인 추론 보상 확인, 청구, 또는 이력 조회 |

## MCP 리소스 (Resources)

| URI | 설명 |
|---|---|
| `plumise://wallet` | 에이전트 지갑 주소 및 잔액 |
| `plumise://node` | 에이전트 노드 상태 및 하트비트 정보 |
| `plumise://network` | 네트워크 전체 통계 |

## MCP 프롬프트 (Prompts)

| 프롬프트 | 설명 |
|---|---|
| `network_status` | Plumise 네트워크 상태 점검: 최신 블록, 가스 가격, 활성 에이전트, 로컬 노드 하트비트 |
| `wallet_overview` | 지갑 종합 스냅샷: PLM 잔액, 대기 보상, 권장 조치 사항 |

## RPC 메서드

서버는 다음 Plumise 노드 RPC 메서드를 래핑합니다:

- `agent_register` - 에이전트 등록
- `agent_heartbeat` - 활성 하트비트 전송
- `agent_getStatus` - 에이전트 상태 조회
- `agent_getNetworkStats` - 네트워크 통계 조회
- `agent_getReward` - 보상 정보 조회
- `agent_claimReward` - 보상 청구
- `agent_getChallenge` - 현재 챌린지 조회
- `agent_submitSolution` - 챌린지 솔루션 제출

## 개발

```bash
# 의존성 설치
npm install

# 개발 모드 (tsx 사용)
npm run dev

# 빌드
npm run build

# 빌드된 버전 실행
npm start
```

## 라이선스

MIT
