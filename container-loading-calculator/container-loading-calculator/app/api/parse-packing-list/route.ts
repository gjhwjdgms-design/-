import { NextRequest, NextResponse } from "next/server";
import { parsePackingListWorkbook, rowsToCargoItems } from "@/lib/parseExcel";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "업로드된 파일이 없습니다." }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const result = parsePackingListWorkbook(buffer);

    if (result.format === "UNKNOWN") {
      return NextResponse.json(
        { error: "인식 가능한 팩킹리스트 양식(드럼 상세형 / 팔레트 물량표형)을 찾지 못했습니다.", warnings: result.warnings },
        { status: 422 }
      );
    }

    const items = rowsToCargoItems(result, "drum");
    return NextResponse.json({ format: result.format, warnings: result.warnings, items, rowCount: result.rows.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "파일을 읽는 중 오류가 발생했습니다. 파일 형식을 확인해주세요." }, { status: 500 });
  }
}
