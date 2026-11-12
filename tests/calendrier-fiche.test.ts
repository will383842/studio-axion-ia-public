/**
 * Fiche d'une entrée du calendrier (L4-04) : texte, premier commentaire, état ; actions avec contrôle de session.
 * Dépôts en mémoire, vraie garde de session (seuls les cookies et le cache de Next sont doublés), données fictives,
 * aucun appel réel.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "secret-fictif-de-test-pour-la-session-0123456789";

const temoin: { valeur?: string } = {};
const revalidations: string[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (temoin.valeur ? { value: temoin.valeur } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: (chemin: string) => void revalidations.push(chemin) }));

const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { signerJeton, DUREE_COURTE_SEC } = await import("@/lib/jeton-session");
const { enregistrerFicheEntreeAction, lireFicheEntreeAction } = await import("../src/app/(studio)/calendrier/actions");
const actionsCalendrier = await import("../src/app/(studio)/calendrier/actions");
const stockage = await import("@/services/calendrier-fiche");
const fiche = await import("@/components/calendrier/FicheEntree");
const { FicheEntree, LONGUEUR_MAX_PREMIER_COMMENTAIRE, LONGUEUR_MAX_TEXTE, adresseFiche, cleDepuisAdresse, lireCleFiche, phraseEtat, saisieDepuisFormulaire, verifierSaisie, verrouFiche } = fiche;
type EntreeFiche = import("@/components/calendrier/FicheEntree").EntreeFiche;
type CreneauEditorial = import("@/domaine/plan-editorial/types").CreneauEditorial;
type Publication = import("@/domaine/types").Publication;

const AUJOURDHUI = "2026-11-11"; // mercredi
const MIDI = "2026-11-11T11:00:00Z"; // 12 h à Paris
const DEMAIN = "2026-11-12";
const HIER = "2026-11-10";

async function ouvrirSession(options: { revoquee?: boolean; expiree?: boolean } = {}): Promise<void> {
  const jti = "session-fictive";
  const maintenant = new Date().toISOString();
  await depots().sessions.enregistrer({
    id: jti, jti, appareil: "essai", ip: "local", resterConnecte: false,
    expireLe: new Date(Date.now() + (options.expiree ? -1000 : 3_600_000)).toISOString(),
    derniereActivite: maintenant, creeLe: maintenant, modifieLe: maintenant,
    ...(options.revoquee ? { revoqueeLe: maintenant } : {}),
  });
  temoin.valeur = await signerJeton({ jti, rc: false }, DUREE_COURTE_SEC);
}

async function creneau(id: string, p: Partial<CreneauEditorial> = {}): Promise<CreneauEditorial> {
  return depots().creneauxEditoriaux.enregistrer({ id, jourVise: DEMAIN, heuresParReseau: { linkedin: "2026-11-12T08:00:00Z" }, compteCible: "compte-fictif", statut: "a_valider", decalages: 0, ...p });
}

async function publication(id: string, p: Partial<Publication> = {}): Promise<Publication> {
  return depots().publications.enregistrer({ id, creeLe: MIDI, modifieLe: MIDI, videoId: "video-fictive", reseau: "linkedin", statut: "echec", via: "zernio", date: "2026-11-12T08:00:00Z", texte: "Texte d'origine.", ...p });
}

/** Tout ce qui est écrit pour les fiches, pour prouver qu'un refus n'écrit rien. */
async function ecritures(): Promise<string> {
  const d = depots();
  const fiches = await d.parametres.lister((p) => p.id.startsWith("calendrier.fiche."));
  return JSON.stringify({ fiches: fiches.map((p) => [p.id, p.valeur]), publications: (await d.publications.lister()).map((p) => [p.id, p.texte, p.statut]), creneaux: await d.creneauxEditoriaux.lister() });
}

async function attendreRefusSansSession(appel: () => Promise<unknown>): Promise<void> {
  const avant = await ecritures();
  // La garde redirige vers la connexion : l'action ne rend aucun résultat et n'écrit rien.
  await expect(appel()).rejects.toMatchObject({ digest: expect.stringContaining("/connexion") });
  expect(await ecritures()).toBe(avant);
  expect(revalidations).toEqual([]);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(MIDI));
  reinitialiserDepots();
  temoin.valeur = undefined;
  revalidations.length = 0;
});
afterEach(() => vi.useRealTimers());

