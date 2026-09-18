import * as XLSX from "xlsx";
import { CargoItem, PackagingType } from "./types";

export interface ParsedRow {
  group: string; // PO/오더명 또는 그룹 라벨
  drumOrPalletNo: string;
  spec: string; // TYPE/SIZE 또는 Name of Item
  color?: string;
  qtyMeter?: number;
  drumCount?: number; // 양식A: 드럼 수 / 양식B: No. of Reels per Pallet
  netWeightKg?: number;
  grossWeightKg?: number;
  cbm?: number;
  dimensionRaw?: string; // 원본 치수 텍스트(양식A, cm)
  dimL?: number; // mm
  dimW?: number; // mm
  dimH?: number; // mm
  remarks?: string;
}

export interface ParseResult {
  format: "A_DRUM_DETAIL" | "B_PALLET_SUMMARY" | "UNKNOWN";
  rows: ParsedRow[];
  warnings: string[];
}

function norm(v: unknown): string {
  return (v ?? "").toString().trim();
}
function normUpper(v: unknown): string {
  return norm(v).toUpperCase();
}
function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(norm(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/** 헤더 컬럼 인덱스에서 값이 비어 있으면 오른쪽으로 최대 2칸까지 탐색(병합 셀로 인한 오프셋 보정) */
function lookAhead(row: unknown[], colIdx: number, maxAhead = 2): unknown {
  for (let i = colIdx; i <= colIdx + maxAhead && i < row.length; i++) {
    if (row[i] !== null && row[i] !== undefined && row[i] !== "") return row[i];
  }
  return undefined;
}

function findHeaderCol(row: unknown[], keywords: string[], startCol = 0): number {
  for (let i = startCol; i < row.length; i++) {
    const cell = normUpper(row[i]);
    if (!cell) continue;
    if (keywords.some((k) => cell.includes(k))) return i;
  }
  return -1;
}

/** 셀 값이 키워드와 "정확히" 일치하는 컬럼을 찾는다 (부분일치로 다른 헤더와 혼동되는 것을 방지) */
function findExactHeaderCol(row: unknown[], keyword: string, startCol = 0): number {
  for (let i = startCol; i < row.length; i++) {
    if (normUpper(row[i]) === keyword) return i;
  }
  return -1;
}

/**
 * "940 X 500 X 940" 형태의 치수 텍스트를 [d1,d2,d3]로 파싱한다.
 *
 * 주의(실제 데이터 확인 결과): 헤더 라벨은 "DIMENSION(CMS)"이지만 실제 기재된 수치(예: 940 X 500 X 940)는
 * 드럼 실물 규격(지름 약 940mm)과 대조했을 때 이미 mm 단위로 보인다. cm로 보고 x10 환산하면 9.4m짜리
 * 드럼이 되어 비현실적이므로, 본 파서는 원본 숫자를 mm로 그대로 사용한다.
 * 운영 전 물류팀과 실제 단위를 반드시 재확인할 것(문서 '리스크 및 고려사항' 참고).
 */
function parseDimensionText(raw: string): [number, number, number] | null {
  const parts = raw
    .toUpperCase()
    .split("X")
    .map((s) => parseFloat(s.trim().replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
  if (parts.length !== 3) return null;
  return [parts[0], parts[1], parts[2]]; // 원본 숫자를 mm로 간주(위 주석 참고)
}

/** 양식 A: 드럼 단위 상세 리스트 파싱 */
function parseFormatA(sheet: unknown[][]): ParseResult {
  const rows: ParsedRow[] = [];
  const warnings: string[] = [];
  let currentGroup = "";
  let cols: Record<string, number> | null = null;

  for (let r = 0; r < sheet.length; r++) {
    const row = sheet[r] || [];
    const nonEmptyCount = row.filter((c) => c !== null && c !== undefined && c !== "").length;
    const col0 = norm(row[0]);

    // 그룹(오더/PO) 타이틀 행: 유효 셀이 1~2개뿐이고 'DRUM NO.'가 아닌 문자열 행
    if (nonEmptyCount > 0 && nonEmptyCount <= 2 && col0 && !normUpper(col0).startsWith("DRUM NO")) {
      currentGroup = col0;
      continue;
    }

    // 헤더 행 인식
    if (normUpper(col0).startsWith("DRUM NO")) {
      cols = {
        drumNo: 0,
        spec: findHeaderCol(row, ["SIZE"]),
        color: findHeaderCol(row, ["COLOR"]),
        qty: findHeaderCol(row, ["Q'TY", "QTY"]),
        // "DRUM"이라는 단어가 0번 컬럼 헤더("DRUM NO.")에도 포함되므로 1번 컬럼부터 탐색해 혼동을 피함
        drumCount: findExactHeaderCol(row, "DRUM", 1),
        net: findHeaderCol(row, ["NET W/T", "NET WEIGHT"]),
        gross: findHeaderCol(row, ["GROSS W/T", "GROSS WEIGHT"]),
        cbm: findHeaderCol(row, ["MEASUREMENT", "CBM"]),
        dim: findHeaderCol(row, ["DIMENSION"]),
      };
      continue;
    }

    if (!cols) continue; // 아직 헤더를 못 찾음

    // TOTAL 행: 그룹 종료, 합계는 검증용으로만 사용(개별 드럼 합산과 대조 가능)
    if (row.some((c) => normUpper(c) === "TOTAL")) {
      continue;
    }

    // 데이터 행 (첫 컬럼이 숫자인 DRUM NO)
    const drumNo = toNum(row[0]);
    if (drumNo === undefined) continue;

    const dimRaw = norm(lookAhead(row, cols.dim));
    const dim = dimRaw ? parseDimensionText(dimRaw) : null;
    if (dimRaw && !dim) warnings.push(`그룹 "${currentGroup}" DRUM ${drumNo}: 치수 텍스트를 해석하지 못함 ("${dimRaw}")`);

    rows.push({
      group: currentGroup,
      drumOrPalletNo: String(drumNo),
      spec: norm(lookAhead(row, cols.spec)),
      color: norm(lookAhead(row, cols.color)) || undefined,
      qtyMeter: toNum(lookAhead(row, cols.qty)),
      drumCount: toNum(lookAhead(row, cols.drumCount)) ?? 1,
      netWeightKg: toNum(lookAhead(row, cols.net)),
      grossWeightKg: toNum(lookAhead(row, cols.gross)),
      cbm: toNum(lookAhead(row, cols.cbm)),
      dimensionRaw: dimRaw || undefined,
      dimL: dim ? dim[0] : undefined,
      dimW: dim ? dim[1] : undefined,
      dimH: dim ? dim[2] : undefined,
    });
  }

  return { format: "A_DRUM_DETAIL", rows, warnings };
}

/** 양식 B: 팔레트 단위 물량표 파싱 (Reel Dimension 서브헤더 L/W/H 대응) */
function parseFormatB(sheet: unknown[][]): ParseResult {
  const rows: ParsedRow[] = [];
  const warnings: string[] = [];

  let headerRowIdx = -1;
  for (let r = 0; r < sheet.length; r++) {
    if (findHeaderCol(sheet[r] || [], ["PALLET NO"]) >= 0) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx === -1) return { format: "UNKNOWN", rows: [], warnings: ["Pallet No. 헤더를 찾지 못함"] };

  const headerRow = sheet[headerRowIdx];
  const subHeaderRow = sheet[headerRowIdx + 1] || [];
  const colNo = findHeaderCol(headerRow, ["NO"]);
  const colReelsPerPallet = findHeaderCol(headerRow, ["NO. OF REELS", "REELS"]);
  const colPalletNo = findHeaderCol(headerRow, ["PALLET NO"]);
  const colDrumNo = findHeaderCol(headerRow, ["DRUM NO"]);
  const colName = findHeaderCol(headerRow, ["NAME OF ITEM", "ITEM"]);
  const colQty = findHeaderCol(headerRow, ["Q'TY", "QTY"]);
  const colNet = findHeaderCol(headerRow, ["NET"]);
  const colGross = findHeaderCol(headerRow, ["GROSS"]);
  const colCbm = findHeaderCol(headerRow, ["CBM"]);
  const colRemarks = findHeaderCol(headerRow, ["REMARKS"]);
  const dimStart = findHeaderCol(headerRow, ["REEL DIMENSION", "DIMENSION"]);

  // Reel Dimension 하위에 L/W/H 서브헤더가 있는 경우 정확한 컬럼 인덱스로 보정
  let colL = dimStart,
    colW = dimStart + 1,
    colH = dimStart + 2;
  if (dimStart >= 0) {
    for (let i = dimStart; i < dimStart + 5 && i < subHeaderRow.length; i++) {
      const v = normUpper(subHeaderRow[i]);
      if (v === "L") colL = i;
      if (v === "W") colW = i;
      if (v === "H") colH = i;
    }
  }

  let lastSpec = ""; // 첫 행에만 품명이 기재되고 이후 병합 생략되는 경우 대비
  let lastDims: [number | undefined, number | undefined, number | undefined] = [undefined, undefined, undefined];

  for (let r = headerRowIdx + 2; r < sheet.length; r++) {
    const row = sheet[r] || [];
    const nonEmpty = row.filter((c) => c !== null && c !== undefined && c !== "").length;
    if (nonEmpty === 0) continue;
    if (row.some((c) => normUpper(c).includes("TOTAL"))) continue; // 합계 행은 검증용으로 스킵

    const palletNo = norm(row[colPalletNo]);
    if (!palletNo) continue;

    const spec = norm(row[colName]) || lastSpec;
    if (norm(row[colName])) lastSpec = spec;

    const l = toNum(row[colL]) ?? lastDims[0];
    const w = toNum(row[colW]) ?? lastDims[1];
    const h = toNum(row[colH]) ?? lastDims[2];
    if (toNum(row[colL]) !== undefined) lastDims = [l, w, h];

    rows.push({
      group: "물량표",
      drumOrPalletNo: palletNo,
      spec,
      qtyMeter: toNum(row[colQty]),
      drumCount: toNum(row[colReelsPerPallet]) ?? 1,
      netWeightKg: toNum(row[colNet]),
      grossWeightKg: toNum(row[colGross]),
      cbm: toNum(row[colCbm]),
      dimL: l,
      dimW: w,
      dimH: h,
      remarks: colRemarks >= 0 ? norm(row[colRemarks]) || undefined : undefined,
    });
  }

  if (colNo < 0 || colDrumNo < 0) {
    warnings.push("일부 보조 컬럼(No / Drum No.)을 찾지 못해 기본값으로 처리했습니다.");
  }

  return { format: "B_PALLET_SUMMARY", rows, warnings };
}

export function parsePackingListWorkbook(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" });

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const sheet: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    const isFormatA = sheet.some((row) => (row || []).some((c) => normUpper(c).startsWith("DRUM NO")));
    const isFormatB = sheet.some((row) => findHeaderCol(row || [], ["PALLET NO"]) >= 0);

    if (isFormatB) return parseFormatB(sheet);
    if (isFormatA) return parseFormatA(sheet);
  }

  return { format: "UNKNOWN", rows: [], warnings: ["인식 가능한 팩킹리스트 양식(드럼 상세형 / 팔레트 물량표형)을 찾지 못했습니다."] };
}

const DEFAULT_PALLET_FOOTPRINT = { length: 1100, width: 1100 }; // T11 기준 임시값(양식B는 실제 팔레트 규격을 알려주지 않음)

/** 파싱된 행을 계산 엔진 입력(CargoItem)으로 변환 */
export function rowsToCargoItems(result: ParseResult, defaultPackagingType: PackagingType = "drum"): CargoItem[] {
  // 양식 B(팔레트 물량표)는 행 자체가 이미 완성된 팔레트 1개 단위이므로,
  // 릴 단위로 재분해(Stage 1 팔레타이징)하지 않고 팔레트 블록을 그대로 컨테이너 적재 단위로 사용한다.
  // 단, 원본에는 팔레트 자체의 가로x세로 규격이 없어 표준 팔레트(T11) 풋프린트를 임시 가정하고,
  // 원본에 이미 계산되어 있는 CBM 값으로 높이를 역산해 부피 정합성을 맞춘다 — 실제 팔레트 규격 확인 전까지의 근사치.
  if (result.format === "B_PALLET_SUMMARY") {
    return result.rows.map((row, idx) => {
      const cbmM3 = row.cbm ?? 0;
      const footprintM2 = (DEFAULT_PALLET_FOOTPRINT.length * DEFAULT_PALLET_FOOTPRINT.width) / 1_000_000;
      const derivedHeightMm = cbmM3 > 0 && footprintM2 > 0 ? Math.round((cbmM3 / footprintM2) * 1000) : row.dimH ?? 1000;

      return {
        id: `parsed-${idx}-${row.drumOrPalletNo}`,
        sku: row.spec || `PALLET-${row.drumOrPalletNo}`,
        name: `${row.spec || "제품"} (Pallet ${row.drumOrPalletNo}, 릴 ${row.drumCount ?? "-"}개)`,
        packagingType: "box",
        length: DEFAULT_PALLET_FOOTPRINT.length,
        width: DEFAULT_PALLET_FOOTPRINT.width,
        height: derivedHeightMm,
        weightPerUnit: row.grossWeightKg ?? 0,
        quantity: 1,
        stackable: false,
        rotatable: false,
        usePallet: false,
        antiRollClearanceMm: 0,
        notes: `[팔레트 완성품, 규격 추정치] 릴 개별규격 약 ${row.dimL ?? "-"}×${row.dimW ?? "-"}×${row.dimH ?? "-"}mm × ${
          row.drumCount ?? "-"
        }개 / 원본 CBM: ${row.cbm ?? "-"} / ${row.remarks ?? ""}`.trim(),
      } satisfies CargoItem;
    });
  }

  return result.rows.map((row, idx) => {
    const dimL = row.dimL ?? 0;
    const dimW = row.dimW ?? 0;
    const dimH = row.dimH ?? 0;
    // 드럼/보빈: 치수 3개 중 두 값이 유사하면 그 값을 외경으로, 나머지를 폭으로 추정
    let diameter: number | undefined;
    let width = dimW;
    if (defaultPackagingType !== "box" && dimL && dimW && dimH) {
      if (Math.abs(dimL - dimH) < Math.abs(dimL - dimW)) {
        diameter = dimL;
        width = dimW;
      } else {
        diameter = dimW;
        width = dimH;
      }
    }

    return {
      id: `parsed-${idx}-${row.drumOrPalletNo}`,
      sku: row.spec || `ITEM-${idx + 1}`,
      name: `${row.spec || "제품"} ${row.color ? `(${row.color})` : ""}`.trim(),
      packagingType: defaultPackagingType,
      length: dimL,
      width: defaultPackagingType === "box" ? dimW : width,
      height: dimH,
      diameter,
      weightPerUnit: row.grossWeightKg ?? 0,
      quantity: row.drumCount ?? 1,
      stackable: defaultPackagingType === "box",
      rotatable: defaultPackagingType === "box",
      antiRollClearanceMm: defaultPackagingType === "box" ? 0 : 75,
      notes: `원본 그룹: ${row.group}${row.remarks ? " / " + row.remarks : ""}${
        row.cbm ? ` / 원본 CBM: ${row.cbm}` : ""
      }`,
    } satisfies CargoItem;
  });
}
