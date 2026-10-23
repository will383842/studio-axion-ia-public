/**
 * LOT R3 — Notifications sur le téléphone et par e-mail (PLAN-OUTILS-REELS-2026-10-03, constat C4).
 * Le code Web Push (VAPID) et ZeptoMail existait ; il était coupé de l'écran et ignorait la carte « Notifications »
 * de Réglages > Connexions. Ces tests le relient. AUCUN envoi réel : faux transports, fausses clés, aucun réseau.
 *
 * ROUGES prouvés sur 03d297b (avant le lot) :
 *  - « carte en simulation → aucun envoi » (l'ancien service envoyait dès que les clés existaient) ;
 *  - « options actives quand configurées » (l'écran affichait « Bientôt » quoi qu'il arrive).
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

// Fausses clés, posées AVANT le chargement du registre des fournisseurs (il lit l'environnement une fois).
const FAUSSE_PRIVEE = "PRIVEE-SECRETE-r3-0000";
const FAUX_JETON = "JETON-ZEPTO-SECRET-r3-9999";
vi.stubEnv("VAPID_PUBLIQUE", "BPUBLIQUE-r3");
vi.stubEnv("VAPID_PRIVEE", FAUSSE_PRIVEE);
vi.stubEnv("VAPID_SUJET", "mailto:contact@axion-ia.com");
vi.stubEnv("EMAIL_SECOURS_CLE", FAUX_JETON);
vi.stubEnv("EMAIL_SECOURS_EXPEDITEUR", "studio@axion-ia.com");
vi.stubEnv("EMAIL_SECOURS_DESTINATAIRE", "will@example.com");
vi.stubEnv("FOURNISSEUR_NOTIFICATION", "");

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const notifications = await import("@/services/notifications");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

const MDP_TEST = "essai-r3-notifications";
const ABONNEMENT = { endpoint: "https://web.push.apple.com/r3-iphone", keys: { p256dh: "p", auth: "a" } };

/** Faux transports : comptent, n'envoient rien. */
function fauxTransports() {
  const pousses: { titre: string; appareils: number }[] = [];
  const emails: { titre: string; lien?: string }[] = [];
  return {
    pousses,
    emails,
    envoyerPush: vi.fn(async (_c: unknown, abonnes: unknown[], charge: { titre: string }) => {
      pousses.push({ titre: charge.titre, appareils: abonnes.length });
      return { envoyes: abonnes.length, expires: [] as string[] };
    }),
    envoyerEmail: vi.fn(async (_c: unknown, n: { titre: string; lien?: string }) => {
      emails.push({ titre: n.titre, lien: n.lien });
      return { envoye: true, simule: false };
    }),
  };
}

async function relierCarte() {
  await ecrireParametre("fournisseur.notification", "web-push-email");
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "r".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
  // Vider la file d'envoi laissée par un test précédent (sans rien envoyer).
  await notifications.diffuserNotifications({ push: null, email: null, envoyerPush: async () => ({ envoyes: 0, expires: [] }), envoyerEmail: async () => ({ envoye: false, simule: true }) });
});

