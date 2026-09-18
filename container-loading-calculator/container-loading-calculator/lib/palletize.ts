import { CargoItem } from "./types";
import { PALLET_PRESETS } from "./containers";

export interface PalletUnit {
  itemId: string;
  sku: string;
  name: string;
  l: number; // mm, 팔레트 풋프린트 길이
  w: number; // mm, 팔레트 풋프린트 폭
  h: number; // mm, 팔레트(자체) + 적재물 총 높이
  weightKg: number; // 팔레트 1개 총중량(자재+적재물)
  unitsPerPallet: number; // 이 팔레트 1개에 실린 제품(박스/보빈/드럼) 개수
  stackable: boolean; // 팔레트끼리 위아래로 추가 적층 가능 여부(원본 item.stackable 전달)
  maxStackCount?: number;
  rotatable: boolean;
}

const DEFAULT_PALLET_TARE_KG = 25;

/**
 * 1단계: 팔레타이징 — 제품(박스/보빈/드럼) 규격과 팔레트 규격을 받아
 * 팔레트 1개당 적재 가능 수량과 팔레트 완성 규격(치수/중량)을 계산한다.
 */
export function palletizeItem(item: CargoItem, effL: number, effW: number, effH: number): PalletUnit | null {
  const preset = item.palletType && item.palletType !== "CUSTOM" ? PALLET_PRESETS[item.palletType] : null;
  const palletL = item.palletLength ?? preset?.length ?? PALLET_PRESETS.T11.length;
  const palletW = item.palletWidth ?? preset?.width ?? PALLET_PRESETS.T11.width;
  const palletH = item.palletHeight ?? preset?.height ?? PALLET_PRESETS.T11.height;
  const maxLoadH = item.palletMaxLoadHeight ?? 1600; // mm, 기본 안전 적재높이(팔레트 제외)

  // 레이어당 배치 개수: 두 가지 풋프린트 회전(0도/90도) 중 더 많이 들어가는 쪽 채택
  const layoutA = Math.floor(palletL / effL) * Math.floor(palletW / effW);
  const layoutB = Math.floor(palletL / effW) * Math.floor(palletW / effL);
  const itemsPerLayer = Math.max(layoutA, layoutB);
  if (itemsPerLayer <= 0 || effH <= 0) return null; // 제품이 팔레트보다 커서 팔레타이징 불가

  let layers = Math.floor(maxLoadH / effH);
  if (item.maxStackCount && item.maxStackCount > 0) {
    layers = Math.min(layers, item.maxStackCount);
  }
  if (!item.stackable) layers = 1;
  layers = Math.max(layers, 1);

  const unitsPerPallet = itemsPerLayer * layers;
  const totalHeight = palletH + layers * effH;
  const weightKg = unitsPerPallet * item.weightPerUnit + DEFAULT_PALLET_TARE_KG;

  return {
    itemId: item.id,
    sku: item.sku,
    name: item.name,
    l: palletL,
    w: palletW,
    h: totalHeight,
    weightKg,
    unitsPerPallet,
    stackable: !!item.stackable,
    maxStackCount: item.maxStackCount,
    rotatable: item.rotatable,
  };
}
