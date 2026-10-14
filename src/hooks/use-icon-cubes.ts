"use client";

import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "@/components/shaders/use-shader-policy";
import { refreshFaces, startingFaces } from "@/utils/cube-icons";
import { CubePath } from "@/utils/cube-path";
import { CUBE_FACE_PLACE, CUBE_FACES, cubeTurn, flatMatrix } from "@/utils/cube-projection";
import { CubeTurns } from "@/utils/cube-turns";

// In cells (a cube and its gap) and radians, after React Bits' "Cubes": how far from the cursor cubes lean toward it
// and how far; the kick a ripple gives as it passes, short of a flip; and how fast it spreads.
const TILT = { radius: 2.5, maxAngle: (40 * Math.PI) / 180, lift: 0.8, kick: 12, travel: 8 };
// A face's icon shows from where it keeps this much of its area on screen, and is faded in over this much more: drawn
// flat, a squashed icon keeps its full length where on its face it would thin away. Turned away it's mirrored, and
// hidden as the face is.
const EDGE_ON = 0.1;
const FADE = 0.2;

type Point = { x: number; y: number };

/**
 * Plays a grid of `columns` × `columns` icon cubes on the card that holds `grid`: each leans toward the cursor (or the
 * finger), every cube it passes over flips to a fresh icon the way it goes and those beside its path may follow, and a
 * ripple rocks them as it comes onto the card. Off the card a wandering stand-in keeps them leaning. Each face's icon
 * is in `layer`, laid flat over its face, so Safari draws it as a vector at the face's slant.
 *
 * Returns each cube's icons, its front's first.
 */
