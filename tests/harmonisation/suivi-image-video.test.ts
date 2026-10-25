/**
 * Harmonisation F6 + F7 · Image → vidéo : le suivi (une vidéo, un lot) et le résultat passent par le socle commun
 * `src/components/fabrication/` (EnTeteSuivi, ActionsSuivi, EncartCout). Vrais rendus (renderToStaticMarkup), pas des
 * regex sur le source : ce que Will lit et l'ordre des actions. Rien d'appelé, rien de payé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LotIV, StatutVideoLotIV } from "@/domaine/image-video/lot";
import { PHRASES_SUIVI } from "@/domaine/libelles";
import { mockHeaders } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { Fabrication } = await import("@/components/formats/image-video/Fabrication");
const { SuiviLot } = await import("@/components/formats/image-video/SuiviLot");
const { VosVideos } = await import("@/components/formats/image-video/VosVideos");
const { etatSuiviIV, enteteSuiviLot } = await import("@/components/formats/image-video/vues-gabarit");
const service = await import("@/services/image-video-lot");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const compte = (t: string, m: string) => t.split(m).length - 1;

const pas = (...etats: ("fait" | "en-cours" | "a-venir" | "arrete")[]) => etats.map((etat, i) => ({ cle: (["lecture", "ecriture", "voix", "rendu"] as const)[i], nom: `Pas ${i}`, etat }));
const argent = { engageCentimes: 120, plafondCentimes: 500, payeCentimes: 50, attente: false };
const vueEnCours = { ...argent, pas: pas("fait", "en-cours", "a-venir") };
const arret = { travailId: "t-1", depense: { centimes: 120, devise: "EUR" as const } };
const rendreFab = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(Fabrication, { videoId: "v-1", ecran: "fabrication", vue: vueEnCours, enCours: false, ...p } as never));

describe("F6 · etatSuiviIV (pur)", () => {
  it("en cours > arrêtée par Will > refus > étapes", () => {
    expect(etatSuiviIV({ enCours: true, vue: vueEnCours })).toBe("en-cours");
    expect(etatSuiviIV({ enCours: false, arretee: true, vue: vueEnCours })).toBe("arretee");
    expect(etatSuiviIV({ enCours: false, vue: { ...vueEnCours, pas: pas("fait", "arrete"), refus: { phrase: "x", details: [], reessayable: true } } })).toBe("coincee");
    expect(etatSuiviIV({ enCours: false, vue: { ...vueEnCours, pas: pas("fait", "fait") } })).toBe("prete");
  });
});

describe("F6 · Fabrication d'une vidéo, sur le socle", () => {
  it("en cours : titre et phrase communs, sans promesse de durée, « Arrêter » rangé par ActionsSuivi", () => {
    const html = rendreFab({ enCours: true, arret });
    const t = texte(html);
    expect(t).toContain(`${PHRASES_SUIVI["en-cours"].titre} ${PHRASES_SUIVI["en-cours"].phrase}`);
    expect(t).not.toContain("Encore quelques minutes");
    expect(html).toMatch(/data-actions="pendant"[^]*Arrêter/);
    expect(html.indexOf('data-etat="en-cours"')).toBeLessThan(html.indexOf("Pas 0"));
  });

  it("en cours sans arrêt tenu (lanceur) : aucun « Arrêter », aucune barre d'actions", () => {
    const html = rendreFab({ enCours: true });
    expect(texte(html)).not.toContain("Arrêter");
    expect(html).not.toContain("data-actions");
  });

  it("arrêtée par Will : titre commun, phrase des étapes payées, lien vers les vidéos, aucun « Reprendre »", () => {
    const html = rendreFab({ arretee: true });
    const t = texte(html);
    expect(t).toContain(PHRASES_SUIVI.arretee.titre);
    expect(t).toContain("seules les étapes déjà faites ont été payées");
    expect(html).toMatch(/data-actions="apres"[^]*href="\/videos"[^]*Voir mes vidéos/);
    expect(t).not.toMatch(/Reprendre|Relever le plafond/);
  });

  it("refus réessayable : titre « coincée », la phrase du refus une seule fois, « Refaire cette partie » dans les actions", () => {
    const vue = { ...argent, pas: pas("fait", "arrete"), refus: { phrase: "Le rendu n'a pas abouti.", details: ["Détail un"], reessayable: true } };
    const html = rendreFab({ vue });
    const t = texte(html);
    expect(t).toContain(PHRASES_SUIVI.coincee.titre);
    expect(compte(t, "Le rendu n'a pas abouti.")).toBe(1);
    expect(t).toContain("Détail un");
    expect(html).toMatch(/data-actions="apres"[^]*Refaire cette partie/);
    expect(html.indexOf("Détail un")).toBeLessThan(html.indexOf("Refaire cette partie"));
  });

  it("refus non réessayable : la phrase, pas de bouton", () => {
    const vue = { ...argent, pas: pas("fait", "arrete"), refus: { phrase: "Pas encore ouvert.", details: [], reessayable: false } };
    const html = rendreFab({ vue });
    expect(texte(html)).toContain("Pas encore ouvert.");
    expect(texte(html)).not.toContain("Refaire cette partie");
  });

  it("l'argent : dépense face au plafond gardée, « Au plus » et « Déjà payé » dits avec les mots communs", () => {
    const t = texte(rendreFab({ enCours: true, arret, plafond: { proposeCentimes: 700, arrete: false } }));
    expect(t).toContain("Dépense");
    expect(t).toContain("plafond");
    expect(t).toContain("Au plus");
    expect(t).toContain("Voix déjà payée");
    expect(t).not.toContain("Déjà payé");
  });

  it("l'ordre d'avant : steps, puis l'argent, puis le détail du refus, puis « Refaire cette partie », puis le plafond", () => {
    const vue = { ...argent, pas: pas("fait", "arrete"), attente: true, refus: { phrase: "Le rendu n'a pas abouti.", details: ["Détail un"], reessayable: true } };
    const t = texte(rendreFab({ vue, plafond: { proposeCentimes: 700, arrete: false } }));
    const ordre = ["Le rendu tourne", "Dépense", "Détail un", "Refaire cette partie", "Besoin de plus de marge"].map((m) => t.indexOf(m));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it("arrêtée par Will ET refus réessayable : « Refaire cette partie » et les détails restent proposés (comportement d'avant)", () => {
    const vue = { ...argent, pas: pas("fait", "arrete"), refus: { phrase: "Le rendu n'a pas abouti.", details: ["Détail un"], reessayable: true } };
    const html = rendreFab({ vue, arretee: true });
    const t = texte(html);
    expect(t).toContain(PHRASES_SUIVI.arretee.titre);
    expect(t).toContain("Détail un");
    expect(compte(t, "Le rendu n'a pas abouti.")).toBe(1);
    expect(t).toContain("Refaire cette partie");
    expect(html).toMatch(/href="\/videos"[^]*Voir mes vidéos/);
  });

  it("arrêtée par Will ET refus réessayable sans détail : la phrase du refus est dite une fois, « Refaire cette partie » proposé", () => {
    const vue = { ...argent, pas: pas("fait", "arrete"), refus: { phrase: "Le rendu n'a pas abouti.", details: [], reessayable: true } };
    const t = texte(rendreFab({ vue, arretee: true }));
    expect(t).toContain(PHRASES_SUIVI.arretee.titre);
    expect(compte(t, "Le rendu n'a pas abouti.")).toBe(1);
    expect(t).toContain("Refaire cette partie");
  });

  it("arrêtée par Will, refus non réessayable : pas de « Refaire cette partie »", () => {
    const vue = { ...argent, pas: pas("fait", "arrete"), refus: { phrase: "x", details: [], reessayable: false } };
    expect(texte(rendreFab({ vue, arretee: true }))).not.toContain("Refaire cette partie");
  });

  it("plus de « Relever le plafond » (règle du 25/10/2026) : la jauge de dépense reste en information", () => {
    expect(texte(rendreFab({ plafond: { proposeCentimes: 700, arrete: true } }))).not.toContain("Relever le plafond");
    expect(texte(rendreFab({ enCours: true, arret, plafond: { proposeCentimes: 700, arrete: false } }))).not.toContain("Relever le plafond");
  });

  it("jamais « Annuler cette vidéo » ici (lot argent séparé) ni d'« Arrêter » hors fabrication", () => {
    const t = texte(rendreFab({ arret }));
    expect(t).not.toMatch(/Annuler cette vidéo|Arrêter/);
  });
});

function lotDe(statuts: StatutVideoLotIV[], surcharge: Partial<LotIV> = {}): LotIV {
  return {
    version: "lot-iv/1",
    id: "lot-iv-0123456789ab",
    creeLe: "2026-10-17T10:00:00.000Z",
    cleIdempotence: "c",
    reseaux: ["tiktok"],
    prixParVideoCentimes: 220,
    accordCentimes: 220 * statuts.length,
    plafondCentimes: 220 * statuts.length,
    tauxUsdEur: 0.9,
    statut: "en-cours",
    pannesDeSuite: 0,
    journal: [],
    videos: statuts.map((statut, i) => ({
      rang: i + 1,
      videoId: `v${i + 1}`,
      fichierId: `f${i + 1}`,
      nom: `image-${i + 1}.png`,
      statut,
      ...(statut === "mise-de-cote" ? { miseDeCote: { porte: "carte" as const, motif: "Un point est incertain.", phrases: [] } } : {}),
    })),
    ...surcharge,
  } as LotIV;
}
const vueDe = (lot: LotIV) => service.construireVueLotIV(lot, { imageUrl: () => null, etape: () => undefined });
const rendreLot = (lot: LotIV) => renderToStaticMarkup(createElement(SuiviLot, { vue: vueDe(lot) }));
const pause = { pause: { raison: "credit" as const, phrase: "Le crédit ne suffit plus." } };

describe("F7 · enteteSuiviLot (pur)", () => {
  it("en cours, pause (coincée, avec sa phrase), arrêt de Will (message), à relire, fini", () => {
    expect(enteteSuiviLot(vueDe(lotDe(["en-fabrication", "en-attente"]))).etat).toBeNull();
    const p = enteteSuiviLot(vueDe(lotDe(["en-attente"], { statut: "en-pause", ...pause })));
    expect(p).toMatchObject({ etat: "coincee", message: "Le crédit ne suffit plus." });
    const a = enteteSuiviLot(vueDe(lotDe(["faite", "en-attente"], { statut: "arrete" })));
    expect(a.etat).toBe("arretee");
    expect(a.message).toContain("Vous avez arrêté le lot");
    expect(enteteSuiviLot(vueDe(lotDe(["faite", "mise-de-cote"], { statut: "termine" }))).etat).toBeNull();
    expect(enteteSuiviLot(vueDe(lotDe(["faite", "faite"], { statut: "termine" }))).etat).toBeNull();
  });
});

describe("F7 · SuiviLot, sur le socle", () => {
  it("en cours : pas de titre commun, « Arrêter le lot » dans les actions pendant, sans promesse de durée", () => {
    const html = rendreLot(lotDe(["faite", "en-fabrication", "en-attente"]));
    const t = texte(html);
    expect(t).not.toContain(PHRASES_SUIVI["en-cours"].titre);
    expect(t).not.toContain("Encore quelques minutes");
    expect(html).toMatch(/data-actions="pendant"[^]*Arrêter le lot/);
    expect(t).not.toContain("Reprendre le lot");
  });

  it("en pause : titre « coincée » avec la phrase de la pause une seule fois, « Reprendre le lot » dans les actions après", () => {
    const html = rendreLot(lotDe(["en-attente", "en-attente"], { statut: "en-pause", ...pause }));
    const t = texte(html);
    expect(t).toContain(PHRASES_SUIVI.coincee.titre);
    expect(compte(t, "Le crédit ne suffit plus.")).toBe(1);
    expect(html).toMatch(/data-actions="apres"[^]*Reprendre le lot/);
    expect(t).not.toContain("Arrêter le lot");
  });

  it("arrêté par Will : « Vous avez arrêté le lot » (une fois), aucun « Reprendre le lot »", () => {
    const t = texte(rendreLot(lotDe(["faite", "en-attente"], { statut: "arrete" })));
    expect(t).toContain(PHRASES_SUIVI.arretee.titre);
    expect(compte(t, "Vous avez arrêté le lot")).toBe(1);
    expect(t).not.toContain("Reprendre le lot");
  });

  it("fini avec des vidéos à relire : lien « Relire la première mise de côté » dans les actions, listes gardées dans l'ordre", () => {
    const html = rendreLot(lotDe(["faite", "mise-de-cote"], { statut: "termine" }));
    const t = texte(html);
    expect(html).toMatch(/data-actions="apres"[^]*href="\/image-video\/v2"[^]*Relire la première mise de côté/);
    expect(t.indexOf("À relire")).toBeLessThan(t.indexOf("Le lot"));
  });

  it("fini avec des vidéos mises de côté : pas de titre « script attend votre relecture »", () => {
    const html = rendreLot(lotDe(["faite", "mise-de-cote"], { statut: "termine" }));
    expect(texte(html)).not.toContain(PHRASES_SUIVI["a-relire"].titre);
  });

  it("fini sans rien à relire : pas de titre « prête » (singulier), aucune action", () => {
    const html = rendreLot(lotDe(["faite", "faite"], { statut: "termine" }));
    expect(texte(html)).not.toContain(PHRASES_SUIVI.prete.titre);
    expect(html).not.toContain("data-actions");
  });

  it("jamais « Annuler cette vidéo » sur un lot", () => {
    expect(texte(rendreLot(lotDe(["en-fabrication"])))).not.toContain("Annuler cette vidéo");
  });
});

describe("F7 · Vos vidéos (le résultat)", () => {
  const video = { reseau: "tiktok", nom: "TikTok", ton: "vert" as const, phrase: "Prête.", duree: "0:30", format: "9:16" as const, url: "https://x/v.mp4", titre: "T", texte: "Texte", premierCommentaire: "C", lien: undefined, consigneLien: undefined };
  it("titre commun « Votre vidéo est prête » avant les cartes ; un fichier par réseau gardé", () => {
    const html = renderToStaticMarkup(createElement(VosVideos, { videos: [video, { ...video, reseau: "youtube-shorts", nom: "YouTube Shorts" }] as never }));
    const t = texte(html);
    expect(t).toContain(PHRASES_SUIVI.prete.titre);
    expect(t.indexOf(PHRASES_SUIVI.prete.titre)).toBeLessThan(t.indexOf("TikTok"));
    expect(html.match(/<a [^>]*download/g)).toHaveLength(2);
  });

  it("verdict rouge (ok=false) : pas de titre « Votre vidéo est prête », le verdict est dit ; verdict vert : titre gardé", () => {
    const rouge = texte(renderToStaticMarkup(createElement(VosVideos, { videos: [video], verdict: { ok: false, phrase: "Contrôle : à revoir.", mentions: [] } } as never)));
    expect(rouge).not.toContain(PHRASES_SUIVI.prete.titre);
    expect(rouge).toContain("Contrôle : à revoir.");
    const vert = texte(renderToStaticMarkup(createElement(VosVideos, { videos: [video], verdict: { ok: true, phrase: "Contrôle : bon.", mentions: [] } } as never)));
    expect(vert).toContain(PHRASES_SUIVI.prete.titre);
  });
});
