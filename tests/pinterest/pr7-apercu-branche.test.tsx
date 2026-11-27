/** PR 7 · l'aperçu d'épingle est branché : écran « Valider ce lot » (image, texte alternatif, tableau) et fiche du calendrier. */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(studio)/calendrier/importer-epingles/actions", () => ({
  analyserLotAction: async () => ({}),
  importerLotAction: async () => ({}),
  validerLotAction: async () => ({}),
}));

describe("PR 7 · branchement de ApercuEpingle", () => {
  it("la feuille d'import monte ApercuEpingle avant « Valider ce lot »", () => {
    const src = readFileSync("src/components/calendrier/FeuilleImportEpingles.tsx", "utf8");
    expect(src).toContain('from "@/components/visuels/ApercuEpingle"');
    expect(src.indexOf("<ApercuEpingle")).toBeGreaterThan(0);
    expect(src.indexOf("<ApercuEpingle")).toBeLessThan(src.indexOf("Valider ce lot</Bouton>"));
    expect(src).toContain("cree.apercus");
  });
  it("la confirmation « Valider ce lot » affiche le nombre et les dates venant de resumeLot", () => {
    const f = readFileSync("src/components/calendrier/FeuilleImportEpingles.tsx", "utf8");
    const a = readFileSync("src/app/(studio)/calendrier/importer-epingles/actions.ts", "utf8");
    expect(a).toContain("resume: await resumeLot(d, resultat.creneauIds)");
    for (const m of ["cree.resume?.nombre", "cree.resume.premier", "cree.resume.dernier"]) expect(f).toContain(m);
  });
  it("la fiche du calendrier monte ApercuEpingle pour une entrée Pinterest qui porte une épingle", () => {
    const src = readFileSync("src/components/calendrier/ApercuPublication.tsx", "utf8");
    expect(src).toContain('from "@/components/visuels/ApercuEpingle"');
    expect(src).toContain('entree.reseau === "pinterest" ? entree.epingle');
    expect(src).toContain("domaine={ep.domaine}");
  });
  it("l'action d'import calcule l'aperçu de chaque épingle créée (image, texte alternatif, tableau, domaine)", () => {
    const src = readFileSync("src/app/(studio)/calendrier/importer-epingles/actions.ts", "utf8");
    expect(src).toContain("apercus: await apercusDuLot");
    for (const champ of ["imageUrl", "texteAlternatif", "tableau", "domaine"]) expect(src).toContain(champ);
  });
  it("l'écran de validation rend l'aperçu complet d'une épingle créée", async () => {
    const { ApercuEpingle } = await import("@/components/visuels/ApercuEpingle");
    const h = renderToStaticMarkup(
      <ApercuEpingle imageUrl="https://exemple.fr/i.png" titre="Titre" description="Texte" texteAlternatif="Un carnet ouvert sur un bureau" lien="https://exemple.fr/p" tableau="L'IA en PME" contenuIA={false} domaine="exemple.fr" />,
    );
    expect(h).toContain("Un carnet ouvert sur un bureau");
    expect(h).toContain("L&#x27;IA en PME");
    expect(h).not.toContain('role="alert"');
  });
});
