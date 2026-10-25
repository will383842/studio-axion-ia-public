/**
 * Variété « Image → vidéo » · axe CHIFFRES (lot CHI) : CHI-B anneau, CHI-C duel, CHI-D géant, CHI-E en objets, et le
 * correctif « le chiffre qui claque sur une étape déjà posée n'est pas dessiné » (données d'accent sur la toile).
 * Chaque chiffre de la carte reste montré sur son mot avec son unité (`invariantsVarieteIV`). Aucun appel, pur.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CodeVariante, RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type BlocRenduIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { AXE_CHIFFRES, geant, paireAvantApres, type DonneesChiffresIV, type DonneesEcranChiffresIV } from "@/moteurs/montage-image-video/variete/axes/chiffres";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { parametresDuBloc } from "@/services/image-video-rendu";
import { calculerScene, DEBORD_COCHE, DEBORD_HACHURES, DEBORD_ICONE, RAIL_45 } from "../../../studio-rendu/compositions/image-video/plan";
import { miseEnPageDeHauteurIV } from "../../../src/briques/schema-motion/types";
import { boitesEcran, cadreAccent, commun, placeAccent, type SceneAccents } from "../../../studio-rendu/compositions/image-video/variete/chiffres/accent";
import type { DonneesChiffresRendu, DonneesEcranChiffresRendu } from "../../../studio-rendu/compositions/image-video/variete/chiffres/donnees";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
const CODES = ["CHI-B", "CHI-C", "CHI-D", "CHI-E"] as const;

/** Entrée de la version TikTok (9:16) d'une carte. */
function entree(nom: keyof typeof IMAGES): EntreeMiseEnSceneIV {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}
const recette = (code: CodeVariante<"chiffres">): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, chiffres: code });
const ecranDe = (b: BlocRenduIV): DonneesEcranChiffresIV | undefined =>
  b.sorte === "variete" && b.axe === "chiffres" ? (b.donnees as DonneesEcranChiffresIV) : (b.variete?.donnees?.chiffres as DonneesChiffresIV | undefined)?.ecran;

describe("chiffres · rouge sans le lot", () => {
  it("recette CHI-B sur la carte C : le bandeau devient un écran de variété CHI-B (anneau 80 %)", () => {
    const avec = mettreEnSceneIV({ ...entree("C"), variete: recette("CHI-B") }).ligne;
    const ecrans = avec.blocs.map(ecranDe).filter((e): e is DonneesEcranChiffresIV => !!e);
    expect(ecrans.map((e) => e.code)).toEqual(["CHI-B"]);
    const bloc = avec.blocs.find((b) => b.sorte === "variete" && b.axe === "chiffres")!;
    expect(bloc).toMatchObject({ sorte: "variete", axe: "chiffres", code: "CHI-B" });
    expect(ecrans[0]).toMatchObject({ anneau: { valeur: 80, reste: { texte: "20 %", legende: "Limite atteinte" } }, focal: 0, fond: "ivoire", etiquette: "Résultat" });
    expect(ecrans[0].chiffres.map((c) => c.texte)).toEqual(["80 %", "0 demande", "24h/24"]);
    expect(parametresDuBloc(bloc, avec).composition).toBe("ImageVideoVariete");
  });
});

