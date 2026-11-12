/**
 * Relire et modifier le script avant la vidéo, GRANDE CHAÎNE (briques 4 et 5), côté serveur. Simulation, 0 €.
 * - Une retouche relance les VRAIS contrôles (avant : `reporterCorps` écrivait « tout passe », `retoucherVariante` ne
 *   contrôlait rien), au barème « will » pour les phrases de Will, « machine » pour les autres ;
 * - contrôle en direct GRATUIT (session exigée), enregistrement en lot, version modifiée « à valider » ;
 * - la fabrication ne part JAMAIS sans le repère « script relu » (empreinte du texte relu) ; une relance légitime
 *   (même opération) reprend le repère déjà donné.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { matiere, preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Ces tests portent sur la relecture, le prix et le budget, pas sur le voyant rouge (voir tests/voyant-rouge-service) :
// le texte simulé lève des garde-fous au hasard de la génération, la seconde confirmation est donc neutralisée ici.
vi.mock("@/domaine/voyant-rouge", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/domaine/voyant-rouge")>()), demandeConfirmationVoyant: () => null }));
/**
 * Pré-vol de l'argent observé (08/11 : le budget et le prix ne bloquent plus) : chaque total contrôlé est noté ; `refuserUneFois`
 * simule un crédit réel insuffisant (HeyGen, qui reste bloquant) pour arrêter un lancement juste après la mesure du prix.
 */
const prevol = vi.hoisted(() => ({ totaux: [] as number[], refuserUneFois: false }));
vi.mock("@/services/credits", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/services/credits")>();
  const { ErreurStudio } = await import("@/services/_commun");
  return {
    ...vrai,
    verifierBudgetEtCredits: async (...args: Parameters<typeof vrai.verifierBudgetEtCredits>) => {
      prevol.totaux.push(args[0].total.centimes);
      if (prevol.refuserUneFois) {
        prevol.refuserUneFois = false;
        throw new ErreurStudio("CREDIT_INSUFFISANT", "Crédit HeyGen insuffisant (essai).");
      }
      return vrai.verifierBudgetEtCredits(...args);
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gen = await import("@/services/generateur");
const ecran = await import("@/services/generateur-ecran");
const bg = await import("@/services/boucle-generation");
const { VERSION_CONTROLES } = await import("@/domaine/controles-script");
const { appliquerSaisie, empreinte } = await import("@/domaine/relecture-script");
const { versionsCourantes } = await import("@/domaine/derivations-generateur");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
type ErreurStudio = import("@/services/_commun").ErreurStudio;
type VarianteReseau = import("@/domaine/types").VarianteReseau;
/** Niveau d'un contrôle levé sur une version (G3 : chaque violation porte son niveau). */
const niveau = (v: VarianteReseau, code: string, filtre: (message: string) => boolean = () => true) => (v.controles.violations as import("@/domaine/controles-script").ViolationControle[]).find((x) => x.controle === code && filtre(x.message))?.niveau;

const MDP = "essai-relecture-generateur";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  prevol.totaux.length = 0;
  prevol.refuserUneFois = false;
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
});
afterEach(() => bg.arreterBoucleGeneration());

async function sujetSimule(reseaux: ("tiktok" | "instagram" | "linkedin")[] = ["tiktok", "linkedin"]) {
  await depots().matieres.enregistrer(matiere("La première fois que j'ai vu ses tableaux, j'ai compté 47 onglets."));
  const s = await gen.creerSujet({ idee: "ChatGPT peut-il lire vos factures ?", reseaux, formatId: "avocat", motCle: "factures ChatGPT" });
  const r = await gen.ecrireSujetSimule(s.id);
  if (!r.ok) throw new Error(r.message);
  return { s, r, variantes: await depots().variantes.lister((v) => v.scriptMaitreId === s.id) };
}

/** Sujet écrit par la chaîne (simulée), versions validées : prêt à fabriquer. */
async function sujetPretAFabriquer() {
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const vs = versionsCourantes(await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId));
  for (const v of vs) await depots().variantes.modifier(v.id, { etat: "validee" });
  return { sujetId: r.scriptMaitreId, versions: vs };
}