describe("action refusée sans session", () => {
  it("sans témoin de session : enregistrer est refusé, rien n'est écrit", async () => {
    await creneau("c1");
    await attendreRefusSansSession(() => enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte pirate." }));
  });

  it("sans témoin de session : lire est refusé aussi", async () => {
    await creneau("c1");
    await attendreRefusSansSession(() => lireFicheEntreeAction("creneau:c1|linkedin"));
  });

  it("témoin illisible, session révoquée ou expirée : refusé de la même façon", async () => {
    await creneau("c1");
    temoin.valeur = "ceci-n-est-pas-un-jeton";
    await attendreRefusSansSession(() => enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte pirate." }));
    await ouvrirSession({ revoquee: true });
    await attendreRefusSansSession(() => enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte pirate." }));
    await ouvrirSession({ expiree: true });
    await attendreRefusSansSession(() => enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte pirate." }));
  });

  it("avec une session valide, la même demande passe", async () => {
    await creneau("c1");
    await ouvrirSession();
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte permis." });
    expect(r).toMatchObject({ ok: true, donnees: { texte: "Texte permis.", modifie: true } });
  });
});

describe("édition refusée pour une entrée publiée", () => {
  beforeEach(() => ouvrirSession());

  it("publication publiée : refus clair, le texte ne change pas", async () => {
    await publication("p1", { statut: "publiee", idExterne: "ext-fictif" });
    const avant = await ecritures();
    const r = await enregistrerFicheEntreeAction("publication:p1|linkedin", { texte: "Nouveau texte.", premierCommentaire: "Nouveau commentaire." });
    expect(r).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
    expect(r.ok ? "" : r.message).toBe("Déjà publiée. Elle n'est plus modifiable.");
    expect(await ecritures()).toBe(avant);
    expect(revalidations).toEqual([]);
  });

  it("publication publiée à la main, sans identifiant du diffuseur et à une date future : refusée quand même", async () => {
    await publication("p1", { statut: "publiee", via: "manuel", date: "2026-12-01T08:00:00Z" });
    const r = await enregistrerFicheEntreeAction("publication:p1|linkedin", { texte: "Nouveau texte." });
    expect(r).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
    expect((await depots().publications.obtenir("p1"))?.texte).toBe("Texte d'origine.");
  });

  it("créneau publié : refusé, rien n'est écrit", async () => {
    await creneau("c1", { statut: "publie" });
    const avant = await ecritures();
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Nouveau texte." })).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
    expect(await ecritures()).toBe(avant);
  });

  it("le premier commentaire seul est refusé aussi sur une entrée publiée", async () => {
    await publication("p1", { statut: "publiee" });
    const avant = await ecritures();
    expect(await enregistrerFicheEntreeAction("publication:p1|linkedin", { texte: "Texte d'origine.", premierCommentaire: "Ajout tardif." })).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
    expect(await ecritures()).toBe(avant);
  });

  it("la fiche d'une entrée publiée se lit toujours", async () => {
    await publication("p1", { statut: "publiee" });
    const r = await lireFicheEntreeAction("publication:p1|linkedin");
    expect(r).toMatchObject({ ok: true, donnees: { etat: "publie", texte: "Texte d'origine.", jour: DEMAIN, heure: "09:00" } });
  });
});

describe("édition possible tant que rien n'est envoyé", () => {
  beforeEach(() => ouvrirSession());

  it("chaque statut d'un créneau : seuls ceux d'avant l'envoi se modifient", async () => {
    const attendu: Record<string, boolean> = { propose: true, a_valider: true, valide: true, echec: true, programme: false, publie: false, archive: false };
    for (const [statut, permis] of Object.entries(attendu)) {
      reinitialiserDepots();
      await ouvrirSession();
      await creneau("c1", { statut: statut as CreneauEditorial["statut"] });
      const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: `Texte ${statut}.` });
      expect([statut, r.ok]).toEqual([statut, permis]);
      const lue = await depots().parametres.obtenir("calendrier.fiche.creneau:c1|linkedin");
      expect([statut, lue !== null]).toEqual([statut, permis]);
    }
  });

  it("chaque statut d'une publication : brouillon et échec non confiés se modifient, le reste non", async () => {
    const cas: [Partial<Publication>, boolean][] = [
      [{ statut: "brouillon", via: "manuel" }, true],
      [{ statut: "echec", etatEnvoi: "refuse" }, true],
      [{ statut: "echec", etatEnvoi: "absent" }, true],
      [{ statut: "brouillon", idExterne: "ext-fictif" }, false],
      [{ statut: "brouillon", etatEnvoi: "en-cours" }, false],
      [{ statut: "brouillon", etatEnvoi: "envoye" }, false],
      [{ statut: "brouillon", etatEnvoi: "a-verifier" }, false],
      [{ statut: "programmee" }, false],
      [{ statut: "publiee" }, false],
    ];
    for (const [champs, permis] of cas) {
      reinitialiserDepots();
      await ouvrirSession();
      await publication("p1", champs);
      const r = await enregistrerFicheEntreeAction("publication:p1|linkedin", { texte: "Texte corrigé." });
      expect([champs, r.ok]).toEqual([champs, permis]);
      expect([champs, (await depots().publications.obtenir("p1"))?.texte]).toEqual([champs, permis ? "Texte corrigé." : "Texte d'origine."]);
    }
  });

  it("une entrée déjà confiée à l'outil de publication dit pourquoi elle est refusée", async () => {
    await creneau("c1", { statut: "programme" });
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte." });
    expect(r).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
    expect(r.ok ? "" : r.message).toBe("Cette publication est déjà programmée : son texte ne se modifie plus ici.");
  });

  it("le texte et le premier commentaire d'un créneau s'enregistrent et se relisent", async () => {
    await creneau("c1");
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "  Deux entreprises, même métier.\r\nLa suite.  ", premierCommentaire: " Et chez vous ? " });
    expect(r).toEqual({ ok: true, donnees: { cle: "creneau:c1|linkedin", texte: "Deux entreprises, même métier.\nLa suite.", premierCommentaire: "Et chez vous ?", modifie: true, aRevalider: false } });
    expect(revalidations).toEqual(["/calendrier"]);
    const lue = await lireFicheEntreeAction("creneau:c1|linkedin");
    expect(lue).toMatchObject({ ok: true, donnees: { cle: "creneau:c1|linkedin", reseau: "linkedin", type: "video", etat: "a_valider", jour: DEMAIN, heure: "09:00", texte: "Deux entreprises, même métier.\nLa suite.", premierCommentaire: "Et chez vous ?" } });
    // Le statut ne bouge pas : la fiche n'envoie rien et ne valide rien.
    expect((await depots().creneauxEditoriaux.obtenir("c1"))?.statut).toBe("a_valider");
  });

  it("le texte d'une publication non envoyée change dans la publication elle-même", async () => {
    await publication("p1", { statut: "echec", etatEnvoi: "refuse", visuelId: "visuel-fictif", videoId: undefined });
    const r = await enregistrerFicheEntreeAction("publication:p1|linkedin", { texte: "Texte corrigé.", premierCommentaire: "Commentaire corrigé." });
    expect(r).toMatchObject({ ok: true, donnees: { modifie: true } });
    expect(await depots().publications.obtenir("p1")).toMatchObject({ texte: "Texte corrigé.", statut: "echec" });
    expect(await lireFicheEntreeAction("publication:p1|linkedin")).toMatchObject({ ok: true, donnees: { type: "carrousel", etat: "a_corriger", texte: "Texte corrigé.", premierCommentaire: "Commentaire corrigé." } });
  });

  it("chaque réseau d'un créneau garde son texte à lui", async () => {
    await creneau("c1", { heuresParReseau: { linkedin: "2026-11-12T08:00:00Z", instagram: "2026-11-12T16:30:00Z" } });
    await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Pour LinkedIn." });
    await enregistrerFicheEntreeAction("creneau:c1|instagram", { texte: "Pour Instagram." });
    expect(await lireFicheEntreeAction("creneau:c1|linkedin")).toMatchObject({ ok: true, donnees: { texte: "Pour LinkedIn.", heure: "09:00" } });
    expect(await lireFicheEntreeAction("creneau:c1|instagram")).toMatchObject({ ok: true, donnees: { texte: "Pour Instagram.", heure: "17:30" } });
  });

  it("rejeu : la même saisie une seconde fois n'écrit rien de plus", async () => {
    await creneau("c1");
    const saisie = { texte: "Texte.", premierCommentaire: "Commentaire." };
    await enregistrerFicheEntreeAction("creneau:c1|linkedin", saisie);
    vi.setSystemTime(new Date("2026-11-11T11:05:00Z"));
    const avant = await depots().parametres.obtenir("calendrier.fiche.creneau:c1|linkedin");
    revalidations.length = 0;
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", saisie);
    expect(r).toMatchObject({ ok: true, donnees: { modifie: false, aRevalider: false, texte: "Texte.", premierCommentaire: "Commentaire." } });
    expect(await depots().parametres.obtenir("calendrier.fiche.creneau:c1|linkedin")).toEqual(avant);
    expect(revalidations).toEqual([]);
  });

  it("premier commentaire absent de la saisie : celui d'avant est gardé ; vide : il est retiré", async () => {
    await creneau("c1");
    await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte.", premierCommentaire: "Commentaire." });
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte revu." })).toMatchObject({ ok: true, donnees: { premierCommentaire: "Commentaire.", modifie: true } });
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte revu.", premierCommentaire: "   " })).toMatchObject({ ok: true, donnees: { premierCommentaire: null, modifie: true } });
    const lue = await lireFicheEntreeAction("creneau:c1|linkedin");
    expect(lue.ok && lue.donnees.premierCommentaire).toBeUndefined();
  });

  it("texte vide : accepté (un brouillon se complète plus tard)", async () => {
    await creneau("c1");
    await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte." });
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "" })).toMatchObject({ ok: true, donnees: { texte: "", modifie: true } });
  });

  it("une entrée déjà validée dont le texte change repasse « à valider » et perd sa trace de validation", async () => {
    await creneau("c1", { statut: "valide", valideeLe: "2026-11-10T09:00:00Z", valideePar: "le fondateur" });
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte changé après validation." });
    expect(r).toMatchObject({ ok: true, donnees: { modifie: true, aRevalider: true } });
    const apres = await depots().creneauxEditoriaux.obtenir("c1");
    expect(apres?.statut).toBe("a_valider");
    expect(apres?.valideeLe).toBeUndefined();
    expect(apres?.valideePar).toBeUndefined();
  });

  it("une entrée validée dont rien ne change garde sa validation", async () => {
    await creneau("c1", { statut: "a_valider" });
    await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte validé." });
    await creneau("c1", { statut: "valide", valideeLe: "2026-11-10T09:00:00Z", valideePar: "le fondateur" });
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte validé." })).toMatchObject({ ok: true, donnees: { modifie: false, aRevalider: false } });
    expect(await depots().creneauxEditoriaux.obtenir("c1")).toMatchObject({ statut: "valide", valideeLe: "2026-11-10T09:00:00Z" });
  });
});

