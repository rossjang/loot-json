# loot-json 패키지 평가 문서

## 개요

`loot-json`은 LLM(Large Language Model) 출력에서 JSON을 추출하고 복구하는 TypeScript 라이브러리입니다.

- **버전**: 0.1.0
- **라이선스**: MIT
- **의존성**: 없음 (Zero Dependency)
- **npm**: https://www.npmjs.com/package/loot-json

## 주요 기능

### 1. JSON 추출 (`loot` 함수)

LLM 출력에서 JSON을 자동으로 추출합니다.

```typescript
import { loot } from 'loot-json';

const dirtyText = `
  Sure! I found the item for you.
  \`\`\`json
  {
    "id": "sword_01",
    "damage": 50, // It's strong!
  }
  \`\`\`
`;

const item = loot(dirtyText);
// { id: "sword_01", damage: 50 }
```

### 2. 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `silent` | boolean | false | true이면 실패 시 null 반환, false이면 에러 throw |
| `repair` | boolean | true | 자동 JSON 복구 활성화 |
| `all` | boolean | false | 모든 JSON 객체 추출 |

### 3. 자동 복구 기능

| 문제 | 예시 | 수정 결과 |
|------|------|-----------|
| Trailing commas | `{ "a": 1, }` | `{ "a": 1 }` |
| Single quotes | `{ 'key': 'value' }` | `{ "key": "value" }` |
| 주석 | `{ "a": 1 // comment }` | `{ "a": 1 }` |
| Unquoted keys | `{ key: "value" }` | `{ "key": "value" }` |
| Invalid values | `{ "a": undefined }` | `{ "a": null }` |

### 4. 유틸리티 함수

```typescript
import { repairJson, findJsonCandidates, extractFromMarkdown } from 'loot-json';

// JSON만 복구 (추출 없이)
const fixed = repairJson('{ "key": "value", }');

// 텍스트에서 모든 JSON 후보 찾기
const candidates = findJsonCandidates(messyText);

// 마크다운 코드 블록에서만 추출
const fromMd = extractFromMarkdown(markdownText);
```

---

## 현재 프로젝트의 LLM JSON 파싱 현황

### 사용 중인 라이브러리

1. **json5**: LLM 출력 파싱에 주로 사용
2. **IncrementalJsonParser**: 스트리밍 응답에서 특정 필드 추출용 자체 구현

### 현재 JSON 파싱 위치

1. **`ChatV2Service.ts`**: LLM 응답 파싱의 핵심
   - `extractJsonFromContent()`: 마크다운에서 JSON 추출
   - `streamChatInternal()`: 스트리밍 응답 완료 후 `JSON.parse()` 사용
   - json5를 활용한 폴백 파싱

2. **`LLMClient.ts`**: Tool use 입력 파싱 (`JSON.parse`)

3. **`IncrementalJsonParser.ts`**: 스트리밍 중 특정 필드 추출
   - dialogue, emotion, pose, action 등의 필드 감지
   - TTS/Clip 트리거용

### 현재 에러 처리 패턴

```typescript
// ChatV2Service.ts - extractJsonFromContent
try {
  json5.parse(jsonString);
  return jsonString;
} catch (parseError) {
  try {
    const parsed = json5.parse(jsonString);
    return json5.stringify(parsed);
  } catch (json5Error) {
    throw new Error(`추출된 JSON 파싱 실패: ${parseError.message}`);
  }
}
```

```typescript
// ChatV2Service.ts - streamChatInternal
try {
  parsedData = JSON.parse(fullContent);
} catch (parseError) {
  this.logger.error(`JSON parse error: ${parseError.message}`);
  sendSlackMessage(...);
  // DB에 에러 저장
  throw parseError;
}
```

---

## loot-json vs 현재 구현 비교

| 기능 | loot-json | 현재 구현 (json5 + 자체) |
|------|-----------|-------------------------|
| Trailing comma 처리 | ✅ | ✅ (json5) |
| Single quote 처리 | ✅ | ✅ (json5) |
| 주석 제거 | ✅ | ✅ (json5) |
| Unquoted keys | ✅ | ✅ (json5) |
| undefined → null | ✅ | ❌ |
| NaN → null | ✅ | ❌ |
| Infinity → null | ✅ | ❌ |
| 마크다운 추출 | ✅ | ✅ (extractJsonFromContent) |
| 중괄호 균형 추출 | ✅ | ✅ (extractJsonFromContent) |
| TypeScript 제네릭 | ✅ | ❌ |
| 스트리밍 파싱 | ❌ | ✅ (IncrementalJsonParser) |
| 다중 JSON 추출 | ✅ | ❌ |
| 의존성 | 없음 | json5 |

---

## 우리 프로젝트에 필요한 추가 기능

### 1. 스트리밍 JSON 파싱 (Incremental Parsing) ⭐ 중요

**현재 상황**: `IncrementalJsonParser`로 자체 구현

**요청 사항**: loot-json에 스트리밍/증분 파싱 기능 추가

```typescript
// 제안 API
import { IncrementalLoot } from 'loot-json';

const parser = new IncrementalLoot<ChatResponse>({
  fields: ['dialogue', 'emotion', 'pose'], // 추적할 필드
});

for await (const chunk of llmStream) {
  const result = parser.addChunk(chunk);
  
  if (result.isFieldComplete('dialogue')) {
    // TTS 시작 가능
    startTTS(result.getField('dialogue'));
  }
}

const finalResult = parser.getResult();
```

**기대 효과**:
- TTS/Clip 생성을 위한 조기 필드 추출
- 스트리밍 응답에서 실시간 데이터 처리
- 레이턴시 개선

### 2. JSON Schema 검증 통합

**현재 상황**: Anthropic Structured Outputs 사용, 별도 검증 없음

**요청 사항**: 선택적 JSON Schema 검증 기능

```typescript
const result = loot(text, {
  schema: {
    type: 'object',
    properties: {
      dialogue: { type: 'string' },
      emotion: { type: 'string' },
      affinity: { type: 'number', minimum: -10, maximum: 10 },
    },
    required: ['dialogue', 'emotion'],
  },
  validateOnly: false, // true면 검증만, false면 수정도 시도
});
```

### 3. 필드별 추출 API

**현재 상황**: 전체 JSON 파싱 후 필드 접근

**요청 사항**: 특정 필드만 빠르게 추출

```typescript
import { lootField } from 'loot-json';

const dialogue = lootField(text, 'dialogue');
const emotion = lootField(text, 'emotion');
```

### 4. 에러 복구 상세 리포트

**현재 상황**: 파싱 실패 시 원본 텍스트만 로깅

**요청 사항**: 복구 시도 내역 반환

```typescript
const { result, repairs } = loot(text, { reportRepairs: true });
// repairs: [
//   { type: 'trailing_comma', position: 45, fixed: true },
//   { type: 'unquoted_key', key: 'emotion', fixed: true },
// ]
```

### 5. 멀티라인 문자열 복구

**현재 상황**: LLM이 때때로 줄바꿈이 포함된 문자열 생성

**요청 사항**: 이스케이프되지 않은 줄바꿈 처리

```typescript
// LLM 출력 (잘못된 형식)
{
  "dialogue": "Hello,
  how are you?"
}

// 수정 후
{
  "dialogue": "Hello,\nhow are you?"
}
```

---

## 통합 제안 (우리 프로젝트)

### Phase 1: 비-스트리밍 파싱 교체

현재 `json5.parse`를 사용하는 일반 파싱을 `loot`으로 교체:

```typescript
// Before
const data = json5.parse(this.extractJsonFromContent(llmResponse.content));

// After
import { loot } from 'loot-json';
const data = loot<ChatResponse>(llmResponse.content, { silent: false });
```

**장점**:
- 의존성 단순화 (json5 제거 가능)
- 더 나은 TypeScript 타입 지원
- 마크다운/중괄호 추출 자동 처리

### Phase 2: 스트리밍 파싱 (loot-json 기능 추가 후)

`IncrementalJsonParser`를 loot-json의 스트리밍 기능으로 교체

---

## 오픈소스 기여 요청 사항 정리

1. **스트리밍/증분 파싱 API** (Highest Priority)
   - 청크 단위 데이터 추가
   - 필드별 완료 감지
   - 부분 결과 접근

2. **JSON Schema 검증** (Medium Priority)
   - 추출된 JSON 검증
   - 검증 에러 리포트

3. **필드별 추출** (Low Priority)
   - 특정 필드만 빠르게 추출

4. **복구 리포트** (Low Priority)
   - 어떤 수정이 적용되었는지 상세 정보

5. **멀티라인 문자열 복구** (Medium Priority)
   - 이스케이프되지 않은 줄바꿈 처리

---

## 결론

loot-json은 우리 프로젝트의 LLM JSON 파싱 요구사항과 잘 맞습니다. 현재 버전(0.1.0)으로도 비-스트리밍 파싱을 대체할 수 있으며, **스트리밍 파싱 기능이 추가되면** `IncrementalJsonParser`도 대체할 수 있습니다.

**우선순위가 가장 높은 기능 요청**: 스트리밍/증분 JSON 파싱 API