describe("chiffres · chaque variante, sur les 6 cartes", () => {
  for (const code of CODES) {
    it(`${code} : invariants tenus (chiffres sur leur mot, avec leur unité) ; montré, ou repli CHI-A inscrit`, () => {
      for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
        const e = entree(nom);
        const sans = mettreEnSceneIV(e);
        const avec = mettreEnSceneIV({ ...e, variete: recette(code) });
        expect(invariantsVarieteIV(sans, avec), `${code} · ${nom}`).toEqual([]);
        const ecrans = avec.ligne.blocs.map(ecranDe).filter((x): x is DonneesEcranChiffresIV => !!x);
        const possible = AXE_CHIFFRES.possibles(e.carte, "9:16").includes(code);
        if (ecrans.length) {
          expect(possible, `${code} · ${nom} montré mais pas possible`).toBe(true);
          for (const x of ecrans) {
            expect(x.code).toBe(code);
            // Le bandeau garde tous ses chiffres, mot pour mot, à leur heure (le duel d'un écran partagé avant / après
            // montre la ligne de cet écran : son ancienne valeur et la nouvelle).
            const bandeau = sans.ligne.blocs.flatMap((b) => (b.sorte === "moments" ? b.moments.filter((m) => m.sorte === "bandeau") : []));
            const duelPartage = !!x.duel?.ancien.t;
            if (!duelPartage) expect(bandeau.some((m) => m.sorte === "bandeau" && JSON.stringify(m.chiffres) === JSON.stringify(x.chiffres))).toBe(true);
            expect(x.finVariante - Math.max(x.debut, x.duel?.ancien.t ?? x.chiffres[x.focal].t)).toBeGreaterThanOrEqual(1.2);
          }
          expect(avec.ligne.variete?.replis.filter((r) => r.axe === "chiffres")).toEqual([]);
        } else {
          expect(avec.ligne.variete?.replis).toContainEqual(expect.objectContaining({ axe: "chiffres", code }));
        }
      }
    });
  }

  it("possibles : CHI-B pour un pourcentage, CHI-C pour un avant / après du même indicateur, CHI-E si ça se compte", () => {
    // C : « 80 % » / « 20 % » sont deux parts complémentaires, pas un avant / après : pas de duel barré.
    expect(AXE_CHIFFRES.possibles(carteDe("C"), "9:16")).toEqual(["CHI-B", "CHI-D", "CHI-E"]);
    // D (entonnoir) : « 80 % » / « 20 % », « 2 minutes » / « 2h » (deux indicateurs différents) : pas de duel non plus.
    expect(AXE_CHIFFRES.possibles(carteDe("D"), "9:16")).not.toContain("CHI-C");
    // F : avant « 19 min/commande » → après « 45 sec » ; « 20 cmd/jour » se compte ; aucun pourcentage au bandeau.
    expect(AXE_CHIFFRES.possibles(carteDe("F"), "9:16")).toEqual(["CHI-C", "CHI-D", "CHI-E"]);
    // E (avant-après, sans bandeau) : le duel « 23 min » → « 3 secondes » sur son écran partagé.
    expect(AXE_CHIFFRES.possibles(carteDe("E"), "9:16")).toEqual(["CHI-C"]);
    for (const nom of ["A", "B"]) expect(AXE_CHIFFRES.possibles(carteDe(nom), "9:16"), nom).toEqual([]);
  });

  it("avant / après : l'ancienne valeur et la nouvelle du MÊME indicateur, jamais deux parts complémentaires", () => {
    const brut = (nom: string) => {
      const p = paireAvantApres(carteDe(nom));
      return p ? [p.ancien.brut, p.nouveau.brut] : null;
    };
    expect(brut("E")).toEqual(["23 min", "3 secondes"]);
    expect(brut("F")).toEqual(["19 min/commande", "45 sec"]);
    for (const nom of ["A", "B", "C", "D"]) expect(brut(nom), nom).toBeNull();
  });
});

