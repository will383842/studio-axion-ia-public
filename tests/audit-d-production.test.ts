/**
 * AUDIT D — Production (correcteur 2) : B9 boucle surveillée, B10 notifications persistées, un seul réplica,
 * fichiers temporaires de studio-rendu, copie hors site des sauvegardes. Aucune clé, aucun appel réseau réel :
 * moteurs, transports et `fetch` sont des faux.
 *
 * ROUGES prouvés sur d186500 (avant la correction) : voir docs/controles/CORRECTEUR-2-PRODUCTION.md.
 */
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const boucle = await import("@/services/boucle");
const sante = await import("@/services/sante");
const notifications = await import("@/services/notifications");
const { ecrireParametre } = await import("@/services/_commun");

const MDP_TEST = "essai-audit-d-production";

beforeAll(async () => {
  process.env.SESSION_SECRET = "d".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

afterEach(() => {
  boucle.arreterBoucle();
  const e = boucle.etatBoucle();
  Object.assign(e, { enCours: false, dernierTour: undefined, demarreLe: undefined, attenteVerrouDepuis: undefined });
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
describe("B9 · /api/sante voit une boucle bloquée", () => {
  it("ROUGE — boucle active, dernier tour il y a 4 min : la sonde n'est plus « ok » (503)", async () => {
    const e = boucle.etatBoucle();
    e.active = true;
    e.demarreLe = Date.now() - 10 * 60_000;
    e.dernierTour = Date.now() - 4 * 60_000;
    const etat = await sante.etatSante();
    expect(etat.ok).toBe(false);
    expect(etat.boucle).toBe("bloquee");
    const { GET } = await import("@/app/api/sante/route");
    expect((await GET()).status).toBe(503);
    e.active = false;
  });

  it("garde d'exécution des bases : empreinte attendue = embarquée → ok ; autre → écart sans jamais rendre la sonde 503 ; rien d'enregistré → non défini", async () => {
    const emb = "a".repeat(64);
    expect(sante.santeBases(emb, emb).etat).toBe("ok");
    expect(sante.santeBases(emb, "b".repeat(64))).toMatchObject({ etat: "ecart", empreinte: emb });
    expect(sante.santeBases(emb, null).etat).toBe("non-defini");
    const { sourceDesBases } = await import("@/donnees/bases-usine");
    const vide = await sante.etatSante();
    expect(vide.bases).toEqual({ empreinte: sourceDesBases().empreinte, attendue: null, etat: "non-defini" });
    await sante.enregistrerEmpreinteBasesAttendue("c".repeat(64));
    const ecart = await sante.etatSante();
    expect(ecart.bases.etat).toBe("ecart");
    expect(ecart.ok).toBe(vide.ok);
    await sante.enregistrerEmpreinteBasesAttendue(sourceDesBases().empreinte);
    expect((await sante.etatSante()).bases.etat).toBe("ok");
  });

  it("au démarrage (aucun tour fini, lancée il y a 30 s) : en bonne santé ; au-delà de 3 min sans tour : bloquée", () => {
    const t = 1_000_000_000;
    expect(sante.santeBoucle({ active: true, demarreLe: t - 30_000 }, t)).toBe("demarrage");
    expect(sante.santeBoucle({ active: true, demarreLe: t - 4 * 60_000 }, t)).toBe("bloquee");
    expect(sante.santeBoucle({ active: true, demarreLe: t - 60 * 60_000, dernierTour: t - 60_000 }, t)).toBe("ok");
    // Coupure de secours (STUDIO_BOUCLE=0) ou développement : la boucle n'est pas surveillée.
    expect(sante.santeBoucle({ active: false }, t)).toBe("inactive");
    // Une autre instance tient la boucle depuis plus de 3 min : deux studios tournent → 503.
    expect(sante.santeBoucle({ active: false, attenteVerrouDepuis: t - 4 * 60_000 }, t)).toBe("verrou-ailleurs");
  });
});

describe("B9 · délai global par tour", () => {
  it("ROUGE — un tour qui ne finit jamais est abandonné : la boucle repart, `dernierTour` n'avance pas", async () => {
    const e = boucle.etatBoucle();
    const avant = e.toursAbandonnes;
    const r = await boucle.executerTour(() => new Promise<void>(() => {}), { delaiMs: 30 });
    expect(r).toEqual({ saute: false, abandonne: true });
    expect(e.enCours).toBe(false);
    expect(e.toursAbandonnes).toBe(avant + 1);
    expect(e.dernierTour).toBeUndefined();
    // Le tour suivant n'est plus sauté.
    let fait = false;
    expect(await boucle.executerTour(async () => void (fait = true))).toEqual({ saute: false });
    expect(fait).toBe(true);
    expect(e.dernierTour).toBeTypeOf("number");
  });

  it("ROUGE — la synchronisation Buffer tourne HORS du tour (une seule à la fois) : un Buffer muet ne bloque plus le tour", async () => {
    let appels = 0;
    const muet = () => {
      appels++;
      return new Promise<void>(() => {});
    };
    const r = await Promise.race([
      boucle.tourDeBoucle({ synchroBuffer: muet }).then(() => "fini"),
      new Promise((ok) => setTimeout(() => ok("bloque"), 2_000)),
    ]);
    expect(r).toBe("fini");
    expect(appels).toBe(1);
    // Tour suivant : la synchronisation précédente n'est pas finie, elle n'est pas relancée (aucun empilement).
    await boucle.tourDeBoucle({ synchroBuffer: muet });
    expect(appels).toBe(1);
    boucle.annexesEnVol().clear();
  });

  it("ROUGE — `statement_timeout` sur le pool Postgres (une requête muette ne bloque plus le verrou global)", async () => {
    const { optionsPool, DELAI_REQUETE_MS } = await import("@/donnees/postgres");
    const o = optionsPool("postgresql://studio:x@base:5432/studio");
    expect(o.statement_timeout).toBe(DELAI_REQUETE_MS);
    expect(DELAI_REQUETE_MS).toBeLessThanOrEqual(60_000);
    expect(o.query_timeout).toBeGreaterThan(DELAI_REQUETE_MS);
    expect(o.connectionTimeoutMillis).toBe(5000);
  });
});

/* ------------------------------------------------------------------ */
describe("Un seul réplica : verrou consultatif Postgres au démarrage de la boucle", () => {
  it("ROUGE — une 2e instance (verrou pris ailleurs) ne fait PAS tourner la boucle ; elle prend le relais au verrou libéré", async () => {
    vi.useFakeTimers();
    let libre = false;
    let tours = 0;
    const lances: string[] = [];
    const ok = await boucle.demarrerBoucleUnique({
      prendreVerrou: async () => libre,
      attenteMs: 30_000,
      intervalleMs: 5_000,
      tour: async () => void tours++,
      avecLeVerrou: () => void lances.push("veille+écriture"),
    });
    expect(ok).toBe(false);
    expect(boucle.boucleActive()).toBe(false);
    expect(boucle.etatBoucle().attenteVerrouDepuis).toBeTypeOf("number");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tours).toBe(0);
    expect(lances).toEqual([]);
    // La première instance s'arrête : le verrou se libère, celle-ci prend le relais au prochain essai.
    libre = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(boucle.boucleActive()).toBe(true);
    expect(boucle.etatBoucle().attenteVerrouDepuis).toBeUndefined();
    expect(lances).toEqual(["veille+écriture"]);
    expect(tours).toBeGreaterThan(0);
  });

  it("verrou perdu (connexion coupée) : la boucle s'arrête et attend de le reprendre", async () => {
    vi.useFakeTimers();
    let perdre!: () => void;
    let reponses = [true];
    const ok = await boucle.demarrerBoucleUnique({
      prendreVerrou: async (surPerte) => {
        perdre = surPerte;
        return reponses.shift() ?? false;
      },
      tour: async () => undefined,
    });
    expect(ok).toBe(true);
    expect(boucle.boucleActive()).toBe(true);
    perdre();
    expect(boucle.boucleActive()).toBe(false);
    reponses = [true];
    await vi.advanceTimersByTimeAsync(30_000);
    expect(boucle.boucleActive()).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("B10 · file des notifications persistée en base, réessayée", () => {
  const EMAIL = { cle: "faux", expediteur: "studio@axion-ia.com", destinataire: "will@example.com", adresse: "https://zepto.invalid", site: "https://studio.axion-ia.com" };

  beforeEach(async () => {
    await ecrireParametre("notifications", { videoPrete: true, echec: true, budget: true, canal: "email" });
  });

  it("ROUGE — rien n'est perdu au redémarrage : la file est relue en base", async () => {
    await notifications.creerNotification({ type: "video-prete", titre: "Votre vidéo est prête", lien: "/videos/v-1" });
    // Redémarrage du processus : tout ce qui vivait en mémoire (globalThis) disparaît.
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("studio-axion-ia.notifications-a-diffuser")];
    const emails: string[] = [];
    await notifications.diffuserNotifications({ push: null, email: EMAIL, envoyerEmail: async (_c, n) => (emails.push(n.titre), { envoye: true, simule: false }) });
    expect(emails).toEqual(["Votre vidéo est prête"]);
    const [n] = await depots().notifications.lister((x) => x.titre === "Votre vidéo est prête" && !x.estDemo);
    expect(n.envoi).toMatchObject({ statut: "envoyee", essais: 1 });
  });

  it("ROUGE — un envoi raté est réessayé aux tours suivants (attente croissante), jamais renvoyé une fois parti", async () => {
    let t = Date.parse("2026-10-03T10:00:00Z");
    const maintenant = () => t;
    await notifications.creerNotification({ type: "echec", titre: "Une étape n'a pas abouti" });
    let reponse = false;
    const emails: string[] = [];
    const dep = { push: null, email: EMAIL, maintenant, envoyerEmail: async (_c: unknown, n: { titre: string }) => (emails.push(n.titre), { envoye: reponse, simule: false }) };

    await notifications.diffuserNotifications(dep);
    expect(emails).toHaveLength(1);
    let [n] = await depots().notifications.lister((x) => x.titre === "Une étape n'a pas abouti" && !x.estDemo);
    expect(n.envoi).toMatchObject({ statut: "a-envoyer", essais: 1 });
    // Avant l'heure du réessai : rien ne repart.
    await notifications.diffuserNotifications(dep);
    expect(emails).toHaveLength(1);
    // Une minute plus tard : nouvel essai, réussi.
    t += 61_000;
    reponse = true;
    await notifications.diffuserNotifications(dep);
    expect(emails).toHaveLength(2);
    [n] = await depots().notifications.lister((x) => x.titre === "Une étape n'a pas abouti" && !x.estDemo);
    expect(n.envoi).toMatchObject({ statut: "envoyee", essais: 2 });
    // Plus tard : jamais renvoyée.
    t += 3600_000;
    await notifications.diffuserNotifications(dep);
    expect(emails).toHaveLength(2);
  });

  it("après ESSAIS_MAX essais ratés : « echec » (gardée dans la cloche), plus aucun envoi", async () => {
    let t = Date.parse("2026-10-03T10:00:00Z");
    await notifications.creerNotification({ type: "echec", titre: "Panne longue" });
    let essais = 0;
    const dep = { push: null, email: EMAIL, maintenant: () => t, envoyerEmail: async () => (essais++, { envoye: false, simule: false }) };
    for (let i = 0; i < notifications.ESSAIS_MAX_NOTIFICATION + 3; i++) {
      await notifications.diffuserNotifications(dep);
      t += 31 * 60_000;
    }
    expect(essais).toBe(notifications.ESSAIS_MAX_NOTIFICATION);
    const [n] = await depots().notifications.lister((x) => x.titre === "Panne longue" && !x.estDemo);
    expect(n.envoi?.statut).toBe("echec");
    expect(n.lue).toBe(false);
  });

  it("alerte grave (e-mail forcé) : le téléphone déjà servi n'est pas repoussé quand l'e-mail est réessayé", async () => {
    let t = Date.parse("2026-10-03T10:00:00Z");
    await notifications.enregistrerAbonnementPush({ endpoint: "https://web.push.apple.com/audit-d", keys: { p256dh: "p", auth: "a" } }, "iPhone");
    await notifications.creerNotification({ type: "credit", titre: "HeyGen : crédit sous 10 %" }, { email: true });
    const pousses: string[] = [];
    let emailOk = false;
    const dep = {
      push: { publique: "B", privee: "P", sujet: "mailto:x@y.fr" },
      email: EMAIL,
      maintenant: () => t,
      envoyerPush: async (_c: unknown, a: unknown[], c: { titre: string }) => (pousses.push(c.titre), { envoyes: a.length, expires: [] as string[] }),
      envoyerEmail: async () => ({ envoye: emailOk, simule: false }),
    };
    await notifications.diffuserNotifications(dep);
    t += 61_000;
    emailOk = true;
    await notifications.diffuserNotifications(dep);
    expect(pousses).toEqual(["HeyGen : crédit sous 10 %"]);
    const [n] = await depots().notifications.lister((x) => x.titre === "HeyGen : crédit sous 10 %" && !x.estDemo);
    expect(n.envoi?.statut).toBe("envoyee");
  });

  it("carte en simulation : les notifications en attente passent « sans-canal », rien ne part (écrit et éteint)", async () => {
    await notifications.creerNotification({ type: "video-prete", titre: "Prête (simulation)" });
    const envoyerEmail = vi.fn(async () => ({ envoye: true, simule: false }));
    await notifications.diffuserNotifications({ push: null, email: null, envoyerEmail });
    expect(envoyerEmail).not.toHaveBeenCalled();
    const [n] = await depots().notifications.lister((x) => x.titre === "Prête (simulation)" && !x.estDemo);
    expect(n.envoi?.statut).toBe("sans-canal");
  });
});

/* ------------------------------------------------------------------ */
describe("studio-rendu · fichiers temporaires d'un arrêt brutal", () => {
  let dossier: string;
  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), "audit-d-tmp-"));
  });
  afterAll(async () => {
    if (dossier) await rm(dossier, { recursive: true, force: true });
  });

  it("ROUGE — au démarrage, les dossiers `studio-rendu-*` (et ceux de Remotion) laissés par un processus tué sont effacés, rien d'autre", async () => {
    const { nettoyerTemporairesOrphelins } = await import("../studio-rendu/src/nettoyage");
    await mkdir(join(dossier, "studio-rendu-abc123"));
    await writeFile(join(dossier, "studio-rendu-abc123", "entree.mp4"), "x".repeat(1000));
    await mkdir(join(dossier, "remotion-v4-0-532-assets-xyz"));
    await mkdir(join(dossier, "autre-chose"));
    await writeFile(join(dossier, "garde.txt"), "garde");
    const effaces = await nettoyerTemporairesOrphelins(dossier);
    expect(effaces.sort()).toEqual(["remotion-v4-0-532-assets-xyz", "studio-rendu-abc123"]);
    expect((await readdir(dossier)).sort()).toEqual(["autre-chose", "garde.txt"]);
    // Dossier absent : aucune erreur.
    expect(await nettoyerTemporairesOrphelins(join(dossier, "absent"))).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
describe("B8 · copie hors site des sauvegardes vers R2 (deploiement/copier-r2.mjs, aucun réseau)", () => {
  const ENV = { R2_ACCOUNT_ID: "compte", R2_ACCESS_KEY_ID: "CLEACCES", R2_SECRET_ACCESS_KEY: "secret-faux", R2_BUCKET: "seau" };
  const date = new Date("2026-10-03T03:30:00Z");

  it("ROUGE — la signature est EXACTEMENT celle du studio (mêmes variables R2_*, aucune nouvelle clé)", async () => {
    const copie = await import("../deploiement/copier-r2.mjs");
    const { signerAdresse } = await import("@/fournisseurs/r2/signature");
    const demande = { methode: "PUT" as const, hote: "compte.r2.cloudflarestorage.com", chemin: "/seau/studio/sauvegardes/studio-2026-10-03_033000.sql.gz", expireSec: 3600, date };
    const identifiants = { cleAcces: "CLEACCES", secret: "secret-faux", region: "auto" };
    expect(copie.signerAdresse(identifiants, demande)).toBe(signerAdresse(identifiants, demande));
    expect(copie.PREFIXE_SAUVEGARDES).toBe("studio/sauvegardes/");
  });

  it("envoi : vérifie l'absence, envoie, revérifie la taille ; déjà présent (même taille) : rien n'est renvoyé ; autre taille : refus, rien n'est écrasé ; jamais de DELETE", async () => {
    const { envoyerSauvegarde } = await import("../deploiement/copier-r2.mjs");
    const contenu = Buffer.from("x".repeat(5000));
    const appels: string[] = [];
    let distant: number | null = null;
    const appeler = (async (url: string, init: { method: string; body?: Buffer }) => {
      appels.push(`${init.method} ${new URL(url).pathname}`);
      if (init.method === "HEAD") return new Response(null, { status: distant === null ? 404 : 200, headers: distant === null ? {} : { "content-length": String(distant) } });
      if (init.method === "PUT") {
        distant = init.body!.length;
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    const r = await envoyerSauvegarde({ env: ENV, nom: "studio-2026-10-03_033000.sql.gz", contenu, appeler, maintenant: () => date });
    expect(r).toEqual({ cle: "studio/sauvegardes/studio-2026-10-03_033000.sql.gz", taille: 5000, deja: false });
    expect(appels).toEqual(["HEAD /seau/studio/sauvegardes/studio-2026-10-03_033000.sql.gz", "PUT /seau/studio/sauvegardes/studio-2026-10-03_033000.sql.gz", "HEAD /seau/studio/sauvegardes/studio-2026-10-03_033000.sql.gz"]);
    appels.length = 0;
    expect((await envoyerSauvegarde({ env: ENV, nom: "studio-2026-10-03_033000.sql.gz", contenu, appeler })).deja).toBe(true);
    expect(appels).toEqual(["HEAD /seau/studio/sauvegardes/studio-2026-10-03_033000.sql.gz"]);
    await expect(envoyerSauvegarde({ env: ENV, nom: "studio-2026-10-03_033000.sql.gz", contenu: Buffer.from("autre"), appeler })).rejects.toThrow(/rien n'est écrasé/);
    await expect(envoyerSauvegarde({ env: ENV, nom: "../autre-seau/x", contenu, appeler })).rejects.toThrow(/refusé/);
    await expect(envoyerSauvegarde({ env: { ...ENV, R2_BUCKET: "" }, nom: "a.sql.gz", contenu, appeler })).rejects.toThrow(/R2_/);
    await expect(envoyerSauvegarde({ env: ENV, nom: "vide.sql.gz", contenu: Buffer.alloc(0), appeler })).rejects.toThrow(/vide/);
  });

  it("alerte d'échec : un e-mail ZeptoMail avec les variables EMAIL_SECOURS_* existantes ; sans elles, rien ne part", async () => {
    const { envoyerAlerte } = await import("../deploiement/copier-r2.mjs");
    const envoyes: { url: string; corps: { subject: string } }[] = [];
    const appeler = (async (url: string, init: { body: string }) => (envoyes.push({ url, corps: JSON.parse(init.body) }), new Response("{}", { status: 201 }))) as unknown as typeof fetch;
    expect(await envoyerAlerte({ env: {}, titre: "T", message: "M", appeler })).toBe(false);
    expect(envoyes).toHaveLength(0);
    const env = { EMAIL_SECOURS_CLE: "faux", EMAIL_SECOURS_EXPEDITEUR: "studio@axion-ia.com", EMAIL_SECOURS_DESTINATAIRE: "will@example.com" };
    expect(await envoyerAlerte({ env, titre: "Sauvegarde en ÉCHEC", message: "pg_dump", appeler })).toBe(true);
    expect(envoyes[0].url).toBe("https://api.zeptomail.eu/v1.1/email");
    expect(envoyes[0].corps.subject).toBe("Sauvegarde en ÉCHEC");
  });

  it("sauvegarder.sh : fichier temporaire + gunzip -t + taille minimale + mv, copie R2, rotation 14 jours sans jamais effacer dans R2 ; crontab versionné", async () => {
    const { readFileSync } = await import("node:fs");
    const script = readFileSync("deploiement/sauvegarder.sh", "utf8");
    for (const attendu of ["mktemp", "gunzip -t", "TAILLE_MIN", 'mv "$TEMPORAIRE"', "copier-r2.mjs", "JOURS_LOCAUX=14", "trap echec ERR", "DERNIER-ECHEC"]) expect(script).toContain(attendu);
    // Une sauvegarde locale n'est effacée que si sa copie R2 est confirmée (témoin `.r2`).
    expect(script).toMatch(/if \[ -e "\$f\.r2" \]; then\s+rm -f -- "\$f" "\$f\.r2"/);
    const copie = readFileSync("deploiement/copier-r2.mjs", "utf8");
    expect(copie).not.toMatch(/method:\s*"DELETE"/);
    const crontab = readFileSync("deploiement/crontab", "utf8");
    expect(crontab).toMatch(/^30 3 \* \* \* root .*sauvegarder\.sh/m);
    expect(crontab.endsWith("\n")).toBe(true);
  });
});
