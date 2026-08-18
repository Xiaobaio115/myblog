"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useCallback } from "react";
import type { TravelMapData, TravelPlace } from "@/data/travel-map";
import styles from "./TravelMap.module.css";

type Props = {
  data: TravelMapData;
};

const isMobileViewport = () => window.innerWidth <= 640;

export default function ChinaTravelMap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<ReturnType<typeof import("echarts").init> | null>(null);
  const animFrameRef = useRef<number>(0);
  const timeoutRef = useRef<number>(0);
  const mobilePinFrameRef = useRef<number>(0);
  const mobilePinRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeKeyRef = useRef<string | null>(null);
  const focusProvinceRef = useRef<(provKey: string) => void>(() => {});
  const geoJsonRef = useRef<unknown>(null);
  const keyToGeoRef = useRef<Record<string, string>>({});
  const geoToKeyRef = useRef<Record<string, string>>({});
  const reducedMotionRef = useRef(false);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);

  // ---- 3D 坐标 → 屏幕像素 ----
  const geoToScreen = useCallback((lng: number, lat: number): [number, number] | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();

    // 优先用 scatter3D 自己的坐标系，这样线条会贴近黄色 pin 的真实渲染位置
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (chart as any).getModel();
      const comp = model?.getComponent("geo3D");
      if (comp?.coordinateSystem) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cs = comp.coordinateSystem as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cam = cs.viewGL?.camera as any;
        const pt: number[] | null = cs.dataToPoint([lng, lat, 2]);
        if (pt && cam) {
          // 尝试两种方式
          const tm: Float64Array = cs.transform;
          for (const useTransform of [true, false]) {
            let wx: number, wy: number, wz: number;
            if (useTransform) {
              wx = tm[0]*pt[0] + tm[4]*pt[1] + tm[8]*pt[2] + tm[12];
              wy = tm[1]*pt[0] + tm[5]*pt[1] + tm[9]*pt[2] + tm[13];
              wz = tm[2]*pt[0] + tm[6]*pt[1] + tm[10]*pt[2] + tm[14];
            } else {
              wx = pt[0]; wy = pt[1]; wz = pt[2] || 0;
            }

            const vm: Float64Array = cam.viewMatrix.array;
            const vx = vm[0]*wx + vm[4]*wy + vm[8]*wz + vm[12];
            const vy = vm[1]*wx + vm[5]*wy + vm[9]*wz + vm[13];
            const vz = vm[2]*wx + vm[6]*wy + vm[10]*wz + vm[14];
            const vw = vm[3]*wx + vm[7]*wy + vm[11]*wz + vm[15];

            const pm: Float64Array = cam.projectionMatrix.array;
            const cx = pm[0]*vx + pm[4]*vy + pm[8]*vz + pm[12]*vw;
            const cy = pm[1]*vx + pm[5]*vy + pm[9]*vz + pm[13]*vw;
            const cw = pm[3]*vx + pm[7]*vy + pm[11]*vz + pm[15]*vw;

            if (cw > 0.01) {
              const ndcX = cx / cw;
              const ndcY = cy / cw;
              const canvasW = chart.getDom().clientWidth;
              const canvasH = chart.getDom().clientHeight;
              const sx = (ndcX + 1) * 0.5 * canvasW;
              const sy = (1 - ndcY) * 0.5 * canvasH;
              if (!isNaN(sx) && sx > -200 && sx < canvasW + 200 && sy > -200 && sy < canvasH + 200) {
                return [rect.left + sx, rect.top + sy];
              }
            }
          }
        }
      }
    } catch { /* ignore */ }

    return null;
  }, []);

  // ---- 连线动画循环 ----
  const runTrackingLoop = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !activeKeyRef.current) return;

    function renderFrame() {
      if (!activeKeyRef.current || !svg || document.hidden) return;
      const prov = data[activeKeyRef.current];
      if (!prov) return;

      let svgHtml = "";
      prov.places.forEach((place: TravelPlace, idx: number) => {
        if (!place.coord) return;
        const pos = geoToScreen(place.coord[0], place.coord[1]);
        if (!pos) return;
        const gridDOM = document.getElementById(`tmap-grid-${idx}`);
        if (!gridDOM) return;
        const gRect = gridDOM.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();

        const startX = pos[0] - svgRect.left;
        const startY = pos[1] - svgRect.top;
        const endX = gRect.left - 10 - svgRect.left;
        const endY = gRect.top + gRect.height / 2 - svgRect.top;
        const cp1X = startX + (endX - startX) * 0.4;
        const cp1Y = startY - 80;
        const cp2X = startX + (endX - startX) * 0.6;
        const cp2Y = endY;

        svgHtml += `<path class="tmap-conn-line" d="M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}" />
<circle class="tmap-conn-dot-end" cx="${endX}" cy="${endY}" r="4" />
<circle class="tmap-conn-dot-start" cx="${startX}" cy="${startY}" r="4" />`;
      });

      svg.innerHTML = svgHtml;
      animFrameRef.current = requestAnimationFrame(renderFrame);
    }
    renderFrame();
  }, [data, geoToScreen]);

  // ---- 将经纬度换算成 geo3D 的真实世界坐标 ----
  const getGeo3DCenter = useCallback((coord: [number, number]): [number, number, number] => {
    const chart = chartRef.current;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const component = (chart as any)?.getModel()?.getComponent("geo3D");
      const point = component?.coordinateSystem?.dataToPoint([coord[0], coord[1], 0]);
      if (point?.every((value: number) => Number.isFinite(value))) {
        const root = containerRef.current?.closest(".tmap-root");
        const panel = root?.querySelector<HTMLElement>(".tmap-detail-panel");
        const sidebar = root?.querySelector<HTMLElement>(".tmap-sidebar");
        const mobile = isMobileViewport();
        const visibleWidth = root?.clientWidth || window.innerWidth;
        const panelWidth = !mobile && activeKeyRef.current && panel
          ? panel.getBoundingClientRect().width
          : 0;
        const sidebarWidth = !mobile && sidebar ? sidebar.getBoundingClientRect().width : 0;
        const usableWidth = Math.max(1, visibleWidth - panelWidth - sidebarWidth);
        // Shift the camera target toward the wider overlay so the selected
        // province appears in the center of the unobscured map area.
        const sideOffset = mobile ? 0 : ((panelWidth - sidebarWidth) / usableWidth) * 20;

        return [point[0] + sideOffset, point[1], point[2]];
      }
    } catch {
      // Use the neutral center until the chart coordinate system is ready.
    }

    return [0, 0, 0];
  }, []);

  // ---- 创建/重置图表 ----
  const applyFullOption = useCallback(
    (
      vc: { distance: number; alpha: number; beta: number; targetCoord?: [number, number] },
      regions: { name: string; itemStyle: Record<string, unknown> }[],
      isInit = false,
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const echarts = (window as any).echarts;
      if (!echarts || !geoJsonRef.current) return;

      const focusCenter = vc.targetCoord
        ? getGeo3DCenter(vc.targetCoord)
        : [0, 0, 0];

      const container = containerRef.current;
      if (!container) return;

      if (!isInit) {
        container.style.transition = "none";
        container.style.transform = "";
      }

      const chart = chartRef.current || echarts.init(container);
      chartRef.current = chart;

      // all pins
      const allPins: { name: string; value: [number, number, number]; provKey: string }[] = [];
      for (const [provKey, prov] of Object.entries(data)) {
        for (const city of prov.places) {
          if (city.coord) {
            allPins.push({ name: city.name, value: [...city.coord, 2], provKey });
          }
        }
      }

      const regionStyleByKey = new Map(
        regions.map((region) => [region.name, region.itemStyle]),
      );
      const normalizedRegions = Object.keys(data).map((key) => ({
        name: keyToGeoRef.current[key] || key,
        itemStyle: {
          color: "#0f1f3d",
          opacity: 1,
          ...regionStyleByKey.get(key),
        },
      }));

      chart.setOption({
        backgroundColor: "transparent",
        geo3D: {
          map: "china",
          roam: true,
          regionHeight: 2,
          left: 0, top: 0, right: 0, bottom: 0,
          itemStyle: { color: "#0f1f3d", opacity: 1, borderWidth: 1, borderColor: "#2b5099" },
          label: { show: false },
          emphasis: { itemStyle: { color: "#1e3a75" }, label: { show: false } },
          light: { main: { intensity: 1.5, shadow: true }, ambient: { intensity: 0.6 } },
          viewControl: {
            projection: "perspective",
            autoRotate: false,
            distance: vc.distance,
            alpha: vc.alpha,
            beta: vc.beta,
            center: focusCenter,
            animation: !reducedMotionRef.current,
            animationDurationUpdate: reducedMotionRef.current ? 0 : 800,
            animationEasingUpdate: "cubicOut",
          },
          regions: normalizedRegions,
        },
        series: [
          {
            type: "scatter3D",
            coordinateSystem: "geo3D",
            data: allPins,
            symbol: "pin",
            symbolSize: 35,
            itemStyle: { color: "#facc15", shadowBlur: 10, shadowColor: "rgba(250, 204, 21, 0.8)" },
            label: {
              show: true,
              formatter: "{b}",
              color: "#fff",
              fontSize: 13,
              fontWeight: "bold",
              backgroundColor: "rgba(2,6,23,0.8)",
              padding: [6, 10],
              borderRadius: 6,
            },
          },
        ],
      });

      // Rebind after option updates so one click only runs one focus action.
      chart.off("click");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart.on("click", (params: any) => {
        let targetKey: string | null = null;
        if (params.seriesType === "scatter3D") targetKey = params.data.provKey;
        else if (params.componentType === "geo3D") {
          targetKey = data[params.name] ? params.name : (geoToKeyRef.current[params.name] || null);
        }
        if (targetKey && data[targetKey]) {
          focusProvinceRef.current(targetKey);
        }
      });
    },
    [data, getGeo3DCenter],
  );

  // ---- 聚焦省份 ----
  const doFocusProvince = useCallback(
    (provKey: string) => {
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(timeoutRef.current);
      if (svgRef.current) svgRef.current.innerHTML = "";
      const prevKey = activeKeyRef.current;
      activeKeyRef.current = provKey;
      setActiveKey(provKey);
      setDetailOpen(true);

      const prov = data[provKey];
      const regions: { name: string; itemStyle: Record<string, unknown> }[] = [];
      if (prevKey && prevKey !== provKey) {
        regions.push({ name: prevKey, itemStyle: { color: "#0f1f3d" } });
      }
      regions.push({ name: provKey, itemStyle: { color: "#38bdf8", opacity: 0.9 } });

      const isMobile = isMobileViewport();
      applyFullOption(
        { distance: isMobile ? 62 : 60, alpha: isMobile ? 58 : 50, beta: 0, targetCoord: prov.coord },
        regions,
      );

      timeoutRef.current = window.setTimeout(() => {
        if (activeKeyRef.current === provKey) {
          if (svgRef.current) svgRef.current.style.opacity = "1";
          runTrackingLoop();
        }
      }, 1200);
    },
    [data, applyFullOption, runTrackingLoop],
  );

  useEffect(() => {
    focusProvinceRef.current = doFocusProvince;
  }, [doFocusProvince]);

  // echarts-gl 的 3D 拾取在部分移动浏览器上不会稳定触发 click。
  // 用屏幕坐标补一层触摸命中，同时保留拖动地图的手势。
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let pointerStart: { x: number; y: number; id: number } | null = null;

    const handlePointerDown = (event: PointerEvent) => {
      if (!isMobileViewport() || !event.isPrimary) return;
      pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!isMobileViewport() || !pointerStart || pointerStart.id !== event.pointerId) return;

      const movement = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      );
      pointerStart = null;
      if (movement > 14) return;

      let nearest: { key: string; distance: number } | null = null;
      for (const [key, province] of Object.entries(data)) {
        for (const place of province.places) {
          if (!place.coord) continue;
          const position = geoToScreen(place.coord[0], place.coord[1]);
          if (!position) continue;
          const distance = Math.hypot(
            event.clientX - position[0],
            event.clientY - position[1],
          );
          if (distance <= 46 && (!nearest || distance < nearest.distance)) {
            nearest = { key, distance };
          }
        }
      }

      if (nearest) focusProvinceRef.current(nearest.key);
    };

    const cancelPointer = () => {
      pointerStart = null;
    };

    container.addEventListener("pointerdown", handlePointerDown, true);
    container.addEventListener("pointerup", handlePointerUp, true);
    container.addEventListener("pointercancel", cancelPointer, true);
    return () => {
      container.removeEventListener("pointerdown", handlePointerDown, true);
      container.removeEventListener("pointerup", handlePointerUp, true);
      container.removeEventListener("pointercancel", cancelPointer, true);
    };
  }, [data, geoToScreen]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotionRef.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Mobile browsers do not consistently expose scatter3D points to ECharts'
  // click picker. Keep accessible HTML hit targets aligned with each pin.
  useEffect(() => {
    if (mapStatus !== "ready") return;

    const root = containerRef.current?.closest<HTMLElement>(".tmap-root");
    if (!root) return;

    const updateTargets = () => {
      if (document.hidden) return;
      const rootRect = root.getBoundingClientRect();
      const mobile = isMobileViewport();

      for (const [provinceKey, province] of Object.entries(data)) {
        province.places.forEach((place, placeIndex) => {
          const target = mobilePinRefs.current[`${provinceKey}:${placeIndex}`];
          if (!target) return;

          if (!mobile || !place.coord) {
            target.style.display = "none";
            return;
          }

          const position = geoToScreen(place.coord[0], place.coord[1]);
          if (!position) {
            target.style.display = "none";
            return;
          }

          target.style.display = "block";
          target.style.transform = `translate3d(${position[0] - rootRect.left - 32}px, ${position[1] - rootRect.top - 32}px, 0)`;
        });
      }

      mobilePinFrameRef.current = window.setTimeout(updateTargets, 80);
    };

    const onVisibilityChange = () => {
      window.clearTimeout(mobilePinFrameRef.current);
      if (!document.hidden) updateTargets();
    };

    updateTargets();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(mobilePinFrameRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [data, geoToScreen, mapStatus]);

  useEffect(() => {
    const onVisibilityChange = () => {
      cancelAnimationFrame(animFrameRef.current);
      const chart = chartRef.current;
      if (document.hidden) {
        chart?.getZr().animation.stop();
        return;
      }

      chart?.getZr().wakeUp();
      chart?.resize();
      if (activeKeyRef.current) runTrackingLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [runTrackingLoop]);

  // ---- 返回总览 ----
  const resetView = useCallback(() => {
    if (!activeKeyRef.current) return;
    const prevKey = activeKeyRef.current;

    cancelAnimationFrame(animFrameRef.current);
    clearTimeout(timeoutRef.current);
    activeKeyRef.current = null;
    setActiveKey(null);
    setDetailOpen(false);
    if (svgRef.current) {
      svgRef.current.innerHTML = "";
      svgRef.current.style.opacity = "0";
    }

    const container = containerRef.current;
    if (container) {
      container.style.transition = "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
      container.style.transform = "translate(0, 0)";
    }

    const regions: { name: string; itemStyle: { color: string } }[] = [];
    if (data[prevKey]) {
      regions.push({ name: prevKey, itemStyle: { color: "#0f1f3d" } });
    }
    const isMobile = isMobileViewport();
    applyFullOption({ distance: isMobile ? 90 : 120, alpha: isMobile ? 55 : 45, beta: 0, targetCoord: [104.19, 35.86] }, regions);
  }, [data, applyFullOption]);

  // ---- 初始化 ----
  useEffect(() => {
    let mounted = true;

    async function init() {
      setMapStatus("loading");

      try {
        const echarts = await import("echarts");
        await import("echarts-gl");
        if (!mounted || !containerRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).echarts = echarts;

        const cdnUrls = [
          "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json",
          "https://registry.npmmirror.com/echarts/4.9.0/files/map/json/china.json",
          "https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/china.json",
        ];
        const geoJson = await Promise.any(
          cdnUrls.map(async (url) => {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json() as Promise<unknown>;
          }),
        );

        if (!mounted) return;
      echarts.registerMap("china", geoJson as Parameters<typeof echarts.registerMap>[1]);
      geoJsonRef.current = geoJson;

      // 构建 GeoJSON 地名 ↔ 数据 key 的双向映射
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const features = (geoJson as any)?.features || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const geoNames: string[] = features.map((f: any) => f.properties?.name).filter(Boolean);
      const k2g: Record<string, string> = {};
      const g2k: Record<string, string> = {};
      for (const dk of Object.keys(data)) {
        if (geoNames.includes(dk)) {
          k2g[dk] = dk; g2k[dk] = dk;
        } else {
          const short = data[dk].shortName;
          const match = geoNames.find((n: string) => n === short);
          if (match) { k2g[dk] = match; g2k[match] = dk; }
        }
      }
      keyToGeoRef.current = k2g;
      geoToKeyRef.current = g2k;

      if (!mounted) return;

      const isMobile = isMobileViewport();
      applyFullOption(
        { distance: isMobile ? 90 : 120, alpha: isMobile ? 55 : 45, beta: 0, targetCoord: [104.19, 35.86] },
        [],
        true,
      );
        setMapStatus("ready");
      } catch (error) {
        console.error("[ChinaTravelMap] map initialization failed:", error);
        if (mounted) setMapStatus("error");
      }
    }

    init();

    return () => {
      mounted = false;
      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(timeoutRef.current);
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, [applyFullOption, data, retryKey]);

  // ---- 窗口缩放 ----
  useEffect(() => {
    let wasMobile = isMobileViewport();
    const onResize = () => {
      chartRef.current?.resize();

      const nowMobile = isMobileViewport();
      if (nowMobile === wasMobile) return;
      wasMobile = nowMobile;

      const currentKey = activeKeyRef.current;
      if (currentKey && data[currentKey]) {
        const prov = data[currentKey];
        applyFullOption(
          { distance: nowMobile ? 62 : 60, alpha: nowMobile ? 58 : 50, beta: 0, targetCoord: prov.coord },
          [{ name: currentKey, itemStyle: { color: "#38bdf8", opacity: 0.9 } }],
        );
        return;
      }

      applyFullOption(
        { distance: nowMobile ? 90 : 120, alpha: nowMobile ? 55 : 45, beta: 0, targetCoord: [104.19, 35.86] },
        [],
        true,
      );
    };

    const observer = new ResizeObserver(onResize);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [data, applyFullOption]);

  // ---- 渲染 ----
  const activeProv = activeKey ? data[activeKey] : null;

  return (
    <div className={`${styles.root} tmap-root${detailOpen ? " detail-open" : ""}`}>
      {mapStatus !== "ready" && (
        <div className={styles.loadState} role="status" aria-live="polite">
          <span className={styles.loadEyebrow}>TRAVEL ARCHIVE</span>
          <strong>{mapStatus === "loading" ? "正在展开旅行地图" : "3D 地图暂时没有抵达"}</strong>
          <p>
            {mapStatus === "loading"
              ? "正在读取地图边界和旅行坐标…"
              : "你仍可以从下方地点列表浏览旅行记录，或重新加载地图。"}
          </p>
          {mapStatus === "error" && (
            <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
              重新加载
            </button>
          )}
        </div>
      )}
      {/* 3D 地图容器 */}
      <div ref={containerRef} className="tmap-container" />

      {/* SVG 连线层 */}
      <svg ref={svgRef} className="tmap-svg-layer" />

      <div className="tmap-mobile-pin-layer" aria-label="地图地点快捷定位">
        {Object.entries(data).flatMap(([provinceKey, province]) =>
          province.places.map((place, placeIndex) =>
            place.coord ? (
              <button
                key={`${provinceKey}:${placeIndex}`}
                ref={(node) => {
                  mobilePinRefs.current[`${provinceKey}:${placeIndex}`] = node;
                }}
                type="button"
                className={`tmap-mobile-pin-hit${activeKey === provinceKey ? " active" : ""}`}
                aria-label={`查看${province.shortName}的${place.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  doFocusProvince(provinceKey);
                }}
              />
            ) : null,
          ),
        )}
      </div>

      {/* 左侧省份列表 */}
      <div className="tmap-sidebar">
        <h1 className="tmap-title">
          我的<span>旅行地图</span>
        </h1>
        <div className="tmap-prov-list">
          {Object.keys(data).map((key) => (
            <button
              key={key}
              className={`tmap-prov-btn${activeKey === key ? " active" : ""}`}
              onClick={() => doFocusProvince(key)}
              aria-pressed={activeKey === key}
            >
              {data[key].shortName}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧详情面板 */}
      <div className={`tmap-detail-panel${detailOpen ? " show" : ""}`}>
        {activeProv && (
          <>
            <div className="tmap-panel-header">
              <h2 className="tmap-panel-title">{activeProv.shortName}</h2>
              <button className="tmap-close-btn" onClick={resetView} aria-label="关闭省份详情并返回全国视图">
                ✕
              </button>
            </div>
            <p className="tmap-panel-desc">{activeProv.desc}</p>
            <div className="tmap-panel-content">
              {activeProv.places.map((place: TravelPlace, idx: number) => (
                <div key={place.name} className="tmap-city-group">
                  <div className="tmap-city-name">{place.name}</div>
                  <div className="tmap-city-desc">{place.desc}</div>
                  <div className="tmap-img-grid" id={`tmap-grid-${idx}`}>
                    {place.imgs.map((img: string, i: number) => (
                      <img
                        key={i}
                        src={img}
                        alt={place.name}
                        className="tmap-img-card"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                            `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#7dd3fc" font-family="sans-serif" font-size="24">影像加载失败</text></svg>`,
                          )}`;
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
