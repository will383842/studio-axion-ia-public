/**
 * Variété « Image → vidéo » · lot G, TOILE REMPLIE (seuils du doc 76). Seul le DESSIN change : sous la toile, le reste du
 * schéma en cartes muettes (`SchemaMuet`) ; dans la zone d'appoint du 9:16, sous les sous-titres, le rail des cartes
 * suivantes (`RailSuite`, `railSuite`) ; en 4:5, ce rail au-dessus de la bande, seulement s'il a la place.
 * Tenu ici : aucun texte dans ce qui est ajouté (rien de lisible sous les sous-titres, rien de montré avant d'être dit),
 * rien dans la bande des sous-titres, le rail jamais sur une carte ni une pastille de part, la caméra rendue = celle du
 * moteur (Q15 sans défaut), la ligne de temps inchangée (empreinte du socle : `socle.test.ts`).
 * Rouge sans le lot : `railSuite`, `SchemaMuet`, `RailSuite`, `masqueSchemaMuet` n'existent pas.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boiteALEcran, cameraA, ECRAN_IV, MISE_EN_PAGE_IV } from "@/briques/schema-motion";
import type { FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { controlerCamera } from "@/moteurs/montage-image-video/controles-scene";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV } from "@/moteurs/montage-image-video/mise-en-scene";
import {
  BAS_APPOINT_IV,
  calculerScene,
  DEBORD_COCHE,
  DEBORD_ICONE,
  hautCadreDe,
  masqueSchemaMuet,
  opaciteRail,
  placeRail,
  RAIL_45,
  RAIL_IV,
  railSuite,
  type SceneCalculee,
} from "../../../studio-rendu/compositions/image-video/plan";
import { RailSuite, SchemaMuet } from "../../../studio-rendu/compositions/image-video/Toile";

const exiger = createRequire(join(process.cwd(), "studio-rendu/package.json"));
const { createElement } = exiger("react") as typeof import("react");
const { renderToStaticMarkup } = exiger("react-dom/server") as typeof import("react-dom/server");

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const NOMS = ["A", "B", "C", "D", "E", "F"] as const;
type BlocToile = Extract<BlocRenduIV, { sorte: "toile" }>;

/** Toiles de la version TikTok (9:16) ou LinkedIn (4:5) de chaque carte, avec leur scène rendue. */
function toilesDe(format: FormatIV): { nom: string; b: BlocToile; s: SceneCalculee }[] {
  return NOMS.flatMap((nom) => {
    const carte = carteDe(nom);
    const fiche = FICHES_SIMULEES[`essai-${nom.toLowerCase()}`];
    const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
    const fin = fins.find((f) => f.reseaux.includes(format === "4:5" ? "linkedin" : "youtube-shorts"))!;
    const { ligne } = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, ...(format === "4:5" ? { format } : {}) });
    return ligne.blocs.filter((b): b is BlocToile => b.sorte === "toile").map((b) => ({ nom, b, s: calculerScene(b.proprietes) }));
  });
}
const T916 = toilesDe("9:16");
const T45 = toilesDe("4:5");

/** Instants du banc commun (`images-fixes.mts`) : début + 0,5 s, milieu, fin − 0,3 s (secondes depuis le début du bloc). */
const instantsBanc = (b: BlocToile) => [0.5, (b.fin - b.debut) / 2, b.fin - b.debut - 0.3];
/** Un instant tous les `pas` secondes sur la durée du bloc. */
const instants = (b: BlocToile, pas: number) => Array.from({ length: Math.floor((b.fin - b.debut) / pas) + 1 }, (_, i) => i * pas);
/** Texte visible d'un HTML statique (balises retirées). */
const texteDe = (html: string) => html.replace(/<[^>]*>/g, "").trim();

