"use client";

import { useEffect, useRef, useState } from "react";

export default function UsecasePage() {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ active: false, x: 0, y: 0 });
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const currentZoom = zoomRef.current;
      const currentOffset = offsetRef.current;
      const worldX = (pointerX - currentOffset.x) / currentZoom;
      const worldY = (pointerY - currentOffset.y) / currentZoom;
      const nextZoom = Math.min(
        5,
        Math.max(0.1, currentZoom - event.deltaY * 0.001)
      );
      const nextOffset = {
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      };
      zoomRef.current = nextZoom;
      offsetRef.current = nextOffset;
      setZoom(nextZoom);
      setOffset(nextOffset);
    };
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    dragState.current = { active: true, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dx = event.clientX - dragState.current.x;
    const dy = event.clientY - dragState.current.y;
    dragState.current = { active: true, x: event.clientX, y: event.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const onPointerUp = () => {
    dragState.current.active = false;
  };

  return (
    <div
      ref={containerRef}
      className="flex min-h-screen w-full items-center justify-center overflow-hidden"
      style={{
        touchAction: "none",
        cursor: dragState.current.active ? "grabbing" : "grab",
        backgroundColor: "#bec2c7",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)",
        backgroundSize: "18px 18px",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <img
        src="/crm_usecase.png"
        alt="CRM use case"
        className="max-h-screen max-w-full object-contain"
        draggable={false}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      />
    </div>
  );
}