describe("chiffres · données de chaque variante (carte C)", () => {
  const ecran = (code: CodeVariante<"chiffres">) => mettreEnSceneIV({ ...entree("C"), variete: recette(code) }).ligne.blocs.map(ecranDe).find(Boolean)!;

  it("CHI-C ne barre jamais un chiffre vrai : sur la carte C (80 % / 20 %), aucun duel → repli CHI-A inscrit", () => {
    const avec = mettreEnSceneIV({ ...entree("C"), variete: recette("CHI-C") });
    expect(avec.ligne.blocs.map(ecranDe).filter(Boolean)).toEqual([]);
    expect(JSON.stringify(avec.ligne.blocs)).not.toContain('"duel"');
    expect(avec.ligne.variete?.replis).toContainEqual(expect.objectContaining({ axe: "chiffres", code: "CHI-C" }));
  });

  it("CHI-C sur la carte E (avant-après) : l'ancienne valeur « 23 min » paraît sur son mot puis se barre, « 3 secondes » grandit", () => {
    const e = entree("E");
    const avec = mettreEnSceneIV({ ...e, variete: recette("CHI-C") });
    const ecrans = avec.ligne.blocs.map(ecranDe).filter((x): x is DonneesEcranChiffresIV => !!x);
    expect(ecrans).toHaveLength(1);
    const d = ecrans[0];
    expect(d).toMatchObject({ code: "CHI-C", focal: 0, chiffres: [{ texte: "3 secondes", legende: "Trouvé" }], duel: { ancien: { texte: "23 min", legende: "Recherche" } } });
    // L'ancienne est dite avant la nouvelle ; la barrée n'est jamais la nouvelle valeur.
    expect(d.duel!.ancien.t!).toBeLessThan(d.chiffres[d.focal].t);
    expect(d.duel!.ancien.texte).not.toBe(d.chiffres[d.focal].texte);
    expect(avec.ligne.variete?.replis.filter((r) => r.axe === "chiffres")).toEqual([]);
    expect(invariantsVarieteIV(mettreEnSceneIV(e), avec)).toEqual([]);
  });

  it("CHI-C sur la carte F : le bandeau « 19 min économisées » n'est pas la nouvelle valeur → pas de duel, repli inscrit", () => {
    const avec = mettreEnSceneIV({ ...entree("F"), variete: recette("CHI-C") });
    expect(avec.ligne.blocs.map(ecranDe).filter(Boolean)).toEqual([]);
    expect(avec.ligne.variete?.replis).toContainEqual(expect.objectContaining({ axe: "chiffres", code: "CHI-C" }));
  });

  it("CHI-D : fond nuit, le chiffre en grand ; découpage du texte mot pour mot", () => {
    expect(ecran("CHI-D")).toMatchObject({ fond: "sombre", geant: { lignes: ["80 %"] } });
    expect(geant({ texte: "24h/24", t: 0 })).toEqual({ lignes: ["24h", "/24"] });
    expect(geant({ texte: "0 demande", legende: "perdue", t: 0 })).toEqual({ lignes: ["0"], legende: "demande perdue" });
    expect(geant({ texte: "4 sec", t: 0 })).toEqual({ lignes: ["4 sec"] });
  });

  it("CHI-E : 80 % = 8 objets cochés sur 10, le reste déjà dit", () => {
    expect(ecran("CHI-E")).toMatchObject({ objets: { total: 10, part: 8, reste: { texte: "20 %" } } });
  });
});

/**
 * Toile synthétique en 4:5, caméra fixe (écran = toile) : un nœud vers y 620-720 avec de la place dessus et dessous, et un
 * voisin (y 892-940) dont la boîte nue est à 14 px du badge « dessous » mais dont l'ombre/coche (26 px, 32 px) le frôle.
 */
const noeud45 = (id: string, x: number, y: number, largeur: number, hauteur: number) => [id, { id, x, y, largeur, hauteur }] as const;
const SCENE_45 = {
  parId: new Map([noeud45("n", 240, 620, 600, 100), noeud45("voisin", 240, 892, 600, 48)]),
  trajectoire: { images: [{ t: 0, cx: 540, cy: 960, zoom: 1 }] },
} as unknown as SceneAccents;
const ACCENT_45 = { noeud: "n", t: 1, texte: "2h" };
const grandi = (o: { x: number; y: number; largeur: number; hauteur: number }) => ({ x: o.x - DEBORD_ICONE, y: o.y - DEBORD_COCHE, largeur: o.largeur + DEBORD_ICONE + DEBORD_HACHURES, hauteur: o.hauteur + DEBORD_COCHE + DEBORD_HACHURES });

