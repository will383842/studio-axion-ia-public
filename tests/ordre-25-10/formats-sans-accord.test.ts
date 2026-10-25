/**
 * Lot 5 « le prix ne bloque jamais » (règle produit du 25/10/2026), autres formats : séries, décors, reprises d'écriture,
 * tableau animé, cas concret. Pour chaque format : en mode indicatif aucun accord-requis (ni arrêt de prix) et un appel part ;
 * témoin en mode bloquant : l'ancien comportement. Dépôts en mémoire, aucun réseau, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "../helpers/g0";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";
import { reponseFlux, fluxReussi } from "../helpers/g0";
import type { DefinitionRole } from "@/generateur/roles/types";
import { contexteExemple, ficheDemonstration, AUJOURDHUI_EXEMPLES } from "../tableau/regles/exemples";
import { banc, versOutils } from "../tableau/moteur/doubles";
import { banc as bancCas } from "../cas-concret/moteur/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const couts = await import("@/services/couts");
const { ecrireParametre } = await import("@/services/_commun");
const { CLE_MODE_BUDGET } = await import("@/services/mode-budget");
const credits = await import("@/services/credits");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { jetonsEstimes } = await import("@/fournisseurs/claude/tarifs");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const serie = await import("@/services/serie-ecriture");

const MDP = "formats-sans-accord";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;
const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = [...SUJETS_BANC.map((s) => s.idee), "Les réunions qui auraient pu être un e-mail", "Le devis refait trois fois"];

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

async function brancherClaude() {
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
  await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10_000);
  const b = await couts.resumeBudget();
  await ecrireParametre("budget.mensuel", { centimes: b.depense.centimes + b.engage.centimes + 1_000_000, devise: "EUR" });
}

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("séries — mode %s", (mode, indicatif) => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, mode);
  });

  it(indicatif ? "au-delà du seuil, sans total confirmé : la série part" : "témoin : au-delà du seuil, sans total confirmé, CONFIRMATION_REQUISE et rien n'est créé", async () => {
    await brancherClaude();
    const prix = (await bg.prixLancement()).centimes;
    await ecrireParametre("budget.seuilConfirmation", { centimes: 2 * prix, devise: "EUR" });
    const textes = IDEES.slice(0, 3);
    const lancement = serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, `serie-${mode}`);
    if (!indicatif) {
      await expect(lancement).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
      expect(await depots().scriptsMaitres.compter((m) => !m.estDemo && textes.includes(m.brief.idee))).toBe(0);
      return;
    }
    const { serie: s } = await lancement;
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti"]);
  });
});

const decors = await import("@/services/decors");

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("décors — mode %s", (mode, indicatif) => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, mode);
  });

  it(indicatif ? "« Un décor en une phrase » sans confirmation du coût : les 3 propositions partent" : "témoin : sans confirmation du coût, « Confirmez d'abord »", async () => {
    const lancement = decors.demanderDecor("Un bureau en bois avec une bibliothèque", { confirme: false });
    if (!indicatif) return void (await expect(lancement).rejects.toThrow(/Confirmez/));
    expect((await lancement).propositionIds).toHaveLength(3);
  });

  it(indicatif ? "Look de décor sans confirmation du coût : un look par angle" : "témoin : Look de décor sans confirmation, « Confirmez d'abord »", async () => {
    const lancement = decors.preparerLookDecor("decor-r2-bibliotheque", { confirme: false });
    if (!indicatif) return void (await expect(lancement).rejects.toThrow(/Confirmez/));
    expect((await lancement).crees.sort()).toEqual(["face", "trois-quarts"]);
  });
});

/* ------------------------------------------------------------------ */
/* Reprise d'écriture (« Reprendre ≈ X € ») : même harnais que budget-indicatif-ecriture-reprise */
/* ------------------------------------------------------------------ */

