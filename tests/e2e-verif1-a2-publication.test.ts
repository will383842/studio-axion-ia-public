/**
 * VÉRIFICATION E2E n° 1 — PARCOURS A (seconde moitié), lettre « a2 » : une vidéo est prête → textes des réseaux écrits
 * par Claude (doublé) avec « Vos hashtags » et l'en-tête de série « ép. N » → « Avant de publier » → choix du compte
 * LinkedIn puis Facebook (plusieurs comptes Buffer) → rappel « Votre marque » (TikTok) → BROUILLON Buffer (doublé,
 * `tests/helpers/r1-buffer.ts`) → notification (téléphone et e-mail doublés).
 *
 * Configuration de PRODUCTION : variables d'environnement du serveur (clés posées, FOURNISSEUR_* du compose), et les
 * choix posés EN BASE comme Will les a posés (fournisseur.publication = buffer, fournisseur.texte-reseaux = claude,
 * fournisseur.miniature / etalonnage / son = studio-rendu). FOURNISSEUR_TEXTE_RESEAUX et FOURNISSEUR_PUBLICATION ne
 * sont PAS posées (le compose ne les transmet pas) : le réglage en base doit suffire.
 *
 * Un seul `fetch` doublé : Buffer (GraphQL), ZeptoMail (e-mail de secours). Toute autre adresse fait échouer le test.
 * Le téléphone (web-push, qui n'utilise pas `fetch`) est TOUJOURS doublé par injection : aucun appel réel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";
import { CANAUX, fauxBuffer, URL_BUFFER } from "./helpers/r1-buffer";

// --- Variables du serveur de production (valeurs factices) ---
process.env.HEYGEN_API_KEY = "cle-heygen-essai-a2";
process.env.ANTHROPIC_API_KEY = CLE_ESSAI_CLAUDE;
process.env.BUFFER_API_KEY = "cle-buffer-essai-a2";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.VAPID_PUBLIQUE = "BEssaiClePubliqueVapidA2";
process.env.VAPID_PRIVEE = "essai-cle-privee-vapid-a2";
process.env.VAPID_SUJET = "mailto:contact@axion-ia.com";
process.env.EMAIL_SECOURS_CLE = "jeton-zeptomail-essai-a2";
process.env.EMAIL_SECOURS_EXPEDITEUR = "studio@axion-ia.com";
process.env.EMAIL_SECOURS_DESTINATAIRE = "will@exemple.fr";
process.env.STUDIO_RENDU_URL = "http://studio-rendu.essai";
process.env.STUDIO_RENDU_CLE = "cle-rendu-essai";
process.env.STUDIO_ALIGNEUR_URL = "http://studio-aligneur.essai";
process.env.FOURNISSEUR_VISAGE = "heygen";
process.env.FOURNISSEUR_MONTAGE = "studio-rendu";
process.env.FOURNISSEUR_VOIX = "heygen";
process.env.FOURNISSEUR_SCRIPT = "claude";
process.env.FOURNISSEUR_ILLUSTRATION = "reel";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.FOURNISSEUR_NOTIFICATION = "web-push-email";
process.env.FOURNISSEUR_ALIGNEMENT = "studio-aligneur";
// Jamais transmises par deploiement/docker-compose.yml : le réglage en base doit suffire.
delete process.env.FOURNISSEUR_TEXTE_RESEAUX;
delete process.env.FOURNISSEUR_PUBLICATION;

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/* ------------------------------------------------------------------ */
/* Le réseau doublé                                                     */
/* ------------------------------------------------------------------ */

const R = vi.hoisted(() => ({
  buffer: null as null | { appeler: (url: string | URL | Request, init?: RequestInit) => Promise<Response> },
  emails: [] as { sujet: string; texte: string; a: string }[],
  inattendus: [] as string[],
}));

async function reseau(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const brut = String(url instanceof Request ? url.url : url);
  if (brut === URL_BUFFER) return R.buffer!.appeler(url, init);
  const u = new URL(brut);
  if (u.hostname === "api.zeptomail.eu") {
    const c = JSON.parse(String(init?.body ?? "{}")) as { subject: string; textbody: string; to: { email_address: { address: string } }[] };
    R.emails.push({ sujet: c.subject, texte: c.textbody, a: c.to[0].email_address.address });
    return new Response(JSON.stringify({ data: [{ code: "EM_104", message: "Email request received" }] }), { status: 201, headers: { "content-type": "application/json" } });
  }
  R.inattendus.push(`${u.hostname}${u.pathname}`);
  throw new Error(`Adresse inattendue (aucun appel réel permis) : ${u.hostname}${u.pathname}`);
}

