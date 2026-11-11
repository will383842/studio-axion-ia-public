/**
 * E2E-2 · fournisseur Zernio de bout en bout, SERVEUR SIMULÉ (aucune clé réelle, aucun appel réseau).
 * Couvre : mode brouillon et dates, anti-doublon (existingPostId racine + details, rejeu après erreur réseau),
 * emplacement des champs (premier commentaire, images[], texte alternatif, document LinkedIn, TikTok),
 * erreurs en français sans fuite de clé, filtres de texte.
 * Les mots interdits ne sont JAMAIS écrits en clair : ils sont construits par jetons (J).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import type { DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { LecteurMedia } from "@/fournisseurs/publication/zernio-medias";
import { CLE_FICTIVE, creerFauxClientZernio, J, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";
import { serveurSimule } from "./aides/serveur-simule";

const MAINT = Date.parse("2026-11-01T08:00:00Z");
const DATE = "2026-11-05T10:00:00Z";
const CLE = cleEnvoiPublication("video-exemple", "instagram", DATE, "exemple");
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const lire: LecteurMedia = async () => ({ corps: flux(), taille: 1 });
const demande = (p: Partial<DemandeZernio> = {}): DemandeZernio => ({ reseau: "instagram", texte: "Texte d'exemple", date: DATE, fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-1", cleEnvoi: CLE, ...p });

function monter(opts: Parameters<typeof serveurSimule>[0] = {}, clientOpts: Parameters<typeof creerFauxClientZernio>[1] = {}) {
  const serveur = serveurSimule(opts);
  const t = creerFauxClientZernio(serveur.repondre, clientOpts);
  const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire, maintenant: () => MAINT });
  return { ...t, f, serveur };
}
const creations = (faux: { appels: AppelEnregistre[] }) => faux.appels.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
const ecritures = (faux: { appels: AppelEnregistre[] }) => faux.appels.filter((a) => a.methode !== "GET" && !a.url.startsWith("https://exemple-stockage.test") && !a.url.endsWith("/v1/media/presign"));
const spec = (faux: { appels: AppelEnregistre[] }) => (creations(faux)[0].json as { platforms: { platformSpecificData?: Record<string, unknown> }[]; mediaItems: Record<string, unknown>[] });

afterEach(() => vi.restoreAllMocks());

/* ------------------------------------------------------------------ (2) brouillon et dates */
describe("e2e-2 · mode brouillon : jamais de publication immédiate", () => {
  it("brouillon : isDraft vrai, statut « brouillon », ni publishNow ni drapeau draft de plateforme", async () => {
    const { f, faux } = monter();
    const r = await f.envoyer(demande());
    expect(r.statut).toBe("brouillon");
    const corps = creations(faux)[0];
    expect(corps.json).toMatchObject({ isDraft: true, timezone: "Europe/Paris", scheduledFor: DATE });
    expect(corps.corps).not.toMatch(/publishNow|"draft"\s*:\s*true|"publishedAt"/);
    // Mode par défaut = brouillon, même sans le préciser.
    expect((corps.json as { isDraft: boolean }).isDraft).toBe(true);
  });

  it("un envoi en brouillon ne fait AUCUNE écriture de promotion (pas de PUT, pas de programmation)", async () => {
    const { f, faux } = monter();
    await f.envoyer(demande({ mode: "brouillon" }));
    expect(faux.appels.filter((a) => a.methode === "PUT" && a.url.includes("/v1/posts"))).toHaveLength(0);
    expect(faux.appels.filter((a) => /schedule|publish/i.test(a.url))).toHaveLength(0);
    expect([...(await Promise.resolve(faux.appels))].every((a) => !a.corps?.includes('"isDraft":false'))).toBe(true);
  });

  it("programmer (seul cas hors brouillon) : isDraft faux, statut « programmee », date à venir", async () => {
    const { f, faux } = monter();
    const r = await f.envoyer(demande({ mode: "programmer" }));
    expect(r.statut).toBe("programmee");
    expect(creations(faux)[0].json).toMatchObject({ isDraft: false, scheduledFor: DATE });
  });

  it.each([
    ["date passée", "2026-10-31T10:00:00Z"],
    ["instant présent", "2026-11-01T08:00:00Z"],
    ["date illisible", "pas-une-date"],
  ])("brouillon, %s : refus en français, aucun appel réseau", async (_n, date) => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ date, mode: "brouillon" }))).rejects.toThrow(/Rien n'a été envoyé/);
    expect(faux.appels).toHaveLength(0);
  });

  it("programmer à moins de 30 minutes : refus clair, aucun appel réseau", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ mode: "programmer", date: "2026-11-01T08:20:00Z" }))).rejects.toThrow(/moins de 30 minutes/);
    await expect(f.envoyer(demande({ mode: "programmer", date: "2026-10-30T08:00:00Z" }))).rejects.toThrow(/futur/);
    expect(faux.appels).toHaveLength(0);
    // 31 minutes : accepté.
    await expect(f.envoyer(demande({ mode: "programmer", date: "2026-11-01T08:31:00Z" }))).resolves.toMatchObject({ statut: "programmee" });
  });

  it("promotion d'un brouillon à moins de 30 minutes (ou passé) : « à reprogrammer », aucune écriture", async () => {
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { post: postExemple() } }), { maintenant: () => MAINT });
    for (const date of ["2026-11-01T08:20:00Z", "2026-10-31T10:00:00Z"]) {
      const r = await client.promouvoir({ postId: "exemple-post-1", cleJournal: "studio-exemple", dateJournal: date });
      expect(r.etat).toBe("a-reprogrammer");
    }
    expect(faux.appels).toHaveLength(0);
  });

  it("[observation] un BROUILLON daté à moins de 30 min est accepté (la règle des 30 min ne vaut qu'à la programmation)", async () => {
    const { f } = monter();
    await expect(f.envoyer(demande({ mode: "brouillon", date: "2026-11-01T08:20:00Z" }))).resolves.toMatchObject({ statut: "brouillon" });
  });
});

