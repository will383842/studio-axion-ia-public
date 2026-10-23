/**
 * Analyse un journal d'audit (voir `rendre-planche.mjs`, tâche `audit:`). Usage : node analyser-audit.mjs <audit-X.json> [...]
 * Règles vérifiées image par image (standard v4 § C, critique § 3) :
 *  1. le sous-titre ne coupe JAMAIS la bande des yeux [0,27 + D ; 0,36 + D] H ;
 *  2. écart ≥ 29 px (0,015 H) entre le sous-titre et tout objet posé ;
 *  3. marges : côtés ≥ 54 px (0,05 L), haut ≥ 68 px (hors bande ivoire), bas ≤ 0,84 H, pour tout objet posé (immobile d'une image à l'autre) ;
 *  4. aucun objet figé plus de 12 images (geste de vie toutes les 12 images au plus ; tolérance du standard : 22 images = 0,75 s).
 */
import { readFileSync } from "node:fs";
const H = 1920, W = 1080;
let echec = 0;
for (const fichier of process.argv.slice(2)) {
  const J = JSON.parse(readFileSync(fichier, "utf8"));
  const rapport = [];
  const runs = (nom, pred, tolere = 0) => {
    let debut = null, n = 0;
    const fin = (f) => { if (debut !== null && n > tolere) rapport.push(`${nom} : images ${debut}-${f - 1} (${n} i)`); debut = null; n = 0; };
    for (const e of J) { const m = pred(e); if (m) { if (debut === null) debut = e.f; n++; } else fin(e.f); }
    fin(J.length ? J[J.length - 1].f + 1 : 0);
  };
  const precedent = new Map();
  const posePar = new Map();
  for (const e of J) {
    const stable = new Set();
    for (const o of e.ob) {
      const p = precedent.get(o[0]);
      if (p && Math.abs(p[1] - o[1]) <= 2 && Math.abs(p[2] - o[2]) <= 2 && Math.abs(p[3] - o[3]) <= 2 && Math.abs(p[4] - o[4]) <= 2) stable.add(o[0]);
    }
    e.stable = stable;
    precedent.clear();
    for (const o of e.ob) precedent.set(o[0], o);
  }
  runs("YEUX (sous-titre sur la bande des yeux)", (e) => e.st && e.st[3] > e.D * H + 0.27 * H && e.st[1] < e.D * H + 0.36 * H);
  runs("ECART < 29 px sous-titre / objet", (e) => e.st && e.ob.some((o) => !o[0].startsWith("bande-") && e.stable.has(o[0]) &&
    !(e.st[1] - o[4] >= 29 || o[2] - e.st[3] >= 29 || e.st[0] - o[3] >= 29 || o[1] - e.st[2] >= 29)), 1);
  runs("MARGE (côté < 54 px, haut < 68 px ou bas > 0,84 H)", (e) => e.ob.some((o) => e.stable.has(o[0]) && o[0] !== "chiffre" && (o[1] < 54 || o[3] > W - 54 || (!o[0].startsWith("bande-") && o[2] < 68) || o[4] > 0.84 * H)));
  // immobilité
  const derniers = new Map();
  const figes = [];
  for (const e of J) {
    const vus = new Set();
    for (const o of e.ob) {
      vus.add(o[0]);
      const d = derniers.get(o[0]);
      if (d && d.h === o[5] && d.f === e.f - 1) { d.f = e.f; d.n++; if (d.n > d.max) d.max = d.n; } else { if (d && d.max > 12) figes.push(`${o[0]} figé ${d.max} i (jusqu'à l'image ${d.f})`); derniers.set(o[0], { h: o[5], f: e.f, n: 1, max: 1 }); }
    }
  }
  for (const [id, d] of derniers) if (d.max > 12) figes.push(`${id} figé ${d.max} i (jusqu'à l'image ${d.f})`);
  rapport.push(...figes.map((x) => "IMMOBILE " + x));
  const maxFige = Math.max(0, ...[...derniers.values()].map((d) => d.max));
  console.log(`${fichier} : ${J.length} images, plus longue immobilité d'un objet = ${maxFige} i`);
  if (rapport.length) { echec++; for (const r of rapport) console.log("  ✗", r); } else console.log("  ✓ aucune infraction");
}
process.exit(echec ? 1 : 0);
