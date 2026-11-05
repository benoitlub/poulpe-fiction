import { useEffect, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent,
  MouseEvent,
} from "react";

const WIDTH = 1000,
  HEIGHT = 650;
type Camera = { x: number; y: number; z: number };
type Point = { x: number; y: number };
const initial = { x: 0, y: 0, z: 1 };

/** Presentation-only camera. Screen pixels and world coordinates never enter mission data. */
export function useGardenCamera() {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 650 });
  const [camera, setCamera] = useState<Camera>(initial);
  const [touchExplore, setTouchExplore] = useState(false);
  const current = useRef(camera);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    camera: Camera;
    center: Point;
    distance: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const fit = Math.max(
    0.05,
    Math.min((size.width - 24) / WIDTH, (size.height - 24) / HEIGHT),
  );
  const scale = fit * camera.z;
  function bound(c: Camera): Camera {
    const z = Math.max(1, Math.min(4, c.z));
    const dx = Math.max(0, (WIDTH * fit * z - size.width) / 2 + 24);
    const dy = Math.max(0, (HEIGHT * fit * z - size.height) / 2 + 24);
    return {
      z,
      x: Math.max(-dx, Math.min(dx, c.x)),
      y: Math.max(-dy, Math.min(dy, c.y)),
    };
  }
  function update(c: Camera) {
    current.current = bound(c);
    setCamera(current.current);
  }
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    update(current.current);
    pointers.current.clear();
    gesture.current = null;
  }, [size.width, size.height]);
  function centerAndDistance() {
    const [a, b] = [...pointers.current.values()];
    return b
      ? {
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          distance: Math.hypot(a.x - b.x, a.y - b.y),
        }
      : { center: a, distance: 0 };
  }
  function startGesture() {
    gesture.current = pointers.current.size
      ? { ...centerAndDistance(), camera: current.current }
      : null;
  }
  function point(e: ReactPointerEvent): Point {
    const rect = viewport.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
  }
  const pointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === "touch" && !touchExplore) || e.button !== 0) return;
    if (!pointers.current.size) suppressClick.current = false;
    pointers.current.set(e.pointerId, point(e));
    startGesture();
  };
  const pointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, point(e));
    const next = centerAndDistance(),
      start = gesture.current;
    if (
      Math.hypot(
        next.center.x - start.center.x,
        next.center.y - start.center.y,
      ) < 6 &&
      Math.abs(next.distance - start.distance) < 6 &&
      !suppressClick.current
    )
      return;
    suppressClick.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const z = Math.max(
      1,
      Math.min(
        4,
        start.camera.z * (start.distance ? next.distance / start.distance : 1),
      ),
    );
    const ratio = z / start.camera.z;
    update({
      z,
      x: next.center.x - (start.center.x - start.camera.x) * ratio,
      y: next.center.y - (start.center.y - start.camera.y) * ratio,
    });
  };
  const pointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    startGesture();
  };
  function zoom(delta: number) {
    const c = current.current,
      z = Math.max(1, Math.min(4, c.z + delta));
    update({ z, x: (c.x * z) / c.z, y: (c.y * z) / c.z });
  }
  function pan(x: number, y: number) {
    update({
      ...current.current,
      x: current.current.x + x,
      y: current.current.y + y,
    });
  }
  function reset() {
    update(initial);
  }
  function focus(x: number, y: number) {
    const z = 2.4;
    update({ z, x: (WIDTH / 2 - x) * fit * z, y: (HEIGHT / 2 - y) * fit * z });
  }
  function keyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const move = {
      ArrowLeft: [-40, 0],
      ArrowRight: [40, 0],
      ArrowUp: [0, -40],
      ArrowDown: [0, 40],
    }[e.key];
    if (move) {
      e.preventDefault();
      pan(move[0], move[1]);
    }
    if (["+", "=", "-", "Home"].includes(e.key)) {
      e.preventDefault();
      e.key === "Home" ? reset() : zoom(e.key === "-" ? -0.25 : 0.25);
    }
  }
  return {
    viewport,
    camera,
    scale,
    zoom,
    pan,
    reset,
    focus,
    touchExplore,
    toggleTouch: () => {
      setTouchExplore((v) => !v);
      pointers.current.clear();
      gesture.current = null;
    },
    worldStyle: {
      width: WIDTH,
      height: HEIGHT,
      transformOrigin: "0 0",
      transform: `translate(${(size.width - WIDTH * scale) / 2 + camera.x}px, ${(size.height - HEIGHT * scale) / 2 + camera.y}px) scale(${scale})`,
      "--marker-scale": 1 / scale,
    },
    handlers: {
      onPointerDown: pointerDown,
      onPointerMove: pointerMove,
      onPointerUp: pointerEnd,
      onPointerCancel: pointerEnd,
      // Touch starts with implicit capture on the hit child. Transferring it
      // to the viewport must not end that same gesture via the bubbled event.
      onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) pointerEnd(e);
      },
      onKeyDown: keyDown,
      onClickCapture: (e: MouseEvent) => {
        if (suppressClick.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      },
    },
  };
}
