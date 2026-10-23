/** Harmonisation H3 : face caméra animée dans le gabarit (récents, action collée, éléments gardés à leur place). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { phrasePaye } from "@/components/formats/facecam-animee/cout";
import { versRecentsFacecamAnimee } from "@/components/formats/facecam-animee/vues-gabarit";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const base = { videoId: "v 1", titre: "Prise 1", statut: "en-cours", payeCentimesEur: 120 };

describe("versRecentsFacecamAnimee", () => {
  it("lien vers la vidéo, détail = phrase « Déjà payé », état lisible de l'étape", () => {
    const [r] = versRecentsFacecamAnimee([{ ...base, etape: "coupes" }]);
    expect(r).toMatchObject({ id: "v 1", href: "/videos/v%201", titre: "Prise 1", etat: "les coupes", detail: phrasePaye(120) });
  });

  it("la phrase du travail passe avant l'étape, l'étape avant le statut", () => {
    expect(versRecentsFacecamAnimee([{ ...base, etape: "coupes", phrase: "Un souci de son." }])[0].etat).toBe("Un souci de son.");
    expect(versRecentsFacecamAnimee([base])[0].etat).toBe("en-cours");
  });

  it("aucun récent : liste vide", () => {
    expect(versRecentsFacecamAnimee([])).toEqual([]);
  });
});

describe("face caméra animée · page et dépôt", () => {
  const page = lire("src/app/(studio)/face-camera-animee/page.tsx");
  const depot = lire("src/components/formats/facecam-animee/DepotPrise.tsx");

  it("la page passe par GabaritCreation et RecentsGenerateur, sans <ul> maison", () => {
    expect(page).toMatch(/<GabaritCreation/);
    expect(page).toMatch(/RecentsGenerateur/);
    expect(page).not.toMatch(/<ul\b/);
  });

  it("« Animer » est dans la BarreActionCollee, désactivé sans accord", () => {
    expect(depot).toMatch(/<BarreActionCollee/);
    expect(depot).toMatch(/disabled=\{!pret\}/);
    expect(depot).toMatch(/const pret = pretesALancer\(prises\) && accord/);
  });

  it("restent à leur place : coût, script validé, accord d'essai, déjà payé", () => {
    expect(depot).toMatch(/<EstimationCout/);
    expect(depot).toContain("Utiliser un script validé");
    expect(depot).toMatch(/<FeuilleScriptsValides/);
    expect(depot).toContain("J'accepte l'essai réel");
    expect(lire("src/components/formats/facecam-animee/vues-gabarit.ts")).toMatch(/phrasePaye/);
  });
});
