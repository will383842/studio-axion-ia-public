/**
 * AXION-IA À L'ÉCRAN (accord de Will du 18/10, plan « scripts et voix du tableau » § 3 point 4) : la page d'appel
 * validée (la phrase en grand, le bouton, le site) ne change pas ; le nom de l'entreprise n'est JAMAIS écrit ailleurs.
 * Garde-fou de la règle 13 du découpage. Les fiches des vidéos validées (v-874530b87628 et v-fc3ac0c1d171, même texte
 * que le témoin v-6616b3800357) et les autres témoins « reference-3 » passent sans changement.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { regleControlesScript, regleNomEcritHorsAppel } from "@/moteurs/montage-tableau/regles";

const DOSSIER = join(__dirname, "..", "temoins");
const lire = (fichier: string) => JSON.parse(readFileSync(join(DOSSIER, fichier), "utf8")) as FicheTableau;
const TEMOINS = readdirSync(DOSSIER).filter((f) => /^fiche-.*reference-3\.json$/.test(f));
const VALIDEE = "fiche-temoin-v-fc3ac0c1d171-reference-3.json";
const contexte = (f: FicheTableau) => ({ aujourdhui: "2026-10-18", sourcesChiffres: [], preuves: [], matieres: [], texteScript: f.scenes.map((s) => s.texteDit).join(" ") });
const sur = (m: { detail: string }[]) => m.filter((x) => /Axion-IA/.test(x.detail) && /page d'appel/.test(x.detail));

describe("le nom n'est écrit que sur la page d'appel", () => {
  it("les fiches validées et les témoins reference-3 passent sans changement (le nom n'y est écrit que sur la page d'appel)", () => {
    expect(TEMOINS).toContain(VALIDEE);
    for (const t of TEMOINS) {
      const f = lire(t);
      expect(regleNomEcritHorsAppel(f), t).toEqual([]);
      expect(sur(regleControlesScript(f, contexte(f))), t).toEqual([]);
    }
  });

  it("un titre « Axion-IA vous aide » en s03 : refusé, par la règle 13", () => {
    const f = lire(VALIDEE);
    const s03 = f.scenes.find((s) => s.id === "s03")!;
    s03.elements.unshift({ id: "ex", type: "ligne", texte: "Axion-IA vous aide", niveau: "titre", role: "regle", ancre: 0 } as (typeof s03.elements)[number]);
    expect(regleNomEcritHorsAppel(f)).toEqual([{ sceneId: "s03", detail: expect.stringContaining("« Axion-IA vous aide »") }]);
    expect(sur(regleControlesScript(f, contexte(f)))).toHaveLength(1);
  });

  it("le site ou une autre graphie (« axion-ia.com », « Axion IA », « AxionIA ») hors de la page d'appel : refusé", () => {
    for (const texte of ["axion-ia.com", "Avec Axion IA", "AxionIA forme", "AXION-IA"]) {
      const f = lire(VALIDEE);
      f.scenes[1].elements.push({ id: "ex", type: "ligne", texte, niveau: "texte", role: "regle", ancre: 0 } as (typeof f.scenes)[number]["elements"][number]);
      expect(regleNomEcritHorsAppel(f), texte).toHaveLength(1);
    }
  });

  it("sur la page d'appel (la dernière page) : permis, comme la page validée", () => {
    const f = lire(VALIDEE);
    const derniere = f.scenes.at(-1)!;
    derniere.elements.push({ id: "ex", type: "ligne", texte: "axion-ia.com", niveau: "texte", role: "regle", ancre: 0 } as (typeof derniere.elements)[number]);
    expect(regleNomEcritHorsAppel(f)).toEqual([]);
  });

  it("dit seulement (jamais écrit) hors de la page d'appel : ce n'est pas l'affaire de ce garde-fou", () => {
    const f = lire(VALIDEE);
    f.scenes[2].texteDit = `${f.scenes[2].texteDit} Axion-IA le fait.`;
    expect(regleNomEcritHorsAppel(f)).toEqual([]);
  });
});

describe("le nom cité dans une preuve, la page d'appel repérée par son gabarit", () => {
  it("un nom cité dans une ligne de preuve hors de la page d'appel : pas de refus (citation mot pour mot)", () => {
    const f = lire(VALIDEE);
    f.scenes[2].elements.push({ id: "ex", type: "preuve", preuveId: "p1", lignes: ["Axion-IA a répondu en 2 minutes"], ancre: 0 } as unknown as (typeof f.scenes)[number]["elements"][number]);
    expect(regleNomEcritHorsAppel(f)).toEqual([]);
  });

  it("la page d'appel est celle au gabarit « appel » : le nom y est permis (même sur l'avant-dernière scène), refusé sur la dernière hors de cette page", () => {
    const f = lire(VALIDEE);
    const derniere = f.scenes.at(-1)!;
    const avant = f.scenes.at(-2)!;
    derniere.gabarit = { ...(derniere.gabarit ?? {}), role: "retenir" } as typeof derniere.gabarit;
    avant.gabarit = { ...(avant.gabarit ?? {}), role: "appel" } as typeof avant.gabarit;
    avant.elements.push({ id: "ey", type: "ligne", texte: "Axion-IA", niveau: "texte", role: "regle", ancre: 0 } as (typeof avant.elements)[number]);
    // La dernière scène (devenue « retenir », page suivante) écrit déjà « Axion-IA » : refusée ; l'avant-dernière (page d'appel) non.
    expect(regleNomEcritHorsAppel(f).map((m) => m.sceneId)).toEqual([derniere.id]);
  });

  it("deux scènes sur la même page d'appel, la première écrit « Axion-IA » : acceptée", () => {
    const f = lire(VALIDEE);
    const derniere = f.scenes.at(-1)!;
    const avant = f.scenes.at(-2)!;
    avant.page = derniere.page;
    avant.elements.push({ id: "ey", type: "ligne", texte: "Axion-IA", niveau: "texte", role: "regle", ancre: 0 } as (typeof avant.elements)[number]);
    expect(regleNomEcritHorsAppel(f)).toEqual([]);
  });
});

describe("la consigne du découpage", () => {
  it("dit que le nom Axion-IA n'est écrit que sur la page d'appel", async () => {
    const { CONSIGNE_DECOUPAGE } = await import("@/moteurs/montage-tableau/decoupage").catch(() => ({ CONSIGNE_DECOUPAGE: undefined as unknown as string }));
    expect(CONSIGNE_DECOUPAGE).toContain("n'est écrit que sur la page d'appel");
  });
});
