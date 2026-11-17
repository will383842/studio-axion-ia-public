/** X3-09b : le bouton « Animations » monté dans l'étape Réglages et la fiche vidéo. Éteint : écrans identiques à master. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PHRASE_CRAN_GRISE } from "@/briques/dosage-motion";
import { EtapeReglages, patchAnimations } from "@/assistant/etapes/Reglages";
import type { BrouillonAssistant, ContexteAssistant, DonneesAssistant } from "@/assistant/etapes/types";
import { OngletReglages } from "@/components/videos/fiche/OngletsLecture";
import type { CommandeFabrication } from "@/domaine/types";

const brouillon = (formatId = "avocat"): BrouillonAssistant => ({
  formatId, titre: "T", sujet: "S", dureeCibleSec: 60, ratios: ["9:16"], blocs: [], distribution: [], entrees: {}, reglages: {},
  styles: {}, briquesCoupees: [], briquesAllumees: [], mentionIA: { texte: "x", incrustee: false, position: "bas-gauche" } as never, adresse: "vous" as BrouillonAssistant["adresse"],
});
const contexte = (extra: Partial<DonneesAssistant> = {}): ContexteAssistant =>
  ({ personnages: [], elements: [], idees: [], enregistrer: async () => null, ...extra }) as unknown as ContexteAssistant;
const rendre = (extra: Partial<DonneesAssistant> = {}, formatId = "avocat") =>
  renderToStaticMarkup(createElement(EtapeReglages, { formatId, brouillon: brouillon(formatId), modifier: () => undefined, suivant: () => undefined, allerA: () => undefined, repliee: false, contexte: contexte(extra) }));
const echappe = (s: string) => s.replace(/'/g, "&#x27;");
const bouton = (html: string, libelle: string) => html.match(new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*?${libelle}`))?.[0] ?? "";
const grise = (html: string, libelle: string) => /disabled=""/.test(bouton(html, libelle).split(">")[0]);

describe("EtapeReglages · éteint", () => {
  it("sans dosageMotion ou dosageMotion undefined : HTML identique, « Intensité » présent, « Animations » absent", () => {
    const a = rendre();
    expect(rendre({ dosageMotion: undefined })).toBe(a);
    expect(a).toContain("Intensité");
    expect(a).not.toContain("Animations");
    // Empreinte du HTML relevée sur master avant modification.
    expect(createHash("sha256").update(a).digest("hex")).toBe("2202763d2bab5194e32e5839d61370c813d34e17d8ea0f6f8ecf0ffc285c4a56");
  });
});

describe("EtapeReglages · allumé", () => {
  it("avocat : titre « Animations », 4 crans actifs", () => {
    const html = rendre({ dosageMotion: { actif: true, generateur: "avocat", defaut: "equilibre" } });
    expect(html).toContain("Animations");
    expect(html).not.toContain("Intensité de la vidéo");
    for (const l of ["Aucun", "Sobre", "Équilibré", "Dynamique"]) expect(grise(html, l)).toBe(false);
  });
  it("tableau : « Aucun » grisé avec sa phrase", () => {
    const html = rendre({ dosageMotion: { actif: true, generateur: "tableau", defaut: "equilibre" } });
    expect(grise(html, "Aucun")).toBe(true);
    expect(html).toContain(echappe(PHRASE_CRAN_GRISE.animations));
  });
});

describe("patchAnimations", () => {
  it("« aucun » coupe aussi les bruitages (E3-3)", () => expect(patchAnimations("aucun")).toEqual({ dosageMotion: "aucun", bruitages: "aucun" }));
  it("« sobre » ne touche que le cran", () => expect(patchAnimations("sobre")).toEqual({ dosageMotion: "sobre" }));
});

describe("OngletReglages", () => {
  const rendreOnglet = (commande: CommandeFabrication | null) =>
    renderToStaticMarkup(createElement(OngletReglages, { commande, mentionIA: { texte: "Fait avec l'IA", incrustee: false, position: "bas-gauche" } as never, dureeLibelle: "1 min", ratios: ["9:16"] }));
  it("sans dosageMotion : aucune tuile « Animations »", () => {
    expect(rendreOnglet(null)).not.toContain("Animations");
    expect(rendreOnglet({ styles: {}, briques: {} } as unknown as CommandeFabrication)).not.toContain("Animations");
  });
  it("avec { cran: sobre } : tuile « Animations » valant « Sobre »", () => {
    const html = rendreOnglet({ styles: {}, briques: {}, dosageMotion: { cran: "sobre", choisiPar: "video" } } as unknown as CommandeFabrication);
    expect(html).toMatch(/Animations<\/p><p[^>]*>Sobre</);
  });
});