// Le stockage R2 garde le `fetch` du moment de sa création (src/fournisseurs/r2/stockage.ts:85) : doublé AVANT les
// imports, sinon ses lectures et effacements partiraient sur le vrai réseau.
vi.stubGlobal("fetch", (u: string | URL | Request, i?: RequestInit) => reseau(u, i));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const buf = await import("@/services/buffer");
const series = await import("@/services/series");
const hashtags = await import("@/services/hashtags");
const notifs = await import("@/services/notifications");
const travaux = await import("@/services/travaux");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const reglages = await import("@/services/reglages");
const videos = await import("@/services/videos");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre, fournisseur } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { casesEnvoi, casesParDefaut, ciblesDepuisCases } = await import("@/domaine/comptes-envoi");
const { RAPPEL_VOTRE_MARQUE } = await import("@/domaine/votre-marque");
const { HASHTAGS_TIKTOK_PAR_DEFAUT, cleMotDiese } = await import("@/reseaux/hashtags");

const MDP = "essai-e2e-verif1-a2";
const VIDEO = "v-15";
/** Un autre épisode de la série (ép. 1). */
const AUTRE = "v-03";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const SERIE = "Droit en 1 minute";
const FAMILLE_LINKEDIN = ["#Droit", "#Avocat", "#DroitDuTravail"];
const TIKTOK = { id: "e00090000000000000000000", name: "Exemple name", displayName: "Exemple TikTok", service: "tiktok", type: "business", avatar: "https://exemple.invalid/fichier", isDisconnected: false, isLocked: false, isQueuePaused: false, timezone: "Europe/Paris" };

/** Claude doublé : un texte par réseau ; des mots-dièse HORS famille et un « fourre-tout » glissés exprès. */
const claude = { appels: [] as string[] };
function brancherClaude() {
  claude.appels = [];
  void credits.declarerRecharge("anthropic", 500);
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { messages?: { content: string }[] };
    const r = /<reseau id="([^"]+)"/.exec(corps.messages?.[0]?.content ?? "")?.[1] ?? "?";
    claude.appels.push(r);
    const texte = "Votre question juridique, expliquée simplement.\n\nLe point en moins d'une minute.";
    const motsDiese = r === "tiktok" ? ["#IA", "#ChatGPT", "#Juridique"] : r === "linkedin" ? ["#Droit", "#Juridique", "#Avocat"] : ["#Droit", "#Avocat"];
    const sortie = { premiereLigne: texte.split("\n")[0], texte, motsDiese, ...(r.startsWith("youtube") ? { titres: ["Votre question juridique en une minute"] } : {}), justifications: [] };
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
}

/** Téléphone doublé (web-push n'utilise pas `fetch`) : chaque notification poussée est notée. */
const pousses: { titre: string; message?: string }[] = [];
const envoyerPushDouble = (async (_c: unknown, abonnes: unknown[], charge: { titre: string; message?: string }) => {
  pousses.push({ titre: charge.titre, message: charge.message });
  return { envoyes: abonnes.length, expires: [] as string[] };
}) as unknown as NonNullable<Parameters<typeof notifs.diffuserNotifications>[0]>["envoyerPush"];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  R.buffer = fauxBuffer({ canauxEnPlus: [TIKTOK] });
  R.emails = [];
  R.inattendus = [];
  pousses.length = 0;
  vi.stubGlobal("fetch", reseau);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  brancherClaude();
  // Réglages posés EN BASE par Will (Réglages › Connexions), comme en production.
  await ecrireParametre("fournisseur.publication", "buffer");
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await ecrireParametre("fournisseur.miniature", "studio-rendu");
  await ecrireParametre("fournisseur.etalonnage", "studio-rendu");
  await ecrireParametre("fournisseur.son", "studio-rendu");
  await ecrireParametre("reseaux.parDefaut", ["linkedin", "facebook", "tiktok"]);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** La vidéo de Will (pas un exemple), sans kit ni travail en cours ; ses miniatures existent déjà. */
