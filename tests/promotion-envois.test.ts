/**
 * L0-08 : promotion automatique des brouillons (D7-03). Faux serveur Zernio (faux fetch), dépôt en mémoire, notification
 * et états doublés : aucun appel réel, aucun interrupteur d'envoi ouvert par défaut. Données fictives, horloge fictive.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depot } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { creerEnvoi, validerEnvoi } from "@/services/envois-planifies";
import {
  REGLAGE_ENVOI_CALENDRIER,
  promouvoirEnvoisPlanifies,
  type EtatsPromotion,
  type NotificationPromotion,
  type OptionsPromotionEnvois,
} from "@/services/promotion-envois";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./zernio/aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const H = 3_600_000;
const MIN = 60_000;

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

function etatsEnMemoire(): EtatsPromotion & { table: Map<string, string> } {
  const table = new Map<string, string>();
  return { table, async lire(cle) { return table.get(cle); }, async noter(cle, valeur) { table.set(cle, valeur); } };
}

/** Faux serveur Zernio avec mémoire : un brouillon par entrée, le PUT le programme (sauf `refusPut`). */
function fauxServeur(brouillons: { cle: string; id: string }[], options: { apresPutIncertain?: boolean } = {}) {
  const posts = new Map(brouillons.map((b) => [b.id, postExemple({ _id: b.id, metadata: { origine: "studio", studioCle: b.cle } })]));
  const reponse = (a: AppelEnregistre): ReponsePreparee => {
    const chemin = new URL(a.url).pathname;
    if (a.methode === "GET" && chemin === "/v1/posts") {
      const statut = new URL(a.url).searchParams.get("status");
      return { statut: 200, corps: { posts: [...posts.values()].filter((p) => p.status === statut) } };
    }
    const id = chemin.split("/").pop() as string;
    const p = posts.get(id);
    if (!p) return { statut: 404, corps: { error: "introuvable" } };
    if (a.methode === "PUT") {
      if (options.apresPutIncertain) return { statut: 200, corps: { post: p } }; // 200 mais le post reste brouillon
      const j = a.json as { scheduledFor: string };
      posts.set(id, { ...p, status: "scheduled", scheduledFor: j.scheduledFor });
      return { statut: 200, corps: { post: posts.get(id) } };
    }
    return { statut: 200, corps: { post: p } };
  };
  return { posts, reponse };
}

const NOW0 = Date.parse("2026-11-20T08:00:00Z");

async function monter(opts: {
  entrees?: { jour: string; heure?: string; valider?: boolean; videoId?: string }[];
  now?: number;
  envoi?: boolean;
  calendrier?: boolean;
  sansBrouillon?: boolean;
  apresPutIncertain?: boolean;
}) {
  const depot = doublure();
  const cles: string[] = [];
  let i = 0;
  for (const e of opts.entrees ?? []) {
    const env = await creerEnvoi(depot, { videoId: e.videoId ?? `vid-${++i}`, reseau: "linkedin", versionCreneau: 1, jour: e.jour, heure: e.heure }, "2026-11-01T00:00:00.000Z");
    if (e.valider !== false) await validerEnvoi(depot, env.id, "le fondateur", "2026-11-02T00:00:00.000Z");
    cles.push(env.id);
  }
  const serveur = fauxServeur(opts.sansBrouillon ? [] : cles.map((c, k) => ({ cle: c, id: `exemple-post-${k + 1}` })), { apresPutIncertain: opts.apresPutIncertain });
  const { client, faux, horloge } = creerFauxClientZernio(serveur.reponse);
  const t0 = opts.now ?? NOW0;
  horloge.avancer(t0 - horloge.maintenant());
  const notifications: NotificationPromotion[] = [];
  const etats = etatsEnMemoire();
  const options: OptionsPromotionEnvois = {
    depot,
    client,
    reglages: { envoiAutorise: async () => opts.envoi ?? true, envoiCalendrierAutorise: async () => opts.calendrier ?? true },
    maintenant: horloge.maintenant,
    attendre: horloge.attendre,
    etats,
    notifier: async (n) => { notifications.push(n); },
  };
  const lancer = () => promouvoirEnvoisPlanifies(options);
  const puts = () => faux.appels.filter((a) => a.methode === "PUT");
  return { options, depot, cles, faux, horloge, notifications, etats, lancer, puts, serveur };
}

/** Jour et heure de Paris (hiver, UTC+1) pour un instant UTC donné : HH:MM = UTC + 1 h. */
const parisHiver = (ms: number): { jour: string; heure: string } => {
  const d = new Date(ms + H);
  return { jour: d.toISOString().slice(0, 10), heure: d.toISOString().slice(11, 16) };
};
const entreeA = (ms: number, extra: { valider?: boolean } = {}) => ({ ...parisHiver(ms), ...extra });