describe("chiffres · correctif : le chiffre qui claque sur une étape déjà posée", () => {
  it("avec une recette, la toile qui a des accents les porte dans `variete.donnees.chiffres` (même sans variante)", () => {
    for (const code of ["CHI-A", ...CODES] as const) {
      const avec = mettreEnSceneIV({ ...entree("C"), variete: recette(code) }).ligne;
      const toiles = avec.blocs.filter((b) => b.sorte === "toile" && b.proprietes.accents?.length);
      expect(toiles.length, code).toBeGreaterThan(0);
      for (const b of toiles) {
        const d = b.variete?.donnees?.chiffres as DonneesChiffresIV;
        expect(d.code).toBe(code);
        expect(d.accents?.map(({ vues, ...x }) => (void vues, x))).toEqual(b.sorte === "toile" ? b.proprietes.accents : []);
      }
      expect(JSON.stringify(avec.blocs.flatMap((b) => (b.variete?.donnees?.chiffres as DonneesChiffresIV | undefined)?.accents ?? []))).toContain('"texte":"2h"');
    }
  });

  it("le badge ne recouvre JAMAIS le libellé d'un nœud (ni le nœud, ni un chiffre posé), sur les 6 cartes, à chaque image", () => {
    let vus = 0;
    for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
      const ligne = mettreEnSceneIV({ ...entree(nom), variete: recette("CHI-A") }).ligne;
      for (const b of ligne.blocs) {
        const accents = (b.variete?.donnees?.chiffres as DonneesChiffresIV | undefined)?.accents;
        if (b.sorte !== "toile" || !accents?.length) continue;
        const scene = calculerScene(parametresDuBloc(b, ligne).proprietes as Parameters<typeof calculerScene>[0]) as unknown as SceneAccents;
        for (const ac of accents) {
          for (let t = ac.t; t <= ac.t + 1.9; t += 1 / 30) {
            const p = placeAccent(scene, ac, t);
            const boites = boitesEcran(scene, ac, t);
            if (!p || !boites) continue;
            vus++;
            // Le libellé est dans la boîte de son nœud : aucune surface commune avec aucune boîte.
            for (const o of [boites.noeud, ...boites.obstacles]) expect(commun(p, o), `${nom} · ${ac.texte} à ${t.toFixed(2)} s`).toBe(0);
          }
        }
      }
    }
    expect(vus).toBeGreaterThan(30);
  });

  it("4:5 (25/10) : le badge reste dans le cadre du 4:5, au-dessus du rail des sous-titres et sous l'en-tête (jamais en surimpression)", () => {
    const haut = miseEnPageDeHauteurIV(1350).entete.bas * 1350;
    let vus = 0;
    for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
      const ligne = mettreEnSceneIV({ ...entree(nom), format: "4:5", variete: recette("CHI-A") }).ligne;
      for (const b of ligne.blocs) {
        const accents = (b.variete?.donnees?.chiffres as DonneesChiffresIV | undefined)?.accents;
        if (b.sorte !== "toile" || !accents?.length) continue;
        const scene = calculerScene(parametresDuBloc(b, ligne).proprietes as Parameters<typeof calculerScene>[0]) as unknown as SceneAccents;
        for (const ac of accents) {
          for (let t = ac.t; t <= ac.t + 1.9; t += 1 / 30) {
            const p = placeAccent(scene, ac, t, 1350);
            if (!p) continue;
            vus++;
            const qui = `${nom} · ${ac.texte} à ${t.toFixed(2)} s`;
            expect(p.surimpression, qui).toBeUndefined();
            expect(p.y + p.hauteur, qui).toBeLessThanOrEqual(RAIL_45.haut - RAIL_45.marge);
            expect(p.y, qui).toBeGreaterThanOrEqual(haut);
          }
        }
      }
    }
    // Les 6 cartes d'essai n'ont plus aucun badge posé en 4:5 (ils passaient tous en surimpression) ; la toile synthétique garde la place à côté.
    expect(vus).toBe(0);
  });

  it("4:5 : jamais de surimpression (le filet traverserait le titre) ; un badge posé est dans le cadre et hors des boîtes agrandies, sinon aucun", () => {
    const CADRE = cadreAccent(1350);
    let nuls = 0;
    let poses = 0;
    for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
      const ligne = mettreEnSceneIV({ ...entree(nom), format: "4:5", variete: recette("CHI-A") }).ligne;
      for (const b of ligne.blocs) {
        const accents = (b.variete?.donnees?.chiffres as DonneesChiffresIV | undefined)?.accents;
        if (b.sorte !== "toile" || !accents?.length) continue;
        const scene = calculerScene(parametresDuBloc(b, ligne).proprietes as Parameters<typeof calculerScene>[0]) as unknown as SceneAccents;
        for (const ac of accents) {
          for (let t = ac.t; t <= ac.t + 1.9; t += 1 / 30) {
            const qui = `${nom} · ${ac.texte} à ${t.toFixed(2)} s`;
            const p = placeAccent(scene, ac, t, 1350);
            if (!p) {
              nuls++;
              continue;
            }
            poses++;
            expect(p.surimpression, qui).toBeUndefined();
            expect(p.x, qui).toBeGreaterThanOrEqual(CADRE.x0);
            expect(p.x + p.largeur, qui).toBeLessThanOrEqual(CADRE.x1);
            expect(p.y, qui).toBeGreaterThanOrEqual(CADRE.y0);
            expect(p.y + p.hauteur, qui).toBeLessThanOrEqual(CADRE.y1);
            const boites = boitesEcran(scene, ac, t, 1350);
            if (boites && !boites.vue) for (const o of [boites.noeud, ...boites.obstacles]) expect(commun(p, grandi(o)), qui).toBe(0);
          }
        }
      }
    }
    // La règle est exercée : des badges ne sont pas dessinés (ils passaient en surimpression) ; la toile synthétique garde un badge à côté.
    expect(nuls).toBeGreaterThan(0);
    expect(poses + nuls).toBeGreaterThan(30);
    expect(placeAccent(SCENE_45, ACCENT_45, 1.2, 1350)?.surimpression).toBeUndefined();
    expect(placeAccent(SCENE_45, ACCENT_45, 1.2, 1350)).not.toBeNull();
  });

  it("4:5, toile synthétique : le badge se pose À CÔTÉ du nœud (pas en surimpression), dans le cadre, hors des boîtes agrandies ; l'ombre du voisin l'écarte du dessous", () => {
    const haut = miseEnPageDeHauteurIV(1350).entete.bas * 1350;
    const p = placeAccent(SCENE_45, ACCENT_45, 1.2, 1350)!;
    expect(p.surimpression).toBeUndefined();
    expect(p.y).toBeGreaterThanOrEqual(haut);
    expect(p.y + p.hauteur).toBeLessThanOrEqual(RAIL_45.haut - RAIL_45.marge);
    for (const o of SCENE_45.parId.values()) expect(commun(p, grandi(o)), o.id).toBe(0);
    // Le dessous (y 758-878) toucherait l'ombre/la coche du voisin (boîte agrandie dès y 860) : le badge passe au-dessus du nœud.
    expect(p.y + p.hauteur).toBeLessThanOrEqual(620 - DEBORD_COCHE);
  });

  it("4:5, vue d'ensemble : les boîtes mesurées au repère 1920 sont remontées du décalage de référence ; plus de badge en surimpression en 4:5, le filet 9:16 reste", () => {
    const nœud = { x: 100, y: 700, largeur: 880, hauteur: 200 };
    const vue = { debut: 2, fin: 3, ...nœud, obstacles: [{ x: 0, y: 0, largeur: 1080, hauteur: 690 }, { x: 0, y: 910, largeur: 1080, hauteur: 1000 }] };
    const ac = { noeud: "n", t: 2, texte: "2h", vues: [vue] };
    const scene = { parId: new Map(), trajectoire: { images: [] } } as unknown as SceneAccents;
    const decalage = miseEnPageDeHauteurIV(1350).decalageReference;
    expect(decalage).toBe(60);
    // 4:5 (25/10) : pas de surimpression, donc pas de filet ni de badge dans la vue d'ensemble dense.
    expect(placeAccent(scene, ac, 2.3, 1350)).toBeNull();
    // Les boîtes de la vue restent remontées du décalage (pour l'évitement des autres badges).
    expect(boitesEcran(scene, ac, 2.3, 1350)!.noeud.y).toBe(nœud.y - decalage);
    // 9:16 : aucun décalage, surimpression et filet inchangés.
    const p916 = placeAccent(scene, ac, 2.3, 1920)!;
    expect(p916.surimpression!.noeud.y).toBe(nœud.y);
    const bout = p916.surimpression!.filet.at(-1)!.y;
    expect(bout).toBeGreaterThanOrEqual(nœud.y);
    expect(bout).toBeLessThanOrEqual(nœud.y + nœud.hauteur);
  });

  it("le badge ne touche pas l'ombre hachurée ni les décors (pastille d'icône, coche) des nœuds, en 9:16 et en 4:5", () => {
    let vus916 = 0;
    let vus45 = 0;
    let filets = 0;
    const verifie = (qui: string, p: NonNullable<ReturnType<typeof placeAccent>>, boites: NonNullable<ReturnType<typeof boitesEcran>>) => {
      for (const o of [boites.noeud, ...boites.obstacles]) expect(commun(p, grandi(o)), qui).toBe(0);
    };
    for (const hauteurEcran of [1920, 1350]) {
      for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
        const ligne = mettreEnSceneIV({ ...entree(nom), ...(hauteurEcran === 1350 ? { format: "4:5" as const } : {}), variete: recette("CHI-A") }).ligne;
        for (const b of ligne.blocs) {
          const accents = (b.variete?.donnees?.chiffres as DonneesChiffresIV | undefined)?.accents;
          if (b.sorte !== "toile" || !accents?.length) continue;
          const scene = calculerScene(parametresDuBloc(b, ligne).proprietes as Parameters<typeof calculerScene>[0]) as unknown as SceneAccents;
          for (const ac of accents) {
            for (let t = ac.t; t <= ac.t + 1.9; t += 1 / 30) {
              if (ac.vues?.some((v) => t >= v.debut && t < v.fin)) continue; // vue d'ensemble : boîtes mesurées telles quelles
              const p = placeAccent(scene, ac, t, hauteurEcran);
              const boites = boitesEcran(scene, ac, t, hauteurEcran);
              if (!p || !boites) continue;
              if (p.surimpression) {
                // Badge dans la bande de l'en-tête (zone masquée par le fondu du haut) : le filet passe au-delà des décors du plus avancé.
                const tous = [boites.noeud, ...boites.obstacles].filter((o) => o.y + o.hauteur > p.y + p.hauteur);
                expect(hauteurEcran, `surimpression en 4:5 · ${nom}`).toBe(1920);
                const xm = p.surimpression.filet[1].x;
                const droite = Math.max(...tous.map((o) => o.x + o.largeur));
                const gauche = Math.min(...tous.map((o) => o.x));
                expect(xm >= Math.min(1070, droite + DEBORD_HACHURES + 14) || xm <= Math.max(10, gauche - DEBORD_ICONE - 14), `filet ${hauteurEcran} · ${nom} à ${t.toFixed(2)} s`).toBe(true);
                filets++;
                continue;
              }
              if (hauteurEcran === 1920) vus916++;
              else vus45++;
              verifie(`${hauteurEcran} · ${nom} · ${ac.texte} à ${t.toFixed(2)} s`, p, boites);
            }
          }
        }
      }
    }
    // 4:5 : plus aucune surimpression (le badge sans place n'est pas dessiné) ; l'échantillon 4:5 est la toile synthétique + les badges posés à côté.
    for (let t = 1; t <= 2.9; t += 1 / 30) {
      const p = placeAccent(SCENE_45, ACCENT_45, t, 1350)!;
      vus45++;
      verifie(`4:5 synthétique à ${t.toFixed(2)} s`, p, boitesEcran(SCENE_45, ACCENT_45, t, 1350)!);
    }
    expect(vus916).toBeGreaterThan(10);
    expect(vus45).toBeGreaterThan(0);
    // Les filets viennent du 9:16 seul : aucun n'est compté pour 1350 (la boucle exige 1920 dès qu'un filet existe). En 9:16 la
    // surimpression n'arrive que dans la vue d'ensemble (sautée ici, testée plus bas) : le compte peut être nul.
    expect(filets).toBeGreaterThanOrEqual(0);
  });

  it("vue d'ensemble dense (carte C, « 2h » sur « Client informé ») : le badge passe hors du schéma, relié par un filet", () => {
    const ligne = mettreEnSceneIV({ ...entree("C"), variete: recette("CHI-A") }).ligne;
    const b = ligne.blocs.find((x) => x.sorte === "toile" && (x.variete?.donnees?.chiffres as DonneesChiffresIV | undefined)?.accents?.length)!;
    const ac = (b.variete!.donnees!.chiffres as DonneesChiffresIV).accents![0];
    const scene = calculerScene(parametresDuBloc(b, ligne).proprietes as Parameters<typeof calculerScene>[0]) as unknown as SceneAccents;
    const vue = ac.vues![0];
    const p = placeAccent(scene, ac, vue.debut + 0.3)!;
    expect(p.surimpression).toBeDefined();
    expect(p.y + p.hauteur).toBeLessThanOrEqual(Math.min(vue.y, ...vue.obstacles.map((o) => o.y)));
    expect(p.surimpression!.filet.at(-1)!.y).toBeCloseTo(vue.y + vue.hauteur / 2);
  });

  it("sans recette : rien ne change (aucune donnée de variété)", () => {
    for (const b of mettreEnSceneIV(entree("C")).ligne.blocs) expect(b.variete).toBeUndefined();
  });
});

