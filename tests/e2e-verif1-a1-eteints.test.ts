/**
 * VÉRIFICATEUR E2E n° 1 (parcours A, première moitié) — lettre a1 — CONFIG DE PRODUCTION, INTERRUPTEURS ÉTEINTS.
 *
 * Will part d'une IDÉE (Écrire › Idées), le GÉNÉRATEUR écrit le script avec Claude (FOURNISSEUR_SCRIPT=claude, doublé),
 * Will valide la version avocat puis touche « Fabriquer ». « Votre avatar parle » et « Montage réel » sont ÉTEINTS.
 * Question : que reçoit Will ? (vidéo d'essai annoncée, ou vidéo simulée présentée comme vraie ; argent dépensé ?)
 *
 * Toutes les variables de production sont posées (valeurs factices) AVANT le chargement des modules (le registre des
 * fournisseurs se construit au chargement) ; les réglages « en base » sont écrits comme en production. Un seul `fetch`
 * global doublé : toute adresse inattendue fait échouer le test. Claude passe par son injection d'essai (rôles
 * simulés renvoyés comme des réponses de l'API). AUCUN appel réel, AUCUNE vraie clé.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import type { DefinitionRole } from "@/generateur/roles/types";
import type { LecteurCredit } from "@/fournisseurs/types";

// --- Variables de PRODUCTION (factices), comme deploiement/docker-compose.yml les transmet. ---
Object.assign(process.env, {
  HEYGEN_API_KEY: "cle-heygen-essai-a1",
  ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE,
  FAL_KEY: "cle-fal-essai-a1",
  PEXELS_API_KEY: "cle-pexels-essai-a1",
  PIXABAY_API_KEY: "cle-pixabay-essai-a1",
  BUFFER_API_KEY: "cle-buffer-essai-a1",
  R2_ACCOUNT_ID: "compte-essai",
  R2_ACCESS_KEY_ID: "ACCES-ESSAI",
  R2_SECRET_ACCESS_KEY: "secret-essai",
  R2_BUCKET: "seau-essai",
  VAPID_PUBLIQUE: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  VAPID_PRIVEE: "UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls",
  VAPID_SUJET: "mailto:essai@exemple.fr",
  FOURNISSEUR_VISAGE: "heygen",
  FOURNISSEUR_MONTAGE: "studio-rendu",
  FOURNISSEUR_VOIX: "heygen",
  FOURNISSEUR_SCRIPT: "claude",
  FOURNISSEUR_ILLUSTRATION: "reel",
  FOURNISSEUR_STOCKAGE: "r2",
  FOURNISSEUR_NOTIFICATION: "web-push-email",
  FOURNISSEUR_ALIGNEMENT: "studio-aligneur",
  STUDIO_RENDU_URL: "http://studio-rendu.essai",
  STUDIO_RENDU_CLE: "cle-rendu-essai",
  STUDIO_ALIGNEUR_URL: "http://studio-aligneur.essai",
});

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Garde-fous budget : crochet d'essai du pire cas de la chaîne (module de test, plus dans le code de production).
vi.mock("@/generateur/pire-cas", async (orig) => (await import("./helpers/pire-cas-essai")).pireCasInjectable(await orig()));
import { injecterPireCasChainePourEssai } from "./helpers/pire-cas-essai";

/* ------------------------------------------------------------------ */
/* Le réseau doublé (un seul fetch global)                              */
/* ------------------------------------------------------------------ */

const R = { appels: [] as { hote: string; methode: string; chemin: string }[] };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const methode = init?.method ?? "GET";
  R.appels.push({ hote: u.hostname, methode, chemin: u.pathname });
  // Banques gratuites : aucune vidéo trouvée (la cascade passe au plan suivant).
  if (u.hostname === "api.pexels.com") return json({ videos: [] });
  if (u.hostname === "pixabay.com") return json({ hits: [] });
  if (u.hostname.endsWith("r2.cloudflarestorage.com")) {
    if (methode === "PUT") return new Response("", { status: 200 });
    return new Response(new Uint8Array(16), { status: 200, headers: { "content-length": "16" } });
  }
  // Services payants : enregistrés pour être comptés (aucun ne doit partir), puis refusés.
  if (u.hostname === "api.heygen.com" || u.hostname === "queue.fal.run" || u.hostname === "studio-rendu.essai" || u.hostname === "studio-aligneur.essai") return json({ error: "inattendu dans ce test" }, 500);
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}

