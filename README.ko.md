# Immunity

**AI가 만든 코드의 면역 체계.** 기억하고, 감지하고, 강해진다.

[English](./README.md)

---

## Immunity란?

AI 에이전트로 코드를 작성하면 3가지 문제가 반복됩니다:

1. **기억 상실** — 세션 A에서 내린 결정을 세션 B의 에이전트가 모른다
2. **자기 확인 편향** — 코드를 만든 에이전트가 자기 코드를 제대로 비판하지 못한다
3. **프로덕션 무감각** — "동작하는 코드"를 만들지만 "프로덕션 코드"를 만들지 않는다

Immunity는 이 문제를 **4개의 독립 스킬**로 해결합니다.

| 스킬 | 해결하는 문제 | 생물학적 비유 |
|------|-------------|-------------|
| `/contracts` | 에이전트 메모리 | 면역 기억 — 과거 병원체를 기억 |
| `/critic` | 비판적 검증 | 면역 반응 — 이상을 감지하고 공격 |
| `/ripple` | 관련 기능 연쇄 검증 | 면역 전파 — 감염 경로를 추적 |
| `/prodlens` | 프로덕션 관점 개선 | 면역 적응 — 더 강한 항체 생성 |

각각 독립적으로 사용할 수 있습니다. 하나만 설치해도, 네 개를 다 설치해도 됩니다.

---

## 설치

```bash
# 마켓플레이스 추가 후 설치
/plugin marketplace add hohre12/immunity
/plugin install immunity@hohre12-immunity
```

또는 로컬에서 개발/테스트:

```bash
git clone https://github.com/hohre12/immunity.git
claude --plugin-dir ./immunity
```

**서버 없음. DB 없음. 런타임 없음.** 마크다운 파일만 있으면 끝입니다.

---

## 빠른 시작

### 비판적 코드 리뷰 받기

```
/critic src/services/payment/charge.ts
```

30초 후 독립 에이전트가 놓친 버그를 찾아줍니다.

### 중요한 결정 기억시키기

```
/contracts src/services/payment/
```

"결제는 멱등해야 한다" 같은 결정이 검증 가능한 계약으로 저장됩니다. 다음 세션의 에이전트가 이 계약을 위반하면 자동으로 잡힙니다.

### 변경의 영향 범위 확인하기

```
/ripple src/services/UserService.ts
```

UserService를 고치면 OrderService도 봐야 하는지 자동으로 분석합니다.

### 프로덕션 준비도 확인하기

```
/prodlens src/services/payment/
```

동시성, 장애 복구, 관측성, 보안 — 프로덕션 관점에서 부족한 점을 구체적으로 알려줍니다.

---

## 작동 방식

### /contracts — 자기 검증 에이전트 메모리

CLAUDE.md에 "이렇게 해줘"라고 쓰는 것은 **부탁**입니다. Contract는 위반을 **잡아냅니다.**

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

에이전트가 코드를 수정할 때 Hook이 자동으로 관련 계약을 확인합니다.

### /critic — 비판적 코드 리뷰

핵심은 **컨텍스트 차단**입니다.

```
현재 대화의 Claude          →   코드"만" 전달   →   Critic 서브에이전트
(왜 만들었는지 알고 있음)        (이유는 차단)       (코드만 보고 판단)
```

코드를 만든 이유를 모르기 때문에, "사용자가 원해서 이렇게 한 거니까 괜찮겠지"라는 편향이 구조적으로 불가능합니다.

**보고 기준:**
- `certain` (95%+) 또는 `likely` (75-95%) 신뢰도만 보고
- 코드 스타일, 네이밍, 주석 부족 같은 취향은 보고하지 않음
- 확신할 수 없으면 보고하지 않음 — 잘못된 경고 하나가 신뢰를 무너뜨림

### /ripple — 관련 기능 연쇄 검증

import graph만으로는 부족합니다. 같은 패턴을 쓰는 코드를 놓칩니다.

```
UserService.update() 수정됨
├── Direct: UserController (import 관계)
├── Behavioral: OrderService.update() (동일 패턴: 낙관적 락 + 이벤트 발행)
└── Contract: user-data-integrity (재검증 필요)
```

Claude가 코드를 읽고 패턴을 식별하는 방식입니다. 완벽하지 않지만, 아무것도 확인하지 않는 것보다 확실히 낫습니다.

### /prodlens — 프로덕션 관점 개선

6가지 고정 관점으로 분석합니다:

| 관점 | 확인하는 것 |
|------|-----------|
| Concurrency | race condition, 데드락, 격리 수준 |
| Error Recovery | 장애 시 복구 경로, 트랜잭션 정합성 |
| Observability | 로깅, 메트릭, 알림 |
| Security | 인젝션, 인증 우회, 정보 노출 |
| Rate Limiting | 외부 API 호출 제한, 사용자 요청 제한 |
| Input Validation | 경계값, 타입, 크기 검증 |

---

## Before / After

**Before (Immunity 없이):**

```
세션 1: Claude가 결제 로직 작성. 멱등성 키 포함.
세션 2: 다른 Claude가 결제 로직 수정. 멱등성 키 제거됨. 아무도 모름.
세션 3: "리뷰해줘" → "잘 짜여진 코드입니다" (자기 확인 편향)
세션 4: 배포 후 중복 결제 발생. 장애.
```

**After (Immunity 사용):**

```
세션 1: Claude가 결제 로직 작성. /contracts → 멱등성 계약 생성.
세션 2: 다른 Claude가 수정 시도 → 계약 위반 감지 → 즉시 알림.
세션 2: /critic → "timeout 미설정" 발견. /ripple → "OrderService도 확인" 알림.
세션 2: /prodlens → 프로덕션 준비도 4/6 → 부족한 2개 수정.
세션 3: 배포. 장애 없음.
```

---

## 설계 원칙

1. **파일 시스템 기반** — DB 없음, 서버 없음. `.contracts/` 디렉토리와 스킬 파일이 전부
2. **프로토콜 우선** — Claude Code에 최적화되었지만, 어떤 AI 에이전트든 참여 가능
3. **점진적 채택** — 4개 중 하나만 써도 가치가 있음
4. **git-friendly** — `.contracts/`를 커밋하면 팀 전체가 공유
5. **False positive 최소화** — 확신할 수 없으면 보고하지 않음

---

## 한계

솔직한 한계:

- **Claude의 판단에 의존합니다.** Claude가 놓치면 도구도 놓칩니다.
- **API 토큰을 더 사용합니다.** 각 스킬이 코드를 읽고 분석하므로 토큰 소비가 증가합니다.
- **런타임 검증은 아닙니다.** `/prodlens`는 코드 리뷰 수준이지, 실제 부하 테스트가 아닙니다.
- **`/ripple`의 행동적 분석은 완벽하지 않습니다.** 패턴 기반 휴리스틱이며, 정밀한 AST 분석이 아닙니다.

---

## License

MIT