describe("verrou du jour passé, à l'heure de Paris", () => {
  beforeEach(() => ouvrirSession());

  it("aujourd'hui se modifie jusqu'à 23 h 59 à Paris, plus à minuit", async () => {
    await creneau("c1", { jourVise: AUJOURDHUI, heuresParReseau: { linkedin: "2026-11-11T08:00:00Z" } });
    vi.setSystemTime(new Date("2026-11-11T22:59:59Z")); // 23:59:59 à Paris
    await ouvrirSession();
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Dernière minute." })).toMatchObject({ ok: true });
    vi.setSystemTime(new Date("2026-11-11T23:00:00Z")); // minuit à Paris, encore le 11 en temps universel
    await ouvrirSession();
    const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Trop tard." });
    expect(r).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
    expect(r.ok ? "" : r.message).toBe("Ce jour est passé : cette publication n'est plus modifiable.");
  });

  it("hier est refusé, demain est permis, quel que soit l'état", async () => {
    await creneau("hier", { jourVise: HIER, statut: "a_valider" });
    await creneau("demain", { jourVise: DEMAIN, statut: "a_valider" });
    expect(await enregistrerFicheEntreeAction("creneau:hier|linkedin", { texte: "Texte." })).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
    expect(await enregistrerFicheEntreeAction("creneau:demain|linkedin", { texte: "Texte." })).toMatchObject({ ok: true });
  });

  it("le jour d'une publication est son jour de Paris, pas celui du temps universel", async () => {
    // 23 h 30 en temps universel le 10 = 0 h 30 à Paris le 11 : la publication est d'aujourd'hui.
    await publication("p1", { statut: "brouillon", via: "manuel", date: "2026-11-10T23:30:00Z" });
    expect(await lireFicheEntreeAction("publication:p1|linkedin")).toMatchObject({ ok: true, donnees: { jour: AUJOURDHUI, heure: "00:30" } });
    expect(await enregistrerFicheEntreeAction("publication:p1|linkedin", { texte: "Texte." })).toMatchObject({ ok: true });
  });

  it("changement d'heure : le dernier dimanche d'octobre et de mars restent bien bornés", () => {
    expect(verrouFiche({ etat: "brouillon", jour: "2026-10-25" }, "2026-10-25")).toBeNull();
    expect(verrouFiche({ etat: "brouillon", jour: "2026-10-25" }, "2026-10-26")).toBe("passee");
    expect(verrouFiche({ etat: "brouillon", jour: "2027-03-28" }, "2027-03-28")).toBeNull();
  });
});

