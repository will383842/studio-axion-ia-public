/**
 * FIX-TABLEAU-ETIQUETTES-FORME (D1 Williams, 18/11) : le Studio n'écrit plus d'office « Idée reçue » ni « À retenir ».
 * Reste : la phrase de l'idée reçue (barrée), la mention « Exemple illustratif » de la page d'exemple.
 * Aucune composition importée (PIEGE-REMOTION-TSC) : seules la mise en page et l'aperçu sont appelés.
 */
import { describe, expect, it } from "vitest";
import { STYLES_TABLEAU } from "../../../src/briques/tableau-scene/trois-styles/styles";
import { apercuDesSorties } from "../../../src/moteurs/montage-tableau/apercu-sorties";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { mettreEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { finDeLaSortie, sortiesRelues } from "../../../src/moteurs/montage-tableau/relecture";
import { sortiesDesReseaux } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { choisirFinTableau } from "../../../src/services/tableau-fin";
import { ficheTemoin3 } from "../reference-3/fiches";
import { ficheTemoinV667 } from "./fiches";

const MOTS = /^(✕\s*)?(Idée reçue|À retenir)$/i;
const FORMATS = ["vertical", "portrait", "carre", "horizontal"] as const;

type Mise = ReturnType<typeof mettreEnPage>;
const elements = (m: Mise) => m.pages.flatMap((p) => p.elements);
/** Tous les textes posés : lignes écrites + texte du gabarit. */
const textes = (m: Mise) =>
  elements(m).flatMap((e) => {
    const g = e.gabarit as { texte?: { texte?: string } } | undefined;
    return [...e.lignes.map((l) => l.texte.trim()), ...(g?.texte?.texte ? [g.texte.texte.trim()] : [])];
  });

const cas: [string, FicheTableau][] = [
  ...STYLES_TABLEAU.map((s) => [s, { ...ficheTemoinV667(s), structure: "erreur-corrigee" } as FicheTableau] as [string, FicheTableau]),
  ["reference/3", { ...ficheTemoin3(), structure: "erreur-corrigee" } as FicheTableau],
];

describe("FIX-TABLEAU-ETIQUETTES-FORME", () => {
  for (const [nom, fiche] of cas) {
    for (const format of FORMATS) {
      const m = mettreEnPage(fiche, format === "vertical" ? {} : { format });
      it(`a) ${nom}/${format} : aucun texte « Idée reçue », « ✕ Idée reçue » ou « À retenir » posé par la mise en page`, () => {
        expect(m.pages.length).toBeGreaterThan(0);
        expect(textes(m).filter((t) => MOTS.test(t))).toEqual([]);
      });
      it(`b) ${nom}/${format} : la phrase de l'idée reçue reste posée et barrée`, () => {
        const barres = elements(m).filter((e) => e.marque === "barre" && e.lignes.length);
        const dites = fiche.scenes.flatMap((s) => s.elements).filter((e) => e.marque === "barre").length;
        if (dites) expect(barres.length).toBeGreaterThan(0);
      });
      it(`c) ${nom}/${format} : la page d'exemple garde sa mention`, () => {
        const mentions = elements(m).filter((e) => e.type === "mention").flatMap((e) => e.lignes.map((l) => l.texte));
        for (const t of mentions) expect(t).not.toMatch(MOTS);
      });
    }
  }
  it("c bis) « Exemple illustratif » est toujours écrit quelque part (trois styles, vertical)", () => {
    let vu = 0;
    for (const s of STYLES_TABLEAU) if (textes(mettreEnPage({ ...ficheTemoinV667(s) } as FicheTableau, {})).some((t) => /Exemple illustratif/i.test(t))) vu++;
    expect(vu).toBeGreaterThan(0);
  });
  it("d) l'aperçu : plus aucune ligne « ajoutée par le Studio » égale à ces mots", () => {
    for (const [nom, fiche] of cas) {
      const sorties = sortiesDesReseaux(["instagram", "tiktok", "youtube-shorts"]);
      const choisir = choisirFinTableau({}, { sorties });
      const rel = sortiesRelues(fiche, sorties, (id) => finDeLaSortie(id, choisir(fiche.appelId ?? null, id), fiche));
      for (const a of apercuDesSorties(fiche, rel))
        for (const p of a.pages) expect(p.lignes.filter((l) => l.ajout && MOTS.test(l.texte.trim())), `${nom}/${a.sortie}`).toEqual([]);
    }
  });
});
