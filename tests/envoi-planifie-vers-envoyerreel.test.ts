/**
 * L5-02a : envoi d'une vidéo depuis le créneau. Faux client Zernio (faux fetch), dépôt en mémoire, états et notification
 * doublés : aucun appel réel, aucun interrupteur ouvert par défaut. Données fictives, horloge fictive.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depot } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { cleEnvoi } from "@/domaine/envoi-planifie";
import { corpsPostZernio } from "@/fournisseurs/publication/zernio-corps";
import { enteteIdempotenceStudio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { PARAM_EDITORIALE_ACTIVE } from "@/services/zernio";
import { REGLAGE_EDITORIALE_ACTIVE as EDITORIALE_PROMOTION, type EtatsPromotion, type NotificationPromotion } from "@/services/promotion-envois";
import {
  REGLAGE_EDITORIALE_ACTIVE,
  envoyerDepuisCreneau,
  tourEnvoisCalendrier,
  type CreneauCalendrier,
  type DemandeBrouillonCreneau,
  type DepsEnvoiCreneau,
} from "@/services/envoi-depuis-creneau";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./zernio/aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const H = 3_600_000;
const MIN = 60_000;
const NOW0 = Date.parse("2026-11-20T08:00:00Z");

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

const creneau = (p: Partial<CreneauCalendrier> = {}): CreneauCalendrier => ({
  id: "c1", videoId: "v1", reseau: "facebook", versionCreneau: 1, jour: "2026-11-20", heure: "12:00", statut: "valide",
  valideeLe: "2026-11-19T10:00:00Z", valideePar: "le fondateur", texte: "Texte d'exemple", premierCommentaire: "Voir le guide",
  ...p,
});

type Options = {
  creneaux?: CreneauCalendrier[];
  envoi?: boolean | "illisible";
  calendrier?: boolean;
  editoriale?: boolean | "absent";
  now?: number;
  /** Faux envoyerReel : lève cette erreur APRÈS avoir créé le post chez le (faux) diffuseur. */
  erreurApresCreation?: Error;
  plantageApresEnvoi?: boolean;
};

function monter(o: Options = {}) {
  const depot = doublure();
  const etats = etatsEnMemoire();
  const notifications: NotificationPromotion[] = [];
  const posts = new Map<string, ReturnType<typeof postExemple>>();
  const parIdempotence = new Map<string, string>();
  const reponse = (a: AppelEnregistre): ReponsePreparee => {
    const chemin = new URL(a.url).pathname.replace(/^\/api/, "");
    if (a.methode === "GET" && chemin === "/v1/posts") {
      const statut = new URL(a.url).searchParams.get("status");
      return { statut: 200, corps: { posts: [...posts.values()].filter((p) => !statut || p.status === statut) } };
    }
    if (a.methode === "POST" && chemin === "/v1/posts") {
      const cle = a.entetes?.["Idempotency-Key"] ?? a.entetes?.["idempotency-key"] ?? "";
      const deja = parIdempotence.get(cle);
      if (deja) return { statut: 200, corps: { post: posts.get(deja) } };
      const corps = a.json as { metadata?: { studioCle?: string }; platforms: { platform: string }[] };
      const id = `post-${posts.size + 1}`;
      const post = postExemple({ _id: id, status: "draft", metadata: { origine: "studio", studioCle: corps.metadata?.studioCle }, platforms: corps.platforms as never });
      posts.set(id, post);
      parIdempotence.set(cle, id);
      return { statut: 201, corps: { post } };
    }
    return { statut: 404, corps: { error: "introuvable" } };
  };
  const { client, faux } = creerFauxClientZernio(reponse);
  const ecritures = () => faux.appels.filter((a) => a.methode !== "GET").length;
  const appelsDiffuseur = () => faux.appels.length;
  let now = o.now ?? NOW0;
  const deps: DepsEnvoiCreneau = {
    depot,
    creneaux: async () => o.creneaux ?? [creneau()],
    client,
    reglages: {
      envoiAutorise: async () => { if (o.envoi === "illisible") throw new Error("illisible"); return o.envoi ?? true; },
      envoiCalendrierAutorise: async () => o.calendrier ?? true,
      editorialeActive: async () => { if (o.editoriale === "absent") return undefined as never; return o.editoriale ?? true; },
    },
    maintenant: () => now,
    etats,
    notifier: async (n) => { notifications.push(n); },
    attendre: async () => undefined,
    outilsAppeles: [],
    envoyerReel: async (outil, d: DemandeBrouillonCreneau) => {
      (deps.outilsAppeles as string[]).push(outil);
      const corps = corpsPostZernio(
        { reseau: d.reseau, texte: d.texte, date: d.dateIso, fichierCle: "https://exemple.test/v.mp4", cible: d.reseau === "facebook" ? "compte-1:fb:page-1" : "compte-1", cleEnvoi: d.cleEnvoi, premierCommentaire: d.premierCommentaire, mode: "brouillon", consentementTiktok: d.consentementTiktok, niveauConfidentialiteTiktok: d.niveauConfidentialiteTiktok },
        { maintenant: now, createurTiktok: { privacyLevels: ["PUBLIC_TO_EVERYONE"], allowComment: true, allowDuet: true, allowStitch: true } },
      );
      await client.creerPost(corps, d.idempotence);
      if (o.erreurApresCreation) throw o.erreurApresCreation;
      if (o.plantageApresEnvoi) throw new Error("plantage du processus");
    },
  };
  return { deps, depot, etats, notifications, posts, ecritures, appelsDiffuseur, faux, avancer: (ms: number) => { now += ms; } };
}

