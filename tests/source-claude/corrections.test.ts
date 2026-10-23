/**
 * Corrections de relecture de la PR « sources Claude » (socle multi-comptes). Faux `fetch`, fausses clés, aucun réseau.
 * Chaque test a d'abord été ROUGE sur la branche avant correction.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "../helpers/g0";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import type { GenerationScript, Video } from "@/domaine/types";
import { roleSonde } from "@/generateur/roles/sonde";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const sc = await import("@/services/source-claude");
const pub = await import("@/services/publications");
const dom = await import("@/domaine/source-claude");
const domCredits = await import("@/domaine/credits");
const comite = await import("@/services/comite-editorial");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { PARAM_SOURCES_CLAUDE, paramEpuise } = dom;

const MDP = "source-claude-corrections";
const CLES = { "abonnement-1": "A1", "abonnement-2": "A2", "abonnement-3": "A3", api: "P" } as const;
const CREDIT = () => reponseErreur(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.");
const OK = () => reponseFlux(fluxReussi({ texte: '{"phrase":"ok"}', entree: 2500, cacheEcrit: 1000, sortie: 500 }));
const TOUS = ["abonnement-1", "abonnement-2", "abonnement-3"] as const;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

function espion(parCle: Record<string, (() => Response)[]>) {
  const cles: string[] = [];
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const cle = new Headers(init?.headers).get("x-api-key") ?? "?";
    cles.push(cle);
    const file = parCle[cle];
    const r = file?.length ? (file.length > 1 ? file.shift()! : file[0]!) : undefined;
    if (!r) throw new Error(`clé inattendue : ${cle}`);
    return r();
  }) as typeof fetch;
  return { fetch: f, cles };
}

function injecter(f: typeof fetch, cles: Partial<Record<string, string>> = CLES) {
  gc.injecterClaudePourEssai({ cle: "A1", cles, fetch: f, attenteMs: () => 0 } as never);
}

async function epuiserTous() {
  for (const s of TOUS) await ecrireParametre(paramEpuise(s), { depuis: new Date().toISOString() });
}

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.script", "claude");
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await credits.declarerRecharge("anthropic", 5000);
});

const nettoyages: (() => void)[] = [];
const afterEachNettoyer = (f: () => void) => void nettoyages.push(f);

afterEach(() => {
  for (const f of nettoyages.splice(0)) f();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  vi.restoreAllMocks();
});

let n = 0;
async function nouvelleGeneration(): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-co-${++n}`, scriptMaitreId: `suj-co-${n}`, hachageContexte: "h", plafondUsd: 1.5, portee: "sujet", etapes: [], statut: "en-cours", creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}
const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV de stationnement</brief>" };
const notifs = () => depots().notifications.lister(() => true);
const reservations = () => depots().reservations.lister((r) => (r.travailId ?? "").startsWith("appel"));

/** Une vraie vidéo prête avec un kit déjà écrit (texte à garder). */
async function videoAvecKit(id = "v-co"): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id, estDemo: false, titre: "Télétravail : quels outils pour l'équipe ?" };
  await depots().videos.enregistrer(v);
  return v;
}