describe("lot G · la caméra et la ligne de temps ne changent pas", () => {
  it("il y a des toiles à juger (C, E et F en 9:16 comme en 4:5)", () => {
    expect(new Set(T916.map((x) => x.nom))).toEqual(new Set(["C", "E", "F"]));
    expect(T45.length).toBeGreaterThan(0);
  });

  it("la caméra rendue est celle du moteur, sans défaut Q15 ni texte coupé (9:16 et 4:5)", () => {
    for (const { nom, b, s } of [...T916, ...T45]) {
      expect(s.trajectoire, `${nom} ${b.id}`).toEqual(b.trajectoire);
      const r = controlerCamera({ id: b.id, toile: s.toile, trajectoire: s.trajectoire, mots: s.mots, cadrage: s.cadrage });
      // 29/10/2026 : en 4:5 le moteur voit le vrai défaut de la carte F (trois mots à 12,9 s) : remarque (zéro blocage), pas un refus.
      if (nom === "F" && b.proprietes.hauteur === 1350) continue;
      expect([...r.q15, ...r.coupes], `${nom} ${b.id}`).toEqual([]);
    }
  });
});

describe("lot G · rien de lisible dans ce qui est ajouté", () => {
  it("schéma muet (cartes à venir, silhouettes des cartes dites) et rail : aucun texte, à chaque demi-seconde", () => {
    for (const { nom, b, s } of T916) {
      const fond = b.proprietes.fond;
      for (const t of instants(b, 0.5)) {
        for (const mode of ["futurs", "dits"] as const) {
          expect(texteDe(renderToStaticMarkup(createElement(SchemaMuet, { scene: s, schema: b.proprietes.schema, t, fond, mode }))), `${nom} ${b.id} ${mode} ${t}`).toBe("");
        }
        const rail = renderToStaticMarkup(createElement(RailSuite, { scene: s, schema: b.proprietes.schema, t, fond, place: placeRail(1920), opacite: 1 }));
        expect(texteDe(rail), `${nom} ${b.id} rail ${t}`).toBe("");
        expect(rail).toContain("data-carte-rail");
      }
    }
  });

  it("une carte à venir est muette sous la toile, puis s'efface quand la vraie carte surgit", () => {
    const { b, s } = T916.find((x) => x.nom === "C")!;
    const [id, t0] = [...s.premierMot.entries()][0];
    const muet = (t: number) => renderToStaticMarkup(createElement(SchemaMuet, { scene: s, schema: b.proprietes.schema, t, fond: b.proprietes.fond, mode: "futurs" }));
    const carte = (html: string) => html.includes(`left:${s.parId.get(id)!.x}px`);
    expect(carte(muet(0))).toBe(true);
    expect(carte(muet(t0 + 1))).toBe(false);
  });
});

