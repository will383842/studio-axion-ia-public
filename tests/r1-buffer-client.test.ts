/**
 * LOT R1 — CLIENT GRAPHQL DE BUFFER ET RÈGLES PURES, sur réponses ENREGISTRÉES (aucun réseau, aucune clé réelle).
 *  - entrée createPost par réseau (Reel Instagram et Facebook, titre YouTube, brouillon / programmer, « maintenant ») ;
 *  - erreurs typées : clé refusée, limite, panne, délai (incertain seulement pour un ENVOI), introuvable ; jamais la clé ;
 *  - lectures : comptes (organisation renseignée), état, publications récentes, statistiques réelles relevées ;
 *  - correspondance réseau → compte (choix, auto, plusieurs, aucun, déconnecté, YouTube = Shorts) ; libellés honnêtes.
 */
import { describe, expect, it } from "vitest";
import { canalPourReseau, libellePublication, occupeBuffer, retrouverEnvoi, statutDepuisBuffer } from "@/domaine/buffer";
import { creerPublicationBuffer, entreeCreerPost, ErreurBuffer } from "@/fournisseurs/publication/buffer";
import { publicationBuffer } from "@/fournisseurs/publication/inscription";
import { statsDepuisReponseBuffer } from "@/fournisseurs/mesures/buffer";
import type { CanalPublication } from "@/fournisseurs/types";
import { CANAUX, fauxBuffer, LECTURES } from "./helpers/r1-buffer";

const CLE = "cle-buffer-de-test-NE-SORT-JAMAIS-77aa";
const URL_VIDEO = "https://compte.r2.cloudflarestorage.com/seau/v.mp4?X-Amz-Expires=604800";
const INSTANT = Date.parse("2026-10-03T10:00:00.000Z");
const demande = (x: Partial<Parameters<typeof entreeCreerPost>[0]> = {}) => ({ reseau: "instagram" as const, texte: "Bonjour\n\n#pme", date: "2026-10-05T07:00:00.000Z", fichierCle: URL_VIDEO, canalId: CANAUX.instagram, ...x });

describe("entrée createPost (PUR)", () => {
  it("brouillon par défaut, date à venir conservée, Reel Instagram, vidéo à l'adresse donnée, aucune vignette (refusée par Buffer)", () => {
    const e = entreeCreerPost(demande(), INSTANT);
    expect(e).toEqual({
      channelId: CANAUX.instagram,
      text: "Bonjour\n\n#pme",
      assets: [{ video: { url: URL_VIDEO } }],
      mode: "customScheduled",
      dueAt: "2026-10-05T07:00:00.000Z",
      saveToDraft: true,
      schedulingType: "automatic",
      needsApproval: false,
      metadata: { instagram: { type: "reel", shouldShareToFeed: true } },
      source: "studio-axion-ia",
    });
    expect(JSON.stringify(e)).not.toContain("thumbnailUrl");
  });

  it("« maintenant » : file d'attente pour un brouillon, envoi immédiat seulement en mode programmer", () => {
    expect(entreeCreerPost(demande({ date: new Date(INSTANT).toISOString() }), INSTANT)).toMatchObject({ mode: "addToQueue", saveToDraft: true });
    expect(entreeCreerPost(demande({ date: new Date(INSTANT).toISOString() }), INSTANT)).not.toHaveProperty("dueAt");
    expect(entreeCreerPost(demande({ date: new Date(INSTANT).toISOString(), mode: "programmer" }), INSTANT)).toMatchObject({ mode: "shareNow", saveToDraft: false });
  });

  it("YouTube et Shorts : titre exigé (celui du kit, sinon 1re ligne, 100 caractères au plus) ; Facebook en Reel ; LinkedIn et TikTok sans réglage", () => {
    expect(entreeCreerPost(demande({ reseau: "youtube", titre: "Mon titre" }), INSTANT).metadata).toEqual({ youtube: { title: "Mon titre" } });
    const long = entreeCreerPost(demande({ reseau: "youtube-shorts", texte: "x".repeat(300) }), INSTANT).metadata as { youtube: { title: string } };
    expect(long.youtube.title.length).toBeLessThanOrEqual(100);
    expect(entreeCreerPost(demande({ reseau: "facebook" }), INSTANT).metadata).toEqual({ facebook: { type: "reel" } });
    expect(entreeCreerPost(demande({ reseau: "linkedin" }), INSTANT)).not.toHaveProperty("metadata");
    expect(entreeCreerPost(demande({ reseau: "tiktok" }), INSTANT)).not.toHaveProperty("metadata");
  });

  it("refuse sans compte ou sans adresse https (vidéo pas en ligne)", () => {
    expect(() => entreeCreerPost(demande({ canalId: undefined }), INSTANT)).toThrow(ErreurBuffer);
    expect(() => entreeCreerPost(demande({ fichierCle: "/demo/video.mp4" }), INSTANT)).toThrow(/pas en ligne/);
  });
});

