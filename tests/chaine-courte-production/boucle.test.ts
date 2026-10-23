/**
 * CHAÎNE COURTE EN PRODUCTION · l'aiguillage de la boucle d'écriture (décision de Will, 15/10), en simulation : aucune
 * clé réelle, `fetch` interdit (faux Claude seulement), 0 $.
 *  - réglage `generateur.chaine` absent → chaîne courte (lot A5) ; « complete » → grande chaîne ; « courte » → 3 appels court-*, une version par réseau rangée
 *    (les réseaux en plus par le rôle `declinaison`) ; « je choisis » → toujours la grande ;
 *  - la chaîne est FIGÉE au lancement : un réglage changé en route ne la change pas ;
 *  - téléprompteur et trame remplis ; marqueurs posés (plus de faux rouges C6 / C31) ;
 *  - reprise après une attente sans refaire l'appel déjà payé ; supplément sans réécrire l'angle ;
 *  - pire cas de la chaîne figée : courte réservée sous 1,50 $, grande refusée avant le 1er appel ;
 *  - sortie inutilisable : échec technique, pas un manque de matière ;
 *  - dette #242 : le socle masque la liste GLOBALE des noms (chemin réel `donneesDe` → blocs en cache).
 */
import type { z } from "zod";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE, reponseFlux, fluxReussi } from "../helpers/g0";
import { executeurSimule } from "../helpers/g4";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Parcours de bout en bout (étape 0, boucle, rangement) : plus longs qu'un test unitaire.
vi.setConfig({ testTimeout: 30_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { ROLES_ECRITURE } = await import("@/generateur/roles");
const { ROLES_CHAINE_COURTE, ROLES_CHAINE_COURTE_HORS_RECETTE } = await import("@/generateur/chaine-courte");
const { jetonsEstimes } = await import("@/fournisseurs/claude/tarifs");
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { ExecuteurRoles, SortieExecution } from "@/generateur/chaine";
import type { Matiere, Preuve } from "@/domaine/types";

const MDP = "essai-chaine-courte-production";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
  gc.forcerChainePourEssai(null);
});

const S = SUJETS_BANC[0];
const brief = (extra: Partial<Parameters<typeof bg.lancerGeneration>[0] & object> = {}) => ({ idee: S.idee, reseaux: [...S.reseaux], formatId: "avocat", pilier: S.pilier.id, mode: "avatar" as const, ...extra });
const lancer = async (extra: Parameters<typeof brief>[0] = {}) => {
  const r = await bg.lancerGeneration(brief(extra));
  if (!r.ok) throw new Error(`lancement : ${r.ceQuIlFaudrait}`);
  return r;
};
const courte = () => ecrireParametre(bg.PARAM_CHAINE, "courte");
const options = async (id: string) => lireParametre<{ chaine?: string } | null>(`generateur.chaine-options.${id}`, null);
const roles = (appels: { role: string }[]) => appels.map((a) => a.role);
const compter = (appels: { role: string }[], id: string) => appels.filter((a) => a.role === id).length;

