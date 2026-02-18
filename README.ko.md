[English](README.md) | **한국어**

# plumise-mcp

[![npm version](https://img.shields.io/npm/v/plumise-mcp)](https://www.npmjs.com/package/plumise-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Badge](https://lobehub.com/badge/mcp/mikusnuz-plumise-mcp)](https://lobehub.com/mcp/mikusnuz-plumise-mcp)

[Plumise](https://plumise.com) 블록체인을 위한 MCP (Model Context Protocol) 서버입니다. 체인 조회, 지갑 운용, 에이전트 네트워크, 보상, AI 추론을 아우르는 24개 도구를 제공하여 Claude 및 MCP 호환 AI 어시스턴트가 체인과 직접 상호작용할 수 있도록 합니다.

## 요구사항

- Node.js 18 이상
- Plug RPC API 키 ([여기서 발급](https://plug.plumise.com))
- (선택) Plumise 지갑 개인키 — 트랜잭션(전송, 보상 청구, 입금)에 필요

## 빠른 시작

### Claude Desktop

Claude Desktop 설정 파일(`~/Library/Application Support/Claude/claude_desktop_config.json`, macOS 기준)에 아래 내용을 추가하세요:

```json
{
  "mcpServers": {
    "plumise": {
      "command": "npx",
      "args": ["-y", "plumise-mcp"],
      "env": {
        "PLUMISE_RPC_URL": "https://plug.plumise.com/rpc/YOUR_API_KEY",
        "PLUMISE_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### 직접 실행

```bash
PLUMISE_RPC_URL=https://plug.plumise.com/rpc/YOUR_API_KEY PLUMISE_PRIVATE_KEY=0x... npx plumise-mcp
```

## 환경 변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `PLUMISE_RPC_URL` | 예 | Plug RPC 엔드포인트 ([키 발급](https://plug.plumise.com)) |
| `PLUMISE_PRIVATE_KEY` | 아니오 | 지갑 개인키 (트랜잭션 활성화; 없으면 읽기 전용) |
| `PLUMISE_NETWORK` | 아니오 | `mainnet` 또는 `testnet` (기본값: `mainnet`) |
| `PLUMISE_INFERENCE_API_URL` | 아니오 | 커스텀 추론 API 엔드포인트 |

## 도구 (Tools)

### 체인 (7개)

| 도구 | 설명 |
|---|---|
| `get_block` | 블록 번호 또는 `"latest"`로 블록 정보 조회 |
| `get_transaction` | 트랜잭션 해시로 상세 정보 조회 |
| `get_transaction_receipt` | 상태, 가스 사용량, 로그가 포함된 영수증 조회 |
| `get_block_number` | 최신 블록 높이 조회 |
| `get_gas_price` | 현재 가스 가격 조회 |
| `get_chain_info` | 체인 종합 정보 조회 (chainId, 블록, 가스) |
| `get_logs` | 주소 및 블록 범위로 필터링된 이벤트 로그 조회 |

### 지갑 (4개)

| 도구 | 설명 |
|---|---|
| `get_balance` | 임의 주소의 PLM 잔액 조회 |
| `transfer` | PLM 전송 |
| `get_nonce` | 주소의 트랜잭션 횟수 조회 |
| `get_code` | 주소가 스마트 컨트랙트인지 확인 |

### 에이전트 네트워크 (3개)

| 도구 | 설명 |
|---|---|
| `agent_status` | 에이전트 주소의 등록 상세 정보 조회 |
| `agent_list` | 네트워크 내 모든 활성 에이전트 목록 |
| `network_stats` | 네트워크 전체 통계 |

### 보상 (5개)

| 도구 | 설명 |
|---|---|
| `pending_reward` | 미청구 보상 잔액 조회 |
| `claim_reward` | 누적 보상 청구 |
| `reward_history` | 과거 보상 청구 이력 조회 |
| `epoch_info` | 현재 에포크 번호 및 점수 산정 가중치 조회 |
| `contribution` | 에이전트 기여도 지표 조회 (태스크 수, 업타임, 점수) |

### 추론 (2개)

| 도구 | 설명 |
|---|---|
| `inference` | AI 추론 요청 전송 |
| `model_status` | 사용 가능한 모델 및 상태 조회 |

### 결제 (4개)

| 도구 | 설명 |
|---|---|
| `inference_balance` | 크레딧 잔액 및 현재 티어 조회 |
| `inference_deposit` | 추론 크레딧 구매를 위한 PLM 입금 |
| `inference_withdraw` | 크레딧 잔액에서 PLM 출금 |
| `estimate_cost` | 입력 기준 추론 비용 추정 |

## 리소스 (Resources)

MCP 리소스는 현재 상태에 대한 구조화된 컨텍스트를 제공합니다:

| 리소스 | 설명 |
|---|---|
| `plumise://network` | 네트워크 개요 (체인 정보, 활성 에이전트, 에포크) |
| `plumise://wallet` | 지갑 정보 (주소, 잔액, 논스) |

## 프롬프트 (Prompts)

자주 사용하는 워크플로우를 위한 내장 프롬프트 템플릿입니다:

| 프롬프트 | 설명 |
|---|---|
| `network_status` | 네트워크 전체 상태 점검 실행 |
| `wallet_overview` | 지갑 재무 현황 및 미청구 보상 요약 |

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

## Plumise 소개

Plumise는 geth 포크로 구축된 AI 네이티브 레이어 1 블록체인(chainId 41956)입니다. 온체인 에이전트 등록, 추론 결제 정산, 분산 AI 추론 노드를 인센티브화하는 보상 시스템을 도입합니다.

- **체인**: Plumise 메인넷 (chainId 41956)
- **블록 보상**: 10 PLM/블록, 약 4년마다 반감기
- **핵심 라이브러리**: [`@plumise/core`](https://www.npmjs.com/package/@plumise/core) (viem 기반)

## 라이선스

MIT
