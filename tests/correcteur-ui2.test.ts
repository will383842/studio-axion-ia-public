/**
 * CORRECTEUR UI2 — constats du test réel dans Chrome (04/10, version 7fd6eab, brouillon type avocat, moteurs en essai).
 * Aucun appel réseau, aucune clé.
 *
 * U5 : un script collé de 53 mots annoncé « ≈ 12 s » (débit d'écriture de la recette avocat, 4,4 mots/s) alors que la
 *      voix lit environ 2,6 mots/s (≈ 20 s) ; même chose pour la durée de la vidéo d'essai (« Durée 12 s »).
 * U6 : « Fabriquer · ≈ 1,03 € · … · ESSAI » lançait tout de suite, sans « qui parle » ni voix, avec un montant qui fait
 *      croire à un paiement.
 * U7 : l'écran « Je fabrique votre vidéo » restait sur des blocs gris alors que la vidéo était prête.
 * U8 : sur une vidéo d'essai, « Buffer › Programmer » proposait l'envoi comme pour une vraie.
 * U9 : Mes vidéos : « Toutes 0 » et « Type avocat 0 » avec deux brouillons type avocat.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const scripts = await import("@/services/scripts");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { debitLecture, estimerDureeTexte, obtenirFormat } = await import("@/formats");

const MDP = "essai-correcteur-ui2";
/** 53 mots, comme le script collé du test réel. */
const TEXTE_53 = Array.from({ length: 53 }, (_, i) => (i % 9 === 8 ? "dossier." : "client")).join(" ");
const blocs53 = () => [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: TEXTE_53 }] }];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("U5 — la durée d'un brouillon vient du texte réel, au débit de la voix (même calcul partout)", () => {
  it("sans voix choisie : 53 mots ≈ 20 s, plus 12 s", () => {
    const avocat = obtenirFormat("avocat");
    expect(estimerDureeTexte(avocat, TEXTE_53, debitLecture(avocat, undefined))).toBe(20);
    expect(estimerDureeTexte(avocat, TEXTE_53, debitLecture(avocat, null))).toBe(20);
    expect(estimerDureeTexte(avocat, TEXTE_53, debitLecture(avocat))).toBe(20);
    // Un format dont la recette lit plus lentement que la voix garde son débit.
    expect(debitLecture(obtenirFormat("podcast"))).toBe(obtenirFormat("podcast").recetteScript.motsParSeconde);
    // Voix HeyGen : inchangé (débit mesuré × vitesse).
    expect(estimerDureeTexte(avocat, TEXTE_53, debitLecture(avocat, { fournisseur: "heygen", reglages: { vitesse: 1 } }))).toBe(20);
  });

  it("« Mes scripts » annonce la même durée que l'écran « Votre vidéo »", async () => {
    const id = await scripts.enregistrerScript({ formatId: "avocat", sujet: "Cinquante-trois mots", blocs: blocs53() });
    const s = (await scripts.listerScripts({ formatId: "avocat" })).find((x) => x.id === id)!;
    expect(s.dureeEstimeeSec).toBe(20);
  });

  it("brouillon sans « qui parle » ni voix, créé AVANT la correction (12 s en base) : la vidéo d'essai dure ≈ 20 s", async () => {
    await ecrireParametre("afficherExemples", false);
    const scriptId = await scripts.enregistrerScript({ formatId: "avocat", sujet: "Cinquante-trois mots", blocs: blocs53() });
    const videoId = await videos.creerBrouillon("avocat", { scriptId });
    expect((await depots().videos.obtenir(videoId))?.distribution[0]?.voixId).toBeUndefined();
    // Ancienne valeur, calculée au débit d'écriture.
    await depots().videos.modifier(videoId, { dureeCibleSec: 12 });
    expect((await fabrication.construireCommande(videoId)).dureeCibleSec).toBe(20);
    await fabrication.lancerFabrication(videoId, { confirme: 1_000_000 });
    expect((await depots().videos.obtenir(videoId))?.dureeCibleSec).toBe(20);
  });
});

