/**
 * CAL-23 (écrite EN AVANCE, avant RC-08a) : déplacer ou modifier une publication déjà programmée.
 * AUCUN appel réel : le diffuseur est un FAUX qui enregistre ses appels. Interrupteurs d'essai uniquement ; rien n'est allumé.
 * Règles : « annuler puis recréer » avec une NOUVELLE clé ; la date ne change qu'après un retrait confirmé ; rien n'est supprimé.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { FicheEntree, PHRASE_PROGRAMMEE_MODIFIABLE } from "@/components/calendrier/FicheEntree";
import type { LotEcritures } from "@/domaine/depots";
import { cleEnvoi, type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { instantParis } from "@/lib/horloge-paris";
import { occupeBuffer } from "@/domaine/buffer";
import * as serviceModule from "@/services/deplacer-programmation";
import { deplacerProgrammationAction, modifierTexteProgrammeAction, modifierTexteProgrammeDepuisFormulaire } from "../../src/app/(studio)/calendrier/actions/deplacer";
import { CODES_DEPLACEMENT, deplacerProgrammation, modifierTexteProgramme, PHRASES_DEPLACEMENT, portRetraitDepuisClient, type DepsDeplacement, type IssueRetraitDiffuseur } from "@/services/deplacer-programmation";

const revalide = vi.hoisted(() => ({ appels: [] as string[] }));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => void revalide.appels.push(p), revalidateTag: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));
// Les deux câblages serveur passent par le vrai service ; un test peut leur imposer une réponse pour vérifier ce que l'action en fait.
vi.mock("@/services/deplacer-programmation", async (orig) => {
  const m = await orig<typeof import("@/services/deplacer-programmation")>();
  return { ...m, deplacerProgrammationServeur: vi.fn(m.deplacerProgrammationServeur), modifierTexteProgrammeServeur: vi.fn(m.modifierTexteProgrammeServeur) };
});

const MAINTENANT = new Date("2026-12-10T10:00:00.000Z");
const DEMAIN = "2026-12-11T08:30:00.000Z";
const CLE = "a".repeat(64);

const envoi = (sur: Partial<EnvoiPlanifie> = {}): EnvoiPlanifie => ({
  id: "envoi:vis_1:linkedin:v0", cle: "envoi:vis_1:linkedin:v0", videoId: "vis_1", nature: "visuel", creneauId: "cre_1", cleDiffuseur: CLE,
  reseau: "linkedin", versionCreneau: 0, jour: "2026-12-11", heure: "09:30", statut: "programme", valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur",
  creeLe: "2026-12-01T00:00:00Z", modifieLe: "2026-12-01T00:00:00Z", ...sur,
});

function monde(opts: { creneau?: Record<string, unknown>; envois?: EnvoiPlanifie[]; issues?: IssueRetraitDiffuseur[]; sansDiffuseur?: boolean; reglages?: boolean; ecritureEchoue?: number; marques?: Record<string, string> } = {}) {
  const creneaux = new Map<string, Record<string, unknown>>([["cre_1", {
    id: "cre_1", jourVise: "2026-12-11", heuresParReseau: { linkedin: DEMAIN }, compteCible: "c1", visuelId: "vis_1", statut: "programme", decalages: 0,
    valideeLe: "2026-12-01T00:00:00Z", valideePar: "fondateur", textes: { linkedin: { texte: "Le texte", premierCommentaire: "Et vous ?" } }, ...opts.creneau,
  }]]);
  const envois = new Map((opts.envois ?? [envoi()]).map((e) => [e.id, e]));
  const visuels = new Map<string, Record<string, unknown>>([["vis_1", { id: "vis_1", statut: "programme", titre: "Carrousel", modifieLe: "x" }]]);
  const marques = new Map<string, string>(Object.entries(opts.marques ?? {}));
  const ordre: string[] = [];
  const retraits: string[] = [];
  const notifs: { cle: string; motif: string; raison: string }[] = [];
  const supprime: unknown[] = [];
  const journal: { id: string; creneauId: string; ancienJour: string; nouveauJour: string }[] = [];
  const pubs = new Map<string, Record<string, unknown>>([["pub_1", { id: "pub_1", cleEnvoi: CLE, via: "zernio", statut: "programmee", etatEnvoi: "confirme", visuelId: "vis_1", reseau: "linkedin" }]]);
  const issues = [...(opts.issues ?? [])];
  let ecritures = 0;
  const ouvert = opts.reglages ?? true;
  const deps: DepsDeplacement = {
    diffuseur: opts.sansDiffuseur ? null : { retirer: async (e) => { ordre.push("retrait"); retraits.push(e.cle); return issues.shift() ?? "retire"; } },
    reglagesOuverts: async () => ouvert,
    creneau: async (id) => (creneaux.get(id) as never) ?? null,
    envois: async (id) => [...envois.values()].filter((e) => e.creneauId === id),
    visuel: async (id) => (visuels.get(id) as never) ?? null,
    appliquer: async (lot: LotEcritures) => {
      ordre.push("ecriture");
      supprime.push(...lot.supprimer);
      if (opts.ecritureEchoue && ++ecritures <= opts.ecritureEchoue) throw new Error("écriture impossible");
      for (const { collection, entite } of lot.enregistrer) {
        if (collection === "creneauxEditoriaux") creneaux.set(entite.id, entite as never);
        if (collection === "envoisPlanifies") envois.set(entite.id, entite as EnvoiPlanifie);
        if (collection === "visuels") visuels.set(entite.id, entite as never);
        if (collection === "publications") pubs.set(entite.id, entite as never);
        if (collection === "journalDecalages") journal.push(entite as never);
      }
    },
    // Même règle que la vraie garde L5-02d (garde-creneau-diffuseur.ts) : un statut « programmé » OU une marque promotion « programme » compte, annulé ou non.
    niveau: async () => {
      const tous = [...envois.values()];
      if (tous.some((e) => marques.get(`promotion:${e.cle}`) === "en-cours" || (e.statut !== "annule" && marques.get(`creation:${e.cle}`) === "en-cours"))) return { niveau: "en-cours" as const };
      if (tous.some((e) => e.statut !== "annule" && marques.get(`a-verifier:${e.cle}`) === "a-verifier")) return { niveau: "a-verifier" as const };
      if (tous.some((e) => ["programme", "confirme", "a-envoyer"].includes(e.statut) || marques.get(`promotion:${e.cle}`) === "programme")) return { niveau: "programme" as const };
      if (tous.some((e) => e.statut !== "annule" && ["brouillon", "valide"].includes(e.statut) && typeof e.cleDiffuseur === "string")) return { niveau: "brouillon" as const };
      return { niveau: "libre" as const };
    },
    publicationsDeCles: async (cles) => [...pubs.values()].filter((x) => cles.includes(String(x.cleEnvoi))) as never,
    etats: { lire: async (c) => marques.get(c), noter: async (c, v) => void marques.set(c, v) },
    notifier: async (n) => void notifs.push(n),
    maintenant: () => MAINTENANT,
  };
  return { deps, creneaux, envois, visuels, marques, pubs, journal, ordre, retraits, notifs, supprime, creneau: () => creneaux.get("cre_1") as Record<string, never> & { heuresParReseau: Record<string, string>; textes: Record<string, { texte: string }>; decalages: number; statut: string; valideeLe?: string; retireLe?: string; jourVise: string } };
}

beforeEach(() => { revalide.appels.length = 0; });
const demande = (sur: Record<string, unknown> = {}) => ({ creneauId: "cre_1", nouveauJour: "2026-12-14", cle: "form-1", ...sur });
const vivants = (m: ReturnType<typeof monde>) => [...m.envois.values()].filter((e) => e.statut !== "annule");

describe("CAL-23 · déplacer : annuler puis recréer, une seule fois, à la nouvelle date", () => {
  it("retire chez le diffuseur AVANT toute écriture, puis recrée à la nouvelle date avec une NOUVELLE clé", async () => {
    const m = monde();
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(m.retraits).toEqual(["envoi:vis_1:linkedin:v0"]);
    expect(m.ordre[0]).toBe("retrait");
    // La recréation est faite par le tour d'envoi du créneau (clé = créneau + version) : le service pose la version suivante, sans doublon.
    expect(vivants(m)).toHaveLength(0);
    expect(r.ok && r.nouvellesCles).toEqual(["envoi:vis_1:linkedin:v1"]);
    expect(cleEnvoi("vis_1", "linkedin", m.creneau().decalages)).toBe("envoi:vis_1:linkedin:v1");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("annule");
    expect(m.creneau().heuresParReseau.linkedin).toBe(instantParis("2026-12-14", "09:30"));
    expect(m.creneau().jourVise).toBe("2026-12-14");
    expect(m.creneau().decalages).toBe(1);
    expect(m.creneau().statut).toBe("valide");
    expect(m.supprime).toEqual([]);
  });

  it("écrit UNE ligne du journal des décalages (ancien et nouveau jour), comme L4-06", async () => {
    const m = monde();
    await deplacerProgrammation(m.deps, demande());
    expect(m.journal).toHaveLength(1);
    expect(m.journal[0]).toMatchObject({ id: "decalage:cre_1:form-1#1", creneauId: "cre_1", ancienJour: "2026-12-11", nouveauJour: "2026-12-14" });
  });

  it("la publication locale du post retiré n'occupe plus le réseau (sinon le tour exclurait la nouvelle version) ; rien n'est supprimé", async () => {
    const m = monde();
    expect(occupeBuffer(m.pubs.get("pub_1") as never)).toBe(true);
    await deplacerProgrammation(m.deps, demande());
    expect(occupeBuffer(m.pubs.get("pub_1") as never)).toBe(false);
    expect(m.pubs.size).toBe(1);
  });

  it("un créneau déjà décalé par L4-06 (aRenvoyer) repart : le drapeau est retiré", async () => {
    const m = monde({ creneau: { aRenvoyer: true } });
    await deplacerProgrammation(m.deps, demande());
    expect(m.creneau().aRenvoyer).toBeUndefined();
  });

  it("un rejeu du même formulaire ne double rien : aucun second retrait, aucune seconde ligne de journal", async () => {
    const m = monde();
    await deplacerProgrammation(m.deps, demande());
    const encore = await deplacerProgrammation(m.deps, demande());
    expect(encore.ok && encore.etat).toBe("deja-fait");
    expect(m.retraits).toHaveLength(1);
    expect(m.journal).toHaveLength(1);
    expect(vivants(m)).toHaveLength(0);
    expect(m.envois.size).toBe(1);
    expect(m.creneau().decalages).toBe(1);
  });

  it("même jour, mêmes heures : « inchangé », aucun retrait ni écriture pour rien", async () => {
    const m = monde();
    const r = await deplacerProgrammation(m.deps, demande({ nouveauJour: "2026-12-11" }));
    expect(r.ok && r.etat).toBe("inchange");
    expect(m.ordre).toEqual([]);
  });

  it("après le déplacement, la VRAIE règle de garde voit une publication libre (marque « retire »), pas « programmé » à l'ancienne date", async () => {
    const m = monde({ marques: { "promotion:envoi:vis_1:linkedin:v0": "programme" } });
    expect((await m.deps.niveau("cre_1")).niveau).toBe("programme");
    await deplacerProgrammation(m.deps, demande());
    expect(m.marques.get("promotion:envoi:vis_1:linkedin:v0")).toBe("libre");
    expect((await m.deps.niveau("cre_1")).niveau).toBe("libre");
  });

  it("la garde voit un post (envoi annulé gardant sa marque « programme ») que les envois vivants ne montrent pas : refus, rien n'est changé", async () => {
    for (const sansDiffuseur of [true, false]) {
      const m = monde({ envois: [envoi({ statut: "annule", cleDiffuseur: undefined })], creneau: { statut: "valide" }, marques: { "promotion:envoi:vis_1:linkedin:v0": "programme" }, sansDiffuseur });
      expect(await deplacerProgrammation(m.deps, demande())).toEqual({ ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.dejaAVerifier });
      expect(m.ordre).toEqual([]);
      expect(m.creneau().jourVise).toBe("2026-12-11");
    }
  });

  it("un appliquer en échec ne laisse aucune ligne de journal ; un rejeu ne l'écrit pas deux fois", async () => {
    const m = monde({ ecritureEchoue: 1 });
    await deplacerProgrammation(m.deps, demande());
    expect(m.journal).toEqual([]);
    const n = monde();
    await deplacerProgrammation(n.deps, demande());
    await deplacerProgrammation(n.deps, demande());
    expect(n.journal).toHaveLength(1);
  });

  it("A, puis B, puis de nouveau A : la même clé rejouée APRÈS une autre modification n'est pas prise pour un rejeu", async () => {
    const m = monde({ envois: [] });
    const t = (texte: string, cle: string) => modifierTexteProgramme(m.deps, { creneauId: "cre_1", reseau: "linkedin", texte, premierCommentaire: "Et vous ?", auteur: "will", cle } as never);
    expect((await t("Texte B", "k1")).ok).toBe(true);
    expect((await t("Texte B", "k1")).ok && (await t("Texte B", "k1")).ok).toBe(true); // vrai rejeu : « déjà fait »
    expect(m.creneau().decalages).toBe(1);
    // Le créneau a changé de version depuis (autre modification, nouvelle validation, reprogrammation) : la clé k1 redemandée est une NOUVELLE demande.
    Object.assign(m.creneau(), { statut: "programme", valideeLe: "2026-12-02T00:00:00Z", decalages: 2 });
    m.creneau().textes.linkedin.texte = "Texte D";
    const encore = await t("Texte A", "k1");
    expect(encore.ok && encore.etat).toBe("modifie");
    expect(m.creneau().textes.linkedin.texte).toBe("Texte A");
  });

  it("deux réseaux : un retrait par envoi, une nouvelle clé par réseau", async () => {
    const f = envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: "b".repeat(64) });
    const m = monde({ envois: [envoi(), f], creneau: { heuresParReseau: { linkedin: DEMAIN, facebook: DEMAIN } } });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(m.retraits.sort()).toEqual(["envoi:vis_1:facebook:v0", "envoi:vis_1:linkedin:v0"]);
    expect(r.ok && r.nouvellesCles?.sort()).toEqual(["envoi:vis_1:facebook:v1", "envoi:vis_1:linkedin:v1"]);
    expect(m.creneau().decalages).toBe(1);
  });

  it("avant la promotion (aucun brouillon chez le diffuseur) : aucun appel, la date change, même sans port de retrait", async () => {
    const m = monde({ envois: [envoi({ cleDiffuseur: undefined, statut: "valide" })], creneau: { statut: "valide" }, sansDiffuseur: true });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(m.retraits).toEqual([]);
    expect(m.creneau().jourVise).toBe("2026-12-14");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("annule");
  });

  it.each([
    ["publie", "partie"],
    ["echec", "partie"],
    ["archive", "nonProgrammee"],
  ] as const)("un créneau « %s » ne se déplace pas : refus exact, aucun appel, aucune écriture", async (statut, phrase) => {
    const m = monde({ creneau: { statut } });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r).toEqual({ ok: false, etat: "refuse", message: PHRASES_DEPLACEMENT[phrase] });
    expect(m.ordre).toEqual([]);
  });

  it("un envoi déjà parti ou en cours d'envoi bloque tout, avec la bonne phrase", async () => {
    for (const statut of ["envoye", "a-envoyer"] as const) {
      const m = monde({ envois: [envoi({ statut })] });
      expect(await deplacerProgrammation(m.deps, demande())).toEqual({ ok: false, etat: "refuse", message: PHRASES_DEPLACEMENT.partie });
      expect(m.ordre).toEqual([]);
    }
    for (const marque of ["promotion:envoi:vis_1:linkedin:v0", "creation:envoi:vis_1:linkedin:v0"]) {
      const m = monde({ marques: { [marque]: "en-cours" } });
      expect(await deplacerProgrammation(m.deps, demande())).toEqual({ ok: false, etat: "refuse", message: PHRASES_DEPLACEMENT.enCours });
      expect(m.ordre).toEqual([]);
    }
  });

  it("garde L5-02d : une publication déjà « à vérifier » refuse avant tout appel", async () => {
    const m = monde({ marques: { "a-verifier:envoi:vis_1:linkedin:v0": "a-verifier" } });
    expect(await deplacerProgrammation(m.deps, demande())).toEqual({ ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.dejaAVerifier });
    expect(m.ordre).toEqual([]);
  });

  it("une heure déjà passée : « passee » ; un nouveau jour passé : « jourPasse » ; illisible : « jourInvalide » ; ancienne date gardée", async () => {
    const passee = monde({ creneau: { heuresParReseau: { linkedin: "2026-12-10T09:00:00.000Z" } } });
    expect(await deplacerProgrammation(passee.deps, demande())).toEqual({ ok: false, etat: "refuse", message: PHRASES_DEPLACEMENT.passee });
    expect(passee.ordre).toEqual([]);
    const attendu: Record<string, string> = { "2026-12-09": "jourPasse", "2026-12-10": "jourPasse", "2026-13-40": "jourInvalide", demain: "jourInvalide", "": "jourInvalide" };
    for (const [nouveauJour, phrase] of Object.entries(attendu)) {
      const m = monde();
      const r = await deplacerProgrammation(m.deps, demande({ nouveauJour }));
      expect(r, nouveauJour).toEqual({ ok: false, etat: "refuse", message: PHRASES_DEPLACEMENT[phrase as "jourPasse" | "jourInvalide"] });
      expect(m.ordre, nouveauJour).toEqual([]);
      expect(m.creneau().jourVise).toBe("2026-12-11");
    }
  });
});

describe("CAL-23 · le retrait échoue : l'ancienne date reste, un message le dit", () => {
  const cas = [
    ["refuse", "a-retirer-a-la-main", "aLaMain"],
    ["sans-reponse", "reste", "sansReponse"],
    ["a-verifier", "a-verifier", "aVerifier"],
  ] as const;
  it.each(cas)("retrait « %s » : état « %s », phrase exacte, créneau et envois inchangés, rien d'écrit", async (issue, etat, phrase) => {
    const m = monde({ issues: [issue] });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r).toEqual({ ok: false, etat, message: PHRASES_DEPLACEMENT[phrase] });
    expect(m.creneau().jourVise).toBe("2026-12-11");
    expect(m.creneau().statut).toBe("programme");
    expect(vivants(m).map((e) => e.cle)).toEqual(["envoi:vis_1:linkedin:v0"]);
    expect(m.ordre).toEqual(["retrait"]);
    expect(m.journal).toEqual([]);
  });

  it("réponse incertaine : marque « à vérifier » sur l'envoi, jamais un nouvel essai automatique ; refus : « à retirer à la main »", async () => {
    const a = monde({ issues: ["a-verifier"] });
    await deplacerProgrammation(a.deps, demande());
    expect(a.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
    expect(a.retraits).toHaveLength(1);
    const b = monde({ issues: ["refuse"] });
    await deplacerProgrammation(b.deps, demande());
    expect(b.marques.get("retrait:envoi:vis_1:linkedin:v0")).toBe("a-retirer-a-la-main");
  });

  it("rejeu après un échec : la même clé de formulaire peut réessayer (rien n'a été noté « fait »)", async () => {
    const m = monde({ issues: ["sans-reponse"] });
    expect((await deplacerProgrammation(m.deps, demande())).ok).toBe(false);
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok && r.etat).toBe("deplace");
    expect(m.retraits).toHaveLength(2);
    expect(m.creneau().decalages).toBe(1);
  });

  it("envoi éteint : aucun appel au diffuseur, la publication reste programmée", async () => {
    const m = monde({ reglages: false });
    expect(await deplacerProgrammation(m.deps, demande())).toEqual({ ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.eteint });
    expect(m.retraits).toEqual([]);
    expect(m.creneau().jourVise).toBe("2026-12-11");
  });

  it("les réglages sont relus JUSTE AVANT chaque retrait : fermés au second réseau, le second n'est pas appelé", async () => {
    const f = envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: "b".repeat(64) });
    const m = monde({ envois: [envoi(), f], creneau: { heuresParReseau: { linkedin: DEMAIN, facebook: DEMAIN } } });
    let lectures = 0;
    m.deps.reglagesOuverts = async () => ++lectures <= 1;
    const r = await deplacerProgrammation(m.deps, demande());
    expect(m.retraits).toEqual(["envoi:vis_1:linkedin:v0"]);
    expect(r.ok === false && r.etat).toBe("reste");
    expect(lectures).toBe(2);
  });

  it("retrait partiel (deux réseaux, le second échoue) : « Retiré : LinkedIn » ET « Reste : Facebook », le créneau reste programmé", async () => {
    const f = envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: "b".repeat(64) });
    const m = monde({ envois: [envoi(), f], issues: ["retire", "sans-reponse"], creneau: { heuresParReseau: { linkedin: DEMAIN, facebook: DEMAIN } } });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain("Retiré chez le diffuseur : LinkedIn. Reste à l'ancienne date : Facebook.");
    expect(r.ok === false && r.ecritures).toBe(true);
    expect(m.creneau().statut).toBe("programme");
    expect(m.creneau().jourVise).toBe("2026-12-11");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("annule");
    expect(m.envois.get("envoi:vis_1:facebook:v0")!.statut).toBe("programme");
  });
});

describe("CAL-23 · la recréation échoue après un retrait réussi : retour dans « À placer », jamais « Programmé »", () => {
  it("garde le texte, marque a-reprogrammer, notifie, archive le créneau avec retireLe", async () => {
    const m = monde({ ecritureEchoue: 1 });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r).toEqual({ ok: false, etat: "a-reprogrammer", message: PHRASES_DEPLACEMENT.aPlacer, ecritures: true });
    expect(m.retraits).toHaveLength(1);
    expect(m.creneau().statut).toBe("archive");
    expect(m.creneau().retireLe).toBeTruthy();
    expect(m.creneau().textes.linkedin.texte).toBe("Le texte");
    expect(m.marques.get("deplacement:envoi:vis_1:linkedin:v0")).toBe("a-reprogrammer");
    expect(m.notifs).toHaveLength(1);
    expect(m.notifs[0].motif).toBe("a-reprogrammer");
    expect(m.visuels.get("vis_1")!.statut).toBe("valide");
    expect(occupeBuffer(m.pubs.get("pub_1") as never)).toBe(false);
    expect(vivants(m).every((e) => e.statut !== "programme")).toBe(true);
    expect(m.supprime).toEqual([]);
  });

  it("si même le repli ne s'écrit pas : « à vérifier », rien de faux n'est affirmé", async () => {
    const m = monde({ ecritureEchoue: 2 });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r).toEqual({ ok: false, etat: "a-verifier", message: PHRASES_DEPLACEMENT.aVerifierFin });
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
  });
});

describe("CAL-23 · fonction du client manquante sur master : rien ne change si un post existe chez le diffuseur", () => {
  it("sans port de retrait : aucun appel, aucune écriture, aucune marque : l'ancienne date reste et la phrase le dit", async () => {
    const m = monde({ sansDiffuseur: true });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r).toEqual({ ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.sansRetrait });
    expect(m.ordre).toEqual([]);
    expect(m.creneau().jourVise).toBe("2026-12-11");
    expect(m.creneau().statut).toBe("programme");
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("programme");
    expect(m.marques.size).toBe(0);
    expect(m.journal).toEqual([]);
  });
});

describe("CAL-23 · modifier le texte : repasse par le contrôleur et par le clic Valider", () => {
  const saisie = (sur: Record<string, unknown> = {}) => ({ creneauId: "cre_1", reseau: "linkedin", texte: "Un nouveau texte clair.", premierCommentaire: "Et vous ?", auteur: "will", cle: "txt-1", ...sur });

  it("retire chez le diffuseur, écrit le texte, dévalide (plus de valideeLe) : « À valider », aucun nouvel envoi, version suivante", async () => {
    const m = monde({ creneau: { aRenvoyer: true } });
    const r = await modifierTexteProgramme(m.deps, saisie() as never);
    expect(r.ok && r.etat).toBe("modifie");
    expect(m.retraits).toEqual(["envoi:vis_1:linkedin:v0"]);
    expect(m.creneau().textes.linkedin.texte).toBe("Un nouveau texte clair.");
    expect(m.creneau().statut).toBe("a_valider");
    expect(m.creneau().valideeLe).toBeUndefined();
    expect(m.creneau().aRenvoyer).toBeUndefined();
    expect(vivants(m)).toHaveLength(0);
    expect(m.creneau().decalages).toBe(1); // la validation recréera l'envoi sous une NOUVELLE clé, jamais sous l'ancienne
    expect(occupeBuffer(m.pubs.get("pub_1") as never)).toBe(false);
  });

  it("un changement fait par un autre remet l'entrée à « Proposée »", async () => {
    const m = monde();
    const r = await modifierTexteProgramme(m.deps, saisie({ auteur: "autre" }) as never);
    expect(r.ok).toBe(true);
    expect(m.creneau().statut).toBe("propose");
    expect(m.creneau().valideeLe).toBeUndefined();
  });

  it("texte vide ou trop long, réseau inconnu ou sans contrôleur (youtube) : refus avant tout appel", async () => {
    for (const sur of [{ texte: "" }, { texte: "   " }, { texte: "x".repeat(6000) }, { reseau: "inconnu" }, { reseau: "youtube" }, { reseau: undefined }]) {
      const m = monde();
      const r = await modifierTexteProgramme(m.deps, saisie(sur) as never);
      expect(r.ok, JSON.stringify(sur).slice(0, 40)).toBe(false);
      expect(m.ordre).toEqual([]);
    }
  });

  it("TikTok : pas de premier commentaire (garde de la fiche), refus avant tout appel", async () => {
    const m = monde({ creneau: { heuresParReseau: { tiktok: DEMAIN } } });
    const r = await modifierTexteProgramme(m.deps, saisie({ reseau: "tiktok", premierCommentaire: "Un commentaire" }) as never);
    expect(r.ok === false && r.message).toContain("n'a pas de premier commentaire");
    expect(m.ordre).toEqual([]);
  });

  it("le contrôleur de texte refuse un texte au voyant rouge AVANT tout retrait", async () => {
    const m = monde();
    const r = await modifierTexteProgramme(m.deps, saisie({ texte: "x".repeat(4900) }) as never);
    expect(r.ok).toBe(false);
    expect(m.retraits).toEqual([]);
    expect(m.ordre).toEqual([]);
    expect(m.creneau().textes.linkedin.texte).toBe("Le texte");
  });

  it("les retours à la ligne Windows ne comptent pas comme un changement", async () => {
    const m = monde({ creneau: { textes: { linkedin: { texte: "Ligne 1\nLigne 2", premierCommentaire: "Et vous ?" } } } });
    const r = await modifierTexteProgramme(m.deps, saisie({ texte: "Ligne 1\r\nLigne 2" }) as never);
    expect(r.ok && r.etat).toBe("inchange");
    expect(m.ordre).toEqual([]);
  });

  it("le retrait échoue : l'ancien texte et l'ancienne validation restent", async () => {
    const m = monde({ issues: ["sans-reponse"] });
    const r = await modifierTexteProgramme(m.deps, saisie() as never);
    expect(r).toEqual({ ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.sansReponse });
    expect(m.creneau().textes.linkedin.texte).toBe("Le texte");
    expect(m.creneau().statut).toBe("programme");
    expect(m.creneau().valideeLe).toBeTruthy();
  });

  it("l'écriture échoue après le retrait : « À placer » AVEC le texte modifié, notification, jamais « Programmé »", async () => {
    const m = monde({ ecritureEchoue: 1 });
    const r = await modifierTexteProgramme(m.deps, saisie() as never);
    expect(r.ok === false && r.etat).toBe("a-reprogrammer");
    expect(m.creneau().statut).toBe("archive");
    expect(m.creneau().textes.linkedin.texte).toBe("Un nouveau texte clair.");
    expect(m.notifs).toHaveLength(1);
  });

  it("texte identique : rien ne bouge, aucun appel", async () => {
    const m = monde();
    const r = await modifierTexteProgramme(m.deps, saisie({ texte: "Le texte" }) as never);
    expect(r.ok && r.etat).toBe("inchange");
    expect(m.ordre).toEqual([]);
    expect(m.creneau().statut).toBe("programme");
  });

  it("publiée : refus ; heure passée : refus ; rejeu de la même clé : rien de plus", async () => {
    const a = monde({ creneau: { statut: "publie" } });
    expect(await modifierTexteProgramme(a.deps, saisie() as never)).toEqual({ ok: false, etat: "refuse", message: PHRASES_DEPLACEMENT.partie });
    const b = monde({ creneau: { heuresParReseau: { linkedin: "2026-12-10T09:00:00.000Z" } } });
    expect(await modifierTexteProgramme(b.deps, saisie() as never)).toEqual({ ok: false, etat: "refuse", message: PHRASES_DEPLACEMENT.passee });
    expect(a.ordre.concat(b.ordre)).toEqual([]);
    const c = monde();
    await modifierTexteProgramme(c.deps, saisie() as never);
    const encore = await modifierTexteProgramme(c.deps, saisie() as never);
    expect(encore.ok && encore.etat).toBe("deja-fait");
    expect(c.retraits).toHaveLength(1);
  });

  it("sans port de retrait et un post chez le diffuseur : rien n'est changé, ni texte, ni envois, ni version", async () => {
    const m = monde({ sansDiffuseur: true });
    const r = await modifierTexteProgramme(m.deps, saisie() as never);
    expect(r).toEqual({ ok: false, etat: "reste", message: PHRASES_DEPLACEMENT.sansRetrait });
    expect(m.ordre).toEqual([]);
    expect(m.creneau().textes.linkedin.texte).toBe("Le texte");
    expect(m.creneau().decalages).toBe(0);
    expect(m.envois.get("envoi:vis_1:linkedin:v0")!.statut).toBe("programme");
    expect(m.marques.size).toBe(0);
  });
});

describe("CAL-23 · adaptateur vers le client de CAL-22 (relecture avant, jamais en aveugle)", () => {
  const e = envoi();
  const client = (sur: Partial<Record<string, unknown>> = {}) => {
    const appels: string[] = [];
    return {
      appels,
      c: () => ({
        listerPosts: async (q: { status: string }) => { appels.push(`liste:${q.status}`); return q.status === "scheduled" ? [{ _id: "post_1", metadata: { studioCle: CLE } }] : []; },
        retirer: async (d: { postId: string; cleJournal: string }) => { appels.push(`retirer:${d.postId}:${d.cleJournal === CLE}`); if (sur.leve) throw sur.leve; return { etat: (sur.etat as string) ?? "retire" }; },
      }),
    };
  };
  it("retire le post trouvé sous la clé, après relecture des brouillons et des programmés", async () => {
    const k = client();
    expect(await portRetraitDepuisClient(k.c as never).retirer(e)).toBe("retire");
    expect(k.appels).toEqual(["liste:draft", "liste:scheduled", `retirer:post_1:true`]);
  });
  it("aucun post sous la clé : « à vérifier », aucun retrait", async () => {
    const k = client();
    expect(await portRetraitDepuisClient(k.c as never).retirer(envoi({ cleDiffuseur: "c".repeat(64) }))).toBe("a-verifier");
    expect(k.appels.some((a) => a.startsWith("retirer"))).toBe(false);
  });
  it.each([
    [{ etat: "a-verifier" }, "a-verifier"],
    [{ etat: "refuse" }, "refuse"],
    [{ leve: Object.assign(new Error("x"), { code: "refuse" }) }, "refuse"],
    [{ leve: Object.assign(new Error("x"), { code: "envoi-coupe" }) }, "sans-reponse"],
    [{ leve: Object.assign(new Error("x"), { code: "indisponible" }) }, "sans-reponse"],
    [{ leve: Object.assign(new Error("x"), { code: "debit" }) }, "sans-reponse"],
    [{ leve: Object.assign(new Error("x"), { code: "limite-incertaine" }) }, "a-verifier"],
    [{ leve: Object.assign(new Error("x"), { code: "a-verifier" }) }, "a-verifier"],
    [{ leve: new Error("inconnue") }, "a-verifier"],
  ])("réponse %j : %s", async (sur, attendu) => {
    expect(await portRetraitDepuisClient(client(sur).c as never).retirer(e)).toBe(attendu);
  });
});

describe("CAL-23 · périmètre, écran et vocabulaire", () => {
  const lire = (p: string) => readFileSync(p, "utf8");
  const action = lire("src/app/(studio)/calendrier/actions/deplacer.ts");
  const service = lire("src/services/deplacer-programmation.ts");

  it("l'action est « use server », exige la session en premier et n'appelle aucun fournisseur", () => {
    expect(action.trimStart().startsWith('"use server"')).toBe(true);
    for (const nom of ["deplacerProgrammationAction", "modifierTexteProgrammeAction", "modifierTexteProgrammeDepuisFormulaire"]) {
      const corps = action.slice(action.indexOf(`export async function ${nom}`));
      expect(corps.slice(0, corps.indexOf("{") + 120), nom).toContain("exigerSession");
    }
    expect(action).not.toMatch(/fournisseurs\/publication/);
  });

  it("l'action traduit chaque état d'échec en un code distinct", () => {
    expect(new Set(Object.values(CODES_DEPLACEMENT)).size).toBe(Object.keys(CODES_DEPLACEMENT).length);
    expect(Object.keys(CODES_DEPLACEMENT).sort()).toEqual(["a-reprogrammer", "a-retirer-a-la-main", "a-verifier", "refuse", "reste"]);
    expect(action).toContain("CODES_DEPLACEMENT[r.etat]");
  });

  it("le service n'importe aucun fournisseur ni le client du diffuseur (zone Zernio intacte)", () => {
    // Un import de TYPE (contrat du client, vérifié par tsc) est permis ; jamais un import de valeur.
    expect(service.replace(/import type [^;]*;/g, "")).not.toMatch(/from\s+["']@\/fournisseurs/);
    expect(service.replace(/import type [^;]*;/g, "")).not.toMatch(/zernio-client/);
  });

  const entreeProgrammee = { cle: "creneau:cre_1|linkedin", etat: "programme", jour: "2026-12-11", heure: "09:30", reseau: "linkedin", type: "carrousel", texte: "Le texte", confiee: true } as never;
  const rendre = (extra: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(FicheEntree, { entree: entreeProgrammee, aujourdhui: "2026-12-10", action: () => {}, selonStatut: true, surPrincipal: () => {}, ...extra }));

  it("fiche « Programmé » : verrouillée par défaut ; modifiable quand l'hôte le permet, avec un seul bouton plein et sans cadenas", () => {
    expect(rendre({})).toMatch(/readonly/i);
    expect(rendre({})).not.toContain(PHRASE_PROGRAMMEE_MODIFIABLE);
    const ouverte = rendre({ texteProgrammeModifiable: true });
    expect(ouverte).not.toMatch(/<textarea[^>]*readonly/i);
    expect(ouverte).toContain(PHRASE_PROGRAMMEE_MODIFIABLE);
    expect(ouverte).toContain("Modifier le texte");
    expect(ouverte).not.toContain("cadenas");
    expect((ouverte.match(/<button[^>]*\sbg-orange\s/g) ?? []).length).toBe(1); // un seul bouton orange plein
    expect(PHRASE_PROGRAMMEE_MODIFIABLE).toMatch(/vous/);
    expect(PHRASE_PROGRAMMEE_MODIFIABLE).not.toMatch(/retirée du diffuseur/);
  });

  it("phrases : vouvoiement, aucun prix, aucun nom d'outil", () => {
    const toutes = JSON.stringify(Object.values(PHRASES_DEPLACEMENT).map((p) => (typeof p === "function" ? (p as (...a: string[]) => string)("LinkedIn", "14/12") : p)));
    expect(toutes).not.toMatch(/€|\$|euro|prix|tarif|zernio|buffer/i);
    expect(toutes).toMatch(/vous|Vous|vos|votre|Rechargez|réessayez|relisez|retirez/i);
  });
});

describe("CAL-23 · l'action rend le code et la phrase exacts, et rafraîchit la page quand quelque chose a bougé", () => {
  const { deplacerProgrammationServeur, modifierTexteProgrammeServeur } = vi.mocked(serviceModule);
  const CLE_FICHE = "creneau:cre_1|linkedin";

  it.each([
    ["reste", PHRASES_DEPLACEMENT.sansRetrait, "DEPLACEMENT_RESTE_PROGRAMME", false],
    ["a-reprogrammer", PHRASES_DEPLACEMENT.aPlacer, "DEPLACEMENT_A_REPROGRAMMER", true],
    ["a-verifier", PHRASES_DEPLACEMENT.aVerifier, "DEPLACEMENT_A_VERIFIER", false],
    ["a-retirer-a-la-main", PHRASES_DEPLACEMENT.aLaMain, "DEPLACEMENT_A_LA_MAIN", false],
    ["refuse", PHRASES_DEPLACEMENT.passee, "DEPLACEMENT_REFUSE", false],
  ] as const)("échec « %s » : code %s, phrase exacte, rafraîchissement seulement si des écritures ont eu lieu", async (etat, message, code, ecritures) => {
    deplacerProgrammationServeur.mockResolvedValueOnce({ ok: false, etat, message, ...(ecritures ? { ecritures: true as const } : {}) });
    const r = await deplacerProgrammationAction(CLE_FICHE, "2026-12-14", "form-1");
    expect(r).toEqual({ ok: false, message, code });
    expect(revalide.appels).toEqual(ecritures ? ["/calendrier"] : []);
  });

  it("succès : la phrase du service, la page est rafraîchie ; texte : même chemin", async () => {
    deplacerProgrammationServeur.mockResolvedValueOnce({ ok: true, etat: "deplace", message: "Déplacée.", creneauId: "cre_1" });
    expect(await deplacerProgrammationAction(CLE_FICHE, "2026-12-14", "form-1")).toEqual({ ok: true, donnees: { creneauId: "cre_1", message: "Déplacée." } });
    modifierTexteProgrammeServeur.mockResolvedValueOnce({ ok: false, etat: "a-reprogrammer", message: PHRASES_DEPLACEMENT.aPlacer, ecritures: true });
    const r = await modifierTexteProgrammeAction(CLE_FICHE, { texte: "Un texte", cleFormulaire: "f-1" });
    expect(r).toEqual({ ok: false, message: PHRASES_DEPLACEMENT.aPlacer, code: "DEPLACEMENT_A_REPROGRAMMER" });
    expect(revalide.appels).toEqual(["/calendrier", "/calendrier"]);
  });

  it("une clé de fiche d'une autre origine ou une clé de formulaire illisible : refus, le service n'est pas appelé", async () => {
    deplacerProgrammationServeur.mockClear();
    expect((await deplacerProgrammationAction("publication:pub_1|linkedin", "2026-12-14", "form-1")).ok).toBe(false);
    expect((await deplacerProgrammationAction(CLE_FICHE, "2026-12-14", "")).ok).toBe(false);
    expect(deplacerProgrammationServeur).not.toHaveBeenCalled();
  });

  it("adaptateur de formulaire : même contenu = même clé de rejeu, autre contenu = autre clé", async () => {
    modifierTexteProgrammeServeur.mockClear();
    modifierTexteProgrammeServeur.mockResolvedValue({ ok: true, etat: "modifie", message: "ok", creneauId: "cre_1" });
    const f = (texte: string) => {
      const x = new FormData();
      x.set("cle", CLE_FICHE);
      x.set("texte", texte);
      return x;
    };
    await modifierTexteProgrammeDepuisFormulaire(f("Texte A"));
    await modifierTexteProgrammeDepuisFormulaire(f("Texte A"));
    await modifierTexteProgrammeDepuisFormulaire(f("Texte B"));
    const cles = modifierTexteProgrammeServeur.mock.calls.map((c) => c[0].cle);
    expect(cles[0]).toBe(cles[1]);
    expect(cles[0]).not.toBe(cles[2]);
    expect(modifierTexteProgrammeServeur.mock.calls[0][0]).toMatchObject({ creneauId: "cre_1", reseau: "linkedin", texte: "Texte A", auteur: "will" });
    modifierTexteProgrammeServeur.mockRestore();
  });
});

describe("CAL-23 · sur de vrais dépôts en mémoire : le tour d'envoi recrée UNE seule version, la nouvelle", () => {
  const MIN = 60_000;
  const JOUR_MS = 24 * 60 * MIN;
  const arrondi = (x: number): number => Math.floor(x / MIN) * MIN;
  const heure = (jours: number): string => new Date(arrondi(Date.now() + jours * JOUR_MS)).toISOString().replace(/\.\d{3}Z$/, "Z");
  const CLE_V0 = "envoi:vis_1:linkedin:v0";

  it("après retrait et déplacement : aucune exclusion « occupe » ni « annule », une seule ligne à envoyer (v1, nouveau jour), garde « libre »", async () => {
    const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
    const { ecrireParametre } = await import("@/services/_commun");
    const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
    const { construireDepsEnvoiCalendrier } = await import("@/services/branchement-envoi-calendrier");
    const { niveauDiffuseurDuCreneau } = await import("@/services/garde-creneau-diffuseur");
    const { depsDeplacementServeur } = await import("@/services/deplacer-programmation");
    reinitialiserDepots();
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
    await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
    await ecrireParametre(PARAM_ARRET_ZERNIO, true);
    const le = "2026-11-10T08:00:00Z";
    await depots().visuels.enregistrer({ id: "vis_1", famille: "carrousel", titre: "Cinq erreurs", entree: { type: "sujet", sujet: "exemple" }, statut: "programme", modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le, spec: { alt: "Cinq erreurs courantes à éviter" } } as never);
    await depots().creneauxEditoriaux.enregistrer({
      id: "cre_1", jourVise: heure(2).slice(0, 10), heuresParReseau: { linkedin: heure(2) }, compteCible: "compte-1:li:42", visuelId: "vis_1",
      textes: { linkedin: { texte: "Texte linkedin", premierCommentaire: "" } }, statut: "programme", decalages: 0, valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur",
    } as never);
    await depots().envoisPlanifies.enregistrer(envoi({ id: CLE_V0, cle: CLE_V0, jour: heure(2).slice(0, 10), creeLe: le, modifieLe: le }) as never);
    await depots().publications.enregistrer({ id: "pub_1", visuelId: "vis_1", reseau: "linkedin", canalId: "compte-1:li:42", via: "zernio", statut: "programmee", etatEnvoi: "confirme", cleEnvoi: CLE, creeLe: le, modifieLe: le } as never);
    await depots().parametres.enregistrer({ id: `envoi-calendrier:promotion:${CLE_V0}`, valeur: "programme", creeLe: le, modifieLe: le } as never);
    expect((await niveauDiffuseurDuCreneau("cre_1")).niveau).toBe("programme");

    const retraits: string[] = [];
    const deps = await depsDeplacementServeur({ retirer: async (e) => { retraits.push(e.cle); return "retire"; } });
    const nouveauJour = heure(4).slice(0, 10);
    const r = await deplacerProgrammation(deps, { creneauId: "cre_1", nouveauJour, cle: "form-1" });
    expect(r.ok).toBe(true);
    expect(retraits).toEqual([CLE_V0]);

    const notifs: unknown[] = [];
    const lignes = await construireDepsEnvoiCalendrier({ client: {} as never, maintenant: () => Date.now(), notifier: async (n) => void notifs.push(n) }).creneaux();
    expect(notifs).toEqual([]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ id: "cre_1", reseau: "linkedin", versionCreneau: 1, jour: nouveauJour });
    expect(cleEnvoi("vis_1", "linkedin", lignes[0].versionCreneau)).not.toBe(CLE_V0);
    expect((await niveauDiffuseurDuCreneau("cre_1")).niveau).toBe("libre");
    expect((await depots().publications.obtenir("pub_1"))?.etatEnvoi).toBe("absent");
    expect((await depots().envoisPlanifies.obtenir(CLE_V0))?.statut).toBe("annule");
    expect((await depots().journalDecalages.lister()).length).toBe(1);
  }, 60_000);
});

describe("CAL-23 · audit : envoi annulé gardant sa marque, écriture ratée après retrait, écriture ratée sans post", () => {
  const B = "envoi:vis_1:facebook:v0";
  it("un envoi vivant avec post ET un envoi annulé marqué « programme » : les DEUX passent par le retrait avant tout changement", async () => {
    const m = monde({
      envois: [envoi(), envoi({ id: B, cle: B, reseau: "facebook", cleDiffuseur: "b".repeat(64), statut: "annule" })],
      marques: { [`promotion:${B}`]: "programme" },
    });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(true);
    expect(m.retraits.sort()).toEqual([B, "envoi:vis_1:linkedin:v0"].sort());
    expect(m.marques.get(`promotion:${B}`)).toBe("libre");
  });
  it("le retrait de l'envoi annulé est incertain : rien ne change (ancienne date gardée), marque « à vérifier »", async () => {
    const m = monde({
      envois: [envoi(), envoi({ id: B, cle: B, reseau: "facebook", cleDiffuseur: "b".repeat(64), statut: "annule" })],
      marques: { [`promotion:${B}`]: "programme" },
      issues: ["retire", "a-verifier"],
    });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(m.creneau().jourVise).toBe("2026-12-11");
  });
  it("retrait partiel confirmé puis écriture ratée : « à vérifier » marqué, jamais un faux « programmé »", async () => {
    const m = monde({
      envois: [envoi(), envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: "c".repeat(64) })],
      issues: ["retire", "a-verifier"],
      ecritureEchoue: 1,
    });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r).toMatchObject({ ok: false, etat: "a-verifier", ecritures: true });
    expect(m.marques.get("a-verifier:envoi:vis_1:linkedin:v0")).toBe("a-verifier");
  });
  it("sans post chez le diffuseur et écriture ratée : on ne dit jamais « le retrait a eu lieu »", async () => {
    const m = monde({ envois: [envoi({ cleDiffuseur: undefined, statut: "valide" } as never)], ecritureEchoue: 1 });
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r.ok).toBe(false);
    expect(r.message).toBe(PHRASES_DEPLACEMENT.rienChange);
    expect(r.message).not.toContain("retrait a eu lieu");
  });
});

describe("CAL-23 · port de retrait : liste ou client en échec = sans réponse, sans marque", () => {
  const env = { cle: "K", cleDiffuseur: "K" } as never;
  it("la liste des posts échoue : « sans-reponse »", async () => {
    const c = { listerPosts: async () => { throw new Error("coupé"); }, retirer: async () => ({ etat: "retire" }) } as never;
    expect(await portRetraitDepuisClient(() => c).retirer(env)).toBe("sans-reponse");
  });
  it("le client ne se construit pas (clé absente) : « sans-reponse »", async () => {
    expect(await portRetraitDepuisClient(() => { throw Object.assign(new Error("non relié"), { code: "ZERNIO_NON_RELIE" }); }).retirer(env)).toBe("sans-reponse");
  });
});

describe("CAL-23 · tour 2 : une marque qui échoue ne casse rien", () => {
  it("marque impossible après un premier retrait confirmé : l'envoi retiré passe quand même « annule », réponse « à vérifier »", async () => {
    const m = monde({
      envois: [envoi(), envoi({ id: "envoi:vis_1:facebook:v0", cle: "envoi:vis_1:facebook:v0", reseau: "facebook", cleDiffuseur: "c".repeat(64) })],
      issues: ["retire", "a-verifier"],
    });
    m.deps.etats.noter = async () => { throw new Error("marque impossible"); };
    const r = await deplacerProgrammation(m.deps, demande());
    expect(r).toMatchObject({ ok: false, etat: "a-verifier", ecritures: true });
    expect(m.envois.get("envoi:vis_1:linkedin:v0")?.statut).toBe("annule");
  });
});
