"use client";

import { useMemo, useState } from "react";
import { CargoItem, CalcResponse } from "@/lib/types";
import { CONTAINERS } from "@/lib/containers";
import ItemForm from "@/components/ItemForm";
import UploadForm from "@/components/UploadForm";
import ItemTable from "@/components/ItemTable";
import ResultSummary from "@/components/ResultSummary";
import Container3DView from "@/components/Container3DView";

export default function Home() {
  const [items, setItems] = useState<CargoItem[]>([]);
  const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>(CONTAINERS.map((c) => c.id));
  const [safetyMarginPct, setSafetyMarginPct] = useState(2);
  const [response, setResponse] = useState<CalcResponse | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedResult = useMemo(
    () => response?.results.find((r) => r.container.id === selectedResultId) ?? null,
    [response, selectedResultId]
  );

  function addItem(item: CargoItem) {
    setItems((prev) => [...prev, item]);
  }
  function addParsedItems(newItems: CargoItem[]) {
    setItems((prev) => [...prev, ...newItems]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleContainer(id: string) {
    setSelectedContainerIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleCalculate() {
    if (items.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, containerIds: selectedContainerIds, safetyMarginPct }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "계산 중 오류가 발생했습니다.");
        return;
      }
      setResponse(data);
      setSelectedResultId(data.recommendedContainerId);
    } catch {
      setError("서버와 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <header>
          <h1 className="text-2xl font-bold">컨테이너 적재 계산기</h1>
          <p className="text-sm text-black/60 dark:text-white/60 mt-1">
            팩킹리스트(제품 부피)를 기준으로 20ft/40ft/40HQ 컨테이너별 적재 가능 여부와 최대 적재 수량을 계산합니다.
          </p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ItemForm onAdd={addItem} />
          <UploadForm onParsed={addParsedItems} />
        </section>

        <section>
          <ItemTable items={items} onRemove={removeItem} onClear={() => setItems([])} />
        </section>

        <section className="rounded-lg border border-black/10 dark:border-white/15 p-4 space-y-3">
          <h3 className="font-semibold text-sm text-black/70 dark:text-white/70">계산 옵션</h3>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-3">
              {CONTAINERS.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedContainerIds.includes(c.id)}
                    onChange={() => toggleContainer(c.id)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>안전 마진</span>
              <input
                type="number"
                className="w-16 rounded border px-2 py-1 bg-transparent"
                value={safetyMarginPct}
                onChange={(e) => setSafetyMarginPct(parseFloat(e.target.value) || 0)}
              />
              <span>%</span>
            </div>
          </div>
          <button
            onClick={handleCalculate}
            disabled={items.length === 0 || loading}
            className="rounded bg-blue-600 text-white text-sm font-medium px-5 py-2 hover:bg-blue-700 disabled:opacity-40"
          >
            {loading ? "계산 중…" : "적재 계산하기"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>

        {response && (
          <section className="space-y-4">
            <h2 className="font-semibold">계산 결과</h2>
            <ResultSummary response={response} selectedContainerId={selectedResultId} onSelect={setSelectedResultId} />
            {selectedResult && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-black/70 dark:text-white/70">
                  {selectedResult.container.label} 3D 적재 배치도
                </h3>
                <Container3DView container={selectedResult.container} placedBoxes={selectedResult.placedBoxes} />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
