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

const pub = (statut: string, etatEnvoi?: string) => ({ etatEnvoi, id: "zr_p1_c1", reseau: "instagram", statut, via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "Texte fictif", rapatrieeLe: "2026-11-20T10:00:00.000Z", mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://medias.exemple.test/a.jpg" } });
const fiche = (statut: string, etatEnvoi?: string) => renderToStaticMarkup(<ApercuPublication entree={entreeDepuisPublication(pub(statut, etatEnvoi) as never) as never} aujourdhui="2026-11-20" onPrecedente={() => undefined} onSuivante={() => undefined} onFermer={() => undefined} onChangerDate={() => undefined} />).replace(/&#x27;/g, "'");

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

describe("RAP-3 réserves · retrait unitaire d'une rapatriée « à vérifier »", () => {
  const clique = (statut: string) => {
    // la confirmation n'apparaît qu'au clic : on lit donc le libellé du bouton et les constantes de texte
    return fiche(statut, "a-verifier");
  };
  it("programmée à vérifier : le bouton ne promet pas « reste programmée »", () => {
    const h = clique("programmee");
    expect(h).not.toMatch(/reste programmée chez le diffuseur/);
    expect(h).toMatch(/Retirer du calendrier \(le diffuseur ne le retrouve plus\)/);
  });
  it("brouillon à vérifier : l'équivalent, jamais « programmé »", () => {
    const h = clique("brouillon");
    expect(h).toMatch(/Retirer du calendrier \(le diffuseur ne le retrouve plus\)/);
    expect(h).not.toMatch(/reste programm/i);
  });
  it("phrases de confirmation exactes", async () => {
    const m = await import("@/components/calendrier/RetirerRapatriee");
    expect(m.PHRASE_RETIRER_INTROUVABLE).toContain("Le diffuseur ne retrouve plus ce post ; rien n'est changé chez lui.");
    expect(m.PHRASE_RETIRER_INTROUVABLE_BROUILLON).toContain("Le diffuseur ne retrouve plus ce brouillon ; rien n'est changé chez lui.");
    for (const t of [m.PHRASE_RETIRER_INTROUVABLE, m.PHRASE_RETIRER_INTROUVABLE_BROUILLON]) expect(t).not.toMatch(/programm|partira|reste/i);
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
