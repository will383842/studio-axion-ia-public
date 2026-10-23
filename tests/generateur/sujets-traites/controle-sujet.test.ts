/**
 * LOT L5 · SUJET DÉJÀ TRAITÉ DANS LA CHAÎNE CENTRALE (générateurs `avocat` et `facecam`). Le contrôle joue dans
 * `creerSujet`, SEULEMENT pour un nouveau sujet, AVANT toute création et toute dépense. Dépôts en mémoire, aucun appel
 * réseau, rien de payé. Cas réel de la prod : « Le diagnostic fuite » écrit plusieurs fois.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { preparerMotDePasse } from "../../helpers/g1a";
import { SUJETS_BANC } from "../banc/registre-banc-g4";
import type { ReseauDeclinaison } from "@/domaine/types";
import {
  boutonPrincipalActif,
  confirmationRefaire,
  ideeDeLaSuggestion,
  peutLancer,
  phraseDuRefus,
  refusDeLaReponse,
  refusEncoreValable,
} from "@/components/generateur/sujet-deja-traite";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Petite banque de l'Usine : jamais d'import à froid du fichier de 2,8 Mo dans ces tests.
vi.mock("@/donnees/bases-usine", () => {
  const ligne = (code: string, titre: string) => ({ code, titre, cible: "m1", etat: "valide", probleme: "", ceQueCaChange: "", accroche: "", sujet: "" });
  return { metiers: () => [{ code: "m1" }], casUsage: () => [ligne("c1", "Trier les CV reçus"), ligne("c2", "Compte rendu de visio"), ligne("c3", "Facturer les formateurs"), ligne("c4", "Agenda des rendez-vous")] };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const bg = await import("@/services/boucle-generation");
const { ErreurSujetDejaTraite, confirmationPropre } = await import("@/services/sujet-central-controle");
const { ecrireParametre, ErreurStudio } = await import("@/services/_commun");
const { ecrireSujetDeLUsine } = await import("@/services/usine-sujet");
const { sujetsDejaTraites } = await import("@/services/generateur-ecran");
const actions = await import("@/app/(studio)/ecrire/sujets/actions");

const MDP = "chaine-centrale-sujets-traites";
const IDEE = "Le diagnostic fuite";
const RESEAUX: ReseauDeclinaison[] = ["tiktok"];
type Brief = Parameters<typeof gen.creerSujet>[0];
const brief = (idee = IDEE, formatId = "avocat", extra: Partial<Brief> = {}): Brief => ({ idee, reseaux: RESEAUX, formatId, ...extra });

const nombres = async () => ({
  sujets: await depots().scriptsMaitres.compter(),
  matieres: await depots().matieres.compter(),
  depenses: await depots().depenses.compter(),
  travaux: await depots().travaux.compter(),
});
/** Un sujet déjà traité = un sujet central numéroté. */
async function sujetTraite(idee = IDEE, formatId = "avocat", extra: Partial<Brief> = {}) {
  const m = await gen.creerSujet(brief(idee, formatId, extra));
  await gen.attribuerNumero(m.id, { episode: false });
  return m;
}
async function refus(b: Brief, options: Parameters<typeof gen.creerSujet>[1] = {}) {
  try {
    await gen.creerSujet(b, options);
  } catch (e) {
    if (e instanceof ErreurSujetDejaTraite) return e.refus;
    throw e;
  }
  throw new Error("Un refus était attendu.");
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  bg.suspendreBoucleGeneration(true);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.restoreAllMocks());

