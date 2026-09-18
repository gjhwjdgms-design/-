"use client";

import { CalcResponse } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  response: CalcResponse;
  selectedContainerId: string | null;
  onSelect: (id: string) => void;
}

const limitingLabel: Record<string, string> = {
  volume: "공간(부피) 제한",
  weight: "중량 제한",
  both: "공간+중량 복합 제한",
  none: "제한 없음(전량 적재)",
};

export default function ResultSummary({ response, selectedContainerId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {response.results.map((r) => {
        const isRecommended = r.container.id === response.recommendedContainerId;
        const isSelected = r.container.id === selectedContainerId;
        return (
          <button
            key={r.container.id}
            onClick={() => onSelect(r.container.id)}
            className={`text-left rounded-lg border p-3 space-y-2 transition ${
              isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-black/10 dark:border-white/15"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold text-sm">{r.container.label}</div>
                {isRecommended && (
                  <span className="inline-block mt-1 text-[11px] bg-blue-600 text-white rounded px-1.5 py-0.5">
                    추천 컨테이너
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  r.feasible ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {r.feasible ? "전량 적재 가능" : "부분 적재만 가능"}
              </span>
            </div>

            <div className="text-xs space-y-1 text-black/70 dark:text-white/70">
              <div className="flex justify-between">
                <span>적재 수량</span>
                <b>{formatNumber(r.totalLoadedUnits, 0)} 개</b>
              </div>
              <div className="flex justify-between">
                <span>부피 사용률</span>
                <b>{r.volumeUtilizationPct.toFixed(1)}%</b>
              </div>
              <div className="flex justify-between">
                <span>중량 사용률</span>
                <b>
                  {r.weightUtilizationPct.toFixed(1)}% ({formatNumber(r.totalWeightKg, 0)}/
                  {formatNumber(r.container.maxPayload, 0)}kg)
                </b>
              </div>
              <div className="flex justify-between">
                <span>제한 요인</span>
                <b>{limitingLabel[r.limitingFactor]}</b>
              </div>
            </div>

            {r.remainingItems.length > 0 && (
              <div className="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded p-1.5">
                미적재: {r.remainingItems.map((ri) => `${ri.sku} ${ri.remainingQty}개`).join(", ")}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
