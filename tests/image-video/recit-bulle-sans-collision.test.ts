/**
 * Relecture finale de v-6e4a06b9c718 (23/10/2026), cause A : la bulle « 23H14 » du récit REC-C se posait SUR le bloc en
 * cours (« Chatbot IA » à 14,6 s, 21,4 s, « Envoyée en 4 sec » à 22,4 s, 25,4 s, « Client informé : » à 44,3 s) : la
 * place « au-dessus du nœud » était ramenée de force dans le cadre, c'est-à-dire sur le titre du nœud.
 * Ici, la VRAIE toile du travail (carte, script, voix, recette REC-C de v-6e4a06b9c718, fixture `recit-c-bulle.json`) est
 * rejouée pour ses trois versions (LinkedIn, Instagram, Facebook, 9:16) par la mise en scène réelle, puis la bulle est
 * posée toutes les 0,04 s de chaque toile REC-C. Les rectangles sont recalculés ICI (caméra `cameraA`), sans passer par
 * les fonctions du calque : le test ne peut pas s'accorder avec une erreur du calque.
 * PUR : aucun rendu, aucun appel.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cameraA, ECRAN_IV } from "@/briques/schema-motion";
import { TEMPS_IV } from "@/briques/schema-motion/temps";
import { entreesMiseEnSceneIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { mettreEnSceneIV, type BlocRenduIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { calculerScene, type SceneCalculee } from "../../studio-rendu/compositions/image-video/plan";
import { BULLE, CADRE, noeudSuivi, placeBulleRecitC, positionBulleRecitC } from "../../studio-rendu/compositions/image-video/variete/recit/bulle";
import { lireDonneesRecit } from "../../studio-rendu/compositions/image-video/variete/recit/donnees";

const F = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/recit-c-bulle.json"), "utf8")) as {
  videoId: string;
  reseaux: string[];
  carte: unknown;
  fiche: unknown;
  fins: unknown[];
  recette: unknown;
  pistes: unknown[];
};

/** L'état que lit la mise en scène (`versionsDe`, `sceneDe`) : seulement les champs du travail réel dont elle a besoin. */
const ETAT = {
  script: { fiche: F.fiche },
  plan: { fins: F.fins, sansFin: [], reduites: [] },
  carte: { carte: F.carte },
  pistes: F.pistes,
  courtes: [],
  variete: { recette: F.recette },
  demande: { videoId: F.videoId, reseaux: F.reseaux },
} as unknown as EtatFabricationIV;

type Rect = { x: number; y: number; l: number; h: number };
type BlocToile = Extract<BlocRenduIV, { sorte: "toile" }>;
type DonneesSuivi = { code: "REC-C"; role: "suivi"; libelle: string | null; depart: string; noeuds: string[]; reponse: number | null; masques: { debut: number; fin: number }[] };

/** Bulle REC-C = 330 × 140 + queue de 39 px (`Bulle`, 28 % de la hauteur). */
const emprise = (b: { x: number; y: number }): Rect => ({ x: b.x, y: b.y, l: 330, h: 140 + 39 });
const recouvre = (a: Rect, b: Rect) => a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;

interface Suivi {
  version: string;
  bloc: BlocToile;
  d: DonneesSuivi;
  scene: SceneCalculee;
}

/** Les toiles REC-C de chaque version, calculées comme le rendu (`calculerScene(b.proprietes)`). */
const SUIVIS: Suivi[] = entreesMiseEnSceneIV(ETAT).flatMap((v) =>
  mettreEnSceneIV(v.entree).ligne.blocs.flatMap((b) => {
    const d = lireDonneesRecit((b as { variete?: { donnees?: { recit?: unknown } } }).variete?.donnees?.recit);
    if (b.sorte !== "toile" || !d || d.code !== "REC-C") return [];
    return [{ version: v.version, bloc: b, d: d as DonneesSuivi, scene: calculerScene(b.proprietes) }];
  }),
);

/** Instants (secondes depuis le début du bloc) d'un échantillonnage toutes les 0,04 s (une image sur 25 par seconde). */
const instants = (s: Suivi): number[] => {
  const l: number[] = [];
  for (let k = 0; k * 0.04 <= s.bloc.fin - s.bloc.debut + 1e-9; k++) l.push(Math.round(k * 0.04 * 1000) / 1000);
  return l;
};