describe("une retouche relance les vrais contrôles", () => {
  it("retoucherVariante : contrôles refaits ; une salutation de la machine bloque, la même écrite par Will non", async () => {
    const { variantes } = await sujetSimule(["tiktok"]);
    const v = variantes[0];
    const accroche = (ecritPar?: "will") => [{ ...v.ouverture[0], segments: [{ ...v.ouverture[0].segments[0], texte: "Bonjour, ChatGPT lit-il vos factures ?", ...(ecritPar ? { ecritPar } : {}) }, ...v.ouverture[0].segments.slice(1)] }, ...v.ouverture.slice(1)];
    const machine = await gen.retoucherVariante(v.id, { ouverture: accroche() });
    expect(machine.controles.versionControles).toBe(VERSION_CONTROLES);
    expect(niveau(machine, "C3 bis")).toBe("bloquant");
    const will = await gen.retoucherVariante(v.id, { ouverture: accroche("will") });
    expect(niveau(will, "C3 bis")).toBe("info");
    expect(will.etat).toBe("a-relire");
  });

  it("reporterCorps : les versions reportées sont vraiment contrôlées (plus de « tout passe » écrit d'office)", async () => {
    const { r } = await sujetSimule();
    const ancien = (await depots().scripts.obtenir(r.scriptIds[0]))!;
    const blocs = structuredClone(ancien.blocs);
    blocs[0].segments[0].texte = "Et 42 clients ont tout perdu.";
    const { reportees } = await gen.retoucherCorps(ancien.id, blocs);
    for (const id of reportees) {
      const v = (await depots().variantes.obtenir(id))!;
      expect(v.controles.versionControles).toBe(VERSION_CONTROLES);
      expect(niveau(v, "C1", (m) => m.includes("42"))).toBe("bloquant");
    }
  });
});

