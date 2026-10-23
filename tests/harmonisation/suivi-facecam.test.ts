/** Lot F3 : l'attente du montage face caméra passe par EnTeteSuivi + ActionsSuivi + BoutonArreter ; AUCUN montant, jamais. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(studio)/actions", () => ({ reessayerTravailAction: async () => ({ ok: true }) }));
vi.mock("@/app/(studio)/videos/actions", () => ({ arreterFabricationAction: async () => ({ ok: true, donnees: { centimes: 0 } }) }));
vi.mock("@/hooks/useTravaux", () => ({ useTravaux: () => ({ travail: undefined, actualiser: async () => undefined }) }));
vi.mock("@/components/coquille/EnregistrementPwa", () => ({ useNotificationsTelephone: () => ({ etat: "active", activer: async () => true }) }));

const { AttenteFacecam } = await import("@/components/facecam/AttenteFacecam");
const { phraseArret } = await import("@/components/videos/BoutonArreter");

const SOURCE = readFileSync(join(process.cwd(), "src/components/facecam/AttenteFacecam.tsx"), "utf8");
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const etape = (cle: string, statut: string) => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression: 0, sortieFichierIds: [] });
const travail = (statut: string, extra: Record<string, unknown> = {}) =>
  ({ id: "t1", cibleId: "v1", statut, progression: 40, resteSec: 300, resteMin: 5, depense: { centimes: 1234, devise: "EUR" }, enAttenteFournisseur: false, boucleActive: true, etapes: [etape("mix", "terminee"), etape("coupes", "en_cours")], ...extra }) as never;
const rendre = (statut: string, extra?: Record<string, unknown>) => renderToStaticMarkup(createElement(AttenteFacecam, { initial: travail(statut, extra) }));

describe("AttenteFacecam · socle des suivis", () => {
  it("est écrit avec EnTeteSuivi, ActionsSuivi et BoutonArreter (sans depense, avec description), plus de feuille ni de bouton faits main", () => {
    expect(SOURCE).toMatch(/<EnTeteSuivi\b/);
    expect(SOURCE).toMatch(/<ActionsSuivi\b/);
    const arreter = SOURCE.match(/<BoutonArreter\b[^>]*\/>/)?.[0] ?? "";
    expect(arreter).not.toBe("");
    expect(arreter).not.toMatch(/depense/);
    expect(arreter).toMatch(/description=/);
    expect(SOURCE).not.toMatch(/FeuilleBas/);
    expect(SOURCE).not.toMatch(/function Arreter\b|function PrevenirTelephone\b/);
    expect(SOURCE).not.toMatch(/Passer devant/);
  });

  it("en cours : la phrase commune, les 4 étapes parlantes, Arrêter, jamais de « € » ni de « Passer devant »", () => {
    const html = rendre("en_cours", { rang: 2, finEstimee: undefined });
    const t = texte(html);
    expect(t).toContain("Votre vidéo se fabrique");
    expect(t).toContain("Vous pouvez fermer.");
    for (const n of ["Le son", "Les coupes", "L'image", "Les sous-titres et cartes"]) expect(t).toContain(n);
    expect(t).toContain("Arrêter");
    expect(t).not.toContain("Passer devant");
    expect(html).not.toMatch(/€|dépensé|payé/);
  });

  it("arrêtée sur erreur : titre commun, message lisible, « Reprendre » en action principale, aucun €", () => {
    const html = rendre("echec", { erreur: { messagePourWill: "Le son n'a pas abouti." } });
    const t = texte(html);
    expect(t).toContain("La fabrication s'est arrêtée");
    expect(t).toContain("Le son n'a pas abouti.");
    expect(t).toContain("Reprendre");
    expect(t).not.toContain("Arrêter");
    expect(html).not.toMatch(/€|dépensé|payé/);
  });
});

describe("BoutonArreter · phrase après l'arrêt", () => {
  it("format sans prix (pas de dépense donnée) : aucun montant, même si le moteur en a compté", () => {
    expect(phraseArret(undefined, 1234)).toBeUndefined();
  });
  it("format avec prix : le montant payé, ou « Rien n'a été payé. »", () => {
    expect(phraseArret({ centimes: 0, devise: "EUR" }, 0)).toBe("Rien n'a été payé.");
    expect(phraseArret({ centimes: 0, devise: "EUR" }, 150)?.replace(/\s/g, " ")).toBe("1,50 € payés pour les étapes faites.");
  });
});