describe("saisie vide, illisible ou hors limite", () => {
  beforeEach(() => ouvrirSession());

  it("clé vide, illisible, d'un réseau inconnu ou d'une entrée absente : refus sans écriture", async () => {
    await creneau("c1");
    const avant = await ecritures();
    for (const cle of ["", "   ", "creneau:c1", "creneau:|linkedin", "autre:c1|linkedin", "creneau:c1|minitel", "creneau:c1|linkedin|x", "creneau:absent|linkedin", "publication:absente|linkedin", "creneau:c1|instagram", null, undefined, 12, {}]) {
      const r = await enregistrerFicheEntreeAction(cle as string, { texte: "Texte." });
      expect([cle, r.ok, r.ok ? "" : r.code]).toEqual([cle, false, "FICHE_INTROUVABLE"]);
      const l = await lireFicheEntreeAction(cle as string);
      expect([cle, l.ok]).toEqual([cle, false]);
    }
    expect(await ecritures()).toBe(avant);
  });

  it("un réseau du créneau sans heure n'est pas une entrée : introuvable", async () => {
    await creneau("c1", { heuresParReseau: { linkedin: "2026-11-12T08:00:00Z", facebook: "" } });
    expect(await enregistrerFicheEntreeAction("creneau:c1|facebook", { texte: "Texte." })).toMatchObject({ ok: false, code: "FICHE_INTROUVABLE" });
    expect(await depots().parametres.obtenir("calendrier.fiche.creneau:c1|facebook")).toBeNull();
  });

  it("la réponse brute de l'outil de publication n'est jamais recopiée dans la fiche", async () => {
    await publication("p1", { statut: "echec", etatEnvoi: "refuse", erreur: "Réponse technique fictive 422" });
    const lue = await lireFicheEntreeAction("publication:p1|linkedin");
    expect(lue.ok && JSON.stringify(lue.donnees)).not.toContain("422");
  });

  it("une publication demandée sous un autre réseau que le sien est introuvable", async () => {
    await publication("p1", { statut: "brouillon", via: "manuel", reseau: "facebook" });
    expect(await enregistrerFicheEntreeAction("publication:p1|linkedin", { texte: "Texte." })).toMatchObject({ ok: false, code: "FICHE_INTROUVABLE" });
    expect(await enregistrerFicheEntreeAction("publication:p1|facebook", { texte: "Texte." })).toMatchObject({ ok: true });
  });

  it("saisie illisible : refusée sans écriture", async () => {
    await creneau("c1");
    const avant = await ecritures();
    for (const saisie of [null, undefined, "texte", 12, [], {}, { texte: 12 }, { texte: null }, { texte: "Texte.", premierCommentaire: 12 }, { texte: "Texte.", premierCommentaire: {} }]) {
      const r = await enregistrerFicheEntreeAction("creneau:c1|linkedin", saisie as never);
      expect([saisie, r.ok, r.ok ? "" : r.code]).toEqual([saisie, false, "FICHE_FORMAT"]);
    }
    expect(await ecritures()).toBe(avant);
  });

  it("longueur : la limite exacte passe, un caractère de plus est refusé", async () => {
    await creneau("c1");
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "a".repeat(LONGUEUR_MAX_TEXTE), premierCommentaire: "b".repeat(LONGUEUR_MAX_PREMIER_COMMENTAIRE) })).toMatchObject({ ok: true });
    const avant = await ecritures();
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "a".repeat(LONGUEUR_MAX_TEXTE + 1) })).toMatchObject({ ok: false, code: "FICHE_FORMAT" });
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "a", premierCommentaire: "b".repeat(LONGUEUR_MAX_PREMIER_COMMENTAIRE + 1) })).toMatchObject({ ok: false, code: "FICHE_FORMAT" });
    expect(await ecritures()).toBe(avant);
  });

  it("TikTok n'a pas de premier commentaire : un commentaire y est refusé, le texte seul passe", async () => {
    await creneau("c1", { heuresParReseau: { tiktok: "2026-11-12T18:00:00Z" } });
    const r = await enregistrerFicheEntreeAction("creneau:c1|tiktok", { texte: "Texte.", premierCommentaire: "Commentaire." });
    expect(r).toMatchObject({ ok: false, code: "FICHE_FORMAT" });
    expect(await enregistrerFicheEntreeAction("creneau:c1|tiktok", { texte: "Texte.", premierCommentaire: "" })).toMatchObject({ ok: true, donnees: { premierCommentaire: null } });
  });

  it("une valeur enregistrée illisible ne fait pas planter la lecture", async () => {
    await creneau("c1");
    const m = new Date().toISOString();
    await depots().parametres.enregistrer({ id: "calendrier.fiche.creneau:c1|linkedin", valeur: "n'importe quoi", creeLe: m, modifieLe: m });
    expect(await lireFicheEntreeAction("creneau:c1|linkedin")).toMatchObject({ ok: true, donnees: { texte: "" } });
    await depots().parametres.enregistrer({ id: "calendrier.fiche.creneau:c1|linkedin", valeur: { texte: 12, premierCommentaire: ["x"] }, creeLe: m, modifieLe: m });
    const lue = await lireFicheEntreeAction("creneau:c1|linkedin");
    expect(lue).toMatchObject({ ok: true, donnees: { texte: "" } });
    expect(lue.ok && lue.donnees.premierCommentaire).toBeUndefined();
  });

  it("un créneau au jour ou à l'heure illisibles se lit mais ne se modifie pas", async () => {
    await creneau("c1", { jourVise: "bientôt", heuresParReseau: { linkedin: "pas une heure" } });
    const lue = await lireFicheEntreeAction("creneau:c1|linkedin");
    expect(lue).toMatchObject({ ok: true, donnees: { jour: "bientôt" } });
    expect(lue.ok && lue.donnees.heure).toBeUndefined();
    expect(await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte." })).toMatchObject({ ok: false, code: "FICHE_VERROUILLEE" });
  });
});