describe("L0-08 · promotion automatique", () => {
  it("brouillon à H-3 h : un PUT, puis programme ; deux exécutions : un seul PUT", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 3 * H)] });
    const r1 = await m.lancer();
    expect(m.puts()).toHaveLength(1);
    expect((m.puts()[0].json as { isDraft: boolean }).isDraft).toBe(false);
    expect(r1.lignes[0].etat).toBe("programme");
    expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe("programme");
    const r2 = await m.lancer();
    expect(m.puts()).toHaveLength(1);
    expect(r2.lignes.every((l) => l.etat !== "programme")).toBe(true);
  });

  it("plus de 3 h avant : pas encore, aucun PUT ; 1 seconde de plus que 3 h : toujours pas", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 3 * H + 60_000)] });
    const r = await m.lancer();
    expect(m.puts()).toHaveLength(0);
    expect(r.lignes[0].etat).toBe("pas-encore");
    expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe("valide");
  });

  it("à H-30 min et en dessous : a-reprogrammer, une notification (une seule), zéro PUT", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 30 * MIN), entreeA(NOW0 + 10 * MIN), entreeA(NOW0 - 5 * MIN)] });
    const r = await m.lancer();
    expect(r.lignes.map((l) => l.etat)).toEqual(["a-reprogrammer", "a-reprogrammer", "a-reprogrammer"]);
    expect(m.puts()).toHaveLength(0);
    expect(m.notifications).toHaveLength(3);
    await m.lancer();
    expect(m.notifications).toHaveLength(3); // pas de rappel à chaque tour
    expect(m.puts()).toHaveLength(0);
  });

  it("juste au-dessus de H-30 min (31 min) : promu", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 31 * MIN)] });
    expect((await m.lancer()).lignes[0].etat).toBe("programme");
    expect(m.puts()).toHaveLength(1);
  });

  it("après a-verifier : zéro nouvel appel au tour suivant, même avec un nouveau client", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 2 * H)], apresPutIncertain: true });
    const r1 = await m.lancer();
    expect(r1.lignes[0].etat).toBe("a-verifier");
    expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe("valide");
    const appelsAvant = m.faux.appels.length;
    const r2 = await m.lancer();
    expect(m.faux.appels.length).toBe(appelsAvant);
    expect(r2.lignes[0].etat).toBe("a-verifier");
    expect(m.puts()).toHaveLength(1);
  });

  it("un a-verifier arrête le lot : l'entrée suivante n'est pas promue", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 2 * H), entreeA(NOW0 + 2 * H + 5 * MIN)], apresPutIncertain: true });
    const r = await m.lancer();
    expect(r.lignes.map((l) => l.etat)).toEqual(["a-verifier", "arret"]);
    expect(m.puts()).toHaveLength(1);
  });

  it.each([
    ["envoi général fermé", { envoi: false, calendrier: true }],
    ["réglage du calendrier fermé", { envoi: true, calendrier: false }],
    ["les deux fermés", { envoi: false, calendrier: false }],
  ])("interrupteur coupé (%s) : zéro appel, zéro écriture", async (_n, reglages) => {
    const m = await monter({ entrees: [entreeA(NOW0 + 2 * H)], ...reglages });
    const r = await m.lancer();
    expect(m.faux.appels).toHaveLength(0);
    expect(r.refus).toBeTruthy();
    expect(r.lignes).toHaveLength(0);
    expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe("valide");
    expect(m.notifications).toHaveLength(0);
    expect(m.etats.table.size).toBe(0);
  });

  it("un réglage illisible (lecture qui échoue) vaut fermé", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 2 * H)] });
    const r = await promouvoirEnvoisPlanifies({ ...m.options, reglages: { envoiAutorise: async () => { throw new Error("base illisible"); }, envoiCalendrierAutorise: async () => true } });
    expect(m.faux.appels).toHaveLength(0);
    expect(r.refus).toBeTruthy();
  });

  it("l'interrupteur coupé en cours de lot arrête avant le PUT suivant", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 2 * H), entreeA(NOW0 + 2 * H + 5 * MIN)] });
    let lectures = 0;
    const r = await promouvoirEnvoisPlanifies({ ...m.options, reglages: { envoiAutorise: async () => true, envoiCalendrierAutorise: async () => ++lectures <= 2 } });
    expect(m.puts()).toHaveLength(1);
    expect(r.lignes.map((l) => l.etat)).toEqual(["programme", "arret"]);
  });

  it("entrée sans valideeLe : jamais promue (brouillon non validé à H-3 h : zéro PUT, zéro passage à programmé)", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 3 * H, { valider: false })] });
    const r = await m.lancer();
    expect(m.puts()).toHaveLength(0);
    expect(r.lignes[0].etat).toBe("non-valide");
    expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe("brouillon");
    expect(m.faux.appels).toHaveLength(0);
  });

  it("statut valide mais valideeLe absent, illisible ou dans le futur : jamais promue", async () => {
    for (const valideeLe of [undefined, "pas-une-date", "2027-01-01T00:00:00.000Z", ""]) {
      const m = await monter({ entrees: [entreeA(NOW0 + 2 * H)] });
      await m.depot.modifier(m.cles[0], { valideeLe: valideeLe as string | undefined });
      const r = await m.lancer();
      expect(m.puts(), String(valideeLe)).toHaveLength(0);
      expect(r.lignes[0].etat).toBe("non-valide");
      expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe("valide");
    }
  });

  it("les autres statuts (programme, confirme, a-envoyer, envoye, echec, annule) ne sont jamais touchés", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 2 * H)] });
    for (const statut of ["programme", "confirme", "a-envoyer", "envoye", "echec", "annule"] as const) {
      await m.depot.modifier(m.cles[0], { statut });
      await m.lancer();
      expect(m.faux.appels, statut).toHaveLength(0);
      expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe(statut);
    }
  });

  it("un ajout entre H-3 h et H-30 min est promu au premier tour", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 4 * H)] });
    const r0 = await m.lancer();
    expect(r0.lignes[0].etat).toBe("pas-encore");
    const ajout = await creerEnvoi(m.depot, { videoId: "vid-ajout", reseau: "linkedin", versionCreneau: 1, ...entreeA(NOW0 + 90 * MIN) }, "2026-11-20T07:59:00.000Z");
    await validerEnvoi(m.depot, ajout.id, "le fondateur", "2026-11-20T07:59:30.000Z");
    // le brouillon Zernio de l'ajout existe côté serveur
    m.serveur.posts.set("exemple-post-ajout", postExemple({ _id: "exemple-post-ajout", metadata: { origine: "studio", studioCle: ajout.id } }));
    const r1 = await m.lancer();
    expect(r1.lignes.find((l) => l.cle === ajout.id)?.etat).toBe("programme");
    expect(m.puts()).toHaveLength(1);
  });

  it("changement d'heure du 25/10/2026 : heure répétée = première occurrence (00:30 UTC)", async () => {
    const m = await monter({ entrees: [{ jour: "2026-10-25", heure: "02:30" }], now: Date.parse("2026-10-24T22:00:00Z") });
    expect((await m.lancer()).lignes[0].etat).toBe("programme");
    expect((m.puts()[0].json as { scheduledFor: string }).scheduledFor).toBe("2026-10-25T00:30:00Z");
  });

  it("25/10/2026 : à H-3 h exact de la première occurrence promu, une minute avant la fenêtre non", async () => {
    const t = Date.parse("2026-10-25T00:30:00Z");
    const a = await monter({ entrees: [{ jour: "2026-10-25", heure: "02:30" }], now: t - 3 * H });
    expect((await a.lancer()).lignes[0].etat).toBe("programme");
    const b = await monter({ entrees: [{ jour: "2026-10-25", heure: "02:30" }], now: t - 3 * H - MIN });
    expect((await b.lancer()).lignes[0].etat).toBe("pas-encore");
    const c = await monter({ entrees: [{ jour: "2026-10-25", heure: "02:30" }], now: t - 30 * MIN });
    expect((await c.lancer()).lignes[0].etat).toBe("a-reprogrammer");
  });

  it("changement d'heure du 28/03/2027 : heure inexistante 02:30 = 03:30 Paris (01:30 UTC)", async () => {
    const m = await monter({ entrees: [{ jour: "2027-03-28", heure: "02:30" }], now: Date.parse("2027-03-27T23:00:00Z") });
    expect((await m.lancer()).lignes[0].etat).toBe("programme");
    expect((m.puts()[0].json as { scheduledFor: string }).scheduledFor).toBe("2027-03-28T01:30:00Z");
    const tard = await monter({ entrees: [{ jour: "2027-03-28", heure: "02:30" }], now: Date.parse("2027-03-28T01:10:00Z") });
    expect((await tard.lancer()).lignes[0].etat).toBe("a-reprogrammer");
    expect(tard.puts()).toHaveLength(0);
  });

  it("jamais de promotion avec une date passée ou illisible, ni sans heure", async () => {
    const m = await monter({ entrees: [{ jour: "2026-11-19", heure: "09:00" }, { jour: "2026-11-21" }] });
    await m.depot.modifier(m.cles[1], { heure: undefined });
    const r = await m.lancer();
    expect(m.puts()).toHaveLength(0);
    expect(r.lignes.map((l) => l.etat)).toEqual(["a-reprogrammer", "refuse"]);
  });

  it("sans brouillon chez Zernio : aucun PUT, l'entrée reste valide", async () => {
    const m = await monter({ entrees: [entreeA(NOW0 + 2 * H)], sansBrouillon: true });
    const r = await m.lancer();
    expect(r.lignes[0].etat).toBe("sans-brouillon");
    expect(m.puts()).toHaveLength(0);
    expect((await m.depot.obtenir(m.cles[0]))?.statut).toBe("valide");
  });

  it("aucune entrée à promouvoir : aucun appel réseau", async () => {
    const m = await monter({ entrees: [] });
    await m.lancer();
    expect(m.faux.appels).toHaveLength(0);
  });

  it("le nom du réglage d'envoi du calendrier est celui de L7-08", async () => {
    const Z = await import("@/services/zernio");
    expect(Z.PARAM_ENVOI_CALENDRIER).toBe("zernio.envoi_calendrier_autorise");
    expect(REGLAGE_ENVOI_CALENDRIER).toBe(Z.PARAM_ENVOI_CALENDRIER);
    expect(REGLAGE_ENVOI_CALENDRIER).not.toBe(Z.PARAM_ARRET_ZERNIO);
  });
});