async function videoDeWill(id: string = VIDEO) {
  const d = depots();
  const VIDEO = id;
  const video = (await d.videos.obtenir(VIDEO))!;
  // Illustrations coupées (comme tests/r8) : la démonstration porte exprès une image à licence bloquante.
  await d.videos.modifier(VIDEO, { estDemo: false, briquesCoupees: [...(video.briquesCoupees ?? []), "illustrations"] });
  for (const k of await d.kits.lister((x) => x.videoId === VIDEO)) await d.kits.modifier(k.id, { videoId: "v-archive-a2" });
  for (const x of await d.travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await d.travaux.enregistrer({ ...x, statut: "termine" });
}

/** Ce qu'un vrai montage dépose : le fichier de la sortie sur R2 (clé du studio, pas un fichier de démonstration). */
async function sortiesSurR2() {
  const d = depots();
  for (const s of await d.sorties.lister((x) => x.videoId === VIDEO)) {
    await d.fichiers.modifier(s.fichierId, { cleStockage: `studio/videos/${VIDEO}/${s.id}.mp4` });
  }
  // CORRECTEUR FINAL A : une vraie vidéo sort du vrai moteur (figé dans la version), pas du moteur d'essai.
  for (const v of await d.versions.lister((x) => x.videoId === VIDEO)) await d.versions.modifier(v.id, { commande: { ...v.commande, moteurId: "montage-avocat" } });
}

const cocher = async () => {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
};
const entrees = () => R.buffer && (R.buffer as ReturnType<typeof fauxBuffer>).mutations().map((m) => m.variables.input as { channelId: string; text: string; saveToDraft: boolean; mode: string; dueAt?: string; assets: { video: { url: string } }[] });
const fb = () => R.buffer as ReturnType<typeof fauxBuffer>;
const motsDieseDe = (texte: string) => texte.match(/#[\p{L}\p{N}_]+/gu) ?? [];

/* ------------------------------------------------------------------ */
/* Réglages : la base suffit                                            */
/* ------------------------------------------------------------------ */

describe("A2 — la configuration de production en base suffit", () => {
  it("textes des réseaux = Claude et publication = Buffer, par le seul réglage en base (sans FOURNISSEUR_TEXTE_RESEAUX ni FOURNISSEUR_PUBLICATION)", async () => {
    expect(process.env.FOURNISSEUR_TEXTE_RESEAUX).toBeUndefined();
    expect(process.env.FOURNISSEUR_PUBLICATION).toBeUndefined();
    expect((await fournisseur("texte-reseaux")).id).toBe("claude");
    expect((await fournisseur("publication")).id).toBe("buffer");
    expect(await gc.claudeActif("texte-reseaux")).not.toBeNull();
    const cartes = await reglages.listerConnexions();
    expect(cartes.find((c) => c.type === "texte-reseaux")?.etat).toBe("relie");
    expect(cartes.find((c) => c.type === "publication")?.etat).toBe("relie");
    expect(cartes.find((c) => c.type === "notification")?.etat).toBe("relie");
    expect((await notifs.canauxActifs()).push).not.toBeNull();
    expect((await notifs.canauxActifs()).email).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Le parcours, avec une vidéo réellement montée (fichier sur R2)       */
/* ------------------------------------------------------------------ */

describe("A2 — vidéo prête → kit Claude → comptes LinkedIn puis Facebook → brouillon Buffer → notification", () => {
  it("le chemin complet : brouillons Buffer sur les comptes choisis, hashtags fixes, « ép. N », un rappel « Votre marque »", async () => {
    await videoDeWill();
    await sortiesSurR2();
    // Série : un épisode avant celui-ci (ép. 1), cette vidéo devient l'ép. 2.
    const serie = await series.creerSerie(SERIE);
    expect((await series.rattacherVideo(AUTRE, serie.id)).episode).toBe(1);
    expect((await series.rattacherVideo(VIDEO, serie.id)).episode).toBe(2);
    // « Vos hashtags » : LinkedIn fixé par Will ; TikTok garde la famille préremplie.
    await hashtags.definirFamille("linkedin", FAMILLE_LINKEDIN);
    // « Cette vidéo met en avant Axion IA ».
    await series.definirVotreMarque(VIDEO, true);

    // 1. Fin de fabrication (suite « finition », comme la boucle) : Claude écrit un texte par réseau par défaut, une fois.
    await travaux.executerSuites([{ type: "finition", videoId: VIDEO, titre: "Essai A2", ratio: "9:16", textes: true }]);
    expect([...claude.appels].sort()).toEqual(["facebook", "linkedin", "tiktok"]);
    const kit = (await pub.obtenirKit(VIDEO))!;
    expect(kit.envoiSimule).toBe(false);
    for (const r of ["linkedin", "facebook", "tiktok"] as const) expect(kit.reseaux.find((x) => x.reseau === r)!.origine).toBe("claude");
    // Hashtags fixes : LinkedIn dans sa famille ; TikTok dans la sienne, au moins 3, jamais un fourre-tout.
    const li = kit.reseaux.find((x) => x.reseau === "linkedin")!;
    expect(li.motsDiese.every((m) => FAMILLE_LINKEDIN.includes(m))).toBe(true);
    const tk = kit.reseaux.find((x) => x.reseau === "tiktok")!;
    expect(tk.motsDiese.length).toBeGreaterThanOrEqual(3);
    expect(tk.motsDiese.every((m) => HASHTAGS_TIKTOK_PAR_DEFAUT.includes(m))).toBe(true);
    expect(kit.serie).toMatchObject({ nom: SERIE, episode: 2, entete: `${SERIE} · ép. 2` });
    // Un second passage (« Réessayer » de la finition) n'écrit rien de plus.
    await travaux.executerSuites([{ type: "finition", videoId: VIDEO, titre: "Essai A2", ratio: "9:16", textes: true }]);
    expect(claude.appels).toHaveLength(3);

    // 2. « Avant de publier » : sans les cases, rien ne part.
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } })).rejects.toMatchObject({ code: "AVANT_DE_PUBLIER" });
    await cocher();

    // 3. « Tester » Buffer (Réglages) : comptes lus et gardés en base ; la feuille d'envoi ne lit que la base.
    await buf.testerBuffer();
    const vue = (await buf.vueEnvoiBuffer())!;
    expect(vue.mode).toBe("brouillon");
    const cases = casesEnvoi(kit.reseaux.map((r) => ({ reseau: r.reseau, nom: r.nom })), vue.comptes);
    // Deux LinkedIn et deux Facebook : une case par compte, AUCUNE cochée d'office (sans mémoire).
    expect(cases.filter((c) => c.reseau === "linkedin")).toHaveLength(2);
    expect(cases.filter((c) => c.reseau === "facebook")).toHaveLength(2);
    expect(casesParDefaut(cases, ["linkedin", "facebook"], vue.comptes)).toEqual([]);

    // 4. LinkedIn : Will coche la PAGE.
    const ciblesLi = ciblesDepuisCases([`linkedin:${CANAUX.linkedinPage}`], cases);
    const a = await pub.envoyerVersBuffer(VIDEO, ciblesLi.reseaux, DEMAIN, { comptes: ciblesLi.comptes });
    expect(a).toMatchObject({ simulation: false, mode: "brouillon" });
    expect(a.publications).toHaveLength(1);
    expect(a.publications[0]).toMatchObject({ reseau: "linkedin", canalId: CANAUX.linkedinPage, via: "buffer", statut: "brouillon", etatEnvoi: "envoye" });
    // 5. Facebook : Will coche le SECOND compte.
    const ciblesFb = ciblesDepuisCases([`facebook:${CANAUX.facebook2}`], cases);
    const b = await pub.envoyerVersBuffer(VIDEO, ciblesFb.reseaux, DEMAIN, { comptes: ciblesFb.comptes });
    expect(b.publications[0]).toMatchObject({ reseau: "facebook", canalId: CANAUX.facebook2, statut: "brouillon", etatEnvoi: "envoye" });
    // 6. TikTok (un seul compte) : la vidéo « Votre marque ».
    const c = await pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN);
    expect(c.publications[0]).toMatchObject({ reseau: "tiktok", canalId: TIKTOK.id, statut: "brouillon", votreMarque: true });

    // Ce que Buffer a reçu : le compte choisi, en brouillon, jamais « partager maintenant ».
    const recu = entrees()!;
    expect(recu.map((e) => e.channelId)).toEqual([CANAUX.linkedinPage, CANAUX.facebook2, TIKTOK.id]);
    for (const e of recu) {
      expect(e.saveToDraft).toBe(true);
      expect(e.mode).not.toBe("shareNow");
      expect(e.assets[0].video.url).toMatch(/^https:\/\/[^/]+\/api\/media-buffer\/[^/]+\/video\.mp4$/);
      // En-tête de série en première ligne, sur tous les réseaux.
      expect(e.text.split("\n")[0]).toBe(`${SERIE} · ép. 2`);
      expect(motsDieseDe(e.text).some((m) => /fyp|viral|pourtoi|foryou/i.test(m))).toBe(false);
    }
    expect(motsDieseDe(recu[0].text).every((m) => FAMILLE_LINKEDIN.map(cleMotDiese).includes(cleMotDiese(m)))).toBe(true);
    expect(motsDieseDe(recu[2].text).length).toBeGreaterThanOrEqual(3);
    expect(motsDieseDe(recu[2].text).every((m) => HASHTAGS_TIKTOK_PAR_DEFAUT.map(cleMotDiese).includes(cleMotDiese(m)))).toBe(true);
    // Chez Buffer : trois brouillons, rien de programmé ni publié.
    expect([...fb().posts.values()].map((p) => p.status)).toEqual(["draft", "draft", "draft"]);
    // Le choix est mémorisé pour la fois suivante (et « Programmer les N »).
    const vue2 = (await buf.vueEnvoiBuffer())!;
    expect(vue2.comptes.linkedin?.memorises).toEqual([CANAUX.linkedinPage]);
    expect(vue2.comptes.facebook?.memorises).toEqual([CANAUX.facebook2]);

    // 7. Renvoi (double toucher, même date) : aucun second brouillon, et l'épisode ne bouge pas.
    const a2 = await pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } });
    expect(a2.publications[0].id).toBe(a.publications[0].id);
    expect(fb().mutations()).toHaveLength(3);
    expect((await depots().videos.obtenir(VIDEO))!.episodeSerie).toBe(2);
    expect((await depots().series.obtenir(serie.id))!.dernierEpisode).toBe(2);
    expect((await pub.obtenirKit(VIDEO))!.serie?.episode).toBe(2);
    // Rattacher à nouveau à la même série ne donne pas un nouveau numéro.
    expect((await series.rattacherVideo(VIDEO, serie.id)).episode).toBe(2);

    // 8. Notification « Votre marque » : une seule (TikTok), le geste exact, ni « Essai » ni « publiée ».
    const rappels = await depots().notifications.lister((n) => n.titre.includes("Votre marque"));
    expect(rappels).toHaveLength(1);
    expect(rappels[0]).toMatchObject({ titre: "TikTok : vidéo « Votre marque »", message: `${RAPPEL_VOTRE_MARQUE}, avant de publier le brouillon.` });
    // Diffusion (boucle de fond) : Will a activé son téléphone → poussée ; puis e-mail choisi → e-mail de secours.
    await notifs.enregistrerAbonnementPush({ endpoint: "https://fcm.googleapis.com/fcm/send/essai-a2", keys: { p256dh: "BEssaiP256dh", auth: "essai-auth" } }, "iPhone");
    const r1 = await notifs.diffuserNotifications({ envoyerPush: envoyerPushDouble });
    expect(r1.push).toBeGreaterThanOrEqual(1);
    expect(pousses.map((p) => p.titre)).toContain("TikTok : vidéo « Votre marque »");
    expect(R.emails).toHaveLength(0); // le téléphone a reçu : pas d'e-mail en plus
    expect(R.inattendus).toEqual([]);
  });

  it("comptes Buffer jamais lus (Will n'a pas touché « Tester ») : la feuille montre une seule case LinkedIn, le premier envoi est refusé, rien ne part ; les comptes apparaissent seulement après rechargement", async () => {
    await videoDeWill();
    await sortiesSurR2();
    await cocher();
    const avant = (await buf.vueEnvoiBuffer())!;
    // Rien de lu : aucune case par compte (une seule case « LinkedIn »).
    expect(avant.comptes.linkedin).toEqual({});
    const kit = (await pub.obtenirKit(VIDEO))!;
    expect(casesEnvoi(kit.reseaux.map((r) => ({ reseau: r.reseau, nom: r.nom })), avant.comptes).filter((c) => c.reseau === "linkedin")).toEqual([{ cle: "linkedin", reseau: "linkedin", libelle: "LinkedIn" }]);
    // GÊNE : la phrase demande de « choisir le compte en envoyant une vidéo », mais la feuille (non rafraîchie après une
    // erreur, FeuilleEnvoyerBuffer.tsx:95-98) n'offre toujours qu'une case « LinkedIn » : Will doit recharger la page.
    await expect(pub.envoyerVersBuffer(VIDEO, ["linkedin"], DEMAIN)).rejects.toThrow(/Plusieurs comptes LinkedIn dans Buffer : choisissez le compte LinkedIn une première fois, en envoyant une vidéo\./);
    expect(fb().mutations()).toHaveLength(0);
    // Les comptes ont été lus pendant l'envoi : après rechargement, une case par compte.
    expect((await buf.vueEnvoiBuffer())!.comptes.linkedin?.choix).toHaveLength(2);
  });

  it("le téléphone ne répond pas : l'e-mail de secours part (ZeptoMail doublé), au bon destinataire", async () => {
    await videoDeWill();
    await sortiesSurR2();
    await series.definirVotreMarque(VIDEO, true);
    await cocher();
    await pub.envoyerVersBuffer(VIDEO, ["tiktok"], DEMAIN);
    await notifs.enregistrerAbonnementPush({ endpoint: "https://fcm.googleapis.com/fcm/send/essai-a2b", keys: { p256dh: "BEssaiP256dh", auth: "essai-auth" } }, "iPhone");
    const muet = (async () => ({ envoyes: 0, expires: [] as string[] })) as unknown as typeof envoyerPushDouble;
    const r = await notifs.diffuserNotifications({ envoyerPush: muet });
    expect(r.emails).toBe(1);
    expect(R.emails[0]).toMatchObject({ sujet: "TikTok : vidéo « Votre marque »", a: "will@exemple.fr" });
    expect(R.emails[0].texte).toContain("https://studio.axion-ia.com/videos/v-15");
  });
});