describe("contrôle en direct et enregistrement en lot", () => {
  it("contrôler le texte relu est GRATUIT : rien n'est enregistré ; la phrase de Will est lue au barème « will »", async () => {
    const { s, variantes } = await sujetSimule(["tiktok"]);
    const cible = { sujetId: s.id, varianteId: variantes[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const avant = await depots().variantes.compter();
    const relues = appliquerSaisie(lignes, lignes[0].id, { dit: "Bonjour, ChatGPT lit-il vos factures ?" });
    const p = await ecran.controlerRelecture(cible, relues);
    expect(p.find((x) => x.code === "C3 bis")).toMatchObject({ niveau: "info", ligneId: lignes[0].id });
    expect(await depots().variantes.compter()).toBe(avant);
    expect(await depots().generations.compter()).toBe(1);
  });

  it("session exigée", async () => {
    const { s, variantes } = await sujetSimule(["tiktok"]);
    const { lignes } = await ecran.lotARelire({ sujetId: s.id, varianteId: variantes[0].id });
    await auth.seDeconnecter();
    await expect(ecran.controlerRelecture({ sujetId: s.id, varianteId: variantes[0].id }, lignes)).rejects.toBeTruthy();
  });

  it("enregistrer : une phrase du milieu change une fois ; la version redevient « à relire », les autres sont dites à revoir", async () => {
    const { s, variantes } = await sujetSimule(["tiktok", "linkedin"]);
    for (const v of variantes) await gen.validerVariante(v.id);
    const tt = variantes.find((v) => v.reseau === "tiktok")!;
    const cible = { sujetId: s.id, varianteId: tt.id };
    const { lignes } = await ecran.lotARelire(cible);
    const milieu = lignes.find((l) => l.id.startsWith("c:"))!;
    const r = await ecran.enregistrerRelecture(cible, appliquerSaisie(lignes, milieu.id, { dit: "Un milieu réécrit par Will." }));
    expect(r.aRevoir).toBe(1);
    expect(r.phrase).toMatch(/milieu/i);
    const courantes = versionsCourantes(await depots().variantes.lister((v) => v.scriptMaitreId === s.id));
    expect(courantes.find((v) => v.reseau === "tiktok")?.etat).toBe("a-relire");
    expect(courantes.find((v) => v.reseau === "linkedin")?.etat).toBe("a-reverifier");
    const script = (await depots().scripts.obtenir(courantes[0].scriptId))!;
    expect(script.blocs.flatMap((b) => b.segments).find((g) => g.texte === "Un milieu réécrit par Will.")?.ecritPar).toBe("will");
    // Renvoyer le même texte n'enregistre rien de plus.
    const n = await depots().variantes.compter();
    await ecran.enregistrerRelecture({ sujetId: s.id, varianteId: courantes.find((v) => v.reseau === "tiktok")!.id }, (await ecran.lotARelire({ sujetId: s.id, varianteId: courantes.find((v) => v.reseau === "tiktok")!.id })).lignes);
    expect(await depots().variantes.compter()).toBe(n);
  });

  it("une version « je lis » modifiée : son téléprompteur suit le texte", async () => {
    const { s, variantes } = await sujetSimule(["tiktok"]);
    const v = variantes[0];
    await depots().variantes.modifier(v.id, { prompteur: "ancien" });
    const cible = { sujetId: s.id, varianteId: v.id };
    const { lignes } = await ecran.lotARelire(cible);
    await ecran.enregistrerRelecture(cible, appliquerSaisie(lignes, lignes[0].id, { dit: "Une accroche dite par Will." }));
    const [courante] = versionsCourantes(await depots().variantes.lister((x) => x.scriptMaitreId === s.id));
    expect(courante.prompteur).toContain("Une accroche dite par Will.");
  });
});

// Première écriture par la chaîne simulée du fichier : chargement des modules (plusieurs secondes).
describe("la fabrication ne part jamais sans le repère « script relu »", { timeout: 30_000 }, () => {
  it("sans repère, ou avec un repère d'un autre texte : refus, rien n'est créé", async () => {
    const { sujetId, versions } = await sujetPretAFabriquer();
    const v = versions[0];
    const cible = { sujetId, varianteId: v.id };
    const { lignes } = await ecran.lotARelire(cible);
    const avant = await depots().videos.compter();
    const sans = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: "", operationId: "op-1" }).then(() => null, (e: ErreurStudio) => e);
    expect(sans?.code).toBe("SCRIPT_A_RELIRE");
    const autre = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(appliquerSaisie(lignes, lignes[0].id, { dit: "Autre chose." })), operationId: "op-2" }).then(() => null, (e: ErreurStudio) => e);
    expect(autre?.code).toBe("SCRIPT_A_RELIRE");
    expect(await depots().videos.compter()).toBe(avant);
  });

  it("texte relu tel quel : la vidéo part ; la relance de la même opération reprend le repère sans le redemander", async () => {
    const { sujetId, versions } = await sujetPretAFabriquer();
    const cible = { sujetId, varianteId: versions[0].id };
    const { lignes } = await ecran.lotARelire(cible);
    const r = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-ok" });
    expect(r.videoId).toBeTruthy();
    const encore = await ecran.fabriquerApresRelecture(cible, { lignes: [], empreinte: "", operationId: "op-ok" });
    expect(encore.videoId).toBe(r.videoId);
  });

  it("texte modifié à la relecture : enregistré, validé par le geste de Will, et c'est CE texte qui part", async () => {
    const { sujetId, versions } = await sujetPretAFabriquer();
    const v = versions[0];
    const cible = { sujetId, varianteId: v.id };
    const { lignes } = await ecran.lotARelire(cible);
    const relues = appliquerSaisie(lignes, lignes[0].id, { dit: "Une accroche relue par Will." });
    const r = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-mod" });
    const video = (await depots().videos.obtenir(r.videoId!))!;
    const courante = (await depots().variantes.obtenir(video.varianteId!))!;
    expect(courante.ouverture.flatMap((b) => b.segments).find((g) => g.texte.trim())?.texte).toBe("Une accroche relue par Will.");
    expect(courante).toMatchObject({ code: v.code, etat: "validee", videoId: video.id });
  });

  it("budget dépassé, texte modifié : aucun refus (décision du 08/11), le texte relu est enregistré, validé, et part", async () => {
    const { sujetId, versions } = await sujetPretAFabriquer();
    const v = versions[0];
    const cible = { sujetId, varianteId: v.id };
    const { lignes } = await ecran.lotARelire(cible);
    const milieu = lignes.find((l) => l.id.startsWith("c:"))!;
    const relues = appliquerSaisie(lignes, milieu.id, { dit: "Un milieu réécrit par Will avant la vidéo." });
    const videosAvant = await depots().videos.compter();
    await ecrireParametre("budget.mensuel", { centimes: 1, devise: "EUR" });
    const r = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-budget" });
    expect(r.videoId).toBeTruthy();
    expect(r.enAttente).toBeUndefined();
    expect(await depots().videos.compter()).toBeGreaterThan(videosAvant);
    const courante = (await depots().variantes.obtenir((await depots().videos.obtenir(r.videoId!))!.varianteId!))!;
    expect(courante).toMatchObject({ code: v.code, etat: "validee" });
    const script = (await depots().scripts.obtenir(courante.scriptId))!;
    expect(script.blocs.flatMap((b) => b.segments).some((g) => g.texte === "Un milieu réécrit par Will avant la vidéo.")).toBe(true);
  });

  it("accord trop bas à la reconfirmation (texte modifié) : aucun refus de prix, le texte relu est enregistré et part", async () => {
    const { sujetId } = await sujetPretAFabriquer();
    const cible = { sujetId };
    const { lignes } = await ecran.lotARelire(cible);
    const milieu = lignes.find((l) => l.id.startsWith("c:"))!;
    const relues = appliquerSaisie(lignes, milieu.id, { dit: "Un milieu bien plus long, réécrit par Will, qui fait monter le prix de la vidéo." });
    const videosAvant = await depots().videos.compter();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    const r = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-prix", accord: 1 });
    expect(r.videoId).toBeTruthy();
    expect(r.n).toBeGreaterThan(1);
    expect(await depots().videos.compter()).toBeGreaterThan(videosAvant);
  });

  // Relecture n° 2 (19:12) : le prix et le budget contrôlés AVANT l'enregistrement sont ceux du texte RELU (rallongé),
  // pas ceux du texte enregistré. 08/11 : ni le prix ni le budget ne refusent plus ; la vidéo part du premier coup.
  const RALLONGE = "Un milieu bien plus long, réécrit par Will, qui fait monter le prix de la vidéo, encore et encore, avec beaucoup de mots en plus pour allonger.";
  for (const une of [true, false]) {
    it(`${une ? "une version" : "les N"} : un accord plus bas que le prix ne refuse plus (vidéo créée du premier coup)`, async () => {
      const { sujetId, versions } = await sujetPretAFabriquer();
      const cible = une ? { sujetId, varianteId: versions[0].id } : { sujetId };
      const { lignes } = await ecran.lotARelire(cible);
      const milieu = lignes.find((l) => l.id.startsWith("c:"))!;
      const relues = appliquerSaisie(lignes, milieu.id, { dit: RALLONGE });
      await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
      const r = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-p", accord: 1 });
      expect(r.videoId).toBeTruthy();
      expect(prevol.totaux[0]).toBeGreaterThan(1);
      if (!une) expect(r.n).toBeGreaterThan(1);
    });

    it(`${une ? "une version" : "les N"} : l'estimation sur le texte relu égale celle du même texte une fois enregistré`, async () => {
      const { sujetId, versions } = await sujetPretAFabriquer();
      const cible = une ? { sujetId, varianteId: versions[0].id } : { sujetId };
      const { lignes } = await ecran.lotARelire(cible);
      const milieu = lignes.find((l) => l.id.startsWith("c:"))!;
      const relues = appliquerSaisie(lignes, milieu.id, { dit: RALLONGE });
      // Le prix du texte relu est mesuré au pré-vol ; un crédit réel insuffisant (simulé) arrête le lancement juste après.
      prevol.refuserUneFois = true;
      const refus = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-e" }).then(() => null, (x: ErreurStudio) => x);
      expect(refus?.code).toBe("CREDIT_INSUFFISANT");
      const avant = prevol.totaux.at(-1);
      // Le même texte, enregistré puis validé (comme le fait le lancement) : même prix.
      await ecran.enregistrerRelecture(cible, relues);
      const courantes = versionsCourantes(await depots().variantes.lister((x) => x.scriptMaitreId === sujetId));
      for (const c of courantes) if (c.etat !== "validee") await depots().variantes.modifier(c.id, { etat: "validee" });
      const fr = await import("@/services/fabrication-reseaux");
      const code = versions[0].code;
      await (une ? fr.verifierAvantDeCreer([courantes.find((c) => c.code === code)!.id], { confirme: false }) : fr.verifierAvantDeFabriquerLesN(sujetId));
      expect(avant).toBeGreaterThan(0);
      expect(prevol.totaux.at(-1)).toBe(avant);
    });

    it(`${une ? "une version" : "les N"} : texte rallongé qui dépasse le budget → aucun BUDGET_DEPASSE, le texte relu est enregistré et part`, async () => {
      const { sujetId, versions } = await sujetPretAFabriquer();
      const cible = une ? { sujetId, varianteId: versions[0].id } : { sujetId };
      const fr = await import("@/services/fabrication-reseaux");
      // Prix du texte enregistré : il tient tout juste dans le budget ; le texte rallongé, non.
      const ancien = une ? (await fr.verifierAvantDeCreer([versions[0].id], { confirme: false })).total.centimes : (await fr.planFabricationSujet(sujetId))!.total.centimes;
      expect(ancien).toBeGreaterThan(0);
      await ecrireParametre("budget.mensuel", { centimes: ancien, devise: "EUR" });
      const { lignes } = await ecran.lotARelire(cible);
      const milieu = lignes.find((l) => l.id.startsWith("c:"))!;
      const relues = appliquerSaisie(lignes, milieu.id, { dit: RALLONGE });
      const scriptsAvant = await depots().scripts.compter();
      const videosAvant = await depots().videos.compter();
      const r = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-b", accord: ancien });
      expect(r.videoId).toBeTruthy();
      expect(r.enAttente).toBeUndefined();
      expect(await depots().scripts.compter()).toBeGreaterThan(scriptsAvant);
      expect(await depots().videos.compter()).toBeGreaterThan(videosAvant);
    });
  }

  it("une version « à relire » fabriquée par l'écran de relecture : simple remarque au journal (08/11), la fabrication continue", async () => {
    const { sujetId, versions } = await sujetPretAFabriquer();
    const v = versions[0];
    await depots().variantes.modifier(v.id, { etat: "a-relire" });
    const cible = { sujetId, varianteId: v.id };
    const { lignes } = await ecran.lotARelire(cible);
    await expect(ecran.lotARelire(cible, { fabriquer: true })).resolves.toBeTruthy();
    const relues = appliquerSaisie(lignes, lignes[0].id, { dit: "Un mot changé pour forcer la validation." });
    const videosAvant = await depots().videos.compter();
    const r = await ecran.fabriquerApresRelecture(cible, { lignes: relues, empreinte: empreinte(relues), operationId: "op-arelire" });
    expect(r.videoId).toBeTruthy();
    expect(await depots().videos.compter()).toBeGreaterThan(videosAvant);
    expect(await depots().evenements.trouver((e) => /^Remarque : cette version n'est pas validée/.test(e.message))).toBeTruthy();
  });

  it("repère « script relu » lié à sa cible : le même identifiant d'opération sur une autre version ne saute pas la relecture", async () => {
    const { sujetId, versions } = await sujetPretAFabriquer();
    const [a, b] = versions;
    const cibleA = { sujetId, varianteId: a.id };
    const { lignes } = await ecran.lotARelire(cibleA);
    await ecran.fabriquerApresRelecture(cibleA, { lignes, empreinte: empreinte(lignes), operationId: "op-partage" });
    const e = await ecran.fabriquerApresRelecture({ sujetId, varianteId: b.id }, { lignes: [], empreinte: "", operationId: "op-partage" }).then(() => null, (x: ErreurStudio) => x);
    expect(e?.code).toBe("SCRIPT_A_RELIRE");
    expect((await depots().variantes.obtenir(b.id))?.videoId).toBeUndefined();
  });

  it("« Fabriquer les N » : même repère, sur le lot entier", async () => {
    const { sujetId } = await sujetPretAFabriquer();
    const cible = { sujetId };
    const { lignes } = await ecran.lotARelire(cible);
    const sans = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: "x", operationId: "op-n0" }).then(() => null, (e: ErreurStudio) => e);
    expect(sans?.code).toBe("SCRIPT_A_RELIRE");
    const r = await ecran.fabriquerApresRelecture(cible, { lignes, empreinte: empreinte(lignes), operationId: "op-n" });
    expect(r.n).toBeGreaterThan(1);
  });
});
