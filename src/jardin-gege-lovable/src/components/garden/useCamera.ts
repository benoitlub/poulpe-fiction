import { useCallback, useEffect, useRef, useState } from "react";

const MIN = 0.35, MAX = 3;
const W = 1000, H = 700;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Pan / wheel / pinch camera with cursor-anchored zoom. */
export function useCamera() {
  const ref = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ x: 0, y: 0, z: 1 });
  const [panning, setPanning] = useState(false);
  const camRef = useRef(cam);
  camRef.current = cam;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<number | null>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const z = cw / ch < 1 ? (ch * 0.78) / H : Math.min(cw / W, ch / H) * 0.98;
    setCam({ z, x: (cw - W * z) / 2, y: (ch - H * z) / 2 });
  }, []);

  const zoomAt = useCallback((next: number, px: number, py: number) => {
    setCam((c) => {
      const z = clamp(next, MIN, MAX), k = z / c.z;
      return { z, x: px - (px - c.x) * k, y: py - (py - c.y) * k };
    });
  }, []);

  const zoomBy = useCallback((f: number) => {
    const el = ref.current;
    if (!el) return;
    zoomAt(camRef.current.z * f, el.clientWidth / 2, el.clientHeight / 2);
  }, [zoomAt]);

  const centerOn = useCallback((sx: number, sy: number) => {
    const el = ref.current;
    if (!el) return;
    setCam((c) => ({ ...c, x: el.clientWidth / 2 - sx * c.z, y: el.clientHeight / 2 - sy * c.z }));
  }, []);

  useEffect(() => {
    fit();
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const r = el.getBoundingClientRect();
      zoomAt(camRef.current.z * Math.exp(-dy * 0.0018), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", fit);
    return () => { el.removeEventListener("wheel", onWheel); window.removeEventListener("resize", fit); };
  }, [fit, zoomAt]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 1) start.current = { x: e.clientX, y: e.clientY, moved: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = ref.current!.getBoundingClientRect();
        if (pinch.current) zoomAt(camRef.current.z * (d / pinch.current), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch.current = d;
        return;
      }
      const s = start.current;
      if (!s) return;
      if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return;
      if (!s.moved) { s.moved = true; setPanning(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
      setCam((c) => ({ ...c, x: c.x + e.clientX - prev.x, y: c.y + e.clientY - prev.y }));
    },
    onPointerUp: (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size === 0) { start.current = null; setPanning(false); }
    },
    onClickCapture: (e: React.MouseEvent) => {
      // A drag must not count as a tap on a hamster.
      if (panning) e.stopPropagation();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      const step = 40;
      const m: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      const d = m[e.key];
      if (d) { e.preventDefault(); setCam((c) => ({ ...c, x: c.x + d[0], y: c.y + d[1] })); }
      if (e.key === "+" || e.key === "=") zoomBy(1.2);
      if (e.key === "-") zoomBy(1 / 1.2);
    },
  };

  return { ref, cam, panning, handlers, zoomBy, fit, centerOn };
}