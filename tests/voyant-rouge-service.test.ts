/**
 * Voyant rouge : seconde confirmation AVANT la voix payante (lot E). Simulation, 0 €.
 * Refus doux « VOYANT_ROUGE » tant que Will n'a pas confirmé ; rien n'est créé ni payé ; la confirmation est gardée
 * dans `avisWill.malgreVoyant` ; jamais sur un script collé par Will (origine « will »).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const ecran = await import("@/services/generateur-ecran");
const bg = await import("@/services/boucle-generation");
const { GARDE_FOUS } = await import("@/domaine/controles-script/niveaux");
const actions = await import("@/app/(studio)/nouvelle/[format]/actions");
const { empreinte } = await import("@/domaine/relecture-script");
const { versionsCourantes } = await import("@/domaine/derivations-generateur");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
type ErreurStudio = import("@/services/_commun").ErreurStudio;

const MDP = "essai-voyant-rouge";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
// Le texte simulé lève au hasard de la génération des garde-fous sans rapport : seul C1 (un chiffre sans preuve) compte ici.
const GARDES = GARDE_FOUS as string[];
const GARDE_FOUS_REELS = [...GARDE_FOUS];
beforeEach(async () => {
  GARDES.splice(0, GARDES.length, "C1");
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  GARDES.splice(0, GARDES.length, ...GARDE_FOUS_REELS);
  bg.arreterBoucleGeneration();
});

async function sujetPret() {
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const vs = versionsCourantes(await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId));
  for (const v of vs) await depots().variantes.modifier(v.id, { etat: "validee", note: { ...v.note, globale: 95 }, controles: { ...v.controles, violations: [] } });
  return { sujetId: r.scriptMaitreId, versions: vs };
}
/** La trace du second oui : dans l'avis de Will s'il existe, sinon sur la version elle-même (jamais d'avis inventé). */
const traceDe = async (id: string) => {
  const v = (await depots().variantes.obtenir(id)) as unknown as { avisWill?: { malgreVoyant?: unknown }; malgreVoyant?: unknown };
  return v.avisWill?.malgreVoyant ?? v.malgreVoyant;
};
const avisDe = async (id: string) => ((await depots().variantes.obtenir(id)) as unknown as { avisWill?: unknown }).avisWill;
const rougir = (id: string, extra: Record<string, unknown> = {}) => depots().variantes.modifier(id, { note: { globale: 50, criteres: {} }, ...extra } as never);

describe("« relire puis lancer » : un voyant rouge demande un second oui", { timeout: 30_000 }, () => {
  it("rouge non confirmé : refus VOYANT_ROUGE avant toute dépense, rien créé", async () => {
    const { sujetId, versions } = await sujetPret();
    await rougir(versions[0].id);
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const avant = await depots().videos.compter();
    const e = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-r1" }).then(() => null, (x: ErreurStudio) => x);
    expect(e?.code).toBe("VOYANT_ROUGE");
    expect(e?.message).toMatch(/note de 50 sur 100/);
    expect(e?.message).not.toMatch(/voyant/i);
    expect(await depots().videos.compter()).toBe(avant);
  });

  it("rouge confirmé : la vidéo part et la confirmation est gardée dans avisWill.malgreVoyant", async () => {
    const { sujetId, versions } = await sujetPret();
    await rougir(versions[0].id);
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const r = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-r2", malgreVoyant: true });
    expect(r.videoId).toBeTruthy();
    expect(await traceDe(versions[0].id)).toMatchObject({ voyant: "rouge", note: 50 });
  });

  it("script collé par Will (origine « will ») : jamais de confirmation, jamais de trace", async () => {
    const { sujetId, versions } = await sujetPret();
    await rougir(versions[0].id, { origine: "will" });
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const r = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-r3" });
    expect(r.videoId).toBeTruthy();
    expect(await traceDe(versions[0].id)).toBeUndefined();
  });

  it("les N : une seule demande pour toutes les versions rouges, rien créé", async () => {
    const { sujetId, versions } = await sujetPret();
    await rougir(versions[0].id);
    await rougir(versions[1].id);
    const { lignes } = await ecran.lotARelire({ sujetId });
    const avant = await depots().videos.compter();
    const e = await ecran.fabriquerApresRelecture({ sujetId }, { lignes, empreinte: empreinte(lignes), operationId: "op-r4" }).then(() => null, (x: ErreurStudio) => x);
    expect(e?.code).toBe("VOYANT_ROUGE");
    expect(await depots().videos.compter()).toBe(avant);
  });
});