describe("nouveau sujet déjà traité : refus avant tout", () => {
  it("« Le diagnostic fuite » est refusé sans jeton : rien créé ni payé, statut structuré avec lien, 3 suggestions au plus, jeton", async () => {
    const premier = await sujetTraite();
    const avant = await nombres();
    const r = await refus(brief());
    expect(r.statut).toBe("sujet-deja-traite");
    expect(r.precedents.map((p) => p.sujetId)).toEqual([premier.id]);
    expect(r.precedents[0]!.lien).toBe(`/scripts/${premier.id}`);
    expect(r.jeton).toMatch(/^[0-9a-f]{16}$/);
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect(["identique", "proche"]).toContain(r.niveau);
    expect(await nombres()).toEqual(avant);
  });

  it("le refus est une erreur du studio (message clair) pour tout appelant qui ne sait pas la lire", async () => {
    await sujetTraite();
    await expect(gen.creerSujet(brief())).rejects.toBeInstanceOf(ErreurStudio);
    await expect(gen.creerSujet(brief())).rejects.toThrow(/déjà traité.*Rien n'a été écrit ni payé/);
  });

  it("le refus est journalisé", async () => {
    await sujetTraite();
    await refus(brief());
    const evenements = await depots().evenements.lister();
    expect(evenements.some((e) => e.type === "sujet" && e.message.includes("déjà traité"))).toBe(true);
  });

  it("accepté avec la confirmation du refus (même texte, même jeton)", async () => {
    await sujetTraite();
    const r = await refus(brief());
    const m = await gen.creerSujet(brief(IDEE, "avocat", { confirmationSujet: { choix: "refaire", jeton: r.jeton } }));
    expect(m.brief.idee).toBe(IDEE);
    expect(await depots().scriptsMaitres.compter()).toBe(2);
  });

  it("jeton périmé (un autre sujet a été traité entre-temps) : refusé de nouveau, `jetonPerime`", async () => {
    await sujetTraite();
    const r = await refus(brief());
    // Une autre version du même thème apparaît (créée en reprise, donc sans contrôle) : les précédents changent.
    const autre = await gen.creerSujet(brief("Le diagnostic fuite d'eau"), { reprise: true });
    await gen.attribuerNumero(autre.id, { episode: false });
    const avant = await nombres();
    const encore = await refus(brief(IDEE, "avocat", { confirmationSujet: { choix: "refaire", jeton: r.jeton } }));
    expect(encore.jetonPerime).toBe(true);
    expect(encore.jeton).not.toBe(r.jeton);
    expect(await nombres()).toEqual(avant);
  });

  it("un jeton qui n'est pas le sien (autre idée) ne vaut rien", async () => {
    await sujetTraite();
    await sujetTraite("Relancer les devis non signés");
    const r = await refus(brief("Relancer les devis non signés"));
    const autre = await refus(brief(IDEE, "avocat", { confirmationSujet: { choix: "refaire", jeton: r.jeton } }));
    expect(autre.jetonPerime).toBe(true);
  });

  it("la face caméra (`facecam`) est contrôlée de la même façon, dans SON générateur", async () => {
    await sujetTraite(IDEE, "facecam");
    expect((await refus(brief(IDEE, "facecam"))).statut).toBe("sujet-deja-traite");
  });

  it("D1 : un sujet traité dans un AUTRE générateur prévient mais ne bloque pas", async () => {
    await sujetTraite(IDEE, "avocat");
    const m = await gen.creerSujet(brief(IDEE, "facecam"));
    expect(m.brief.formatId).toBe("facecam");
  });

  it("un brouillon sans numéro (jamais lancé) ne compte pas", async () => {
    await gen.creerSujet(brief());
    await expect(gen.creerSujet(brief())).resolves.toMatchObject({ brief: { idee: IDEE } });
  });
});

describe("ce qui n'est PAS un nouveau sujet", () => {
  it("nouvelle version d'un sujet existant : libre", async () => {
    const premier = await sujetTraite();
    const v2 = await gen.creerSujet(brief(), { versionDeSujetId: premier.id });
    expect(v2.id).not.toBe(premier.id);
  });

  it("reprise / retouche : libre", async () => {
    await sujetTraite();
    await expect(gen.creerSujet(brief(), { reprise: true })).resolves.toBeTruthy();
  });

  it("un sujet de démonstration n'est pas contrôlé", async () => {
    await sujetTraite();
    await expect(gen.creerSujet(brief(IDEE, "avocat", { estDemo: true }))).resolves.toBeTruthy();
  });

  it("un sujet vraiment différent passe", async () => {
    await sujetTraite();
    await expect(gen.creerSujet(brief("Pourquoi vos factures arrivent en retard"))).resolves.toBeTruthy();
  });
});

describe("réglage `sujets.garde`", () => {
  it("éteint : rien n'est contrôlé, comportement inchangé", async () => {
    await sujetTraite();
    await ecrireParametre("sujets.garde", "eteint");
    const avant = await depots().scriptsMaitres.compter();
    await expect(gen.creerSujet(brief())).resolves.toBeTruthy();
    expect(await depots().scriptsMaitres.compter()).toBe(avant + 1);
    expect((await depots().evenements.lister()).some((e) => e.message.includes("déjà traité"))).toBe(false);
  });

  it("avertissement : ne bloque pas", async () => {
    await sujetTraite();
    await ecrireParametre("sujets.garde", "avertissement");
    await expect(gen.creerSujet(brief())).resolves.toBeTruthy();
  });
});

describe("sujet venu de l'Usine : clé `usine:<cas d'usage>`", () => {
  const origine = (cas: string) => ({ signature: `sig-${cas}`, parts: { cas_usage: cas }, typeContenu: "video" as const });
  const idee = (cas: string, casUsage: string) => ({ signature: `sig-${cas}`, parts: { cas_usage: cas }, metier: "Plombier", taille: "TPE", douleur: "Des fuites partout", casUsage });

  it("même cas d'usage, autres mots : identique (clé exacte) ; refus AVANT d'écrire la moindre matière", async () => {
    await sujetTraite("Un texte sans rapport avec la suite", "avocat", { origineUsine: origine("cas-fuite") });
    const avant = await nombres();
    const r = await refus(brief("Zéro ressemblance de mots ici", "avocat", { origineUsine: origine("cas-fuite") }));
    expect(r.niveau).toBe("identique");
    // Par l'Usine : le refus est une erreur claire, aucune matière n'est écrite, rien n'est créé.
    await expect(ecrireSujetDeLUsine(idee("cas-fuite", "Zéro ressemblance"), { reseaux: ["tiktok"], typeContenu: "video" })).rejects.toBeInstanceOf(ErreurSujetDejaTraite);
    expect(await nombres()).toEqual(avant);
  });

  it("appelant automatique (Usine) : aucune confirmation possible, il ne passe jamais outre ; un autre cas d'usage passe", async () => {
    await sujetTraite("Quelque chose", "avocat", { origineUsine: origine("cas-fuite") });
    const avant = await nombres();
    await expect(ecrireSujetDeLUsine(idee("cas-fuite", "Même cas"), { reseaux: ["tiktok"], typeContenu: "video" })).rejects.toThrow(/déjà traité/);
    expect(await nombres()).toEqual(avant);
    const ok = await ecrireSujetDeLUsine(idee("cas-autre", "Un tout autre cas"), { reseaux: ["tiktok"], typeContenu: "video" });
    expect(ok.id).toBeTruthy();
  });
});

describe("Usine : deux cas d'usage distincts sur la même douleur ne sont pas « proches »", () => {
  const origine = (cas: string) => ({ signature: `sig-${cas}`, parts: { cas_usage: cas }, typeContenu: "video" as const });
  const idee = (cas: string) => ({ signature: `sig-${cas}`, parts: { cas_usage: cas }, metier: "Plombier", taille: "TPE", douleur: "Des fuites partout", casUsage: "Un diagnostic avant chaque devis" });

  it("cas-a numéroté ; cas-b (même texte) libre ; cas-a de nouveau : refusé et sorti de la réserve", async () => {
    await sujetTraite("Des fuites partout Un diagnostic avant chaque devis", "avocat", { origineUsine: origine("cas-a") });
    const libre = await ecrireSujetDeLUsine(idee("cas-b"), { reseaux: ["tiktok"], typeContenu: "video" });
    expect(libre.id).toBeTruthy();
    const base = {
      id: "ij-1", idee: "x", textes: {}, parts: { cas_usage: "cas-a" }, notes: { douleur: 1, cible: 1, angleDifferent: 1, potentiel: 1 }, total: 4, verdict: "garder" as const, raison: "", angle: "",
      creeLe: "2026-10-19T00:00:00.000Z", modifieLe: "2026-10-19T00:00:00.000Z",
    };
    await depots().ideesJugees.enregistrer({ ...base, signature: "sig-cas-a" } as never);
    const avant = await nombres();
    await expect(ecrireSujetDeLUsine(idee("cas-a"), { reseaux: ["tiktok"], typeContenu: "video" })).rejects.toBeInstanceOf(ErreurSujetDejaTraite);
    expect(await nombres()).toEqual(avant);
    expect((await depots().ideesJugees.obtenir("ij-1"))?.utiliseeLe).toBeTruthy();
  });
});

describe("deux demandes simultanées sur la même idée", () => {
  it("un seul sujet est créé et numéroté, l'autre est refusé (et son brouillon vide retiré)", async () => {
    for (const m of SUJETS_BANC.flatMap((x) => x.matieres)) await depots().matieres.enregistrer(m);
    for (const p of SUJETS_BANC.flatMap((x) => x.preuves)) await depots().preuves.enregistrer(p);
    const sujet = SUJETS_BANC[0]!;
    const demande = () => actions.creerSujetAction({ idee: sujet.idee, reseaux: sujet.reseaux, formatId: "avocat", pilier: sujet.pilier.id, mode: "teleprompteur" });
    const [a, b] = await Promise.all([demande(), demande()]);
    const refuses = [a, b].filter((r) => r.ok && "statut" in r.donnees);
    const partis = [a, b].filter((r) => r.ok && "id" in r.donnees);
    expect(partis).toHaveLength(1);
    expect(refuses).toHaveLength(1);
    expect(await depots().scriptsMaitres.compter()).toBe(1);
    expect(await depots().scriptsMaitres.compter((m) => m.numero !== undefined)).toBe(1);
  });
});

describe("action de l'écran", () => {
  it("`origineUsine` venu du navigateur est ignoré : le sujet n'est pas rangé sous une clé forgée", async () => {
    await sujetTraite();
    const a = await actions.creerSujetAction(brief(IDEE, "avocat", { origineUsine: { signature: "x", parts: { cas_usage: "cas-forge" }, typeContenu: "video" } }));
    expect(a.ok && "statut" in a.donnees).toBe(true);
    const libre = await actions.creerSujetAction(brief("Un sujet jamais traité avant", "avocat", { origineUsine: { signature: "x", parts: { cas_usage: "cas-forge" }, typeContenu: "video" } }));
    expect(libre.ok && "id" in libre.donnees).toBe(true);
    expect((await depots().scriptsMaitres.lister()).some((m) => m.origineUsine)).toBe(false);
  });

  it("`estDemo` venu du navigateur ne saute pas le contrôle", async () => {
    await sujetTraite();
    const a = await actions.creerSujetAction(brief(IDEE, "avocat", { estDemo: true }));
    expect(a.ok && "statut" in a.donnees).toBe(true);
  });

  it("renvoie le statut structuré, ne crée rien ; avec la confirmation renvoyée, le sujet part ; un choix inventé est ignoré", async () => {
    await sujetTraite();
    const avant = await nombres();
    const a = await actions.creerSujetAction(brief());
    expect(a.ok).toBe(true);
    if (!a.ok || !("statut" in a.donnees)) throw new Error(JSON.stringify(a));
    expect(a.donnees.statut).toBe("sujet-deja-traite");
    expect(await nombres()).toEqual(avant);
    // Confirmation non sûre : un choix inconnu est ignoré, le refus reste.
    const faux = await actions.creerSujetAction(brief(IDEE, "avocat", { confirmationSujet: { choix: "n-importe-quoi" as never, jeton: a.donnees.jeton } }));
    expect(faux.ok && "statut" in faux.donnees).toBe(true);
    expect(await depots().scriptsMaitres.compter()).toBe(avant.sujets);
    const bon = await actions.creerSujetAction(brief(IDEE, "avocat", { confirmationSujet: { choix: "refaire", jeton: a.donnees.jeton } }));
    expect(bon.ok && "id" in bon.donnees).toBe(true);
    expect(await depots().scriptsMaitres.compter()).toBe(avant.sujets + 1);
  });

  it("un sujet libre part sans rien demander", async () => {
    const a = await actions.creerSujetAction(brief("Un sujet jamais traité avant"));
    expect(a.ok && "id" in a.donnees).toBe(true);
  });
});

describe("service commun de l'avertissement (`sujetsDejaTraites`)", () => {
  it("garde la forme {id, numero, le, idee}", async () => {
    const premier = await sujetTraite();
    const liste = await sujetsDejaTraites(IDEE);
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ id: premier.id, numero: expect.any(Number), idee: IDEE });
    expect(typeof liste[0]!.le).toBe("string");
  });

  it("réglage éteint : l'ancienne lecture, inchangée", async () => {
    const premier = await sujetTraite();
    await ecrireParametre("sujets.garde", "eteint");
    const liste = await sujetsDejaTraites(IDEE);
    expect(liste.map((x) => x.id)).toEqual([premier.id]);
  });

  it("avec `formatId` : seulement le générateur choisi", async () => {
    await sujetTraite(IDEE, "avocat");
    expect(await sujetsDejaTraites(IDEE, "facecam")).toEqual([]);
    expect(await sujetsDejaTraites(IDEE, "avocat")).toHaveLength(1);
  });

  it("rien pour une idée sans rapport", async () => {
    await sujetTraite();
    expect(await sujetsDejaTraites("Comment choisir un logiciel de paie")).toEqual([]);
  });
});

