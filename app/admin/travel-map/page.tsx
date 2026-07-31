"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { TravelMapData } from "@/data/travel-map";
import { CITY_COORDS, PROV_COORDS } from "@/data/travel-map";
import styles from "./page.module.css";

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

  useEffect(() => {
    queueMicrotask(fetchData);
  }, [fetchData]);

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

  // ---- 更新地点描述 ----
  const updatePlaceDesc = (provKey: string, placeIdx: number, desc: string) => {
    const newData = { ...data };
    newData[provKey].places[placeIdx].desc = desc;
    save(newData);
  };

  // ---- 更新省份描述 ----
  const updateProvDesc = (provKey: string, desc: string) => {
    const newData = { ...data };
    newData[provKey].desc = desc;
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
    <main className={`admin-dashboard ${styles.page}`}>
      <div className="admin-page-head">
        <div>
          <div className="admin-badge">TRAVEL MAP</div>
          <h1>旅行地图管理</h1>
          <p>管理 3D 旅行地图上的省份、地点和照片。</p>
        </div>
        <Link href="/world/travel-map" className="secondary-link">
          查看地图
        </Link>
      </div>

      {msg && (
        <div className={`${styles.message} ${msg.includes("成功") ? styles.success : styles.error}`}>
          {msg}
        </div>
      )}

      <div className={styles.createGrid}>
      <section className={styles.createSection}>
        <div className={styles.sectionHead}>
          <span>01</span>
          <h2>添加省份</h2>
        </div>
        <div className={styles.formGrid}>
          <select
            className="admin-input"
            value={newProvKey}
            onChange={(e) => {
              setNewProvKey(e.target.value);
              const short = e.target.value.replace(/(省|市|自治区|壮族|回族|维吾尔|特别行政区)/g, "");
              setNewProvShort(short);
            }}
          >
            <option value="">选择省份...</option>
            {provKeys.filter(k => !data[k]).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input
            className="admin-input"
            placeholder="简称(如: 四川)"
            value={newProvShort}
            onChange={(e) => setNewProvShort(e.target.value)}
          />
          <input
            className={`admin-input ${styles.wideField}`}
            placeholder="描述(选填)"
            value={newProvDesc}
            onChange={(e) => setNewProvDesc(e.target.value)}
          />
          <button
            type="button"
            className="admin-button"
            onClick={addProvince}
            disabled={saving}
          >
            添加省份
          </button>
        </div>
      </section>

      <section className={styles.createSection}>
        <div className={styles.sectionHead}>
          <span>02</span>
          <h2>添加地点</h2>
        </div>
        <div className={styles.formGrid}>
          <select
            className="admin-input"
            value={newPlaceProv}
            onChange={(e) => setNewPlaceProv(e.target.value)}
          >
            <option value="">选择所属省份...</option>
            {Object.keys(data).map(k => (
              <option key={k} value={k}>{data[k].shortName} ({k})</option>
            ))}
          </select>
          <input
            className="admin-input"
            placeholder="地点名称(如: 成都)"
            value={newPlaceName}
            onChange={(e) => setNewPlaceName(e.target.value)}
          />
          <input
            className={`admin-input ${styles.wideField}`}
            placeholder="地点描述(选填)"
            value={newPlaceDesc}
            onChange={(e) => setNewPlaceDesc(e.target.value)}
          />
          <button
            type="button"
            className="admin-button"
            onClick={addPlace}
            disabled={saving}
          >
            添加地点
          </button>
        </div>
        {newPlaceName && !CITY_COORDS[newPlaceName] && (
          <p className={styles.coordinateNote}>
            提示: 「{newPlaceName}」不在内置坐标库中，将使用省份中心坐标作为标记位置。
          </p>
        )}
      </section>
      </div>

      <section className={styles.provinceSection}>
        <div className={styles.listHead}>
          <div>
            <span>PROVINCES</span>
            <h2>已添加省份</h2>
          </div>
          <strong>{String(Object.keys(data).length).padStart(2, "0")}</strong>
        </div>
        {Object.keys(data).length === 0 && (
          <p className={styles.empty}>还没有添加任何省份，请在上方操作。</p>
        )}
        <div className={styles.provinceList}>
          {Object.entries(data).map(([provKey, prov]) => (
            <article key={provKey} className={`${styles.province} ${expandedProv === provKey ? styles.expanded : ""}`}>
              <div className={styles.provinceHeader}>
                <button
                  type="button"
                  className={styles.provinceToggle}
                  onClick={() => setExpandedProv(expandedProv === provKey ? null : provKey)}
                  aria-expanded={expandedProv === provKey}
                >
                  <span className={styles.provinceName}>{prov.shortName}</span>
                  <span className={styles.provinceKey}>{provKey}</span>
                  <span className={styles.placeCount}>{prov.places.length} 个地点</span>
                  <span className={styles.chevron} aria-hidden="true">{expandedProv === provKey ? "−" : "+"}</span>
                </button>
                <div className={styles.provinceActions}>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={(e) => { e.stopPropagation(); deleteProvince(provKey); }}
                  >
                    删除
                  </button>
                </div>
              </div>

              {expandedProv === provKey && (
                <div className={styles.provinceBody}>
                  <label className={styles.descriptionField}>
                    <span>省份描述</span>
                    <input
                      className="admin-input"
                      defaultValue={prov.desc}
                      placeholder="输入省份描述..."
                      onBlur={(e) => {
                        if (e.target.value !== prov.desc) updateProvDesc(provKey, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </label>
                  {prov.places.length === 0 && (
                    <p className={styles.empty}>暂无地点，请在上方添加。</p>
                  )}
                  {prov.places.map((place, placeIdx) => (
                    <section key={placeIdx} className={styles.place}>
                      <div className={styles.placeHead}>
                        <div>
                          <strong>{place.name}</strong>
                          {CITY_COORDS[place.name] && (
                            <span className={styles.coordinate}>有坐标</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => deletePlace(provKey, placeIdx)}
                        >
                          删除地点
                        </button>
                      </div>
                      <input
                        className="admin-input"
                        defaultValue={place.desc}
                        placeholder="输入地点描述..."
                        onBlur={(e) => {
                          if (e.target.value !== place.desc) updatePlaceDesc(provKey, placeIdx, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />

                      <div className={styles.imageGrid}>
                        {place.imgs.map((img, imgIdx) => (
                          <div key={imgIdx} className={styles.imageItem}>
                            <img
                              src={img}
                              alt={place.name}
                            />
                            <button
                              type="button"
                              className={styles.imageDelete}
                              onClick={() => deleteImage(provKey, placeIdx, imgIdx)}
                              aria-label={`删除 ${place.name} 图片`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className={styles.placeActions}>
                        <label className={styles.uploadButton}>
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
                          type="button"
                          className="secondary-link"
                          onClick={() => {
                            const url = prompt("输入图片 URL:");
                            if (url) addImageUrl(provKey, placeIdx, url);
                          }}
                        >
                          添加外链图片
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
