import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listerFormats } from "@/formats";
import { CATALOGUE_CAPACITES } from "@/briques/bibliotheque-video/catalogue";
import { PROFONDEUR_MEMOIRE } from "@/briques/bibliotheque-video/profondeurs";
import type { SourceMemoire } from "@/briques/bibliotheque-video/types";
import { ficheBibliotheque } from "../../scripts/bibliotheque-video/fiche";

const RACINE = process.cwd();
const SCRIPT = join(RACINE, "scripts/bibliotheque-video/fiche.ts");
const DOC = join(RACINE, "docs/bibliotheque-video.md");
const SOURCES: SourceMemoire[] = [
  "bibliotheque-video", "avocat-cartes", "v4-familles", "v4-extraits",
  "cas-concret-tirages", "tableau-styles", "image-video-variete", "illustrations",
];
const compter = (texte: string, motif: RegExp) => (texte.match(motif) ?? []).length;

describe("fiche lisible de la bibliothèque vidéo (C1-U12)", () => {
  const fiche = ficheBibliotheque();

  it("à jour : le document commité est identique à la sortie du script", () => {
    expect(existsSync(DOC), "docs/bibliotheque-video.md manque : lancer `npx tsx scripts/bibliotheque-video/fiche.ts`").toBe(true);
    const commite = readFileSync(DOC, "utf8");
    expect(
      fiche === commite,
      "Le catalogue, un profil ou une profondeur a changé : régénérer avec `npx tsx scripts/bibliotheque-video/fiche.ts` puis commiter docs/bibliotheque-video.md",
    ).toBe(true);
  });

  it("chaque capacité du catalogue apparaît", () => {
    for (const l of CATALOGUE_CAPACITES) expect(fiche, l.id).toContain(`\`${l.id}\``);
  });

  it("chaque format apparaît une fois (profilé ou neutre) et a son réglage", () => {
    const formats = listerFormats({ inclureMasques: true, inclureReservesAWill: true }).map((f) => f.id);
    for (const id of formats) {
      expect(compter(fiche, new RegExp(`^(### |- )\`${id}\`( |$)`, "gm")), `format ${id}`).toBe(1);
      expect(fiche, id).toContain(`\`bibliothequeVideo.${id}\``);
    }
  });

  it("chaque source de mémoire a sa profondeur", () => {
    expect(Object.keys(PROFONDEUR_MEMOIRE).sort()).toEqual([...SOURCES].sort());
    for (const s of SOURCES) {
      const ligne = fiche.split("\n").find((x) => x.startsWith(`| \`${s}\` |`));
      expect(ligne, s).toBeDefined();
      expect(ligne).toContain(String(PROFONDEUR_MEMOIRE[s]?.videos));
    }
  });

  it("les interrupteurs du § 7 sont recopiés, tous éteints", () => {
    expect(fiche).toContain("tous éteints dans le code");
    for (const nom of ["STYLES_TEXTE_ECRAN_INSTALLES", "facecamAnimee.extraitsMaison", "habillage.sonsTransitions", "bibliothequeVideo.archive.inscription"]) {
      expect(fiche, nom).toContain(nom);
    }
  });

  it("pureté : deux appels égaux ; aucune date, aucun hasard, aucun service", () => {
    expect(ficheBibliotheque()).toBe(fiche);
    const source = readFileSync(SCRIPT, "utf8");
    expect(source).not.toMatch(/\bDate\b/);
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("@/services/");
    expect(source).not.toMatch(/server-only/);
    expect(source).not.toMatch(/from "(\.\.\/)+src\/services/);
  });
});