describe("confirmation reçue (donnée non sûre)", () => {
  it("seuls un choix connu et un jeton sont gardés", () => {
    expect(confirmationPropre({ choix: "refaire", jeton: "abc", autre: 1 })).toEqual({ choix: "refaire", jeton: "abc" });
    expect(confirmationPropre({ choix: "x", jeton: "abc" })).toBeUndefined();
    expect(confirmationPropre({ choix: "nouvel-angle", jeton: "abc" })).toBeUndefined();
    expect(confirmationPropre({ choix: "refaire" })).toBeUndefined();
    expect(confirmationPropre(null)).toBeUndefined();
  });
});

describe("écran : règles d'ordre en fonctions pures", () => {
  const refusServeur = { statut: "sujet-deja-traite" as const, niveau: "identique" as const, precedents: [], suggestions: [{ titre: "Trier les CV reçus", code: "c1", source: "usine" as const }], jeton: "0123456789abcdef", phrase: "Ce sujet est déjà traité." };

  it("double clic : un seul départ tant que le verrou est posé ou qu'une écriture est en cours", () => {
    expect(peutLancer(true, false, false)).toBe(true);
    expect(peutLancer(true, true, false)).toBe(false);
    expect(peutLancer(true, false, true)).toBe(false);
    expect(peutLancer(false, false, false)).toBe(false);
  });

  it("le refus tombe dès que l'idée ou le format change ; il tient pour la même idée", () => {
    const a = refusDeLaReponse(refusServeur, "  Le diagnostic fuite ", "avocat");
    expect(refusEncoreValable(a, "Le diagnostic fuite", "avocat")).toBe(a);
    expect(refusEncoreValable(a, "Le diagnostic fuite 2", "avocat")).toBeUndefined();
    expect(refusEncoreValable(a, "Le diagnostic fuite", "facecam")).toBeUndefined();
  });

  it("un succès n'affiche pas de refus ; le bouton principal attend le choix tant qu'un refus est affiché", () => {
    expect(refusDeLaReponse({ id: "suj-1", ecrit: true }, IDEE, "avocat")).toBeUndefined();
    const a = refusDeLaReponse(refusServeur, IDEE, "avocat");
    expect(boutonPrincipalActif(true, a)).toBe(false);
    expect(boutonPrincipalActif(true, undefined)).toBe(true);
    expect(boutonPrincipalActif(false, undefined)).toBe(false);
  });

  it("« Refaire quand même » renvoie le jeton reçu, jamais « nouvel angle » ; « autre sujet » remplit le sujet", () => {
    expect(confirmationRefaire(refusDeLaReponse(refusServeur, IDEE, "avocat"))).toEqual({ choix: "refaire", jeton: "0123456789abcdef" });
    expect(confirmationRefaire(undefined)).toBeUndefined();
    expect(ideeDeLaSuggestion("  Trier les CV reçus ")).toBe("Trier les CV reçus");
  });

  it("jeton périmé : la phrase le dit", () => {
    expect(phraseDuRefus({ ...refusServeur, jetonPerime: true })).toMatch(/choisissez de nouveau/);
    expect(phraseDuRefus(refusServeur)).toBe("Ce sujet est déjà traité.");
  });
});
