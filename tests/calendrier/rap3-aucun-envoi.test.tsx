/** RAP-3 · INTERDIT : aucun bouton d'envoi, de programmation, de reprogrammation, de renvoi ni de déplacement sur une rapatriée. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApercuPublication } from "@/components/calendrier/ApercuPublication";
import { apercuReseau, entreeDepuisPublication, PHRASE_DEPLACER_CHEZ_DIFFUSEUR } from "@/components/calendrier/apercu-reseau";
import { construireFileACorriger } from "@/services/calendrier-reprogrammation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/calendrier/actions/retirer-rapatriee", () => ({ retirerRapatrieeAction: vi.fn() }));
vi.mock("@/app/(studio)/calendrier/actions/retirer", () => ({ retirerDuCalendrier: vi.fn(), retirerProgrammationAction: vi.fn(), annulerRetraitAction: vi.fn() }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn() }));

const pub = { id: "zr_p1_c1", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "Texte fictif", rapatrieeLe: "2026-11-20T10:00:00.000Z", mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://medias.exemple.test/a.jpg" } };
const rendu = (extra: object = {}) =>
  renderToStaticMarkup(<ApercuPublication entree={{ ...entreeDepuisPublication(pub as never), ...extra } as never} aujourdhui="2026-11-20" onPrecedente={() => undefined} onSuivante={() => undefined} onFermer={() => undefined} onChangerDate={() => undefined} />).replace(/&#x27;/g, "'");

describe("RAP-3 · fiche d'une rapatriée", () => {
  it("pas de « Déplacer », pas de champ date, la phrase du diffuseur", () => {
    const h = rendu();
    expect(h).not.toMatch(/Déplacer au|type="date"/);
    expect(h).toContain("Cette publication vient du diffuseur : elle se modifie et se déplace chez lui.");
    expect(apercuReseau(entreeDepuisPublication(pub as never), "2026-11-20").deplacable).toBe(false);
    expect(PHRASE_DEPLACER_CHEZ_DIFFUSEUR).toBe("Pour changer la date, déplacez-la chez le diffuseur : le calendrier suivra.");
  });
  it("aucun bouton d'envoi, de programmation, de renvoi ni « Prêt à partir »", () => {
    const h = rendu();
    expect(h).not.toMatch(/Envoyer|Programmer|Reprogrammer|Renvoyer|Réessayer|Valider|Prêt à partir|Publier maintenant/);
  });
  it("« Retirer » est local et dit que le post RESTE programmé chez le diffuseur ; bouton de 44 px", () => {
    const h = rendu();
    expect(h).toMatch(/Retirer du calendrier/);
    expect(h).toMatch(/reste programmée chez le diffuseur/i);
    expect(h).toMatch(/min-h-11/);
  });
  it("pas de bouton « Retirer » sur une rapatriée déjà retirée ou publiée", () => {
    expect(rendu({ etat: "retire_diffuseur" })).not.toMatch(/Retirer du calendrier/);
    expect(rendu({ etat: "publie" })).not.toMatch(/Retirer du calendrier/);
  });
  it("le texte de la fiche ne nomme jamais l'ancien outil", () => expect(rendu()).not.toMatch(/buffer|zernio/i));
});

describe("RAP-3 · files « à corriger »", () => {
  it("une rapatriée à vérifier ou refusée n'offre aucune relance", () => {
    const base = { id: "zr_p1_c1", reseau: "instagram", via: "zernio", statut: "programmee", date: "2026-11-25T08:30:00.000Z", rapatrieeLe: "2026-11-20T10:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z" };
    expect(construireFileACorriger([{ ...base, etatEnvoi: "a-verifier" }] as never)).toEqual([]);
    expect(construireFileACorriger([{ ...base, etatEnvoi: "refuse" }] as never)).toEqual([]);
  });
});