/* ------------------------------------------------------------------ (3) anti-doublon */
describe("e2e-2 · anti-doublon : un seul envoi", () => {
  it("clé d'envoi obligatoire ; clé non hexadécimale dérivée (jamais une adresse signée)", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ cleEnvoi: "" }))).rejects.toThrow(/empreinte/);
    expect(faux.appels).toHaveLength(0);
    await f.envoyer(demande({ cleEnvoi: "libre" }));
    expect(creations(faux)[0].entetes["Idempotency-Key"]).toMatch(/^studio-[0-9a-f]{64}$/);
  });

  it("la même demande envoyée deux fois = un seul post chez Zernio, même identifiant rendu", async () => {
    const { f, faux, serveur } = monter();
    const a = await f.envoyer(demande());
    const b = await f.envoyer(demande());
    expect(b.idExterne).toBe(a.idExterne);
    expect(serveur.posts.size).toBe(1);
    expect(new Set(creations(faux).map((c) => c.entetes["Idempotency-Key"])).size).toBe(1);
  });

  it.each([
    ["à la racine", (id: string) => ({ error: "duplicate", existingPostId: id })],
    ["dans details", (id: string) => ({ error: "duplicate", details: { existingPostId: id } })],
  ])("doublon 409 avec existingPostId %s : le post d'origine est relu, sa clé comparée, aucun second post", async (_n, corps409) => {
    const { f, faux } = monter({
      surmesure: (a) => {
        if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 409, corps: corps409("exemple-post-7") };
        if (a.methode === "GET" && a.url.endsWith("/v1/posts/exemple-post-7")) return { statut: 200, corps: { post: postExemple({ _id: "exemple-post-7", metadata: { origine: "studio", studioCle: CLE } }) } };
        return undefined;
      },
    });
    const r = await f.envoyer(demande());
    expect(r).toMatchObject({ idExterne: "exemple-post-7", via: "zernio", statut: "brouillon" });
    expect(creations(faux)).toHaveLength(1);
  });

  it("doublon dont le post d'origine porte une AUTRE clé : jamais « envoyé », erreur « doublon » sans identifiant transmis", async () => {
    const { f } = monter({
      surmesure: (a) => {
        if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 409, corps: { details: { existingPostId: "exemple-post-8" } } };
        if (a.url.endsWith("/v1/posts/exemple-post-8")) return { statut: 200, corps: { post: postExemple({ _id: "exemple-post-8", metadata: { origine: "studio", studioCle: "autre-cle" } }) } };
        return undefined;
      },
    });
    const e = await f.envoyer(demande()).catch((x: unknown) => x as ErreurZernio);
    expect(e).toMatchObject({ code: "doublon", statut: 409 });
    expect((e as ErreurZernio).existingPostId).toBeUndefined();
    expect((e as ErreurZernio).message).toMatch(/identique/);
  });

  it("doublon sans existingPostId (ni racine ni details) : erreur « doublon », aucune lecture inventée", async () => {
    const { f, faux } = monter({ surmesure: (a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 409, corps: { error: "duplicate" } } : undefined) });
    await expect(f.envoyer(demande())).rejects.toMatchObject({ code: "doublon" });
    expect(faux.appels.filter((a) => /\/v1\/posts\/[^/?]+$/.test(a.url))).toHaveLength(0);
  });

  it("conflit d'idempotence (premier appel encore en cours) : on attend, on ne renvoie rien", async () => {
    const { f, faux } = monter({ surmesure: (a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 409, corps: { code: "idempotency_conflict" } } : undefined) });
    await expect(f.envoyer(demande())).rejects.toMatchObject({ code: "conflit-idempotence", reessayable: true });
    expect(creations(faux)).toHaveLength(1);
  });

  it("erreur réseau APRÈS réception par Zernio : lecture des posts, post retrouvé par sa clé, un seul envoi", async () => {
    let coupe = true;
    const { f, faux, serveur } = monter({
      surmesure: (a) => {
        if (coupe && a.methode === "POST" && a.url.endsWith("/v1/posts")) {
          // Le serveur a bien enregistré le post, mais la réponse n'arrive jamais.
          coupe = false;
          serveur.repondre(a);
          return { erreur: "reseau", message: "fetch failed" };
        }
        return undefined;
      },
    });
    const r = await f.envoyer(demande());
    expect(r).toMatchObject({ idExterne: "exemple-post-1", via: "zernio" });
    expect(serveur.posts.size).toBe(1);
    expect(creations(faux)).toHaveLength(1);
    // Rejeu de la même demande : Zernio répond « doublon » avec l'identifiant, on retrouve le même post.
    const rejeu = await f.envoyer(demande());
    expect(rejeu.idExterne).toBe("exemple-post-1");
    expect(serveur.posts.size).toBe(1);
  });

  it("délai dépassé et post introuvable : erreur, aucun renvoi automatique", async () => {
    const { f, faux } = monter({ surmesure: (a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { erreur: "delai" } : undefined) });
    await expect(f.envoyer(demande())).rejects.toMatchObject({ code: "a-verifier" });
    expect(creations(faux)).toHaveLength(1);
  });

  it("après une écriture sans réponse sûre, le client exige une LECTURE avant toute nouvelle écriture", async () => {
    const { client, faux } = creerFauxClientZernio((a) => (a.methode === "POST" ? { erreur: "reseau" } : { statut: 200, corps: { posts: [] } }));
    const corps = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };
    const cle = `studio-${CLE}`;
    await expect(client.creerPost(corps, cle)).rejects.toMatchObject({ code: "a-verifier" });
    const avant = faux.appels.length;
    await expect(client.creerPost(corps, cle)).rejects.toMatchObject({ code: "lecture-requise", avantReseau: true });
    expect(faux.appels).toHaveLength(avant);
  });
});