describe("découpage : le stockage du texte sort d'actions.ts (CORRECTIF A et B)", () => {
  beforeEach(() => ouvrirSession());

  it("actions.ts ne garde que les deux actions de la fiche", () => {
    expect(Object.keys(actionsCalendrier).sort()).toEqual(["enregistrerFicheEntreeAction", "lireFicheEntreeAction"]);
  });

  it("le texte et le premier commentaire d'un créneau se lisent par le service, sans passer par une action", async () => {
    await creneau("c1");
    const cle = lireCleFiche("creneau:c1|linkedin");
    expect(cle).not.toBeNull();
    expect(await stockage.lireStockageFiche(cle!)).toEqual({ texte: undefined, premierCommentaire: undefined });
    await enregistrerFicheEntreeAction("creneau:c1|linkedin", { texte: "Texte du créneau.", premierCommentaire: "Et chez vous ?" });
    expect(await stockage.lireStockageFiche(cle!)).toEqual({ texte: "Texte du créneau.", premierCommentaire: "Et chez vous ?" });
  });

  it("le service écrit, l'action relit : un seul stockage", async () => {
    await creneau("c1");
    const cle = lireCleFiche("creneau:c1|linkedin")!;
    await stockage.ecrireStockageFiche(cle, { texte: "Écrit par le service.", premierCommentaire: "Commentaire du service." });
    expect(await lireFicheEntreeAction("creneau:c1|linkedin")).toMatchObject({ ok: true, donnees: { texte: "Écrit par le service.", premierCommentaire: "Commentaire du service." } });
  });

  it("une valeur illisible dans le stockage ne rend rien", async () => {
    const cle = lireCleFiche("creneau:c1|linkedin")!;
    const m = new Date().toISOString();
    await depots().parametres.enregistrer({ id: "calendrier.fiche.creneau:c1|linkedin", valeur: ["x"], creeLe: m, modifieLe: m });
    expect(await stockage.lireStockageFiche(cle)).toEqual({ texte: undefined, premierCommentaire: undefined });
  });
});

describe("fiche d'un carrousel programmé : identifiant avec « : » (CORRECTIF D)", () => {
  const ID = "pub_envoi:vis-1:linkedin:v0";
  beforeEach(() => ouvrirSession());

  it("la clé d'une carte dont l'identifiant contient « : » se lit au dernier « | »", () => {
    expect(lireCleFiche(`publication:${ID}|linkedin`)).toEqual({ cle: `publication:${ID}|linkedin`, origine: "publication", id: ID, reseau: "linkedin" });
    expect(lireCleFiche("creneau:a:b|youtube-shorts")).toMatchObject({ origine: "creneau", id: "a:b", reseau: "youtube-shorts" });
    for (const cle of ["publication:|linkedin", "publication:|x|linkedin", `publication:${"a:".repeat(101)}|linkedin`, "publication:a b:c|linkedin", "publication:a:b", "publication:a|b|linkedin"]) expect([cle, lireCleFiche(cle)]).toEqual([cle, null]);
  });

  it("encodée dans l'adresse, la clé se décode à la lecture, et rien d'autre n'est accepté", () => {
    const cle = `publication:${ID}|linkedin`;
    const adresse = adresseFiche(cle);
    expect(adresse).not.toContain(":");
    expect(adresse).not.toContain("|");
    expect(cleDepuisAdresse(adresse)).toEqual(lireCleFiche(cle));
    expect(cleDepuisAdresse(cle)).toEqual(lireCleFiche(cle));
    for (const mauvaise of ["", "%E0%A4%A", "%00", null, undefined, 4]) expect([mauvaise, cleDepuisAdresse(mauvaise)]).toEqual([mauvaise, null]);
  });

  it("la fiche d'une publication programmée par programmerVisuel s'ouvre et se modifie", async () => {
    await publication(ID, { statut: "echec", visuelId: "vis-1", videoId: undefined, texte: "Texte du carrousel." });
    const cle = `publication:${ID}|linkedin`;
    expect(await lireFicheEntreeAction(cle)).toMatchObject({ ok: true, donnees: { cle, type: "carrousel", texte: "Texte du carrousel." } });
    const lue = cleDepuisAdresse(adresseFiche(cle));
    expect(lue?.id).toBe(ID);
    expect(await enregistrerFicheEntreeAction(cle, { texte: "Texte revu.", premierCommentaire: "Et chez vous ?" })).toMatchObject({ ok: true, donnees: { modifie: true } });
    expect(await lireFicheEntreeAction(cle)).toMatchObject({ ok: true, donnees: { texte: "Texte revu.", premierCommentaire: "Et chez vous ?" } });
  });

  it("un identifiant avec « : » est introuvable s'il n'existe pas, et ne mélange pas deux entrées", async () => {
    await publication("a", { statut: "echec" });
    expect(await lireFicheEntreeAction("publication:a:b|linkedin")).toMatchObject({ ok: false, code: "FICHE_INTROUVABLE" });
  });
});

