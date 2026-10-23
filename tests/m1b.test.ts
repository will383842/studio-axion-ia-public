/**
 * LOT M1b — stockage R2 (signature vérifiée hors ligne), envoi par morceaux avec reprise, notifications
 * (téléphone et e-mail de secours), tableau des coûts, crochet HeyGen. Aucune clé, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cheminCanonique, signerAdresse } from "@/fournisseurs/r2/signature";
import { configR2, corpsFinMultipart, creerStockageR2, lireMorceaux, type ConfigR2 } from "@/fournisseurs/r2/stockage";
import { configEmail, corpsEmail, envoyerEmail } from "@/fournisseurs/notification/email";
import { abonnementValide, configPush, envoyerPush } from "@/fournisseurs/notification/push";
import { resoudreFournisseur } from "@/fournisseurs";
import { cleReprise, decouper, envoyerFichier, morceauxRestants, MO, tailleMorceau } from "@/lib/envoi-multipart";
import type { DepenseEnregistree, Video } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const notifications = await import("@/services/notifications");
const couts = await import("@/services/couts");
const crochets = await import("@/services/crochets");
const envois = await import("@/services/envois");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

const MDP_TEST = "essai-m1b-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "m".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
describe("R2 : adresses signées (Signature V4), vérifiées hors ligne", () => {
  it("reproduit l'exemple officiel de la documentation S3 (adresse signée GET, 24 h)", () => {
    const url = signerAdresse(
      { cleAcces: "AKIAIOSFODNN7EXAMPLE", secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" },
      { methode: "GET", hote: "examplebucket.s3.amazonaws.com", chemin: "/test.txt", expireSec: 86400, date: new Date("2013-05-24T00:00:00Z") },
    );
    expect(url).toBe(
      "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
  });

  it("encode le chemin segment par segment (espaces, accents), garde les « / »", () => {
    expect(cheminCanonique("/seau/studio/dev/rush é (1).mp4")).toBe("/seau/studio/dev/rush%20%C3%A9%20%281%29.mp4");
  });

  const config: ConfigR2 = { compte: "compte123", cleAcces: "CLE", secret: "SECRET", seau: "studio-axion", hote: "compte123.r2.cloudflarestorage.com", env: "prod" };
  const fige = () => new Date("2026-10-01T10:00:00Z");

  it("sans variables R2 : aucune configuration, le stockage reste simulé", () => {
    expect(configR2({})).toBeNull();
    expect(configR2({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c" })).toBeNull();
    expect(configR2({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" })?.hote).toBe("a.r2.cloudflarestorage.com");
    expect(resoudreFournisseur("stockage").mode).toBe("simulation");
    expect(resoudreFournisseur("stockage", "r2").mode).toBe("simulation"); // demandé mais non configuré : simulation
  });

  it("adresses courtes pour le navigateur, 24 h pour HeyGen, dépôt signé ; clés studio/{env}/…", async () => {
    const s = creerStockageR2(config, { maintenant: fige });
    const { cleStockage, urlDepot } = await s.preparerDepot({ fichierId: "f-abc", nom: "Prise 1.MOV", mime: "video/quicktime", taille: 10, typeEntite: "visage", entiteId: "vis-1" });
    expect(cleStockage).toBe("studio/prod/visage/vis-1/f-abc.mov");
    expect(urlDepot).toMatch(/^https:\/\/compte123\.r2\.cloudflarestorage\.com\/studio-axion\/studio\/prod\/visage\/vis-1\/f-abc\.mov\?/);
    expect(new URL(urlDepot).searchParams.get("X-Amz-Expires")).toBe("21600");
    const lecture = new URL(await s.urlLecture(cleStockage));
    expect(lecture.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(lecture.searchParams.get("X-Amz-Credential")).toBe("CLE/20261001/auto/s3/aws4_request");
    expect(new URL(await s.urlLectureDuree!(cleStockage, 24 * 3600)).searchParams.get("X-Amz-Expires")).toBe("86400");
    // Les fichiers de démonstration (public/) restent servis par le studio.
    expect(await s.urlLecture("/demo/avocat-droits.mp4")).toBe("/demo/avocat-droits.mp4");
  });

  it("multipart : commence, signe les morceaux, relit les morceaux reçus, termine (réponses S3 simulées)", async () => {
    const appels: { methode: string; url: URL; corps?: string }[] = [];
    const fetchFaux = (async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      appels.push({ methode: init?.method ?? "GET", url: u, corps: init?.body as string | undefined });
      if (u.searchParams.has("uploads")) return new Response("<InitiateMultipartUploadResult><UploadId>envoi-42</UploadId></InitiateMultipartUploadResult>");
      if ((init?.method ?? "GET") === "GET") return new Response("<ListPartsResult><Part><PartNumber>2</PartNumber><ETag>&quot;b&quot;</ETag><Size>10485760</Size></Part><Part><PartNumber>1</PartNumber><ETag>&quot;a&quot;</ETag><Size>10485760</Size></Part></ListPartsResult>");
      return new Response("<CompleteMultipartUploadResult/>");
    }) as typeof fetch;
    const s = creerStockageR2(config, { fetch: fetchFaux, maintenant: fige });
    const cle = "studio/prod/visage/vis-1/f-abc.mp4";
    expect(await s.multipart!.commencer(cle, "video/mp4")).toEqual({ idEnvoi: "envoi-42" });
    const adresses = await s.multipart!.signerMorceaux(cle, "envoi-42", [1, 2, 0, 10_001]);
    expect(Object.keys(adresses)).toEqual(["1", "2"]);
    expect(new URL(adresses[2]).searchParams.get("partNumber")).toBe("2");
    expect(new URL(adresses[2]).searchParams.get("uploadId")).toBe("envoi-42");
    expect(await s.multipart!.morceauxRecus(cle, "envoi-42")).toEqual([
      { numero: 1, etag: '"a"', taille: 10485760 },
      { numero: 2, etag: '"b"', taille: 10485760 },
    ]);
    await s.multipart!.terminer(cle, "envoi-42", [{ numero: 2, etag: '"b"' }, { numero: 1, etag: '"a"' }]);
    const fin = appels[appels.length - 1];
    expect(fin.methode).toBe("POST");
    // Morceaux remis dans l'ordre, quel que soit l'ordre d'arrivée.
    expect(fin.corps).toBe(corpsFinMultipart([{ numero: 1, etag: '"a"' }, { numero: 2, etag: '"b"' }]));
    expect(fin.corps!.indexOf("<PartNumber>1<")).toBeLessThan(fin.corps!.indexOf("<PartNumber>2<"));
    expect(fin.url.searchParams.get("uploadId")).toBe("envoi-42");
  });

  it("lecture des réponses S3 (PUR)", () => {
    expect(lireMorceaux("<ListPartsResult></ListPartsResult>")).toEqual([]);
    expect(corpsFinMultipart([{ numero: 1, etag: '"x"' }])).toBe('<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>"x"</ETag></Part></CompleteMultipartUpload>');
  });
});

/* ------------------------------------------------------------------ */
describe("envoi par morceaux, avec reprise", () => {
  it("morceaux de 10 à 50 Mo, jamais plus de 10 000", () => {
    expect(tailleMorceau(5 * MO)).toBe(10 * MO);
    expect(tailleMorceau(2 * 1024 * MO)).toBe(10 * MO);
    expect(tailleMorceau(200 * 1024 * MO)).toBe(21 * MO);
    expect(tailleMorceau(10_000 * 1024 * MO)).toBe(50 * MO);
    const m = decouper(25 * MO);
    expect(m.map((x) => x.numero)).toEqual([1, 2, 3]);
    expect(m[2].fin - m[2].debut).toBe(5 * MO);
    expect(decouper(0)).toEqual([{ numero: 1, debut: 0, fin: 0 }]);
  });

  it("reprise : seuls les morceaux absents ou incomplets sont renvoyés", () => {
    const tous = decouper(25 * MO);
    expect(morceauxRestants(tous, [{ numero: 1, taille: 10 * MO }, { numero: 2, taille: 3 }]).map((m) => m.numero)).toEqual([2, 3]);
  });

  function stockageMemoire(): Storage {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } } as Storage;
  }

  it("un envoi interrompu reprend là où il s'est arrêté (morceaux déjà reçus non renvoyés), puis se termine", async () => {
    const contenu = new Uint8Array(25 * MO);
    const fichier = new File([contenu], "rush.mp4", { type: "video/mp4", lastModified: 1 });
    const cible = { typeEntite: "visage", entiteId: "vis-1" };
    const stockage = stockageMemoire();
    const recus = new Map<number, string>();
    const appelsApi: string[] = [];
    const api = async (corps: Record<string, unknown>) => {
      appelsApi.push(String(corps.action));
      switch (corps.action) {
        case "commencer":
          return { fichierId: "f-1", cle: "studio/dev/visage/vis-1/f-1.mp4", idEnvoi: "e-1", tailleMorceau: 10 * MO };
        case "recus":
          return { morceaux: Array.from(recus, ([numero, etag]) => ({ numero, etag, taille: numero === 3 ? 5 * MO : 10 * MO })) };
        case "signer":
          return { adresses: Object.fromEntries((corps.numeros as number[]).map((n) => [n, `https://r2/morceau/${n}`])) };
        case "terminer":
          return { fichierId: corps.fichierId, morceaux: corps.morceaux };
      }
      return {};
    };
    // Premier essai : le morceau 3 échoue toujours (réseau coupé) → l'envoi s'interrompt.
    let coupe = true;
    const envoyes: number[] = [];
    const envoyerMorceau = async (url: string) => {
      const n = Number(url.split("/").pop());
      if (coupe && n === 3) throw new Error("réseau coupé");
      envoyes.push(n);
      recus.set(n, `"e${n}"`);
      return `"e${n}"`;
    };
    vi.useFakeTimers();
    const premier = envoyerFichier(fichier, cible, { api, envoyerMorceau, stockage }).catch((e: Error) => e);
    await vi.runAllTimersAsync();
    expect(await premier).toBeInstanceOf(Error);
    vi.useRealTimers();
    expect(stockage.getItem(cleReprise(fichier, cible))).toBeTruthy();
    expect(envoyes.sort()).toEqual([1, 2]);

    // Reprise : on ne renvoie que le morceau 3.
    coupe = false;
    envoyes.length = 0;
    const progression: number[] = [];
    const r = await envoyerFichier(fichier, cible, { api, envoyerMorceau, stockage, onProgression: (p) => progression.push(p) });
    expect(r).toEqual({ fichierId: "f-1", simulation: false });
    expect(envoyes).toEqual([3]);
    expect(appelsApi.filter((a) => a === "commencer")).toHaveLength(1);
    expect(progression[0]).toBe(80); // 20 Mo sur 25 déjà là
    expect(progression[progression.length - 1]).toBe(100);
    expect(stockage.getItem(cleReprise(fichier, cible))).toBeNull();
  });

  it("sans R2 : aucun octet envoyé, le fichier est enregistré par le studio (simulation)", async () => {
    const r = await envois.commencerEnvoi({ nom: "rush.mp4", mime: "video/mp4", taille: 1234, typeEntite: "visage", entiteId: "vis-1" });
    expect(r.simulation).toBe(true);
    expect(r.idEnvoi).toBeUndefined();
    const f = await envois.terminerEnvoi({ nom: "rush.mp4", mime: "video/mp4", taille: 1234, typeEntite: "visage", entiteId: "vis-1", fichierId: r.fichierId, cle: r.cle });
    expect(f.statut).toBe("pret");
    expect((await depots().fichiers.obtenir(r.fichierId))?.cleStockage).toBe(r.cle);
    // Rien d'autre qu'une clé du studio n'est jamais signé.
    await expect(envois.signerMorceaux("../../autre-seau/x", "e", [1])).rejects.toBeTruthy();
    expect(() => envois.verifierCle("studio/dev/visage/vis-1/../f.mp4")).toThrow();
    await expect(envois.commencerEnvoi({ nom: "x.mp4", mime: "video/mp4", taille: 5 * 1024 ** 3, typeEntite: "visage", entiteId: "vis-1" })).rejects.toMatchObject({ code: "TAILLE_INVALIDE" });
  });
});