describe("client : erreurs typées, jamais la clé", () => {
  const avec = (reponse: (corps: string) => Response | Promise<Response>) => creerPublicationBuffer(CLE, { appeler: (async (_u: unknown, init?: RequestInit) => reponse(String(init?.body))) as typeof fetch, maintenant: () => INSTANT });
  const erreur = async (p: Promise<unknown>) => (await p.catch((e: unknown) => e)) as ErreurBuffer;

  it("401 → clé refusée : phrase simple à l'écran, le nom de la variable dans le détail (journal), jamais sa valeur", async () => {
    const e = await erreur(avec(() => new Response(`bad token ${CLE}`, { status: 401 })).envoyer(demande()));
    expect(e).toMatchObject({ code: "refuse", incertain: false, message: "Buffer refuse la clé du serveur : vérifiez-la." });
    expect(e.detail).toContain("BUFFER_API_KEY");
    expect(e.message + (e.detail ?? "")).not.toContain(CLE);
  });

  it("envoi : délai dépassé ou panne serveur → INCERTAIN (Buffer a pu créer) ; lecture : jamais incertaine", async () => {
    const coupure = avec(() => Promise.reject(new DOMException("délai", "TimeoutError")));
    expect(await erreur(coupure.envoyer(demande()))).toMatchObject({ code: "indisponible", incertain: true });
    expect(await erreur(coupure.lireEtat!("e00009000000000000000000"))).toMatchObject({ code: "indisponible", incertain: false });
    expect(await erreur(avec(() => new Response("", { status: 502 })).envoyer(demande()))).toMatchObject({ incertain: true });
    expect(await erreur(avec(() => new Response("", { status: 429 })).envoyer(demande()))).toMatchObject({ code: "limite", incertain: false });
  });

  it("union typée : refus net (InvalidInputError) non incertain, message masqué ; UnexpectedError incertain", async () => {
    const refus = await erreur(avec(() => Response.json({ data: { createPost: { __typename: "InvalidInputError", message: `bad url, key=${CLE}` } } })).envoyer(demande()));
    expect(refus).toMatchObject({ code: "invalide", incertain: false });
    expect(refus.message).not.toContain(CLE);
    expect(refus.message).toMatch(/Buffer refuse cette publication/);
    expect(refus.detail).toMatch(/bad url/);
    expect(refus.detail).not.toContain(CLE);
    expect(await erreur(avec(() => Response.json({ data: { createPost: { __typename: "UnexpectedError", message: "boom" } } })).envoyer(demande()))).toMatchObject({ incertain: true });
    expect(await erreur(avec(() => Response.json({ data: { createPost: { __typename: "LimitReachedError", message: "daily limit" } } })).envoyer(demande()))).toMatchObject({ code: "limite", incertain: false });
  });

  it("erreur GraphQL de validation → sans effet (non incertain) ; erreur interne → incertain", async () => {
    expect(await erreur(avec(() => Response.json({ errors: [{ message: "x", extensions: { code: "BAD_USER_INPUT" } }], data: null })).envoyer(demande()))).toMatchObject({ incertain: false });
    expect(await erreur(avec(() => Response.json({ errors: [{ message: "x", extensions: { code: "INTERNAL_SERVER_ERROR" } }], data: null })).envoyer(demande()))).toMatchObject({ incertain: true });
  });

  it("la clé part dans l'en-tête Authorization, jamais dans le corps", async () => {
    const b = fauxBuffer();
    const f = creerPublicationBuffer(CLE, { appeler: b.appeler, maintenant: () => INSTANT });
    await f.envoyer(demande());
    expect(b.appels[0].autorisation).toBe(`Bearer ${CLE}`);
    expect(JSON.stringify(b.appels.map((a) => [a.query, a.variables]))).not.toContain(CLE);
  });
});