describe("1. Claude CHOISI (épuisé ou non) : jamais de texte d'essai à la place d'un vrai texte", () => {
  it("claudeTextesActif vaut vrai quand les 3 comptes sont épuisés", async () => {
    const e = espion({ A1: [OK] });
    injecter(e.fetch);
    await epuiserTous();
    const { claudeTextesActif } = await import("@/services/depense-claude-video");
    expect(await claudeTextesActif()).toBe(true);
    expect(e.cles).toEqual([]);
  });

  it("3 marques d'épuisement puis « Réécrire » → TEXTE_NON_ECRIT, texte inchangé, aucun appel", async () => {
    await exemplesCommeVraies(depots());
    const e = espion({ A1: [OK], A2: [OK], A3: [OK] });
    injecter(e.fetch);
    const v = await videoAvecKit();
    await pub.obtenirKit(v.id);
    const avant = (await depots().kits.trouver((k) => k.videoId === v.id))!.textes.linkedin;
    await epuiserTous();
    await expect(pub.regenererTexteKit(v.id, "linkedin")).rejects.toMatchObject({ code: "TEXTE_NON_ECRIT" });
    const apres = (await depots().kits.trouver((k) => k.videoId === v.id))!.textes.linkedin;
    expect(apres).toEqual(avant);
    expect(e.cles).toEqual([]);
  });

  it("relance d'une étape d'écriture du cas concret, tout épuisé : le prix est annoncé et l'accord demandé", async () => {
    const e = espion({ A1: [OK] });
    injecter(e.fetch);
    await epuiserTous();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
    const service = await import("@/services/cas-concret");
    const relance = await import("@/services/cas-concret-relance");
    const { RELU_RECRUTEMENT } = await import("../helpers/script-relu");
    // Lancement en essai (Claude épuisé) : le travail existe ; on le met ensuite en arrêt à l'étape d'écriture.
    const r = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: ["linkedin"], mot: "IA", avecMot: false, accordCentimes: 100_000, empreinteScriptRelu: RELU_RECRUTEMENT });
    expect(r.statut).toBe("lancee");
    const [t] = await depots().travaux.lister((x) => x.type === "fabrication" && x.cibleId === (r as { videoId: string }).videoId);
    const erreur = { code: "CAS_CONCRET_ECHEC", reessayable: true, messagePourWill: "L'étape n'a pas abouti." };
    await depots().travaux.enregistrer({ ...t!, statut: "echec", erreur, etapes: t!.etapes.map((x, i) => (i === 0 ? { ...x, statut: "echec" as const, erreur } : { ...x, statut: "en_attente" as const })) });
    const etapes = (await depots().travaux.obtenir(t!.id))!.etapes;
    expect(etapes.some((x) => x.cle === "ecriture" && x.statut === "echec")).toBe(true);
    const issue = await relance.relancerEtapeCasConcret(t!.id);
    expect(issue.statut).toBe("accord-requis");
  });
});