describe("voyant rouge : le contrôle suit le texte RELU et la trace suit le départ", { timeout: 30_000 }, () => {
  /** Une version « bonne note » dont le texte porte un garde-fou échoué (C1 : un chiffre sans preuve), par les vrais contrôles. */
  async function sujetAvecGardeFou() {
    const { sujetId, versions } = await sujetPret();
    const ancien = (await depots().scripts.obtenir(versions[0].scriptId))!;
    const blocs = structuredClone(ancien.blocs);
    blocs[0].segments[0].texte = "Et 42 clients ont tout perdu.";
    await gen.retoucherCorps(ancien.id, blocs);
    const courantes = versionsCourantes(await depots().variantes.lister((x) => x.scriptMaitreId === sujetId));
    for (const v of courantes) await depots().variantes.modifier(v.id, { etat: "validee", note: { ...v.note, globale: 95 } });
    return { sujetId, versions: courantes };
  }

  it("rouge par un garde-fou SEUL (bonne note 95 + garde-fou échoué) : refus, avec la vraie raison", async () => {
    const { sujetId, versions } = await sujetAvecGardeFou();
    expect(versions.every((v) => v.note.globale === 95)).toBe(true);
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const avant = await depots().videos.compter();
    const e = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-g1" }).then(() => null, (x: ErreurStudio) => x);
    expect(e?.code).toBe("VOYANT_ROUGE");
    expect(e?.message).toMatch(/règle importante n'est pas respectée dans la version/);
    expect(await depots().videos.compter()).toBe(avant);
  });

  it("le contrôle passe APRÈS les refus du texte relu (SCRIPT_A_RELIRE prime sur VOYANT_ROUGE)", async () => {
    const { sujetId, versions } = await sujetPret();
    await rougir(versions[0].id);
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const incomplet = lignes.slice(1);
    const e = await ecran.fabriquerApresRelecture(cible, { lignes: incomplet, empreinte: empreinte(incomplet), operationId: "op-g2" }).then(() => null, (x: ErreurStudio) => x);
    expect(e?.code).toBe("SCRIPT_A_RELIRE");
  });

  it("le garde-fou se juge sur le texte RELU : Will corrige la phrase fautive, la note étant bonne, plus de question", async () => {
    const { sujetId, versions } = await sujetAvecGardeFou();
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const fautive = lignes.find((l) => /42/.test(l.dit))!;
    const { appliquerSaisie } = await import("@/domaine/relecture-script");
    const relues = appliquerSaisie(lignes, fautive.id, { dit: "Et des clients ont tout perdu." });
    const r = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-g3" });
    expect(r.videoId).toBeTruthy();
  });

  it("la trace est écrite APRÈS le départ de la fabrication, avec les données de la version lue au départ", async () => {
    const { sujetId, versions } = await sujetPret();
    await rougir(versions[0].id);
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const d = depots();
    const avant = await d.videos.compter();
    const videosALaTrace: number[] = [];
    const modifier = d.variantes.modifier.bind(d.variantes);
    d.variantes.modifier = (async (id: string, patch: Record<string, unknown>) => {
      if ((patch.avisWill as { malgreVoyant?: unknown } | undefined)?.malgreVoyant || patch.malgreVoyant) videosALaTrace.push(await d.videos.compter());
      return modifier(id, patch as never);
    }) as typeof d.variantes.modifier;
    try {
      await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-g4", malgreVoyant: true });
    } finally {
      d.variantes.modifier = modifier as typeof d.variantes.modifier;
    }
    expect(videosALaTrace).toHaveLength(1);
    expect(videosALaTrace[0]).toBeGreaterThan(avant);
  });
});

describe("valider reste gratuit : le second oui se demande au lancement de la voix", { timeout: 30_000 }, () => {
  it("valider ou revalider une version garde sa trace malgreVoyant", async () => {
    const { versions } = await sujetPret();
    const trace = { voyant: "rouge", note: 50, gardeFous: [], le: "2026-10-18T10:00:00.000Z" };
    const avis = { resultat: "valide", le: "2026-10-01T10:00:00.000Z", malgreVoyant: trace };
    await depots().variantes.modifier(versions[0].id, { etat: "a-relire", avisWill: avis } as never);
    await depots().variantes.modifier(versions[1].id, { etat: "a-reverifier", avisWill: avis } as never);
    const v = (await gen.validerVariante(versions[0].id)) as { avisWill?: { malgreVoyant?: unknown } };
    expect(v.avisWill?.malgreVoyant).toEqual(trace);
    await gen.revaliderVariantes([versions[1].id]);
    const w = (await depots().variantes.obtenir(versions[1].id)) as unknown as { etat: string; avisWill?: { malgreVoyant?: unknown } };
    expect(w.etat).toBe("validee");
    expect(w.avisWill?.malgreVoyant).toEqual(trace);
  });
  it("validerVariante sur une version rouge : validée comme avant, sans refus ni trace", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id, { etat: "a-relire" });
    const v = (await gen.validerVariante(versions[0].id)) as { etat: string; avisWill?: { malgreVoyant?: unknown } };
    expect(v.etat).toBe("validee");
    expect(v.avisWill?.malgreVoyant).toBeUndefined();
  });
});

