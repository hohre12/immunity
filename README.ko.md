# Immunity

**AI 에이전트는 자기 작업을 스스로 검증하지 못합니다.** Immunity가 이 문제를 해결합니다.

[English](./README.md)

---

## 문제

AI 에이전트는 코드를 빠르게 만듭니다. 하지만 자기 실수를 잘 못 잡습니다.

방금 코드를 만든 에이전트에게 "리뷰해줘"라고 하면 "잘 작성되었습니다"라고 답합니다 — 왜 그렇게 만들었는지 이미 알고 있으니까요. 이건 프롬프트 문제가 아닙니다. 구조적 문제입니다.

이 문제는 4가지 증상으로 나타납니다:

| 증상 | 무슨 일이 일어나는가 |
|------|-------------------|
| **자기 확증 편향** | 자기가 만든 코드를 객관적으로 비판하지 못함 |
| **기억 상실** | 세션 A의 결정을 세션 B의 에이전트가 모름 |
| **터널 비전** | 한 파일만 고치고 영향받는 다른 파일을 확인 안 함 |
| **관점 부재** | 코드가 "동작"은 하지만 프로덕션에서 버틸 수 없음 |

## 해결

Immunity는 각 증상에 대응하는 4개의 스킬을 제공합니다:

```
/immunity:critic     → 별도 에이전트가 코드를 만든 이유를 모른 채 리뷰
/immunity:contracts  → 중요한 결정이 검증 가능한 규칙으로 세션 간 유지
/immunity:ripple     → 변경의 영향을 받는 모든 코드를 추적
/immunity:prodlens   → 프로덕션 운영 관점에서 코드를 분석
```

`/critic`이 가장 임팩트가 큽니다 — 먼저 써보세요.

---

## 설치

```
/plugin marketplace add hohre12/immunity
/plugin install immunity@hohre12-immunity
```

또는 로컬 개발용:

```bash
git clone https://github.com/hohre12/immunity.git
claude --plugin-dir ./immunity
```

**서버 없음. DB 없음. 런타임 없음.** 마크다운 파일만 있으면 됩니다.

---

## /critic — 비판적 코드 리뷰

핵심 스킬. 메커니즘은 **컨텍스트 격리**입니다.

같은 에이전트에게 리뷰를 요청하면:

```
Agent: "이 코드는 사용자의 요구사항에 맞게 잘 작성되었습니다."
       (왜 만들었는지 알고 있으므로 → 정당화)
```

`/critic`이 별도 서브에이전트에게 코드만 전달하면:

```
Critic: "retry 루프에서 동일한 transactionId를 재사용합니다.
         PG사가 중복 요청으로 거부할 수 있습니다."
        (왜 만들었는지 모르므로 → 코드만 판단)
```

이건 프롬프트 트릭이 아닙니다. 서브에이전트는 부모 대화에 구조적으로 접근할 수 없습니다. 편향이 아키텍처 레벨에서 제거됩니다.

```
/immunity:critic src/services/payment/charge.ts
```

30초 후, 높은 신뢰도의 발견만 포함된 리포트를 받습니다:

```
── Critic Report ──

Critical (즉시 수정 필요)
┌─────────────────────────────────────────────┐
│ [BUG] charge.ts:47                          │
│ Retry에서 동일 transactionId 재사용.          │
│ Fix: 각 retry마다 새 transactionId 생성      │
└─────────────────────────────────────────────┘

Warning (검토 권장)
┌─────────────────────────────────────────────┐
│ [PRODUCTION] charge.ts:23                   │
│ 외부 PG API에 timeout 미설정.                │
│ Fix: axios timeout 5000ms 설정              │
└─────────────────────────────────────────────┘

Score: critical 1 / warning 1
```

보고 기준:
- `certain` (95%+) 또는 `likely` (75-95%) 신뢰도만 보고
- 코드 스타일, 네이밍, 주석 취향은 보고하지 않음
- 확신할 수 없으면 보고하지 않음 — 잘못된 경고 하나가 신뢰를 무너뜨림

---

## /contracts — 자기 검증 에이전트 메모리