describe("2. alerte « comptes épuisés » : seulement quand tous sont épuisés, sans le mot « recharger »", () => {
  it("3 comptes sans crédit → UNE notification, message propre, sans « recharg »", async () => {
    const e = espion({ A1: [CREDIT], A2: [CREDIT], A3: [CREDIT] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree);
    const l = (await notifs()).filter((x) => x.type === "credit");
    expect(l).toHaveLength(1);
    const texte = `${l[0]!.titre} ${l[0]!.message}`;
    expect(texte).toMatch(/Les comptes Claude 1, 2 et 3 sont épuisés jusqu'à leur renouvellement/);
    expect(texte).not.toMatch(/recharg/i);
  });

  it("billing_error reçu DANS le flux (sans rotation) → aucune notification", async () => {
    const dansLeFlux = () => reponseFlux([["message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], usage: { input_tokens: 10, output_tokens: 1 } } }], ["error", { type: "error", error: { type: "billing_error", message: "Billing issue" } }]]);
    const e = espion({ A1: [dansLeFlux], A2: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree).catch(() => undefined);
    expect((await notifs()).filter((x) => x.type === "credit")).toHaveLength(0);
  });

  it("tout épuisé au départ (attente) → une notification propre aussi ; un seul compte retenu → « Le compte Claude… », jamais « Les 1 comptes »", async () => {
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "abonnements", ordre: [...TOUS], desactives: ["abonnement-2", "abonnement-3"], changeLe: null });
    await ecrireParametre(paramEpuise("abonnement-1"), { depuis: new Date().toISOString() });
    injecter(espion({ A1: [OK] }).fetch);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toMatch(/Les 1 comptes|recharg/i);
    const l = (await notifs()).filter((x) => x.type === "credit");
    expect(l).toHaveLength(1);
    expect(`${l[0]!.titre} ${l[0]!.message}`).not.toMatch(/recharg|Les 1 comptes/i);
  });

  it("messages purs : pluriel exact, « Rechargez » seulement pour l'API payante", () => {
    expect(dom.messageComptesEpuises(3)).toBe("Les comptes Claude 1, 2 et 3 sont épuisés jusqu'à leur renouvellement.");
    expect(dom.messageComptesEpuises(2)).toBe("Les 2 comptes Claude sont épuisés jusqu'à leur renouvellement.");
    expect(dom.messageComptesEpuises(1)).toBe("Le compte Claude est épuisé jusqu'à son renouvellement.");
    const m = domCredits.messageEpuise({ nom: "Claude", fournisseur: "anthropic", disponibleTexte: null, restantes: null, comptes: 3 });
    expect(`${m.titre} ${m.message}`).not.toMatch(/recharg/i);
    expect(domCredits.messageEpuise({ nom: "Claude", fournisseur: "anthropic", disponibleTexte: null, restantes: null }).message).toMatch(/Rechargez/);
  });

  it("bandeau de l'Accueil : comptes épuisés sans « rechargez »", () => {
    const b = domCredits.bandeauCredit([{ fournisseur: "anthropic", nom: "Claude", cleRefusee: false, videosRestantes: null, enAttente: 1, comptesEpuises: 3 }]);
    expect(b?.epuise).toBe(true);
    expect(b?.lignes.join(" ")).not.toMatch(/recharg/i);
    expect(b?.lignes.join(" ")).toMatch(/Les comptes Claude 1, 2 et 3 sont épuisés/);
  });

  it("bandeau : comptes épuisés affiché même avec enAttente = 0", () => {
    const b = domCredits.bandeauCredit([{ fournisseur: "anthropic", nom: "Claude", cleRefusee: false, videosRestantes: null, enAttente: 0, comptesEpuises: 2 }]);
    expect(b?.epuise).toBe(true);
    expect(b?.lignes).toEqual(["Les 2 comptes Claude sont épuisés jusqu'à leur renouvellement."]);
  });

  it("bandeau : en mode abonnements, jamais « rechargez » pour Claude sauf tous-épuisés (même en attente ou « bientôt »)", () => {
    for (const c of [{ enAttente: 1 }, { enAttente: 0, videosRestantes: 3 }, { enAttente: 0, epuise: true }]) {
      const b = domCredits.bandeauCredit([{ fournisseur: "anthropic", nom: "Claude", cleRefusee: false, videosRestantes: null, abonnements: true, ...c }]);
      expect(b?.lignes.join(" ") ?? "").not.toMatch(/recharg/i);
    }
  });
});

describe("2b. bandeau : écritures en attente sans comptes épuisés", () => {
  it("mode abonnements, enAttente > 0, comptes non épuisés → ligne neutre sans « recharger », pas d'alarme", () => {
    const b = domCredits.bandeauCredit([{ fournisseur: "anthropic", nom: "Claude", cleRefusee: false, videosRestantes: null, abonnements: true, enAttente: 2 }]);
    expect(b).toEqual({ epuise: false, lignes: ["Claude : 2 travaux en attente."] });
    expect(domCredits.bandeauCredit([{ fournisseur: "anthropic", nom: "Claude", cleRefusee: false, videosRestantes: null, abonnements: true, enAttente: 1 }])?.lignes).toEqual(["Claude : 1 travail en attente."]);
    expect(domCredits.bandeauCredit([{ fournisseur: "anthropic", nom: "Claude", cleRefusee: false, videosRestantes: null, abonnements: true, enAttente: 0 }])).toBeNull();
  });
});

describe("3. écriture en attente de facturation : levée par le renouvellement du compte", () => {
  it("3 comptes épuisés → attente ; un compte redevient prêt (renouvellement) → empêchement levé sans recharge déclarée", async () => {
    const e = espion({ A1: [CREDIT], A2: [CREDIT], A3: [CREDIT] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(await gc.ecritureDebloquee(g.id)).toBe(false);
    await sc.remettreEnService("abonnement-2");
    expect(await gc.ecritureDebloquee(g.id)).toBe(true);
  });
});

describe("4. lot refusé en HTTP 400 crédit → compte marqué", () => {
  it("creerLot : l'erreur est « hors flux »", async () => {
    const { creerLot } = await import("@/fournisseurs/claude/lots");
    const { construireRequete } = await import("@/generateur/roles/types");
    const err = await creerLot([{ idPerso: "p1", requete: construireRequete(roleSonde, entree) }], { cle: "A1", fetch: (async () => CREDIT()) as typeof fetch }).catch((x) => x);
    expect(err).toMatchObject({ code: "facturation", horsFlux: true });
  });
});

describe("5. 429 / 500 : jamais de marque d'épuisement, même avec « usage limits » dans le message", () => {
  it.each([429, 500])("statut %i avec « usage limits » → un seul compte essayé, aucune marque", async (statut) => {
    const e = espion({ A1: [() => reponseErreur(statut, "rate_limit_error", "You have reached your specified API usage limits.")], A2: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    await gc.executerRoleFacture(g.id, roleSonde, entree).catch(() => undefined);
    // Surcharge : le compte 1 peut être réessayé, mais la rotation ne part JAMAIS vers le compte 2.
    expect(e.cles.length).toBeGreaterThan(0);
    expect(new Set(e.cles)).toEqual(new Set(["A1"]));
    expect(await sc.etatsEpuisement()).toEqual({ "abonnement-1": false, "abonnement-2": false, "abonnement-3": false });
    expect((await notifs()).filter((x) => x.type === "credit")).toHaveLength(0);
  });
});

describe("6. la clé payante n'est JAMAIS un compte d'abonnement", () => {
  it("même valeur collée en compte 2 : ignorée comme compte 2", () => {
    const env = { ANTHROPIC_API_KEY: "A1", ANTHROPIC_API_KEY_2: "P", ANTHROPIC_API_KEY_PAYANTE: "P" };
    const r = dom.choisirSource(dom.REGLAGE_SOURCES_PAR_DEFAUT, env, { "abonnement-1": true });
    expect(r).toEqual({ etat: "tous-epuises", comptes: 1 });
    expect(dom.prochaineSourceAbonnement(dom.REGLAGE_SOURCES_PAR_DEFAUT, env, { "abonnement-1": true }, ["abonnement-1"])).toBeNull();
  });
});

describe("7. Claude choisi mais aucun compte utilisable : attente claire, jamais une simulation silencieuse", () => {
  it("mode api sans clé payante → l'écriture attend (aucun appel, aucune simulation)", async () => {
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "api", ordre: [...TOUS], desactives: [], changeLe: null });
    const e = espion({ A1: [OK] });
    injecter(e.fetch, { "abonnement-1": "A1" });
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    if (!r.ok) expect(r.message).toMatch(/payante/i);
    expect(e.cles).toEqual([]);
    expect((await depots().generations.obtenir(g.id))!.statut).toBe("en-attente-credit");
  });

  it("3 comptes désactivés (clés posées) → attente claire", async () => {
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "abonnements", ordre: [...TOUS], desactives: [...TOUS], changeLe: null });
    const e = espion({ A1: [OK], A2: [OK], A3: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(e.cles).toEqual([]);
  });
});

describe("7b. comité à la demande : message distinct quand la cause est « sans compte » (pas « épuisés »)", () => {
  async function preparer() {
    await ecrireParametre(comite.PARAM_COMITE, true);
    const idees = await import("@/services/source-idees");
    const sim = idees.sourceIdeesSimulee();
    idees.brancherSourceIdees({ nom: "Usine (essai)", simulee: false, tirer: (k) => sim.tirer(k) });
    afterEachNettoyer(() => idees.brancherSourceIdees(null));
  }

  it("mode api sans clé payante → message « API payante », sans « épuisés »", async () => {
    await preparer();
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "api", ordre: [...TOUS], desactives: [], changeLe: null });
    injecter(espion({ A1: [OK] }).fetch, { "abonnement-1": "A1" });
    const r = await comite.jugerALaDemande(10_000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/API payante/);
      expect(r.message).not.toMatch(/épuisés/);
    }
  });

  it("3 comptes désactivés → message « Aucun compte Claude n'est actif », sans « épuisés »", async () => {
    await preparer();
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "abonnements", ordre: [...TOUS], desactives: [...TOUS], changeLe: null });
    injecter(espion({ A1: [OK] }).fetch);
    const r = await comite.jugerALaDemande(10_000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/Aucun compte Claude/);
      expect(r.message).not.toMatch(/épuisés/);
    }
  });

  it("tous épuisés → le message « épuisés » reste", async () => {
    await preparer();
    await epuiserTous();
    injecter(espion({ A1: [OK] }).fetch);
    const r = await comite.jugerALaDemande(10_000);
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/épuisés/) });
  });
});

