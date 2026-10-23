/**
 * RELIRE LE SCRIPT AVANT LA VIDÉO, brique 6 sur 8 : l'ASSISTANT « Votre vidéo » (avocat, face caméra avatar).
 * - adaptateur pur : blocs → lignes, différences → blocs, empreinte identique côté client et côté serveur ;
 * - serveur : un lancement de l'assistant exige le repère « script relu » (empreinte du texte qui sera fabriqué) ;
 *   les autres lancements (formats, lots, reprises) ne changent pas, et la vidéo « en attente de crédit » reprend le
 *   repère déjà donné ;
 * - contrôles réels, gratuits, session exigée ; barème « will » pour les phrases modifiées ;
 * - écran : « Fabriquer » ouvre TOUJOURS la relecture, même sous le seuil.
 * Aucun appel réel : moteur simulé, lecteurs de crédit injectés.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const credits = await import("@/services/credits");
const relecture = await import("@/domaine/relecture-assistant");
const { scriptReluDe, appliquerSaisie, empreinte } = await import("@/domaine/relecture-script");
const service = await import("@/services/relecture-assistant");
const actions = await import("@/app/(studio)/nouvelle/[format]/actions");
const logique = await import("@/assistant/express/logique");
const { RelectureAssistant } = await import("@/assistant/express/RelectureAssistant");
const express = await import("@/services/express");
const { obtenirFormat } = await import("@/formats");

import type { BlocScript, Distribution } from "@/domaine/types";

const MDP_TEST = "essai-relire-assistant";

beforeAll(async () => {
  process.env.SESSION_SECRET = "r".repeat(48);
  const empreinteMdp = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinteMdp).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP_TEST, false);
});

afterEach(() => credits.injecterLecteursPourEssai(null));

const bloc = (id: string, recette: string, ...textes: (string | { texte: string; titreEcran?: string })[]): BlocScript => ({
  id,
  blocRecette: recette,
  segments: textes.map((t, i) => ({ id: `${id}-${i}`, ...(typeof t === "string" ? { texte: t } : t) })),
});

const BLOCS: BlocScript[] = [
  bloc("a", "accroche", "Votre patron peut-il lire vos mails ?"),
  bloc("b", "explication", { texte: "Un mail du travail est présumé professionnel.", titreEcran: "*PRO* PAR DÉFAUT" }, "Sauf s'il porte la mention personnel."),
];

/** Le script de la vidéo, tel qu'en base. */
async function blocsDe(videoId: string): Promise<BlocScript[]> {
  const v = await depots().videos.obtenir(videoId);
  return (await depots().scripts.obtenir(v!.scriptId!))!.blocs;
}

