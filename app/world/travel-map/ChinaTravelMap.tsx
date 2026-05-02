"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, useCallback } from "react";
import type { TravelMapData, TravelPlace } from "@/data/travel-map";

type Props = {
  data: TravelMapData;
};

export default function ChinaTravelMap({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<ReturnType<typeof import("echarts").init> | null>(null);
  const animFrameRef = useRef<number>(0);
  const timeoutRef = useRef<number>(0);
  const activeKeyRef = useRef<string | null>(null);
  const geoJsonRef = useRef<unknown>(null);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ---- 3D 坐标 → 屏幕像素 ----
  const geoToScreen = useCallback((lng: number, lat: number): [number, number] | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();

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
          const tm: Float64Array = cs.transform;
          const lx = pt[0], ly = pt[1], lz = pt[2] || 0;
          const wx = tm[0]*lx + tm[4]*ly + tm[8]*lz + tm[12];
          const wy = tm[1]*lx + tm[5]*ly + tm[9]*lz + tm[13];
          const wz = tm[2]*lx + tm[6]*ly + tm[10]*lz + tm[14];

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
    } catch { /* ignore */ }

    // fallback: hidden 2D geo
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const px = (chart as any).convertToPixel({ seriesIndex: 1 }, [lng, lat]);
      if (px && !isNaN(px[0])) {
        return [rect.left + px[0], rect.top + px[1]];
      }
    } catch { /* ignore */ }

    return null;
  }, []);

  // ---- 连线动画循环 ----
  const runTrackingLoop = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !activeKeyRef.current) return;

    let firstFrame = true;
    function renderFrame() {
      if (!activeKeyRef.current || !svg) return;
      const prov = data[activeKeyRef.current];
      if (!prov) return;

      let svgHtml = "";
      prov.places.forEach((place: TravelPlace, idx: number) => {
        if (!place.coord) return;
        const pos = geoToScreen(place.coord[0], place.coord[1]);
        if (!pos) return;
        if (firstFrame) console.log("[tracking]", place.name, "screen:", pos[0].toFixed(0), pos[1].toFixed(0));

        const gridDOM = document.getElementById(`tmap-grid-${idx}`);
        if (!gridDOM) return;
        const gRect = gridDOM.getBoundingClientRect();

        const startX = pos[0];
        const startY = pos[1] - 15;
        const endX = gRect.left - 10;
        const endY = gRect.top + gRect.height / 2;
        const cp1X = startX + (endX - startX) * 0.4;
        const cp1Y = startY - 80;
        const cp2X = startX + (endX - startX) * 0.6;
        const cp2Y = endY;

        svgHtml += `<path class="tmap-conn-line" d="M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}" />
<circle class="tmap-conn-dot-end" cx="${endX}" cy="${endY}" r="4" />
<circle class="tmap-conn-dot-start" cx="${startX}" cy="${startY}" r="4" />`;
      });

      firstFrame = false;
      svg.innerHTML = svgHtml;
      animFrameRef.current = requestAnimationFrame(renderFrame);
    }
    renderFrame();
  }, [data, geoToScreen]);

  // ---- CSS 漂移动画 ----
  const panToProvince = useCallback((coord: [number, number]) => {
    const container = containerRef.current;
    if (!container) return;
    const mapCenterLng = 104.19;
    const mapCenterLat = 35.86;
    const lngDiff = coord[0] - mapCenterLng;
    const latDiff = coord[1] - mapCenterLat;
    const pxPerDegLng = window.innerWidth / 150;
    const pxPerDegLat = window.innerHeight / 100;
    let offsetX = -lngDiff * pxPerDegLng;
    let offsetY = latDiff * pxPerDegLat;
    const maxOff = Math.min(window.innerWidth, window.innerHeight) * 0.35;
    offsetX = Math.max(-maxOff, Math.min(maxOff, offsetX));
    offsetY = Math.max(-maxOff, Math.min(maxOff, offsetY));
    container.style.transition = "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
    container.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
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
      if (!echarts) return;

      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
      const container = containerRef.current;
      if (!container) return;

      if (!isInit) {
        container.style.transition = "none";
        container.style.transform = "";
      }

      const chart = echarts.init(container);
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
          },
          regions,
        },
        // hidden 2D geo for convertToPixel fallback
        geo: {
          map: "china", roam: false, silent: true,
          left: 0, top: 0, right: 0, bottom: 0,
          itemStyle: { opacity: 0 },
          emphasis: { itemStyle: { opacity: 0 } },
          label: { show: false },
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              textStyle: { color: "#fff", fontSize: 13, fontWeight: "bold", backgroundColor: "rgba(2,6,23,0.8)", padding: [6, 10], borderRadius: 6 } as any,
            },
          },
          { type: "scatter", coordinateSystem: "geo", data: allPins, silent: true, symbolSize: 0 },
        ],
      });

      if (!isInit && vc.targetCoord) {
        panToProvince(vc.targetCoord);
      }

      // click handler
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart.on("click", (params: any) => {
        let targetKey: string | null = null;
        if (params.seriesType === "scatter3D") targetKey = params.data.provKey;
        else if (params.componentType === "geo3D") targetKey = params.name;
        if (targetKey && data[targetKey]) {
          doFocusProvince(targetKey);
        }
      });
    },
    [data, panToProvince],
  );

  // ---- 聚焦省份 ----
  const doFocusProvince = useCallback(
    (provKey: string) => {
      if (activeKeyRef.current === provKey) return;

      cancelAnimationFrame(animFrameRef.current);
      clearTimeout(timeoutRef.current);
      if (svgRef.current) svgRef.current.innerHTML = "";

      activeKeyRef.current = provKey;
      setActiveKey(provKey);
      setDetailOpen(true);

      const prov = data[provKey];
      const prevKey = activeKeyRef.current;
      const regions: { name: string; itemStyle: Record<string, unknown> }[] = [];
      if (prevKey && prevKey !== provKey) {
        regions.push({ name: prevKey, itemStyle: { color: "#0f1f3d" } });
      }
      regions.push({ name: provKey, itemStyle: { color: "#38bdf8", opacity: 0.9 } });

      applyFullOption(
        { distance: 60, alpha: 50, beta: 0, targetCoord: prov.coord },
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
    applyFullOption({ distance: 120, alpha: 45, beta: 0, targetCoord: [104.19, 35.86] }, regions);
  }, [data, applyFullOption]);

  // ---- 初始化 ----
  useEffect(() => {
    let mounted = true;

    async function init() {
      const echarts = await import("echarts");
      await import("echarts-gl");
      if (!mounted || !containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).echarts = echarts;

      // fetch china.json
      try {
        const res = await fetch("https://cdn.jsdelivr.net/npm/echarts@3.6.2/map/json/china.json");
        const geoJson = await res.json();
        echarts.registerMap("china", geoJson);
        geoJsonRef.current = geoJson;
      } catch {
        console.error("[ChinaTravelMap] Failed to load china.json");
        return;
      }

      if (!mounted) return;

      applyFullOption(
        { distance: 120, alpha: 45, beta: 0, targetCoord: [104.19, 35.86] },
        [],
        true,
      );
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
  }, [applyFullOption]);

  // ---- 窗口缩放 ----
  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---- 渲染 ----
  const activeProv = activeKey ? data[activeKey] : null;

  return (
    <div className="tmap-root">
      {/* 3D 地图容器 */}
      <div ref={containerRef} className="tmap-container" />

      {/* SVG 连线层 */}
      <svg ref={svgRef} className="tmap-svg-layer" />

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
              <button className="tmap-close-btn" onClick={resetView}>
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
                      <img key={i} src={img} alt={place.name} className="tmap-img-card" />
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
