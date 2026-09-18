import { NextRequest, NextResponse } from "next/server";
import { CalcRequest, CalcResponse } from "@/lib/types";
import { calculateForContainer } from "@/lib/binpacking";
import { getContainerById, CONTAINERS } from "@/lib/containers";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: CalcRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  if (!body.items || body.items.length === 0) {
    return NextResponse.json({ error: "적재할 제품 정보가 없습니다." }, { status: 400 });
  }

  const containerIds = body.containerIds && body.containerIds.length > 0 ? body.containerIds : CONTAINERS.map((c) => c.id);
  const safetyMarginPct = body.safetyMarginPct ?? 2;

  const results = containerIds
    .map((id) => getContainerById(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((container) => calculateForContainer(body.items, container, safetyMarginPct))
    // 20ft -> 40ft -> 40HQ 순으로, 즉 내부 용적이 작은 컨테이너부터 정렬(최적 추천 판단에 사용)
    .sort((a, b) => a.container.internalVolumeCbm - b.container.internalVolumeCbm);

  const fullyFeasible = results.find((r) => r.feasible);
  let recommendedContainerId: string | null = null;
  if (fullyFeasible) {
    recommendedContainerId = fullyFeasible.container.id;
  } else if (results.length > 0) {
    // 완전 적재가 불가능하면, 적재 가능 수량이 가장 많은 컨테이너를 추천(부분 적재 기준)
    const best = [...results].sort((a, b) => b.totalLoadedUnits - a.totalLoadedUnits)[0];
    recommendedContainerId = best.container.id;
  }

  const response: CalcResponse = { results, recommendedContainerId };
  return NextResponse.json(response);
}