/* ------------------------------------------------------------------ */
describe("notifications : téléphone d'abord, e-mail en secours", () => {
  const push = { publique: "BPUB", privee: "PRIV", sujet: "mailto:will@example.com" };
  // Lot R3 : l'e-mail de secours ne part que s'il est configuré (fausse configuration, aucun réseau).
  const emailFaux = { cle: "faux", expediteur: "studio@axion-ia.com", destinataire: "will@example.com", adresse: "https://zepto.invalid", site: "https://studio.axion-ia.com" };
  const abonnement = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" } };

  it("aucune clé VAPID ni service d'e-mail : rien n'est configuré, l'e-mail est simulé", async () => {
    expect(configPush({})).toBeNull();
    expect(configPush({ VAPID_PUBLIQUE: "a", VAPID_PRIVEE: "b", VAPID_SUJET: "x@y.fr" })?.sujet).toBe("mailto:x@y.fr");
    expect(configEmail({})).toBeNull();
    expect(await envoyerEmail(null, { titre: "Votre vidéo est prête" })).toEqual({ envoye: false, simule: true });
  });

  it("abonnement du téléphone : enregistré une fois, le canal passe à « téléphone »", async () => {
    expect(abonnementValide({ endpoint: "http://non-securise", keys: { p256dh: "p", auth: "a" } })).toBe(false);
    await notifications.enregistrerAbonnementPush(abonnement, "iPhone");
    await notifications.enregistrerAbonnementPush(abonnement, "iPhone");
    expect(await notifications.compterAbonnementsPush()).toBe(1);
    expect((await lireParametre<{ canal: string }>("notifications", { canal: "?" })).canal).toBe("telephone");
    await expect(notifications.enregistrerAbonnementPush({ endpoint: "x" }, "iPhone")).rejects.toMatchObject({ code: "ABONNEMENT_INVALIDE" });
  });

  it("« Votre vidéo est prête » part sur le téléphone ; sans téléphone joignable, l'e-mail de secours part", async () => {
    await notifications.enregistrerAbonnementPush(abonnement, "iPhone");
    const pousses: string[] = [];
    const emails: string[] = [];
    const envoyerPushFaux = vi.fn(async (_c, abonnes, charge) => {
      pousses.push(charge.titre);
      return { envoyes: abonnes.length, expires: [] };
    });
    const envoyerEmailFaux = vi.fn(async (_c, n) => {
      emails.push(n.titre);
      return { envoye: true, simule: false };
    });
    await notifications.creerNotification({ type: "video-prete", titre: "Votre vidéo est prête", lien: "/videos/v-04" });
    await notifications.diffuserNotifications({ push, email: emailFaux, envoyerPush: envoyerPushFaux, envoyerEmail: envoyerEmailFaux });
    expect(pousses).toEqual(["Votre vidéo est prête"]);
    expect(emails).toEqual([]);

    // Le navigateur a révoqué l'abonnement : marqué expiré (gardé), et l'e-mail prend le relais.
    const refus = vi.fn(async () => ({ envoyes: 0, expires: [abonnement.endpoint] }));
    await notifications.creerNotification({ type: "echec", titre: "Une étape n'a pas abouti" });
    await notifications.diffuserNotifications({ push, email: emailFaux, envoyerPush: refus, envoyerEmail: envoyerEmailFaux });
    expect(emails).toEqual(["Une étape n'a pas abouti"]);
    const liste = await lireParametre<{ expireLe?: string }[]>("push.abonnements", []);
    expect(liste).toHaveLength(1);
    expect(liste[0].expireLe).toBeTruthy();
  });

  it("préférences respectées : cloche seule, type coupé, exemples jamais envoyés", () => {
    const p = { videoPrete: true, echec: false, budget: true, canal: "telephone" as const };
    expect(notifications.canauxPour({ type: "video-prete" }, { ...p, canal: "console" }, { push: true })).toEqual({ push: false, email: false, emailSiPushEchoue: false });
    expect(notifications.canauxPour({ type: "echec" }, p, { push: true }).push).toBe(false);
    expect(notifications.canauxPour({ type: "video-prete", estDemo: true }, p, { push: true }).push).toBe(false);
    expect(notifications.canauxPour({ type: "plan-a-verifier" }, { ...p, canal: "email" }, { push: true })).toEqual({ push: false, email: true, emailSiPushEchoue: false });
  });

  it("envoyerPush : compte les envois, repère les abonnements révoqués (404/410)", async () => {
    const autre = { ...abonnement, endpoint: "https://web.push.apple.com/xyz" };
    const r = await envoyerPush(push, [abonnement, autre, { ...abonnement, endpoint: "https://ancien", expireLe: "2026-01-01" }], { titre: "T" }, async (a) => {
      if (a.endpoint === autre.endpoint) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      return {};
    });
    expect(r).toEqual({ envoyes: 1, expires: [autre.endpoint] });
  });

  it("e-mail de secours : corps ZeptoMail avec lien vers le studio, texte échappé", () => {
    const c = configEmail({ EMAIL_SECOURS_CLE: "k", EMAIL_SECOURS_EXPEDITEUR: "studio@axion-ia.com", EMAIL_SECOURS_DESTINATAIRE: "will@axion-ia.com" })!;
    const corps = corpsEmail(c, { titre: "Votre vidéo est prête", message: "« A <b> »", lien: "/videos/v-1" });
    expect(corps.to[0].email_address.address).toBe("will@axion-ia.com");
    expect(corps.htmlbody).toContain("https://studio.axion-ia.com/videos/v-1");
    expect(corps.htmlbody).toContain("&lt;b&gt;");
  });
});

