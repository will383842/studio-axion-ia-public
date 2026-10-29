/**
 * Variété « Image → vidéo » · SOCLE : contrat commun, tirage déterministe par graine, points d'accroche.
 * Sans recette, la ligne de temps des 6 cartes est identique OCTET POUR OCTET à celle de master (empreinte figée avant
 * toute modification, master 0b40682). Aucun appel, aucune date, aucun hasard.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AXES_VARIETE, CADRES_IV, REFERENCES, RETIREES, VARIANTES_GARDEES, type CodeVariante, type FormatIV, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
// 26/10/2026 : valeurs de référence (octet pour octet) calculées sur le plan des fins d'AVANT (fin « diagnostic », LinkedIn muet) :
// elles prouvent que le rendu ne change pas pour un plan inchangé, quelles que soient les fins posées aujourd'hui.
import { planDesFinsAvant as planDesFinsIV } from "../plan-des-fins-avant";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { AXES_APPLIQUES_IV } from "@/moteurs/montage-image-video/variete";
import { recettePourVersion, RECETTE_REFERENCE_IV, tirablesDe, tirerVarieteIV } from "@/moteurs/montage-image-video/variete/tirage";
import { COMPOSITIONS_RENDU_IV, parametresDuBloc } from "@/services/image-video-rendu";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;

/** Les entrées des 6 cartes, une par version (fin) du plan des fins, dans l'ordre du plan. */
function entrees(): { nom: string; entree: EntreeMiseEnSceneIV }[] {
  return Object.entries(IMAGES).flatMap(([nom, id]) => {
    const carte = carteDe(nom);
    const fiche = FICHES_SIMULEES[id];
    const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
    return fins.map((fin) => ({ nom, entree: { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES } }));
  });
}

/**
 * Empreinte des lignes de temps sans recette (6 cartes × 5 versions, JSON bout à bout). Celle de master 0b40682,
 * figée avant le socle, était 9326334f…5463. Lot F (autorisé par le chef de projet) : la PREMIÈRE pose de caméra de
 * chaque toile monte la première carte en haut de la bande (`posesDesMots`) ; seules les trajectoires changent, et
 * Q12, Q13, Q15 et Q22 restent tenus sur les 6 cartes (`assemblage.test.ts`).
 * Intégration (fusion de master avec #320, #323, #331, #340) : `da964062…f487` → `8fbf081a…87d1`. Vérifié : hors
 * trajectoires et cadrages (lot F), la ligne sans recette est IDENTIQUE à celle de master 6e48108 sur les 30 versions,
 * à l'heure près de deux mouvements de caméra (`b05-camera-2`, `b06-camera-2`), qui suivent ces trajectoires.
 * Caméra (17/10, bloc entier sur son mot) : seule la toile b06 de la carte F change (la caméra ne quitte plus n09
 * avant son mot : n08 surgit 0,31 s et n10 0,17 s après leur mot, décalage existant ≤ 0,6 s ; trajectoire et bruitage
 * de caméra suivent). `8fbf081a…87d1` → `96b05ce0…f82a`.
 * Queue de fin (17/10, v-dd3049053f88) : chaque ligne porte sa queue animée (`queue`, trait de fin après le dernier mot,
 * Q24) ; rien d'autre ne change (vérifié en neutralisant la queue : `96b05ce0…f82a`). `96b05ce0…f82a` → `059fa6c5…e2b`.
 */
// 19/10/2026 : TikTok retiré d'Image → vidéo (décision de Will) : la version de référence 9:16 est celle de YouTube Shorts ; empreinte recalculée sur master avec YouTube Shorts à la place de TikTok : même valeur.
// 25/10/2026 : réserve de chasse de 6 % sur les boîtes de la toile (PR 42) : deux boîtes 9:16 gagnent une ligne (« L'IA au service de vos résultats » 2 → 3 lignes, « Envoyée en 4 sec » 1 → 2) et les largeurs des boîtes changent ; recalculée, ancienne 851d5e4c… (seule cause : la réserve).
// 25/10/2026 : affiche de la première image (`ligne.affiche`, nouvelle clé de chaque ligne) ; prouvé : affiche neutralisée, l'ancienne 25be9084… revient ; recalculée.
const EMPREINTE_MASTER = "beb18bfb35b3a76737c7f831f307ece4dffea51c5b65ce7aa8b7190ca6eb04d1";