describe("8. échec de la marque d'épuisement : l'ErreurClaude d'origine est relancée, réservation rendue", () => {
  it("écriture de la marque en panne → pas d'exception étrangère, réservation libérée, génération en attente", async () => {
    const e = espion({ A1: [CREDIT], A2: [OK] });
    injecter(e.fetch);
    const g = await nouvelleGeneration();
    const vrai = depots().parametres.enregistrer.bind(depots().parametres);
    vi.spyOn(depots().parametres, "enregistrer").mockImplementation((async (p: { id: string }) => {
      if (p.id.startsWith("claude.epuise.")) throw new Error("base en panne");
      return vrai(p as never);
    }) as never);
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree).catch((x) => x);
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect((await reservations())[0]!.statut).toBe("liberee");
  });
});

describe("9. comité : dépense cumulée par source ; catalogue : Claude proposé avec au moins une clé de compte", () => {
  it("à la demande : appel 1 sur le compte 1, appel 2 sur le compte 2 → une dépense par compte", async () => {
    await ecrireParametre(comite.PARAM_COMITE, true);
    const idees = await import("@/services/source-idees");
    const sim = idees.sourceIdeesSimulee();
    idees.brancherSourceIdees({ nom: "Usine (essai)", simulee: false, tirer: (k) => sim.tirer(k) });
    afterEachNettoyer(() => idees.brancherSourceIdees(null));
    const e = espion({ A1: [OK, CREDIT], A2: [OK] });
    injecter(e.fetch);
    const prix = await comite.prixJugementDirect();
    const r = await comite.jugerALaDemande(prix.centimesEur * 10);
    expect(r.ok).toBe(true);
    const parSource = new Set((await depots().depenses.lister((d) => d.lignes.some((l) => l.fournisseur === "anthropic"))).map((d) => d.sourceClaude));
    expect(e.cles).toContain("A2");
    expect([...parSource].sort()).toEqual(["abonnement-1", "abonnement-2"]);
  });

  it("catalogue et inscription : une clé de compte 2 ou 3 seule suffit", async () => {
    const { CATALOGUE } = await import("@/fournisseurs/catalogue");
    const noms = (t: "script" | "texte-reseaux") => CATALOGUE[t][0]!.ensembles.map((x) => x.join("+"));
    for (const t of ["script", "texte-reseaux"] as const) {
      expect(noms(t)).toEqual(expect.arrayContaining(["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_2", "ANTHROPIC_API_KEY_3"]));
    }
    const insc = await import("@/fournisseurs/claude/inscription");
    expect(Object.keys(insc.scriptClaude({ ANTHROPIC_API_KEY_2: "x" }))).toEqual(["claude"]);
    expect(Object.keys(insc.texteReseauxClaude({ ANTHROPIC_API_KEY_3: "x" }))).toEqual(["claude"]);
    expect(Object.keys(insc.scriptClaude({}))).toEqual([]);
  });
});

