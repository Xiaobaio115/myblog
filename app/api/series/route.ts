import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyAdminPassword } from "@/lib/admin-session";
import { SERIES_CATEGORIES } from "@/lib/series";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = Object.keys(SERIES_CATEGORIES);

export async function GET() {
  try {
    const db = await getDb();
    const docs = await db
      .collection("series_meta")
      .find()
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

    const data = docs.map((doc) => {
      const rawCategory = String(doc.category ?? "");
      const category = (VALID_CATEGORIES as string[]).includes(rawCategory)
        ? rawCategory
        : "life";

      return {
        name: String(doc.name ?? "").trim(),
        category,
        description: String(doc.description ?? ""),
        cover: String(doc.cover ?? ""),
        sortOrder:
          typeof doc.sortOrder === "number" && Number.isFinite(doc.sortOrder)
            ? doc.sortOrder
            : 0,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/series error:", error);
    return NextResponse.json({ error: "读取系列元数据失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "服务端尚未配置 ADMIN_PASSWORD。" },
        { status: 500 }
      );
    }

    if (!verifyAdminPassword(request.headers.get("x-admin-password"))) {
      return NextResponse.json({ error: "密码错误。" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();
    const description = String(body.description ?? "").trim();
    const cover = String(body.cover ?? "").trim();
    const sortOrder =
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? body.sortOrder
        : 0;

    if (!name) {
      return NextResponse.json(
        { error: "系列名称不能为空。" },
        { status: 400 }
      );
    }

    if (name.length > 160) {
      return NextResponse.json(
        { error: "系列名称不能超过 160 个字符。" },
        { status: 400 }
      );
    }

    if (!(VALID_CATEGORIES as string[]).includes(category)) {
      return NextResponse.json(
        { error: `分类必须是 ${VALID_CATEGORIES.join("、")} 之一。` },
        { status: 400 }
      );
    }

    if (description.length > 2000) {
      return NextResponse.json(
        { error: "系列简介不能超过 2000 个字符。" },
        { status: 400 }
      );
    }

    if (cover.length > 2000) {
      return NextResponse.json(
        { error: "封面 URL 不能超过 2000 个字符。" },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.collection("series_meta").updateOne(
      { name },
      {
        $set: {
          name,
          category,
          description,
          cover,
          sortOrder,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, name });
  } catch (error) {
    console.error("POST /api/series error:", error);
    return NextResponse.json(
      { error: "保存系列元数据失败。" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "服务端尚未配置 ADMIN_PASSWORD。" },
        { status: 500 }
      );
    }

    if (!verifyAdminPassword(request.headers.get("x-admin-password"))) {
      return NextResponse.json({ error: "密码错误。" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "系列名称不能为空。" },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.collection("series_meta").deleteOne({ name });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/series error:", error);
    return NextResponse.json(
      { error: "删除系列元数据失败。" },
      { status: 500 }
    );
  }
}