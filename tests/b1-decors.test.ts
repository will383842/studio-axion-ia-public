/**
 * LOT B1 — décors réalistes : une règle = un test, SANS réseau ni clé.
 *  - règles pures (`domaine/decors.ts`) : phrase → 3 requêtes sans personne, récurrents (3 à 5), états, coût d'un Look ;
 *  - Looks HeyGen écrits et ÉTEINTS (`fournisseurs/heygen/looks.ts`, `visage.ts`, inscription) : réponses enregistrées ;
 *  - brique `composition` : un Look réel = décor DANS la vidéo (ni décor ni liseré posés) ; sinon rien ne change ;
 *  - service « Mes décors » : coût affiché avant, 3 propositions sur le double, garder / ranger (jamais supprimer),
 *    Look au premier usage puis réutilisé gratuitement, validation sur capture ; migration 14 idempotente.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, SegmentSousTitres, ValeurDecor } from "@/domaine/types";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const domaine = await import("@/domaine/decors");
const { contientInterdit } = await import("@/domaine/illustrations");
const catalogue = await import("@/donnees/decors-catalogue");
const looks = await import("@/fournisseurs/heygen/looks");
const { creerClientHeygen } = await import("@/fournisseurs/heygen/client");
const { creerFournisseurVisageHeygen, cleIdempotenceDemande } = await import("@/fournisseurs/heygen/visage");
const { visagesHeygen } = await import("@/fournisseurs/heygen/inscription");
const brique = await import("@/briques/composition");
const { RECETTE_COMPOSITION_AVOCAT } = await import("@/moteurs/montage-avocat/recette-composition");
const { remplacerReferences } = await import("../studio-rendu/src/composition/entrees");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const decors = await import("@/services/decors");
const { etape14DecorsRealistes } = await import("@/services/migrations/etape-14-decors-realistes");

const MAINTENANT = "2026-10-02T08:00:00.000Z";
const FIXTURE = JSON.parse(readFileSync("tests/fixtures/b1-heygen-looks.json", "utf8")) as { reponse: { data: Record<string, unknown> }; listePrivee: { data: unknown[]; has_more: boolean } };
const valeur = (id: string) => catalogue.decorsCatalogue(MAINTENANT).find((d) => d.id === id)!.valeur as ValeurDecor;

/* ------------------------------------------------------------------ */
describe("« un décor en une phrase » : règles pures", () => {
  it("la phrase devient un lieu en anglais, les personnes, logos et uniformes sont retirés", () => {
    expect(domaine.sujetDecorEn("Un bureau en bois avec une bibliothèque")).toBe("office desk, wood, bookshelves");
    const s = domaine.sujetDecorEn("un bureau avec un avocat et des clients, le logo au mur");
    expect(s).toContain("office desk");
    expect(contientInterdit(s)).toBe(false);
  });
  it("3 requêtes (dorée, jour, soir), toujours SANS personne ni texte ni logo", () => {
    const r = domaine.requetesPropositions("un bureau en bois avec une bibliothèque");
    expect(r.map((x) => x.ambiance.code)).toEqual(["doree", "jour", "soir"]);
    for (const { requete } of r) {
      expect(requete).toContain(domaine.EXCLUSIONS_DECOR);
      // Ce que fal.ai vérifie : une fois les « no … » retirés, aucun mot interdit.
      expect(contientInterdit(requete.replace(/no people|no hands|no faces|no logo|no uniform/gi, ""))).toBe(false);
    }
  });
  it("une phrase qui ne décrit aucun lieu ne fabrique rien", () => {
    expect(domaine.requetesPropositions("une personne")).toEqual([]);
    expect(domaine.requetePhotoDecor("   ", domaine.AMBIANCES_PROPOSITIONS[0])).toBeNull();
  });
  it("nom court d'une proposition", () => {
    expect(domaine.nomDecorDemande("Je voudrais un bureau en bois", "Lumière dorée")).toBe("Bureau en bois · Lumière dorée");
  });
});