/** Où la caméra met un rectangle de la toile à l'écran de référence (même formule que `Camera.tsx`). */
function ecran(s: Suivi, t: number, r: { x: number; y: number; largeur: number; hauteur: number }): Rect {
  const p = cameraA(s.scene.trajectoire, t);
  return { x: (r.x - p.cx) * p.zoom + ECRAN_IV.largeur / 2, y: (r.y - p.cy) * p.zoom + ECRAN_IV.hauteur / 2, l: r.largeur * p.zoom, h: r.hauteur * p.zoom };
}

/** Ce que la relectrice voit à l'écran à l'instant `t` : nœuds DESSINÉS (dits) et pastilles de part déjà apparues. */
function visibles(s: Suivi, t: number): { id: string; rect: Rect }[] {
  const l: { id: string; rect: Rect }[] = [];
  for (const [id, b] of s.scene.parId) {
    const dit = s.scene.premierMot.get(id);
    if (dit !== undefined && t < dit - TEMPS_IV.avanceNoeud) continue;
    l.push({ id, rect: ecran(s, t, b) });
  }
  for (const e of s.scene.cadrage.etiquettes ?? []) if (t >= e.des) l.push({ id: e.id, rect: ecran(s, t, e) });
  return l;
}

/** L'ANCIENNE place (code de prod 6364a823), gardée ici pour prouver que le détecteur voit le défaut. */
function ancienneBulle(s: Suivi, id: string, t: number): { x: number; y: number } | null {
  const b = s.scene.parId.get(id);
  if (!b) return null;
  const pose = cameraA(s.scene.trajectoire, t);
  const haut = { x: (b.x + b.largeur / 2 - pose.cx) * pose.zoom + ECRAN_IV.largeur / 2, y: (b.y - pose.cy) * pose.zoom + ECRAN_IV.hauteur / 2 };
  if (haut.y - 140 - 46 > 1110 - 140 + 40) return null;
  return { x: Math.min(886 - 330, Math.max(65, haut.x - 330 * 0.2)), y: Math.min(1110 - 140, Math.max(540, haut.y - 140 - 46)) };
}

const blocA = (s: Suivi[], version: string, tVideo: number) => s.find((x) => x.version === version && tVideo >= x.bloc.debut && tVideo < x.bloc.fin);

describe("v-6e4a06b9c718 · REC-C : la fixture rejoue bien les toiles du travail refusé", () => {
  it("trois versions (LinkedIn, Instagram, Facebook), chacune avec ses toiles REC-C « 23h14 » parcourant n01 à n12", () => {
    expect([...new Set(SUIVIS.map((s) => s.version))]).toEqual(["fin-linkedin", "fin-instagram", "fin-facebook"]);
    for (const version of ["fin-linkedin", "fin-instagram", "fin-facebook"]) {
      const mesToiles = SUIVIS.filter((s) => s.version === version);
      expect(mesToiles.map((s) => s.bloc.id), version).toEqual(["b06", "b07", "b09", "b10", "b11", "b15"]);
      for (const s of mesToiles) {
        expect(s.d.libelle).toBe("23h14");
        expect(s.d.depart).toBe("n01");
        expect(s.d.noeuds).toEqual(["n01", "n02", "n03", "n04", "n05", "n06", "n07", "n08", "n09", "n10", "n11", "n12"]);
      }
    }
  });
});

describe("v-6e4a06b9c718 · REC-C : le détecteur voit le défaut de l'ancienne règle (14,6 / 21,4 / 25,4 / 44,3 s)", () => {
  it.each([
    [14.6, "b07", "n02"],
    [21.4, "b09", "n04"],
    [25.4, "b10", "n06"],
    [44.3, "b15", "n12"],
  ] as const)("à %s s, l'ancienne bulle recouvre le bloc en cours (%s, %s) dans chaque version", (tVideo, idBloc, idNoeud) => {
    for (const version of ["fin-linkedin", "fin-instagram", "fin-facebook"]) {
      const s = blocA(SUIVIS, version, tVideo);
      expect(s?.bloc.id, version).toBe(idBloc);
      const t = tVideo - s!.bloc.debut;
      expect(noeudSuivi(s!.scene, s!.d.noeuds, s!.d.depart, t).courant, `${version} ${tVideo}`).toBe(idNoeud);
      const vieille = ancienneBulle(s!, idNoeud, t);
      expect(vieille, `${version} ${tVideo} : place de l'ancien code`).not.toBeNull();
      const touches = visibles(s!, t).filter((o) => recouvre(emprise(vieille!), o.rect));
      expect(touches.map((o) => o.id), `${version} ${tVideo} : l'ancienne bulle recouvre`).toContain(idNoeud);
    }
  });
});