describe("L5-02a · envoi depuis le créneau (vidéo)", () => {
  it("nom du réglage lu de L7-08 : égal à PARAM_EDITORIALE_ACTIVE et à celui de promotion-envois", () => {
    expect(REGLAGE_EDITORIALE_ACTIVE).toBe("publication.editoriale_active");
    expect(REGLAGE_EDITORIALE_ACTIVE).toBe(PARAM_EDITORIALE_ACTIVE);
    expect(REGLAGE_EDITORIALE_ACTIVE).toBe(EDITORIALE_PROMOTION);
  });

  it("anti-double envoi : deux tours de suite = un seul créneau créé chez le diffuseur, clé d'idempotence dérivée de cleEnvoi", async () => {
    const m = monter();
    await tourEnvoisCalendrier(m.deps);
    await tourEnvoisCalendrier(m.deps);
    expect(m.posts.size).toBe(1);
    const cle = cleEnvoi("v1", "facebook", 1);
    const attendue = enteteIdempotenceStudio(createHash("sha256").update(cle).digest("hex"));
    const posts = m.faux.appels.filter((a) => a.methode === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.stringify(posts[0].entetes ?? {})).toContain(attendue);
    expect([...m.posts.values()][0].metadata?.studioCle).toBe(cle);
  });

  it("rejeu après plantage entre la création et l'écriture locale : aucun doublon (relecture avant d'écrire)", async () => {
    const m = monter({ plantageApresEnvoi: true });
    const r1 = await tourEnvoisCalendrier(m.deps);
    expect(m.posts.size).toBe(1);
    expect(r1.lignes[0].etat).toBe("a-verifier");
    // Le diffuseur est relu, le brouillon retrouvé par sa clé : pas de second POST.
    const m2 = { ...m.deps, envoyerReel: m.deps.envoyerReel };
    const r2 = await tourEnvoisCalendrier(m2);
    expect(m.faux.appels.filter((a) => a.methode === "POST")).toHaveLength(1);
    expect(r2.lignes[0].etat).toBe("a-verifier");
  });

  it("réponse perdue (envoi coupé en route) : « à vérifier », plus aucun appel pour cette entrée", async () => {
    const m = monter({ erreurApresCreation: new ErreurZernio("indisponible", "délai dépassé", { reessayable: true }) });
    const r1 = await tourEnvoisCalendrier(m.deps);
    expect(r1.lignes[0].etat).toBe("a-verifier");
    expect(m.etats.table.get(`a-verifier:${cleEnvoi("v1", "facebook", 1)}`)).toBe("a-verifier");
    const avant = m.appelsDiffuseur();
    await tourEnvoisCalendrier(m.deps);
    expect(m.appelsDiffuseur()).toBe(avant);
  });

  it.each([
    ["proposé", creneau({ statut: "propose" })],
    ["à valider", creneau({ statut: "a_valider" })],
    ["sans valideeLe", creneau({ valideeLe: undefined })],
    ["valideeLe illisible", creneau({ valideeLe: "pas une date" })],
    ["valideeLe dans le futur", creneau({ valideeLe: "2026-12-01T10:00:00Z" })],
  ])("aucun appel au diffuseur : créneau %s", async (_n, c) => {
    const m = monter({ creneaux: [c] });
    const r = await tourEnvoisCalendrier(m.deps);
    expect(m.appelsDiffuseur()).toBe(0);
    expect(m.deps.outilsAppeles).toEqual([]);
    expect(r.lignes[0].etat).toBe("non-valide");
  });

  it.each([
    ["général fermé", { envoi: false }],
    ["calendrier fermé", { calendrier: false }],
    ["éditorial fermé", { editoriale: false }],
    ["éditorial absent", { editoriale: "absent" }],
    ["général illisible", { envoi: "illisible" }],
  ] as [string, Options][])("interrupteurs : %s = 0 appel, « envoi éteint » sans erreur", async (_n, o) => {
    const m = monter(o);
    const r = await tourEnvoisCalendrier(m.deps);
    expect(m.appelsDiffuseur()).toBe(0);
    expect(m.deps.outilsAppeles).toEqual([]);
    expect(r.lignes[0].etat).toBe("envoi-eteint");
    expect(r.erreurs).toEqual([]);
  });

  it("un créneau validé crée un brouillon, puis la promotion le programme dans la fenêtre de 3 h", async () => {
    const m = monter({ creneaux: [creneau({ heure: "10:00" })] }); // 2 h après NOW0 (UTC+1 : 09:00Z)
    const r = await tourEnvoisCalendrier(m.deps);
    expect(m.posts.size).toBe(1);
    expect(r.lignes[0].etat).toBe("brouillon-cree");
    expect(r.promotion).toBeDefined();
    const e = await m.depot.obtenir(cleEnvoi("v1", "facebook", 1));
    expect(e?.valideeLe).toBe("2026-11-19T10:00:00Z");
    expect(m.deps.outilsAppeles).toEqual(["zernio"]);
  });

  it("date à 30 min ou moins : aucun brouillon, « à reprogrammer » notifié une seule fois", async () => {
    const m = monter({ creneaux: [creneau({ heure: "09:20" })] }); // 08:20Z, 20 min après NOW0
    await tourEnvoisCalendrier(m.deps);
    await tourEnvoisCalendrier(m.deps);
    expect(m.appelsDiffuseur()).toBe(0);
    expect(m.notifications.filter((n) => n.motif === "a-reprogrammer")).toHaveLength(1);
    expect(30 * MIN).toBeGreaterThan(20 * MIN);
    expect(H).toBeGreaterThan(0);
  });

  it("TikTok sans consentement ou sans niveau : aucun brouillon, une seule notification « à compléter »", async () => {
    const m = monter({ creneaux: [creneau({ reseau: "tiktok" })] });
    await tourEnvoisCalendrier(m.deps);
    await tourEnvoisCalendrier(m.deps);
    expect(m.appelsDiffuseur()).toBe(0);
    expect(m.notifications.filter((n) => n.motif === "tiktok-incomplet")).toHaveLength(1);
  });

  it("envoyerDepuisCreneau : un seul créneau, jamais un autre outil que « zernio »", async () => {
    const m = monter();
    const l = await envoyerDepuisCreneau(m.deps, "c1");
    expect(l?.cle).toBe(cleEnvoi("v1", "facebook", 1));
    expect(new Set(m.deps.outilsAppeles)).toEqual(new Set(["zernio"]));
  });
});
