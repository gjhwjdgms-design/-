"use client";

import { useMemo, useState } from "react";
import { CargoItem, PackagingType } from "@/lib/types";
import { cbmFromMm, uid } from "@/lib/utils";
import { PALLET_PRESETS } from "@/lib/containers";

interface Props {
  onAdd: (item: CargoItem) => void;
}

const emptyForm = {
  name: "",
  sku: "",
  packagingType: "box" as PackagingType,
  length: "",
  width: "",
  height: "",
  diameter: "",
  weightPerUnit: "",
  quantity: "1",
  stackable: true,
  rotatable: true,
  hasWoodenCrate: false,
  antiRollClearanceMm: "75",
  usePallet: false,
  palletType: "T11" as keyof typeof PALLET_PRESETS,
};

export default function ItemForm({ onAdd }: Props) {
  const [form, setForm] = useState(emptyForm);
  const isDrum = form.packagingType !== "box";

  const cbm = useMemo(() => {
    if (isDrum) {
      const d = parseFloat(form.diameter) || 0;
      const w = parseFloat(form.width) || 0;
      return cbmFromMm(d, d, w);
    }
    return cbmFromMm(parseFloat(form.length) || 0, parseFloat(form.width) || 0, parseFloat(form.height) || 0);
  }, [form, isDrum]);

  const totalCbm = cbm * (parseInt(form.quantity) || 0);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.weightPerUnit || !form.quantity) return;

    const item: CargoItem = {
      id: uid(),
      sku: form.sku || form.name,
      name: form.name,
      packagingType: form.packagingType,
      length: isDrum ? parseFloat(form.diameter) || 0 : parseFloat(form.length) || 0,
      width: isDrum ? parseFloat(form.width) || 0 : parseFloat(form.width) || 0,
      height: isDrum ? parseFloat(form.diameter) || 0 : parseFloat(form.height) || 0,
      diameter: isDrum ? parseFloat(form.diameter) || 0 : undefined,
      weightPerUnit: parseFloat(form.weightPerUnit) || 0,
      quantity: parseInt(form.quantity) || 0,
      hasWoodenCrate: form.hasWoodenCrate,
      stackable: isDrum ? false : form.stackable,
      rotatable: isDrum ? false : form.rotatable,
      antiRollClearanceMm: isDrum ? parseFloat(form.antiRollClearanceMm) || 0 : 0,
      usePallet: !isDrum && form.usePallet,
      palletType: form.palletType,
      palletLength: PALLET_PRESETS[form.palletType].length,
      palletWidth: PALLET_PRESETS[form.palletType].width,
      palletHeight: PALLET_PRESETS[form.palletType].height,
    };
    onAdd(item);
    setForm({ ...emptyForm, sku: "", name: "" });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 dark:border-white/15 p-4 space-y-4">
      <h3 className="font-semibold text-sm text-black/70 dark:text-white/70">제품 직접 입력</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs mb-1">품목명 *</label>
          <input
            className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="예: RG-10/U"
            required
          />
        </div>
        <div>
          <label className="block text-xs mb-1">SKU</label>
          <input
            className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
            value={form.sku}
            onChange={(e) => update("sku", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs mb-1">포장 형태</label>
          <select
            className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
            value={form.packagingType}
            onChange={(e) => update("packagingType", e.target.value as PackagingType)}
          >
            <option value="box">박스</option>
            <option value="bobbin">보빈</option>
            <option value="drum">드럼</option>
          </select>
        </div>
      </div>

      {!isDrum ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1">가로 L (mm) *</label>
            <input
              type="number"
              className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
              value={form.length}
              onChange={(e) => update("length", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs mb-1">세로 W (mm) *</label>
            <input
              type="number"
              className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
              value={form.width}
              onChange={(e) => update("width", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs mb-1">높이 H (mm) *</label>
            <input
              type="number"
              className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
              value={form.height}
              onChange={(e) => update("height", e.target.value)}
              required
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1">외경 Diameter (mm) *</label>
            <input
              type="number"
              className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
              value={form.diameter}
              onChange={(e) => update("diameter", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs mb-1">폭/권취길이 Width (mm) *</label>
            <input
              type="number"
              className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
              value={form.width}
              onChange={(e) => update("width", e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <div className="rounded bg-black/[.03] dark:bg-white/[.06] px-3 py-2 text-sm flex justify-between">
        <span>박스(단위)당 CBM</span>
        <b>{cbm.toFixed(4)} m³</b>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs mb-1">단위 중량 (kg) *</label>
          <input
            type="number"
            className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
            value={form.weightPerUnit}
            onChange={(e) => update("weightPerUnit", e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs mb-1">수량 *</label>
          <input
            type="number"
            className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
            value={form.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            required
          />
        </div>
        <div className="col-span-2 flex items-end">
          <div className="rounded bg-black/[.03] dark:bg-white/[.06] px-3 py-1.5 text-sm w-full flex justify-between">
            <span>총 CBM</span>
            <b>{totalCbm.toFixed(3)} m³</b>
          </div>
        </div>
      </div>

      {isDrum ? (
        <div className="grid grid-cols-2 gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.hasWoodenCrate} onChange={(e) => update("hasWoodenCrate", e.target.checked)} />
            포장목(Wooden Crate) 포함 치수임
          </label>
          <div>
            <label className="block text-xs mb-1">구름 방지 여유공간 (mm, 편측)</label>
            <input
              type="number"
              className="w-full rounded border px-2 py-1.5 text-sm bg-transparent"
              value={form.antiRollClearanceMm}
              onChange={(e) => update("antiRollClearanceMm", e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.stackable} onChange={(e) => update("stackable", e.target.checked)} />
            적층 가능
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.rotatable} onChange={(e) => update("rotatable", e.target.checked)} />
            자유 회전 가능
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.usePallet} onChange={(e) => update("usePallet", e.target.checked)} />
            팔레트 사용
          </label>
          {form.usePallet && (
            <select
              className="rounded border px-2 py-1.5 text-sm bg-transparent"
              value={form.palletType}
              onChange={(e) => update("palletType", e.target.value as keyof typeof PALLET_PRESETS)}
            >
              {Object.entries(PALLET_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <button type="submit" className="rounded bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700">
        목록에 추가
      </button>
    </form>
  );
}