/* ------------------------------------------------------------------ */
describe("adaptateur de l'assistant (pur)", () => {
  it("une ligne par phrase, groupée par bloc, le titre à l'écran modifiable", () => {
    const lignes = relecture.lignesDesBlocs(BLOCS, (id) => ({ accroche: "Accroche", explication: "Explication" })[id]);
    expect(lignes).toEqual([
      { id: "a/a-0", dit: "Votre patron peut-il lire vos mails ?", groupe: "Accroche" },
      { id: "b/b-0", dit: "Un mail du travail est présumé professionnel.", groupe: "Explication", ecrits: [{ texte: "*PRO* PAR DÉFAUT", modifiable: true }] },
      { id: "b/b-1", dit: "Sauf s'il porte la mention personnel.", groupe: "Explication" },
    ]);
  });

  it("les seules différences reviennent dans les blocs ; l'empreinte du serveur est celle de l'écran", () => {
    const avant = relecture.lignesDesBlocs(BLOCS);
    let apres = appliquerSaisie(avant, "b/b-1", { dit: "Sauf s'il porte la mention « personnel »." });
    apres = appliquerSaisie(apres, "b/b-0", { ecrit: { index: 0, texte: "*PRO* D'OFFICE" } });
    const s = scriptReluDe(avant, apres);
    const r = relecture.blocsDepuisModifications(BLOCS, s.modifications);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.blocs[1].segments[1].texte).toBe("Sauf s'il porte la mention « personnel ».");
    expect(r.blocs[1].segments[0].titreEcran).toBe("*PRO* D'OFFICE");
    expect(r.blocs[0]).toBe(BLOCS[0]); // bloc inchangé : même objet
    expect(relecture.empreinteDesBlocs(r.blocs)).toBe(s.empreinte);
    expect(relecture.empreinteDesBlocs(BLOCS)).not.toBe(s.empreinte);
  });

  it("une phrase vidée ou inconnue est refusée", () => {
    expect(relecture.blocsDepuisModifications(BLOCS, [{ id: "a/a-0", dit: "  " }])).toEqual({ ok: false, raisons: ["La phrase 1 est vide."] });
    expect(relecture.blocsDepuisModifications(BLOCS, [{ id: "z/z-0", dit: "Bonjour." }]).ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
describe("serveur : repère « script relu » exigé pour l'assistant", () => {
  it("sans repère, avec un repère faux ou périmé : refus clair, rien ne part", async () => {
    const avant = await depots().travaux.compter();
    await expect(fabrication.lancerFabrication("v-03", { confirme: true, exigerScriptRelu: true })).rejects.toMatchObject({ code: "SCRIPT_NON_RELU" });
    await expect(fabrication.lancerFabrication("v-03", { confirme: true, exigerScriptRelu: true, scriptRelu: "relu-faux" })).rejects.toMatchObject({ code: "SCRIPT_NON_RELU" });
    const relu = relecture.empreinteDesBlocs(await blocsDe("v-03"));
    // Le texte change après la relecture : le repère tombe.
    const v = await depots().videos.obtenir("v-03");
    const blocs = await blocsDe("v-03");
    await depots().scripts.modifier(v!.scriptId!, { blocs: [{ ...blocs[0], segments: [{ ...blocs[0].segments[0], texte: "Un autre texte, jamais relu." }, ...blocs[0].segments.slice(1)] }, ...blocs.slice(1)] });
    await expect(fabrication.lancerFabrication("v-03", { confirme: true, exigerScriptRelu: true, scriptRelu: relu })).rejects.toMatchObject({ code: "SCRIPT_NON_RELU" });
    expect(await depots().travaux.compter()).toBe(avant);
    expect(await depots().reservations.compter((r) => r.videoId === "v-03")).toBe(0);
  });

  it("avec l'empreinte du texte relu : la vidéo part", async () => {
    const relu = relecture.empreinteDesBlocs(await blocsDe("v-03"));
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true, exigerScriptRelu: true, scriptRelu: relu });
    expect(travailId).toBeTruthy();
  });

  it("les autres lancements (formats, lots, reprises) n'exigent rien : inchangés", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    expect(travailId).toBeTruthy();
  });

  it("l'action de l'assistant exige le repère ; avec lui, la vidéo part", async () => {
    const sans = await actions.lancerFabricationAction("v-03", true);
    expect(sans).toMatchObject({ ok: false, code: "SCRIPT_NON_RELU" });
    const relu = relecture.empreinteDesBlocs(await blocsDe("v-03"));
    const avec = await actions.lancerFabricationAction("v-03", true, relu);
    expect(avec.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("relance après la recharge : le repère déjà donné est repris", () => {
  it("gardée avec son repère, elle part après la recharge", async () => {
    const relu = relecture.empreinteDesBlocs(await blocsDe("v-04"));
    await depots().videos.modifier("v-04", { statut: "brouillon" });
    await credits.garderEnAttente("v-04", { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, scriptRelu: relu });
    expect((await depots().videos.obtenir("v-04"))!.lancementEnAttente).toMatchObject({ scriptRelu: relu });
    const { lancees } = await credits.lancerVideosEnAttente();
    expect(lancees).toHaveLength(1);
  });

  it("le texte a changé depuis : elle ne part pas, Will est prévenu", async () => {
    const relu = relecture.empreinteDesBlocs(await blocsDe("v-04"));
    await depots().videos.modifier("v-04", { statut: "brouillon" });
    await credits.garderEnAttente("v-04", { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, scriptRelu: relu });
    const v = await depots().videos.obtenir("v-04");
    const blocs = await blocsDe("v-04");
    await depots().scripts.modifier(v!.scriptId!, { blocs: [{ ...blocs[0], segments: [{ ...blocs[0].segments[0], texte: "Changé après la relecture." }, ...blocs[0].segments.slice(1)] }, ...blocs.slice(1)] });
    expect(await credits.lancerVideosEnAttente()).toEqual({ lancees: [] });
    expect((await depots().videos.obtenir("v-04"))!.lancementEnAttente).toBeUndefined();
    expect(await depots().notifications.trouver((n) => n.titre.includes("n'a pas pu partir"))).toBeTruthy();
  });

  it("une attente sans repère sur une vidéo qui n'exige pas de relecture part comme avant", async () => {
    await depots().videos.modifier("v-04", { statut: "brouillon", formatId: "facecam", distribution: [{ role: "Face caméra", personnageId: "p-will", source: "rush", rushIds: ["rush-1"] }] });
    expect(await fabrication.relectureExigee("v-04")).toBe(false);
    await credits.garderEnAttente("v-04", { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true });
    await credits.lancerVideosEnAttente();
    // Aucun refus « script relu » : seul le serveur de montage face caméra (non relié en test) répond.
    expect(await depots().notifications.trouver((n) => !!n.message?.includes("relecture"))).toBeFalsy();
  });

  it("mise en attente sans repère (rush), passée ensuite en voix de synthèse : elle ne part pas sans relecture", async () => {
    await depots().videos.modifier("v-04", { statut: "brouillon", distribution: [{ role: "Face caméra", personnageId: "p-will", source: "rush", rushIds: ["rush-1"] }] });
    await credits.garderEnAttente("v-04", { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true });
    await depots().videos.modifier("v-04", { distribution: [{ role: "Face caméra", personnageId: "p-will", source: "double", visageId: "vis-will-face", voixId: "voix-will" }] });
    const avant = await depots().travaux.compter();
    expect(await credits.lancerVideosEnAttente()).toEqual({ lancees: [] });
    expect(await depots().travaux.compter()).toBe(avant);
    expect((await depots().videos.obtenir("v-04"))!.lancementEnAttente).toBeUndefined();
    expect(await depots().notifications.trouver((n) => n.titre.includes("n'a pas pu partir") && !!n.message?.includes("relecture"))).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
describe("contrôles réels en direct (gratuits, session exigée)", () => {
  const TU: BlocScript[] = [bloc("a", "accroche", "Ton patron peut-il lire vos mails ?"), bloc("b", "explication", "Un mail du travail est présumé professionnel.")];

  it("au barème « machine », une phrase non modifiée bloque ; modifiée par Will, elle n'est plus qu'une alerte", async () => {
    const avant = relecture.lignesDesBlocs(TU);
    const machine = await service.controlerScriptAssistant({ formatId: "avocat", blocs: TU, script: scriptReluDe(avant, avant), adresse: "vous" });
    expect(machine).toContainEqual(expect.objectContaining({ ligneId: "a/a-0", code: "C4", niveau: "bloquant" }));
    const parWill = appliquerSaisie(avant, "a/a-0", { dit: "Ton patron peut-il lire tes mails ?" });
    const will = await service.controlerScriptAssistant({ formatId: "avocat", blocs: TU, script: scriptReluDe(avant, parWill), adresse: "vous" });
    expect(will).toContainEqual(expect.objectContaining({ ligneId: "a/a-0", code: "C4", niveau: "alerte" }));
    expect(will.some((p) => p.niveau === "bloquant")).toBe(false);
    // Phrases simples, sans code ni jargon.
    for (const p of [...machine, ...will]) expect(p.texte).not.toMatch(/\bC\d+\b/);
  });

  it("une phrase vidée bloque", async () => {
    const avant = relecture.lignesDesBlocs(BLOCS);
    const vide = appliquerSaisie(avant, "b/b-1", { dit: "" });
    const p = await service.controlerScriptAssistant({ formatId: "avocat", blocs: BLOCS, script: scriptReluDe(avant, vide), adresse: "vous" });
    expect(p).toContainEqual(expect.objectContaining({ ligneId: "b/b-1", niveau: "bloquant" }));
  });

  it("l'action exige la session", async () => {
    const avant = relecture.lignesDesBlocs(BLOCS);
    const s = scriptReluDe(avant, avant);
    expect((await actions.controlerScriptReluAction("avocat", BLOCS, s.modifications, "vous")).ok).toBe(true);
    reinitialiserRequete();
    await expect(actions.controlerScriptReluAction("avocat", BLOCS, s.modifications, "vous")).rejects.toThrow();
  });
});

/* ------------------------------------------------------------------ */
describe("écran « Votre vidéo » : « Fabriquer » ouvre la relecture", () => {
  it("même sous le seuil et sans rien à vérifier, la vidéo ne part plus sans relecture", () => {
    const sous = logique.decisionLancement({ coutCentimes: 50, seuilCentimes: 500, resteCentimes: 10_000, aVerifier: [] });
    expect(logique.ouvreLaRelecture(sous, true)).toBe(true);
    const cher = logique.decisionLancement({ coutCentimes: 900, seuilCentimes: 500, resteCentimes: 10_000, aVerifier: [] });
    expect(logique.ouvreLaRelecture(cher, true)).toBe(true);
    const budget = logique.decisionLancement({ coutCentimes: 900, seuilCentimes: 500, resteCentimes: 100, aVerifier: [] });
    expect(logique.ouvreLaRelecture(budget, true)).toBe(false);
  });

  it("la relecture montre les phrases, les raisons à vérifier et « Lancer la vidéo (≈ prix) »", () => {
    const html = renderToStaticMarkup(
      createElement(RelectureAssistant, { formatId: "avocat", blocs: BLOCS, adresse: "vous", prixCentimes: 420, raisons: ["Plus cher que d'habitude"], debit: 2.8, controler: async () => [], lancer: async () => ({ ok: true as const }), fermer: () => {} }),
    );
    const vu = html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
    expect(vu).toContain("Relire le script");
    expect(vu).toContain("Votre patron peut-il lire vos mails ?");
    expect(vu).toContain("Plus cher que d'habitude");
    expect(vu).toContain("Lancer la vidéo (≈ 4,20 €)");
    expect(html.match(/aria-label="Modifier la phrase \d+"/g)).toHaveLength(3);
  });

  it("format sans prix : aucun montant montré", () => {
    const html = renderToStaticMarkup(createElement(RelectureAssistant, { formatId: "facecam", blocs: BLOCS, adresse: "vous", raisons: [], controler: async () => [], lancer: async () => ({ ok: true as const }), fermer: () => {} }));
    expect(html).toContain("Lancer la vidéo");
    expect(html).not.toContain("€");
  });

  it("l'empreinte ne dépend que du texte (pas des parties)", () => {
    const a = relecture.lignesDesBlocs(BLOCS, () => "X");
    expect(empreinte(a)).toBe(relecture.empreinteDesBlocs(BLOCS));
  });
});

/* ------------------------------------------------------------------ */
describe("vidéo déjà filmée (source « rush ») : aucune relecture exigée", () => {
  const RUSH: Distribution[] = [{ role: "Face caméra", personnageId: "p-will", source: "rush", rushIds: ["rush-1"] }];
  const DOUBLE: Distribution[] = [{ role: "Face caméra", personnageId: "p-will", source: "double", visageId: "vis-will-face", voixId: "voix-will" }];
  const VOIX: Distribution[] = [{ role: "voix", personnageId: "p-will", source: "double", voixId: "voix-will" }];

  it("seule une voix de synthèse (source « double ») exige la relecture", () => {
    expect(relecture.relectureAExiger(obtenirFormat("avocat"), DOUBLE)).toBe(true);
    // Avocat en « rush » sans prises filmées : le moteur fait quand même la voix de synthèse à partir du texte.
    expect(relecture.relectureAExiger(obtenirFormat("avocat"), RUSH)).toBe(true);
    expect(relecture.relectureAExiger(obtenirFormat("avocat"), RUSH, true)).toBe(false);
    expect(relecture.relectureAExiger(obtenirFormat("facecam"), RUSH)).toBe(false);
    expect(relecture.relectureAExiger(obtenirFormat("facecam-animee"), RUSH)).toBe(false);
    expect(relecture.relectureAExiger(obtenirFormat("facecam"), [])).toBe(false);
    // Les formats dits par une voix de synthèse : inchangés (relecture exigée).
    for (const f of ["tableau-anime", "cas-concret", "image-video"]) {
      expect(relecture.relectureAExiger(obtenirFormat(f), VOIX)).toBe(true);
      expect(relecture.relectureAExiger(obtenirFormat(f), [])).toBe(true);
      // Une source que le format ne permet pas (appel direct, ancienne donnée) n'est pas crue.
      expect(relecture.relectureAExiger(obtenirFormat(f), [{ source: "rush" }])).toBe(true);
    }
    // Hors écran « Votre vidéo » : rien d'exigé (comme master).
    expect(relecture.relectureAExiger(obtenirFormat("podcast"), DOUBLE)).toBe(false);
  });

  it("face caméra filmée : « Fabriquer » n'ouvre pas la relecture", () => {
    const sous = logique.decisionLancement({ coutCentimes: 50, seuilCentimes: 500, resteCentimes: 10_000, aVerifier: [] });
    expect(logique.ouvreLaRelecture(sous, false)).toBe(false);
    expect(logique.ouvreLaRelecture(sous, true)).toBe(true);
  });

  it("face caméra filmée (« Je vous explique… », C40) : la vidéo part sans repère", async () => {
    await depots().videos.modifier("v-03", { formatId: "facecam", distribution: RUSH });
    const v = await depots().videos.obtenir("v-03");
    const blocs = await blocsDe("v-03");
    await depots().scripts.modifier(v!.scriptId!, { blocs: [{ ...blocs[0], segments: [{ ...blocs[0].segments[0], texte: "Je vous explique pourquoi." }, ...blocs[0].segments.slice(1)] }, ...blocs.slice(1)] });
    expect(await fabrication.relectureExigee("v-03")).toBe(false);
    const r = await actions.lancerFabricationAction("v-03", true);
    // Rien ne bloque côté relecture : seul le serveur de montage face caméra (non relié en test) répond.
    expect(r).not.toMatchObject({ code: "SCRIPT_NON_RELU" });
    expect(r).toMatchObject({ ok: false, code: "FACECAM_EN_CHANTIER" });
  });

  it("avocat avec le double : repère exigé", async () => {
    await depots().videos.modifier("v-03", { distribution: DOUBLE });
    expect(await fabrication.relectureExigee("v-03")).toBe(true);
    expect(await actions.lancerFabricationAction("v-03", true)).toMatchObject({ ok: false, code: "SCRIPT_NON_RELU" });
  });

  it("avocat en « rush » avec une voix mais sans prises filmées : voix de synthèse, repère exigé", async () => {
    await depots().videos.modifier("v-03", { distribution: [{ ...RUSH[0], voixId: "voix-will" }] });
    expect(await fabrication.relectureExigee("v-03")).toBe(true);
    const avant = await depots().travaux.compter();
    expect(await actions.lancerFabricationAction("v-03", true)).toMatchObject({ ok: false, code: "SCRIPT_NON_RELU" });
    expect(await depots().travaux.compter()).toBe(avant);
    // Relu : la vidéo part.
    const relu = relecture.empreinteDesBlocs(await blocsDe("v-03"));
    expect((await actions.lancerFabricationAction("v-03", true, relu)).ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("flèche retour de la relecture : les phrases retouchées sont gardées", () => {
  it("la saisie gardée est reprise au prochain « Fabriquer » (même texte de départ)", () => {
    const avant = relecture.lignesDesBlocs(BLOCS);
    const s = scriptReluDe(avant, appliquerSaisie(avant, "b/b-1", { dit: "Sauf mention « personnel »." }));
    const gardee = { blocs: BLOCS, modifications: s.modifications };
    expect(relecture.saisieAReprendre(BLOCS, gardee)).toEqual(s.modifications);
    expect(relecture.saisieAReprendre(BLOCS, null)).toEqual([]);
    // Le texte a changé ailleurs entre-temps et la phrase n'existe plus : rien n'est repris de travers.
    expect(relecture.saisieAReprendre([BLOCS[0]], gardee)).toEqual([]);
  });

  it("A → A' gardé, puis B écrit dans la feuille Script : la relecture affiche B (la correction la plus récente)", () => {
    const avant = relecture.lignesDesBlocs(BLOCS);
    const s = scriptReluDe(avant, appliquerSaisie(avant, "b/b-1", { dit: "A prime, retouchée en relecture." }));
    const gardee = { blocs: BLOCS, modifications: s.modifications };
    const avecB: BlocScript[] = [BLOCS[0], { ...BLOCS[1], segments: [BLOCS[1].segments[0], { ...BLOCS[1].segments[1], texte: "B, écrite dans la feuille Script." }] }];
    const reprises = relecture.saisieAReprendre(avecB, gardee);
    expect(reprises).toEqual([]);
    const html = renderToStaticMarkup(
      createElement(RelectureAssistant, { formatId: "avocat", blocs: avecB, modifications: reprises, adresse: "vous", raisons: [], controler: async () => [], lancer: async () => ({ ok: true as const }), fermer: () => {} }),
    );
    const vu = html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
    expect(vu).toContain("B, écrite dans la feuille Script.");
    expect(vu).not.toContain("A prime, retouchée en relecture.");
    // Une autre phrase retouchée, elle, n'a pas bougé entre-temps : elle est reprise.
    const deux = scriptReluDe(avant, appliquerSaisie(appliquerSaisie(avant, "b/b-1", { dit: "A prime." }), "a/a-0", { dit: "Accroche retouchée ?" }));
    expect(relecture.saisieAReprendre(avecB, { blocs: BLOCS, modifications: deux.modifications }).map((m) => m.id)).toEqual(["a/a-0"]);
    // Le titre à l'écran changé ailleurs compte aussi.
    const titre: BlocScript[] = [{ ...BLOCS[0], segments: [{ ...BLOCS[0].segments[0], titreEcran: undefined }] }, { ...BLOCS[1], segments: [{ ...BLOCS[1].segments[0], titreEcran: "AUTRE TITRE" }, BLOCS[1].segments[1]] }];
    const surTitre = scriptReluDe(avant, appliquerSaisie(avant, "b/b-0", { dit: "Phrase retouchée." }));
    expect(relecture.saisieAReprendre(titre, { blocs: BLOCS, modifications: surTitre.modifications })).toEqual([]);
  });

  it("rouverte, la relecture montre les phrases retouchées (toujours comptées comme modifiées)", () => {
    const avant = relecture.lignesDesBlocs(BLOCS);
    const s = scriptReluDe(avant, appliquerSaisie(avant, "b/b-1", { dit: "Sauf mention « personnel »." }));
    const html = renderToStaticMarkup(
      createElement(RelectureAssistant, { formatId: "avocat", blocs: BLOCS, modifications: s.modifications, adresse: "vous", raisons: [], controler: async () => [], lancer: async () => ({ ok: true as const }), fermer: () => {} }),
    );
    const vu = html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
    expect(vu).toContain("Sauf mention « personnel ».");
    expect(vu).not.toContain("Sauf s'il porte la mention personnel.");
    // Barème « will » et « Annuler mes modifications » : la phrase reste une phrase modifiée par Will.
    expect(vu).toContain("1 modifiée");
    expect(html).toContain('aria-label="Annuler mes modifications"');
  });
});

/* ------------------------------------------------------------------ */
describe("relire, modifier, enregistrer le brouillon, lancer", () => {
  it("la phrase modifiée est enregistrée puis lancée : même empreinte, pas de SCRIPT_NON_RELU", async () => {
    const blocs = await blocsDe("v-03");
    const avant = relecture.lignesDesBlocs(blocs);
    const premiere = avant[0];
    const s = scriptReluDe(avant, appliquerSaisie(avant, premiere.id, { dit: "Une phrase retouchée pendant la relecture." }));
    expect(s.modifications).toHaveLength(1);
    // Ce que fait l'écran : les différences reportées dans les blocs, puis l'enregistrement du brouillon.
    const relu = relecture.blocsDepuisModifications(blocs, s.modifications);
    expect(relu.ok).toBe(true);
    if (!relu.ok) return;
    await express.enregistrerBrouillonExpress("v-03", {}, relu.blocs);
    const enBase = await blocsDe("v-03");
    expect(enBase.flatMap((b) => b.segments.map((x) => x.texte))).toContain("Une phrase retouchée pendant la relecture.");
    expect(relecture.empreinteDesBlocs(enBase)).toBe(s.empreinte);
    const r = await actions.lancerFabricationAction("v-03", true, s.empreinte);
    expect(r).not.toMatchObject({ code: "SCRIPT_NON_RELU" });
    expect(r.ok).toBe(true);
  });
});