describe("U6 — « Fabriquer » d'un essai : « Essai gratuit », et « qui parle » / voix demandés avant", () => {
  const logique = () => import("@/assistant/express/logique");

  it("le bouton d'un essai dit « Essai gratuit » (jamais un montant en euros) ; le vrai prix reste en petit", async () => {
    const { libelleBoutonFabriquer, prixEnVrai } = await logique();
    const montant = { centimes: 103, devise: "EUR" as const };
    const essai = libelleBoutonFabriquer({ montant, dureeFabricationSec: 24, essaiGratuit: true });
    expect(essai).toBe("Fabriquer · Essai gratuit · prête en ~24 s");
    expect(essai).not.toMatch(/€/);
    expect(prixEnVrai(montant)).toMatch(/^En vrai : ≈ 1,03\s€$/);
    // Une vraie vidéo garde son prix sur le bouton.
    expect(libelleBoutonFabriquer({ montant, dureeFabricationSec: 24, essaiGratuit: false })).toMatch(/^Fabriquer · ≈ 1,03\s€ · prête en ~24 s$/);
    expect(libelleBoutonFabriquer({ montant: null, essaiGratuit: true })).toBe("Fabriquer");
  });

  it("il manque « qui parle » et la voix : vraie vidéo → on les demande ; essai → la vidéo de démonstration est annoncée", async () => {
    const { decisionLancement, manquesAvantFabrication, libelleManques } = await logique();
    const manques = manquesAvantFabrication({ ton: "orange" }, { ton: "orange" });
    expect(manques).toEqual(["plateau", "voix"]);
    expect(libelleManques(manques)).toBe("qui parle et la voix");
    expect(manquesAvantFabrication({ ton: "pret" }, { ton: "pret" })).toEqual([]);
    const base = { coutCentimes: 103, seuilCentimes: 2000, resteCentimes: 10000, aVerifier: [] };
    // Essai gratuit : plus de lancement « d'un coup » ; Will choisit (« Choisir qui parle » ou « Fabriquer l'essai »).
    expect(decisionLancement({ ...base, manques, essaiGratuit: true })).toEqual({ genre: "essai-demonstration", manques });
    expect(decisionLancement({ ...base, manques, essaiGratuit: true, manquesAcceptes: true })).toEqual({ genre: "direct" });
    // Vraie vidéo : on demande d'abord, même si Will a accepté pour un essai (aucune dépense par ce chemin).
    expect(decisionLancement({ ...base, manques, essaiGratuit: false })).toEqual({ genre: "completer", bloc: "plateau" });
    expect(decisionLancement({ ...base, manques, essaiGratuit: false, manquesAcceptes: true })).toEqual({ genre: "completer", bloc: "plateau" });
    // Le chemin payant garde la feuille « Confirmer ce prix ».
    expect(decisionLancement({ ...base, montageReel: true, manques: [], essaiGratuit: false })).toMatchObject({ genre: "confirmer" });
    expect(decisionLancement({ ...base, double: true, manques: [], essaiGratuit: true, manquesAcceptes: true })).toMatchObject({ genre: "confirmer" });
  });

  it("l'Aperçu dit si l'essai est gratuit (moteur d'essai, rien de réel payé)", async () => {
    await ecrireParametre("afficherExemples", false);
    const scriptId = await scripts.enregistrerScript({ formatId: "avocat", sujet: "Cinquante-trois mots", blocs: blocs53() });
    const videoId = await videos.creerBrouillon("avocat", { scriptId });
    const a = await fabrication.apercuFabrication(videoId);
    expect(a.essaiGratuit).toBe(true);
    expect(a.estimation.total.centimes).toBeGreaterThan(0);
    expect(a.budget.montageReel).toBe(false);
  });
});

describe("U7 — l'écran « Je fabrique votre vidéo » suit la vidéo jusqu'au bout", () => {
  async function videoFabriquee(): Promise<{ videoId: string; travailId: string }> {
    const scriptId = await scripts.enregistrerScript({ formatId: "avocat", sujet: "Cinquante-trois mots", blocs: blocs53() });
    const videoId = await videos.creerBrouillon("avocat", { scriptId });
    const { travailId } = await fabrication.lancerFabrication(videoId, { confirme: 1_000_000 });
    return { videoId, travailId };
  }

  it("terminée depuis plus de 2 minutes, sans identifiant de travail : la dernière fabrication est encore servie", async () => {
    const { videoId, travailId } = await videoFabriquee();
    const ilYA = new Date(Date.now() - 10 * 60_000).toISOString();
    await depots().travaux.modifier(travailId, { statut: "termine", progression: 100, termineLe: ilYA });
    const { GET } = await import("@/app/api/travaux/route");
    const { NextRequest } = await import("next/server");
    // Avant : sans identifiant, seule la liste « en cours » (où un travail fini depuis 2 min n'est plus) → blocs gris.
    const r = await GET(new NextRequest(`http://localhost/api/travaux?video=${videoId}`));
    const { travaux } = (await r.json()) as { travaux: { id: string; statut: string }[] };
    expect(travaux.map((t) => [t.id, t.statut])).toEqual([[travailId, "termine"]]);
  });

  it("l'écran montre la fabrication la plus récente (un ancien identifiant ne cache pas la nouvelle)", async () => {
    const { travailAffiche, adresseTravaux } = await import("@/hooks/useTravaux");
    const vieux = { id: "trav-vieux", cibleId: "v-1", type: "fabrication", creeLe: "2026-10-04T08:00:00.000Z" };
    const neuf = { id: "trav-neuf", cibleId: "v-1", type: "fabrication", creeLe: "2026-10-04T09:00:00.000Z" };
    const autre = { id: "trav-autre", cibleId: "v-2", type: "fabrication", creeLe: "2026-10-04T10:00:00.000Z" };
    const liste = [vieux, neuf, autre] as unknown as Parameters<typeof travailAffiche>[0];
    expect(travailAffiche(liste, "trav-vieux", "v-1")?.id).toBe("trav-neuf");
    expect(travailAffiche(liste, undefined, "v-1")?.id).toBe("trav-neuf");
    expect(travailAffiche(liste, undefined, "v-3")).toBeUndefined();
    expect(adresseTravaux("trav-1", "v-1")).toBe("/api/travaux?id=trav-1&video=v-1");
    expect(adresseTravaux(undefined, undefined)).toBe("/api/travaux");
  });

  it("rien à suivre : plus de blocs gris, « Voir ma vidéo »", async () => {
    vi.doMock("@/app/(studio)/actions", () => ({ reessayerTravailAction: async () => ({ ok: true }) }));
    const { SansSuivi } = await import("@/assistant/etapes/Fabrication");
    const html = renderToStaticMarkup(createElement(SansSuivi, { videoId: "v-1" }));
    expect(html).toContain("Voir ma vidéo");
    expect(html).toContain('href="/videos/v-1"');
    expect(html).not.toContain("aria-busy");
  });
});