const appelsPayants = () => R.appels.filter((a) => ["api.heygen.com", "queue.fal.run", "studio-rendu.essai", "studio-aligneur.essai"].includes(a.hote));

// Le stockage R2 garde le `fetch` du moment de sa création (src/fournisseurs/r2/stockage.ts:85) : doublé AVANT les
// imports, sinon ses lectures et effacements partiraient sur le vrai réseau.
vi.stubGlobal("fetch", (u: string | URL | Request, i?: RequestInit) => reseau(u, i));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const idees = await import("@/services/idees");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const reglages = await import("@/services/reglages");
const renduDouble = await import("@/services/rendu-double");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const travaux = await import("@/services/travaux");
const scripts = await import("@/services/scripts");
const videos = await import("@/services/videos");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { resoudreFournisseur, etatConnexion } = await import("@/fournisseurs");
const { centimes } = await import("@/lib/montants");

const MDP = "essai-e2e-verif1-a1-eteints";
const SUJET = SUJETS_BANC[0];

/** Faux Claude : reconnaît le rôle par sa consigne et répond par la sortie de sa simulation (modèle g4-service). */
const claude = { appels: {} as Record<string, number> };
function fauxClaude(): typeof fetch {
  const roles = Object.values(ROLES_ECRITURE) as DefinitionRole[];
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { system: { text: string }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = roles.find((r) => consigne.startsWith(r.consigne.trim()));
    if (!role) throw new Error("Rôle Claude inattendu");
    claude.appels[role.id] = (claude.appels[role.id] ?? 0) + 1;
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: role.modele, entree: 2500, cacheEcrit: 1000, sortie: 1500 }));
  }) as typeof fetch;
}

function lecteurHeygen(solde: number): LecteurCredit {
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  // Garde-fous budget (15/10) : ce parcours ne porte pas sur le pire cas de la chaîne (testé dans garde-fous-budget).
  injecterPireCasChainePourEssai(0);
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  R.appels = [];
  claude.appels = {};
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  await ecrireParametre("generateur.chaine", "complete");
  for (const m of SUJET.matieres) await depots().matieres.enregistrer(m);
  for (const p of SUJET.preuves) await depots().preuves.enregistrer(p);
  // Réglages posés EN BASE en production.
  await ecrireParametre("fournisseur.publication", "buffer");
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await ecrireParametre("fournisseur.miniature", "studio-rendu");
  await ecrireParametre("fournisseur.etalonnage", "studio-rendu");
  await ecrireParametre("fournisseur.son", "studio-rendu");
  await ecrireParametre("budget.seuilConfirmation", centimes(1_000_000));
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch), lecteurHeygen(1_000_000)], ["anthropic", "heygen"]);
  await credits.declarerRecharge("anthropic", 500);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fauxClaude(), attenteMs: () => 0 });
  // Les fabrications d'exemple en cours ne gênent pas.
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  credits.injecterLecteursPourEssai(null);
  injecterPireCasChainePourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Idée → écran Sujet (idée reprise) → écriture par Claude → version avocat validée. */
async function ideeJusquAVersionValidee() {
  const idee = await idees.ajouterIdee(SUJET.idee, "avocat");
  const r = await bg.lancerGeneration({ idee: idee.texte, ideeId: idee.id, reseaux: SUJET.reseaux, formatId: "avocat", pilier: SUJET.pilier.id, mode: "avatar" });
  if (!r.ok) throw new Error(`lancement refusé : ${JSON.stringify(r)}`);
  await bg.tourBoucleGeneration();
  const g = (await depots().generations.obtenir(r.generationId))!;
  const m = (await depots().scriptsMaitres.obtenir(r.scriptMaitreId))!;
  if (m.exception?.source === "proposition-machine" && !m.exception.valideeParWill) await bg.validerException(m.id, "c-est-juste");
  const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId && !v.archiveLe);
  await bg.validerVariantes(variantes.map((v) => v.id));
  const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId && !x.archiveLe && x.etat === "validee"))[0];
  if (!v) throw new Error("aucune version validée");
  return { r, g, v, idee };
}

/** La voix de Will reliée chez HeyGen (FOURNISSEUR_VOIX=heygen) : chaque lecture est payée. */
async function voixHeygen() {
  for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
}

