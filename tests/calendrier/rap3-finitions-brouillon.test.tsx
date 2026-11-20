/** RAP-3 finitions · textes exacts pour un brouillon repris du diffuseur (jamais « programmé »). Données fictives. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApercuPublication } from "@/components/calendrier/ApercuPublication";
import { entreeDepuisPublication } from "@/components/calendrier/apercu-reseau";
import { CarteEntreeCalendrier } from "@/components/calendrier/CarteEntreeCalendrier";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/calendrier/actions/retirer-rapatriee", () => ({ retirerRapatrieeAction: vi.fn() }));
vi.mock("@/app/(studio)/calendrier/actions/retirer", () => ({ retirerDuCalendrier: vi.fn(), retirerProgrammationAction: vi.fn(), annulerRetraitAction: vi.fn() }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn() }));

const pub = (statut: string) => ({ id: "zr_p1_c1", reseau: "instagram", statut, via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "Texte fictif", rapatrieeLe: "2026-11-20T10:00:00.000Z", mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://medias.exemple.test/a.jpg" } });
const fiche = (statut: string) => renderToStaticMarkup(<ApercuPublication entree={entreeDepuisPublication(pub(statut) as never) as never} aujourdhui="2026-11-20" onPrecedente={() => undefined} onSuivante={() => undefined} onFermer={() => undefined} onChangerDate={() => undefined} />).replace(/&#x27;/g, "'");

describe("RAP-3 finitions · textes d'un brouillon", () => {
  it("brouillon : « reste chez le diffuseur » et « brouillon chez le diffuseur », jamais « programm… »", () => {
    const h = fiche("brouillon");
    expect(h).toMatch(/Retirer du calendrier \(reste chez le diffuseur\)/);
    expect(h).toContain("brouillon chez le diffuseur");
    expect(h).not.toMatch(/programm(é|ée|er)e? chez le diffuseur/i);
  });
  it("programmée : textes inchangés", () => {
    const h = fiche("programmee");
    expect(h).toMatch(/reste programmée chez le diffuseur/);
    expect(h).toContain("programmé chez le diffuseur");
  });
});

describe("RAP-3 finitions · alt de la carte", () => {
  const carte = (statut: string) => renderToStaticMarkup(<CarteEntreeCalendrier entree={{ ...(entreeDepuisPublication(pub(statut) as never) as object), cle: "publication:zr_p1_c1" } as never} />).replace(/&#x27;/g, "'");
  it("brouillon : « brouillon chez le diffuseur » ; programmée : « programmé chez le diffuseur »", () => {
    expect(carte("brouillon")).toContain("brouillon chez le diffuseur");
    expect(carte("brouillon")).not.toMatch(/programmé chez/);
    expect(carte("programmee")).toContain("programmé chez le diffuseur");
  });
});
