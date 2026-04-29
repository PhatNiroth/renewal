import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Auth is handled by dashboard.krawma.com — redirect any direct hits.
export function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