describe("assistant « Votre vidéo » : « Utiliser dans ma vidéo » depuis une version du générateur", { timeout: 30_000 }, () => {
  /** La vidéo v-03 de démonstration exige le repère « script relu » : on le donne, seul le voyant est en jeu. */
  async function lancer(version: string | undefined, malgreVoyant?: boolean) {
    const v = (await depots().videos.obtenir("v-03"))!;
    const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
    const relu = empreinteDesBlocs((await depots().scripts.obtenir(v.scriptId!))!.blocs);
    // La version d'origine est lue CÔTÉ SERVEUR dans les `entrees` de la vidéo (enregistrées avec le brouillon).
    await depots().videos.modifier("v-03", { entrees: { ...v.entrees, ...(version ? { varianteOrigineId: version } : {}) } });
    return actions.lancerFabricationAction("v-03", true, relu, { malgreVoyant });
  }

  it("version rouge non confirmée : VOYANT_ROUGE avant toute dépense, avec la vraie raison", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const avant = await depots().travaux.compter();
    const r = await lancer(versions[0].id);
    expect(r).toMatchObject({ ok: false, code: "VOYANT_ROUGE" });
    expect(r.ok ? "" : r.message).toMatch(/note de 50 sur 100/);
    expect(await depots().travaux.compter()).toBe(avant);
  });
  it("version rouge confirmée : la vidéo part", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    expect((await lancer(versions[0].id, true)).ok).toBe(true);
  });
  it("version rouge confirmée : trace écrite dans avisWill.malgreVoyant", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    expect((await lancer(versions[0].id, true)).ok).toBe(true);
    expect(await traceDe(versions[0].id)).toMatchObject({ voyant: "rouge", note: 50 });
  });
  it("version rouge, lancement refusé après le oui : aucune trace", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const video = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { entrees: { ...video.entrees, varianteOrigineId: versions[0].id } });
    const r = await actions.lancerFabricationAction("v-03", true, "empreinte-perimee", { malgreVoyant: true });
    expect(r.ok).toBe(false);
    expect(await traceDe(versions[0].id)).toBeUndefined();
  });
  it("brouillon rechargé ou rouvert depuis « Vidéos » : la question est quand même posée (l'écran ne donne plus rien)", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { entrees: { ...v.entrees, varianteOrigineId: versions[0].id } });
    const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
    const relu = empreinteDesBlocs((await depots().scripts.obtenir(v.scriptId!))!.blocs);
    const avant = await depots().travaux.compter();
    const r = await actions.lancerFabricationAction("v-03", true, relu);
    expect(r).toMatchObject({ ok: false, code: "VOYANT_ROUGE" });
    expect(await depots().travaux.compter()).toBe(avant);
  });
  it("une version d'origine annoncée par l'écran n'est pas crue : seule celle de la vidéo compte", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const v = (await depots().videos.obtenir("v-03"))!;
    const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
    const relu = empreinteDesBlocs((await depots().scripts.obtenir(v.scriptId!))!.blocs);
    const r = await actions.lancerFabricationAction("v-03", true, relu, { varianteOrigineId: versions[0].id } as { malgreVoyant?: boolean });
    expect(r.ok).toBe(true);
  });
  it("les refus du lancement passent AVANT la question : « script non relu », puis « accord manquant »", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const video = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { entrees: { ...video.entrees, varianteOrigineId: versions[0].id } });
    const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
    const relu = empreinteDesBlocs((await depots().scripts.obtenir(video.scriptId!))!.blocs);
    // 1. texte changé depuis la relecture : SCRIPT_NON_RELU, pas VOYANT_ROUGE
    expect(await actions.lancerFabricationAction("v-03", true, "empreinte-perimee")).toMatchObject({ ok: false, code: "SCRIPT_NON_RELU" });
    // 2. personne réelle sans accord : ACCORD_MANQUANT, pas VOYANT_ROUGE
    const pers = (await depots().personnages.lister()).find((p) => p.id === video.distribution[0]?.personnageId)!;
    await depots().personnages.modifier(pers.id, { nature: "reel", accord: undefined } as never);
    expect(await actions.lancerFabricationAction("v-03", true, relu)).toMatchObject({ ok: false, code: "ACCORD_MANQUANT" });
    // 3. tout est en règle : la question est posée
    await depots().personnages.modifier(pers.id, { nature: pers.nature, accord: pers.accord } as never);
    expect(await actions.lancerFabricationAction("v-03", true, relu)).toMatchObject({ ok: false, code: "VOYANT_ROUGE" });
  });
  it("version verte : aucune question", async () => {
    const { versions } = await sujetPret();
    expect((await lancer(versions[0].id)).ok).toBe(true);
  });
  it("texte collé (aucune version d'origine) : aucune question", async () => {
    await sujetPret();
    expect((await lancer(undefined)).ok).toBe(true);
  });
  it("script de Will (origine « will ») : jamais de question", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[1].id, { origine: "will" });
    expect((await lancer(versions[1].id)).ok).toBe(true);
  });
});