/* ------------------------------------------------------------------ */
describe("tableau des coûts : par outil, coût moyen, écart annoncé / réel", () => {
  const ligne = (fournisseur: string, c: number) => ({ etape: "x", fournisseur, unite: "forfait" as const, quantite: 1, prixUnitaire: { centimes: c, devise: "EUR" as const }, total: { centimes: c, devise: "EUR" as const }, nature: "reel" as const });

  it("calcul pur", () => {
    const depenses = [
      { id: "d1", date: "2026-10-03T10:00:00Z", lignes: [ligne("heygen", 300), ligne("simulation", 20)], total: { centimes: 320, devise: "EUR" } },
      { id: "d2", date: "2026-10-04T10:00:00Z", lignes: [ligne("heygen", 100), ligne("fal", 50)], total: { centimes: 150, devise: "EUR" } },
      { id: "d3", date: "2026-09-04T10:00:00Z", lignes: [ligne("heygen", 999)], total: { centimes: 999, devise: "EUR" } },
    ] as DepenseEnregistree[];
    const videos = [
      { id: "v1", terminee: "2026-10-03T10:00:00Z", coutEstime: { centimes: 300, devise: "EUR" }, coutReel: { centimes: 320, devise: "EUR" } },
      { id: "v2", terminee: "2026-10-04T10:00:00Z", coutEstime: { centimes: 200, devise: "EUR" }, coutReel: { centimes: 150, devise: "EUR" } },
      { id: "v3", terminee: "2026-09-04T10:00:00Z", coutEstime: { centimes: 1, devise: "EUR" }, coutReel: { centimes: 999, devise: "EUR" } },
    ] as Video[];
    const t = couts.calculerTableauCouts(depenses, videos, "2026-10", 0.92);
    expect(t.parOutil.map((o) => [o.nom, o.total.centimes])).toEqual([
      ["HeyGen", 400],
      ["fal.ai", 50],
      ["Essais (rien n'est payé)", 20],
    ]);
    expect(t.nbVideos).toBe(2);
    expect(t.coutMoyen?.centimes).toBe(235);
    expect(t.ecart).toEqual({ estime: { centimes: 500, devise: "EUR" }, reel: { centimes: 470, devise: "EUR" }, pourcentage: -6 });
    expect(couts.calculerTableauCouts([], [], "2026-10", 0.9)).toMatchObject({ parOutil: [], coutMoyen: null, ecart: null });
  });

  it("taux dollar → euro : validé et enregistré ; alerte « budget à 80 % » une seule fois par mois", async () => {
    await couts.definirTauxUsdEur(0.93);
    expect(await lireParametre<number>("taux.usdEur", 0)).toBe(0.93);
    await expect(couts.definirTauxUsdEur(7)).rejects.toMatchObject({ code: "TAUX_INVALIDE" });
    await ecrireParametre("budget.mensuel", { centimes: 100, devise: "EUR" });
    await depots().depenses.enregistrer({ id: "dep-test", lignes: [], total: { centimes: 90, devise: "EUR" }, date: new Date().toISOString(), creeLe: "", modifieLe: "" });
    const alerte = await couts.alerteBudget();
    expect(alerte?.type).toBe("budget");
    // L3-01 : la marque du mois est posée par l'envoi réussi (`envoyerAlerteBudget`), plus par la lecture.
    expect(await couts.envoyerAlerteBudget(async () => undefined)).toBe(true);
    expect(await couts.alerteBudget()).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
describe("crochet HeyGen : réveil sans confiance", () => {
  const secret = "secret-crochet";

  it("non signé ou mal signé : refusé (401), rien n'est enregistré", async () => {
    const r = await crochets.recevoirCrochetHeygen({ corps: JSON.stringify({ callback_id: "cb-1" }), signature: "faux" }, secret);
    expect(r.statut).toBe(401);
    expect(await depots().evenementsFournisseurs.compter()).toBe(0);
  });

  it("signé : journalisé en EvenementFournisseur (contenu ignoré sauf callback_id), dédoublonné, travail réveillé", async () => {
    const t = (await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file"))[0];
    await depots().travaux.enregistrer({ ...t, idExterne: "cb-1", reprise: { echecs: 4, premiereLe: "2026-10-01T00:00:00Z", attenteDepuis: "2026-10-01T00:00:00Z", prochainEssai: "2099-01-01T00:00:00Z" } });
    const corps = JSON.stringify({ event_id: "ev-1", event_type: "avatar_video.success", event_data: { callback_id: "cb-1", url: "https://piege.example/fichier.mp4" } });
    const r = await crochets.recevoirCrochetHeygen({ corps, signature: crochets.signatureCrochet(secret, corps) }, secret);
    expect(r).toMatchObject({ statut: 200, reveilles: [t.id] });
    const ev = (await depots().evenementsFournisseurs.lister())[0];
    expect(ev).toMatchObject({ fournisseur: "heygen", idEvenement: "ev-1", traite: true });
    expect(JSON.stringify(ev.charge)).not.toContain("piege");
    expect(new Date((await depots().travaux.obtenir(t.id))!.reprise!.prochainEssai).getFullYear()).toBeLessThan(2099);
    // Même événement une seconde fois : rien de plus.
    const deux = await crochets.recevoirCrochetHeygen({ corps, signature: crochets.signatureCrochet(secret, corps) }, secret);
    expect(deux.corps).toMatchObject({ deja: true });
    expect(await depots().evenementsFournisseurs.compter()).toBe(1);
  });

  it("adresse de rappel signée par le studio (sans en-tête de signature)", async () => {
    const adresse = new URL(crochets.adresseCrochetHeygen("https://studio.axion-ia.com", "cb-9", secret));
    expect(adresse.pathname).toBe("/api/crochets/heygen");
    const ok = await crochets.recevoirCrochetHeygen({ corps: JSON.stringify({ callback_id: "cb-9" }), idAdresse: adresse.searchParams.get("id"), sigAdresse: adresse.searchParams.get("sig") }, secret);
    expect(ok.statut).toBe(200);
    // Un autre callback_id dans le corps que celui de l'adresse : refusé.
    const ko = await crochets.recevoirCrochetHeygen({ corps: JSON.stringify({ callback_id: "cb-autre" }), idAdresse: "cb-9", sigAdresse: adresse.searchParams.get("sig") }, secret);
    expect(ko.statut).toBe(401);
  });

  it("route : 501 tant que HEYGEN_WEBHOOK_SECRET n'existe pas", async () => {
    delete process.env.HEYGEN_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/crochets/[fournisseur]/route");
    const { NextRequest } = await import("next/server");
    const r = await POST(new NextRequest("http://localhost/api/crochets/heygen", { method: "POST", body: "{}" }), { params: Promise.resolve({ fournisseur: "heygen" }) });
    expect(r.status).toBe(501);
    // Import à froid de la route et de next/server : plusieurs secondes quand la machine est chargée.
  }, 30_000);
});
