import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const filePath = path.join(process.cwd(), "audit_data.json");
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    
    return NextResponse.json({ success: true, message: "Audit data saved to " + filePath });
  } catch (error: unknown) {
    console.error("Error saving audit data:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
