# 컨테이너 적재 계산기 (Container Loading Calculator)

수출 팩킹리스트(제품 부피)를 기준으로 **20ft / 40ft / 40ft HQ** 컨테이너에 대해 적재 가능 여부와 최대 적재 수량을 계산하는 웹 도구입니다. 케이블 제품(박스 / 보빈 / 드럼, 팔레트 적재 포함)을 취급하는 실무에 맞춰 설계했습니다.

## 주요 기능

- 제품/포장 규격 **가로×세로×높이(mm) 직접 입력** + 입력 즉시 **CBM 자동 계산**
- 보빈·드럼(원통형) 화물: 외경(Diameter) + 폭 입력 → 외접 직육면체 자동 변환, 기본 적층 불가, 구름 방지 여유공간 반영
- 팔레트 적재(Mode A: 박스→팔레트→컨테이너 2단계 계산) 지원, T11/T12/EUR/GMA 표준 팔레트 규격 내장
- **팩킹리스트 Excel(.xlsx) 업로드 자동 파싱** — 사내에서 실제 사용 중인 두 양식을 자동 인식
  - 양식 A: 드럼 단위 상세 리스트 (`DRUM NO.` 컬럼 기반)
  - 양식 B: 팔레트 단위 물량표 (`Pallet No.` 컬럼 기반, Reel Dimension L/W/H)
- ISO 668(Series 1 freight containers) 국제표준 기준 컨테이너 내부 치수 데이터 내장
- 3D bin-packing(Extreme Point 휴리스틱) 기반 적재 시뮬레이션 + three.js 3D 배치도 시각화
- 중량 우선 검토: 부피상 여유가 있어도 컨테이너 최대 적재중량(Payload) 초과 시 자동 제한
- 컨테이너 3종 동시 비교 및 최적 컨테이너 자동 추천

## 기술 스택

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- 계산 엔진: Node.js 네이티브 구현(자체 3D bin-packing 알고리즘, `lib/binpacking.ts`)
- 3D 시각화: `three` + `@react-three/fiber` + `@react-three/drei`
- 엑셀 파싱: SheetJS(`xlsx`, 보안 패치 버전을 [cdn.sheetjs.com](https://cdn.sheetjs.com)에서 설치)
- 배포: Vercel (Next.js API Route가 곧 계산 서버)

## 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속.

## Vercel 배포

1. 이 저장소를 GitHub 등에 푸시
2. [vercel.com](https://vercel.com)에서 New Project → 저장소 선택 → 별도 설정 없이 Deploy
   (Next.js 프로젝트를 자동 인식하며, API Route는 Vercel Functions로 자동 배포됩니다)
3. 배포 후 발급되는 `*.vercel.app` 도메인으로 바로 사용 가능

계산 API(`/api/calculate`, `/api/parse-packing-list`)는 `maxDuration = 60`(초)로 설정되어 있습니다. 화물 종류가 매우 많아(예: 수천 개 단위) 계산이 오래 걸리는 경우 Vercel 플랜별 함수 실행시간 한도를 확인하고 `app/api/*/route.ts`의 `maxDuration` 값을 조정하세요. (Hobby 300초, Pro/Enterprise 최대 800초, 참고: [Vercel Functions 제한](https://vercel.com/docs/functions/configuring-functions/duration))

## 폴더 구조

```
app/
  page.tsx                     # 메인 UI
  api/calculate/route.ts       # 컨테이너별 적재 계산 API
  api/parse-packing-list/route.ts  # 팩킹리스트 업로드 파싱 API
components/
  ItemForm.tsx                 # 제품 직접 입력 폼(CBM 자동계산)
  UploadForm.tsx                # 엑셀 업로드
  ItemTable.tsx                 # 입력 목록/합계
  ResultSummary.tsx             # 컨테이너별 결과 카드
  Container3DView.tsx           # 3D 적재 배치도
lib/
  types.ts        # 공통 타입
  containers.ts   # ISO 668 기준 컨테이너 규격 + 팔레트 표준 규격
  binpacking.ts   # 3D bin-packing 알고리즘 + 계산 오케스트레이션
  palletize.ts    # 팔레타이징(1단계) 계산
  parseExcel.ts   # 팩킹리스트 양식 A/B 자동 파싱
  utils.ts        # CBM 계산 등 유틸
```

## 알려진 한계 및 확인이 필요한 가정 (중요)

실제 사용 전 아래 항목을 반드시 검토/보정하세요.

1. **적재 알고리즘은 근사치입니다.** Extreme Point 기반 휴리스틱으로, 실제 하중 분산·화물 고정(래싱)까지는 시뮬레이션하지 않습니다. 실제 선적 데이터와 대조 검증 후 사용하세요(계획 문서 '검증 방법' 참고).
2. **양식 A(드럼 상세 리스트)의 치수 단위**: 원본 헤더는 `DIMENSION(CMS)`이지만, 실제 값(예: `940 X 500 X 940`)은 드럼 실물 규격과 비교했을 때 **mm 단위로 보입니다.** 현재 파서는 원본 숫자를 mm로 그대로 사용합니다 — 물류팀과 실제 단위를 재확인하세요(`lib/parseExcel.ts`의 `parseDimensionText` 주석 참고).
3. **양식 B(팔레트 물량표)는 팔레트 자체의 가로×세로 규격을 제공하지 않습니다.** 현재는 T11(1100×1100mm)을 임시 가정하고, 원본에 이미 계산되어 있는 CBM 값으로 높이를 역산해 부피를 맞추고 있습니다. 실제 사용 팔레트 규격이 다르면 `lib/parseExcel.ts`의 `DEFAULT_PALLET_FOOTPRINT` 값을 수정하거나, UI에서 파싱 후 항목별로 규격을 직접 수정하세요.
4. **엑셀 양식이 위 두 형태와 다르면 자동 인식되지 않습니다.** 이 경우 파싱 실패 메시지가 표시되며, 제품을 직접 입력 폼으로 추가해야 합니다. 새로운 양식이 고정적으로 사용된다면 `lib/parseExcel.ts`에 파서를 추가하는 것을 권장합니다.
5. **컨테이너 내부 치수는 ISO 668 국제표준 기준 일반값**이며, 실제 사용 선사/리스사의 스펙시트와 수 cm 편차가 있을 수 있습니다(`lib/containers.ts`).
6. 3D 시각화는 성능을 위해 컨테이너당 최대 600개 박스까지만 렌더링합니다(계산 결과 자체는 전량 반영됨).

## 다음 단계 제안

- 실제 선적 완료 건(최소 20~30건)으로 계산 결과와 실적을 비교해 오차율 검증
- 팔레트 실측 규격 확보 후 양식 B 파서의 임시 가정치 보정
- 필요 시 컨테이너 스펙을 사내 실제 사용 선사 기준으로 교체
