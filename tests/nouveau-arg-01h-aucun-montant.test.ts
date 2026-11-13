/** NEW-ARG-01h : aucun montant ni symbole monétaire dans le rendu de ces six fichiers (les coûts restent enregistrés). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/" }));
vi.mock("@/app/(studio)/videos/actions", () => ({
  arreterFabricationAction: async () => ({ ok: true, donnees: { centimes: 0 } }),
  annulerVideoAction: async () => ({ ok: true, donnees: {} }),
}));

const { ProgressionEtapes, texteTemps } = await import("@/components/ui/ProgressionEtapes");
const { BoutonArreter, phraseArret } = await import("@/components/videos/BoutonArreter");
const { BoutonAnnuler } = await import("@/components/videos/BoutonAnnuler");
const { libelleReecrire } = await import("@/components/publication/KitPublication");

const FICHIERS = [
  "src/components/publication/KitPublication.tsx",
  "src/components/script/RelireScript.tsx",
  "src/components/ui/ProgressionEtapes.tsx",
  "src/components/videos/BoutonAnnuler.tsx",
  "src/components/videos/BoutonArreter.tsx",
];
const MONNAIE = /€|\$|euros?|lucide-euro|dollar/i;
const etapes = [{ cle: "voix", nom: "Voix", icone: "film", dependDe: [], statut: "en_cours", progression: 10, sortieFichierIds: [] }] as never;
const depense = { centimes: 1234, devise: "EUR" } as never;

describe("NEW-ARG-01h · aucun montant à l'écran", () => {
  it("ProgressionEtapes : attente de crédit et dépense ne rendent ni montant ni symbole monétaire", () => {
    for (const attenteCredit of ["Claude", "ElevenLabs"]) {
      const html = renderToStaticMarkup(createElement(ProgressionEtapes, { etapes, progression: 10, suivi: { depense, attenteCredit, resteMin: 3 } }));
      expect(html).not.toMatch(MONNAIE);
      expect(html).not.toMatch(/\d+[.,]\d{2}/);
    }
    expect(texteTemps({ depense, resteMin: 3, heureFin: "15 h 40" } as never)).not.toMatch(MONNAIE);
  });
  it("Boutons Arrêter / Annuler : aucun montant rendu, phrase d'arrêt sans chiffre", () => {
    for (const el of [createElement(BoutonArreter, { travailId: "t", videoId: "v", depense }), createElement(BoutonAnnuler, { videoId: "v", travailId: "t", depense })]) {
      expect(renderToStaticMarkup(el)).not.toMatch(MONNAIE);
    }
    expect(phraseArret(depense, 1234)).not.toMatch(/\d|€|euro/i);
  });
  it("Kit de publication : le libellé « Réécrire » n'affiche aucun montant", () => {
    expect(libelleReecrire({ prixReecriture: 12 } as never)).not.toMatch(/\d|€|euro/i);
  });
  it("le texte affiché des fichiers listés ne contient ni « € » ni « euros » (hors identifiants)", () => {
    for (const f of FICHIERS) {
      const source = readFileSync(join(process.cwd(), f), "utf8");
      expect(source, f).not.toMatch(/nom="euro"|€/);
      expect(source, f).not.toMatch(/formaterMontant|<EncartCout|<EstimationCout|<CoutVoix/);
    }
  });
});
