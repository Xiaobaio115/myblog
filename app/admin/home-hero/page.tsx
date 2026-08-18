"use client";

import { useCallback, useEffect, useState } from "react";
import { HomeHeroForm } from "@/app/admin/settings/home-hero-form";
import { adminFetch } from "@/lib/admin-api";
import type { AllSettings, HomeHeroSlideSetting } from "@/lib/settings";

export default function AdminHomeHeroPage() {
  const [slides, setSlides] = useState<HomeHeroSlideSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const settings = await adminFetch<AllSettings>("/api/settings", {
        fallbackError: "读取首页轮播失败。",
      });
      setSlides(settings.homeHero ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取首页轮播失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function save(nextSlides: HomeHeroSlideSetting[]) {
    setSaving(true);
    setMessage("");

    try {
      await adminFetch("/api/settings", {
        method: "PUT",
        json: { key: "homeHero", value: nextSlides },
        fallbackError: "保存首页轮播失败。",
      });
      setSlides(nextSlides);
      setMessage("首页轮播已保存，刷新前台即可看到更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存首页轮播失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">HOME HERO</div>
          <h1>首页轮播</h1>
          <p>添加首页首屏图片并编辑每一页的标题、说明和跳转按钮。保存后首页直接读取这里的内容。</p>
        </div>
      </div>

      {message ? <p className="settings-msg" role="status">{message}</p> : null}
      {loading ? <p className="admin-tip">正在读取轮播内容...</p> : (
        <div className="settings-panel">
          <HomeHeroForm
            value={slides}
            saving={saving}
            onChange={setSlides}
            onSave={(nextSlides) => void save(nextSlides)}
          />
        </div>
      )}
    </main>
  );
}