/** Faux Claude facturé au pire. */
function claudeAuPire(roles: DefinitionRole[]) {
  const appels: string[] = [];
  const vus = new Set<string>();
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const brut = String(init?.body ?? "{}");
    const corps = JSON.parse(brut) as { system: { text: string; cache_control?: unknown }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = roles.find((r) => consigne.startsWith(r.consigne.trim()))!;
    appels.push(role.id);
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    const total = jetonsEstimes(brut);
    const socle = vus.has(role.id) ? 0 : jetonsEstimes(corps.system.filter((b) => b.cache_control).map((b) => b.text).join("\n"));
    vus.add(role.id);
    return reponseFlux(fluxReussi({ texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie), modele: role.modele, entree: total - socle, cacheEcrit: socle, cacheLu: 0, sortie: role.maxTokens }));
  }) as typeof fetch;
  return { fetch: f, appels };
}
const claudePire = () => {
  const c = claudeAuPire(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: c.fetch, attenteMs: () => 0 });
  return c;
};
const generation = async (id: string) => (await depots().generations.obtenir(id))!;
const lancerSujet = (i: number) => bg.lancerGeneration({ idee: SUJETS_BANC[i].idee, reseaux: [...SUJETS_BANC[i].reseaux], formatId: "avocat", pilier: SUJETS_BANC[i].pilier.id, mode: "avatar" as const });
const entre = (pire: number, diviseur: number) => Math.ceil((pire / diviseur) * 100) / 100;

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("reprise d'une écriture bloquée — mode %s", (mode, indicatif) => {
  it(indicatif ? "« Reprendre » sans montant confirmé : l'écriture repart, aucun CONFIRMATION_REQUISE" : "témoin : « Reprendre » sans montant confirmé, CONFIRMATION_REQUISE", async () => {
    credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
    await credits.declarerRecharge("anthropic", 100_000);
    await ecrireParametre("fournisseur.script", "claude");
    gc.forcerChainePourEssai("grande");
    // Pire cas de la grande chaîne, lu d'une écriture refusée en mode bloquant (plafond par défaut), puis close.
    claudePire();
    await ecrireParametre(CLE_MODE_BUDGET, "bloquant");
    const sonde = await lancerSujet(0);
    if (!sonde.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const pire = (await gc.lireReserveChaine(sonde.generationId))!.pireCasUsd;
    await depots().generations.modifier(sonde.generationId, { statut: "echec" });

    const c = claudePire();
    await ecrireParametre(CLE_MODE_BUDGET, mode);
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, Math.floor((pire / 8) * 100) / 100);
    const r = await lancerSujet(2);
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    expect((await generation(r.generationId)).statut).toBe("plafond-atteint");
    await ecrireParametre(gc.PARAM_PLAFOND_GRANDE_CHAINE, indicatif ? entre(pire, 3) : Math.ceil(pire * 100) / 100 + 1);
    const reprise = bg.reprendreEcriture(r.scriptMaitreId);
    if (!indicatif) return void (await expect(reprise).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" }));
    expect(await reprise).toBe(1);
    await bg.tourBoucleGeneration();
    expect(c.appels.length).toBeGreaterThan(0);
    expect((await generation(r.generationId)).statut).not.toBe("plafond-atteint");
  }, 120_000);
});

/* ------------------------------------------------------------------ */
/* Tableau animé : retouche payante (voix refaite), tableau-vue.ts       */
/* ------------------------------------------------------------------ */

const { brancherServicesTableau } = await import("@/moteurs/montage-tableau");
const tableauVue = await import("@/services/tableau-vue");
const VIDEO = "v-03";
const nbVersions = () => depots().versions.compter((x) => x.videoId === VIDEO);

/** v-03 devient une vraie vidéo du tableau animé (comme tests/tableau/raccords) ; la chaîne de retouche reçoit les doubles. */
async function videoTableau() {
  const { texteScript: _s, ...regles } = contexteExemple(ficheDemonstration);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
  const b = banc(ficheDemonstration);
  const c = { ...b.commande(ficheDemonstration), videoId: VIDEO };
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await depots().videos.modifier(VIDEO, { formatId: "tableau-anime", estDemo: false });
  await depots().versions.modifier(ver.id, { commande: c, estDemo: false, projetMontage: { moteur: "montage-tableau", tableau: { journal: { version: "fabrication-tableau/1", etapes: {} }, fiche: ficheDemonstration, retouchee: true } } });
  brancherServicesTableau({ outils: async () => versOutils(b.d, b.fiches) });
}
const OP_VOIX = { type: "modifierTexteDit", sceneId: "s03", texte: "Geste deux : demandez trois idées de publication à partir de la question." };

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("tableau animé, retouche payante — mode %s", (mode, indicatif) => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, mode);
    await videoTableau();
  });

  it(indicatif ? "retoucherTableau sans accord : lancée, jamais accord-requis" : "témoin : retoucherTableau sans accord, accord-requis et rien n'est lancé", async () => {
    const avant = await nbVersions();
    const r = await tableauVue.retoucherTableau(VIDEO, OP_VOIX, {}, { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (!indicatif) {
      expect(r).toMatchObject({ statut: "accord-requis" });
      expect(await nbVersions()).toBe(avant);
      return;
    }
    expect(r).toMatchObject({ statut: "lancee" });
    expect(await nbVersions()).toBe(avant + 1);
  });

  it(indicatif ? "un accord trop bas est relevé au prix du jour : lancée" : "témoin : un accord trop bas redemande le prix", async () => {
    const r = await tableauVue.retoucherTableau(VIDEO, OP_VOIX, { accord: 1 }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r).toMatchObject({ statut: indicatif ? "lancee" : "accord-requis" });
  });
});