/* ------------------------------------------------------------------ */
/* Aujourd'hui en production : « Montage réel » ÉTEINT → vidéo d'essai  */
/* ------------------------------------------------------------------ */

/** Vidéo fabriquée « aujourd'hui » (format avocat, script présent). */
const FAB = AUTRE;
const cocherFab = async () => {
  // Will règle « Droits » (l'image d'exemple à licence bloquante est remplacée par une licence libre).
  const d = depots();
  const libre = (await d.elements.obtenir("mus-elan"))!.licence;
  for (const l of (await videos.obtenirVideo(FAB))!.licencesABloquer) await d.elements.modifier(l.id, { licence: libre });
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(FAB, c, true);
};

/** Fabrique la vidéo par la boucle de fond, comme en production aujourd'hui (interrupteur « Montage réel » éteint). */
async function fabriquerAujourdhui() {
  await videoDeWill(FAB);
  // Will a choisi « par e-mail » : les notifications partent par l'e-mail de secours (ZeptoMail doublé).
  await ecrireParametre("notifications", { ...notifs.PREFERENCES_PAR_DEFAUT, canal: "email" });
  const { travailId, versionId } = await fabrication.lancerFabrication(FAB, { confirme: true });
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 300; i++) {
    const t = (await depots().travaux.obtenir(travailId))!;
    if (t.statut === "termine" || t.statut === "echec") break;
    vi.setSystemTime(Date.now() + 15_000);
    await boucle.contenuDuTour({ delai: () => 5_000, synchroBuffer: async () => undefined });
  }
  vi.useRealTimers();
  await notifs.diffuserNotifications({ envoyerPush: envoyerPushDouble });
  return { travail: (await depots().travaux.obtenir(travailId))!, version: (await depots().versions.obtenir(versionId))! };
}