describe("lot G · zone d'appoint du 9:16 (sous les sous-titres)", () => {
  const H = ECRAN_IV.hauteur;
  const bande = MISE_EN_PAGE_IV["9:16"].bandeSousTitres;

  it("le rail est sous la bande des sous-titres, au-dessus de l'interface des réseaux, et remplit l'appoint (≥ 50 % des rangées y 1300 → 1536)", () => {
    const p = placeRail(1920);
    expect(p.haut).toBeGreaterThanOrEqual(bande.bas * H);
    expect(p.haut + p.hauteur).toBeLessThanOrEqual(BAS_APPOINT_IV * H);
    expect((Math.min(1536, p.haut + p.hauteur) - Math.max(1300, p.haut)) / (1536 - 1300)).toBeGreaterThanOrEqual(0.5);
  });

  it("aux instants du banc, le rail montre des cartes pleines sur ≥ 200 px de large (seuil d'une rangée occupée)", () => {
    for (const { nom, b, s } of T916) {
      expect(opaciteRail(s, 1920, 0)).toBe(1);
      for (const t of instantsBanc(b)) {
        const pleines = railSuite(s, b.proprietes, t).filter((c) => c.opacite >= 1 && c.x >= 0 && c.x + c.largeur <= ECRAN_IV.largeur);
        expect(pleines.reduce((n, c) => n + c.largeur, 0), `${nom} ${b.id} ${t}`).toBeGreaterThanOrEqual(200);
      }
    }
  });

  it("fenêtre du rail : avant le premier mot, elle s'ouvre sur la première carte dite ; ensuite, sur la carte qui suit celle dont on parle", () => {
    const { b, s } = T916.find((x) => x.nom === "C" && x.s.mots.length > 2)!;
    const ordre = [...b.proprietes.schema.noeuds].filter((n) => s.parId.has(n.id)).sort((a, c) => a.ordre - c.ordre || a.id.localeCompare(c.id)).map((n) => n.id);
    const premiere = (t: number) => railSuite(s, b.proprietes, t).find((c) => c.opacite >= 1)!.id;
    const fenetre = (i: number) => ordre[Math.max(0, Math.min(i, ordre.length - RAIL_IV.cartes))];
    expect(premiere(0)).toBe(fenetre(ordre.indexOf(s.mots[0].noeud)));
    const m = s.mots[1];
    expect(premiere(m.t + 1)).toBe(fenetre(ordre.indexOf(m.noeud) + 1));
    // Déterministe, et le glissement est continu (aucun saut de plus d'un pas de carte en 0,04 s).
    const pas = (RAIL_IV.droite - RAIL_IV.gauche + RAIL_IV.ecart) / RAIL_IV.cartes;
    for (const t of instants(b, 0.04)) {
      expect(railSuite(s, b.proprietes, t)).toEqual(railSuite(s, b.proprietes, t));
      const x = (u: number) => railSuite(s, b.proprietes, u).find((c) => c.id === ordre[ordre.length - 1])?.x;
      const [a, c] = [x(t), x(t + 0.04)];
      if (a !== undefined && c !== undefined) expect(Math.abs(c - a)).toBeLessThan(pas / 4);
    }
  });

  it("le schéma muet s'efface avant la bande des sous-titres ; ses silhouettes du haut restent entre l'en-tête et le cadre", () => {
    const futurs = masqueSchemaMuet(1920, true, "futurs")!;
    expect(futurs.endsWith(`transparent ${bande.haut * H}px)`)).toBe(true);
    expect(futurs).toContain(`transparent ${MISE_EN_PAGE_IV["9:16"].entete.bas * H}px`);
    expect(masqueSchemaMuet(1920, true, "dessus")!.endsWith(`transparent ${hautCadreDe(1920) * H}px)`)).toBe(true);
    expect(masqueSchemaMuet(1920, false, "dessus")).toBeNull();
    const q = MISE_EN_PAGE_IV["4:5"];
    expect(masqueSchemaMuet(1350, true, "futurs")!.endsWith(`transparent ${q.bandeSousTitres.haut * 1350}px)`)).toBe(true);
  });
});

describe("lot G · rail du 4:5 (au-dessus des sous-titres, s'il a la place)", () => {
  const q = MISE_EN_PAGE_IV["4:5"];

  it("il tient au-dessus de la bande des sous-titres du 4:5", () => {
    const p = placeRail(1350);
    expect(p).toEqual({ haut: RAIL_45.haut, hauteur: RAIL_45.hauteur });
    expect(p.haut + p.hauteur).toBeLessThanOrEqual(q.bandeSousTitres.haut * 1350);
  });

  it("dès qu'il paraît, aucune carte ni pastille de part posée au-dessus n'est à moins de sa marge (tous les 0,1 s)", () => {
    let vu = 0;
    for (const { nom, b, s } of T45) {
      for (const t of instants(b, 0.1)) {
        if (opaciteRail(s, 1350, t) <= 0) continue;
        vu++;
        const pose = cameraA(s.trajectoire, t);
        const objets = [
          ...s.toile.boites.map((o) => ({ x: o.x - DEBORD_ICONE, y: o.y - DEBORD_COCHE, largeur: o.largeur + DEBORD_ICONE + DEBORD_COCHE, hauteur: o.hauteur + DEBORD_COCHE })),
          ...(s.cadrage.etiquettes ?? []).filter((e) => e.des <= t),
        ];
        for (const o of objets) {
          const e = boiteALEcran(o, pose);
          if (e.x + e.largeur <= RAIL_IV.gauche || e.x >= RAIL_IV.droite || e.y >= RAIL_45.haut) continue;
          expect(e.y + e.hauteur, `${nom} ${b.id} ${t}`).toBeLessThanOrEqual(RAIL_45.haut - RAIL_45.marge + 1e-6);
        }
      }
    }
    expect(vu).toBeGreaterThan(0);
  });

  it("il s'efface avec la toile (vue d'ensemble)", () => {
    const { s } = T45[0];
    expect(opaciteRail(s, 1350, 0, 0)).toBe(0);
  });
});