CLAUDE.md에 "이렇게 해줘"라고 쓰는 것은 **부탁**입니다. Contract는 위반을 **잡아냅니다.**

```
/immunity:contracts src/services/payment/
```

Claude가 코드를 분석하고 계약을 제안합니다. 사용자가 선택합니다:

```yaml
# .contracts/payment-idempotency.yml
name: payment-idempotency
assertion: "모든 결제 요청에 멱등성 키가 포함되어야 한다"
scope:
  - "src/services/payment/**"
checks:
  - type: pattern_present
    pattern: "idempotencyKey|idempotency_key"
    in: "src/services/payment/**"
```

다음 세션에서 다른 에이전트가 결제 코드를 수정하면 → 계약 위반 감지 → 즉시 알림.

`.contracts/`를 git에 커밋하면 팀 전체의 에이전트가 같은 규칙을 지킵니다.

---

## /ripple — 관련 기능 연쇄 검증

```
/immunity:ripple src/services/UserService.ts
```

import graph만으로는 부족합니다. 같은 패턴을 쓰는 코드를 놓칩니다.

```
UserService.update() 수정됨
├── Direct: UserController (import 관계)
├── Behavioral: OrderService.update() (동일 패턴: 낙관적 락 + 이벤트 발행)
└── Contract: user-data-integrity (재검증 필요)
```

휴리스틱이라 정밀하지 않지만, 아무것도 확인하지 않는 것보다 확실히 낫습니다.

---

## /prodlens — 프로덕션 관점 렌즈

```
/immunity:prodlens src/services/payment/
```

프로덕션 운영 관점에서 6가지 고정 축으로 분석합니다:

| 축 | 확인하는 것 |
|----|-----------|
| Concurrency | race condition, 데드락, 격리 수준 |
| Error Recovery | 장애 복구 경로, 트랜잭션 정합성 |
| Observability | 로깅, 메트릭, 알림 |
| Security | 인젝션, 인증 우회, 정보 노출 |
| Rate Limiting | 외부 API 제한, 사용자 요청 제한 |
| Input Validation | 경계값, 타입, 크기 |

```
Production Readiness: 4/6
```

---

## Before / After

**Before:**

```
세션 1: Claude가 결제 로직 작성. 멱등성 키 포함.
세션 2: 다른 Claude가 수정. 멱등성 키 제거됨. 아무도 모름.
세션 3: "리뷰해줘" → "잘 짜여진 코드입니다" (자기 확증 편향)
세션 4: 배포 후 중복 결제. 장애.
```

**After:**

```
세션 1: Claude가 결제 로직 작성. /contracts → 멱등성 계약 생성.
세션 2: 다른 Claude가 수정 시도 → 계약 위반 감지.
세션 2: /critic → "timeout 미설정" 발견. /ripple → "OrderService도 확인" 알림.
세션 2: /prodlens → 프로덕션 준비도 4/6 → 부족한 2개 수정.
세션 3: 배포. 장애 없음.
```

---

## 설계 원칙

1. **파일 시스템 기반** — DB 없음, 서버 없음. `.contracts/`와 마크다운 파일이 전부
2. **점진적 채택** — `/critic` 하나만 써도 가치가 있음. 필요하면 추가
3. **git-friendly** — `.contracts/`를 커밋하면 팀 전체가 공유
4. **False positive 최소화** — 확신할 수 없으면 보고하지 않음
5. **프로토콜 우선** — Claude Code에 최적화되었지만, 어떤 AI 에이전트든 참여 가능

---

## 한계

- **Claude의 판단에 의존합니다.** Claude가 놓치면 도구도 놓칩니다.
- **API 토큰을 더 사용합니다.** 각 스킬이 코드를 읽고 분석합니다.
- **런타임 검증이 아닙니다.** `/prodlens`는 코드 리뷰이지 부하 테스트가 아닙니다.
- **`/ripple`은 휴리스틱입니다.** 패턴 기반이며 정밀한 AST 분석이 아닙니다.

이것은 AI 코드 리뷰라는 카테고리 자체의 한계입니다. Immunity는 이 제약 안에서 가능한 최대의 가치를 구조화합니다.

---

## License

MIT
