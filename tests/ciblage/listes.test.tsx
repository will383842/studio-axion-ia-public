/** Lot H : listes — anciens masqués par défaut, filtre par type d'automatisation, badge « Doublon possible ». */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import type { Script } from "@/domaine/types";
import { filtrerParCiblage, lireFiltreCiblage, lienCiblage, compterAnciens, estDoublonPossible, filtrerSujetsParType } from "@/domaine/ciblage/listes";
import { FiltresCiblage } from "@/components/ciblage/FiltresCiblage";
import { BadgeDoublon } from "@/components/ciblage/BadgeDoublon";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { listerScripts } = await import("@/services/scripts");

const MARQUE = { depuis: "2026-11-09T08:00:00.000Z", raison: "avant-ciblage" as const };

function script(id: string, extra: Partial<Script> = {}): Script {
  return {
    id, formatId: "avocat", versionFormat: 1, sujet: `Sujet ${id}`, version: 1,
    blocs: [{ id: `${id}-b`, blocRecette: "corps", segments: [{ id: `${id}-s`, texte: "Texte." }] }],
    favori: false, reference: false, statutEditorial: "brouillon", marqueId: "marque-axion", creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z",
    ...extra,
  } as Script;
}

describe("lireFiltreCiblage", () => {
  it("par défaut : anciens masqués, aucun type", () => {
    expect(lireFiltreCiblage({})).toEqual({ anciens: false });
  });
  it("lit anciens=1 et un type connu ; ignore un type inconnu", () => {
    expect(lireFiltreCiblage({ anciens: "1", typeAuto: "devis-factures" })).toEqual({ anciens: true, type: "devis-factures" });
    expect(lireFiltreCiblage({ typeAuto: "a-classer" })).toEqual({ anciens: false, type: "a-classer" });
    expect(lireFiltreCiblage({ typeAuto: "n-importe-quoi" })).toEqual({ anciens: false });
  });
});

describe("filtrerParCiblage", () => {
  const liste = [
    { id: "a", ancien: MARQUE, typeAutomatisation: "devis-factures" as const },
    { id: "b", typeAutomatisation: "devis-factures" as const },
    { id: "c" },
  ];
  it("masque les anciens par défaut, les montre à la demande, sans rien perdre", () => {
    expect(filtrerParCiblage(liste, { anciens: false }).map((x) => x.id)).toEqual(["b", "c"]);
    expect(filtrerParCiblage(liste, { anciens: true }).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(compterAnciens(liste)).toBe(1);
  });
  it("filtre par type, et « à classer » = sans type", () => {
    expect(filtrerParCiblage(liste, { anciens: true, type: "devis-factures" }).map((x) => x.id)).toEqual(["a", "b"]);
    expect(filtrerParCiblage(liste, { anciens: true, type: "a-classer" }).map((x) => x.id)).toEqual(["c"]);
  });
  it("le paramètre « type » (matières de /ecrire) n'est pas lu comme filtre de ciblage", () => {
    expect(lireFiltreCiblage({ type: "devis-factures" })).toEqual({ anciens: false });
  });
  it("lienCiblage garde les autres paramètres et retire un filtre vide", () => {
    expect(lienCiblage("/videos", { vue: "brouillons", typeAuto: "recrutement" }, { anciens: "1" })).toBe("/videos?vue=brouillons&typeAuto=recrutement&anciens=1");
    expect(lienCiblage("/videos", { vue: "brouillons", typeAuto: "recrutement" }, { typeAuto: undefined })).toBe("/videos?vue=brouillons");
  });
});

describe("estDoublonPossible", () => {
  it("vrai si un jumeau existe encore", () => {
    expect(estDoublonPossible({ doublonsPossibles: ["j"] }, new Set(["j", "x"]))).toBe(true);
  });
  it("faux si le script jumeau a été supprimé", () => {
    expect(estDoublonPossible({ doublonsPossibles: ["j"] }, new Set(["x"]))).toBe(false);
  });
  it("faux sans jumeau déclaré", () => {
    expect(estDoublonPossible({}, new Set(["j"]))).toBe(false);
  });
});

describe("filtrerSujetsParType (liste principale de /ecrire)", () => {
  const sujets = [
    { id: "a", maitre: { brief: { typeAutomatisation: "devis-factures" as const } } },
    { id: "b", maitre: { brief: { typeAutomatisation: "recrutement" as const } } },
    { id: "c", maitre: { brief: {} } },
  ];
  it("sans filtre, tout reste", () => expect(filtrerSujetsParType(sujets, { anciens: false }).map((x) => x.id)).toEqual(["a", "b", "c"]));
  it("filtre par type", () => expect(filtrerSujetsParType(sujets, { anciens: false, type: "devis-factures" }).map((x) => x.id)).toEqual(["a"]));
  it("« à classer » = sans type", () => expect(filtrerSujetsParType(sujets, { anciens: false, type: "a-classer" }).map((x) => x.id)).toEqual(["c"]));
});

describe("service listerScripts", () => {
  beforeEach(() => reinitialiserDepots());
  const miens = async (f: Parameters<typeof listerScripts>[0]) => (await listerScripts(f)).map((s) => s.id).filter((id) => id.startsWith("s-")).sort();
  async function semer() {
    const d = depots();
    await d.scripts.enregistrer(script("s-ancien", { ancien: MARQUE, typeAutomatisation: "recrutement" }));
    await d.scripts.enregistrer(script("s-recent", { typeAutomatisation: "recrutement" }));
    await d.scripts.enregistrer(script("s-libre"));
  }
  it("sans option, rien ne change pour les autres écrans (tout est listé)", async () => {
    await semer();
    expect(await miens({ reference: false })).toEqual(["s-ancien", "s-libre", "s-recent"]);
  });
  it("inclureAnciens=false masque les anciens ; le type filtre", async () => {
    await semer();
    expect(await miens({ inclureAnciens: false })).toEqual(["s-libre", "s-recent"]);
    expect(await miens({ typeAutomatisation: "recrutement" })).toEqual(["s-ancien", "s-recent"]);
    expect(await miens({ typeAutomatisation: "a-classer" })).toEqual(["s-libre"]);
  });
});

describe("rendu serveur", () => {
  it("badge « Doublon possible » en français", () => {
    expect(renderToStaticMarkup(<BadgeDoublon />)).toContain("Doublon possible");
  });
  it("filtres : bascule « Afficher les anciens » (avec le nombre masqué) et types en français, sans anglais ni couleur en dur", () => {
    const html = renderToStaticMarkup(<FiltresCiblage base="/videos" params={{ vue: "brouillons" }} filtre={{ anciens: false }} nbAnciens={3} />);
    expect(html).toContain("Afficher les anciens");
    expect(html).toContain("3");
    expect(html).toContain("Devis et factures");
    expect(html).toContain("À classer");
    expect(html).toContain("vue=brouillons");
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
  it("quand les anciens sont affichés, la bascule propose de les masquer", () => {
    const html = renderToStaticMarkup(<FiltresCiblage base="/ecrire" params={{}} filtre={{ anciens: true }} nbAnciens={3} />);
    expect(html).toContain("Masquer les anciens");
  });
  it("sans ancien, pas de bascule inutile", () => {
    const html = renderToStaticMarkup(<FiltresCiblage base="/ecrire" params={{}} filtre={{ anciens: false }} nbAnciens={0} />);
    expect(html).not.toContain("Afficher les anciens");
  });
});
