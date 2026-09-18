import { CargoItem, ContainerSpec, PlacedBox, CalcResultPerContainer } from "./types";
import { palletizeItem } from "./palletize";

// ---------------------------------------------------------------------------
// 유효 치수(bounding box) 계산
// - 박스: 입력된 length x width x height 그대로 사용
// - 보빈/드럼: diameter x diameter x width(축 방향 길이) 외접 직육면체로 변환
//   (포장목이 있는 경우, 사용자가 포장목 포함 외곽 치수를 diameter/width 또는
//    length/width/height 에 이미 반영해 입력한다고 가정한다)
// ---------------------------------------------------------------------------
export function getEffectiveDims(item: CargoItem): { l: number; w: number; h: number } {
  if (item.packagingType === "bobbin" || item.packagingType === "drum") {
    const d = item.diameter && item.diameter > 0 ? item.diameter : Math.max(item.length, item.height);
    const w = item.width; // 권취 축 방향 길이
    return { l: d, w: d, h: w };
  }
  return { l: item.length, w: item.width, h: item.height };
}

const CARGO_COLORS = [
  "#4f83cc", "#e0954f", "#5fb87a", "#c76b9a", "#8a7fd1", "#d1a95f", "#5fb0b8", "#c15c5c",
];

interface UnitBox {
  itemId: string;
  sku: string;
  name: string;
  l: number;
  w: number;
  h: number;
  weightKg: number;
  stackable: boolean;
  rotatable: boolean;
  antiRollClearanceMm: number;
  isPalletUnit: boolean;
  representedQty: number; // 이 유닛 1개가 대표하는 원 제품 수량(팔레트면 unitsPerPallet, 아니면 1)
  color: string;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

interface Placed {
  x: number;
  y: number;
  z: number;
  l: number;
  w: number;
  h: number;
  stackable: boolean;
}

function orientations(l: number, w: number, h: number, rotatable: boolean): [number, number, number][] {
  if (!rotatable) {
    // "This side up" 등 방향 고정: 수직축(h) 고정, 90도 요(yaw) 회전만 허용
    return [
      [l, w, h],
      [w, l, h],
    ];
  }
  // 완전 자유 회전: 6방향
  return [
    [l, w, h],
    [w, l, h],
    [l, h, w],
    [h, l, w],
    [w, h, l],
    [h, w, l],
  ];
}

function intersects(a: Placed, bx: number, by: number, bz: number, bl: number, bw: number, bh: number): boolean {
  return (
    a.x < bx + bl &&
    a.x + a.l > bx &&
    a.y < by + bw &&
    a.y + a.w > by &&
    a.z < bz + bh &&
    a.z + a.h > bz
  );
}

/**
 * 단순화된 Extreme Point 기반 3D bin packing 휴리스틱.
 * - 후보점(Extreme Point)에서 각 박스의 허용 방향을 순서대로 시도해 첫 번째로 들어맞는 위치에 배치한다.
 * - 배치 후 (x+l, y, z) / (x, y+w, z) / (x, y, z+h)[stackable일 때만] 3개의 신규 후보점을 추가한다.
 * - 실제 화물 적재의 물리적 지지(하중 분산)까지는 시뮬레이션하지 않는 근사 알고리즘이며,
 *   현장 적용 전 실측 검증이 필요하다(문서 '검증 방법' 섹션 참고).
 */
export function packBoxes(
  unitBoxes: UnitBox[],
  containerL: number,
  containerW: number,
  containerH: number,
  maxPayloadKg: number
): { placed: (Placed & { unit: UnitBox })[]; totalWeightKg: number } {
  // 부피 큰 순으로 정렬(일반적인 bin-packing 휴리스틱)
  const queue = [...unitBoxes].sort((a, b) => b.l * b.w * b.h - a.l * a.w * a.h);

  let points: Point[] = [{ x: 0, y: 0, z: 0 }];
  const placedList: (Placed & { unit: UnitBox })[] = [];
  let totalWeightKg = 0;

  for (const unit of queue) {
    // 후보점을 z, y, x 오름차순(바닥/좌하단 우선)으로 정렬해 매번 최적 위치부터 탐색
    points.sort((p1, p2) => p1.z - p2.z || p1.y - p2.y || p1.x - p2.x);

    let placedThis = false;
    const clearance = unit.antiRollClearanceMm || 0;

    for (const [ol, ow, oh] of orientations(unit.l, unit.w, unit.h, unit.rotatable)) {
      const effOw = ow + clearance * 2; // 구름 방지 여유 공간을 폭 방향에 반영
      for (const p of points) {
        if (p.x + ol > containerL || p.y + effOw > containerW || p.z + oh > containerH) continue;
        if (totalWeightKg + unit.weightKg > maxPayloadKg) continue;

        const collides = placedList.some((pl) => intersects(pl, p.x, p.y, p.z, ol, effOw, oh));
        if (collides) continue;

        placedList.push({ x: p.x, y: p.y, z: p.z, l: ol, w: effOw, h: oh, stackable: unit.stackable, unit });
        totalWeightKg += unit.weightKg;

        const newPoints: Point[] = [
          { x: p.x + ol, y: p.y, z: p.z },
          { x: p.x, y: p.y + effOw, z: p.z },
        ];
        if (unit.stackable) newPoints.push({ x: p.x, y: p.y, z: p.z + oh });
        points = points.filter((pt) => pt !== p).concat(newPoints);

        placedThis = true;
        break;
      }
      if (placedThis) break;
    }
    // 이 유닛이 배치되지 못해도 계속 다음(더 작은) 유닛을 시도한다 — 완전 실패로 중단하지 않음.
  }

  return { placed: placedList, totalWeightKg };
}

export function buildUnitBoxes(items: CargoItem[]): UnitBox[] {
  const units: UnitBox[] = [];
  items.forEach((item, idx) => {
    const color = CARGO_COLORS[idx % CARGO_COLORS.length];
    const eff = getEffectiveDims(item);

    if (item.usePallet) {
      const palletUnit = palletizeItem(item, eff.l, eff.w, eff.h);
      if (palletUnit && palletUnit.unitsPerPallet > 0) {
        const palletCount = Math.ceil(item.quantity / palletUnit.unitsPerPallet);
        for (let i = 0; i < palletCount; i++) {
          const remaining = item.quantity - i * palletUnit.unitsPerPallet;
          const representedQty = Math.min(palletUnit.unitsPerPallet, remaining);
          units.push({
            itemId: item.id,
            sku: item.sku,
            name: `${item.name} (Pallet)`,
            l: palletUnit.l,
            w: palletUnit.w,
            h: palletUnit.h,
            weightKg: palletUnit.weightKg,
            stackable: palletUnit.stackable,
            rotatable: palletUnit.rotatable,
            antiRollClearanceMm: 0,
            isPalletUnit: true,
            representedQty,
            color,
          });
        }
        return;
      }
      // 팔레타이징 불가(제품이 팔레트보다 큼) 시 아래 개별 적재 로직으로 폴백
    }

    for (let i = 0; i < item.quantity; i++) {
      units.push({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        l: eff.l,
        w: eff.w,
        h: eff.h,
        weightKg: item.weightPerUnit,
        // 보빈/드럼은 구조상 기본적으로 적층 불가로 처리(계획서 '데이터 요구사항' 참고)
        stackable: item.packagingType === "box" ? item.stackable : false,
        rotatable: item.rotatable,
        antiRollClearanceMm: item.antiRollClearanceMm || 0,
        isPalletUnit: false,
        representedQty: 1,
        color,
      });
    }
  });
  return units;
}

export function calculateForContainer(
  items: CargoItem[],
  container: ContainerSpec,
  safetyMarginPct: number
): CalcResultPerContainer {
  const marginFactor = 1 - safetyMarginPct / 100;
  const usableL = container.internalLength * marginFactor;
  const usableW = container.internalWidth * marginFactor;
  const usableH = container.internalHeight * marginFactor;

  const unitBoxes = buildUnitBoxes(items);
  const { placed, totalWeightKg } = packBoxes(unitBoxes, usableL, usableW, usableH, container.maxPayload);

  const loadedCountByItem: Record<string, number> = {};
  items.forEach((it) => (loadedCountByItem[it.id] = 0));
  const placedBoxes: PlacedBox[] = placed.map((p) => {
    loadedCountByItem[p.unit.itemId] = (loadedCountByItem[p.unit.itemId] || 0) + p.unit.representedQty;
    return {
      itemId: p.unit.itemId,
      sku: p.unit.sku,
      name: p.unit.name,
      x: p.x,
      y: p.y,
      z: p.z,
      l: p.l,
      w: p.w,
      h: p.h,
      color: p.unit.color,
      isPalletUnit: p.unit.isPalletUnit,
    };
  });

  const totalLoadedUnits = Object.values(loadedCountByItem).reduce((a, b) => a + b, 0);
  const totalVolumeUsedMm3 = placed.reduce((sum, p) => sum + p.l * p.w * p.h, 0);
  const containerVolumeMm3 = usableL * usableW * usableH;
  const volumeUtilizationPct = containerVolumeMm3 > 0 ? (totalVolumeUsedMm3 / containerVolumeMm3) * 100 : 0;
  const weightUtilizationPct = (totalWeightKg / container.maxPayload) * 100;

  const remainingItems = items
    .map((it) => ({
      itemId: it.id,
      sku: it.sku,
      remainingQty: it.quantity - (loadedCountByItem[it.id] || 0),
    }))
    .filter((r) => r.remainingQty > 0);

  let limitingFactor: CalcResultPerContainer["limitingFactor"] = "none";
  if (remainingItems.length > 0) {
    const weightHeadroom = container.maxPayload - totalWeightKg;
    const anyWeightBlocked = items.some((it) => {
      const remaining = it.quantity - (loadedCountByItem[it.id] || 0);
      return remaining > 0 && it.weightPerUnit > weightHeadroom;
    });
    const anySpaceBlockedOnly = items.some((it) => {
      const remaining = it.quantity - (loadedCountByItem[it.id] || 0);
      return remaining > 0 && it.weightPerUnit <= weightHeadroom;
    });
    if (anyWeightBlocked && anySpaceBlockedOnly) limitingFactor = "both";
    else if (anyWeightBlocked) limitingFactor = "weight";
    else limitingFactor = "volume";
  }

  return {
    container,
    placedBoxes,
    loadedCountByItem,
    totalLoadedUnits,
    totalVolumeUsedMm3,
    volumeUtilizationPct,
    totalWeightKg,
    weightUtilizationPct,
    limitingFactor,
    feasible: remainingItems.length === 0,
    remainingItems,
    safetyMarginPct,
  };
}