describe("10. classerErreur : le texte « facturation » ne vaut que pour 400/402/403", () => {
  it.each([429, 529, 500, 503])("statut %i dont le message dit « billing » / « usage limits » → surcharge, jamais facturation", async (statut) => {
    const { classerErreur } = await import("@/fournisseurs/claude/client");
    for (const msg of ["Billing hiccup, retry later", "You have reached your specified API usage limits."]) {
      const e = classerErreur(statut, undefined, msg, [], undefined, true);
      expect(e.code).toBe("surcharge");
    }
  });
  it.each([400, 402, 403])("statut %i avec « credit balance » reste facturation", async (statut) => {
    const { classerErreur } = await import("@/fournisseurs/claude/client");
    expect(classerErreur(statut, undefined, "Your credit balance is too low", [], undefined, true).code).toBe("facturation");
  });
});

describe("11. fiche sujet : le message de l'attente enregistrée passe avant « comptes épuisés »", () => {
  async function sujetEnAttente(attente: Record<string, unknown> | null) {
    const g = await nouvelleGeneration();
    await depots().generations.enregistrer({ ...g, statut: "en-attente-credit" });
    await depots().scriptsMaitres.enregistrer({ id: g.scriptMaitreId, brief: { idee: "PV" }, generationId: g.id } as never);
    if (attente) await ecrireParametre(`generateur.attenteCredit.${g.id}`, { depuis: new Date().toISOString(), estimationUsd: 1, lignes: [], ...attente });
    return g;
  }

  it("mode abonnements, attente « limite du mois » → le message de la limite, sans « épuisés »", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-fausse-cle-un-AAAA1111BBBB");
    const g = await sujetEnAttente({ motif: "plafond-mensuel", message: "Limite Claude du mois atteinte (100,00 $)." });
    const e = await (await import("@/services/boucle-generation")).etatEcriture(g.scriptMaitreId);
    expect(e?.abonnements).toBe(true);
    expect(e?.messageAttente).toContain("Limite Claude du mois atteinte");
    expect(e?.messageAttente).not.toMatch(/épuisés/);
  });

  it("dernier recours : motif facturation sans message enregistré → « Comptes Claude épuisés »", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-fausse-cle-un-AAAA1111BBBB");
    const g = await sujetEnAttente({ motif: "facturation", message: "" });
    const e = await (await import("@/services/boucle-generation")).etatEcriture(g.scriptMaitreId);
    expect(e?.messageAttente).toMatch(/Comptes Claude épuisés/);
  });
});

