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
  from: { schema: string; table: string; column: string };
  to: { schema: string; table: string; column: string };
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
  const columns = 3;
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
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const dragState = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });
  const canvasRef = useRef<HTMLDivElement | null>(null);

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

  const totalTables = data?.tables.length ?? 0;
  const totalRelations = data?.relations.length ?? 0;

  return (
    <div
      className={`${grotesk.variable} ${mono.variable} min-h-screen w-full bg-[radial-gradient(circle_at_top,_#fff2d1,_#f8f5f0_40%,_#f2efe8_70%)] text-slate-900`}
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

        <section className="rounded-[32px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_35px_80px_-55px_rgba(15,23,42,0.5)]">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
              {error}
            </div>
          ) : (
            <div
              className="relative h-[720px] w-full overflow-auto rounded-3xl border border-slate-200 bg-[linear-gradient(120deg,_rgba(15,23,42,0.03),_rgba(15,23,42,0.01))]"
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
                  style={{ pointerEvents: "none" }}
                >
                  {relations.map((rel) => {
                    const from = nodeMap.get(rel.fromKey);
                    const to = nodeMap.get(rel.toKey);
                    if (!from || !to) return null;
                    const fromX = from.x + NODE_WIDTH;
                    const fromY = from.y + from.height / 2;
                    const toX = to.x;
                    const toY = to.y + to.height / 2;
                    const isActive =
                      selected &&
                      (selected === rel.fromKey || selected === rel.toKey);
                    return (
                      <path
                        key={`${rel.name}-${rel.fromKey}-${rel.toKey}`}
                        d={`M ${fromX} ${fromY} C ${fromX + 40} ${fromY}, ${
                          toX - 40
                        } ${toY}, ${toX} ${toY}`}
                        stroke={isActive ? "#f59e0b" : "#cbd5f5"}
                        strokeWidth={isActive ? 2.5 : 1.2}
                        fill="none"
                        opacity={isActive ? 0.9 : 0.6}
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
                    selected &&
                    selected !== node.key &&
                    relatedKeys.includes(selected);

                  return (
                    <div
                      key={node.key}
                      className={`absolute rounded-2xl border bg-white p-4 shadow-lg transition duration-200 ${
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
                      {rel.from.table}.{rel.from.column}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-700">
                      {rel.to.table}.{rel.to.column}
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
    </div>
  );
}
