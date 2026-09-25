import { readFileSync } from "node:fs";
const svg = readFileSync("src/assets/illustrations/toronto-skyline.svg", "utf8");
const BINS = 400, VB_W = 4000, VB_H = 600;
const top = new Array(BINS).fill(VB_H);

function walk(d, onPoint) {
  const t = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let cmd = "", x = 0, y = 0, sx = 0, sy = 0, i = 0;
  const n = (k) => t.slice(i, i + k).map(Number);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) { cmd = t[i]; i++; continue; }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === "M" || C === "L" || C === "T") { const [a,b]=n(2); x = rel?x+a:a; y = rel?y+b:b; if (C==="M"){sx=x;sy=y;} onPoint(x,y); i+=2; }
    else if (C === "H") { const [a]=n(1); x = rel?x+a:a; onPoint(x,y); i+=1; }
    else if (C === "V") { const [a]=n(1); y = rel?y+a:a; onPoint(x,y); i+=1; }
    else if (C === "C") { const a=n(6); onPoint(rel?x+a[0]:a[0], rel?y+a[1]:a[1]); onPoint(rel?x+a[2]:a[2], rel?y+a[3]:a[3]); x=rel?x+a[4]:a[4]; y=rel?y+a[5]:a[5]; onPoint(x,y); i+=6; }
    else if (C === "S" || C === "Q") { const a=n(4); onPoint(rel?x+a[0]:a[0], rel?y+a[1]:a[1]); x=rel?x+a[2]:a[2]; y=rel?y+a[3]:a[3]; onPoint(x,y); i+=4; }
    else if (C === "A") { const a=n(7); x=rel?x+a[5]:a[5]; y=rel?y+a[6]:a[6]; onPoint(x,y); i+=7; }
    else if (C === "Z") { x=sx; y=sy; i++; }
    else i++;
  }
}

// A segment fills every bin it spans, so a wide roof is recorded across its width.
for (const m of svg.matchAll(/\sd="([^"]+)"/g)) {
  let prev = null;
  walk(m[1], (x, y) => {
    if (prev) {
      const [x0, y0] = prev;
      const lo = Math.min(x0, x), hi = Math.max(x0, x);
      const b0 = Math.max(0, Math.floor((lo / VB_W) * BINS));
      const b1 = Math.min(BINS - 1, Math.floor((hi / VB_W) * BINS));
      const ymin = Math.min(y0, y);
      for (let b = b0; b <= b1; b++) top[b] = Math.min(top[b], ymin);
    }
    prev = [x, y];
  });
}

const rounded = top.map((v) => Math.round(Math.min(Math.max(v, 0), VB_H)));
console.log("bins:", BINS, "min y overall:", Math.min(...rounded));
const tb = Math.floor((2000 / VB_W) * BINS);
console.log("around the tower:", rounded.slice(tb - 3, tb + 4));
console.log("at the edges:", rounded.slice(0, 4), "...", rounded.slice(-4));
console.log(JSON.stringify(rounded));
