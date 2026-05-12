"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-erd" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-erd-mono",
});

const NODE_WIDTH = 280;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 24;
const NODE_GAP_X = 80;
const NODE_GAP_Y = 60;

type ErdColumn = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  ordinal: number;
};

type ErdTable = {
  schema: string;
  name: string;
  columns: ErdColumn[];
};

type ErdRelation = {
  name: string;
  from: { schema: string; table: string; columns?: string[]; column?: string };
  to: { schema: string; table: string; columns?: string[]; column?: string };
  isUnique?: boolean;
  isNullable?: boolean;
};

type ErdPayload = {
  generatedAt: string;
  database: string;
  tables: ErdTable[];
  relations: ErdRelation[];
};

type LayoutNode = {
  key: string;
  table: ErdTable;
  x: number;
  y: number;
  height: number;
};

const buildLayout = (tables: ErdTable[]) => {
  const nodes: LayoutNode[] = [];
  const columns = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  const maxColumns = Math.max(
    1,
    ...tables.map((table) => table.columns.length)
  );
  const rowBlockHeight = HEADER_HEIGHT + maxColumns * ROW_HEIGHT + 16;
  const sorted = [...tables].sort((a, b) => {
    const schemaCompare = a.schema.localeCompare(b.schema);
    if (schemaCompare !== 0) return schemaCompare;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((table, index) => {
    const columnCount = Math.max(1, table.columns.length);
    const height = HEADER_HEIGHT + columnCount * ROW_HEIGHT + 16;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * (NODE_WIDTH + NODE_GAP_X);
    const y = row * (rowBlockHeight + NODE_GAP_Y);
    nodes.push({
      key: `${table.schema}.${table.name}`,
      table,
      x,
      y,
      height,
    });
  });

  return nodes;
};

export default function ErdPage() {
  const [data, setData] = useState<ErdPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragState = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const erdFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const cacheBuster = Date.now();
        const response = await fetch(`/erd-data.json?ts=${cacheBuster}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to load ERD data: ${response.status}`);
        }
        const payload = (await response.json()) as ErdPayload;
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ERD");
      }
    };

    load();
  }, []);

  const nodes = useMemo(() => (data ? buildLayout(data.tables) : []), [data]);
  const nodeMap = useMemo(() => {
    const map = new Map(nodes.map((node) => [node.key, node]));
    return map;
  }, [nodes]);

  const canvas = useMemo(() => {
    if (nodes.length === 0) return { width: 0, height: 0 };
    const maxX = Math.max(...nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((node) => node.y + node.height));
    return {
      width: maxX + 80,
      height: maxY + 80,
    };
  }, [nodes]);

  const relations = useMemo(() => {
    if (!data) return [];
    return data.relations.map((rel) => ({
      ...rel,
      fromKey: `${rel.from.schema}.${rel.from.table}`,
      toKey: `${rel.to.schema}.${rel.to.table}`,
    }));
  }, [data]);

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const isZoomIntent = event.ctrlKey || event.metaKey;
    if (!isZoomIntent) return;
    event.preventDefault();
    const next = Math.min(2, Math.max(0.01, zoom - event.deltaY * 0.001));
    setZoom(next);
  };

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return undefined;
    const handleWheel = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
    };
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragState.current = { active: true, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dx = event.clientX - dragState.current.x;
    const dy = event.clientY - dragState.current.y;
    dragState.current = { active: true, x: event.clientX, y: event.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const onPointerUp = () => {
    dragState.current.active = false;
  };

  const fitToView = () => {
    const container = canvasRef.current;
    if (!container || canvas.width === 0 || canvas.height === 0) return;
    const padding = 40;
    const availableWidth = Math.max(200, container.clientWidth - padding * 2);
    const availableHeight = Math.max(200, container.clientHeight - padding * 2);
    const scale = Math.min(
      availableWidth / canvas.width,
      availableHeight / canvas.height
    );
    const nextZoom = Math.max(0.01, scale);
    const nextOffset = {
      x: (container.clientWidth - canvas.width * nextZoom) / 2,
      y: (container.clientHeight - canvas.height * nextZoom) / 2,
    };
    setZoom(nextZoom);
    setOffset(nextOffset);
  };

  const toggleFullscreen = async () => {
    const frame = erdFrameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await frame.requestFullscreen();
    }
  };

  const totalTables = data?.tables.length ?? 0;
  const totalRelations = data?.relations.length ?? 0;

  return (
    <div
      className={`${grotesk.variable} ${mono.variable} min-h-screen w-full bg-[radial-gradient(circle_at_top,_#f5f5f7,_#eceff3_45%,_#e6e8ec_70%)] text-slate-900`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-12 pt-10">
        <header className="flex flex-col gap-3">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Qashierwise Database Atlas
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            ERD Explorer
          </h1>
          <p className="max-w-2xl text-lg text-slate-600">
            A static, zoomable map of your Postgres schema with relationships
            highlighted on demand.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.6)]">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Database</span>
              <span className="font-mono text-slate-700">
                {data?.database ?? "loading..."}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
              <div className="rounded-2xl bg-slate-100 px-4 py-2">
                Tables: <span className="font-semibold">{totalTables}</span>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-2">
                Relations: <span className="font-semibold">{totalRelations}</span>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-2">
                Zoom: <span className="font-semibold">{zoom.toFixed(2)}x</span>
              </div>
              <button
                type="button"
                onClick={fitToView}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:text-slate-900"
              >
                Fit to View
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:text-slate-900"
              >
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-slate-900 p-5 text-slate-100 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.6)]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
              Interaction
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-100">
              <li>Scroll to zoom.</li>
              <li>Drag to pan.</li>
              <li>Select a table to highlight its links.</li>
            </ul>
            <p className="mt-6 text-xs text-slate-300">
              Generated: {data?.generatedAt ?? "pending"}
            </p>
          </div>
        </section>

        <section
          ref={erdFrameRef}
          className={`rounded-[32px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_35px_80px_-55px_rgba(15,23,42,0.5)] ${
            isFullscreen ? "fixed inset-0 z-50 rounded-none p-0" : ""
          }`}
        >
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
              {error}
            </div>
          ) : (
            <div
              className={`relative w-full overflow-auto rounded-3xl border border-slate-200 bg-[linear-gradient(120deg,_rgba(15,23,42,0.16),_rgba(15,23,42,0.08))] ${
                isFullscreen ? "h-screen overflow-hidden rounded-none border-0" : "h-[720px]"
              }`}
              ref={canvasRef}
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  width: Math.max(canvas.width, 720),
                  height: Math.max(canvas.height, 720),
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
              >
                <svg
                  className="absolute left-0 top-0 h-full w-full"
                  style={{ pointerEvents: "none", zIndex: 10 }}
                >
                  <defs>
                    <filter id="relGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {relations.map((rel) => {
                    const from = nodeMap.get(rel.fromKey);
                    const to = nodeMap.get(rel.toKey);
                    if (!from || !to) return null;
                    const fromX = from.x + NODE_WIDTH;
                    const fromY = from.y + from.height / 2;
                    const toX = to.x;
                    const toY = to.y + to.height / 2;
                    const focusKey = selected || hovered;
                    const isActive =
                      focusKey &&
                      (focusKey === rel.fromKey || focusKey === rel.toKey);
                    const isUnique = !!rel.isUnique;
                    const isNullable = !!rel.isNullable;
                    return (
                      <path
                        key={`${rel.name}-${rel.fromKey}-${rel.toKey}`}
                        d={`M ${fromX} ${fromY} C ${fromX + 40} ${fromY}, ${
                          toX - 40
                        } ${toY}, ${toX} ${toY}`}
                        stroke={isActive ? "#f59e0b" : "#64748b"}
                        strokeWidth={isActive ? 3.5 : 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={isActive ? "url(#relGlow)" : undefined}
                        fill="none"
                        opacity={isActive ? 0.95 : 0.75}
                        className={isActive ? "erd-flow" : undefined}
                        style={{ color: isActive ? "#f59e0b" : "#64748b" }}
                      />
                    );
                  })}
                </svg>
                <svg
                  className="absolute left-0 top-0 h-full w-full"
                  style={{ pointerEvents: "none", zIndex: 60 }}
                >
                  <defs>
                    <marker
                      id="erdOneTop"
                      markerWidth="16"
                      markerHeight="16"
                      refX="14"
                      refY="8"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="2.5" />
                    </marker>
                    <marker
                      id="erdManyTop"
                      markerWidth="20"
                      markerHeight="20"
                      refX="18"
                      refY="10"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 18 10 L 4 4 M 18 10 L 4 10 M 18 10 L 4 16"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                      />
                    </marker>
                    <marker
                      id="erdZeroOneTop"
                      markerWidth="20"
                      markerHeight="20"
                      refX="18"
                      refY="10"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <circle cx="6" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
                      <line x1="18" y1="2" x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" />
                    </marker>
                    <marker
                      id="erdZeroManyTop"
                      markerWidth="24"
                      markerHeight="24"
                      refX="22"
                      refY="12"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <circle cx="6" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
                      <path
                        d="M 22 12 L 8 6 M 22 12 L 8 12 M 22 12 L 8 18"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                      />
                    </marker>
                  </defs>
                  {relations.map((rel) => {
                    const from = nodeMap.get(rel.fromKey);
                    const to = nodeMap.get(rel.toKey);
                    if (!from || !to) return null;
                    const fromX = from.x + NODE_WIDTH;
                    const fromY = from.y + from.height / 2;
                    const toX = to.x;
                    const toY = to.y + to.height / 2;
                    const focusKey = selected || hovered;
                    const isActive =
                      focusKey &&
                      (focusKey === rel.fromKey || focusKey === rel.toKey);
                    const isUnique = !!rel.isUnique;
                    const isNullable = !!rel.isNullable;
                    const markerStart = isNullable
                      ? isUnique
                        ? "url(#erdZeroOneTop)"
                        : "url(#erdZeroManyTop)"
                      : isUnique
                      ? "url(#erdOneTop)"
                      : "url(#erdManyTop)";
                    const markerEnd = "url(#erdOneTop)";
                    return (
                      <path
                        key={`${rel.name}-${rel.fromKey}-${rel.toKey}-markers`}
                        d={`M ${fromX} ${fromY} C ${fromX + 40} ${fromY}, ${
                          toX - 40
                        } ${toY}, ${toX} ${toY}`}
                        stroke="transparent"
                        strokeWidth={1}
                        fill="none"
                        markerStart={markerStart}
                        markerEnd={markerEnd}
                        style={{ color: isActive ? "#f59e0b" : "#64748b" }}
                      />
                    );
                  })}
                </svg>

                {nodes.map((node) => {
                  const isSelected = selected === node.key;
                  const relatedKeys = relations
                    .filter(
                      (rel) =>
                        rel.fromKey === node.key || rel.toKey === node.key
                    )
                    .flatMap((rel) => [rel.fromKey, rel.toKey]);

                  const isRelated =
                    (selected || hovered) &&
                    (selected || hovered) !== node.key &&
                    relatedKeys.includes(selected || hovered || "");

                  return (
                    <div
                      key={node.key}
                      className={`absolute z-40 rounded-2xl border bg-white p-4 shadow-lg transition duration-200 ${
                        isSelected
                          ? "border-amber-400 ring-2 ring-amber-200"
                          : isRelated
                          ? "border-slate-400"
                          : "border-slate-200"
                      }`}
                      style={{
                        width: NODE_WIDTH,
                        left: node.x,
                        top: node.y,
                      }}
                      onMouseEnter={() => setHovered(node.key)}
                      onMouseLeave={() => setHovered((prev) => (prev === node.key ? null : prev))}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelected((prev) =>
                            prev === node.key ? null : node.key
                          )
                        }
                        className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-left text-sm font-semibold text-slate-50"
                      >
                        <span>{node.table.name}</span>
                        <span className="text-xs text-amber-200">
                          {node.table.schema}
                        </span>
                      </button>
                      <div
                        className="mt-3 space-y-1 font-[family:var(--font-erd-mono)] text-xs text-slate-600"
                      >
                        {node.table.columns.map((column) => (
                          <div
                            key={`${node.key}.${column.name}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate text-slate-700">
                              {column.name}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              {column.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Relations
            </h3>
            <div className="mt-4 max-h-56 overflow-auto text-sm text-slate-600">
              {relations.length === 0 ? (
                <div>No relations found.</div>
              ) : (
                relations.map((rel) => (
                  <button
                    key={rel.name}
                    type="button"
                    onClick={() => setSelected(rel.fromKey)}
                    className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-amber-300"
                  >
                    <span className="text-slate-700">
                      {rel.from.table}.
                      {(rel.from.columns ||
                        (rel.from.column ? [rel.from.column] : ["?"])
                      ).join(",")}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-700">
                      {rel.to.table}.
                      {(rel.to.columns ||
                        (rel.to.column ? [rel.to.column] : ["?"])
                      ).join(",")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/70 bg-slate-900 p-5 text-slate-100">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-200">
              Tips
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              <li>Use the list to jump between related tables.</li>
              <li>Click the same table again to clear focus.</li>
              <li>Run `pnpm build` to refresh the ERD snapshot.</li>
            </ul>
          </div>
        </section>
      </div>
      <style jsx>{`
        .erd-flow {
          stroke-dasharray: 10 6;
          animation: erd-flow 1.2s linear infinite;
        }

        @keyframes erd-flow {
          to {
            stroke-dashoffset: -16;
          }
        }
      `}</style>
    </div>
  );
}