describe("socle · sans recette, rien ne change", () => {
  it("la ligne de temps des 6 cartes est identique octet pour octet à celle de master", () => {
    const h = createHash("sha256");
    for (const { entree } of entrees()) h.update(JSON.stringify(mettreEnSceneIV(entree).ligne));
    expect(h.digest("hex")).toBe(EMPREINTE_MASTER);
  }, 60_000);

  it("format 9:16 explicite = pas de format", () => {
    const { entree } = entrees()[0];
    expect(JSON.stringify(mettreEnSceneIV({ ...entree, format: "9:16" }).ligne)).toBe(JSON.stringify(mettreEnSceneIV(entree).ligne));
  });
});

describe("socle · tirage déterministe", () => {
  const carte = carteDe("C");

  it("même graine → même recette ; un code par axe, jamais un retiré", () => {
    const a = tirerVarieteIV({ graine: "video-42", carte, format: "9:16" });
    expect(tirerVarieteIV({ graine: "video-42", carte, format: "9:16" })).toEqual(a);
    expect(Object.keys(a).sort()).toEqual([...AXES_VARIETE].sort());
    for (const axe of AXES_VARIETE) expect(RETIREES[axe]).not.toContain(a[axe]);
  });

  it("200 graines × 6 cartes : chaque variante tirable sortie au moins une fois, aucune retirée, jamais hors `possibles`", () => {
    // Une variante peut être impossible sur une carte (CHI-C n'existe plus sur la carte C, #307) : on tire sur les 6
    // cartes, et chaque tirage reste dans les codes possibles de SA carte.
    const vus = new Set<CodeVariante>();
    for (const nom of Object.keys(IMAGES)) {
      const c = carteDe(nom);
      const permis = new Map(AXES_APPLIQUES_IV.map((a) => [a.axe, new Set<string>(a.possibles(c, "9:16"))]));
      for (let i = 0; i < 200; i++) {
        const r = tirerVarieteIV({ graine: `graine-${i}`, carte: c, format: "9:16" });
        for (const axe of AXES_VARIETE) {
          vus.add(r[axe]);
          const p = permis.get(axe);
          if (p && p.size) expect(p.has(r[axe]), `${nom} ${axe} ${r[axe]}`).toBe(true);
        }
      }
    }
    for (const axe of AXES_VARIETE) {
      for (const code of VARIANTES_GARDEES[axe]) expect(vus.has(code), code).toBe(true);
      for (const code of RETIREES[axe]) expect(vus.has(code), code).toBe(false);
      for (const code of tirablesDe(axe)) expect(vus.has(code), code).toBe(true);
    }
  });

  it("recettePourVersion : substitutions 4:5 (TYP-B → TYP-C, SOU-C → SOU-D, FIN-C → FIN-D, CAM-E → CAM-B) et ouverture du réseau", () => {
    const r: RecetteVarieteIV = { ...RECETTE_REFERENCE_IV, texte: "TYP-B", sousTitres: "SOU-C", fin: "FIN-C", camera: "CAM-E", ouverture: "OUV-D" };
    const v = recettePourVersion(r, ["linkedin"], "4:5");
    expect(v).toMatchObject({ texte: "TYP-C", sousTitres: "SOU-D", fin: "FIN-D", camera: "CAM-B" });
    expect(["OUV-B", "OUV-E", "OUV-A"]).toContain(v.ouverture);
    expect(recettePourVersion(r, ["linkedin"], "4:5")).toEqual(v);
    // 9:16 : rien ne change si l'ouverture convient.
    expect(recettePourVersion(r, ["youtube-shorts"], "9:16")).toEqual(r);
  });

  it("la référence sans recette : REC-A, CHI-A, CAM-A, TYP-A, APP-A, TRA-A, FIN-A, MAT-A, SOU-B", () => {
    expect(RECETTE_REFERENCE_IV).toMatchObject({ recit: "REC-A", chiffres: "CHI-A", camera: "CAM-A", texte: "TYP-A", apparition: "APP-A", transitions: "TRA-A", fin: "FIN-A", matiere: "MAT-A", sousTitres: "SOU-B" });
    for (const axe of AXES_VARIETE) if (REFERENCES[axe]) expect(RECETTE_REFERENCE_IV[axe]).toBe(REFERENCES[axe]);
  });

  it("4:5 : cadre 1080 × 1350, hauteur utile 54 → 1215, sous-titres 1042 → 1176", () => {
    expect(CADRES_IV["9:16"]).toMatchObject({ largeur: 1080, hauteur: 1920 });
    expect(CADRES_IV["4:5"]).toMatchObject({ largeur: 1080, hauteur: 1350, utile: { haut: 54, bas: 1215 }, sousTitres: { haut: 1042, bas: 1176 } });
  });

  it("aucun Math.random ni Date dans variete/** (moteur et compositions)", () => {
    const fichiers = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? fichiers(join(d, n)) : [join(d, n)]));
    const tous = [...fichiers(join(process.cwd(), "src/moteurs/montage-image-video/variete")), ...fichiers(join(process.cwd(), "studio-rendu/compositions/image-video/variete")), join(process.cwd(), "src/briques/schema-motion/variete.ts")];
    expect(tous.length).toBeGreaterThan(10);
    for (const f of tous) expect(readFileSync(f, "utf8"), f).not.toMatch(/Math\.random|\bDate\b/);
  });
});

