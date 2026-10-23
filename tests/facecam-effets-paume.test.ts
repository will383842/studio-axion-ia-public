/**
 * FACECAM — LOT I2 « Objet posé sur la paume tournée vers le haut, rendu réaliste ». Tests gardés : détection paume
 * vers le haut / main retournée (vrais points MediaPipe d'une photo, puis pistes simulées) ; ancrage et orientation
 * sur pistes simulées (roulis, tangage, lacet) ; déterminisme ; option « ultra réaliste » (coupée par défaut, double
 * de simulation, aucun appel réel). Modules PURS : aucun réseau, aucun appel Claude ni Higgsfield réel.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyserMain,
  ANGLE_LISIBLE,
  caracterePrise,
  carteEnvironnement,
  CONSEIL_PAUME,
  doigtsDevant,
  estimerLumiere,
  etatPaume,
  OBJETS_SUR_PAUME,
  orienterSurPaume,
  paumeVersLeHaut,
  posesObjetMain,
  preparerObjetMain,
  reperePaume,
  temperatureDe,
  versIso,
  type EchantillonMainDetaille,
  type PointsMain,
  type Vec3,
} from "@/briques/effets-speciaux";
import { creerHiggsfieldSimule } from "@/fournisseurs/higgsfield";
import { consigneUltraRealiste, fenetreUltraRealiste, lancerUltraRealiste, REGLAGE_ULTRA_REALISTE_DEFAUT } from "@/moteurs/montage-facecam/effets-ultra-realistes";

/* ------------------------------------------------------------------ */
/* Vrais points MediaPipe (photos de test publiées avec MediaPipe)     */
/* ------------------------------------------------------------------ */

/**
 * `hand-woman-man.jpg` (640 × 317) : main gauche tendue paume vers le haut, doigts légèrement repliés — les 21 points
 * détectés par MediaPipe Hands sur la photo (fichier gardé avec les photos de la planche).
 */
const PHOTO = JSON.parse(readFileSync("studio-rendu/scripts/planche-photos/points-main.json", "utf8")) as { largeur: number; hauteur: number; points: PointsMain; cote: "gauche" };

describe("Lot I2 — paume vers le haut (21 points MediaPipe)", () => {
  it("vrais points d'une photo : paume vers le haut reconnue, avec ou sans le côté de la main", () => {
    const json = PHOTO;
    const format = json.largeur / json.hauteur;
    expect(paumeVersLeHaut(json.points, format, "gauche")).toEqual({ ok: true });
    // Sans le côté : la flexion des doigts tranche.
    expect(paumeVersLeHaut(json.points, format)).toEqual({ ok: true });
    // MediaPipe se trompe de côté : la flexion nette l'emporte.
    expect(paumeVersLeHaut(json.points, format, "droite").ok).toBe(true);
    const r = reperePaume(versIso(json.points, format), "gauche")!;
    expect(-r.normale[1]).toBeGreaterThan(0.9);
    expect(r.ouverture).toBeGreaterThan(0.8);
  });

  it("main retournée (dos vers le haut), paume montrée de face, poing : pas d'effet", () => {
    const format = PHOTO.largeur / PHOTO.hauteur;
    // Miroir vertical de la vraie main : le dos est vers le haut (et le côté s'inverse).
    const retournee = PHOTO.points.map(([x, y, z]) => [x, 1 - y, z] as Vec3);
    expect(paumeVersLeHaut(retournee, format, "droite")).toEqual({ ok: false, raison: "retournee" });
    const de = mainSimulee({ normale: [0, 0, -1], doigts: [0, -1, 0], cote: "droite" });
    expect(paumeVersLeHaut(de.points, FORMAT, "droite")).toEqual({ ok: false, raison: "de-face" });
    const poing = mainSimulee({ normale: [0, -1, 0], doigts: [1, 0, 0], cote: "droite", poing: true });
    expect(paumeVersLeHaut(poing.points, FORMAT, "droite")).toEqual({ ok: false, raison: "fermee" });
    // Main à plat sans côté connu : sens de la paume incertain → pas d'effet.
    const plate = mainSimulee({ normale: [0, -1, 0], doigts: [1, 0, 0], cote: "droite", flexion: 0 });
    expect(etatPaume(reperePaume(versIso(plate.points, FORMAT)))).toEqual({ ok: false, raison: "incertaine" });
    expect(paumeVersLeHaut(plate.points, FORMAT, "droite").ok).toBe(true);
  });

  it("main gauche et main droite simulées, paume vers le haut : reconnues ; dos vers le haut : retournées", () => {
    for (const cote of ["gauche", "droite"] as const) {
      const haut = mainSimulee({ normale: [0, -0.9, -0.44], doigts: [1, 0, 0], cote });
      expect(paumeVersLeHaut(haut.points, FORMAT, cote)).toEqual({ ok: true });
      const dos = mainSimulee({ normale: [0, 0.9, -0.44], doigts: [1, 0, 0], cote });
      expect(paumeVersLeHaut(dos.points, FORMAT, cote)).toEqual({ ok: false, raison: "retournee" });
    }
  });
});