describe("client : lectures sur réponses RÉELLES enregistrées (anonymisées)", () => {
  const b = fauxBuffer();
  const f = creerPublicationBuffer(CLE, { appeler: b.appeler });

  it("comptes : 5 canaux de l'organisation, service, genre, organisation renseignée", async () => {
    const canaux = await f.listerCanaux!();
    expect(canaux.map((c) => c.service)).toEqual(["instagram", "facebook", "facebook", "linkedin", "linkedin"]);
    expect(canaux.every((c) => c.organisationId === LECTURES.compte.data.account.organizations[0].id && !c.deconnecte)).toBe(true);
    expect(canaux.find((c) => c.id === CANAUX.linkedinProfil)?.genre).toBe("profile");
  });

  it("état : la réponse enregistrée « scheduled » → programmée, avec sa date ; introuvable → erreur typée", async () => {
    const p = LECTURES.etat.data.post;
    const lu = await creerPublicationBuffer(CLE, { appeler: (async () => Response.json(LECTURES.etat)) as typeof fetch }).lireEtat!(p.id);
    expect(lu).toMatchObject({ idExterne: p.id, statut: "programmee", date: p.dueAt });
    const introuvable = await creerPublicationBuffer(CLE, { appeler: (async () => Response.json(LECTURES.introuvable)) as typeof fetch }).lireEtat!("000000000000000000000000").catch((e: unknown) => e);
    expect(introuvable).toMatchObject({ code: "introuvable" });
  });

  it("publications récentes : forme réelle (envoyée → publiée + lien ; programmée)", async () => {
    const relues = await creerPublicationBuffer(CLE, { appeler: (async () => Response.json(LECTURES.posts)) as typeof fetch }).publicationsRecentes!({ organisationId: "o", canalId: CANAUX.instagram, depuis: "2020-01-01T00:00:00Z" });
    expect(relues.map((x) => x.statut)).toEqual(["publiee", "programmee", "publiee"]);
    expect(relues[0]).toMatchObject({ lien: "https://exemple.invalid/fichier", creeeLe: "2026-09-29T06:37:37.205Z" });
  });

  it("statistiques : la réponse RÉELLE relevée (Reel Instagram) → vues, portée, réactions, commentaires, partages", () => {
    const s = statsDepuisReponseBuffer(LECTURES.stats);
    expect(s.valeurs).toMatchObject({ vues: 201, portee: 31, likes: 55, commentaires: 2, partages: 0 });
    expect(s.statut).toBe("sent");
    expect(statsDepuisReponseBuffer({ data: { post: { id: "x", metrics: [{ type: "averageTimeWatched", value: 11.4 }, { type: "viewers", value: 40 }] } } }).valeurs).toMatchObject({ dureeMoyenneVueSec: 11.4, portee: 40 });
  });

  it("inscription : rien sans clé ; « buffer » avec la clé", () => {
    expect(publicationBuffer({})).toEqual({});
    expect(publicationBuffer({ BUFFER_API_KEY: "   " })).toEqual({});
    expect(Object.keys(publicationBuffer({ BUFFER_API_KEY: CLE }))).toEqual(["buffer"]);
    expect(publicationBuffer({ BUFFER_API_KEY: CLE }).buffer.mode).toBe("reel");
  });
});