describe("v-6e4a06b9c718 · REC-C : la bulle « 23h14 » ne recouvre jamais un bloc ni une pastille de part", () => {
  it.each(["fin-linkedin", "fin-instagram", "fin-facebook"])("%s : toutes les 0,04 s de chaque toile REC-C, aucun nœud dit ni aucune pastille sous la bulle ; elle reste dans le cadre", (version) => {
    let posees = 0;
    let total = 0;
    for (const s of SUIVIS.filter((x) => x.version === version)) {
      for (const t of instants(s)) {
        total++;
        const b = positionBulleRecitC(s.scene, s.d.noeuds, s.d.depart, t);
        if (!b) continue;
        posees++;
        const cadre = `${s.bloc.id} à ${(s.bloc.debut + t).toFixed(2)} s`;
        const touches = visibles(s, t).filter((o) => recouvre(emprise(b), o.rect));
        expect(touches.map((o) => o.id), `${cadre} : éléments sous la bulle`).toEqual([]);
        expect(b.x, cadre).toBeGreaterThanOrEqual(CADRE.gauche);
        expect(b.x + BULLE.l, cadre).toBeLessThanOrEqual(CADRE.droite);
        expect(b.y, cadre).toBeGreaterThanOrEqual(CADRE.haut);
        expect(b.y + BULLE.h, cadre).toBeLessThanOrEqual(CADRE.bas);
      }
    }
    // Garde-fou : la bulle n'est pas supprimée en bloc (sinon « aucun recouvrement » serait vrai pour rien).
    expect(posees / total, `${version} : part du temps où la bulle est dessinée`).toBeGreaterThanOrEqual(0.25);
  });

  it("aux quatre instants du refus, la bulle n'est pas sur le bloc en cours (posée ailleurs, ou non dessinée)", () => {
    for (const [tVideo, idNoeud] of [[14.6, "n02"], [21.4, "n04"], [25.4, "n06"], [44.3, "n12"]] as const) {
      for (const version of ["fin-linkedin", "fin-instagram", "fin-facebook"]) {
        const s = blocA(SUIVIS, version, tVideo)!;
        const t = tVideo - s.bloc.debut;
        const b = positionBulleRecitC(s.scene, s.d.noeuds, s.d.depart, t);
        if (!b) continue;
        const noeud = ecran(s, t, s.scene.parId.get(idNoeud)!);
        expect(recouvre(emprise(b), noeud), `${version} ${tVideo} s`).toBe(false);
      }
    }
  });

  it("pendant un déplacement d'un nœud à l'autre, la bulle glisse sans passer sur un bloc, ou n'est pas dessinée", () => {
    for (const s of SUIVIS) {
      const passages = s.d.noeuds.filter((id) => s.scene.premierMot.has(id)).map((id) => s.scene.premierMot.get(id)! - TEMPS_IV.avanceNoeud);
      for (const depuis of passages) {
        for (let k = 0; k <= 12; k++) {
          const t = depuis + k * 0.04;
          if (t < 0 || t > s.bloc.fin - s.bloc.debut) continue;
          const b = positionBulleRecitC(s.scene, s.d.noeuds, s.d.depart, t);
          if (!b) continue;
          expect(visibles(s, t).filter((o) => recouvre(emprise(b), o.rect)).map((o) => o.id), `${s.version} ${s.bloc.id} à ${(s.bloc.debut + t).toFixed(2)} s`).toEqual([]);
        }
      }
    }
  });
});