describe("aiguillage : la chaîne qui écrit, lue du réglage et figée au lancement", () => {
  it("réglage absent : la chaîne COURTE (défaut du code depuis le lot A5)", async () => {
    const r = await lancer();
    expect((await options(r.generationId))?.chaine).toBe("courte");
    const { executeur, appels } = executeurSimule();
    expect(await bg.tourBoucleGeneration(() => executeur)).toBe(r.generationId);
    expect(roles(appels)).toContain("court-angle");
    expect(roles(appels)).not.toContain("stratege");
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
  });

  it("réglage « complete » : la COURTE (la grande chaîne n'est plus choisie pour les nouvelles écritures)", async () => {
    await ecrireParametre(bg.PARAM_CHAINE, "complete");
    const r = await lancer();
    expect((await options(r.generationId))?.chaine).toBe("courte");
    const { executeur, appels } = executeurSimule();
    expect(await bg.tourBoucleGeneration(() => executeur)).toBe(r.generationId);
    expect(roles(appels)).toContain("court-angle");
    expect(roles(appels)).not.toContain("stratege");
  });

  it("grande chaîne forcée (essais seulement) : son code écrit encore, comme avant", async () => {
    gc.forcerChainePourEssai("grande");
    const r = await lancer();
    expect((await options(r.generationId))?.chaine).toBe("grande");
    const { executeur, appels } = executeurSimule();
    expect(await bg.tourBoucleGeneration(() => executeur)).toBe(r.generationId);
    expect(roles(appels)).toContain("stratege");
    expect(roles(appels).some((x) => x.startsWith("court-"))).toBe(false);
  });

  it("« courte », 3 réseaux : un appel de chaque court-*, 2 déclinaisons, écriture « terminee », 3 versions rangées", async () => {
    await courte();
    const r = await lancer();
    expect((await options(r.generationId))?.chaine).toBe("courte");
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect(S.reseaux).toHaveLength(3);
    expect(roles(appels)).toEqual(["court-angle", "court-script", "court-relecture", "declinaison", "declinaison"]);
    for (const id of ["court-angle", "court-script", "court-relecture"]) expect(compter(appels, id)).toBe(1);
    expect(compter(appels, "declinaison")).toBe(S.reseaux.length - 1);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
    expect(variantes.map((v) => v.reseau).sort()).toEqual([...S.reseaux].sort());
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    // 5 finalistes, la retenue en premier (celle du script).
    expect(m?.accrochesFinalistes?.length).toBeGreaterThan(1);
    expect(m?.accrochesFinalistes?.length).toBeLessThanOrEqual(5);
    expect(variantes.find((v) => v.reseau === S.reseaux[0])?.accrocheId).toBe(m?.accrochesFinalistes?.[0]?.id);
    expect(m?.angle?.probleme).toBeTruthy();
    // Les autres réseaux reçoivent la consigne d'une accroche différente de la 1re version.
    const dec = appels.filter((a) => a.role === "declinaison");
    expect(dec.every((a) => a.entree.variable.includes("DIFFÉRENTES de celles de la version"))).toBe(true);
  });

  it("« courte », 1 réseau : exactement 3 appels, aucune déclinaison", async () => {
    await courte();
    const r = await lancer({ reseaux: [S.reseaux[0]] });
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect(roles(appels)).toEqual(["court-angle", "court-script", "court-relecture"]);
    expect(await depots().variantes.compter((v) => v.scriptMaitreId === r.scriptMaitreId)).toBe(1);
  });

  it("« je choisis » : la chaîne du réglage (courte), plus jamais la grande ; aucune pause sur les angles", async () => {
    await courte();
    const m = await (await import("@/services/generateur")).creerSujet(brief());
    await depots().scriptsMaitres.modifier(m.id, { brief: { ...m.brief, modeChoix: "je-choisis" } });
    const r = await bg.lancerGeneration({ scriptMaitreId: m.id });
    if (!r.ok) throw new Error("lancement");
    expect((await options(r.generationId))?.chaine).toBe("courte");
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect(roles(appels)[0]).toBe("court-angle");
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
  });

  it("le réglage change en route : l'écriture finit sur la chaîne où elle a commencé (dans les deux sens)", async () => {
    await courte();
    const a = await lancer({ reseaux: [S.reseaux[0]] });
    gc.forcerChainePourEssai("grande");
    const b = await lancer({ idee: SUJETS_BANC[1].idee, reseaux: [SUJETS_BANC[1].reseaux[0]], pilier: SUJETS_BANC[1].pilier.id });
    gc.forcerChainePourEssai(null);
    await courte();
    const sa = executeurSimule();
    expect(await bg.tourBoucleGeneration(() => sa.executeur)).toBe(a.generationId);
    expect(roles(sa.appels)).toEqual(["court-angle", "court-script", "court-relecture"]);
    const sb = executeurSimule();
    expect(await bg.tourBoucleGeneration(() => sb.executeur)).toBe(b.generationId);
    expect(roles(sb.appels)).toContain("stratege");
    expect(roles(sb.appels).some((x) => x.startsWith("court-"))).toBe(false);
  });
});