describe("crédit insuffisant après le oui « voyant » : la vidéo repart plus tard, le oui est gardé", { timeout: 30_000 }, () => {
  it("mise en attente puis relance : trace écrite au départ, pas avant", async () => {
    const credits = await import("@/services/credits");
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    const heygen = { solde: 0 };
    credits.injecterLecteursPourEssai([{
      fournisseur: "heygen", nom: "HeyGen", mode: "reel", urlRecharge: "https://app.heygen.com/settings/api", variableCle: "HEYGEN_API_KEY",
      async lireSolde() { return { fournisseur: "heygen", centimes: heygen.solde, devise: "USD", luLe: new Date().toISOString() }; },
      async testerConnexion() { return { ok: true, finCle: "…Zq7W", message: "ok", testeLe: new Date().toISOString() }; },
    }], ["heygen"]);
    try {
      const v = (await depots().videos.obtenir("v-03"))!;
      await depots().videos.modifier("v-03", { statut: "brouillon", entrees: { ...v.entrees, varianteOrigineId: versions[0].id } });
      const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
      const relu = empreinteDesBlocs((await depots().scripts.obtenir(v.scriptId!))!.blocs);
      const r = await actions.lancerFabricationAction("v-03", true, relu, { malgreVoyant: true });
      expect(r).toMatchObject({ ok: false, code: "CREDIT_INSUFFISANT" });
      const trace = () => traceDe(versions[0].id);
      expect(await trace()).toBeUndefined();
      await credits.garderEnAttente("v-03", { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, scriptRelu: relu, malgreVoyant: true });
      heygen.solde = 10_000_000;
      await credits.surveillerCredits({ force: true });
      expect((await credits.lancerVideosEnAttente()).lancees).toHaveLength(1);
      expect(await trace()).toMatchObject({ voyant: "rouge", note: 50 });
    } finally {
      credits.injecterLecteursPourEssai(null);
    }
  });
});

