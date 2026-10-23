/**
 * ESSAI RÉEL DU 12/10 PAR L'ÉCRAN (fiche « relances de devis », `temoins/fiche-relances-prod.json`) : la fabrication
 * s'était arrêtée à la relecture (case « déjà vu » qu'aucun écran ne proposait ; 3e ligne du récapitulatif hors zone
 * sûre). Ici, de bout en bout et sans aucun appel : LA relecture (la même pour l'écran et la fabrication) sur les deux
 * verticaux des réseaux cochés, le récapitulatif qui tient, l'arrêt « script » de la chaîne quand la case manque.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controlerImageSortie } from "../../../src/moteurs/montage-tableau/controles";
import { ErreurFabrication, fabriquerTableau } from "../../../src/moteurs/montage-tableau/fabriquer";
import { validerFicheTableau, type FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { relireFicheTableau, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { doubles } from "../fabriquer/doubles";

const brute = JSON.parse(readFileSync(new URL("../temoins/fiche-relances-prod.json", import.meta.url), "utf8")) as FicheTableau;
const texte = brute.scenes.map((s) => s.texteDit).join(" ");
/** Contexte des règles de la production (la démonstration de la scène 6 est une matière validée). */
const contexte: ContexteTableau = { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: [{ id: "mat-import-demo-02", type: "demonstration", statut: "validee", perimeLe: "2027-01-09" }], texteScript: texte };
/** Réseaux cochés à l'écran : TikTok / Reels / Shorts / Stories ; fin au mot RELANCE. */
const sorties = sortiesDesReseaux(["verticaux"]);
const choisirFin = choisirFinTableau({}, { sorties, mot: "RELANCE" });
const coche = { coche: true, le: "2026-10-12" };

describe("la fiche témoin passe la relecture complète, pour ses deux verticaux", () => {
  it("les réseaux cochés donnent les deux verticaux ; les règles passent", () => {
    expect(sorties).toEqual(["vertical", "vertical-liens"]);
    expect(validerFicheTableau(brute, contexte).ok).toBe(true);
  });

  it("case cochée : la relecture est livrable, sans aucun point bloquant", async () => {
    const r = await relireFicheTableau({ fiche: brute, contexte, sorties, choisirFin, dejaVu: coche });
    expect(r.points).toEqual([]);
    expect(r.ok).toBe(true);
    const zone = r.rapport.lignes.filter((l) => l.libelle === "Zone sûre");
    expect(zone.length).toBeGreaterThan(0);
    expect(zone.every((l) => l.etat === "reussi")).toBe(true);
  });

  it("case absente : un seul point, la case, en français simple, sans scène", async () => {
    const r = await relireFicheTableau({ fiche: brute, contexte, sorties, choisirFin });
    expect(r.ok).toBe(false);
    expect(r.points).toEqual([{ famille: "deja-vu", libelle: "Conseil absent de la première page d'une recherche", message: expect.stringMatching(/n'est pas cochée/) }]);
  });

  it("un défaut est rattaché à sa scène, en français simple (ici : la démonstration de la scène 6 inconnue)", async () => {
    const r = await relireFicheTableau({ fiche: brute, contexte: { ...contexte, matieres: [] }, sorties, choisirFin, dejaVu: coche });
    expect(r.ok).toBe(false);
    expect(r.points).toEqual([expect.objectContaining({ famille: "fiche", sceneId: "s06", message: expect.stringMatching(/preuve « mat-import-demo-02 » est inconnue/) })]);
  });

  it("la fin propre à TikTok et Shorts garde un élément dans la dernière scène (sinon refusée au calage)", () => {
    const [, liens] = sortiesRelues(brute, sorties, (id) => choisirFin(brute.appelId ?? null, id));
    const derniere = liens.fiche.scenes.at(-1)!;
    expect(derniere.elements.map((e) => e.id)).toEqual(["e36"]);
    expect(derniere.texteDit).not.toMatch(/RELANCE|envoie/);
  });

  it("chaque sortie relue a sa fin : le mot RELANCE sur le vertical des Reels, le site sur celui de TikTok et Shorts", () => {
    const [reels, liens] = sortiesRelues(brute, sorties, (id) => choisirFin(brute.appelId ?? null, id));
    expect(reels.appel).toEqual({ mot: "RELANCE" });
    expect(liens.appel).toMatchObject({ site: true });
  });
});

describe("le récapitulatif (3 lignes) tient dans la zone sûre", () => {
  for (const s of sortiesRelues(brute, ["vertical", "vertical-liens", "portrait", "carre", "horizontal"], (id) => choisirFin(brute.appelId ?? null, id))) {
    it(`${s.id} : gabarit « récapitulatif » gardé, ses trois lignes posées, image conforme`, () => {
      const mise = mettreEnPage(s.fiche, s.options);
      const recap = mise.styleV2!.ecrans.find((e) => e.sceneId === "s07")!;
      expect(recap.gabarit).toBe("recapitulatif");
      const lignes = recap.textes.filter((t) => t.source.startsWith("s07~e0~")).map((t) => t.texte).join(" ");
      for (const mot of ["ÉCRITES", "PROGRAMMÉES", "SUPPRIMÉES", "RÉPONSE"]) expect(lignes).toContain(mot);
      const echecs = controlerImageSortie(s.fiche, { id: s.id, libelle: s.libelle, fiche: s.fiche, options: s.options }).filter((l) => l.etat === "echoue");
      expect(echecs).toEqual([]);
    });
  }
});

describe("la fabrication fait LA MÊME relecture, avant tout appel payant", () => {
  it("sans la case : arrêt à l'étape « script », avec la phrase de la case ; aucune voix lue", async () => {
    const d = doubles(brute);
    const { dejaVu: _d, ...outils } = d.outils;
    void _d;
    const err = await fabriquerTableau({ ...outils, contexte, sorties, choisirFin }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErreurFabrication);
    expect((err as ErreurFabrication).etape).toBe("script");
    expect((err as ErreurFabrication).raisons.join(" ")).toMatch(/Conseil absent de la première page d'une recherche : La case « Ce conseil n'est pas en première page d'une recherche » n'est pas cochée/);
    expect(d.lectures()).toBe(0);
  });

  it("avec la case : la relecture passe, les deux verticaux sont fabriqués", async () => {
    const d = doubles(brute);
    const r = await fabriquerTableau({ ...d.outils, contexte, sorties, choisirFin, dejaVu: coche });
    expect(r.sorties.map((s) => s.format)).toEqual(["vertical", "vertical-liens"]);
    expect(r.etapes.find((e) => e.etape === "script")?.statut).toBe("faite");
  });
});