describe("ce que la courte n'écrit pas, rempli par le code", () => {
  it("face caméra au téléprompteur : le téléprompteur de chaque version est rempli", async () => {
    await courte();
    const r = await lancer({ mode: "teleprompteur" });
    const { executeur } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
    expect(variantes).toHaveLength(3);
    for (const v of variantes) expect(v.prompteur?.split("\n").length).toBeGreaterThan(3);
  });

  it("à la trame : la trame de chaque version est remplie (repères, accroche et appel au mot près)", async () => {
    await courte();
    const r = await lancer({ mode: "trame" });
    const { executeur } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
    expect(variantes).toHaveLength(3);
    for (const v of variantes) {
      expect(v.trame?.reperes.length).toBeGreaterThan(0);
      expect(v.trame?.verbatim.accroche).toBe(v.ouverture[0].segments[0].texte);
      expect(v.trame?.verbatim.appel).toBe(v.appel.texte);
    }
  });

  const sansMarqueurAbsent = (violations: { controle: string; message: string }[]) => {
    expect(violations.filter((x) => x.controle === "C6" && /Aucune livraison marquée/.test(x.message))).toEqual([]);
    expect(violations.filter((x) => x.controle === "C31" && /Aucun segment ne cite fidèlement/.test(x.message))).toEqual([]);
  };

  it("sorties simulées : livraison et ancrage marqués, aucun « marqueur absent » en C6 / C31", async () => {
    await courte();
    const r = await lancer();
    const { executeur } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    const script = (await depots().scripts.lister((s) => s.scriptMaitreId === r.scriptMaitreId))[0];
    const marqueurs = script.blocs.flatMap((b) => b.segments.flatMap((s) => s.marqueurs ?? []));
    expect(marqueurs).toContain("livraison");
    expect(marqueurs).toContain("ancrage");
    for (const v of await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId)) sansMarqueurAbsent(v.controles.violations);
  });

  it("script SANS aucun marqueur (Claude les oublie) : le repli du code pose livraison et ancrage, coût sur l'accroche", async () => {
    await courte();
    const r = await lancer({ reseaux: [S.reseaux[0]] });
    const { executeur } = executeurSimule({
      "court-script": (e: EntreeRole) => {
        const s = ROLES_CHAINE_COURTE.script.simuler(e) as { segments: { marqueurs: string[] }[]; marqueursAccroche?: string[] };
        return { ...s, marqueursAccroche: undefined, segments: s.segments.map((x) => ({ ...x, marqueurs: [] })) };
      },
    });
    await bg.tourBoucleGeneration(() => executeur);
    const script = (await depots().scripts.lister((s) => s.scriptMaitreId === r.scriptMaitreId))[0];
    const marqueurs = script.blocs.flatMap((b) => b.segments.flatMap((s) => s.marqueurs ?? []));
    expect(marqueurs.filter((x) => x === "livraison")).toHaveLength(1);
    expect(marqueurs).toContain("ancrage");
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
    expect(v.ouverture[0].segments[0].marqueurs).toContain("cout");
    sansMarqueurAbsent(v.controles.violations);
  });

  it("intentions d'illustration choisies par le code (la recette avocat les accepte) ; aucune incrustation fabriquée", async () => {
    await courte();
    const r = await lancer();
    const { executeur } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    const segs = (await depots().scripts.lister((s) => s.scriptMaitreId === r.scriptMaitreId))[0].blocs.flatMap((b) => b.segments);
    expect(segs.every((s) => !s.incrustation)).toBe(true);
    expect(segs.filter((s) => s.intentionIllustration).length).toBeLessThanOrEqual(Math.max(1, Math.round(segs.length / 3)));
  });

  it("écran d'attente : les 4 étapes de la chaîne courte et leur libellé", async () => {
    await courte();
    const r = await lancer();
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.etapes).toEqual([1, 2, 3, 4]);
    expect(e?.libelle).toBe("L'angle et les accroches");
    await bg.tourBoucleGeneration(() => executeurSimule().executeur);
    expect((await bg.etatEcriture(r.scriptMaitreId))?.etape).toBe(4);
  });
});