describe("A2 — aujourd'hui (« Montage réel » éteint) : la vidéo est une vidéo d'essai", () => {
  it("constat : la vidéo de Will sort du moteur d'essai, son fichier est la vidéo de démonstration ; « Votre vidéo est prête » part par e-mail", async () => {
    const { travail, version } = await fabriquerAujourdhui();
    expect(travail.statut).toBe("termine");
    expect(version.commande.moteurId).toBe("simulation");
    const sortie = (await depots().sorties.lister((s) => s.versionId === version.id))[0];
    expect((await depots().fichiers.obtenir(sortie.fichierId))!.cleStockage).toMatch(/^\/demo\//);
    // La carte « Montage » est « Reliée » (FOURNISSEUR_MONTAGE=studio-rendu) : la fiche n'affiche donc aucune pastille Essai.
    expect((await reglages.listerConnexions()).find((c) => c.type === "montage")?.etat).toBe("relie");
    // CORRECTEUR FINAL A : la notification dit que c'est un essai (avant : « Votre vidéo est prête »).
    expect(R.emails.map((e) => e.sujet)).toContain("Essai · vidéo de démonstration prête");
    expect(R.emails.map((e) => e.sujet)).not.toContain("Votre vidéo est prête");
    expect(R.inattendus).toEqual([]);
  });

  // DÉFAUT (FICTIF PRÉSENTÉ COMME RÉEL) : src/services/travaux.ts:188 — la notification « Votre vidéo est prête » ne dit
  // jamais que la vidéo a été fabriquée par le moteur d'essai (vidéo de démonstration). Will reçoit par e-mail/téléphone
  // l'annonce de SA vidéo, ouvre la fiche (aucune pastille Essai : `fabricationSimulee` lit la carte Montage, reliée) et
  // voit un clip de démonstration. Attendu : « Essai · … » (ou « Vidéo d'essai prête ») pour une version au moteur d'essai.
  it("CORRIGÉ — la notification d'une vidéo fabriquée par le moteur d'essai le dit (« Essai »)", async () => {
    await fabriquerAujourdhui();
    // (« not-2 » : notification d'exemple du jeu de démonstration, antérieure au test.)
    const pretes = await depots().notifications.lister((n) => n.type === "video-prete" && n.lien === `/videos/${FAB}` && n.id !== "not-2");
    expect(pretes.length).toBeGreaterThan(0);
    for (const n of pretes) expect(n.titre).toMatch(/essai|démonstration/i);
  });

  // DÉFAUT BLOQUANT (FICTIF PRÉSENTÉ COMME RÉEL) : src/services/publications.ts:566-571 (`urlVideoPourBuffer`) signe
  // n'importe quelle clé de fichier, y compris « /demo/avocat-droits.mp4 » (fichier du dossier public/, absent de R2) :
  // `src/fournisseurs/r2/stockage.ts:168` ne distingue pas les fichiers de démonstration (contrairement à `urlLecture`,
  // ligne 163). Le brouillon part chez Buffer avec une adresse R2 vers un objet qui n'existe pas, et l'écran dit
  // « Brouillon dans Buffer · 1 compte ». Aucun garde-fou `estCleDemo` (src/domaine/miniatures.ts:23) côté envoi.
  // Attendu : refus clair AVANT tout appel à Buffer (« C'est une vidéo d'essai : elle ne part pas sur vos réseaux. »).
  it("CORRIGÉ — une vidéo d'essai (fichier de démonstration) n'est jamais envoyée à Buffer comme une vraie", async () => {
    await fabriquerAujourdhui();
    // CORRIGÉ aussi : Claude n'écrit (ni ne fait payer) aucun texte pour une vidéo d'essai.
    expect(claude.appels).toHaveLength(0);
    await cocherFab();
    await expect(pub.envoyerVersBuffer(FAB, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } })).rejects.toThrow(/essai|démonstration/i);
    expect(fb().mutations()).toHaveLength(0);
  });

  // (Le « constat du défaut ci-dessus » — brouillon Buffer parti avec l'adresse R2 d'un fichier de démonstration — est
  // retiré : le CORRECTEUR FINAL A refuse désormais cet envoi, voir le test « CORRIGÉ » juste au-dessus.)

  // DÉFAUT : la même faille pour une vidéo d'EXEMPLE (estDemo) : src/services/publications.ts:490-510 ne refuse pas
  // `video.estDemo` (seul « Réécrire » le fait, ligne 407). Les exemples visibles (« Afficher les exemples ») partent
  // chez Buffer comme des vraies.
  it("CORRIGÉ — une vidéo d'exemple n'est jamais envoyée à Buffer", async () => {
    const EXEMPLE = "v-15";
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(EXEMPLE, c, true);
    expect((await depots().videos.obtenir(EXEMPLE))!.estDemo).toBe(true);
    await expect(pub.envoyerVersBuffer(EXEMPLE, ["linkedin"], DEMAIN, { comptes: { linkedin: [CANAUX.linkedinPage] } })).rejects.toThrow(/exemple/i);
    expect(fb().mutations()).toHaveLength(0);
  });
});