/* ------------------------------------------------------------------ */
describe("R3 · la carte « Notifications » décide (écrit et éteint)", () => {
  it("ROUGE — carte en simulation : clés présentes, téléphone abonné, AUCUN envoi (ni téléphone ni e-mail)", async () => {
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    await ecrireParametre("notifications", { videoPrete: true, echec: true, budget: true, canal: "telephone" });
    const t = fauxTransports();
    await notifications.creerNotification({ type: "video-prete", titre: "Votre vidéo est prête", lien: "/videos/v-1" });
    await notifications.creerNotification({ type: "budget", titre: "Budget presque atteint" }, { email: true });
    await notifications.diffuserNotifications({ envoyerPush: t.envoyerPush, envoyerEmail: t.envoyerEmail });
    expect(t.envoyerPush).not.toHaveBeenCalled();
    expect(t.envoyerEmail).not.toHaveBeenCalled();
    // La cloche, elle, a tout reçu.
    expect(await depots().notifications.compter((n) => !n.estDemo && (n.titre === "Votre vidéo est prête" || n.titre === "Budget presque atteint"))).toBe(2);
  });

  it("carte reliée (« web-push-email ») : le téléphone reçoit, l'e-mail ne part qu'en secours", async () => {
    await relierCarte();
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    const t = fauxTransports();
    await notifications.creerNotification({ type: "video-prete", titre: "Votre vidéo est prête", lien: "/videos/v-1" });
    await notifications.diffuserNotifications({ envoyerPush: t.envoyerPush, envoyerEmail: t.envoyerEmail });
    expect(t.pousses).toEqual([{ titre: "Votre vidéo est prête", appareils: 1 }]);
    expect(t.emails).toEqual([]);
  });

  it("carte reliée, canal « E-mail » : un seul e-mail, aucun envoi au téléphone", async () => {
    await relierCarte();
    await ecrireParametre("notifications", { videoPrete: true, echec: true, budget: true, canal: "email" });
    const t = fauxTransports();
    await notifications.creerNotification({ type: "echec", titre: "Une étape n'a pas abouti", lien: "/videos/v-2" });
    await notifications.diffuserNotifications({ envoyerPush: t.envoyerPush, envoyerEmail: t.envoyerEmail });
    expect(t.emails).toHaveLength(1);
    expect(t.envoyerPush).not.toHaveBeenCalled();
  });

  it("la clé publique n'est donnée au téléphone que si la carte est reliée", async () => {
    expect(await notifications.clePubliquePush()).toBeNull();
    await relierCarte();
    expect(await notifications.clePubliquePush()).toBe("BPUBLIQUE-r3");
  });
});

/* ------------------------------------------------------------------ */
describe("R3 · inscription du fournisseur réel", () => {
  it("inscrit « web-push-email » seulement avec ses variables (téléphone OU e-mail) ; jamais avec des clés partielles", async () => {
    const { notificationsReelles, ID_NOTIFICATIONS_REELLES } = await import("@/fournisseurs/notification/inscription");
    expect(ID_NOTIFICATIONS_REELLES).toBe("web-push-email");
    expect(notificationsReelles({})).toEqual({});
    expect(notificationsReelles({ VAPID_PUBLIQUE: "a", VAPID_PRIVEE: "b" })).toEqual({});
    const telephone = notificationsReelles({ VAPID_PUBLIQUE: "a", VAPID_PRIVEE: "b", VAPID_SUJET: "contact@axion-ia.com" });
    expect(Object.keys(telephone)).toEqual(["web-push-email"]);
    expect(telephone["web-push-email"].mode).toBe("reel");
    const email = notificationsReelles({ EMAIL_SECOURS_CLE: "k", EMAIL_SECOURS_EXPEDITEUR: "studio@axion-ia.com", EMAIL_SECOURS_DESTINATAIRE: "will@example.com" });
    expect(Object.keys(email)).toEqual(["web-push-email"]);
  });

  it("le registre propose « web-push-email » (une ligne dans fournisseurs/index.ts) et la simulation reste le défaut", async () => {
    const { etatConnexion, resoudreFournisseur } = await import("@/fournisseurs");
    expect(resoudreFournisseur("notification").mode).toBe("simulation");
    expect(etatConnexion("notification", "web-push-email")).toBe("relie");
    expect(resoudreFournisseur("notification", "web-push-email").id).toBe("web-push-email");
  });
});