/** La boucle de fond, horloge avancée, jusqu'à la fin. */
async function jusquAuBout(travailId: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 200; i++) {
    const t = (await depots().travaux.obtenir(travailId))!;
    if (t.statut === "termine" || t.statut === "echec") break;
    vi.setSystemTime(Date.now() + 15_000);
    await boucle.contenuDuTour({ delai: () => 5_000, synchroBuffer: async () => undefined });
  }
  vi.useRealTimers();
  return (await depots().travaux.obtenir(travailId))!;
}

describe("E2E-verif1 a1 · config de production reconnue", () => {
  it("FOURNISSEUR_ILLUSTRATION=reel, FOURNISSEUR_ALIGNEMENT=studio-aligneur, FOURNISSEUR_SCRIPT=claude… : tous « Relié »", async () => {
    expect(resoudreFournisseur("illustration").id).toBe("reel");
    expect(resoudreFournisseur("illustration").mode).toBe("reel");
    expect(resoudreFournisseur("alignement").id).toBe("studio-aligneur");
    expect(resoudreFournisseur("alignement").mode).toBe("reel");
    expect(resoudreFournisseur("script").id).toBe("claude");
    expect(resoudreFournisseur("montage").id).toBe("studio-rendu");
    expect(resoudreFournisseur("stockage").id).toBe("r2");
    for (const t of ["illustration", "alignement", "script", "montage", "stockage", "voix", "visage", "notification"] as const) expect(etatConnexion(t)).toBe("relie");
    // Réglages EN BASE (pas de variable) : reconnus aussi.
    for (const t of ["publication", "texte-reseaux", "miniature", "etalonnage", "son"] as const) expect(etatConnexion(t, await lireParametre<string | null>(`fournisseur.${t}`, null))).toBe("relie");
    // Les deux interrupteurs sont éteints : la vidéo avocat part au moteur d'essai.
    expect(await renduDouble.renduDoubleAllume()).toBe(false);
    const d = await reglages.decisionMontageReel("avocat");
    expect(d).toMatchObject({ allume: false, effectif: false, moteurId: "simulation" });
    expect(await reglages.moteurAuLancement("avocat")).toBe("simulation");
  });

  it("deploiement/docker-compose.yml transmet bien toutes ces variables au studio", () => {
    const compose = readFileSync("deploiement/docker-compose.yml", "utf8");
    for (const v of ["FOURNISSEUR_ILLUSTRATION", "FOURNISSEUR_ALIGNEMENT", "STUDIO_ALIGNEUR_URL", "FOURNISSEUR_SCRIPT", "ANTHROPIC_API_KEY", "FAL_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY", "FOURNISSEUR_VISAGE", "FOURNISSEUR_VOIX", "FOURNISSEUR_MONTAGE", "STUDIO_RENDU_URL", "STUDIO_RENDU_CLE", "FOURNISSEUR_STOCKAGE", "FOURNISSEUR_NOTIFICATION"]) {
      expect(compose).toMatch(new RegExp(`^\\s+${v}: \\$\\{${v}:-\\}`, "m"));
    }
  });
});

