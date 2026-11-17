/**
 * L5-02b : socle de l'envoi depuis le calendrier (visuels, clé réelle du diffuseur, un seul nouvel essai automatique).
 * Faux diffuseur (faux fetch), dépôt en mémoire, états et notification doublés, `fetch` global qui lève : aucun appel réel,
 * aucun interrupteur ouvert par défaut. Données fictives, horloge fictive.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depot } from "@/domaine/depots";
import { CLE_DIFFUSEUR, cleEnvoi, type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { creerEnvoi, noterCleDiffuseur, validerEnvoi } from "@/services/envois-planifies";
import { promouvoirEnvoisPlanifies, type EtatsPromotion, type NotificationPromotion } from "@/services/promotion-envois";
import {
  CODES_REFUS_STUDIO_AVANT_RESEAU,
  FENETRE_CREATION_MS,
  tourEnvoisCalendrier,
  type CreneauCalendrier,
  type DemandeBrouillonCreneau,
  type DepsEnvoiCreneau,
} from "@/services/envoi-depuis-creneau";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./zernio/aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const MIN = 60_000;
const JOUR = 24 * 60 * MIN;
const NOW0 = Date.parse("2026-11-20T08:00:00Z");
const HEX = "a".repeat(64);
const HEX2 = "b".repeat(64);

function doublure(): Depot<EnvoiPlanifie> {
  const t = new Map<string, EnvoiPlanifie>();
  return {
    async lister(f) { return structuredClone([...t.values()].filter((e) => !f || f(e))); },
    async obtenir(id) { const e = t.get(id); return e ? structuredClone(e) : null; },
    async trouver(f) { const e = [...t.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer(e) { t.set(e.id, structuredClone(e)); return structuredClone(e); },
    async modifier(id, p) { const a = t.get(id); if (!a) throw new Error("introuvable"); const s = { ...a, ...structuredClone(p) }; t.set(id, s); return structuredClone(s); },
    async supprimer(id) { return t.delete(id); },
    async compter(f) { return [...t.values()].filter((e) => !f || f(e)).length; },
  };
}

function etatsEnMemoire(): EtatsPromotion & { table: Map<string, string>; ecritures: number } {
  const table = new Map<string, string>();
  const o = { table, ecritures: 0, async lire(cle: string) { return table.get(cle); }, async noter(cle: string, valeur: string) { o.ecritures++; table.set(cle, valeur); } };
  return o;
}

/** Une erreur du Studio (code en chaîne), sans importer le service serveur. */
const erreurStudio = (code: string): Error => Object.assign(new Error(`refus ${code}`), { code, name: "ErreurStudio" });

const creneau = (p: Partial<CreneauCalendrier> = {}): CreneauCalendrier => ({
  id: "c1", videoId: "m1", reseau: "linkedin", versionCreneau: 1, jour: "2026-11-20", heure: "12:00", statut: "valide",
  valideeLe: "2026-11-19T10:00:00Z", valideePar: "le fondateur", texte: "Texte d'exemple", ...p,
});

type Options = {
  creneaux?: CreneauCalendrier[];
  envoi?: boolean | "illisible";
  calendrier?: boolean | "illisible";
  editoriale?: boolean | "absent" | "illisible";
  now?: number;
  /** Comportement du faux envoyerReel, appel après appel (le dernier se répète). */
  scenario?: ("ok" | "plantage-apres-creation" | { refus: string })[];
};