describe("placeBulleRecitC · ordre des places et repli sans recouvrement (toile à la main, caméra au centre, zoom 1)", () => {
  /** Écran = toile : caméra centrée en (540, 960) au zoom 1. Nœuds de 480 × 200 ; `dit` = heure du mot (absent : déjà vu, dessiné). */
  function toile(noeuds: { id: string; x: number; y: number; largeur?: number; hauteur?: number; dit?: number }[], etiquettes: { id: string; x: number; y: number; largeur: number; hauteur: number }[] = []): SceneCalculee {
    return {
      trajectoire: { images: [{ t: 0, cx: 540, cy: 960, zoom: 1 }] },
      parId: new Map(noeuds.map((n) => [n.id, { id: n.id, x: n.x, y: n.y, largeur: n.largeur ?? 480, hauteur: n.hauteur ?? 200 }])),
      premierMot: new Map(noeuds.flatMap((n) => (n.dit === undefined ? [] : [[n.id, n.dit] as [string, number]]))),
      cadrage: { etiquettes: etiquettes.map((e) => ({ ...e, noeud: "n1", des: 0 })) },
    } as unknown as SceneCalculee;
  }

  it("au-dessus d'abord : à 193 px au-dessus du haut du nœud, à 20 % de la bulle avant le centre", () => {
    const p = placeBulleRecitC(toile([{ id: "n1", x: 300, y: 800, dit: 0 }]), "n1", 5);
    expect(p).toEqual({ x: 300 + 240 - 66, y: 800 - 193 });
  });

  it("nœud trop haut dans le cadre : en dessous (20 px sous le bas du nœud), puis la bulle n'est jamais ramenée sur le nœud", () => {
    const p = placeBulleRecitC(toile([{ id: "n1", x: 300, y: 571, dit: 0 }]), "n1", 5);
    expect(p).toEqual({ x: 300 + 240 - 66, y: 571 + 200 + 20 });
  });

  it("à droite avant à gauche et en dessous quand le nœud est étroit et haut dans le cadre", () => {
    const p = placeBulleRecitC(toile([{ id: "n1", x: 100, y: 571, largeur: 300, dit: 0 }]), "n1", 5);
    expect(p).toEqual({ x: 100 + 300 + 20, y: 571 });
  });

  it("à gauche quand la droite sort du cadre", () => {
    const p = placeBulleRecitC(toile([{ id: "n1", x: 560, y: 571, largeur: 300, dit: 0 }]), "n1", 5);
    expect(p).toEqual({ x: 560 - 20 - 330, y: 571 });
  });

  it("aucune place : rien n'est dessiné (null), la bulle n'est jamais posée sur le nœud", () => {
    // Nœud large en haut du cadre, un autre dessiné juste dessous : ni dessus (hors cadre), ni côtés, ni dessous.
    const s = toile([
      { id: "n1", x: 100, y: 571, largeur: 780, dit: 0 },
      { id: "n2", x: 100, y: 800, largeur: 780, dit: 0 },
    ]);
    expect(placeBulleRecitC(s, "n1", 5)).toBeNull();
  });

  it("une pastille de part dans le passage est évitée : la bulle se glisse à côté d'elle, jamais dessus", () => {
    const pastille = { id: "part-l1", x: 150, y: 790, largeur: 206, hauteur: 96 };
    const p = placeBulleRecitC(toile([{ id: "n1", x: 300, y: 571, dit: 0 }], [pastille]), "n1", 5)!;
    expect(p).not.toBeNull();
    expect(recouvre(emprise(p), { x: pastille.x, y: pastille.y, l: pastille.largeur, h: pastille.hauteur })).toBe(false);
    expect(p.y).toBe(571 + 200 + 20);
  });

  it("une carte pas encore dite (silhouette sans texte) ne bloque pas ; dite, elle bloque", () => {
    const noeuds = (dit: number) => [
      { id: "n1", x: 300, y: 571, dit: 0 },
      { id: "n2", x: 300, y: 830, dit },
    ];
    expect(placeBulleRecitC(toile(noeuds(9)), "n1", 5)).toEqual({ x: 300 + 240 - 66, y: 571 + 200 + 20 });
    expect(placeBulleRecitC(toile(noeuds(5)), "n1", 5)).toBeNull();
  });

  it("nœud inconnu : null", () => {
    expect(placeBulleRecitC(toile([{ id: "n1", x: 300, y: 800, dit: 0 }]), "zz", 5)).toBeNull();
  });
});
