/**
 * CAL-04 : jamais de réponse automatique sur LinkedIn ni TikTok (aperçu du calendrier).
 * Sans DOM : on lit le rendu statique. Données fictives, aucun appel réel.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { accepteReponseAutomatique } = await import("@/domaine/calendrier/reponses-auto");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;

const AUJOURDHUI = "2026-11-11";
const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const lisible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

const entree = (reseau: string): Entree => ({
  cle: `creneau:c1|${reseau}`,
  jour: "2026-11-12",
  reseau: reseau as Entree["reseau"],
  type: "video",
  etat: "a_valider",
  heure: "09:00",
  titre: "Le devis qui part tout seul",
  texte: "Trois e-mails sur quatre se trient sans vous.",
  media: { genre: "video", url: "https://exemple.fr/video.mp4" },
});
const apercu = (reseau: string) =>
  rendre(<ApercuPublication entree={entree(reseau)} aujourdhui={AUJOURDHUI} onPrecedente={() => {}} onSuivante={() => {}} onFermer={() => {}} onChangerDate={() => {}} />);

describe("CAL-04 : une fonction unique", () => {
  it("oui pour Instagram et Facebook seulement", () => {
    expect(accepteReponseAutomatique("instagram")).toBe(true);
    expect(accepteReponseAutomatique("facebook")).toBe(true);
  });
  it("non pour LinkedIn et TikTok, quel que soit le réglage et la casse", () => {
    for (const r of ["linkedin", "tiktok", "LinkedIn", " TIKTOK "]) {
      expect(accepteReponseAutomatique(r)).toBe(false);
      expect(accepteReponseAutomatique(r, true)).toBe(false);
      expect(accepteReponseAutomatique(r, { actif: true, force: true })).toBe(false);
    }
  });
  it("non pour un réseau inconnu, vide ou illisible", () => {
    for (const r of ["youtube", "", "  ", null, undefined, 42, {}]) expect(accepteReponseAutomatique(r as unknown as string)).toBe(false);
  });
});

describe("CAL-04 : l'aperçu", () => {
  for (const [id, nom] of [["linkedin", "LinkedIn"], ["tiktok", "TikTok"]] as const) {
    it(`${nom} : « toujours à la main », lien vers « À traiter », ni bloc mot-clé ni bouton de réponse automatique`, () => {
      const html = apercu(id);
      const t = lisible(html);
      expect(t).toContain(`Réponses aux commentaires : toujours à la main sur ${nom}.`);
      expect(html).toMatch(/<a [^>]*href="\/a-traiter"[^>]*>[^<]*À traiter/);
      expect(t).not.toContain("Mot-clé");
      expect(t).not.toContain("Aucun mot-clé");
      expect(t).not.toMatch(/réponse automatique/i);
      expect(html).not.toMatch(/<button[^>]*>[^<]*(automatique|répondre)/i);
    });
  }
  for (const [id] of [["instagram"], ["facebook"]]) {
    it(`${id} : le bloc mot-clé est là, sans « toujours à la main »`, () => {
      const t = lisible(apercu(id));
      expect(t).toContain("Aucun mot-clé sur cette publication");
      expect(t).not.toContain("toujours à la main");
    });
  }
  it("un réseau inconnu : ni bloc mot-clé ni phrase", () => {
    const t = lisible(apercu("youtube"));
    expect(t).not.toContain("Mot-clé");
    expect(t).not.toContain("Réponses aux commentaires");
  });
});