describe("socle · avec une recette (les axes sont remplis par les lots)", () => {
  const cas = entrees().filter((x) => x.entree.reseaux.includes("youtube-shorts"));

  it("blocs hors `variete` inchangés, chacun avec le champ `variete` ; la ligne porte la recette ; invariants tenus", () => {
    for (const format of ["9:16", "4:5"] as FormatIV[]) {
      for (const { nom, entree } of cas) {
        const recette = tirerVarieteIV({ graine: `essai-${nom}`, carte: entree.carte, format });
        const sans = mettreEnSceneIV({ ...entree, format });
        const avec = mettreEnSceneIV({ ...entree, variete: recette, format });
        // Les axes remplacent des blocs par des blocs `variete` et retouchent les autres (caméra, apparition, cadre
        // 4:5) : les blocs hors `variete` gardent leur id, leur sorte et leurs bornes ; le reste est tenu par les invariants.
        const bornes = new Map(sans.ligne.blocs.map((b) => [b.id, JSON.stringify([b.sorte, b.debut, b.fin])]));
        for (const b of avec.ligne.blocs) {
          expect(b.variete).toMatchObject({ recette, format });
          if (b.sorte !== "variete") expect(JSON.stringify([b.sorte, b.debut, b.fin]), `${nom} ${b.id}`).toBe(bornes.get(b.id));
        }
        expect(avec.ligne.variete).toMatchObject({ recette, format });
        expect(avec.ligne.hauteur).toBe(CADRES_IV[format].hauteur);
        // 29/10/2026 : le moteur calcule la toile 4:5 à 1350 px et voit le vrai défaut de la carte F (Q15, Q23 : remarques, zéro blocage).
        const connus = nom === "F" && format === "4:5" ? /^contrôle : (Caméra ou lisibilité|Défaut visible)/ : null;
        expect(invariantsVarieteIV(sans, avec).filter((x) => !connus?.test(x)), `${nom} ${format}`).toEqual([]);
      }
    }
  });

  it("parametresDuBloc : `variete` passe dans les propriétés ; un bloc `variete` vise ImageVideoVariete", () => {
    const { entree } = cas[0];
    const recette = tirerVarieteIV({ graine: "x", carte: entree.carte, format: "9:16" });
    const avec = mettreEnSceneIV({ ...entree, variete: recette }).ligne;
    for (const b of avec.blocs) expect(parametresDuBloc(b, avec).proprietes.variete).toEqual(b.variete);
    const sans = mettreEnSceneIV(entree).ligne;
    for (const b of sans.blocs) expect(parametresDuBloc(b, sans).proprietes).not.toHaveProperty("variete");
    const bloc = { id: "v1", debut: 0, fin: 2, sorte: "variete" as const, axe: "ouverture" as const, code: "OUV-A" as const, donnees: { titre: "x" }, variete: { recette, format: "9:16" as const } };
    const p = parametresDuBloc(bloc, avec);
    expect(COMPOSITIONS_RENDU_IV.variete).toBe("ImageVideoVariete");
    expect(p.composition).toBe("ImageVideoVariete");
    expect(p.proprietes).toMatchObject({ largeur: 1080, hauteur: 1920, dureeSec: 2, bloc: { axe: "ouverture", code: "OUV-A", donnees: { titre: "x" } }, variete: bloc.variete });
  });
});