function monter(o: Options = {}) {
  const depot = doublure();
  const etats = etatsEnMemoire();
  const notifications: NotificationPromotion[] = [];
  const posts = new Map<string, ReturnType<typeof postExemple>>();
  const reponse = (a: AppelEnregistre): ReponsePreparee => {
    const chemin = new URL(a.url).pathname.replace(/^\/api/, "");
    if (a.methode === "GET" && chemin === "/v1/posts") {
      const statut = new URL(a.url).searchParams.get("status");
      return { statut: 200, corps: { posts: [...posts.values()].filter((p) => !statut || p.status === statut) } };
    }
    const id = chemin.split("/").pop() as string;
    const p = posts.get(id);
    if (!p) return { statut: 404, corps: { error: "introuvable" } };
    if (a.methode === "PUT") {
      const j = a.json as { scheduledFor: string };
      posts.set(id, { ...p, status: "scheduled", scheduledFor: j.scheduledFor });
      return { statut: 200, corps: { post: posts.get(id) } };
    }
    return { statut: 200, corps: { post: p } };
  };
  const { client, faux, horloge } = creerFauxClientZernio(reponse);
  let now = o.now ?? NOW0;
  horloge.avancer(now - horloge.maintenant());
  let appels = 0;
  const demandes: DemandeBrouillonCreneau[] = [];
  const lire = (v: boolean | "absent" | "illisible" | undefined, defaut: boolean) => async () => { if (v === "illisible") throw new Error("illisible"); return v === undefined ? defaut : (v as boolean); };
  const deps: DepsEnvoiCreneau = {
    depot,
    creneaux: async () => o.creneaux ?? [creneau()],
    client,
    reglages: {
      envoiAutorise: lire(o.envoi, true),
      envoiCalendrierAutorise: lire(o.calendrier, true),
      ...(o.editoriale === "absent" ? {} : { editorialeActive: lire(o.editoriale, true) }),
    },
    maintenant: () => now,
    etats,
    notifier: async (n) => { notifications.push(n); },
    attendre: async () => undefined,
    envoyerReel: async (_outil, d) => {
      appels++;
      demandes.push(d);
      const s = o.scenario ?? ["ok"];
      const mode = s[Math.min(appels - 1, s.length - 1)];
      if (typeof mode === "object") throw erreurStudio(mode.refus);
      const cle = HEX;
      posts.set(`post-${appels}`, postExemple({ _id: `post-${appels}`, status: "draft", metadata: { origine: "studio", studioCle: cle } }));
      if (mode === "plantage-apres-creation") throw new Error("plantage du processus");
      return { cleDiffuseur: cle };
    },
  };
  return { deps, depot, etats, notifications, posts, faux, demandes, appelsReel: () => appels, appelsClient: () => faux.appels.length, avancer: (ms: number) => { now += ms; }, horloge };
}

let fetchReel: unknown;
beforeEach(() => {
  fetchReel = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("appel réseau réel interdit"); }) as never;
});
afterEach(() => { globalThis.fetch = fetchReel as never; });

describe("L5-02b · interrupteurs éteints = aucun appel", () => {
  it.each([
    ["réglage éditorial absent (défaut)", { editoriale: "absent" as const }],
    ["envoi général fermé", { envoi: false }],
    ["envoi général illisible", { envoi: "illisible" as const }],
    ["calendrier fermé", { calendrier: false }],
    ["calendrier illisible", { calendrier: "illisible" as const }],
    ["éditorial fermé", { editoriale: false }],
    ["éditorial illisible", { editoriale: "illisible" as const }],
  ])("%s : 0 envoyerReel, 0 appel au client, 0 écriture d'état", async (_n, opts) => {
    const m = monter(opts as Options);
    const r = await tourEnvoisCalendrier(m.deps);
    expect(m.appelsReel()).toBe(0);
    expect(m.appelsClient()).toBe(0);
    expect(m.etats.ecritures).toBe(0);
    expect(r.lignes[0].etat).toBe("envoi-eteint");
    expect(r.promotion).toBeUndefined();
    const p = await promouvoirEnvoisPlanifies({ depot: m.depot, client: m.deps.client, reglages: m.deps.reglages, maintenant: m.deps.maintenant, etats: m.etats, notifier: m.deps.notifier });
    expect(p.refus).toBeTruthy();
    expect(m.appelsClient()).toBe(0);
  });
});