/* ------------------------------------------------------------------ */
/* Cas concret : relance d'une écriture arrêtée (cas-concret-relance.ts) */
/* ------------------------------------------------------------------ */

const relanceCas = await import("@/services/cas-concret-relance");
const casConcret = await import("@/services/cas-concret");
const { RELU_RECRUTEMENT } = await import("../helpers/script-relu");
import type { ErreurTravail, Travail } from "@/domaine/types";

/** Une vraie vidéo du format, lancée (prix confirmé), puis son travail arrêté à l'étape « ecriture » comme le moteur le laisse. */
async function ecritureArretee(): Promise<Travail> {
  const r = await casConcret.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: ["facebook", "instagram", "tiktok", "linkedin"], mot: "IA", avecMot: false, accordCentimes: 100_000, empreinteScriptRelu: RELU_RECRUTEMENT });
  expect(r.statut).toBe("lancee");
  const [t] = await depots().travaux.lister((x) => x.type === "fabrication" && x.cibleId === (r as { videoId: string }).videoId);
  const erreur: ErreurTravail = { code: "CAS_CONCRET_ECHEC", reessayable: true, messagePourWill: "L'étape n'a pas abouti (appel en panne)." };
  const arrete: Travail = { ...t, statut: "echec", erreur, etapes: t.etapes.map((e) => (e.cle === "ecriture" ? { ...e, statut: "echec" as const, erreur } : { ...e, statut: "en_attente" as const })), parametres: { ...t.parametres, casConcret: { atteinte: -1, journal: { version: "x", etapes: {} } } } };
  await depots().travaux.enregistrer(arrete);
  return arrete;
}

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("cas concret, relance d'une écriture arrêtée — mode %s", (mode, indicatif) => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, mode);
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
  });

  it(indicatif ? "Claude réel, sans accord : la relance part, jamais accord-requis" : "témoin : Claude réel, sans accord, accord-requis avec le prix du nouvel essai", async () => {
    const t = await ecritureArretee();
    const r = await relanceCas.relancerEtapeCasConcret(t.id, undefined, { claudeActif: async () => true });
    if (!indicatif) {
      expect(r.statut).toBe("accord-requis");
      expect((await depots().travaux.obtenir(t.id))?.statut).toBe("echec");
      return;
    }
    expect(r).toEqual({ statut: "relancee", travailId: t.id });
    expect((await depots().travaux.obtenir(t.id))?.statut).toBe("en_cours");
  });
});

