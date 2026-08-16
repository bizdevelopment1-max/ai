# 누적형 데이터 플랫폼 운영

이 저장소는 정적 사이트를 배포하지만, 원문 원장 자체를 장기 데이터베이스로 간주하지 않습니다. Git에는 코드·정책·스키마·데이터셋 매니페스트와 공개용 materialized view만 유지하는 것이 목표입니다. 현재 외부 저장소가 선택되지 않았으므로 전환 상태는 `required`로 명시하며, 구성되지 않은 외부 저장소가 있다고 가장하지 않습니다.

## 현재 적용된 구조

- `config/data-catalog.json`: 데이터셋 소유자, 민감도, 공개 여부, upstream/downstream 정의
- `schemas/*.schema.json`: 수집·정규화·공개 단계의 JSON Schema 계약
- `config/pipeline-dag.json`: 단계별 의존성과 산출물 정의
- `dataset-manifest.json`: 입력 해시, 정책 해시, 코드 기준 SHA, 공개 상태 기록
- `slo-report.json`: freshness, 직접 근거율, 재검증 대기열, 지속 수집 실패 기록
- `source-compliance-report.json`: 라이선스, robots 정책, 원문 보관 및 재배포 기준
- `scripts/minimize-retained-source-content.mjs`: 원문 전체 대신 근거 span과 해시만 장기 보관
- `scripts/archive-immutable-snapshot.mjs`: 외부 immutable 저장소가 연결된 경우 content hash 기준 보관
- `mobile-ai-business-view.json`의 `claims`·`evidenceSpans`: document → claim → evidence span 연결과 valid/system time 기록
- `config/decision-governance.json`: 16개 독립 taxonomy 축, 8개 기회 평가 기준, publication 불변조건 정의
- `scripts/validate-publication-policy.mjs`: claim 검증률·인용 완전성·검토자·승인·정책 위반·storage migration을 한 번에 검사

공개 판단 뷰와 근거 원장은 분리됩니다. 근거 수집과 감사 artifact 생성은 자동화할 수 있지만, 공개 판단 뷰는 staging artifact와 Pull Request를 거쳐 한 명 이상의 승인을 받아야 합니다.

자동 생성된 기회는 근거 기준을 충족해도 `verified`까지만 올라갑니다. `published`는 검증 claim 비율 80% 이상, citation completeness 100%, critical violation 0건, 승인 상태 `approved`, reviewer ID 존재를 모두 만족할 때만 허용됩니다. 대형 원장이 migration trigger를 넘었는데 외부 immutable store가 없으면 staging은 경고 상태로 유지할 수 있지만 published manifest 생성은 실패합니다.

## 외부 저장소 활성화

영구 마운트 또는 동기화된 외부 경로를 준비한 후 저장소 밖의 절대 경로를 지정합니다.

```bash
export DATA_LAKE_ROOT=/mnt/intelligence-lake
node scripts/build-dataset-manifest.mjs
node scripts/archive-immutable-snapshot.mjs --strict
```

로컬 Windows에서는 다음처럼 설정합니다.

```powershell
$env:DATA_LAKE_ROOT = "D:\intelligence-lake"
node scripts/build-dataset-manifest.mjs
node scripts/archive-immutable-snapshot.mjs --strict
```

다중 사용자 트랜잭션과 접근 제어가 필요하면 PostgreSQL 계열을, 배치 분석과 파일 기반 이식성이 우선이면 DuckDB·Parquet를 선택합니다. 대상이 정해지기 전에는 `config/storage-backends.json`의 상태를 `selection-required`로 유지합니다.

## 운영 검증

```bash
npm run normalize:temporal
npm run minimize:source-content
npm run build:source-compliance
npm run build:manifest
npm run build:slo
npm run validate:contracts
npm run validate:publication
npm run calibrate:dedup
npm run validate:boundaries
npm run validate:dag
npm run test:platform
```

Tier 0의 30분은 목표값이며 GitHub 예약 실행만으로 보장하지 않습니다. 이벤트 수신기나 외부 스케줄러가 연결될 때까지 `guaranteed: false`를 유지합니다. 직접 근거율과 P0 재검증 대기열은 `slo-report.json`을 기준으로 판단하며, P0 부채가 높아지면 신규 시장 후보 수집량이 자동으로 줄어듭니다.

다국어 semantic deduplication의 0.85 기준은 provisional 값입니다. `DEDUP_GOLD_SET`에 `leftText`, `rightText`, `label`, `corpus`를 가진 JSONL 1,000건 이상을 연결한 뒤 `npm run calibrate:dedup -- --input=<path> --write`를 실행하면 한·영·중 및 cross-lingual corpus별 precision 우선 threshold를 계산할 수 있습니다. 사람이 라벨링한 gold set이 없을 때는 임의로 calibrated 상태를 만들지 않습니다.