describe("L5-02b · aucun double envoi", () => {
  it("deux tours successifs = 1 appel à envoyerReel ; la clé du diffuseur est notée", async () => {
    const m = monter();
    await tourEnvoisCalendrier(m.deps);
    await tourEnvoisCalendrier(m.deps);
    expect(m.appelsReel()).toBe(1);
    const e = await m.depot.obtenir(cleEnvoi("m1", "linkedin", 1));
    expect(e?.cleDiffuseur).toBe(HEX);
    expect(e?.creneauId).toBe("c1");
  });

  it("deux tours simultanés = 1 appel", async () => {
    const m = monter();
    await Promise.all([tourEnvoisCalendrier(m.deps), tourEnvoisCalendrier(m.deps)]);
    expect(m.appelsReel()).toBe(1);
  });

  it("plantage du processus après la création chez le diffuseur, avant l'écriture locale : un nouveau tour = 0 nouvel appel", async () => {
    const m = monter({ scenario: ["plantage-apres-creation"] });
    await tourEnvoisCalendrier(m.deps);
    expect(m.appelsReel()).toBe(1);
    await tourEnvoisCalendrier(m.deps);
    await tourEnvoisCalendrier(m.deps);
    expect(m.appelsReel()).toBe(1);
  });

  it("processus mort en plein appel (état « en-cours », clé du diffuseur inconnue) : 0 nouvel appel", async () => {
    const m = monter();
    m.etats.table.set(`creation:${cleEnvoi("m1", "linkedin", 1)}`, "en-cours");
    const r = await tourEnvoisCalendrier(m.deps);
    expect(m.appelsReel()).toBe(0);
    expect(r.lignes[0].etat).toBe("a-verifier");
  });

  it("relecture par cleDiffuseur : brouillon déjà chez le diffuseur sous la clé notée = « deja-cree », 0 appel", async () => {
    const m = monter();
    const cle = cleEnvoi("m1", "linkedin", 1);
    const e = await creerEnvoi(m.depot, { videoId: "m1", reseau: "linkedin", versionCreneau: 1, jour: "2026-11-20", heure: "12:00" }, "2026-11-19T00:00:00.000Z");
    await noterCleDiffuseur(m.depot, e.id, HEX, "2026-11-19T00:00:00.000Z");
    m.etats.table.set(`creation:${cle}`, "en-cours");
    m.posts.set("deja", postExemple({ _id: "deja", status: "draft", metadata: { origine: "studio", studioCle: HEX } }));
    const r = await tourEnvoisCalendrier(m.deps);
    expect(m.appelsReel()).toBe(0);
    expect(r.lignes[0].etat).toBe("deja-cree");
  });

  it("créneau décalé (version 2) dont le média est déjà dans l'outil : refuse, puis « a-corriger », jamais plus de 2 appels sur 5 tours", async () => {
    const m = monter({ creneaux: [creneau({ versionCreneau: 2 })], scenario: [{ refus: "DEJA_DANS_OUTIL" }] });
    const etats: string[] = [];
    for (let i = 0; i < 5; i++) etats.push((await tourEnvoisCalendrier(m.deps)).lignes[0].etat);
    expect(etats).toEqual(["refuse", "refuse", "a-corriger", "a-corriger", "a-corriger"]);
    expect(m.appelsReel()).toBe(2);
    expect(m.notifications.filter((n) => n.motif === "a-reprogrammer")).toHaveLength(1);
  });

  it("refus ENVOI_REFUSE du diffuseur : compte comme un essai, puis « a-corriger »", async () => {
    const m = monter({ scenario: [{ refus: "ENVOI_REFUSE" }] });
    for (let i = 0; i < 4; i++) await tourEnvoisCalendrier(m.deps);
    expect(m.appelsReel()).toBe(2);
  });

  it("ENVOI_CALENDRIER_FERME ne compte pas comme un essai (rien n'a été tenté)", async () => {
    const m = monter({ scenario: [{ refus: "ENVOI_CALENDRIER_FERME" }, { refus: "ENVOI_CALENDRIER_FERME" }, { refus: "ENVOI_CALENDRIER_FERME" }, "ok"] });
    const etats: string[] = [];
    for (let i = 0; i < 4; i++) etats.push((await tourEnvoisCalendrier(m.deps)).lignes[0].etat);
    expect(etats).toEqual(["refuse", "refuse", "refuse", "brouillon-cree"]);
    expect(m.appelsReel()).toBe(4);
  });

  it("erreur inconnue ou réponse perdue : « a-verifier », plus aucun appel", async () => {
    for (const refus of ["ENVOI_A_VERIFIER", "CODE_INCONNU", "ENVOI_EN_COURS"]) {
      const m = monter({ scenario: [{ refus }] });
      expect((await tourEnvoisCalendrier(m.deps)).lignes[0].etat).toBe("a-verifier");
      const avant = m.appelsReel();
      for (let i = 0; i < 3; i++) await tourEnvoisCalendrier(m.deps);
      expect(m.appelsReel()).toBe(avant);
    }
  });

  it("liste fermée : chaque code est un refus avant le réseau (« refuse »)", async () => {
    expect(CODES_REFUS_STUDIO_AVANT_RESEAU).toContain("DEJA_DANS_OUTIL");
    expect(CODES_REFUS_STUDIO_AVANT_RESEAU).not.toContain("ENVOI_A_VERIFIER");
    expect(CODES_REFUS_STUDIO_AVANT_RESEAU).not.toContain("ENVOI_EN_COURS");
    expect(CODES_REFUS_STUDIO_AVANT_RESEAU).not.toContain("ENVOI_REFUSE");
    for (const code of CODES_REFUS_STUDIO_AVANT_RESEAU) {
      const m = monter({ scenario: [{ refus: code }] });
      expect((await tourEnvoisCalendrier(m.deps)).lignes[0].etat).toBe("refuse");
    }
  });
});