describe("états, récurrents, Looks : règles pures", () => {
  it("état d'un décor : fond neutre, réaliste à créer, à vérifier, prêt, proposition, photo", () => {
    expect(domaine.etatDecor(valeur("decor-n1-halo-orange"))).toBe("fond-neutre");
    const r1 = valeur("decor-r1-bureau-bois");
    expect(domaine.etatDecor(r1)).toBe("look-a-creer");
    expect(domaine.etatDecor({ ...r1, lookIdParAngle: { "trois-quarts": "lk1" } })).toBe("look-a-verifier");
    expect(domaine.etatDecor({ ...r1, lookIdParAngle: { "trois-quarts": "lk1" }, statut: "valide" })).toBe("look-pret");
    const photo: ValeurDecor = { type: "decor", mode: "image", methode: "photo-incrustee", profondeurFlou: 14, directionLumiere: "droite", positionSujet: 0.5, statut: "a_verifier", demande: { texte: "x", le: MAINTENANT } };
    expect(domaine.etatDecor(photo)).toBe("proposition");
    expect(domaine.etatDecor({ ...photo, statut: "valide", demande: { texte: "x", le: MAINTENANT, retenu: true } })).toBe("photo");
  });
  it("récurrents : 3 validés au départ (N1, N5, N3), 5 au plus, jamais un décor à vérifier ou rangé", () => {
    const tous = catalogue.decorsCatalogue(MAINTENANT);
    expect(domaine.decorsRecurrents(tous).map((e) => e.valeur.type === "decor" && e.valeur.catalogue?.code)).toEqual(["N1", "N5", "N3"]);
    expect(domaine.peutMettreEnAvant(tous, "decor-n2-tube-led")).toEqual({ ok: true });
    expect(domaine.peutMettreEnAvant(tous, "decor-r1-bureau-bois").ok).toBe(false);
    expect(domaine.peutMettreEnAvant(tous.map((e) => (e.id === "decor-n4-noir-uni" ? { ...e, archiveLe: MAINTENANT } : e)), "decor-n4-noir-uni").ok).toBe(false);
    const cinq = tous.map((e) => (["decor-n2-tube-led", "decor-n4-noir-uni"].includes(e.id) && e.valeur.type === "decor" ? { ...e, valeur: { ...e.valeur, catalogue: { ...e.valeur.catalogue!, misEnAvant: true, reserve: undefined } } } : e));
    expect(domaine.decorsRecurrents(cinq)).toHaveLength(domaine.RECURRENTS_MAX);
    expect(domaine.peutMettreEnAvant(cinq, "decor-n6-mur-creme")).toMatchObject({ ok: false });
  });
  it("coût d'un Look : 1 $ par angle manquant, 0 € quand il existe (réutilisé)", () => {
    const r1 = valeur("decor-r1-bureau-bois");
    expect(domaine.estimationLook(r1, ["trois-quarts", "face"])).toEqual({ angles: ["trois-quarts", "face"], centimesUsd: 200, reutilise: false });
    expect(domaine.estimationLook({ ...r1, lookIdParAngle: { "trois-quarts": "a", face: "b" } }, ["trois-quarts", "face"])).toEqual({ angles: [], centimesUsd: 0, reutilise: true });
  });
  it("Look réel seulement si un look existe pour l'angle ET que la piste en vient", () => {
    const r1 = { ...valeur("decor-r1-bureau-bois"), lookIdParAngle: { "trois-quarts": "lk" } };
    expect(domaine.lookReelPourAngle(r1, "trois-quarts", true)).toBe(true);
    expect(domaine.lookReelPourAngle(r1, "trois-quarts", false)).toBe(false);
    expect(domaine.lookReelPourAngle(r1, "face", true)).toBe(false);
    expect(domaine.lookReelPourAngle(valeur("decor-n1-halo-orange"), "trois-quarts", true)).toBe(false);
  });
  it("consigne du Look : même look de base, regard hors caméra, ≤ 1 000 caractères", () => {
    const c = domaine.consigneLook(catalogue.descriptionEnCatalogue("R2")!, "trois-quarts");
    expect(c).toContain("Same man as the reference look");
    expect(c).toContain("off-camera");
    expect(c.length).toBeLessThanOrEqual(1000);
    expect(domaine.consigneLook("x".repeat(2000), "face").length).toBe(1000);
  });
  it("catalogue : R1 à R8 ont une description anglaise ; N1 à N6 une vignette sur le double (fichier présent)", () => {
    for (const code of ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]) expect(catalogue.descriptionEnCatalogue(code)).toBeTruthy();
    for (const code of ["N1", "N2", "N3", "N4", "N5", "N6"]) expect(catalogue.vignetteSurDoubleId(code)).toBeTruthy();
    for (const f of catalogue.fichiersDecorsCatalogue(MAINTENANT).filter((x) => x.cleStockage.includes("/sur-double/"))) expect(() => readFileSync(`public${f.cleStockage}`)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
function faussesReponses(routes: Record<string, unknown>) {
  const appels: { url: string; methode: string; entetes: Record<string, string>; corps?: unknown }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const chemin = new URL(url).pathname + new URL(url).search;
    appels.push({ url: chemin, methode: init?.method ?? "GET", entetes: (init?.headers ?? {}) as Record<string, string>, corps: init?.body ? JSON.parse(String(init.body)) : undefined });
    const cle = Object.keys(routes).find((k) => chemin.startsWith(k));
    if (!cle) return new Response(JSON.stringify({ error: { code: "not_found", message: "?" } }), { status: 404 });
    return new Response(JSON.stringify(routes[cle]), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, appels };
}

describe("Looks HeyGen : écrits et ÉTEINTS, testés sur réponses enregistrées", () => {
  it("corps de création : type prompt, look de RÉFÉRENCE, 9:16, consigne ≤ 1 000, 3 images au plus", () => {
    const c = looks.corpsCreationLook({ lookBaseId: "lk-base", groupeId: "grp", nom: "Décor", consigne: "y".repeat(1500), imagesReference: ["a", "b", "c", "d"], cleIdempotence: "k" });
    expect(c).toMatchObject({ type: "prompt", avatar_id: "lk-base", avatar_group_id: "grp", aspect_ratio: "9:16" });
    expect(String(c.prompt).length).toBe(1000);
    expect(c.reference_images).toHaveLength(3);
    expect(() => looks.corpsCreationLook({ lookBaseId: " ", nom: "x", consigne: "x", cleIdempotence: "k" })).toThrow("LOOK_DE_BASE_MANQUANT");
  });
  it("statut : terminé = à vérifier (jamais prêt) ; sans Avatar V = échec ; accord HeyGen attendu = en préparation", () => {
    expect(looks.statutLook(FIXTURE.reponse.data as never)).toEqual({ statut: "a_verifier", progression: 100 });
    expect(looks.statutLook({ status: "completed", supported_api_engines: ["avatar_iv"] }).statut).toBe("echec");
    expect(looks.statutLook({ status: "failed" }).statut).toBe("echec");
    expect(looks.statutLook({ status: "pending_consent" }).statut).toBe("en_preparation");
    expect(looks.statutLook({ status: "processing" }).statut).toBe("en_preparation");
  });
  it("réponse de création : `avatar_item`, liste `looks`, ou le look ; sinon erreur", () => {
    expect(looks.lookDepuisReponse({ avatar_item: { id: "a", status: "processing" } }).id).toBe("a");
    expect(looks.lookDepuisReponse({ group_id: "g", looks: [{ id: "b" }] }).id).toBe("b");
    expect(() => looks.lookDepuisReponse({})).toThrow("REPONSE_LOOK_INATTENDUE");
  });
  it("clé d'idempotence : stable pour la même demande, au bon alphabet", () => {
    expect(cleIdempotenceDemande("lk", "p")).toBe(cleIdempotenceDemande("lk", "p"));
    expect(cleIdempotenceDemande("lk", "p")).not.toBe(cleIdempotenceDemande("lk", "q"));
    expect(looks.cleIdempotenceLook("decor r1/é", "trois-quarts")).toMatch(/^[A-Za-z0-9_:.-]+$/);
  });
  it("creerLook (looks autorisés, tests seulement) : POST /v3/avatars avec Idempotency-Key ; suivre : GET /v3/avatars/looks/{id} (réponse enregistrée)", async () => {
    const id = String(FIXTURE.reponse.data.id);
    const { f, appels } = faussesReponses({ "/v3/avatars/looks/": FIXTURE.reponse, "/v3/avatars": { data: { avatar_item: { ...FIXTURE.reponse.data, status: "processing" }, avatar_group: {} } } });
    // Production (relecture exactitude 3042b94, n° 2) : refus sans appel, les décors réalistes se font dans HeyGen.
    await expect(creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-essai", fetch: f })).creerLook({ visageId: "lk-base", prompt: "consigne" })).rejects.toThrow(/application HeyGen/);
    expect(appels).toHaveLength(0);
    const v = creerFournisseurVisageHeygen(creerClientHeygen({ cle: "cle-essai", fetch: f }), { looksAutorises: true });
    const r = await v.creerLook({ visageId: "lk-base", prompt: "consigne" });
    expect(r).toEqual({ idExterne: id, statut: "en_preparation" });
    // Correcteur réel 2 (F1) : le look de base est d'abord LU (gratuit) pour ranger le look dans son groupe.
    expect(appels[0]).toMatchObject({ url: "/v3/avatars/looks/lk-base", methode: "GET" });
    const creation = appels.find((a) => a.methode === "POST")!;
    expect(creation).toMatchObject({ url: "/v3/avatars", methode: "POST" });
    expect(creation.entetes["Idempotency-Key"]).toMatch(/^look-[0-9a-f]{40}$/);
    expect(creation.corps).toMatchObject({ type: "prompt", avatar_id: "lk-base" });
    const n = appels.length;
    expect(await v.suivre(id)).toEqual({ statut: "a_verifier", progression: 100 });
    expect(appels[n]).toMatchObject({ url: `/v3/avatars/looks/${id}`, methode: "GET" });
  });
  it("liste des looks privés : paginée (vide au 02/10 : pas encore de double)", async () => {
    const { f, appels } = faussesReponses({ "/v3/avatars/looks?": FIXTURE.listePrivee });
    expect(await looks.creerLooksHeygen(creerClientHeygen({ cle: "c", fetch: f })).listerPrives()).toEqual([]);
    expect(appels[0].url).toContain("ownership=private");
  });
  // Lot R7 : le double se crée ET parle dans l'application HeyGen (décisions de Will du 03/10) : création et rendu
  // refusés par le studio. Aucun appel dans tous les cas.
  it("double : création refusée (faite dans HeyGen), rendu sans stockage refusé ; aucun appel", async () => {
    const { f, appels } = faussesReponses({});
    const v = creerFournisseurVisageHeygen(creerClientHeygen({ cle: "c", fetch: f }));
    // Lot R7e : réglage éteint par défaut → refus sans appel ; allumé, sans stockage : refus.
    await expect(v.rendre({ visageId: "x", audioCle: "a", fond: "transparent", ratio: "9:16", cleIdempotence: "k" })).rejects.toThrow(/application HeyGen/);
    const autorise = creerFournisseurVisageHeygen(creerClientHeygen({ cle: "c", fetch: f }), { renduAvatarAutorise: true });
    await expect(autorise.rendre({ visageId: "x", audioCle: "a", fond: "transparent", ratio: "9:16", cleIdempotence: "k" })).rejects.toThrow(/stockage/);
    await expect(v.creerDouble({ visageId: "x", nature: "moi", fichierIds: [] })).rejects.toThrow(/application HeyGen/);
    expect(appels).toHaveLength(0);
  });
  it("inscription : rien sans clé, rien sans FOURNISSEUR_VISAGE=heygen ; les deux → inscrit", () => {
    expect(visagesHeygen({})).toEqual({});
    expect(visagesHeygen({ HEYGEN_API_KEY: "k" })).toEqual({});
    expect(visagesHeygen({ FOURNISSEUR_VISAGE: "heygen" })).toEqual({});
    expect(Object.keys(visagesHeygen({ HEYGEN_API_KEY: "k", FOURNISSEUR_VISAGE: "heygen" }))).toEqual(["heygen"]);
  });
});

/* ------------------------------------------------------------------ */
function commande(decorId: string, extra: Partial<CommandeFabrication> = {}): CommandeFabrication {
  const d = catalogue.decorsCatalogue(MAINTENANT).find((x) => x.id === decorId)!;
  return {
    versionContrat: 2,
    moteurId: "montage-avocat",
    videoId: "v-b1",
    formatId: "avocat",
    versionFormat: 2,
    profilRenduVersion: 1,
    dureeCibleSec: 4,
    ratios: ["9:16"],
    script: { blocs: [{ id: "b", blocRecette: "accroche", segments: [{ id: "s1", texte: "Vous recevez un PV ?" }] }], texteComplet: "" },
    distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: { "trois-quarts": { visageId: "vis-1" } } }],
    styles: { lut: null, sousTitres: null, habillage: null, profilSon: null, musique: null, decor: { id: d.id, nom: d.nom, valeur: d.valeur as never } },
    briques: { "sous-titres": false, etalonnage: true, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { active: false } as never,
    budgetMax: { centimes: 15000, devise: "EUR" },
    construiteLe: MAINTENANT,
    medias: {},
    ...extra,
  } as CommandeFabrication;
}
const PLANS = [{ ordre: 1, debutSec: 0, finSec: 4, texte: "t", segmentId: "s1", sourceImage: "double" as const, motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.38 }, zoom: 1, valeur: "large" as const }, transition: "coupe" as const, angle: "trois-quarts" as const }];
const SEGMENTS: SegmentSousTitres[] = [];

describe("brique `composition` : Look réel = décor DANS la vidéo", () => {
  it("Look réel (look pour l'angle + piste qui en vient) : ni liseré, piste opaque, côtés prolongés par l'image du look très floutée", () => {
    const c = commande("decor-r1-bureau-bois");
    const v = { ...(c.styles.decor!.valeur as ValeurDecor), lookIdParAngle: { "trois-quarts": "lk-1" }, statut: "valide" as const };
    const cc = { ...c, styles: { ...c.styles, decor: { ...c.styles.decor!, valeur: v } }, medias: { "decor-r1-bureau-bois": { cle: "/essais/look-r1.jpg", mime: "image/jpeg" } } } as CommandeFabrication;
    const p = brique.parametresComposition(cc, { ratio: "4:5", plans: PLANS, segments: SEGMENTS, dureeSec: 4, pistesDouble: { "trois-quarts": "look.mp4" }, pistesDepuisLook: true }, RECETTE_COMPOSITION_AVOCAT);
    expect(p.image.contour).toBeUndefined();
    expect(p.image.doubles.principal).toMatchObject({ type: "video", transparent: false });
    expect(p.image.decor.flouPx).toBeGreaterThanOrEqual(24);
    expect(p.entrees.decor).toBe("/essais/look-r1.jpg");
    expect(p.alertes.some((a) => /fabriqué avec votre double/.test(a.message))).toBe(false);
  });
  it("Look encore à vérifier : il part, avec l'alerte « à vérifier »", () => {
    const c = commande("decor-r1-bureau-bois");
    const v = { ...(c.styles.decor!.valeur as ValeurDecor), lookIdParAngle: { "trois-quarts": "lk-1" } };
    const cc = { ...c, styles: { ...c.styles, decor: { ...c.styles.decor!, valeur: v } } } as CommandeFabrication;
    const p = brique.parametresComposition(cc, { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 4, pistesDouble: { "trois-quarts": "look.mp4" }, pistesDepuisLook: true }, RECETTE_COMPOSITION_AVOCAT);
    expect(p.alertes.some((a) => a.gravite === "attention" && /à vérifier/.test(a.message))).toBe(true);
    expect(p.image.contour).toBeUndefined();
  });
  it("sans look, ou piste détourée : repli Halo orange et alerte, exactement comme avant", () => {
    const c = commande("decor-r1-bureau-bois");
    const sans = brique.parametresComposition(c, { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 4, pistesDouble: { "trois-quarts": "d.webm" } }, RECETTE_COMPOSITION_AVOCAT);
    const avecDrapeauSansLook = brique.parametresComposition(c, { ratio: "9:16", plans: PLANS, segments: SEGMENTS, dureeSec: 4, pistesDouble: { "trois-quarts": "d.webm" }, pistesDepuisLook: true }, RECETTE_COMPOSITION_AVOCAT);
    expect(avecDrapeauSansLook).toEqual(sans);
    expect(sans.image.decor).toEqual(RECETTE_COMPOSITION_AVOCAT.decorRepli);
    expect(sans.image.doubles.principal).toMatchObject({ type: "video", transparent: true });
    expect(sans.image.contour).toBeDefined();
  });
  it("fond neutre N1 : l'option Look ne change rien", () => {
    const c = commande("decor-n1-halo-orange", { medias: { "decor-n1-halo-orange": { cle: "/demo/decors/fond-1-halo-orange.jpg", mime: "image/jpeg" } } });
    const e = { ratio: "9:16" as const, plans: PLANS, segments: SEGMENTS, dureeSec: 4, pistesDouble: { "trois-quarts": "d.webm" } };
    expect(brique.parametresComposition(c, { ...e, pistesDepuisLook: true }, RECETTE_COMPOSITION_AVOCAT)).toEqual(brique.parametresComposition(c, e, RECETTE_COMPOSITION_AVOCAT));
  });
  it("vignette sur le double : une image, plan large, même flou et même liseré que la vidéo ; références d'entrées résolues", () => {
    const n3 = valeur("decor-n3-lumiere-doree");
    const p = brique.proprietesVignetteDecor({ decor: brique.decorDepuisValeur(n3, true, RECETTE_COMPOSITION_AVOCAT.decorRepli), double: brique.doubleVignette(true) });
    expect(p).toMatchObject({ ratio: "9:16", largeur: 1080, hauteur: 1920, images: 1, decor: { image: "entree:decor", flouPx: 0 }, doubles: { principal: { type: "image", url: "entree:double-principal" } } });
    expect(p.contour).toEqual({ couleur: "#D69650", cote: "gauche" });
    const photo = brique.decorDepuisValeur({ type: "decor", mode: "image", methode: "photo-incrustee", profondeurFlou: 0, directionLumiere: "droite", positionSujet: 0.5 }, true, RECETTE_COMPOSITION_AVOCAT.decorRepli);
    expect(photo.flouPx).toBe(12);
    const parametres = brique.parametresVignetteDecor(p);
    expect(parametres).toMatchObject({ composition: "CompositionImage", references: true });
    const resolues = remplacerReferences(parametres.proprietes, { decor: "https://r2/decor.jpg", "double-principal": "https://r2/d.png" }) as typeof p;
    expect(resolues.decor.image).toBe("https://r2/decor.jpg");
    expect(brique.doubleVignette(false)).toEqual(brique.SILHOUETTE);
  });
});

/* ------------------------------------------------------------------ */
const MDP = "essai-b1-decors";
beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});

