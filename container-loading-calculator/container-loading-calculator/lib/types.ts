// 공통 타입 정의

export type PackagingType = "box" | "bobbin" | "drum";

export interface CargoItem {
  id: string;
  sku: string;
  name: string;
  packagingType: PackagingType;

  // 박스형: length(가로) x width(세로) x height(높이)
  // 보빈/드럼형: diameter(외경), width(폭/길이) 를 우선 사용, length/height 는 diameter 로 자동 세팅됨
  length: number; // mm
  width: number; // mm
  height: number; // mm
  diameter?: number; // mm, 보빈/드럼 전용 입력 편의 필드

  weightPerUnit: number; // kg (gross)
  quantity: number; // 총 수량(박스/보빈/드럼 개수)

  // 포장목(wooden crate) 관련
  hasWoodenCrate?: boolean;

  // 적재 제약
  stackable: boolean;
  maxStackCount?: number; // stackable=true 일 때 최대 적층 단수, 미지정시 무제한(공간이 허용하는 한)
  rotatable: boolean; // false 면 지정된 방향(현재 orientation) 고정
  fragile?: boolean;
  antiRollClearanceMm?: number; // 드럼을 눕혀 실을 때 좌우 여유 공간(쐐기목 등)

  // 팔레트 관련 (Mode A 전용)
  usePallet?: boolean;
  palletType?: "T11" | "T12" | "EUR" | "GMA" | "CUSTOM";
  palletLength?: number; // mm
  palletWidth?: number; // mm
  palletHeight?: number; // mm, 팔레트 자체 높이
  palletMaxLoadHeight?: number; // mm, 팔레트 위 적재 허용 높이(팔레트 제외)

  notes?: string;
}

export interface ContainerSpec {
  id: string;
  label: string;
  internalLength: number; // mm
  internalWidth: number; // mm
  internalHeight: number; // mm
  doorWidth: number; // mm
  doorHeight: number; // mm
  maxGrossWeight: number; // kg (CSC plate)
  tareWeight: number; // kg
  maxPayload: number; // kg
  internalVolumeCbm: number; // 참고용 표기 CBM (공식 자료 기준)
}

export interface PlacedBox {
  itemId: string;
  sku: string;
  name: string;
  x: number;
  y: number;
  z: number;
  l: number; // 배치된 상태의 길이(회전 반영)
  w: number;
  h: number;
  color: string;
  isPalletUnit?: boolean;
}

export interface CalcResultPerContainer {
  container: ContainerSpec;
  placedBoxes: PlacedBox[];
  loadedCountByItem: Record<string, number>; // itemId -> 적재된 원 단위(박스/보빈/드럼/팔레트 아님, 최종 제품단위) 개수
  totalLoadedUnits: number;
  totalVolumeUsedMm3: number;
  volumeUtilizationPct: number;
  totalWeightKg: number;
  weightUtilizationPct: number;
  limitingFactor: "volume" | "weight" | "both" | "none";
  feasible: boolean;
  remainingItems: { itemId: string; sku: string; remainingQty: number }[];
  safetyMarginPct: number;
}

export interface CalcRequest {
  items: CargoItem[];
  containerIds: string[]; // 비교할 컨테이너 목록
  safetyMarginPct: number; // 컨테이너 내부치수 대비 여유마진(%), 기본 2
}

export interface CalcResponse {
  results: CalcResultPerContainer[];
  recommendedContainerId: string | null;
}