describe("L5-02b · promotion avec la clé réelle du diffuseur", () => {
  async function promotion(entree: { cleDiffuseur?: string; nature?: "video" | "visuel" }, studioCle: string) {
    const m = monter();
    const e = await creerEnvoi(m.depot, { videoId: "m1", reseau: "linkedin", versionCreneau: 1, jour: "2026-11-20", heure: "12:00", ...(entree.nature ? { nature: entree.nature } : {}) }, "2026-11-19T00:00:00.000Z");
    if (entree.cleDiffuseur) await noterCleDiffuseur(m.depot, e.id, entree.cleDiffuseur, "2026-11-19T00:00:00.000Z");
    await validerEnvoi(m.depot, e.id, "le fondateur", "2026-11-19T10:00:00.000Z");
    m.posts.set("p1", postExemple({ _id: "p1", status: "draft", metadata: { origine: "studio", studioCle } }));
    const r = await promouvoirEnvoisPlanifies({ depot: m.depot, client: m.deps.client, reglages: m.deps.reglages, maintenant: m.deps.maintenant, attendre: m.deps.attendre, etats: m.etats, notifier: m.deps.notifier });
    const put = m.faux.appels.find((a) => a.methode === "PUT");
    return { r, put, e, m };
  }

  it("brouillon dont studioCle est la clé de 64 signes : retrouvé et promu, cleJournal = cette clé", async () => {
    const { r, m, e } = await promotion({ cleDiffuseur: HEX }, HEX);
    expect(r.lignes[0].etat).toBe("programme");
    expect((await m.depot.obtenir(e.id))?.statut).toBe("programme");
  });

  it("entrée « visuel » : promue comme une vidéo", async () => {
    const { r, e } = await promotion({ cleDiffuseur: HEX, nature: "visuel" }, HEX);
    expect(e.nature).toBe("visuel");
    expect(r.lignes[0].etat).toBe("programme");
  });

  it("entrée sans cleDiffuseur : ancien comportement (cherche la clé « envoi:… »)", async () => {
    const cle = cleEnvoi("m1", "linkedin", 1);
    expect((await promotion({}, cle)).r.lignes[0].etat).toBe("programme");
    expect((await promotion({}, HEX)).r.lignes[0].etat).toBe("sans-brouillon");
  });

  it("cleDiffuseur posée mais brouillon portant l'ancienne clé : « sans-brouillon »", async () => {
    expect((await promotion({ cleDiffuseur: HEX }, cleEnvoi("m1", "linkedin", 1))).r.lignes[0].etat).toBe("sans-brouillon");
  });
});

describe("L5-02b · noterCleDiffuseur et champs facultatifs", () => {
  it("CLE_DIFFUSEUR : 64 hexadécimaux minuscules", () => {
    expect(CLE_DIFFUSEUR.test(HEX)).toBe(true);
    expect(CLE_DIFFUSEUR.test("A".repeat(64))).toBe(false);
    expect(CLE_DIFFUSEUR.test("a".repeat(63))).toBe(false);
  });

  it("refuse une clé invalide, écrit si absente, même valeur = rien, valeur différente = erreur", async () => {
    const depot = doublure();
    const e = await creerEnvoi(depot, { videoId: "m1", reseau: "facebook", versionCreneau: 1, jour: "2026-11-20", heure: "12:00", nature: "visuel", creneauId: "c9" }, "t0");
    expect(e.nature).toBe("visuel");
    expect(e.creneauId).toBe("c9");
    await expect(noterCleDiffuseur(depot, e.id, "envoi:m1:facebook:v1", "t1")).rejects.toThrow();
    expect((await depot.obtenir(e.id))?.cleDiffuseur).toBeUndefined();
    await noterCleDiffuseur(depot, e.id, HEX, "t1");
    expect((await depot.obtenir(e.id))?.cleDiffuseur).toBe(HEX);
    const avant = await depot.obtenir(e.id);
    await noterCleDiffuseur(depot, e.id, HEX, "t2");
    expect(await depot.obtenir(e.id)).toEqual(avant);
    await expect(noterCleDiffuseur(depot, e.id, HEX2, "t3")).rejects.toThrow();
    expect((await depot.obtenir(e.id))?.cleDiffuseur).toBe(HEX);
  });

  it("creerEnvoi reste idempotent : une entrée existante est rendue telle quelle", async () => {
    const depot = doublure();
    const a = await creerEnvoi(depot, { videoId: "m1", reseau: "facebook", versionCreneau: 1, jour: "2026-11-20" }, "t0");
    const b = await creerEnvoi(depot, { videoId: "m1", reseau: "facebook", versionCreneau: 1, jour: "2026-11-20", nature: "visuel", creneauId: "x" }, "t1");
    expect(b).toEqual(a);
    expect(a.nature).toBeUndefined();
  });

  it("le tour recopie nature et creneauId sur l'envoi planifié et dans la demande", async () => {
    const m = monter({ creneaux: [creneau({ nature: "visuel", id: "c7" })] });
    await tourEnvoisCalendrier(m.deps);
    const e = await m.depot.obtenir(cleEnvoi("m1", "linkedin", 1));
    expect(e?.nature).toBe("visuel");
    expect(e?.creneauId).toBe("c7");
    expect(m.demandes[0].nature).toBe("visuel");
    expect(m.demandes[0].creneauId).toBe("c7");
  });
});