describe("service « Mes décors » (essai, sans clé)", () => {
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
  });

  it("écran : récurrents N1, N5, N3 ; réalistes R1-R8 « créés au premier usage » ; réserve N2, N4, N6 ; vignettes sur le double", async () => {
    const e = await decors.ecranDecors();
    expect(e.recurrents.map((d) => d.code)).toEqual(["N1", "N5", "N3"]);
    expect(e.recurrents.every((d) => d.surDouble?.includes("/sur-double/"))).toBe(true);
    expect(e.realistes.map((d) => d.code)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"]);
    expect(e.realistes.every((d) => d.etat === "look-a-creer")).toBe(true);
    expect(e.reserve.map((d) => d.code)).toEqual(["N2", "N4", "N6"]);
    expect(e).toMatchObject({ photosReelles: false, looksReels: false });
  });

  it("demande : coût affiché AVANT (essai : 0 €), confirmation exigée, puis 3 propositions sur le double", async () => {
    const depensesAvant = await depots().depenses.compter();
    const est = await decors.estimerDemandeDecor("Un bureau en bois avec une bibliothèque");
    expect(est).toMatchObject({ propositions: 3, essai: true, cout: { centimes: 0 } });
    await expect(decors.estimerDemandeDecor("une personne")).rejects.toThrow(/Décrivez un lieu/);
    await expect(decors.demanderDecor("Un bureau en bois", { confirme: false })).rejects.toThrow(/Confirmez/);
    const r = await decors.demanderDecor("Un bureau en bois avec une bibliothèque", { confirme: true });
    expect(r.propositionIds).toHaveLength(3);
    const e = await decors.ecranDecors();
    expect(e.demandes).toHaveLength(3);
    expect(e.demandes.every((d) => d.etat === "proposition" && d.methode === "photo-incrustee" && !!d.surDouble)).toBe(true);
    expect(new Set(e.demandes.map((d) => d.demande!.groupe.join()))).toEqual(new Set([r.propositionIds.join()]));
    expect(await depots().depenses.compter()).toBe(depensesAvant);
  });

  it("garder une proposition : elle est prête ; les deux autres sont RANGÉES, jamais supprimées", async () => {
    const avant = await depots().elements.compter();
    const { propositionIds } = await decors.demanderDecor("un atelier avec des lumières chaudes", { confirme: true });
    const { ranges } = await decors.garderProposition(propositionIds[1]);
    expect(ranges.sort()).toEqual([propositionIds[0], propositionIds[2]].sort());
    expect(await depots().elements.compter()).toBe(avant + 3);
    const garde = await depots().elements.obtenir(propositionIds[1]);
    expect(garde?.valeur).toMatchObject({ statut: "valide", demande: { retenu: true } });
    const e = await decors.ecranDecors();
    expect(e.ranges.map((d) => d.id).sort()).toEqual(ranges.sort());
  });

  it("ranger / remettre ; Halo orange (défaut avocat) ne se range pas", async () => {
    await expect(decors.rangerDecor("decor-n1-halo-orange", true)).rejects.toThrow(/défaut/);
    await decors.rangerDecor("decor-n6-mur-creme", true);
    expect((await depots().elements.obtenir("decor-n6-mur-creme"))?.archiveLe).toBeTruthy();
    await decors.rangerDecor("decor-n6-mur-creme", false);
    expect((await depots().elements.obtenir("decor-n6-mur-creme"))?.archiveLe).toBeUndefined();
  });

  it("mettre en avant : jusqu'à 5, jamais un décor à vérifier", async () => {
    await decors.mettreEnAvant("decor-n2-tube-led", true);
    await decors.mettreEnAvant("decor-n4-noir-uni", true);
    await expect(decors.mettreEnAvant("decor-n6-mur-creme", true)).rejects.toThrow(/5 décors/);
    await expect(decors.mettreEnAvant("decor-r2-bibliotheque", true)).rejects.toThrow(/Validez/);
    await decors.mettreEnAvant("decor-n4-noir-uni", false);
    await decors.mettreEnAvant("decor-n6-mur-creme", true);
    expect((await decors.ecranDecors()).recurrents.map((d) => d.code)).toEqual(["N1", "N5", "N3", "N2", "N6"]);
  });

  it("Look au premier usage : coût affiché, confirmation, un look par angle (visages générés à vérifier), puis réutilisé gratuitement", async () => {
    const est = await decors.estimerLookDecor("decor-r2-bibliotheque");
    expect(est).toMatchObject({ essai: true, reutilise: false, cout: { centimes: 0 } });
    expect(est.angles.sort()).toEqual(["face", "trois-quarts"]);
    await expect(decors.preparerLookDecor("decor-r2-bibliotheque", { confirme: false })).rejects.toThrow(/Confirmez/);
    const visagesAvant = await depots().visages.compter();
    const depensesAvant = await depots().depenses.compter();
    const r = await decors.preparerLookDecor("decor-r2-bibliotheque", { confirme: true });
    expect(r.crees.sort()).toEqual(["face", "trois-quarts"]);
    const e = await depots().elements.obtenir("decor-r2-bibliotheque");
    const v = e!.valeur as ValeurDecor;
    expect(Object.keys(v.lookIdParAngle ?? {}).sort()).toEqual(["face", "trois-quarts"]);
    expect(v.statut).toBe("a_verifier");
    const generes = await depots().visages.lister((x) => x.origine === "genere");
    expect(generes).toHaveLength(2);
    expect(generes.every((x) => x.statut === "a_verifier" && x.fondTournage === "Bibliothèque")).toBe(true);
    expect(await depots().visages.compter()).toBe(visagesAvant + 2);
    // Second usage : rien n'est refait, rien n'est payé.
    expect(await decors.preparerLookDecor("decor-r2-bibliotheque", { confirme: false })).toMatchObject({ crees: [], reutilise: true });
    expect((await decors.estimerLookDecor("decor-r2-bibliotheque")).reutilise).toBe(true);
    expect(await depots().visages.compter()).toBe(visagesAvant + 2);
    expect(await depots().depenses.compter()).toBe(depensesAvant);
    // Validation sur capture : le décor ET ses visages générés deviennent prêts.
    await decors.validerDecor("decor-r2-bibliotheque");
    expect(((await depots().elements.obtenir("decor-r2-bibliotheque"))!.valeur as ValeurDecor).statut).toBe("valide");
    expect((await depots().visages.lister((x) => x.origine === "genere")).every((x) => x.statut === "pret")).toBe(true);
    expect((await decors.ecranDecors()).realistes.find((d) => d.code === "R2")?.etat).toBe("look-pret");
  });

  it("un fond neutre n'a rien à fabriquer ; sans double prêt, le Look attend", async () => {
    await expect(decors.preparerLookDecor("decor-n1-halo-orange", { confirme: true })).rejects.toThrow(/posé par le studio/);
    for (const v of await depots().visages.lister()) await depots().visages.modifier(v.id, { statut: "en_preparation" });
    expect((await decors.estimerLookDecor("decor-r1-bureau-bois")).bloque).toMatch(/double n'existe pas encore/);
    await expect(decors.preparerLookDecor("decor-r1-bureau-bois", { confirme: true })).rejects.toThrow(/double n'existe pas encore/);
  });
});

describe("migration 14 : complète le catalogue sans rien réécrire, idempotente", () => {
  it("pose la vignette sur le double absente ; garde un choix de Will ; second passage : null", async () => {
    const d = reinitialiserDepots();
    const n1 = await d.elements.obtenir("decor-n1-halo-orange");
    const n5 = await d.elements.obtenir("decor-n5-creme-chaud");
    // Base d'avant le lot B1 : pas de vignette sur le double ; N5 rangé par Will et porteur d'une vignette à lui.
    await d.elements.modifier(n1!.id, { valeur: { ...(n1!.valeur as ValeurDecor), vignetteDoubleFichierId: undefined } });
    await d.elements.modifier(n5!.id, { archiveLe: MAINTENANT, valeur: { ...(n5!.valeur as ValeurDecor), vignetteDoubleFichierId: "f-a-will" } });
    const r = await etape14DecorsRealistes(d, MAINTENANT);
    expect(r?.vignettesPosees).toContain("decor-n1-halo-orange");
    expect(((await d.elements.obtenir("decor-n1-halo-orange"))!.valeur as ValeurDecor).vignetteDoubleFichierId).toBe(catalogue.vignetteSurDoubleId("N1"));
    const n5Apres = await d.elements.obtenir("decor-n5-creme-chaud");
    expect(n5Apres?.archiveLe).toBe(MAINTENANT);
    expect((n5Apres!.valeur as ValeurDecor).vignetteDoubleFichierId).toBe("f-a-will");
    expect(await etape14DecorsRealistes(d, MAINTENANT)).toBeNull();
  });
});