describe("règles pures de la fiche", () => {
  it("lireCleFiche : la clé d'une carte, rien d'autre", () => {
    expect(lireCleFiche("creneau:c1|linkedin")).toEqual({ cle: "creneau:c1|linkedin", origine: "creneau", id: "c1", reseau: "linkedin" });
    expect(lireCleFiche("publication:pub-0a1b2c|youtube-shorts")).toEqual({ cle: "publication:pub-0a1b2c|youtube-shorts", origine: "publication", id: "pub-0a1b2c", reseau: "youtube-shorts" });
    for (const cle of ["", "creneau:c1", "creneau:c1|", "creneau:c 1|linkedin", " creneau:c1|linkedin", "creneau:c1|LinkedIn", `creneau:${"a".repeat(201)}|linkedin`, null, undefined, 3]) expect(lireCleFiche(cle)).toBeNull();
    expect(lireCleFiche(`creneau:${"a".repeat(200)}|linkedin`)).not.toBeNull();
  });

  it("verrouFiche : publiée, passée, confiée, état inconnu, jour illisible", () => {
    expect(verrouFiche({ etat: "publie", jour: DEMAIN }, AUJOURDHUI)).toBe("publiee");
    expect(verrouFiche({ etat: "publie", jour: HIER }, AUJOURDHUI)).toBe("publiee");
    expect(verrouFiche({ etat: "brouillon", jour: HIER }, AUJOURDHUI)).toBe("passee");
    expect(verrouFiche({ etat: "programme", jour: DEMAIN }, AUJOURDHUI)).toBe("confiee");
    expect(verrouFiche({ etat: "brouillon", jour: DEMAIN, confiee: true }, AUJOURDHUI)).toBe("confiee");
    expect(verrouFiche({ etat: "refusee", jour: DEMAIN }, AUJOURDHUI)).toBe("etat");
    expect(verrouFiche({ etat: "", jour: DEMAIN }, AUJOURDHUI)).toBe("etat");
    for (const jour of ["", "demain", "2026-02-30", "2026-13-01"]) expect([jour, verrouFiche({ etat: "brouillon", jour }, AUJOURDHUI)]).toEqual([jour, "illisible"]);
    for (const auj of ["", "aujourd'hui", "2026-02-30"]) expect([auj, verrouFiche({ etat: "brouillon", jour: DEMAIN }, auj)]).toEqual([auj, "illisible"]);
    for (const etat of ["brouillon", "a_valider", "a_corriger", "idee"]) expect([etat, verrouFiche({ etat, jour: AUJOURDHUI }, AUJOURDHUI)]).toEqual([etat, null]);
  });

  it("verifierSaisie : nettoie, borne et dit ce qui ne va pas en vouvoyant", () => {
    expect(verifierSaisie({ texte: " a\r\nb ", premierCommentaire: " c " }, "linkedin")).toEqual({ ok: true, saisie: { texte: "a\nb", premierCommentaire: "c" } });
    expect(verifierSaisie({ texte: "a" }, "linkedin")).toEqual({ ok: true, saisie: { texte: "a" } });
    expect(verifierSaisie({ texte: "a", premierCommentaire: null }, "linkedin")).toEqual({ ok: true, saisie: { texte: "a" } });
    const tropLong = verifierSaisie({ texte: "a".repeat(LONGUEUR_MAX_TEXTE + 1) }, "linkedin");
    expect(tropLong.ok ? "" : tropLong.message).toMatch(/^Ce texte est trop long/);
    expect(verifierSaisie({ texte: "a", premierCommentaire: "c" }, "tiktok")).toMatchObject({ ok: false });
    expect(verifierSaisie(undefined, "linkedin")).toMatchObject({ ok: false });
  });

  it("saisieDepuisFormulaire : lit la clé, le texte et le premier commentaire d'un formulaire", () => {
    const f = new FormData();
    f.set("cle", "creneau:c1|linkedin");
    f.set("texte", "Texte.");
    expect(saisieDepuisFormulaire(f)).toEqual({ cle: "creneau:c1|linkedin", saisie: { texte: "Texte." } });
    f.set("premierCommentaire", "");
    expect(saisieDepuisFormulaire(f)).toEqual({ cle: "creneau:c1|linkedin", saisie: { texte: "Texte.", premierCommentaire: "" } });
    expect(saisieDepuisFormulaire(new FormData())).toEqual({ cle: "", saisie: { texte: "" } });
  });

  it("phraseEtat : jamais « Partira seule » tant que l'envoi est éteint", () => {
    const e = { etat: "programme", jour: DEMAIN, heure: "09:00" };
    expect(phraseEtat(e)).toBe("Programmé, envoi éteint : rien ne partira tant que l'envoi n'est pas allumé.");
    expect(phraseEtat(e, { envoiAllume: false })).not.toContain("Partira seule");
    expect(phraseEtat(e, { envoiAllume: true })).toBe("Partira seule jeudi 12 novembre à 09:00.");
    expect(phraseEtat({ etat: "programme", jour: "illisible" }, { envoiAllume: true })).toBe("Partira seule à la date prévue.");
    expect(phraseEtat({ etat: "publie", jour: HIER })).toBe("Déjà publiée. Elle n'est plus modifiable.");
    expect(phraseEtat({ etat: "a_corriger", jour: DEMAIN })).toBe("Le réseau l'a refusée. Rien n'est parti.");
    expect(phraseEtat({ etat: "idee", jour: DEMAIN })).toBe("Idée de l'IA. Elle ne partira jamais sans vous.");
    for (const etat of ["brouillon", "a_valider"]) expect(phraseEtat({ etat, jour: DEMAIN })).toBe("Ne partira pas tant que vous n'avez pas validé.");
    expect(phraseEtat({ etat: "mystere", jour: DEMAIN })).toBe("État à vérifier : rien ne part d'ici.");
  });
});