/* ------------------------------------------------------------------ */
/* Main simulée en 3D                                                  */
/* ------------------------------------------------------------------ */

const FORMAT = 1080 / 1920;
const L = 1080;
const H = 1920;
const norm = (v: Vec3): Vec3 => {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
};
const vect = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scal = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Main simulée (coordonnées iso : unité = hauteur de l'image, y vers le bas, z vers le fond) : repère local
 * X = vers les doigts, Z = normale de la paume, Y = Z × X ; pour une main droite l'index est du côté −Y.
 */
function mainSimulee(o: { normale: Vec3; doigts: Vec3; cote: "gauche" | "droite"; centre?: [number, number]; longueur?: number; flexion?: number; poing?: boolean }) {
  const n = norm(o.normale);
  const u0 = norm(o.doigts);
  const u = norm([u0[0] - n[0] * scal(u0, n), u0[1] - n[1] * scal(u0, n), u0[2] - n[2] * scal(u0, n)]);
  const y = vect(n, u);
  const k = o.longueur ?? 0.09;
  const s = o.cote === "droite" ? 1 : -1;
  const c = o.flexion ?? 0.25;
  const local: Vec3[] = [[0, 0, 0]];
  // Pouce.
  local.push([0.25, -0.38 * s, 0.05], [0.5, -0.62 * s, 0.12], [0.72, -0.78 * s, 0.2], [0.9, -0.88 * s, 0.26]);
  for (const lat of [-0.4, -0.13, 0.13, 0.38]) {
    const l = lat * s;
    if (o.poing) local.push([1, l, 0], [1.25, l, 0.3], [1.0, l, 0.55], [0.75, l, 0.45]);
    else local.push([1, l, 0], [1.45, l, c * 0.12], [1.75, l, c * 0.35], [1.95, l, c * 0.6]);
  }
  const [cx, cy] = o.centre ?? [0.55, 0.72];
  const origine: Vec3 = [cx * FORMAT - u[0] * k * 0.5, cy - u[1] * k * 0.5, 0.2 - u[2] * k * 0.5];
  const iso = local.map(([a, b, cc]) => [origine[0] + (u[0] * a + y[0] * b + n[0] * cc) * k, origine[1] + (u[1] * a + y[1] * b + n[1] * cc) * k, origine[2] + (u[2] * a + y[2] * b + n[2] * cc) * k] as Vec3);
  const points = iso.map(([a, b, cc]) => [a / FORMAT, b, cc / FORMAT] as Vec3);
  return { points, iso, n, u };
}

/** Piste « MediaPipe » simulée : une image sur 6 (25 i/s), main paume vers le haut qui bouge (roulis, tangage, lacet). */
function pisteSimulee(opts: { debut?: number; fin?: number; retournementSec?: number; cote?: "gauche" | "droite" } = {}): EchantillonMainDetaille[] {
  const sortie: EchantillonMainDetaille[] = [];
  const cote = opts.cote ?? "droite";
  for (let i = 0; i < 125; i += 6) {
    const t = i / 25;
    if (t < (opts.debut ?? 0) || t > (opts.fin ?? 5)) continue;
    const vers = opts.retournementSec !== undefined && t >= opts.retournementSec ? 1 : -1;
    const roulis = 0.25 * Math.sin(t * 1.3);
    const tangage = 0.45 + 0.15 * Math.sin(t * 0.9);
    const lacet = 0.3 * Math.sin(t * 0.7);
    const normale: Vec3 = [Math.sin(roulis), vers * Math.cos(roulis) * Math.cos(tangage), -Math.sin(tangage)];
    const doigts: Vec3 = [Math.cos(lacet), 0, Math.sin(lacet)];
    const m = mainSimulee({ normale, doigts, cote, centre: [0.55 + 0.05 * Math.sin(t * 1.7), 0.72 + 0.03 * Math.sin(t * 2.1)] });
    sortie.push({ t, x: 0.55, y: 0.72, ouverte: true, points: m.points, cote });
  }
  return sortie;
}

/** Rotation d'un vecteur par un quaternion [x, y, z, w]. */
function tournerQ(q: [number, number, number, number], v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  const u: Vec3 = [x, y, z];
  const t = vect(u, v).map((a) => 2 * a) as Vec3;
  const c = vect(u, t);
  return [v[0] + w * t[0] + c[0], v[1] + w * t[1] + c[1], v[2] + w * t[2] + c[2]];
}
const angle = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, Math.max(-1, scal(norm(a), norm(b)))));