describe("12. comité : lot refusé en 402 hors flux, marque d'épuisement en panne", () => {
  it("→ {etat:\"arrete\"}, aucune exception, réservation libérée, avertissement sans clé", async () => {
    await ecrireParametre(comite.PARAM_COMITE, true);
    const idees = await import("@/services/source-idees");
    const sim = idees.sourceIdeesSimulee();
    idees.brancherSourceIdees({ nom: "Usine (essai)", simulee: false, tirer: (k) => sim.tirer(k) });
    afterEachNettoyer(() => idees.brancherSourceIdees(null));
    const CLE_LONGUE = "sk-ant-api03-essai-comite-0123456789";
    injecter((async () => reponseErreur(402, "billing_error", "Your credit balance is too low")) as typeof fetch, { "abonnement-1": CLE_LONGUE });
    const vrai = depots().parametres.enregistrer.bind(depots().parametres);
    vi.spyOn(depots().parametres, "enregistrer").mockImplementation((async (p: { id: string }) => {
      if (p.id.startsWith("claude.epuise.")) throw new Error(`base en panne, clé ${CLE_LONGUE}`);
      return vrai(p as never);
    }) as never);
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await comite.travaillerComite();
    expect(r).toMatchObject({ etat: "arrete" });
    const textes = avertir.mock.calls.map((c) => c.join(" "));
    expect(textes.some((t) => t.includes("marque d'épuisement non écrite"))).toBe(true);
    expect(textes.every((t) => !t.includes(CLE_LONGUE))).toBe(true);
    const res = await depots().reservations.lister(() => true);
    expect(res.filter((x) => x.statut === "active")).toHaveLength(0);
  });
});

describe("13. Connexions : la clé affichée et testée est la première clé d'abonnement posée", () => {
  const CLE_2 = "sk-ant-api03-compte-deux-wxyz";

  afterEach(() => vi.unstubAllEnvs());

  it("compte 1 absent, compte 2 posé → fin de clé du compte 2 (« …wxyz ») dans la vue", async () => {
    credits.injecterLecteursPourEssai(null);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY_2", CLE_2);
    vi.stubEnv("ANTHROPIC_API_KEY_3", "");
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", "");
    const ligne = (await credits.vueCles()).find((c) => c.fournisseur === "anthropic")!;
    expect(ligne.clePresente).toBe(true);
    expect(ligne.finCle).toBe("…wxyz");
  });

  it("« Tester la connexion » envoie la clé du compte 2 quand le compte 1 est absent", async () => {
    const vues: string[] = [];
    const f = (async (_u: string | URL | Request, init?: RequestInit) => {
      vues.push(new Headers(init?.headers).get("x-api-key") ?? "?");
      return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const r = await creerLecteurAnthropic({ ANTHROPIC_API_KEY_2: CLE_2 }, f).testerConnexion();
    expect(r.ok).toBe(true);
    expect(vues).toEqual([CLE_2]);
  });
});