describe("composant FicheEntree", () => {
  const base: EntreeFiche = { cle: "creneau:c1|linkedin", jour: DEMAIN, reseau: "linkedin", type: "video", etat: "a_valider", heure: "09:00", texte: "Deux entreprises, même métier.", premierCommentaire: "Combien de temps pour répondre à un devis chez vous ?" };
  const action = async () => {};
  const rendre = (p: Partial<Parameters<typeof FicheEntree>[0]> = {}) => renderToStaticMarkup(createElement(FicheEntree, { entree: base, aujourdhui: AUJOURDHUI, action, ...p }) as ReactElement);
  // Le petit script que React joint à un formulaire n'est pas lu par une personne : il est écarté.
  const lisible = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
  const zone = (html: string, nom: string) => new RegExp(`<textarea[^>]*name="${nom}"[^>]*>`).exec(html)?.[0] ?? "";

  it("montre le réseau, le type, la date à l'heure de Paris, l'état, le texte et le premier commentaire", () => {
    const h = rendre();
    const t = lisible(h);
    expect(t).toContain("LinkedIn · Vidéo");
    expect(t).toContain("jeudi 12 novembre 2026 à 09:00, heure de Paris");
    expect(t).toContain("À valider");
    expect(t).toContain("Ne partira pas tant que vous n'avez pas validé.");
    expect(t).toContain("Deux entreprises, même métier.");
    expect(t).toContain("Combien de temps pour répondre à un devis chez vous ?");
    expect(h).toContain('data-fiche="creneau:c1|linkedin"');
    expect(h).toContain('data-etat="a_valider"');
  });

  it("modifiable : deux zones de saisie, la clé cachée et un bouton pour enregistrer", () => {
    const h = rendre();
    expect(zone(h, "texte")).not.toContain("readOnly");
    expect(zone(h, "premierCommentaire")).not.toContain("readOnly");
    expect(h).toMatch(/<input[^>]*type="hidden"[^>]*name="cle"[^>]*value="creneau:c1\|linkedin"/);
    expect(h).toMatch(/<button[^>]*type="submit"[^>]*>.*Enregistrer le texte/);
    expect(h).toContain(`maxLength="${LONGUEUR_MAX_TEXTE}"`);
    expect(h).not.toContain("data-verrou");
  });

  it("entrée publiée : lecture seule, aucun bouton pour enregistrer, et la fiche le dit", () => {
    const h = rendre({ entree: { ...base, etat: "publie", jour: HIER } });
    expect(zone(h, "texte")).toContain("readOnly");
    expect(zone(h, "premierCommentaire")).toContain("readOnly");
    expect(h).not.toContain('type="submit"');
    expect(h).not.toContain("<form");
    expect(h).toContain('data-verrou="publiee"');
    expect(lisible(h)).toContain("Déjà publiée. Elle n'est plus modifiable.");
  });

  it("chaque verrou rend la fiche en lecture seule et donne sa raison", () => {
    const cas: [Partial<EntreeFiche>, string, string][] = [
      [{ jour: HIER }, "passee", "Ce jour est passé : cette publication n'est plus modifiable."],
      [{ etat: "programme" }, "confiee", "Cette publication est déjà programmée : son texte ne se modifie plus ici."],
      [{ confiee: true }, "confiee", "Cette publication est déjà programmée : son texte ne se modifie plus ici."],
      [{ etat: "manquee" }, "etat", "Dans cet état, cette publication ne se modifie pas ici."],
      [{ jour: "un jour" }, "illisible", "La date de cette publication est illisible : elle ne se modifie pas ici."],
    ];
    for (const [champs, raison, phrase] of cas) {
      const h = rendre({ entree: { ...base, ...champs } });
      expect([raison, h.includes(`data-verrou="${raison}"`), h.includes('type="submit"')]).toEqual([raison, true, false]);
      expect(lisible(h)).toContain(phrase);
      expect(zone(h, "texte")).toContain("readOnly");
    }
  });

  it("sans action fournie : lecture seule, sans bouton", () => {
    const h = rendre({ action: undefined });
    expect(h).not.toContain('type="submit"');
    expect(zone(h, "texte")).toContain("readOnly");
  });

  it("le jour même reste modifiable ; la limite est le jour de Paris fourni", () => {
    expect(rendre({ entree: { ...base, jour: AUJOURDHUI } })).toContain('type="submit"');
    expect(rendre({ entree: { ...base, jour: AUJOURDHUI }, aujourdhui: DEMAIN })).not.toContain('type="submit"');
  });

  it("TikTok : aucun premier commentaire, et les réponses restent à la main", () => {
    const h = rendre({ entree: { ...base, cle: "creneau:c1|tiktok", reseau: "tiktok", premierCommentaire: undefined } });
    expect(zone(h, "premierCommentaire")).toBe("");
    expect(lisible(h)).toContain("Premier commentaire : aucun sur TikTok.");
    expect(lisible(h)).toContain("Réponses aux commentaires : toujours à la main sur TikTok.");
  });

  it("LinkedIn et Facebook : « Enregistré dans le calendrier. » sans promesse d'envoi ; Instagram : à poser à la main", () => {
    expect(lisible(rendre())).toContain("Enregistré dans le calendrier.");
    expect(lisible(rendre())).toContain("Réponses aux commentaires : toujours à la main sur LinkedIn.");
    const fb = lisible(rendre({ entree: { ...base, reseau: "facebook" } }));
    expect(fb).toContain("Enregistré dans le calendrier.");
    expect(fb).not.toContain("Réponses aux commentaires");
    const ig = lisible(rendre({ entree: { ...base, reseau: "instagram" } }));
    expect(ig).toContain("À poser à la main sur Instagram, juste après la publication.");
    expect(ig).not.toContain("Enregistré dans le calendrier.");
  });

  it("texte vide : la fiche dit ce qui manque ; un message fourni et une erreur s'affichent", () => {
    expect(lisible(rendre({ entree: { ...base, texte: "   " } }))).toContain("Il manque le texte.");
    expect(lisible(rendre())).not.toContain("Il manque le texte.");
    expect(lisible(rendre({ entree: { ...base, message: "Le réseau a refusé le fichier : format non pris en charge." } }))).toContain("Le réseau a refusé le fichier");
    const h = rendre({ erreur: "Ce texte est trop long." });
    expect(h).toMatch(/role="alert"[^>]*>[^<]*Ce texte est trop long\./);
  });

  it("programmée : « envoi éteint » par défaut, « Partira seule » seulement si l'envoi est allumé", () => {
    const e = { ...base, etat: "programme" };
    expect(lisible(rendre({ entree: e }))).toContain("Programmé, envoi éteint");
    expect(lisible(rendre({ entree: e }))).not.toContain("Partira seule");
    expect(lisible(rendre({ entree: e, envoiAllume: true }))).toContain("Partira seule jeudi 12 novembre à 09:00.");
  });

  it("volet ou feuille : la présentation se choisit, et se voit dans la page", () => {
    expect(rendre()).toContain('data-presentation="volet"');
    expect(rendre({ presentation: "feuille" })).toContain('data-presentation="feuille"');
  });

  it("navigation et fermeture : en liens ou en gestes, absentes si rien n'est fourni", () => {
    const sans = rendre();
    expect(sans).not.toContain("Précédente");
    expect(sans).not.toContain("Fermer");
    const liens = rendre({ lienFermer: "/calendrier", lienPrecedente: "/calendrier?fiche=a", lienSuivante: "/calendrier?fiche=b" });
    expect(liens).toMatch(/<a[^>]*href="\/calendrier\?fiche=a"[^>]*>.*Précédente/);
    expect(liens).toMatch(/<a[^>]*href="\/calendrier\?fiche=b"[^>]*>.*Suivante/);
    expect(liens).toMatch(/<a[^>]*href="\/calendrier"[^>]*>.*Fermer/);
    const gestes = rendre({ onFermer: () => {}, onPrecedente: () => {}, onSuivante: () => {} });
    expect(gestes.match(/<button[^>]*type="button"/g)?.length).toBe(3);
  });

  it("emplacements pour les fiches suivantes : visuel, origine de la date, autres actions", () => {
    const h = rendre({ visuel: createElement("p", null, "Aperçu fictif"), sousDate: createElement("p", null, "choisie par vous"), children: createElement("button", { type: "button" }, "Dupliquer") });
    expect(h).toContain("Aperçu fictif");
    expect(h).toContain("choisie par vous");
    expect(h).toContain("Dupliquer");
    // Verrouillée, la fiche garde ces emplacements (« Voir sur le réseau », « Dupliquer »).
    expect(rendre({ entree: { ...base, etat: "publie" }, children: createElement("a", { href: "#" }, "Voir sur le réseau") })).toContain("Voir sur le réseau");
  });

  it("les autres actions sont DANS le formulaire quand la fiche se modifie : jamais de <form> à eux, des boutons en type=\"button\" ou en formAction", () => {
    const h = rendre({ children: createElement("button", { type: "button" }, "Dupliquer") });
    const formulaire = /<form[\s\S]*<\/form>/.exec(h)?.[0] ?? "";
    expect(formulaire).toContain("Dupliquer");
    expect(formulaire.match(/<form/g)).toHaveLength(1);
    // Verrouillée, la fiche n'a plus de formulaire : les emplacements restent, sans <form>.
    const verrouillee = rendre({ entree: { ...base, etat: "publie" }, children: createElement("button", { type: "button" }, "Dupliquer") });
    expect(verrouillee).not.toContain("<form");
    expect(verrouillee).toContain("Dupliquer");
  });

  it("le libellé du bouton principal se fournit de l'extérieur ; vide, il n'y a pas de bouton", () => {
    expect(rendre({ boutonPrincipal: "Compléter le texte" })).toMatch(/type="submit"[^>]*>.*Compléter le texte/);
    expect(rendre({ boutonPrincipal: null })).not.toContain('type="submit"');
  });

  it("réseau, type, heure ou état illisibles : la fiche ne plante pas et ne montre rien de technique", () => {
    const h = rendre({ entree: { ...base, reseau: "minitel" as never, type: "hologramme" as never, heure: "25:99", etat: "mystere", jour: "x" } });
    const t = lisible(h);
    expect(t).toContain("État à vérifier");
    expect(t).not.toMatch(/undefined|null|NaN|Invalid/);
    expect(h).not.toContain('type="submit"');
  });

  it("aucun libellé interdit : ni terme technique, ni tutoiement, ni temps universel, ni montant", () => {
    const etats = ["brouillon", "a_valider", "programme", "publie", "a_corriger", "idee", "mystere"];
    const reseaux = ["linkedin", "instagram", "facebook", "tiktok"] as const;
    for (const etat of etats) for (const reseau of reseaux) for (const envoiAllume of [false, true]) {
      const t = lisible(rendre({ entree: { ...base, etat, reseau }, envoiAllume }));
      expect([etat, reseau, /undefined|null|NaN|\bUTC\b|a_valider|a_corriger|echec|erreur|€|\btu\b|\bton\b|\btes\b/i.exec(t)?.[0] ?? null]).toEqual([etat, reseau, null]);
    }
  });
});
