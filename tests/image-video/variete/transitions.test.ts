/**
 * Variété « Image → vidéo » · lot CAM-TRA, axe TRANSITIONS : TRA-B (raccord d'objet), TRA-C (balayage orange), TRA-D (on
 * entre dans la carte). Une seule transition principale par vidéo + coupes franches ; sortie dans les 0,4 s de fin du
 * bloc A, entrée dans les 0,4 s de début du bloc B. Rouge sans le lot : recette TRA-C → aucun bloc ne porte de transition.
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
import { AXE_TRANSITIONS, REGLES_TRANSITIONS_IV, type DonneesTransitionsIV } from "@/moteurs/montage-image-video/variete/axes/transitions";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { invariantsVarieteIV } from "./invariants";

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;
type Nom = keyof typeof IMAGES;

function entree(nom: Nom): EntreeMiseEnSceneIV {
  const carte = carteDe(nom);
  const fiche = FICHES_SIMULEES[IMAGES[nom]];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts"))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES };
}
const recette = (transitions: CodeVariante<"transitions">, camera: CodeVariante<"camera"> = "CAM-A"): RecetteVarieteIV => ({ ...RECETTE_REFERENCE_IV, transitions, camera });
const tr = (b: BlocRenduIV) => b.variete?.donnees?.transitions as DonneesTransitionsIV | undefined;

describe("CAM-TRA · transitions", () => {
  it("rouge sans le lot : avec la recette TRA-C, des blocs portent une sortie et le suivant une entrée", () => {
    const l = mettreEnSceneIV({ ...entree("C"), variete: recette("TRA-C") }).ligne;
    const sorties = l.blocs.map((b, i) => (tr(b)?.sortie ? i : -1)).filter((i) => i >= 0);
    expect(sorties.length).toBeGreaterThanOrEqual(1);
    for (const i of sorties) {
      expect(tr(l.blocs[i])).toMatchObject({ duree: REGLES_TRANSITIONS_IV.duree, sortie: { code: "TRA-C" } });
      expect(tr(l.blocs[i + 1])?.entree).toEqual({ code: "TRA-C" });
      expect(l.blocs[i + 1].debut).toBe(l.blocs[i].fin);
    }
  });

  it("TRA-E retirée n'est jamais possible ; TRA-C toujours", () => {
    for (const nom of Object.keys(IMAGES) as Nom[]) {
      const p = AXE_TRANSITIONS.possibles(carteDe(nom), "9:16");
      expect(p).not.toContain("TRA-E");
      expect(p).toContain("TRA-C");
    }
    expect(AXE_TRANSITIONS.possibles(carteDe("C"), "9:16")).toEqual(["TRA-B", "TRA-C", "TRA-D"]);
  });

  it.each(["TRA-B", "TRA-C", "TRA-D"] as const)("%s : une seule transition principale par ligne de temps, au plus une jointure sur deux, jamais contre une phrase-choc ni sur un écran emprunté", (code) => {
    for (const nom of Object.keys(IMAGES) as Nom[]) {
      for (const camera of ["CAM-A", "CAM-B", "CAM-C", "CAM-E"] as const) {
        const l = mettreEnSceneIV({ ...entree(nom), variete: recette(code, camera) }).ligne;
        const codes = new Set(l.blocs.flatMap((b) => [tr(b)?.sortie?.code, tr(b)?.entree?.code]).filter(Boolean));
        expect(codes.size).toBeLessThanOrEqual(1);
        if (codes.size) expect([...codes]).toEqual([code]);
        const jointures = l.blocs.map((b, i) => (tr(b)?.sortie ? i : -1)).filter((i) => i >= 0);
        expect(jointures.length).toBeLessThanOrEqual(REGLES_TRANSITIONS_IV.max);
        for (let k = 1; k < jointures.length; k++) expect(jointures[k] - jointures[k - 1]).toBeGreaterThanOrEqual(2);
        for (const i of jointures) {
          for (const b of [l.blocs[i], l.blocs[i + 1]]) {
            expect(b.sorte).not.toBe("ecran");
            expect(b.sorte === "moments" && b.moments.some((m) => m.sorte === "phrase-choc")).toBe(false);
            expect(b.fin - b.debut).toBeGreaterThanOrEqual(REGLES_TRANSITIONS_IV.blocMin);
          }
        }
        if (!jointures.length) expect(l.variete?.replis.some((r) => r.axe === "transitions")).toBe(true);
      }
    }
  });

  it("TRA-B part de la coche d'un nœud coché, entière à l'écran ; TRA-D de la carte dont on parle (carte C)", () => {
    const b = mettreEnSceneIV({ ...entree("C"), variete: recette("TRA-B") }).ligne.blocs.find((x) => tr(x)?.sortie);
    expect(b?.sorte).toBe("toile");
    const s = tr(b!)!.sortie as Extract<DonneesTransitionsIV["sortie"], { code: "TRA-B" }>;
    expect(s.code).toBe("TRA-B");
    expect(s.r).toBeGreaterThan(30);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(1080);
    expect(s.y).toBeGreaterThanOrEqual(REGLES_TRANSITIONS_IV.haut);
    const d = mettreEnSceneIV({ ...entree("C"), variete: recette("TRA-D") }).ligne.blocs.find((x) => tr(x)?.sortie);
    const c = (tr(d!)!.sortie as Extract<DonneesTransitionsIV["sortie"], { code: "TRA-D" }>).carte;
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.l).toBeLessThanOrEqual(1080);
    expect(c.y + c.h).toBeLessThanOrEqual(REGLES_TRANSITIONS_IV.bas);
  });

  const cas: [Nom, CodeVariante<"transitions">][] = (Object.keys(IMAGES) as Nom[]).flatMap((nom) => AXE_TRANSITIONS.possibles(carteDe(nom), "9:16").map((c) => [nom, c as CodeVariante<"transitions">] as [Nom, CodeVariante<"transitions">]));
  it.each(cas)("invariants · carte %s · %s", (nom, code) => {
    // Comparée à la recette de référence (son ouverture OUV-D remplace déjà la première phrase, lot OUV-FIN).
    const sans = mettreEnSceneIV({ ...entree(nom), variete: RECETTE_REFERENCE_IV });
    const avec = mettreEnSceneIV({ ...entree(nom), variete: recette(code) });
    expect(invariantsVarieteIV(sans, avec)).toEqual([]);
    // Les transitions n'ajoutent que des propriétés : mêmes blocs, mêmes heures.
    expect(avec.ligne.blocs.map((b) => [b.id, b.sorte, b.debut, b.fin])).toEqual(sans.ligne.blocs.map((b) => [b.id, b.sorte, b.debut, b.fin]));
  });
});
