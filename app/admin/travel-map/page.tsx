"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { TravelMapData, TravelPlace } from "@/data/travel-map";
import { CITY_COORDS, PROV_COORDS } from "@/data/travel-map";

type EditingPlace = {
  name: string;
  desc: string;
  imgs: string[];
};

type EditingProvince = {
  shortName: string;
  desc: string;
  places: EditingPlace[];
};

export default function AdminTravelMapPage() {
  const [data, setData] = useState<TravelMapData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [expandedProv, setExpandedProv] = useState<string | null>(null);

  // 新增省份 form
  const [newProvKey, setNewProvKey] = useState("");
  const [newProvShort, setNewProvShort] = useState("");
  const [newProvDesc, setNewProvDesc] = useState("");

  // 新增地点 form
  const [newPlaceProv, setNewPlaceProv] = useState("");
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceDesc, setNewPlaceDesc] = useState("");

  // 新增图片
  const [uploadingFor, setUploadingFor] = useState<{ provKey: string; placeIdx: number } | null>(null);

  const password = typeof window !== "undefined" ? localStorage.getItem("admin_password") || "" : "";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/travel-map");
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async (newData: TravelMapData) => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/travel-map", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ data: newData }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg("保存成功！");
        setData(newData);
      } else {
        setMsg(`保存失败: ${json.error}`);
      }
    } catch (e) {
      setMsg(`保存出错: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  // ---- 添加省份 ----
  const addProvince = () => {
    if (!newProvKey.trim() || !newProvShort.trim()) {
      setMsg("请填写完整的省份信息");
      return;
    }
    if (data[newProvKey]) {
      setMsg("该省份已存在");
      return;
    }
    const newData = { ...data };
    newData[newProvKey] = {
      shortName: newProvShort,
      desc: newProvDesc || `${newProvShort}的旅行记忆`,
      places: [],
    };
    save(newData);
    setNewProvKey("");
    setNewProvShort("");
    setNewProvDesc("");
  };

  // ---- 删除省份 ----
  const deleteProvince = (provKey: string) => {
    if (!confirm(`确认删除「${data[provKey]?.shortName || provKey}」及其所有地点？`)) return;
    const newData = { ...data };
    delete newData[provKey];
    save(newData);
    if (expandedProv === provKey) setExpandedProv(null);
  };

  // ---- 添加地点 ----
  const addPlace = () => {
    if (!newPlaceProv || !newPlaceName.trim()) {
      setMsg("请选择省份并填写地点名称");
      return;
    }
    const newData = { ...data };
    const prov = newData[newPlaceProv];
    if (!prov) return;
    prov.places.push({
      name: newPlaceName,
      desc: newPlaceDesc || "",
      imgs: [],
    });
    save(newData);
    setNewPlaceName("");
    setNewPlaceDesc("");
  };

  // ---- 删除地点 ----
  const deletePlace = (provKey: string, placeIdx: number) => {
    const place = data[provKey]?.places[placeIdx];
    if (!place) return;
    if (!confirm(`确认删除地点「${place.name}」？`)) return;
    const newData = { ...data };
    newData[provKey].places.splice(placeIdx, 1);
    save(newData);
  };

  // ---- 上传图片 ----
  const uploadImage = async (file: File, provKey: string, placeIdx: number) => {
    setUploadingFor({ provKey, placeIdx });
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-admin-password": password },
        body: formData,
      });
      const json = await res.json();
      if (json.url) {
        const newData = { ...data };
        newData[provKey].places[placeIdx].imgs.push(json.url);
        save(newData);
        setMsg("图片上传成功");
      } else {
        setMsg(`上传失败: ${json.error}`);
      }
    } catch (e) {
      setMsg(`上传出错: ${e}`);
    } finally {
      setUploadingFor(null);
    }
  };

  // ---- 添加外部图片链接 ----
  const addImageUrl = (provKey: string, placeIdx: number, url: string) => {
    if (!url.trim()) return;
    const newData = { ...data };
    newData[provKey].places[placeIdx].imgs.push(url);
    save(newData);
  };

  // ---- 删除图片 ----
  const deleteImage = (provKey: string, placeIdx: number, imgIdx: number) => {
    const newData = { ...data };
    newData[provKey].places[placeIdx].imgs.splice(imgIdx, 1);
    save(newData);
  };

  // ---- 省份列表键
  const provKeys = Object.keys(PROV_COORDS);

  if (loading) return <div className="admin-page-head"><p>加载中...</p></div>;

  return (
    <main className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">TRAVEL MAP</div>
          <h1>旅行地图管理</h1>
          <p>管理 3D 旅行地图上的省份、地点和照片。</p>
        </div>
        <Link href="/world/travel-map" style={{ color: "#38bdf8", textDecoration: "underline" }}>
          查看前台 →
        </Link>
      </div>

      {msg && (
        <div style={{
          background: msg.includes("成功") ? "#065f46" : "#7f1d1d",
          color: "#fff",
          padding: "12px 20px",
          borderRadius: "8px",
          marginBottom: "20px",
        }}>
          {msg}
        </div>
      )}

      {/* ======== 添加省份 ======== */}
      <section className="admin-tips" style={{ marginBottom: "24px" }}>
        <h2>添加新省份</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
          <select
            value={newProvKey}
            onChange={(e) => {
              setNewProvKey(e.target.value);
              const short = e.target.value.replace(/(省|市|自治区|壮族|回族|维吾尔|特别行政区)/g, "");
              setNewProvShort(short);
            }}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", minWidth: "180px" }}
          >
            <option value="">选择省份...</option>
            {provKeys.filter(k => !data[k]).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input
            placeholder="简称(如: 四川)"
            value={newProvShort}
            onChange={(e) => setNewProvShort(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", width: "120px" }}
          />
          <input
            placeholder="描述(选填)"
            value={newProvDesc}
            onChange={(e) => setNewProvDesc(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", flex: "1", minWidth: "200px" }}
          />
          <button
            onClick={addProvince}
            disabled={saving}
            style={{ padding: "10px 20px", borderRadius: "6px", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontWeight: "600" }}
          >
            + 添加省份
          </button>
        </div>
      </section>

      {/* ======== 添加地点 ======== */}
      <section className="admin-tips" style={{ marginBottom: "24px" }}>
        <h2>添加新地点</h2>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
          <select
            value={newPlaceProv}
            onChange={(e) => setNewPlaceProv(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", minWidth: "180px" }}
          >
            <option value="">选择所属省份...</option>
            {Object.keys(data).map(k => (
              <option key={k} value={k}>{data[k].shortName} ({k})</option>
            ))}
          </select>
          <input
            placeholder="地点名称(如: 成都)"
            value={newPlaceName}
            onChange={(e) => setNewPlaceName(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", width: "160px" }}
          />
          <input
            placeholder="地点描述(选填)"
            value={newPlaceDesc}
            onChange={(e) => setNewPlaceDesc(e.target.value)}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #334155", background: "#1e293b", color: "#f8fafc", flex: "1", minWidth: "200px" }}
          />
          <button
            onClick={addPlace}
            disabled={saving}
            style={{ padding: "10px 20px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", cursor: "pointer", fontWeight: "600" }}
          >
            + 添加地点
          </button>
        </div>
        {newPlaceName && !CITY_COORDS[newPlaceName] && (
          <p style={{ color: "#fbbf24", marginTop: "8px", fontSize: "13px" }}>
            提示: 「{newPlaceName}」不在内置坐标库中，将使用省份中心坐标作为标记位置。
          </p>
        )}
      </section>

      {/* ======== 已有省份列表 ======== */}
      <section>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f8fafc", marginBottom: "16px" }}>
          已添加省份 ({Object.keys(data).length})
        </h2>
        {Object.keys(data).length === 0 && (
          <p style={{ color: "#94a3b8" }}>还没有添加任何省份，请在上方操作。</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Object.entries(data).map(([provKey, prov]) => (
            <div key={provKey} style={{
              background: "#1e293b",
              borderRadius: "12px",
              border: "1px solid #334155",
              overflow: "hidden",
            }}>
              {/* 省份头 */}
              <div
                onClick={() => setExpandedProv(expandedProv === provKey ? null : provKey)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px",
                  cursor: "pointer",
                  background: expandedProv === provKey ? "#0f172a" : "transparent",
                }}
              >
                <div>
                  <strong style={{ fontSize: "16px", color: "#f8fafc" }}>{prov.shortName}</strong>
                  <span style={{ color: "#64748b", fontSize: "13px", marginLeft: "12px" }}>{provKey}</span>
                  <span style={{ color: "#38bdf8", fontSize: "13px", marginLeft: "12px" }}>{prov.places.length} 个地点</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProvince(provKey); }}
                    style={{ padding: "6px 12px", borderRadius: "6px", background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: "12px" }}
                  >
                    删除
                  </button>
                  <span style={{ color: "#64748b" }}>{expandedProv === provKey ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* 展开详情 */}
              {expandedProv === provKey && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid #334155" }}>
                  <p style={{ color: "#94a3b8", margin: "12px 0", fontSize: "14px" }}>{prov.desc}</p>
                  {prov.places.length === 0 && (
                    <p style={{ color: "#64748b", fontSize: "13px" }}>暂无地点，请在上方「添加新地点」中选择此省份。</p>
                  )}
                  {prov.places.map((place, placeIdx) => (
                    <div key={placeIdx} style={{
                      background: "#0f172a",
                      borderRadius: "8px",
                      padding: "16px",
                      marginTop: "12px",
                      border: "1px solid #1e3a5f",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ color: "#f8fafc" }}>{place.name}</strong>
                          {CITY_COORDS[place.name] && (
                            <span style={{ color: "#22c55e", fontSize: "11px", marginLeft: "8px" }}>● 有坐标</span>
                          )}
                        </div>
                        <button
                          onClick={() => deletePlace(provKey, placeIdx)}
                          style={{ padding: "4px 10px", borderRadius: "4px", background: "#991b1b", color: "#fca5a5", border: "none", cursor: "pointer", fontSize: "12px" }}
                        >
                          删除地点
                        </button>
                      </div>
                      {place.desc && <p style={{ color: "#94a3b8", fontSize: "13px", margin: "6px 0" }}>{place.desc}</p>}

                      {/* 图片网格 */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px", marginTop: "12px" }}>
                        {place.imgs.map((img, imgIdx) => (
                          <div key={imgIdx} style={{ position: "relative" }}>
                            <img
                              src={img}
                              alt={place.name}
                              style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "6px" }}
                            />
                            <button
                              onClick={() => deleteImage(provKey, placeIdx, imgIdx)}
                              style={{
                                position: "absolute", top: "4px", right: "4px",
                                width: "20px", height: "20px", borderRadius: "50%",
                                background: "#dc2626", color: "#fff", border: "none",
                                cursor: "pointer", fontSize: "11px", lineHeight: "1",
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* 上传图片 */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                        <label style={{
                          padding: "8px 14px", borderRadius: "6px", background: "#1d4ed8",
                          color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "500",
                        }}>
                          {uploadingFor?.provKey === provKey && uploadingFor?.placeIdx === placeIdx ? "上传中..." : "上传图片"}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadImage(file, provKey, placeIdx);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          onClick={() => {
                            const url = prompt("输入图片 URL:");
                            if (url) addImageUrl(provKey, placeIdx, url);
                          }}
                          style={{ padding: "8px 14px", borderRadius: "6px", background: "#334155", color: "#e2e8f0", border: "none", cursor: "pointer", fontSize: "13px" }}
                        >
                          添加外链图片
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
