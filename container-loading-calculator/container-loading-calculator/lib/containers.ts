import { ContainerSpec } from "./types";

// ISO 668 (Series 1 freight containers — Classification, dimensions and ratings) 국제표준 기준
// 내부(적재 가능) 치수는 제조사/선사별로 수 cm 편차가 있을 수 있어 실제 운용 시 선사 스펙시트로 보정 권장.
export const CONTAINERS: ContainerSpec[] = [
  {
    id: "20GP",
    label: "20ft Dry (20GP)",
    internalLength: 5900,
    internalWidth: 2350,
    internalHeight: 2390,
    doorWidth: 2340,
    doorHeight: 2280,
    maxGrossWeight: 30480,
    tareWeight: 2200,
    maxPayload: 28280,
    internalVolumeCbm: 33.2,
  },
  {
    id: "40GP",
    label: "40ft Dry (40GP)",
    internalLength: 12030,
    internalWidth: 2350,
    internalHeight: 2390,
    doorWidth: 2340,
    doorHeight: 2280,
    maxGrossWeight: 30480,
    tareWeight: 3700,
    maxPayload: 26780,
    internalVolumeCbm: 67.7,
  },
  {
    id: "40HQ",
    label: "40ft High Cube (40HQ)",
    internalLength: 12030,
    internalWidth: 2350,
    internalHeight: 2700,
    doorWidth: 2340,
    doorHeight: 2580,
    maxGrossWeight: 30480,
    tareWeight: 3900,
    maxPayload: 26580,
    internalVolumeCbm: 76.4,
  },
];

export function getContainerById(id: string): ContainerSpec | undefined {
  return CONTAINERS.find((c) => c.id === id);
}

// 표준 팔레트 규격 참고값 (mm)
export const PALLET_PRESETS: Record<
  "T11" | "T12" | "EUR" | "GMA",
  { length: number; width: number; height: number; label: string }
> = {
  T11: { length: 1100, width: 1100, height: 144, label: "T11 (1100x1100, 한국/일본)" },
  T12: { length: 1200, width: 1000, height: 144, label: "T12 (1200x1000, 한국 보조표준)" },
  EUR: { length: 1200, width: 800, height: 144, label: "EUR/EPAL (1200x800, 유럽)" },
  GMA: { length: 1219, width: 1016, height: 144, label: "GMA (48x40in, 북미)" },
};