describe("chiffres · pas de perte d'information (4:5 sans surimpression)", () => {
  const norme = (t: string) => t.toLowerCase().replace(/\s+/g, "");
  it("chaque chiffre d'accent d'une toile est déjà écrit dans le libellé (ou le détail) de son nœud, sur les 6 cartes", () => {
    let vus = 0;
    for (const nom of Object.keys(IMAGES) as (keyof typeof IMAGES)[]) {
      for (const format of ["9:16", "4:5"] as const) {
        const ligne = mettreEnSceneIV({ ...entree(nom), ...(format === "4:5" ? { format } : {}), variete: recette("CHI-A") }).ligne;
        for (const b of ligne.blocs) {
          if (b.sorte !== "toile") continue;
          for (const ac of b.proprietes.accents ?? []) {
            const n = b.proprietes.schema.noeuds.find((x) => x.id === ac.noeud)!;
            expect(n, `${nom} · ${ac.noeud}`).toBeDefined();
            vus++;
            expect(norme(`${n.libelle} ${n.detail ?? ""}`), `${nom} (${format}) · « ${ac.texte} » dans « ${n.libelle} »`).toContain(norme(ac.texte));
          }
        }
      }
    }
    expect(vus).toBeGreaterThan(0);
  });
});

describe("chiffres · formes recopiées côté rendu", () => {
  it("les données du moteur s'assignent aux formes lues par les compositions", () => {
    const e: DonneesEcranChiffresIV = mettreEnSceneIV({ ...entree("C"), variete: recette("CHI-B") }).ligne.blocs.map(ecranDe).find(Boolean)!;
    const rendu: DonneesEcranChiffresRendu = e;
    const d: DonneesChiffresIV = { code: "CHI-B", ecran: e, accents: [{ noeud: "n10", t: 1, texte: "2h" }] };
    const duel: DonneesEcranChiffresIV = mettreEnSceneIV({ ...entree("E"), variete: recette("CHI-C") }).ligne.blocs.map(ecranDe).find(Boolean)!;
    const duelRendu: DonneesEcranChiffresRendu = duel;
    expect(duelRendu.duel?.ancien.texte).toBe("23 min");
    const dr: DonneesChiffresRendu = d;
    expect(rendu.code).toBe("CHI-B");
    expect(dr.accents?.[0].texte).toBe("2h");
  });

  it("4:5 : l'écran de variété se rend dans le cadre bas (1080 × 1350)", () => {
    const avec = mettreEnSceneIV({ ...entree("C"), variete: recette("CHI-D"), format: "4:5" }).ligne;
    const b = avec.blocs.find((x) => x.sorte === "variete" && x.axe === "chiffres")!;
    expect(parametresDuBloc(b, avec).proprietes).toMatchObject({ largeur: 1080, hauteur: 1350 });
  });
});
