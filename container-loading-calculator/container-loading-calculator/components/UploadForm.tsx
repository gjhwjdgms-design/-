"use client";

import { useRef, useState } from "react";
import { CargoItem } from "@/lib/types";

interface Props {
  onParsed: (items: CargoItem[]) => void;
}

export default function UploadForm({ onParsed }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("loading");
    setMessage("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/parse-packing-list", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "파싱에 실패했습니다.");
        return;
      }
      onParsed(data.items as CargoItem[]);
      setStatus("done");
      const formatLabel = data.format === "A_DRUM_DETAIL" ? "드럼 상세형(양식 A)" : "팔레트 물량표형(양식 B)";
      setMessage(
        `${formatLabel} 인식 · ${data.rowCount}건 추가됨${data.warnings?.length ? ` · 경고 ${data.warnings.length}건` : ""}`
      );
    } catch {
      setStatus("error");
      setMessage("업로드 중 오류가 발생했습니다.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 space-y-3">
      <h3 className="font-semibold text-sm text-black/70 dark:text-white/70">팩킹리스트 업로드 (.xlsx)</h3>
      <p className="text-xs text-black/50 dark:text-white/50">
        드럼 단위 상세 리스트(DRUM NO. 컬럼) 또는 팔레트 단위 물량표(Pallet No. 컬럼) 양식을 자동 인식합니다.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="text-sm"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {status === "loading" && <p className="text-sm text-black/50">파싱 중…</p>}
      {status === "done" && <p className="text-sm text-green-600">{message}</p>}
      {status === "error" && <p className="text-sm text-red-600">{message}</p>}
    </div>
  );
}