/* ------------------------------------------------------------------ */
describe("R3 · « Envoyer un essai » : un essai = un message", () => {
  it("carte en simulation : refusé, rien ne part", async () => {
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    const t = fauxTransports();
    await expect(notifications.envoyerEssai("telephone", t)).rejects.toMatchObject({ code: "NOTIFICATIONS_SIMULATION" });
    await expect(notifications.envoyerEssai("email", t)).rejects.toMatchObject({ code: "NOTIFICATIONS_SIMULATION" });
    expect(t.envoyerPush).not.toHaveBeenCalled();
    expect(t.envoyerEmail).not.toHaveBeenCalled();
  });

  it("téléphone : un seul envoi, à chaque appareil actif, sans e-mail de secours ; un second clic aussitôt est refusé", async () => {
    await relierCarte();
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    await notifications.enregistrerAbonnementPush({ ...ABONNEMENT, endpoint: "https://fcm.googleapis.com/fcm/send/r3-android" }, "Android");
    const t = fauxTransports();
    const r = await notifications.envoyerEssai("telephone", t);
    expect(r).toMatchObject({ canal: "telephone", recus: 2 });
    expect(t.envoyerPush).toHaveBeenCalledTimes(1);
    expect(t.envoyerEmail).not.toHaveBeenCalled();
    await expect(notifications.envoyerEssai("telephone", t)).rejects.toMatchObject({ code: "ESSAI_TROP_TOT" });
    expect(t.envoyerPush).toHaveBeenCalledTimes(1);
  });

  it("e-mail : exactement un e-mail, lien vers les réglages", async () => {
    await relierCarte();
    const t = fauxTransports();
    const r = await notifications.envoyerEssai("email", t);
    expect(r).toMatchObject({ canal: "email", recus: 1 });
    expect(t.emails).toEqual([{ titre: expect.stringContaining("Essai"), lien: "/reglages#notifications" }]);
    expect(t.envoyerPush).not.toHaveBeenCalled();
  });

  it("téléphone sans appareil : refusé avec une consigne claire, rien ne part", async () => {
    await relierCarte();
    const t = fauxTransports();
    await expect(notifications.envoyerEssai("telephone", t)).rejects.toMatchObject({ code: "AUCUN_APPAREIL" });
    expect(t.envoyerPush).not.toHaveBeenCalled();
  });

  it("aucun secret dans le journal ni dans la vue de l'écran", async () => {
    await relierCarte();
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    await notifications.envoyerEssai("telephone", fauxTransports());
    await notifications.envoyerEssai("email", fauxTransports());
    const journal = JSON.stringify(await depots().evenements.lister());
    const vue = JSON.stringify(await notifications.vueNotifications());
    for (const texte of [journal, vue]) {
      expect(texte).not.toContain(FAUSSE_PRIVEE);
      expect(texte).not.toContain(FAUX_JETON);
      expect(texte).not.toContain(ABONNEMENT.endpoint);
    }
  });

  it("un abonnement refusé par le navigateur pendant l'essai est marqué expiré, jamais effacé", async () => {
    await relierCarte();
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    const refus = vi.fn(async () => ({ envoyes: 0, expires: [ABONNEMENT.endpoint] }));
    const r = await notifications.envoyerEssai("telephone", { envoyerPush: refus });
    expect(r.recus).toBe(0);
    const liste = await lireParametre<{ expireLe?: string }[]>("push.abonnements", []);
    expect(liste).toHaveLength(1);
    expect(liste[0].expireLe).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
describe("R3 · vue de l'écran et choix du canal", () => {
  it("vue : carte, appareils, ce qui est prêt (aucun nom de réglage)", async () => {
    expect(await notifications.vueNotifications()).toMatchObject({ carte: "simulation", telephonePret: false, emailPret: false, appareils: 0 });
    await relierCarte();
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    expect(await notifications.vueNotifications()).toMatchObject({ carte: "relie", telephonePret: true, emailPret: true, appareils: 1, destinataire: "will@example.com" });
  });

  it("le canal « Téléphone » ou « E-mail » n'est accepté que s'il est prêt", async () => {
    const reglages = await import("@/services/reglages");
    await expect(reglages.definirNotifications({ videoPrete: true, echec: true, budget: true, canal: "email" })).rejects.toMatchObject({ code: "CANAL_INDISPONIBLE" });
    await relierCarte();
    await reglages.definirNotifications({ videoPrete: true, echec: true, budget: true, canal: "email" });
    expect((await lireParametre<{ canal: string }>("notifications", { canal: "?" })).canal).toBe("email");
  });
});

/* ------------------------------------------------------------------ */
describe("R3 · écran Réglages > Notifications (rendu, sans navigateur)", () => {
  const initiales = { videoPrete: true, echec: true, budget: true, canal: "console" as const };
  const serveurPret = { carte: "relie" as const, telephonePret: true, emailPret: true, appareils: 1, destinataire: "will@example.com" };
  const serveurSimulation = { carte: "simulation" as const, telephonePret: false, emailPret: false, appareils: 0, destinataire: null };

  // Premier chargement de l'écran (graphe des composants) : lent sur une machine chargée, fait une fois.
  beforeAll(async () => {
    await import("@/components/reglages/Preferences");
  }, 60_000);

  async function rendre(serveur: typeof serveurPret | typeof serveurSimulation) {
    const { ReglagesNotifications } = await import("@/components/reglages/Preferences");
    return renderToStaticMarkup(createElement(ReglagesNotifications, { initiales, serveur } as never));
  }

  function bouton(html: string, libelle: string): string {
    const m = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].map((x) => x[0]).find((b) => b.includes(libelle));
    if (!m) throw new Error(`bouton « ${libelle} » absent`);
    return m;
  }

  it("ROUGE — options « Téléphone » et « E-mail » actives quand le serveur est prêt (plus de « Bientôt »)", async () => {
    const html = await rendre(serveurPret);
    expect(html).not.toContain("Bientôt");
    expect(bouton(html, "Téléphone")).not.toMatch(/ disabled=""/);
    expect(bouton(html, "E-mail")).not.toMatch(/ disabled=""/);
    expect(html).toContain("Envoyer un essai");
    expect(html).toContain("1 appareil");
  });

  it("carte en simulation : options fermées avec la raison, aucun bouton d'essai", async () => {
    const html = await rendre(serveurSimulation);
    expect(html).not.toContain("Bientôt");
    expect(bouton(html, "Téléphone")).toMatch(/ disabled=""/);
    expect(html).toContain("Connexions");
    expect(html).not.toContain("Envoyer un essai");
  });

  it("iPhone : l'écran dit simplement d'ajouter le studio à l'écran d'accueil", async () => {
    const { VueCeTelephone } = await import("@/components/reglages/NotificationsTelephone");
    const html = renderToStaticMarkup(createElement(VueCeTelephone, { etat: "ecran-accueil", onActiver: () => undefined }));
    expect(html).toContain("écran d&#x27;accueil");
    expect(html).toContain("Partager");
    expect(html).toContain("16.4");
    const a = renderToStaticMarkup(createElement(VueCeTelephone, { etat: "a-activer", onActiver: () => undefined }));
    expect(a).toContain("Activer sur ce téléphone");
  });

  it("état du téléphone (pur) : iPhone hors écran d'accueil, refus, activées", async () => {
    const { etatTelephone } = await import("@/components/coquille/EnregistrementPwa");
    const base = { production: true, ios: false, installe: false, pushPossible: true, cle: "B", cetAppareilActif: true, permission: "default" as NotificationPermission };
    expect(etatTelephone({ ...base, ios: true, pushPossible: false })).toBe("ecran-accueil");
    expect(etatTelephone({ ...base, ios: true, installe: true })).toBe("a-activer");
    expect(etatTelephone({ ...base, pushPossible: false })).toBe("navigateur");
    expect(etatTelephone({ ...base, cle: null })).toBe("serveur");
    expect(etatTelephone({ ...base, permission: "denied" })).toBe("refusees");
    expect(etatTelephone({ ...base, permission: "granted" })).toBe("actives");
    expect(etatTelephone({ ...base, production: false })).toBe("indisponible");
  });
});

/* ------------------------------------------------------------------ */
describe("R3 · e-mail : liens absolus, rien d'extérieur, aucun secret", () => {
  it("corps ZeptoMail : lien absolu vers le studio, lien extérieur refusé, jeton absent du corps, réponse vers contact@", async () => {
    const { configEmail, corpsEmail } = await import("@/fournisseurs/notification/email");
    const c = configEmail({ EMAIL_SECOURS_CLE: FAUX_JETON, EMAIL_SECOURS_EXPEDITEUR: "studio@axion-ia.com", EMAIL_SECOURS_DESTINATAIRE: "will@example.com" })!;
    const interne = corpsEmail(c, { titre: "Votre vidéo est prête", lien: "/videos/v-1" });
    expect(interne.htmlbody).toContain('href="https://studio.axion-ia.com/videos/v-1"');
    expect(interne.textbody).toContain("https://studio.axion-ia.com/videos/v-1");
    const exterieur = corpsEmail(c, { titre: "T", lien: "https://exemple.invalid/piege" });
    expect(exterieur.htmlbody).not.toContain("exemple.invalid");
    expect(JSON.stringify(interne)).not.toContain(FAUX_JETON);
    expect(interne.reply_to).toEqual([{ address: "contact@axion-ia.com", name: "Axion-IA" }]);
  });

  it("adresses mal formées ou « noreply@ » : configuration refusée (DMARC p=reject, référentiel e-mail du site)", async () => {
    const { configEmail } = await import("@/fournisseurs/notification/email");
    expect(configEmail({ EMAIL_SECOURS_CLE: "k", EMAIL_SECOURS_EXPEDITEUR: "noreply@axion-ia.com", EMAIL_SECOURS_DESTINATAIRE: "will@example.com" })).toBeNull();
    expect(configEmail({ EMAIL_SECOURS_CLE: "k", EMAIL_SECOURS_EXPEDITEUR: "studio@axion-ia.com", EMAIL_SECOURS_DESTINATAIRE: "pas-une-adresse" })).toBeNull();
  });

  it("e-mail refusé par ZeptoMail : le statut est rendu, jamais le jeton", async () => {
    const { configEmail, envoyerEmail } = await import("@/fournisseurs/notification/email");
    const c = configEmail({ EMAIL_SECOURS_CLE: FAUX_JETON, EMAIL_SECOURS_EXPEDITEUR: "studio@axion-ia.com", EMAIL_SECOURS_DESTINATAIRE: "will@example.com" })!;
    const faux = vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    const r = await envoyerEmail(c, { titre: "T" }, faux);
    expect(r).toEqual({ envoye: false, simule: false, statut: 401 });
    expect(JSON.stringify(r)).not.toContain(FAUX_JETON);
  });
});

/* ------------------------------------------------------------------ */
describe("R3 · serveur : la carte arrive au conteneur", () => {
  const lire = (chemin: string) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
  it("FOURNISSEUR_NOTIFICATION est transmis par le compose et documenté (vide) dans env.exemple", () => {
    expect(lire("deploiement/docker-compose.yml")).toContain("FOURNISSEUR_NOTIFICATION: ${FOURNISSEUR_NOTIFICATION:-}");
    expect(lire("deploiement/env.exemple").split(/\r?\n/)).toContain("FOURNISSEUR_NOTIFICATION=");
  });
});

/* ------------------------------------------------------------------ */
/* Relecture du lot (03/10) : simplicité refusée, six corrections.      */
/* ------------------------------------------------------------------ */
describe("R3 relecture · 1. aucun nom technique à l'écran", () => {
  const initiales = { videoPrete: true, echec: true, budget: true, canal: "console" as const };
  /** Texte visible (balises retirées) : aucun NOM_DE_VARIABLE, aucun nom de service technique. */
  function sansJargon(html: string) {
    const texte = html.replace(/<[^>]+>/g, " ");
    expect(texte).not.toMatch(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/);
    expect(texte).not.toMatch(/VAPID|ZeptoMail|jeton|serveur/i);
  }

  beforeAll(async () => {
    await import("@/components/reglages/Preferences");
  }, 60_000);

  it("ROUGE — carte reliée mais rien de prêt : une phrase simple par canal, aucun nom de réglage", async () => {
    const { ReglagesNotifications } = await import("@/components/reglages/Preferences");
    const serveur = { carte: "relie", telephonePret: false, emailPret: false, appareils: 0, destinataire: null, manque: ["VAPID_PUBLIQUE", "EMAIL_SECOURS_CLE"] };
    const html = renderToStaticMarkup(createElement(ReglagesNotifications, { initiales, serveur } as never));
    sansJargon(html);
    expect(html).toContain("Le téléphone n&#x27;est pas encore prêt");
    expect(html).toContain("L&#x27;e-mail n&#x27;est pas encore prêt");
  });

  it("ROUGE — chaque état du téléphone se lit sans mot technique", async () => {
    const { VueCeTelephone } = await import("@/components/reglages/NotificationsTelephone");
    for (const etat of ["verification", "indisponible", "ecran-accueil", "navigateur", "serveur", "a-activer", "actives", "refusees"] as const) {
      sansJargon(renderToStaticMarkup(createElement(VueCeTelephone, { etat, onActiver: () => undefined })));
    }
  });

  it("ROUGE — e-mail refusé : message simple, et le journal (affiché dans Réglages) sans code ni nom de service", async () => {
    await relierCarte();
    const refus = vi.fn(async () => ({ envoye: false, simule: false, statut: 401 }));
    const erreur = await notifications.envoyerEssai("email", { envoyerEmail: refus }).catch((e: Error) => e);
    expect(erreur).toBeInstanceOf(Error);
    expect((erreur as Error).message).toMatch(/L'e-mail n'a pas pu partir/);
    expect((erreur as Error).message).not.toMatch(/ZeptoMail|jeton|401/);
    const journal = (await depots().evenements.lister()).map((e) => e.message).join("\n");
    expect(journal).not.toMatch(/ZeptoMail|jeton|401|code/);
  });
});

describe("R3 relecture · 2. deux appuis simultanés = un seul essai", () => {
  it("ROUGE — deux essais lancés en même temps : un seul message part, l'autre est refusé", async () => {
    await relierCarte();
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    const lent = vi.fn(async (_c: unknown, abonnes: unknown[]) => {
      await new Promise((r) => setTimeout(r, 20));
      return { envoyes: abonnes.length, expires: [] as string[] };
    });
    // Base lente (comme Postgres en ligne) : chaque lecture de réglage prend quelques millisecondes.
    const parametres = depots().parametres;
    const lire = parametres.obtenir.bind(parametres);
    const espion = vi.spyOn(parametres, "obtenir").mockImplementation(async (id: string) => {
      await new Promise((r) => setTimeout(r, 5));
      return lire(id);
    });
    let r: PromiseSettledResult<unknown>[];
    try {
      r = await Promise.allSettled([notifications.envoyerEssai("telephone", { envoyerPush: lent }), notifications.envoyerEssai("telephone", { envoyerPush: lent })]);
    } finally {
      espion.mockRestore();
    }
    expect(lent).toHaveBeenCalledTimes(1);
    expect(r.filter((x) => x.status === "rejected")).toHaveLength(1);
  });
});

describe("R3 relecture · 3. après un abonnement expiré, le bouton revient", () => {
  it("ROUGE — autorisation toujours donnée mais aucun appareil actif sur le serveur : « Activer » est proposé", async () => {
    const { etatTelephone } = await import("@/components/coquille/EnregistrementPwa");
    const base = { production: true, ios: false, installe: false, pushPossible: true, cle: "B", permission: "granted" as NotificationPermission };
    expect(etatTelephone({ ...base, cetAppareilActif: true })).toBe("actives");
    expect(etatTelephone({ ...base, cetAppareilActif: false })).toBe("a-activer");
  });

  it("ROUGE — c'est CET appareil qui compte : B expiré pendant que A reste actif → B revoit « Activer »", async () => {
    const A = { ...ABONNEMENT, endpoint: "https://fcm.googleapis.com/fcm/send/r3-A" };
    const B = { ...ABONNEMENT, endpoint: "https://web.push.apple.com/r3-B" };
    await notifications.enregistrerAbonnementPush(A, "Android");
    await notifications.enregistrerAbonnementPush(B, "iPhone");
    await relierCarte();
    await notifications.envoyerEssai("telephone", { envoyerPush: async () => ({ envoyes: 1, expires: [B.endpoint] }) });
    expect(await notifications.compterAbonnementsPush()).toBe(1);
    expect(await notifications.abonnementActif(A.endpoint)).toBe(true);
    expect(await notifications.abonnementActif(B.endpoint)).toBe(false);
    expect(await notifications.abonnementActif("https://web.push.apple.com/inconnu")).toBe(false);
    expect(await notifications.abonnementActif(42 as never)).toBe(false);
    const { etatTelephone } = await import("@/components/coquille/EnregistrementPwa");
    const telephoneB = { production: true, ios: true, installe: true, pushPossible: true, cle: "B", permission: "granted" as NotificationPermission };
    expect(etatTelephone({ ...telephoneB, cetAppareilActif: await notifications.abonnementActif(B.endpoint) })).toBe("a-activer");
  });

  it("la vérification exige une session (aucune adresse n'est jamais renvoyée)", async () => {
    await auth.seDeconnecter();
    await expect(notifications.abonnementActif(ABONNEMENT.endpoint)).rejects.toBeTruthy();
  });

  it("ROUGE — un abonnement marqué expiré, renvoyé tel quel par le navigateur, n'est pas ranimé", async () => {
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    await relierCarte();
    await notifications.envoyerEssai("telephone", { envoyerPush: async () => ({ envoyes: 0, expires: [ABONNEMENT.endpoint] }) });
    await notifications.enregistrerAbonnementPush(ABONNEMENT, "iPhone");
    expect(await notifications.compterAbonnementsPush()).toBe(0);
    expect(await lireParametre<unknown[]>("push.abonnements", [])).toHaveLength(1);
  });
});

describe("R3 relecture · 4. veille : carte en simulation, clés posées", () => {
  it("garde-fou — le résumé du lundi n'appelle JAMAIS ZeptoMail (aucune requête réseau)", async () => {
    const veille = await import("@/services/veille");
    const reseau = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", reseau);
    try {
      expect(await veille.envoyerResumeHebdo({ maintenant: () => new Date("2026-10-05T06:10:00Z") })).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(reseau).not.toHaveBeenCalled();
  });
});

describe("R3 relecture · 5. abonnements : services connus seulement, 20 au plus", () => {
  it("ROUGE — seuls les services de notification des navigateurs sont acceptés", async () => {
    const { abonnementValide } = await import("@/fournisseurs/notification/push");
    const cles = { p256dh: "p", auth: "a" };
    for (const ok of ["https://fcm.googleapis.com/fcm/send/x", "https://web.push.apple.com/x", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://wns2-db5p.notify.windows.com/w/?token=x"]) {
      expect(abonnementValide({ endpoint: ok, keys: cles }), ok).toBe(true);
    }
    for (const non of ["https://exemple.invalid/x", "https://fcm.googleapis.com.exemple.invalid/x", "https://notify.windows.com.exemple.invalid/x", "http://fcm.googleapis.com/x"]) {
      expect(abonnementValide({ endpoint: non, keys: cles }), non).toBe(false);
    }
  });

  it("ROUGE — au-delà de 20 appareils actifs, refusé (rien n'est effacé)", async () => {
    for (let i = 0; i < 20; i++) await notifications.enregistrerAbonnementPush({ ...ABONNEMENT, endpoint: `https://fcm.googleapis.com/fcm/send/n${i}` }, "Android");
    await expect(notifications.enregistrerAbonnementPush({ ...ABONNEMENT, endpoint: "https://fcm.googleapis.com/fcm/send/n20" }, "Android")).rejects.toMatchObject({ code: "TROP_D_APPAREILS" });
    expect(await notifications.compterAbonnementsPush()).toBe(20);
  });
});