describe("la question « voyant » ne se pose pas pour une vidéo qui ne peut pas partir", { timeout: 30_000 }, () => {
  afterEach(() => vi.unstubAllEnvs());
  it("simulation en production : SIMULATION_EN_PRODUCTION passe avant VOYANT_ROUGE", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { entrees: { ...v.entrees, varianteOrigineId: versions[0].id } });
    const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
    const relu = empreinteDesBlocs((await depots().scripts.obtenir(v.scriptId!))!.blocs);
    for (const x of await depots().voix.lister()) await depots().voix.modifier(x.id, { fournisseur: "heygen" });
    await depots().videos.modifier("v-03", { estDemo: false });
    vi.stubEnv("NODE_ENV", "production");
    expect(await actions.lancerFabricationAction("v-03", true, relu)).toMatchObject({ ok: false, code: "SIMULATION_EN_PRODUCTION" });
  });
});

describe("la trace n'invente pas de validation", { timeout: 30_000 }, () => {
  it("« relire puis lancer » sur une version sans avis de Will : pas d'avisWill créé, la trace est à part", async () => {
    const { sujetId, versions } = await sujetPret();
    await rougir(versions[0].id);
    expect(await avisDe(versions[0].id)).toBeUndefined();
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-i1", malgreVoyant: true });
    expect(await avisDe(versions[0].id)).toBeUndefined();
    expect(await traceDe(versions[0].id)).toMatchObject({ voyant: "rouge", note: 50 });
  });
  it("« utiliser dans ma vidéo » sur une version sans avis de Will : pas d'avisWill créé", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const { garderOuiVoyantDeVersion } = await import("@/services/scripts");
    await garderOuiVoyantDeVersion(versions[0].id);
    expect(await avisDe(versions[0].id)).toBeUndefined();
    expect(await traceDe(versions[0].id)).toMatchObject({ voyant: "rouge", note: 50 });
  });
  it("avec un avis de Will existant : l'avis (résultat, date) est gardé tel quel, la trace est dedans", async () => {
    const { versions } = await sujetPret();
    const avis = { resultat: "valide", le: "2026-10-01T10:00:00.000Z" };
    await rougir(versions[0].id, { avisWill: avis });
    const { garderOuiVoyantDeVersion } = await import("@/services/scripts");
    await garderOuiVoyantDeVersion(versions[0].id);
    expect(await avisDe(versions[0].id)).toMatchObject({ ...avis, malgreVoyant: { voyant: "rouge" } });
  });
  it("la trace ne sert jamais de date de validation (série, usages)", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const { garderOuiVoyantDeVersion } = await import("@/services/scripts");
    await garderOuiVoyantDeVersion(versions[0].id);
    const v = (await depots().variantes.obtenir(versions[0].id))!;
    expect(v.avisWill?.le).toBeUndefined();
  });
});

describe("un travail déjà en cours ou en file pour la vidéo : aucune question", { timeout: 30_000 }, () => {
  it("double envoi : pas de second oui demandé, le travail existant est rendu, rien n'est écrit", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    const v = (await depots().videos.obtenir("v-03"))!;
    await depots().videos.modifier("v-03", { entrees: { ...v.entrees, varianteOrigineId: versions[0].id } });
    const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
    const relu = empreinteDesBlocs((await depots().scripts.obtenir(v.scriptId!))!.blocs);
    const premier = await actions.lancerFabricationAction("v-03", true, relu, { malgreVoyant: true });
    expect(premier.ok).toBe(true);
    const avant = await depots().travaux.compter();
    const second = await actions.lancerFabricationAction("v-03", true, relu);
    expect(second).toMatchObject({ ok: true });
    expect(await depots().travaux.compter()).toBe(avant);
  });
});