describe("reprise et suppléments : rien n'est repayé", () => {
  it("attente de crédit au script : la reprise repart de l'étape 1 sans refaire l'appel « court-angle »", async () => {
    await courte();
    const r = await lancer({ reseaux: [S.reseaux[0]] });
    let bloque = true;
    const appels: string[] = [];
    const base = executeurSimule().executeur;
    const executeur: ExecuteurRoles = {
      async executer<T extends z.ZodType>(role: DefinitionRole<T>, entree: EntreeRole): Promise<SortieExecution<z.infer<T>>> {
        appels.push(role.id);
        if (role.id === "court-script" && bloque) return { ok: false, arret: "en-attente-credit", message: "Crédit Claude épuisé." };
        return base.executer(role, entree);
      },
    };
    await bg.tourBoucleGeneration(() => executeur);
    expect(appels).toEqual(["court-angle", "court-script"]);
    expect((await bg.lireEtatChaine(r.generationId))?.etape).toBe(1);
    bloque = false;
    await bg.tourBoucleGeneration(() => executeur);
    expect(appels).toEqual(["court-angle", "court-script", "court-script", "court-relecture"]);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
  });

  it("supplément (« + Tu ») sur la chaîne courte : aucun « court-angle », l'angle et le fond sont repris", async () => {
    await courte();
    const r = await lancer({ reseaux: [S.reseaux[0]] });
    await bg.tourBoucleGeneration(() => executeurSimule().executeur);
    const avant = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    const fondAvant = (await bg.lireEtatChaine(r.generationId))?.fond;
    const s = await bg.ajouterDeclinaison(r.scriptMaitreId, { adresse: "tu" });
    if (!s.ok) throw new Error("supplément");
    const { executeur, appels } = executeurSimule();
    expect(await bg.tourBoucleGeneration(() => executeur)).toBe(s.generationId);
    expect(roles(appels)).toEqual(["court-script", "court-relecture"]);
    expect((await depots().generations.obtenir(s.generationId))?.statut).toBe("terminee");
    expect((await bg.lireEtatChaine(s.generationId))?.fond?.motCle).toBe(fondAvant?.motCle);
    expect((await depots().scriptsMaitres.obtenir(r.scriptMaitreId))?.angle?.titre).toBe(avant?.angle?.titre);
    expect(await depots().variantes.compter((v) => v.scriptMaitreId === r.scriptMaitreId && v.code.endsWith("-T"))).toBe(1);
  });

  it("supplément vers le « vous » depuis un sujet au « tu » : les accroches sont réécrites (« court-angle »), l'angle d'origine gardé", async () => {
    await courte();
    const r = await lancer({ reseaux: [S.reseaux[0]], adresse: "tu" });
    await bg.tourBoucleGeneration(() => executeurSimule().executeur);
    const angle = (await bg.lireEtatChaine(r.generationId))?.stratege?.angles[0];
    const s = await bg.ajouterDeclinaison(r.scriptMaitreId, { adresse: "vous" });
    if (!s.ok) throw new Error("supplément");
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect(roles(appels)).toEqual(["court-angle", "court-script", "court-relecture"]);
    // L'angle d'origine est donné à Claude et gardé tel quel.
    expect(appels[0].entree.variable).toContain("<angle_retenu>");
    const e = await bg.lireEtatChaine(s.generationId);
    expect(e?.stratege?.angles).toEqual([angle]);
    expect((await depots().generations.obtenir(s.generationId))?.statut).toBe("terminee");
  });

  it("sortie inutilisable : échec TECHNIQUE (« Reprendre l'écriture »), jamais un manque de matière", async () => {
    await courte();
    const r = await lancer({ reseaux: [S.reseaux[0]] });
    let casse = true;
    const base = executeurSimule().executeur;
    const executeur: ExecuteurRoles = {
      async executer<T extends z.ZodType>(role: DefinitionRole<T>, entree: EntreeRole): Promise<SortieExecution<z.infer<T>>> {
        if (role.id === "court-script" && casse) return { ok: true, invalide: "JSON illisible", coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
        return base.executer(role, entree);
      },
    };
    await bg.tourBoucleGeneration(() => executeur);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("echec");
    const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
    expect(m?.manque).toBeUndefined();
    const arret = await bg.ecritureArretee(r.scriptMaitreId);
    expect(arret?.message).toMatch(/inutilisable/);
    expect(arret?.message).toMatch(/Ce n'est pas une matière qui manque/);
    expect((await bg.lireEtatChaine(r.generationId))?.arret).toBeUndefined();
    casse = false;
    expect(await bg.reprendreEcritureArretee(r.scriptMaitreId)).toBe(true);
    await bg.tourBoucleGeneration(() => executeur);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
  });
});

/** Faux Claude FACTURÉ AU PIRE (même règle que `garde-fous-budget-relecture`) : toute l'entrée, `maxTokens` en sortie. */
function claudeAuPire(liste: DefinitionRole[]) {
  const appels: string[] = [];
  const vus = new Set<string>();
  const f = (async (_url: string | URL | Request, init?: RequestInit) => {
    const brut = String(init?.body ?? "{}");
    const corps = JSON.parse(brut) as { system: { text: string; cache_control?: unknown }[]; messages: { content: string }[] };
    const consigne = corps.system.at(-1)!.text;
    const role = liste.find((r) => consigne.startsWith(r.consigne.trim()))!;
    appels.push(role.id);
    const bloc = (b: string) => corps.system.find((x) => x.text.startsWith(`<${b}>`))?.text.replace(new RegExp(`^<${b}>\\n|\\n</${b}>$`, "g"), "");
    const sortie = role.simuler({ contexte: { contexteAxion: bloc("contexte_axion"), styleWill: bloc("style_will"), preuves: bloc("preuves"), gagnants: bloc("gagnants") }, variable: corps.messages[0].content });
    const total = jetonsEstimes(brut);
    const socle = vus.has(role.id) ? 0 : jetonsEstimes(corps.system.filter((b) => b.cache_control).map((b) => b.text).join("\n"));
    vus.add(role.id);
    return reponseFlux(fluxReussi({ texte: JSON.stringify(sortie), modele: role.modele, entree: total - socle, cacheEcrit: socle, cacheLu: 0, sortie: role.maxTokens }));
  }) as typeof fetch;
  return { fetch: f, appels };
}

describe("pire cas de la chaîne figée, plafond par défaut (1,50 $)", () => {
  async function brancher(liste: DefinitionRole[]) {
    credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
    await credits.declarerRecharge("anthropic", 100_000);
    await ecrireParametre("fournisseur.script", "claude");
    const claude = claudeAuPire(liste);
    gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: claude.fetch, attenteMs: () => 0 });
    return claude;
  }

  it("courte, 3 réseaux, facturée au pire : réservée sous 1,50 $, elle va au bout (3 + 2 appels), dépense ≤ pire cas", async () => {
    await courte();
    const claude = await brancher([...Object.values(ROLES_CHAINE_COURTE), ...Object.values(ROLES_CHAINE_COURTE_HORS_RECETTE), ROLES_ECRITURE.declinaison] as DefinitionRole[]);
    const r = await lancer();
    expect((await depots().generations.obtenir(r.generationId))?.plafondUsd).toBe(1.5);
    await bg.tourBoucleGeneration();
    const reserve = await gc.lireReserveChaine(r.generationId);
    expect(reserve).toMatchObject({ accepte: true, chaine: "courte", reglage: "generateur.plafondSujetUsd", plafondUsd: 1.5 });
    expect(reserve!.pireCasUsd).toBeLessThanOrEqual(1.5);
    expect(claude.appels).toEqual(["court-angle", "court-script", "court-relecture", "declinaison", "declinaison"]);
    const g = (await depots().generations.obtenir(r.generationId))!;
    expect(g.statut).toBe("terminee");
    expect(gc.depenseGenerationUsd(g)).toBeLessThanOrEqual(reserve!.pireCasUsd);
    expect(await depots().variantes.compter((v) => v.scriptMaitreId === r.scriptMaitreId)).toBe(3);
  }, 60_000);

  it("face caméra : courte, 3 réseaux, facturée au pire : réservée sous 1,50 $, elle va au bout (3 + 2 appels), dépense ≤ pire cas", async () => {
    await courte();
    const claude = await brancher([...Object.values(ROLES_CHAINE_COURTE), ...Object.values(ROLES_CHAINE_COURTE_HORS_RECETTE), ROLES_ECRITURE.declinaison] as DefinitionRole[]);
    const r = await lancer({ formatId: "facecam" });
    expect((await depots().generations.obtenir(r.generationId))?.plafondUsd).toBe(1.5);
    await bg.tourBoucleGeneration();
    const reserve = await gc.lireReserveChaine(r.generationId);
    expect(reserve).toMatchObject({ accepte: true, chaine: "courte", reglage: "generateur.plafondSujetUsd", plafondUsd: 1.5 });
    expect(reserve!.pireCasUsd).toBeLessThanOrEqual(1.5);
    expect(claude.appels).toEqual(["court-angle", "court-script", "court-relecture", "declinaison", "declinaison"]);
    const g = (await depots().generations.obtenir(r.generationId))!;
    expect(g.statut).toBe("terminee");
    expect(gc.depenseGenerationUsd(g)).toBeLessThanOrEqual(reserve!.pireCasUsd);
    expect(await depots().variantes.compter((v) => v.scriptMaitreId === r.scriptMaitreId)).toBe(3);
  }, 60_000);

  // Relecture finale A09 : sur la courte, le plafond d'un supplément est le réglage du sujet (1,50 $ par défaut, voir
  // `supplements-plafond.test.ts`) ; abaissé sous le pire cas, le refus nomme ce réglage.
  it("supplément « + Je lis » sur 3 réseaux, facturé au pire, réglage abaissé à 0,70 $ : refusé AVEC le réglage à relever ; relevé, il va au bout", async () => {
    await courte();
    const claude = await brancher([...Object.values(ROLES_CHAINE_COURTE), ...Object.values(ROLES_CHAINE_COURTE_HORS_RECETTE), ROLES_ECRITURE.declinaison] as DefinitionRole[]);
    const r = await lancer();
    await bg.tourBoucleGeneration();
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, 0.7);
    const s = await bg.ajouterDeclinaison(r.scriptMaitreId, { mode: "teleprompteur" });
    if (!s.ok) throw new Error("supplément");
    const avant = claude.appels.length;
    await bg.tourBoucleGeneration();
    expect((await depots().generations.obtenir(s.generationId))?.statut).toBe("plafond-atteint");
    expect(claude.appels.length).toBe(avant);
    const refus = (await gc.lireReserveChaine(s.generationId))!;
    expect(refus).toMatchObject({ accepte: false, plafondUsd: 0.7, reglage: gc.PARAM_PLAFOND_SUJET });
    // Plus d'impasse : le bouton dit quel réglage relever, et une fois relevé la reprise part au prix confirmé.
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.reprise).toMatchObject({ possible: false });
    expect(e?.reprise?.raison).toContain(gc.PARAM_PLAFOND_SUJET);
    await ecrireParametre(gc.PARAM_PLAFOND_SUJET, Math.ceil(refus.pireCasUsd * 100) / 100);
    expect((await bg.etatEcriture(r.scriptMaitreId))?.reprise).toMatchObject({ possible: true });
    const err = await bg.reprendreEcriture(r.scriptMaitreId).catch((x) => x);
    expect(err).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await bg.reprendreEcriture(r.scriptMaitreId, err.montant)).toBe(1);
    await bg.tourBoucleGeneration();
    const g = (await depots().generations.obtenir(s.generationId))!;
    expect(g.statut).toBe("terminee");
    expect(claude.appels.slice(avant)).toEqual(["court-script", "court-relecture", "declinaison", "declinaison"]);
    expect(gc.depenseGenerationUsd(g)).toBeLessThanOrEqual(refus.pireCasUsd);
  }, 60_000);

  it("grande (réglage « complete ») : pire cas au-dessus du plafond, refusée AVANT le 1er appel", async () => {
    gc.forcerChainePourEssai("grande");
    const claude = await brancher(Object.values(ROLES_ECRITURE) as DefinitionRole[]);
    const r = await lancer();
    await bg.tourBoucleGeneration();
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("plafond-atteint");
    expect(await gc.lireReserveChaine(r.generationId)).toMatchObject({ accepte: false, chaine: "grande", reglage: "generateur.plafondGrandeChaineUsd" });
    expect(claude.appels).toHaveLength(0);
  });
});