/* ------------------------------------------------------------------ */
/* Cas concret : retouche par discussion, « Confirmer » (cas-concret-retouches.ts) */
/* ------------------------------------------------------------------ */

const retouchesCas = await import("@/services/cas-concret-retouches");
import type { CommandeFabrication } from "@/domaine/types";
import type { ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";
import type { MoteurVideo, ParentRetouche, ResultatFabrication } from "@/moteurs/types";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

/** v-03 devient une vidéo du format cas concret, fabriquée en simulation (comme tests/cas-concret/retouches-discussion). */
async function videoCasConcret() {
  const b = bancCas({ motSur: ["facebook", "instagram"] });
  const commande = b.commande();
  const fin = await avancerJusqua(b.moteur, commande, await b.moteur.lancer(commande, { travailId: "t-1", versionId: "ver-t-1", titre: "Essai", maintenant: T0 }));
  expect(fin.travail.statut).toBe("termine");
  const projetMontage = JSON.parse(JSON.stringify(fin.resultat!.projetMontage)) as ParentRetouche["projetMontage"];
  const video = (await depots().videos.obtenir(VIDEO))!;
  await depots().videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
  await depots().versions.modifier(video.versionChoisieId!, { estDemo: false, commande: { ...commande, videoId: VIDEO }, projetMontage });
  await ecrireParametre("casConcret.retouches", true);
}

/** Double des appels détachés : l'appel ne répond qu'à `repondre()`. */
function detaches() {
  const enAttente = new Map<string, () => Promise<ReponseAppelEcriture>>();
  const reponses = new Map<string, ReponseAppelEcriture>();
  return {
    appels: { lancer: (cle: string, appel: () => Promise<ReponseAppelEcriture>) => void enAttente.set(cle, appel), lire: async (cle: string) => reponses.get(cle) ?? null },
    repondre: async () => {
      for (const [cle, appel] of enAttente) reponses.set(cle, await appel());
      enAttente.clear();
    },
  };
}

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("cas concret, retouche par discussion — mode %s", (mode, indicatif) => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, mode);
    await videoCasConcret();
  });

  it(indicatif ? "« Confirmer » avec un montant trop bas : relevé au prix du jour, la retouche part" : "témoin : « Confirmer » avec un montant trop bas, accord-requis et rien ne part", async () => {
    const det = detaches();
    const lancerRetouche = vi.fn(async () => ({ travailId: "t-retouche" }));
    const dep = { appels: det.appels, executer: async (_v: string, role: DefinitionRole, entree: never) => ({ ok: true as const, simule: true, donnees: role.simuler(entree) }), claudeActif: async () => false, lancerRetouche };
    await retouchesCas.proposerRetouche(VIDEO, "Changez le mot à commenter : RDV", dep as never);
    await det.repondre();
    const propose = await retouchesCas.suivreRetouche(VIDEO, dep as never);
    if (propose.statut !== "proposee") throw new Error(propose.statut);
    expect(propose.centimes).toBeGreaterThan(0);
    const r = await retouchesCas.confirmerRetouche(VIDEO, propose.centimes - 1, dep as never);
    if (!indicatif) {
      expect(r.statut).toBe("accord-requis");
      expect(lancerRetouche).not.toHaveBeenCalled();
      return;
    }
    expect(r).toEqual({ statut: "lancee", travailId: "t-retouche" });
    expect(lancerRetouche).toHaveBeenCalledTimes(1);
    expect(lancerRetouche).toHaveBeenCalledWith(VIDEO, [], "Changez le mot à commenter : RDV", expect.objectContaining({ confirme: propose.centimes }));
  });
});
