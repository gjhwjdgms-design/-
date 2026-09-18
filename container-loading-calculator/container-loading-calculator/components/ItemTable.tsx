"use client";

import { CargoItem } from "@/lib/types";
import { getEffectiveDims } from "@/lib/binpacking";
import { cbmFromMm, formatNumber } from "@/lib/utils";

interface Props {
  items: CargoItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function ItemTable({ items, onRemove, onClear }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">아직 추가된 제품이 없습니다.</p>;
  }

  const totalCbm = items.reduce((sum, it) => {
    const eff = getEffectiveDims(it);
    return sum + cbmFromMm(eff.l, eff.w, eff.h) * it.quantity;
  }, 0);
  const totalWeight = items.reduce((sum, it) => sum + it.weightPerUnit * it.quantity, 0);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm text-black/70 dark:text-white/70">입력된 제품 목록 ({items.length}종)</h3>
        <button onClick={onClear} className="text-xs text-red-600 hover:underline">
          전체 삭제
        </button>
      </div>
      <div className="overflow-x-auto rounded border border-black/10 dark:border-white/15">
        <table className="w-full text-xs">
          <thead className="bg-black/[.03] dark:bg-white/[.06]">
            <tr className="text-left">
              <th className="p-2">품목</th>
              <th className="p-2">형태</th>
              <th className="p-2">규격(mm)</th>
              <th className="p-2">수량</th>
              <th className="p-2">단위중량</th>
              <th className="p-2">단위 CBM</th>
              <th className="p-2">총 CBM</th>
              <th className="p-2">팔레트</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const eff = getEffectiveDims(it);
              const unitCbm = cbmFromMm(eff.l, eff.w, eff.h);
              return (
                <tr key={it.id} className="border-t border-black/5 dark:border-white/10">
                  <td className="p-2">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-black/40">{it.sku}</div>
                  </td>
                  <td className="p-2">
                    {it.packagingType === "box" ? "박스" : it.packagingType === "bobbin" ? "보빈" : "드럼"}
                  </td>
                  <td className="p-2">
                    {it.packagingType === "box"
                      ? `${eff.l}×${eff.w}×${eff.h}`
                      : `⌀${it.diameter ?? eff.l} × ${eff.h}`}
                  </td>
                  <td className="p-2">{formatNumber(it.quantity, 0)}</td>
                  <td className="p-2">{formatNumber(it.weightPerUnit, 1)} kg</td>
                  <td className="p-2">{unitCbm.toFixed(4)}</td>
                  <td className="p-2 font-medium">{(unitCbm * it.quantity).toFixed(3)}</td>
                  <td className="p-2">{it.usePallet ? it.palletType : "-"}</td>
                  <td className="p-2">
                    <button onClick={() => onRemove(it.id)} className="text-red-600 hover:underline">
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-black/10 dark:border-white/15 font-semibold bg-black/[.02] dark:bg-white/[.04]">
              <td className="p-2" colSpan={6}>
                합계
              </td>
              <td className="p-2">{totalCbm.toFixed(3)} m³</td>
              <td className="p-2" colSpan={2}>
                {formatNumber(totalWeight, 0)} kg
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
