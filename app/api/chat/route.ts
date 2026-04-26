import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "chat api is working",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json({
      reply: `我收到啦：${body?.messages?.at(-1)?.content || "没有内容"}`,
      source: "test",
    });
  } catch (error) {
    console.error("POST /api/chat test error:", error);

    return NextResponse.json(
      { error: "测试接口出错" },
      { status: 500 }
    );
  }
}
