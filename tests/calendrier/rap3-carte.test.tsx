/** RAP-3 · carte d'une publication rapatriée : état, heure de Paris, vignette (même origine), carte texte sans image. Données fictives. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LIBELLES_ENVOI, entreeDepuisPublication, etatAffiche, type PublicationApercu } from "@/components/calendrier/apercu-reseau";
import { CarteEntreeCalendrier } from "@/components/calendrier/CarteEntreeCalendrier";
import { peutGlisser } from "@/components/calendrier/GrilleSemaine";

const base: PublicationApercu & { rapatrieeLe?: string; retireeLe?: string; mediaDiffuseur?: { type: string; nombre: number; miniature?: string } } = {
  id: "zr_p1_c1", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "Un texte fictif pour la carte du calendrier",
  rapatrieeLe: "2026-11-20T10:00:00.000Z", mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://medias.exemple.test/a.jpg" },
};
const html = (n: React.ReactElement) => renderToStaticMarkup(n).replace(/&#x27;/g, "'");

describe("RAP-3 · état affiché", () => {
  it("programmée → « Programmée chez le diffuseur » ; brouillon → brouillon chez le diffuseur ; retirée → « Retirée chez le diffuseur »", () => {
    expect(etatAffiche(base)).toBe("programme_diffuseur");
    expect(LIBELLES_ENVOI.programme_diffuseur.libelle).toBe("Programmée chez le diffuseur");
    expect(etatAffiche({ ...base, statut: "brouillon" })).toBe("brouillon_buffer");
    expect(etatAffiche({ ...base, retireeLe: "2026-11-21T10:00:00.000Z" })).toBe("retire_diffuseur");
    expect(LIBELLES_ENVOI.retire_diffuseur.libelle).toBe("Retirée du calendrier");
  });
  it("les autres états ne changent pas (à vérifier, publiée)", () => {
    expect(etatAffiche({ ...base, etatEnvoi: "a-verifier" })).toBe("a_verifier");
    expect(etatAffiche({ ...base, statut: "publiee" })).not.toBe("programme_diffuseur");
  });
  it("une publication du Studio n'est pas touchée", () => {
    expect(etatAffiche({ statut: "programmee", via: "zernio" })).not.toBe("programme_diffuseur");
  });
});

describe("RAP-3 · entrée", () => {
  it("heure de Paris, hiver et été", () => {
    expect(entreeDepuisPublication(base).heure).toBe("09:30");
    expect(entreeDepuisPublication({ ...base, date: "2027-03-30T07:00:00.000Z" }).heure).toBe("09:00");
  });
  it("vignette : chemin du Studio (jamais l'adresse du diffuseur) ; pas de miniature : aucune vignette", () => {
    const e = entreeDepuisPublication(base);
    expect(e.vignette).toBe("/api/calendrier/miniature/zr_p1_c1");
    expect(JSON.stringify(e)).not.toContain("medias.exemple.test");
    expect(e.chezDiffuseur).toBe(true);
    expect(entreeDepuisPublication({ ...base, mediaDiffuseur: { type: "aucun", nombre: 0 } }).vignette).toBeUndefined();
    expect(entreeDepuisPublication({ ...base, mediaDiffuseur: { type: "image", nombre: 1 } }).vignette).toBeUndefined();
  });
  it("type : vidéo si le média est une vidéo, sinon image", () => {
    expect(entreeDepuisPublication({ ...base, mediaDiffuseur: { type: "video", nombre: 1 } }).type).toBe("video");
    expect(entreeDepuisPublication(base).type).toBe("image");
  });
});

describe("RAP-3 · carte", () => {
  it("avec miniature : image du Studio, alt en français, dimensions réservées, début du texte, mention du diffuseur", () => {
    const h = html(<CarteEntreeCalendrier entree={{ ...entreeDepuisPublication(base), titre: "Un texte fictif" } as never} libellesEtat={LIBELLES_ENVOI} avecTitre />);
    expect(h).toContain('src="/api/calendrier/miniature/zr_p1_c1"');
    expect(h).toMatch(/alt="[^"]*Instagram[^"]*"/);
    expect(h).toMatch(/width="\d+"/);
    expect(h).toMatch(/height="\d+"/);
    expect(h).toContain("Programmée chez le diffuseur");
    expect(h).toContain("Un texte fictif");
    expect(h).not.toContain("medias.exemple.test");
  });
  it("sans miniature : carte texte, aucune image", () => {
    const h = html(<CarteEntreeCalendrier entree={entreeDepuisPublication({ ...base, mediaDiffuseur: { type: "aucun", nombre: 0 } }) as never} libellesEtat={LIBELLES_ENVOI} />);
    expect(h).not.toContain("<img");
    expect(h).toContain("Programmée chez le diffuseur");
  });
  it("une carte rapatriée ne se glisse pas", () => {
    expect(peutGlisser(entreeDepuisPublication(base) as never, "2026-11-20")).toBe(false);
  });
});