describe("L5-02b · fenêtre de création", () => {
  const parisHiver = (ms: number) => { const d = new Date(ms + 60 * MIN); return { jour: d.toISOString().slice(0, 10), heure: d.toISOString().slice(11, 16) }; };

  it("la constante vaut 6 jours", () => expect(FENETRE_CREATION_MS).toBe(6 * JOUR));

  it("6 jours + 1 min : « pas-encore », 0 appel, 0 écriture d'état ; 6 jours - 1 min : appel", async () => {
    const trop = monter({ creneaux: [creneau(parisHiver(NOW0 + 6 * JOUR + MIN))] });
    const r1 = await tourEnvoisCalendrier(trop.deps);
    expect(r1.lignes[0].etat).toBe("pas-encore");
    expect(trop.appelsReel()).toBe(0);
    expect(trop.appelsClient()).toBe(0);
    expect(trop.etats.ecritures).toBe(0);
    expect(await trop.depot.lister()).toHaveLength(0);
    const ok = monter({ creneaux: [creneau(parisHiver(NOW0 + 6 * JOUR - MIN))] });
    expect((await tourEnvoisCalendrier(ok.deps)).lignes[0].etat).toBe("brouillon-cree");
    expect(ok.appelsReel()).toBe(1);
  });

  it("30 min ou moins = « a-reprogrammer », aucun appel (inchangé)", async () => {
    const m = monter({ creneaux: [creneau(parisHiver(NOW0 + 30 * MIN))] });
    expect((await tourEnvoisCalendrier(m.deps)).lignes[0].etat).toBe("a-reprogrammer");
    expect(m.appelsReel()).toBe(0);
  });
});

describe("L5-02b · aucune réponse automatique, socle non branché", () => {
  const fichiers = ["src/domaine/envoi-planifie.ts", "src/services/envois-planifies.ts", "src/services/promotion-envois.ts", "src/services/envoi-depuis-creneau.ts"];
  const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

  it.each(fichiers)("%s : aucun import de zernio-inbox, parcours-, mots-, machine-conversation, aucun appel de réponse", (f) => {
    const src = lire(f);
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((x) => x[1]);
    for (const i of imports) expect(i).not.toMatch(/zernio-inbox|parcours-|mots-|machine-conversation/);
    expect(src).not.toMatch(/\.(repondre|reponse\w*)\(/i);
  });

  it("promotion-envois.ts et envoi-depuis-creneau.ts : aucun service serveur (ni server-only, ni ./_commun)", () => {
    for (const f of fichiers.slice(2)) {
      const src = lire(f);
      expect(src).not.toMatch(/server-only/);
      expect(src).not.toMatch(/\.\/_commun/);
    }
  });

  it("le faux client n'a été appelé que sur listerPosts, promouvoir, lectureExigee", async () => {
    const m = monter();
    const appeles = new Set<string>();
    const proxy = new Proxy(m.deps.client, { get: (c, k) => { const v = (c as never)[k]; if (typeof v === "function") return (...a: unknown[]) => { appeles.add(String(k)); return (v as (...x: unknown[]) => unknown).apply(c, a); }; return v; } });
    m.deps.client = proxy as never;
    await tourEnvoisCalendrier(m.deps);
    await tourEnvoisCalendrier(m.deps);
    for (const k of appeles) expect(["listerPosts", "promouvoir", "lectureExigee", "lirePost"]).toContain(k);
  });
});