describe("E2E-verif1 a1 · idée → script Claude → « Fabriquer », interrupteurs ÉTEINTS, NODE_ENV=production", () => {
  it("le script est RÉELLEMENT écrit par Claude (doublé) : dépense Claude enregistrée, version avocat validée", async () => {
    const { r, v } = await ideeJusquAVersionValidee();
    expect(claude.appels.stratege).toBe(1);
    expect(claude.appels.prose).toBeGreaterThanOrEqual(1);
    expect(v.formatId).toBe("avocat");
    const depClaude = (await depots().depenses.lister((d) => d.scriptMaitreId === r.scriptMaitreId)).flatMap((d) => d.lignes).filter((l) => l.fournisseur === "anthropic");
    expect(depClaude.length).toBeGreaterThan(0);
    expect(depClaude.every((l) => l.total.centimes > 0)).toBe(true);
    // L'écriture n'est PAS marquée essai.
    expect((await depots().generations.obtenir(r.generationId))?.simulee).toBeFalsy();
  });

  it("voix HeyGen de Will : « Fabriquer » est REFUSÉ (SIMULATION_EN_PRODUCTION) avant toute dépense ; rien de créé, rien de payé", async () => {
    const { v } = await ideeJusquAVersionValidee();
    await voixHeygen();
    const depensesAvant = await depots().depenses.compter();
    const videosAvant = await depots().videos.compter((x) => x.statut !== "archivee");
    vi.stubEnv("NODE_ENV", "production");
    const err = await bg.fabriquerVariante(v.id, { operationId: "op-a1-1", lancer: true, prixConfirme: 1_000_000 }).catch((e) => e);
    vi.unstubAllEnvs();
    expect(err).toMatchObject({ code: "SIMULATION_EN_PRODUCTION" });
    // Ce que lit Will dans la feuille « Fabriquer cette version » (FicheSujet : « La fabrication n'est pas partie. » + message).
    // Les trois « outils » cités sont pourtant « Relié » dans Réglages › Connexions (voir le ROUGE suivant).
    // CORRECTEUR FINAL A : la phrase nomme le vrai geste (ici : choisir son double), plus « Reliez ces outils ».
    expect(err.message).toMatch(/^Cette vidéo ne peut pas partir : elle serait montée en essai, avec une vidéo de démonstration\. Rien n'a été payé\. .*« Ma vidéo HeyGen »/);
    // Aucun appel payant (HeyGen, fal.ai, studio-rendu, aligneur), aucune dépense, aucune réservation.
    expect(appelsPayants()).toEqual([]);
    expect(await depots().depenses.compter()).toBe(depensesAvant);
    expect(await depots().reservations.compter((x) => x.statut === "active")).toBe(0);
    // Pas d'écran mort : la version garde son bouton « Fabriquer » (aucun brouillon rattaché, rien d'orphelin).
    expect((await depots().variantes.obtenir(v.id))?.videoId).toBeUndefined();
    expect(await depots().videos.compter((x) => x.statut !== "archivee")).toBe(videosAvant);
    expect(await depots().travaux.compter((t) => t.statut === "en_file" || t.statut === "en_cours")).toBe(0);
  });

  // DÉFAUT (gêne forte) : la phrase dit « le montage de la vidéo, le double et les illustrations sont encore en essai…
  // Reliez ces outils dans Réglages > Connexions », alors que les trois SONT reliés (cartes « Relié » : studio-rendu,
  // HeyGen, Pexels/Pixabay/fal.ai). Les lignes « double » et « illustrations » sont simulées parce que le MOTEUR est
  // celui d'essai (briques simulées, `briqueIllustrations` toujours au nom de « simulation »), pas faute de connexion. Ce qui manque, ce sont les deux interrupteurs
  // (« Votre avatar parle dans le studio », puis « Montage réel des vidéos avocat ») — ou, en attendant, « Ma vidéo
  // HeyGen » (chemin proposé partout ailleurs, DOUBLE_PARLE_DANS_HEYGEN). Will va dans Connexions, voit tout « Relié »,
  // et ne sait pas quoi faire. src/services/fabrication.ts:592 (moteur « simulation » → « le montage de la vidéo ») et :606.
  it("CORRIGÉ — le refus nomme le vrai geste (interrupteurs ou « Ma vidéo HeyGen »), pas « Reliez ces outils » déjà reliés", async () => {
    const { v } = await ideeJusquAVersionValidee();
    await voixHeygen();
    expect((await reglages.listerConnexions()).find((c) => c.type === "montage")?.etat).toBe("relie");
    vi.stubEnv("NODE_ENV", "production");
    const err = await bg.fabriquerVariante(v.id, { operationId: "op-a1-2", lancer: true, prixConfirme: 1_000_000 }).catch((e) => e);
    vi.unstubAllEnvs();
    expect(err.code).toBe("SIMULATION_EN_PRODUCTION");
    expect(err.message).not.toMatch(/Reliez ce(t|s) outils?/);
    expect(err.message).toMatch(/Montage réel|Votre avatar parle|Ma vidéo HeyGen/);
  });

  it("voix d'essai (voix non reliée chez HeyGen) : la vidéo PART en production au moteur d'essai et finit « prête » avec le clip de démonstration ; 0 € payé", async () => {
    const { v } = await ideeJusquAVersionValidee();
    vi.stubEnv("NODE_ENV", "production");
    const r = await bg.fabriquerVariante(v.id, { operationId: "op-a1-3", lancer: true, prixConfirme: 1_000_000 });
    vi.unstubAllEnvs();
    expect(r.travailId).toBeTruthy();
    const video = (await depots().videos.obtenir(r.videoId))!;
    expect(video.estDemo).toBeFalsy();
    const version = (await depots().versions.lister((x) => x.videoId === r.videoId))[0];
    expect(version.commande.moteurId).toBe("simulation");
    // L'avatar du format est bien figé dans la commande (ici : l'avatar d'essai, aucun double réel choisi).
    expect(version.commande.distribution[0].visagesResolus?.["trois-quarts"]?.fournisseur ?? version.commande.distribution[0].visagesResolus?.face?.fournisseur).toBe("simulation");
    const travail = await jusquAuBout(r.travailId!);
    expect(travail.statut).toBe("termine");
    await travaux.executerSuites([{ type: "finition", videoId: r.videoId, titre: video.titre, ratio: "9:16", textes: true }]);
    const apres = (await depots().videos.obtenir(r.videoId))!;
    expect(apres.statut).toBe("prete");
    // Ce que Will regarde : le clip de démonstration d'un AUTRE avocat (public/demo), pas sa vidéo.
    const sorties = await depots().sorties.lister((s) => s.versionId === version.id);
    const fichiers = await Promise.all(sorties.map((s) => depots().fichiers.obtenir(s.fichierId)));
    expect(fichiers.every((f) => /^\/demo\//.test(f?.cleStockage ?? ""))).toBe(true);
    // Aucune miniature de démonstration (garde R4 tenue).
    expect(await depots().miniatures.compter((m) => m.videoId === r.videoId)).toBe(0);
    // 0 € payé : toutes les lignes sont simulées ; aucun appel payant.
    const lignes = (await depots().depenses.lister((d) => d.videoId === r.videoId)).flatMap((d) => d.lignes);
    expect(lignes.every((l) => l.fournisseur === "simulation")).toBe(true);
    expect(appelsPayants()).toEqual([]);
    // CORRECTEUR FINAL A : Will est prévenu que c'est un ESSAI (jamais « Votre vidéo est prête »).
    const notes = await depots().notifications.lister((n) => n.lien?.includes(r.videoId) ?? false);
    expect(notes.map((n) => n.titre)).toContain("Essai · vidéo de démonstration prête");
    expect(notes.map((n) => n.titre)).not.toContain("Votre vidéo est prête");
    // Et Claude n'a écrit (ni fait payer) aucun texte des réseaux pour cette vidéo d'essai.
    await travaux.executerSuites([{ type: "finition", videoId: r.videoId, titre: video.titre, ratio: "9:16", textes: true }]);
    expect((await depots().depenses.lister((d) => d.videoId === r.videoId)).flatMap((d) => d.lignes).some((l) => l.fournisseur === "anthropic")).toBe(false);
  });

  // CORRECTEUR FINAL A : une vidéo d'essai n'a plus de ligne Claude (textes des réseaux) ; avec la voix d'essai, rien
  // n'est payé : elle part en ESSAI, comme au parcours A (même règle partout), et l'Aperçu le dit.
  it("« Utiliser dans ma vidéo » → assistant → Fabriquer (vidéo hors version), voix d'essai : part en ESSAI en production, sans ligne Claude ni appel payant", async () => {
    const { v, idee } = await ideeJusquAVersionValidee();
    const t = await scripts.texteDeVersionPourVideo(v.id);
    const scriptId = await scripts.enregistrerScript({ formatId: t.formatId, sujet: t.sujet, blocs: t.blocs, adresse: t.adresse, ideeId: idee.id });
    const videoId = await videos.creerBrouillon("avocat", { scriptId });
    // L'Aperçu (avant le toucher) annonce un prix et des étapes, sans rien dire du refus qui vient.
    const apercu = await fabrication.apercuFabrication(videoId);
    expect(apercu.estimation.lignes.some((l) => l.fournisseur === "anthropic")).toBe(false);
    expect(apercu.estimation.lignes.every((l) => l.fournisseur === "simulation")).toBe(true);
    expect(apercu.etapes.map((e) => e.cle)).toContain("visage");
    vi.stubEnv("NODE_ENV", "production");
    const r = await fabrication.lancerFabrication(videoId, { confirme: 1_000_000 });
    vi.unstubAllEnvs();
    expect(r.travailId).toBeTruthy();
    expect((await depots().versions.obtenir(r.versionId))?.commande.moteurId).toBe("simulation");
    expect(appelsPayants()).toEqual([]);
  });

  // DÉFAUT (FICTIF PRÉSENTÉ COMME RÉEL, avant le geste) : la feuille « Fabriquer cette version » (FicheSujet) dit
  // « La vidéo complète, avec votre double et votre voix » et montre le prix SANS pastille Essai : `partPayee`
  // (src/services/generateur-depenses.ts:67-79) ne regarde que les CONNEXIONS (visage HeyGen relié + clé → « payé »),
  // jamais les interrupteurs. Interrupteurs éteints, la vidéo part pourtant au moteur d'essai (clip de démonstration,
  // 0 €). Correction : `partPayee` lit `decisionMontageReel(format)` / `renduDoubleAllume()` ; éteints → « Essai : rien
  // ne sera payé. » (et la phrase de la feuille ne promet plus « votre double et votre voix »).
  it("CORRIGÉ — interrupteurs éteints, voix d'essai : la feuille « Fabriquer » annonce l'essai (rien ne sera payé)", async () => {
    await ideeJusquAVersionValidee();
    const { lireResumeDepense } = await import("@/services/generateur-depenses");
    const resume = await lireResumeDepense(centimes(150));
    expect(resume.essai).toBe(true);
  });

  // RELECTURE FINALE G3 : interrupteurs éteints (moteur d'essai) mais voix reliée chez HeyGen : la feuille annonçait la
  // voix « payée » et comptait le prix dans le total du jour, sans pastille Essai. Le moteur d'essai n'appelle aucune
  // voix : rien n'est payé, la feuille doit le dire.
  it("CORRIGÉ G3 — interrupteurs éteints, voix HeyGen reliée : pastille Essai, rien annoncé comme payé", async () => {
    await ideeJusquAVersionValidee();
    await voixHeygen();
    const { lireResumeDepense, partPayee } = await import("@/services/generateur-depenses");
    const resume = await lireResumeDepense(centimes(150));
    expect(resume.essai).toBe(true);
    expect(resume.messageEssai).toMatch(/^Essai : rien ne sera payé\./);
    expect(resume.messageEssai).not.toMatch(/sera payée/);
    expect(resume.jourApres).toBe(resume.jourAvant);
    expect((await partPayee()).voixPayee).toEqual([]);
  });

  // DÉFAUT (FICTIF PRÉSENTÉ COMME RÉEL) : la fiche vidéo calcule « fabricationSimulee » d'après la CONNEXION Montage
  // (« Relié » en production : studio-rendu), pas d'après le moteur qui a fait la version (« simulation », interrupteur
  // éteint). Résultat : la vidéo prête (clip de démonstration) s'affiche SANS pastille Essai ; « Demander une
  // modification » et les retouches ne disent pas « simulée ». Seul indice : la tuile « Essai, pas payé ».
  // src/app/(studio)/videos/[id]/page.tsx:89. Correction : fabricationSimulee = moteur de la version courante simulé
  // (moteurDeCommande(d.versionCourante.commande).id === "simulation") OU connexion non reliée, et un bandeau
  // « Vidéo d'essai : le clip de démonstration remplace votre vidéo ».
  it("CORRIGÉ — la fiche d'une vidéo faite au moteur d'essai l'annonce comme essai (pas d'après la seule connexion Montage)", () => {
    const page = readFileSync("src/app/(studio)/videos/[id]/page.tsx", "utf8");
    const ligne = /const fabricationSimulee = ([^;]+);/.exec(page)?.[1] ?? "";
    expect(ligne).toMatch(/moteur|commande|versionCourante/);
  });

  it("en essai, aucune illustration n'est cherchée ni fabriquée (Aperçu avocat en coupes seules) : ni banque, ni fal.ai", async () => {
    const { v } = await ideeJusquAVersionValidee();
    vi.stubEnv("NODE_ENV", "production");
    await bg.fabriquerVariante(v.id, { operationId: "op-a1-4", lancer: true, prixConfirme: 1_000_000 });
    vi.unstubAllEnvs();
    expect(R.appels.filter((a) => a.hote === "api.pexels.com" || a.hote === "pixabay.com" || a.hote === "queue.fal.run")).toEqual([]);
  });
});