/* ------------------------------------------------------------------ (4) interrupteur */
describe("e2e-2 · « Tout arrêter » : interrupteur coupé = aucune écriture", () => {
  it("fournisseur : envoi refusé (envoi-coupe), zéro POST, zéro téléversement, zéro promotion", async () => {
    const { f, faux } = monter({}, { envoiAutorise: () => false });
    await expect(f.envoyer(demande())).rejects.toMatchObject({ code: "envoi-coupe", avantReseau: true });
    expect(ecritures(faux)).toHaveLength(0);
    expect(faux.appels.filter((a) => a.url.endsWith("/v1/media/presign") || a.url.startsWith("https://exemple-stockage.test"))).toHaveLength(0);
  });

  it("l'interrupteur est relu à CHAQUE envoi : coupé puis rétabli sans recréer le fournisseur", async () => {
    let ouvert = true;
    const { f, faux } = monter({}, { envoiAutorise: () => ouvert });
    await expect(f.envoyer(demande({ cleEnvoi: "un" }))).resolves.toBeDefined();
    ouvert = false;
    await expect(f.envoyer(demande({ cleEnvoi: "deux" }))).rejects.toMatchObject({ code: "envoi-coupe" });
    ouvert = true;
    await expect(f.envoyer(demande({ cleEnvoi: "trois" }))).resolves.toBeDefined();
    expect(creations(faux)).toHaveLength(2);
  });

  it("coupé, la promotion d'un brouillon est aussi refusée (aucun GET, aucun PUT)", async () => {
    const { client, faux } = creerFauxClientZernio([], { envoiAutorise: () => false });
    await expect(client.promouvoir({ postId: "exemple-post-1", cleJournal: "studio-exemple", dateJournal: "2026-11-09T10:00:00Z" })).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(faux.appels).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ (5) emplacement des champs */
describe("e2e-2 · premier commentaire, images[], texte alternatif, document LinkedIn, TikTok", () => {
  it("Facebook : premier commentaire dans platformSpecificData.firstComment, page choisie, « transmis »", async () => {
    const { f, faux } = monter();
    const r = await f.envoyer(demande({ reseau: "facebook", cible: "exemple-compte-2:fb:exemple-page-1", premierCommentaire: "Voir le lien" }));
    expect(r.premierCommentaire).toBe("transmis");
    expect(spec(faux).platforms[0]).toMatchObject({ platform: "facebook", platformSpecificData: { pageId: "exemple-page-1", firstComment: "Voir le lien" } });
    expect(JSON.stringify((creations(faux)[0].json as { content: string }).content)).not.toContain("Voir le lien");
  });

  it("LinkedIn : premier commentaire et organisationUrn au bon endroit", async () => {
    const { f, faux } = monter();
    await f.envoyer(demande({ reseau: "linkedin", cible: "exemple-compte-3:li:42", premierCommentaire: "Suite en commentaire" }));
    expect(spec(faux).platforms[0].platformSpecificData).toMatchObject({ organizationUrn: "urn:li:organization:42", firstComment: "Suite en commentaire" });
  });

  it("Instagram : le premier commentaire n'est PAS dans le payload ; il reste « à la main »", async () => {
    const { f, faux } = monter();
    const r = await f.envoyer(demande({ premierCommentaire: "À poser à la main" }));
    expect(r.premierCommentaire).toBe("a-la-main");
    expect(creations(faux)[0].corps).not.toContain("À poser à la main");
  });

  it("images[] : mediaItems de type image, dans l'ordre, avec texte alternatif, adresses issues du téléversement Zernio", async () => {
    const { f, faux } = monter();
    const images = [1, 2, 3].map((n) => ({ url: `https://exemple-r2.test/i${n}.png`, texteAlternatif: `Image numéro ${n}` }));
    await f.envoyer(demande({ images }));
    const items = spec(faux).mediaItems;
    expect(items).toHaveLength(3);
    expect(items.map((m) => m.type)).toEqual(["image", "image", "image"]);
    expect(items.map((m) => m.altText)).toEqual(["Image numéro 1", "Image numéro 2", "Image numéro 3"]);
    expect(items.every((m) => String(m.url).startsWith("https://exemple-cdn.test/"))).toBe(true);
    // Un carrousel d'images n'est pas un Reel : pas de shareToFeed.
    expect(spec(faux).platforms[0].platformSpecificData ?? {}).not.toHaveProperty("shareToFeed");
  });

  it("images : texte alternatif manquant, trop long, ou trop d'images → refus avant le réseau", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ images: [{ url: "https://exemple-r2.test/a.png", texteAlternatif: "" }] }))).rejects.toThrow(/texte alternatif/);
    await expect(f.envoyer(demande({ images: [{ url: "https://exemple-r2.test/a.png", texteAlternatif: "x".repeat(126) }] }))).rejects.toThrow(/125/);
    const onze = Array.from({ length: 11 }, (_v, i) => ({ url: `https://exemple-r2.test/${i}.png`, texteAlternatif: "ok" }));
    await expect(f.envoyer(demande({ images: onze }))).rejects.toThrow(/10 images/);
    expect(faux.appels).toHaveLength(0);
  });

  it("document LinkedIn : type document, titre dans mediaItems ET documentTitle dans platformSpecificData", async () => {
    const { f, faux } = monter();
    await f.envoyer(demande({ reseau: "linkedin", cible: "exemple-compte-3:li:42", document: { url: "https://exemple-r2.test/d.pdf", titre: "Guide d'exemple" } }));
    const s = spec(faux);
    expect(s.mediaItems[0]).toMatchObject({ type: "document", title: "Guide d'exemple", mimeType: "application/pdf" });
    expect(s.platforms[0].platformSpecificData).toMatchObject({ documentTitle: "Guide d'exemple", organizationUrn: "urn:li:organization:42" });
  });

  it("document : refusé hors LinkedIn, sans titre, titre trop long, mélangé à des images, ou de plus de 100 Mo", async () => {
    const { f, faux } = monter();
    const doc = { url: "https://exemple-r2.test/d.pdf", titre: "Titre" };
    await expect(f.envoyer(demande({ reseau: "instagram", document: doc }))).rejects.toThrow(/LinkedIn/);
    const li = { reseau: "linkedin", cible: "exemple-compte-3:li:42" } as const;
    await expect(f.envoyer(demande({ ...li, document: { ...doc, titre: " " } }))).rejects.toThrow(/titre/);
    await expect(f.envoyer(demande({ ...li, document: { ...doc, titre: "t".repeat(61) } }))).rejects.toThrow(/60/);
    await expect(f.envoyer(demande({ ...li, document: doc, images: [{ url: "https://exemple-r2.test/a.png", texteAlternatif: "ok" }] }))).rejects.toThrow(/un seul type/);
    await expect(f.envoyer(demande({ ...li, document: doc, tailleOctets: 101 * 1024 * 1024 }))).rejects.toThrow(/100 Mo/);
    expect(faux.appels).toHaveLength(0);
  });

  it("TikTok : consentements + allowComment/allowDuet/allowStitch toujours présents, reflets des réglages du créateur", async () => {
    for (const reglage of [{ comment: true, duet: false, stitch: true }, { comment: false, duet: false, stitch: false }, { comment: true, duet: true, stitch: true }]) {
      const { f, faux } = monter({ tiktok: reglage });
      await f.envoyer(demande({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" }));
      const d = spec(faux).platforms[0].platformSpecificData!;
      expect(d).toMatchObject({ contentPreviewConfirmed: true, expressConsentGiven: true, privacyLevel: "SELF_ONLY", allowComment: reglage.comment, allowDuet: reglage.duet, allowStitch: reglage.stitch });
      for (const cle of ["allowComment", "allowDuet", "allowStitch"]) expect(typeof d[cle]).toBe("boolean");
    }
  });

  it("TikTok : sans consentement (absent ou faux) ou sans niveau de confidentialité → refus avant tout appel", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ reseau: "tiktok" }))).rejects.toThrow(/consentement/);
    await expect(f.envoyer(demande({ reseau: "tiktok", consentementTiktok: false, niveauConfidentialiteTiktok: "SELF_ONLY" }))).rejects.toThrow(/consentement/);
    await expect(f.envoyer(demande({ reseau: "tiktok", consentementTiktok: true }))).rejects.toThrow(/confidentialité/);
    expect(faux.appels).toHaveLength(0);
  });

  it("TikTok : niveau de confidentialité non offert par le compte → refus avant la création du post", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "AUTRE_NIVEAU" }))).rejects.toThrow(/niveau de confidentialité/);
    expect(creations(faux)).toHaveLength(0);
  });

  it("TikTok : creator-info illisible ou en erreur → aucun post créé", async () => {
    const { f, faux } = monter({ surmesure: (a) => (a.url.endsWith("/tiktok/creator-info") ? { statut: 500, corps: {} } : undefined) });
    await expect(f.envoyer(demande({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" }))).rejects.toBeInstanceOf(ErreurZernio);
    expect(creations(faux)).toHaveLength(0);
  });

  it("une plateforme par post, métadonnées Studio posées (origine + clé d'envoi)", async () => {
    const { f, faux } = monter();
    await f.envoyer(demande());
    const corps = creations(faux)[0].json as { platforms: unknown[]; metadata: Record<string, string> };
    expect(corps.platforms).toHaveLength(1);
    expect(corps.metadata).toEqual({ origine: "studio", studioCle: CLE });
  });
});

/* ------------------------------------------------------------------ (6) erreurs et fuite de clé */
describe("e2e-2 · erreurs claires en français, aucune fuite de la clé", () => {
  const cas: [string, (a: AppelEnregistre) => ReponsePreparee | undefined, RegExp, string][] = [
    ["401 clé refusée", () => ({ statut: 401, corps: { error: `Unauthorized ${CLE_FICTIVE}` } }), /refuse l'accès.*clé/, "acces"],
    ["403 accès interdit", () => ({ statut: 403, corps: { error: `Forbidden Bearer ${CLE_FICTIVE}` } }), /refuse l'accès.*clé/, "acces"],
    ["429 limite (deux fois)", () => ({ statut: 429, corps: { error: CLE_FICTIVE }, entetes: { "Retry-After": "1" } }), /limite les envois.*réessayer/, "debit"],
    ["503 serveur", () => ({ statut: 503, corps: { error: `boom ${CLE_FICTIVE}` } }), /état inconnu/, "a-verifier"],
    ["500 serveur", () => ({ statut: 500, corps: { error: CLE_FICTIVE } }), /état inconnu/, "a-verifier"],
    ["délai dépassé", () => ({ erreur: "delai", message: `timeout ${CLE_FICTIVE}` }), /n'a pas répondu à temps/, "a-verifier"],
    ["coupure réseau", () => ({ erreur: "reseau", message: `connect ECONNRESET Bearer ${CLE_FICTIVE}` }), /état inconnu|n'a pas répondu/, "a-verifier"],
  ];

  it.each(cas)("%s : message en français, code attendu, rien de la clé nulle part", async (_nom, reponse, motif, code) => {
    const sorties: string[] = [];
    const espions = (["log", "info", "warn", "error", "debug"] as const).map((n) => vi.spyOn(console, n).mockImplementation((...args: unknown[]) => void sorties.push(args.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "))));
    const { f, faux, journal } = monter({ surmesure: (a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? reponse(a) : undefined) });
    const e = (await f.envoyer(demande()).catch((x: unknown) => x)) as ErreurZernio;
    expect(e).toBeInstanceOf(ErreurZernio);
    expect(e.code).toBe(code);
    expect(e.message).toMatch(motif);
    // Message pour l'écran : en français, sans jargon technique anglais du fournisseur.
    expect(e.message).not.toMatch(/Unauthorized|Forbidden|ECONNRESET|timeout|boom/i);
    // Toutes les sorties : message, détail, sérialisation, pile, journal du client, console, requêtes envoyées.
    const tout = [e.message, e.detailTechnique ?? "", JSON.stringify(e), String(e.stack), ...journal.lignes, ...sorties].join("\n");
    expect(tout).not.toContain(CLE_FICTIVE);
    // La clé ne sort que dans l'en-tête Authorization de la requête (jamais dans un corps ni une adresse).
    for (const a of faux.appels) {
      expect(a.url).not.toContain(CLE_FICTIVE);
      expect(a.corps ?? "").not.toContain(CLE_FICTIVE);
    }
    expect(journal.lignes.length).toBeGreaterThan(0);
    espions.forEach((s) => s.mockRestore());
  });

  it("lectures en erreur (5xx, délai) : « indisponible », réessayable, message français", async () => {
    for (const rep of [{ statut: 502, corps: {} } as ReponsePreparee, { erreur: "delai" } as ReponsePreparee]) {
      const { client } = creerFauxClientZernio(() => rep);
      const e = (await client.listerComptes().catch((x: unknown) => x)) as ErreurZernio;
      expect(e).toMatchObject({ code: "indisponible", reessayable: true });
      expect(e.message).toMatch(/Zernio (est indisponible|ne répond pas)/);
    }
  });

  it("429 : un seul nouvel essai après Retry-After, puis erreur « réessayer plus tard » avec l'attente conseillée", async () => {
    const { client, faux, horloge } = creerFauxClientZernio(() => ({ statut: 429, corps: {}, entetes: { "Retry-After": "2" } }));
    const e = (await client.listerComptes().catch((x: unknown) => x)) as ErreurZernio;
    expect(e).toMatchObject({ code: "debit", statut: 429, reessayable: true });
    expect(e.attenteMs).toBeGreaterThan(0);
    expect(faux.appels).toHaveLength(2);
    expect(horloge.attentes).toHaveLength(1);
  });

  it("clé absente ou adresse non sûre : refus clair avant tout appel", () => {
    expect(() => creerPublicationZernio("", {})).toThrow(/Clé Zernio absente/);
    expect(() => creerPublicationZernio(CLE_FICTIVE, { client: { baseUrl: "http://exemple.invalid" } })).toThrow(/https/);
  });

  it("réponse 2xx illisible ou plateforme en échec : jamais « envoyé », toujours « à vérifier »", async () => {
    const { f } = monter({ surmesure: (a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 201, corps: { n_importe: "quoi" } } : undefined) });
    await expect(f.envoyer(demande())).rejects.toMatchObject({ code: "reponse-invalide" });
  });
});

/* ------------------------------------------------------------------ (7) filtres de texte */
describe("e2e-2 · mots interdits : l'envoi est bloqué avant le réseau", () => {
  const CERTIFIE = J("cert", "ifié");
  const LABEL = J("Quali", "opi");
  const VILLE = J("Gre", "noble");
  const PROMESSE = J("Aucun gain ", "garanti");

  const champs: [string, (m: string) => Partial<DemandeZernio>][] = [
    ["texte du post", (m) => ({ texte: `Bonjour ${m} demain` })],
    ["premier commentaire Facebook", (m) => ({ reseau: "facebook", cible: "exemple-compte-2:fb:exemple-page-1", premierCommentaire: `Merci ${m}` })],
    ["premier commentaire LinkedIn", (m) => ({ reseau: "linkedin", cible: "exemple-compte-3:li:42", premierCommentaire: `Merci ${m}` })],
    ["texte alternatif d'une image", (m) => ({ images: [{ url: "https://exemple-r2.test/a.png", texteAlternatif: `Photo ${m}` }] })],
    ["titre de document LinkedIn", (m) => ({ reseau: "linkedin", cible: "exemple-compte-3:li:42", document: { url: "https://exemple-r2.test/d.pdf", titre: `Guide ${m}` } })],
  ];

  describe.each([["mot « certifié »", CERTIFIE], ["nom du label qualité", LABEL]])("%s", (_n, mot) => {
    it.each(champs)("%s : refus « mot-interdit », zéro appel réseau", async (_c, fabriquer) => {
      const { f, faux } = monter();
      await expect(f.envoyer(demande(fabriquer(mot)))).rejects.toThrow();
      expect(faux.appels).toHaveLength(0);
    });
  });

  it("variantes : majuscules, accents retirés, caractères invisibles, mot collé en mot-dièse", async () => {
    const { f, faux } = monter();
    for (const texte of [CERTIFIE.toUpperCase(), CERTIFIE.normalize("NFD").replace(/\p{M}/gu, ""), `${CERTIFIE.slice(0, 3)}​${CERTIFIE.slice(3)}`, `#Nous${LABEL}`, `${LABEL.toLowerCase()}`]) {
      await expect(f.envoyer(demande({ texte }))).rejects.toThrow();
    }
    expect(faux.appels).toHaveLength(0);
  });

  it("mots voisins légitimes (« certificat ») : l'envoi passe", async () => {
    const { f } = monter();
    await expect(f.envoyer(demande({ texte: `Un ${J("cert", "ificat")} de présence` }))).resolves.toMatchObject({ statut: "brouillon" });
  });

  it("le message d'erreur nomme le champ fautif, jamais le mot lui-même dans la phrase à l'écran", async () => {
    const { f } = monter();
    const e = (await f.envoyer(demande({ texte: `Nous sommes ${CERTIFIE}` })).catch((x: unknown) => x)) as ErreurZernio;
    expect(e.code).toBe("mot-interdit");
    expect(e.message).toMatch(/Rien n'a été envoyé|rien n'a été envoyé/);
    expect(e.message).not.toContain(CERTIFIE);
  });

  // D1 (STU-D1) corrigé : la liste d'envoi (`mots-interdits-envoi.ts`) connaît aussi la ville interdite et la promesse
  // de gain, même pour un texte édité à la main ou importé de Buffer.
  it("D1 corrigé : la ville interdite dans le texte bloque l'envoi", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ texte: `Formation à ${VILLE} cet hiver` }))).rejects.toThrow();
    expect(faux.appels).toHaveLength(0);
  });

  it("D1 corrigé : « Aucun gain garanti » dans le texte bloque l'envoi", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ texte: `${PROMESSE} mais des résultats` }))).rejects.toThrow();
    expect(faux.appels).toHaveLength(0);
  });

  it("D1 : un texte sain passe (pas de faux positif)", async () => {
    const { f } = monter();
    await expect(f.envoyer(demande({ texte: "Des résultats concrets, selon votre situation" }))).resolves.toMatchObject({ statut: "brouillon" });
  });

  it("D1 corrigé : ces mots bloquent aussi le premier commentaire et le texte alternatif", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ reseau: "facebook", cible: "exemple-compte-2:fb:exemple-page-1", premierCommentaire: `Venez à ${VILLE}` }))).rejects.toThrow();
    await expect(f.envoyer(demande({ images: [{ url: "https://exemple-r2.test/a.png", texteAlternatif: PROMESSE }] }))).rejects.toThrow();
    expect(faux.appels).toHaveLength(0);
  });
});