describe("règles pures", () => {
  const canal = (id: string, service: string, x: Partial<CanalPublication> = {}): CanalPublication => ({ id, organisationId: "o", nom: id, service, deconnecte: false, ...x });
  const canaux = [canal("ig", "instagram"), canal("li1", "linkedin"), canal("li2", "linkedin"), canal("yt", "youtube"), canal("fb", "facebook", { deconnecte: true })];

  it("correspondance : seul compte → auto ; YouTube et Shorts → le même ; plusieurs → choix ; aucun ; déconnecté", () => {
    expect(canalPourReseau("instagram", canaux)).toMatchObject({ ok: true, source: "auto", canal: { id: "ig" } });
    expect(canalPourReseau("youtube-shorts", canaux)).toMatchObject({ ok: true, canal: { id: "yt" } });
    expect(canalPourReseau("youtube", canaux)).toMatchObject({ ok: true, canal: { id: "yt" } });
    expect(canalPourReseau("linkedin", canaux)).toMatchObject({ ok: false, raison: "plusieurs" });
    expect(canalPourReseau("linkedin", canaux, { linkedin: "li2" })).toMatchObject({ ok: true, source: "choisi", canal: { id: "li2" } });
    expect(canalPourReseau("tiktok", canaux)).toMatchObject({ ok: false, raison: "aucun", message: "Aucun compte TikTok n'est relié dans Buffer." });
    expect(canalPourReseau("facebook", canaux)).toMatchObject({ ok: false, raison: "deconnecte" });
    // Un choix qui n'existe plus chez Buffer n'est jamais suivi.
    expect(canalPourReseau("linkedin", canaux, { linkedin: "disparu" })).toMatchObject({ ok: false, raison: "plusieurs" });
  });

  it("statuts Buffer → studio : jamais « publiée » par erreur", () => {
    expect(["draft", "needs_approval", "scheduled", "sending", "sent", "error", "inconnu"].map(statutDepuisBuffer)).toEqual(["brouillon", "programmee", "programmee", "programmee", "publiee", "echec", "programmee"]);
  });

  it("retrouver un envoi : même compte, même texte (aux espaces près), créé après le début", () => {
    const relues = [
      { idExterne: "avant", canalId: "ig", statut: "brouillon" as const, texte: "Bonjour #pme", creeeLe: "2026-10-03T09:00:00.000Z" },
      { idExterne: "autre", canalId: "ig", statut: "brouillon" as const, texte: "Autre texte", creeeLe: "2026-10-03T10:00:05.000Z" },
      { idExterne: "le-bon", canalId: "ig", statut: "brouillon" as const, texte: "Bonjour\n\n#pme", creeeLe: "2026-10-03T10:00:03.000Z" },
    ];
    expect(retrouverEnvoi(relues, { canalId: "ig", texte: "Bonjour\n\n#pme", depuis: "2026-10-03T10:00:00.000Z" })?.idExterne).toBe("le-bon");
    expect(retrouverEnvoi(relues, { canalId: "li1", texte: "Bonjour\n\n#pme", depuis: "2026-10-03T10:00:00.000Z" })).toBeNull();
    // Buffer raccourcit les liens : l'envoi est quand même retrouvé (sinon il serait déclaré absent puis renvoyé).
    const raccourci = [{ idExterne: "lien", canalId: "ig", statut: "brouillon" as const, texte: "Voyez https://buff.ly/3xYz #pme", creeeLe: "2026-10-03T10:00:03.000Z" }];
    expect(retrouverEnvoi(raccourci, { canalId: "ig", texte: "Voyez https://axion-ia.com/rendez-vous?utm_source=instagram #pme", depuis: "2026-10-03T10:00:00.000Z" })?.idExterne).toBe("lien");
  });

  it("libellés honnêtes et occupation d'un réseau", () => {
    expect(libellePublication({ via: "buffer", statut: "brouillon", etatEnvoi: "envoye" }).libelle).toBe("Brouillon dans Buffer");
    expect(libellePublication({ via: "buffer", statut: "brouillon", etatEnvoi: "a-verifier" }).libelle).toBe("À vérifier");
    expect(libellePublication({ via: "buffer", statut: "echec", etatEnvoi: "refuse" }).libelle).toBe("Échec");
    expect(libellePublication({ via: "simulation", statut: "brouillon" }).libelle).toBe("Essai");
    expect(libellePublication({ via: "manuel", statut: "publiee" }).libelle).toBe("Publiée");
    expect(occupeBuffer({ via: "buffer", statut: "brouillon", etatEnvoi: "en-cours" })).toBe(true);
    expect(occupeBuffer({ via: "buffer", statut: "echec", etatEnvoi: "refuse" })).toBe(false);
    expect(occupeBuffer({ via: "buffer", statut: "echec", etatEnvoi: "absent" })).toBe(false);
    expect(occupeBuffer({ via: "simulation", statut: "brouillon" })).toBe(false);
  });
});