describe("dette #242 : la liste globale des noms sensibles est transmise au générateur", () => {
  it("chemin réel (lancement → boucle → blocs en cache) : un nom sensible d'une matière hors du sujet est masqué dans le socle", async () => {
    // Une limite propre à UN AUTRE sujet (jamais lue pour celui-ci) porte un nom sensible ; une preuve le cite.
    const le = new Date().toISOString();
    const autre: Matiere = { ...S.matieres[0], id: "m-limite-autre", type: "limite", texte: "Garnier Transports ne l'a pas fait.", nomsSensibles: ["Garnier Transports"], source: { origine: "dictee", detail: "Limite validée pour le sujet sujet-autre", date: le } } as Matiere;
    await depots().matieres.enregistrer(autre);
    const p = SUJETS_BANC.flatMap((x) => x.preuves)[0];
    await depots().preuves.modifier(p.id, { enonce: `${p.enonce} Chez Garnier Transports aussi.` } as Partial<Preuve>);
    await courte();
    await lancer({ reseaux: [S.reseaux[0]] });
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect(appels.length).toBeGreaterThan(0);
    for (const a of appels) expect(JSON.stringify(a.entree.contexte)).not.toContain("Garnier Transports");
  });

  it("partie variable (idée du sujet, matières) : masquée sur la même liste globale (relecture A09, dette 1)", async () => {
    const le = new Date().toISOString();
    const autre: Matiere = { ...S.matieres[0], id: "m-limite-autre", type: "limite", texte: "Garnier Transports ne l'a pas fait.", nomsSensibles: ["Garnier Transports"], source: { origine: "dictee", detail: "Limite validée pour le sujet sujet-autre", date: le } } as Matiere;
    await depots().matieres.enregistrer(autre);
    await courte();
    await lancer({ idee: `${S.idee} (vu chez Garnier Transports)`, reseaux: [S.reseaux[0]] });
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect(appels.length).toBeGreaterThan(0);
    for (const a of appels) expect(a.entree.variable).not.toContain("Garnier Transports");
  });
});