export function useIconCubes<Icon extends { key: string }>({
  icons,
  columns,
  iconSize,
  grid,
  layer,
}: {
  icons: Icon[];
  columns: number;
  iconSize: number;
  grid: RefObject<HTMLElement | null>;
  layer: RefObject<HTMLElement | null>;
}) {
  const count = columns * columns;
  const [faces, setFaces] = useState(() => startingFaces(icons, count));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const gridNode = grid.current;
    const layerNode = layer.current;
    const card = gridNode?.closest("a");
    if (!gridNode || !layerNode || !card || reducedMotion) return;
    const cells = [...gridNode.children] as HTMLElement[];
    const bodies = cells.map((cell) => cell.firstElementChild as HTMLElement);
    const faceNodes = bodies.map((body) => [...body.children] as HTMLElement[]);
    const iconNodes = [...layerNode.children].map((cell) => [...cell.children] as HTMLElement[]);
    const middle = (columns - 1) / 2;
    const centre = (i: number): Point => ({ x: (i % columns) - middle, y: Math.floor(i / columns) - middle });

    const turns = new CubeTurns(count);
    const path = new CubePath({ columns, rows: columns });
    // Per face element: the place it was last drawn at, and the opacity its icon was last given.
    const shownAt = faceNodes.map((nodes) => nodes.map((): string | null => null));
    const shownOpacity = faceNodes.map((nodes) => nodes.map(() => ""));
    const rings: (Point & { born: number })[] = [];
    const trail: (Point | null)[] = [];
    const pointer = { x: 0, y: 0, inside: false };
    const cursor = { x: 0, y: 0, primed: false };
    let half = 0;
    let clock = 0;
    let last = 0;
    let frame = 0;
    let visible = true;

    const measure = () => {
      half = cells[0].getBoundingClientRect().width / 2;
    };
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(gridNode);

    // Cells from the middle cube, off the cells, which don't turn.
    const toCells = (clientX: number, clientY: number): Point => {
      const first = cells[0].getBoundingClientRect();
      const end = cells[count - 1].getBoundingClientRect();
      const pitch = (end.left - first.left) / (columns - 1);
      return {
        x: (clientX - (first.left + end.right) / 2) / pitch,
        y: (clientY - (first.top + end.bottom) / 2) / pitch,
      };
    };
    const arrive = (clientX: number, clientY: number) => {
      const at = toCells(clientX, clientY);
      trail.push(null, at);
      Object.assign(pointer, at, { inside: true });
      rings.push({ ...at, born: clock });
      if (rings.length > 4) rings.shift();
    };
    const go = (clientX: number, clientY: number) => {
      const at = toCells(clientX, clientY);
      trail.push(at);
      Object.assign(pointer, at, { inside: true });
    };
    const depart = () => {
      pointer.inside = false;
      trail.push(null);
    };
    // A finger is tracked by its touches, which go on while the page scrolls under it; its pointer events stop then.
    const fromMouse = (event: PointerEvent) => event.pointerType !== "touch";
    const onPointerEnter = (event: PointerEvent) => fromMouse(event) && arrive(event.clientX, event.clientY);
    const onPointerMove = (event: PointerEvent) => fromMouse(event) && go(event.clientX, event.clientY);
    const onPointerLeave = (event: PointerEvent) => fromMouse(event) && depart();
    const onTouchStart = (event: TouchEvent) => arrive(event.touches[0].clientX, event.touches[0].clientY);
    const onTouchMove = (event: TouchEvent) => go(event.touches[0].clientX, event.touches[0].clientY);
    const onTouchEnd = (event: TouchEvent) => event.touches.length === 0 && depart();
    const listeners: [string, EventListener][] = [
      ["pointerenter", onPointerEnter as EventListener],
      ["pointermove", onPointerMove as EventListener],
      ["pointerleave", onPointerLeave as EventListener],
      ["touchstart", onTouchStart as EventListener],
      ["touchmove", onTouchMove as EventListener],
      ["touchend", onTouchEnd as EventListener],
      ["touchcancel", onTouchEnd as EventListener],
    ];
    for (const [type, listener] of listeners) card.addEventListener(type, listener, { passive: true });

    const inView = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    inView.observe(gridNode);

    const flip = ({ cube, dir }: { cube: number; dir: Parameters<CubeTurns["flip"]>[1] }) => turns.flip(cube, dir);

    const step = (dt: number) => {
      clock += dt;
      for (const point of trail.splice(0)) {
        if (point) path.move(point, clock).forEach(flip);
        else path.leave();
      }
      path.due(clock).forEach(flip);

      // The cursor, or off the card a stand-in wandering the grid, eased into from where the cursor left.
      const [goalX, goalY] = pointer.inside
        ? [pointer.x, pointer.y]
        : [Math.sin(clock * 0.37) * 2.1 * Math.cos(clock * 0.11), Math.sin(clock * 0.53 + 1.2) * 2.1];
      if (!cursor.primed) Object.assign(cursor, { x: goalX, y: goalY, primed: true });
      const follow = 1 - Math.exp(-dt * (pointer.inside ? 18 : 1.5));
      cursor.x += (goalX - cursor.x) * follow;
      cursor.y += (goalY - cursor.y) * follow;

      // A ripple rocks each cube away from where it started as its front passes.
      for (let k = rings.length - 1; k >= 0; k--) if ((clock - rings[k].born) * TILT.travel > 9) rings.splice(k, 1);
      for (const ring of rings) {
        const front = (clock - ring.born) * TILT.travel;
        for (let i = 0; i < count; i++) {
          const c = centre(i);
          const [ox, oy] = [c.x - ring.x, c.y - ring.y];
          const reach = Math.hypot(ox, oy);
          if (reach > front || reach <= front - TILT.travel * dt || reach < 0.0001) continue;
          const strength = Math.exp(-reach / 4);
          turns.kick(i, (-oy / reach) * TILT.kick * strength, (ox / reach) * TILT.kick * strength);
        }
      }

      // Each cube leans toward the cursor: rotateY(+) turns a face right, rotateX(+) up.
      return turns.step(dt, (i) => {
        const c = centre(i);
        const [dx, dy] = [cursor.x - c.x, cursor.y - c.y];
        const distance = Math.hypot(dx, dy);
        const t = distance / TILT.radius;
        if (t >= 1 || distance < 0.0001) return [0, 0];
        const lean = TILT.maxAngle * (1 - t * t) ** 2 * (distance / Math.hypot(distance, TILT.lift));
        return [(-dy / distance) * lean, (dx / distance) * lean];
      });
    };

    const draw = () => {
      const home = half - iconSize / 2;
      for (let i = 0; i < count; i++) {
        const { ax, ay } = turns.turn(i);
        const turn = cubeTurn(ax, ay);
        bodies[i].style.transform =
          `rotate3d(${turn.kx.toFixed(5)}, ${turn.ky.toFixed(5)}, 0, ${turn.angle.toFixed(5)}rad)`;
        for (const face of CUBE_FACES) {
          const element = turns.faces[i][face];
          const [faceNode, iconNode] = [faceNodes[i][element], iconNodes[i][element]];
          const at = turns.showing(i, face) ? face : null;
          if (shownAt[i][element] !== at) {
            shownAt[i][element] = at;
            for (const node of [faceNode, iconNode]) {
              node.style.display = at ? "" : "none";
              node.toggleAttribute("data-side", at !== null && at !== "F");
            }
            if (at) faceNode.style.transform = CUBE_FACE_PLACE[at].transform;
          }
          if (!at) continue;
          // From where the icon sits at rest, centred on the unturned front.
          const [a, b, c, d, e, f] = flatMatrix(at, iconSize, half, turn);
          iconNode.style.transform = `matrix(${[a, b, c, d, e - home, f - home].map((n) => n.toFixed(4)).join(", ")})`;
          const open = Math.min(1, Math.max(0, (a * d - b * c - EDGE_ON) / FADE));
          const opacity = String(Math.round(open * 16) / 16);
          if (shownOpacity[i][element] !== opacity) iconNode.style.opacity = shownOpacity[i][element] = opacity;
        }
      }
    };

    function tick(now: number) {
      frame = 0;
      if (!visible || document.hidden) {
        last = 0;
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const fresh = step(dt);
      draw();
      if (fresh.length) setFaces((current) => refreshFaces(current, fresh, icons));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      inView.disconnect();
      resized.disconnect();
      for (const [type, listener] of listeners) card.removeEventListener(type, listener);
    };
  }, [icons, columns, count, iconSize, grid, layer, reducedMotion]);

  return faces;
}