describe("U8 — vidéo d'essai : la feuille Buffer le dit tout de suite et ne propose pas l'envoi", () => {
  async function videoPrete(): Promise<string> {
    const v = (await depots().videos.lister((x) => x.statut === "prete" && !!x.versionChoisieId))[0]!;
    // Vidéo de Will (pas un exemple), sortie du moteur d'essai : une vidéo de démonstration.
    await depots().videos.modifier(v.id, { estDemo: false });
    for (const ver of await depots().versions.lister((x) => x.videoId === v.id)) await depots().versions.modifier(ver.id, { commande: { ...ver.commande, moteurId: "simulation" } });
    return v.id;
  }

  it("le kit d'une vidéo d'essai le dit (même règle que le refus du serveur) ; une vraie vidéo non", async () => {
    const { obtenirKit } = await import("@/services/publications");
    const { exemplesCommeVraies } = await import("./helpers/videos-reelles");
    const id = await videoPrete();
    expect((await obtenirKit(id))?.videoEssai).toBe(true);
    await exemplesCommeVraies(depots(), { videos: [id], plusExemples: true });
    expect((await obtenirKit(id))?.videoEssai).toBe(false);
  });

  it("la feuille ne propose pas l'envoi et dit « Vidéo d'essai : elle ne part pas sur vos réseaux »", async () => {
    vi.doMock("@/app/(studio)/videos/actions", () => ({ envoyerVersBufferAction: async () => ({ ok: true }), noterPublicationManuelleAction: async () => ({ ok: true }) }));
    const { AvisVideoEssai, envoiPropose, PHRASE_VIDEO_ESSAI } = await import("@/components/publication/FeuilleEnvoyerBuffer");
    expect(envoiPropose({ videoEssai: true })).toBe(false);
    expect(envoiPropose({ videoEssai: false })).toBe(true);
    expect(envoiPropose(null)).toBe(false);
    const t = renderToStaticMarkup(createElement(AvisVideoEssai)).replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'");
    expect(PHRASE_VIDEO_ESSAI).toBe("Vidéo d'essai : elle ne part pas sur vos réseaux.");
    expect(t).toContain(PHRASE_VIDEO_ESSAI);
    expect(t).not.toMatch(/\bIA\b|\btu\b|\bton\b/);
  });
});

describe("U9 — Mes vidéos : compteurs cohérents avec deux brouillons type avocat", () => {
  it("« Toutes 2 », « Brouillons 2 », « Type avocat 2 » ; l'onglet « Toutes » montre ce qu'il compte", async () => {
    const { compteursMesVideos, videosDeToutes } = await import("@/domaine/mes-videos");
    const { listerFormats } = await import("@/formats");
    await ecrireParametre("afficherExemples", false);
    await videos.creerBrouillon("avocat");
    await videos.creerBrouillon("avocat");
    const toutes = await videos.listerVideos({ inclureArchivees: true });
    const c = compteursMesVideos(toutes, listerFormats().map((f) => f.id));
    expect(c).toMatchObject({ toutes: 2, brouillons: 2, archivees: 0 });
    expect(c.parFormat.avocat).toBe(2);
    expect(videosDeToutes(toutes)).toHaveLength(c.toutes);
    // Une archivée sort de « Toutes » et de son format, rien n'est effacé.
    const a = toutes[0]!;
    await depots().videos.modifier(a.id, { statut: "archivee" });
    const apres = compteursMesVideos(await videos.listerVideos({ inclureArchivees: true }), ["avocat"]);
    expect(apres).toMatchObject({ toutes: 1, brouillons: 1, archivees: 1, parFormat: { avocat: 1 } });
    expect(await depots().videos.obtenir(a.id)).toBeTruthy();
  });
});