describe("Lot I2 — ancrage et orientation sur pistes simulées", () => {
  const instants = Array.from({ length: 100 }, (_, i) => 0.5 + i / 25);
  const cadre = { x: 0, y: 0, largeur: 1, hauteur: 1 };

  it("l'objet repose au creux de la paume, orienté selon la paume (roulis, tangage, lacet suivis), taille ≈ 1,1 × paume", () => {
    const mains = pisteSimulee();
    const a = analyserMain(mains, 0.4, 4.9, { largeurSurHauteur: FORMAT });
    expect(a.trouvee).toBe(true);
    if (!a.trouvee) return;
    const poses = posesObjetMain({ main: a, instantsPrise: instants, cadre, largeur: L, hauteur: H, fps: 25, objet: "telephone" });
    expect(poses.every((p) => p.surPaume)).toBe(true);
    // Comparaison aux instants des échantillons (vérité de terrain).
    for (const e of mains.filter((m) => m.t >= 1 && m.t <= 4.4)) {
      const i = instants.findIndex((t) => Math.abs(t - e.t) < 1e-6);
      if (i < 0) continue;
      const p = poses[i];
      const r = reperePaume(versIso(e.points!, FORMAT), "droite")!;
      // Contact : au creux de la paume (écart < 1,5 % de la largeur ; lissage sans retard).
      expect(Math.hypot(p.x - (r.creux[0] / FORMAT) * L, p.y - r.creux[1] * H)).toBeLessThan(0.015 * L);
      // Normale de la paume suivie (scène : y haut, z vers la caméra).
      const nScene: Vec3 = [r.normale[0], -r.normale[1], -r.normale[2]];
      expect(angle(p.surPaume!.normale, nScene)).toBeLessThan(0.08);
      // Face de l'écran : la normale de la paume inclinée vers la caméra, jamais au-delà de l'angle lisible + marge.
      const face = tournerQ(p.surPaume!.quaternion, [0, 0, 1]);
      expect(Math.abs(angle(face, nScene) - p.surPaume!.inclinaison)).toBeLessThan(0.02);
      // Grand côté du téléphone le long des doigts (au signe près : l'écran se lit à l'endroit).
      const haut = tournerQ(p.surPaume!.quaternion, [0, 1, 0]);
      const doigts: Vec3 = [r.doigts[0], -r.doigts[1], -r.doigts[2]];
      expect(Math.abs(scal(norm(haut), doigts))).toBeGreaterThan(0.9);
      // Taille : 1,1 fois la longueur de la paume.
      expect(p.taille / (r.longueur * H)).toBeCloseTo(OBJETS_SUR_PAUME.telephone.surPaume, 1);
    }
    // L'écran reste lisible : jamais plus loin de la caméra que l'angle lisible quand l'inclinaison n'est pas au maximum.
    for (const p of poses.filter((x) => x.visible > 0.5)) {
      const face = tournerQ(p.surPaume!.quaternion, [0, 0, 1]);
      if (p.surPaume!.inclinaison < 0.41) expect(angle(face, [0, 0, 1])).toBeLessThan(ANGLE_LISIBLE + 0.02);
    }
  });

  it("le logo se tient debout sur la paume, face tournée vers la caméra", () => {
    const mains = pisteSimulee();
    const a = analyserMain(mains, 0.4, 4.9, { largeurSurHauteur: FORMAT });
    if (!a.trouvee) throw new Error("main non trouvée");
    const poses = posesObjetMain({ main: a, instantsPrise: instants, cadre, largeur: L, hauteur: H, fps: 25, objet: "logo-axion" });
    for (const p of poses.filter((x) => x.visible > 0.5)) {
      const haut = tournerQ(p.surPaume!.quaternion, [0, 1, 0]);
      expect(angle(haut, p.surPaume!.normale)).toBeLessThan(1e-3);
      const face = tournerQ(p.surPaume!.quaternion, [0, 0, 1]);
      expect(face[2]).toBeGreaterThan(0.3);
    }
  });

  it("apparaît en fondu quand la paume s'ouvre vers le haut, disparaît quand la main se retourne", () => {
    const mains = pisteSimulee({ retournementSec: 3.2, debut: 0.9 });
    const a = analyserMain(mains, 0, 5, { largeurSurHauteur: FORMAT });
    expect(a.trouvee).toBe(true);
    if (!a.trouvee) return;
    expect(a.finSec).toBeLessThan(3.4);
    expect(a.finSec).toBeGreaterThan(2.9);
    const poses = posesObjetMain({ main: a, instantsPrise: instants, cadre, largeur: L, hauteur: H, fps: 25, objet: "telephone" });
    const vis = poses.map((p) => p.visible);
    expect(vis[instants.findIndex((t) => t >= a.debutSec)]).toBeLessThan(0.6); // fondu d'entrée
    expect(vis[0]).toBe(0);
    expect(Math.max(...vis)).toBeGreaterThan(0.99);
    expect(vis[instants.findIndex((t) => t > 3.5)]).toBe(0);
    // Léger éclat discret au début seulement.
    expect(poses.filter((p) => p.eclat >= 0).every((p) => instants[poses.indexOf(p)] - a.debutSec <= 0.61)).toBe(true);
  });

  it("main retournée tout du long : pas d'effet, « Effet non réussi — Réessayer » avec le conseil simple", () => {
    const mains = pisteSimulee({ retournementSec: 0 });
    const a = analyserMain(mains, 0, 5, { largeurSurHauteur: FORMAT });
    expect(a).toMatchObject({ trouvee: false, raison: "main-retournee", conseil: CONSEIL_PAUME });
    const prep = preparerObjetMain({ objet: "telephone", debutPriseSec: 0, finPriseSec: 5, mains, priseVersMontee: (s) => s, monteeVersPrise: (s) => s, cadre, largeur: L, hauteur: H });
    expect(prep.ok).toBe(false);
    if (!prep.ok) expect(prep.analyse.conseil).toMatch(/paume ouverte vers le haut/);
  });

  it("main gauche : même ancrage, même orientation", () => {
    const mains = pisteSimulee({ cote: "gauche" });
    const a = analyserMain(mains, 0.4, 4.9, { largeurSurHauteur: FORMAT });
    expect(a.trouvee).toBe(true);
  });

  it("déterministe : mêmes entrées, mêmes poses (rendu image par image, sur n'importe quel cœur)", () => {
    const run = () => {
      const a = analyserMain(pisteSimulee(), 0.4, 4.9, { largeurSurHauteur: FORMAT });
      if (!a.trouvee) throw new Error("main non trouvée");
      return posesObjetMain({ main: a, instantsPrise: instants, cadre, largeur: L, hauteur: H, fps: 25, objet: "telephone", graine: 3 });
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it("doigts au premier plan : un pouce nettement devant l'objet est remis par-dessus, pas les doigts derrière", () => {
    const m = mainSimulee({ normale: [0, -0.9, -0.44], doigts: [1, 0, 0], cote: "droite" });
    const r = reperePaume(m.iso, "droite")!;
    const o = orienterSurPaume(r, "a-plat");
    const face: Vec3 = [o.face[0], -o.face[1], -o.face[2]];
    const centre: Vec3 = [r.creux[0] + r.normale[0] * 0.01, r.creux[1] + r.normale[1] * 0.01, r.creux[2] + r.normale[2] * 0.01];
    const iso = m.iso.map((p) => [...p] as Vec3);
    // Pouce ramené nettement vers la caméra.
    for (const k of [2, 3, 4]) iso[k] = [iso[k][0], iso[k][1], iso[k][2] - 0.06];
    const capsules = doigtsDevant(iso, r, centre, face, FORMAT);
    expect(capsules.length).toBeGreaterThan(0);
    expect(capsules.some((c) => Math.abs(c.x2 - iso[4][0] / FORMAT) < 1e-3)).toBe(true);
    // Sans rien devant : aucun masque.
    const loin = m.iso.map((p) => [p[0], p[1], p[2] + 0.2] as Vec3);
    expect(doigtsDevant(loin, r, centre, face, FORMAT)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Lumière, reflets, flou, grain                                       */
/* ------------------------------------------------------------------ */

describe("Lot I2 — lumière, reflets et caractère de la prise", () => {
  it("température : lumière du jour ≈ 6 500 K, ampoule chaude bien plus basse", () => {
    expect(temperatureDe("#FFFFFF")).toBeGreaterThan(6000);
    expect(temperatureDe("#FFFFFF")).toBeLessThan(7000);
    expect(temperatureDe("#FFB46B")).toBeLessThan(3500);
    const rvb = new Uint8Array(64 * 64 * 3).fill(200);
    expect(estimerLumiere(rvb, 64, 64).temperatureK).toBeGreaterThan(6000);
  });

  it("carte d'environnement : taille, déterminisme, couleurs de la pièce", () => {
    const l = 90;
    const h = 160;
    const rvb = new Uint8Array(l * h * 3);
    for (let i = 0; i < l * h; i++) {
      rvb[i * 3] = 220;
      rvb[i * 3 + 1] = 120;
      rvb[i * 3 + 2] = 40;
    }
    const c = carteEnvironnement(rvb, l, h);
    expect(c.pixels.length).toBe(c.largeur * c.hauteur * 3);
    expect(JSON.stringify(carteEnvironnement(rvb, l, h))).toBe(JSON.stringify(c));
    // Face à la scène (u ≈ 0,25, horizon) : la couleur de l'image ; derrière la caméra : un peu plus sombre.
    const px = (u: number, v: number) => c.pixels.slice((Math.floor(v * c.hauteur) * c.largeur + Math.floor(u * c.largeur)) * 3).slice(0, 3);
    expect(px(0.25, 0.5)).toEqual([220, 120, 40]);
    expect(px(0.75, 0.5)[0]).toBeLessThan(220);
  });

  it("grain et flou mesurés : image bruitée → grain, image floue → flou", () => {
    const l = 200;
    const h = 200;
    const bruit = new Uint8Array(l * h * 3);
    let e = 7;
    const alea = () => ((e = (e * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < l * h; i++) {
      const v = 128 + (alea() - 0.5) * 2 * 10;
      bruit.set([v, v, v], i * 3);
    }
    const g = caracterePrise(bruit, l, h);
    expect(g.grain).toBeGreaterThan(2);
    const net = new Uint8Array(l * h * 3);
    const flou = new Uint8Array(l * h * 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < l; x++) {
        const v = x < 100 ? 40 : 210;
        const w = 40 + 170 / (1 + Math.exp(-(x - 100) / 2.5));
        net.set([v, v, v], (y * l + x) * 3);
        flou.set([w, w, w], (y * l + x) * 3);
      }
    expect(caracterePrise(net, l, h).flouPx).toBeLessThan(0.5);
    expect(caracterePrise(flou, l, h).flouPx).toBeGreaterThan(caracterePrise(net, l, h).flouPx + 1);
  });
});

/* ------------------------------------------------------------------ */
/* Option « ultra réaliste » (Higgsfield, double de simulation)        */
/* ------------------------------------------------------------------ */

describe("Lot I2 — option « ultra réaliste » (coupée par défaut, payante, à la demande)", () => {
  const demande = (duree = 4, explicite = true) => ({
    passageId: "p1",
    objet: "telephone" as const,
    demandeExplicite: explicite,
    dureeSec: duree,
    video: { nom: "effet.mp4", type: "video/mp4" as const, octets: new Uint8Array([1, 2, 3]) },
    imageReference: { nom: "telephone.png", type: "image/png" as const, octets: new Uint8Array([4, 5]) },
  });
  const sansAttente = { attendre: async () => {} };

  it("coupée par défaut : rien n'est envoyé, aucun crédit", async () => {
    const f = creerHiggsfieldSimule();
    expect(REGLAGE_ULTRA_REALISTE_DEFAUT).toEqual({ actif: false, reel: false });
    const r = await lancerUltraRealiste(f, demande(), undefined, sansAttente);
    expect(r).toMatchObject({ ok: false, raison: "coupe", credits: 0 });
    expect(f.medias).toHaveLength(0);
    expect(f.lancements).toHaveLength(0);
  });

  it("jamais sans demande explicite, jamais hors de 3-5 s, jamais au-delà du solde", async () => {
    const actif = { actif: true, reel: false };
    const f = creerHiggsfieldSimule();
    expect(await lancerUltraRealiste(f, demande(4, false), actif, sansAttente)).toMatchObject({ ok: false, raison: "non-demande" });
    expect(await lancerUltraRealiste(f, demande(6), actif, sansAttente)).toMatchObject({ ok: false, raison: "duree" });
    expect(await lancerUltraRealiste(f, demande(2), actif, sansAttente)).toMatchObject({ ok: false, raison: "duree" });
    const pauvre = creerHiggsfieldSimule({ soldeCredits: 5 });
    expect(await lancerUltraRealiste(pauvre, demande(4), actif, sansAttente)).toMatchObject({ ok: false, raison: "solde", credits: 0 });
    expect(f.lancements).toHaveLength(0);
    expect(pauvre.lancements).toHaveLength(0);
  });

  it("activée et demandée : Kling Omni Edit avec l'image de référence de l'objet, devis 2 crédits/s (double de simulation)", async () => {
    const f = creerHiggsfieldSimule();
    const r = await lancerUltraRealiste(f, demande(4), { actif: true, reel: false }, sansAttente);
    expect(r).toMatchObject({ ok: true, credits: 8, mode: "simulation" });
    expect(f.medias.map((m) => m.nom)).toEqual(["effet.mp4", "telephone.png"]);
    expect(f.lancements[0]).toMatchObject({ modele: "kling_video_edit", imageReferenceMediaId: "sim-media-2", dureeSec: 4, idempotence: "ultra-realiste:p1" });
    expect(f.lancements[0].consigne).toMatch(/palm-up/);
    expect(consigneUltraRealiste("logo-axion")).toMatch(/letter A/);
  });

  it("échec du fournisseur : l'effet 3D est livré tel quel, aucun nouvel essai automatique", async () => {
    const f = creerHiggsfieldSimule({ lancementsEnEchec: [0] });
    const r = await lancerUltraRealiste(f, demande(3), { actif: true, reel: false }, sansAttente);
    expect(r).toMatchObject({ ok: false, raison: "echec" });
    expect(f.lancements).toHaveLength(1);
  });

  it("fenêtre de 3 à 5 s au cœur du passage où l'objet est pleinement visible", () => {
    const pose = (visible: number) => ({ x: 0, y: 0, taille: 1, paumeX: 0, paumeY: 0, visible, eclat: -1, fuite: -1, rotX: 0, rotY: 0, rotZ: 0, ecarte: false });
    const poses = [...Array(10).fill(pose(0.5)), ...Array(175).fill(pose(1)), ...Array(10).fill(pose(0.2))];
    const f = fenetreUltraRealiste(poses, 25)!;
    expect(f.dureeSec).toBe(5);
    expect(f.debutSec).toBeGreaterThanOrEqual(0.4);
    expect(fenetreUltraRealiste(Array(50).fill(pose(1)), 25)).toBeNull();
  });
});

describe("Lot I2 — repli dans la chaîne", () => {
  it("main retournée : décision « Effet non réussi — Réessayer » avec le conseil", async () => {
    const { preparerEffetsFacecam } = await import("@/moteurs/montage-facecam/effets-speciaux");
    const { CONSEIL_PAUME: conseil } = await import("@/briques/effets-speciaux");
    const mains = pisteSimulee({ retournementSec: 0 });
    const passage = {
      id: "main-dos",
      type: "autre",
      debutSec: 0,
      finSec: 5,
      ancre: { debutPriseSec: 0, finPriseSec: 5 },
      operation: { type: "objetMain", debutMot: 0, finMot: 1, objet: "telephone", description: "téléphone" },
      origine: "demande",
    };
    const r = preparerEffetsFacecam({
      passages: [passage as never],
      piste: { version: 1, largeurSource: 1080, hauteurSource: 1920, imagesParSec: 12.5, echantillons: [], mains, visageTrouvePct: 0 },
      coupes: [{ debutSec: 0, finSec: 5 }],
      cadre: { x: 0, y: 0, largeur: 1, hauteur: 1 },
      largeur: 1080,
      hauteur: 1920,
      raccordsSec: [],
      pisteMonteeCle: "piste.mp4",
      prefixe: "effets",
    } as never);
    expect(r.rendus).toEqual([]);
    expect(r.decisions[0]).toMatchObject({ livre: "sans-detourage", message: "Effet non réussi — Réessayer", geste: "Réessayer", conseil });
  });
});
