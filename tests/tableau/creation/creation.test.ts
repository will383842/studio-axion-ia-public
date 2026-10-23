/**
 * « NOUVELLE VIDÉO · TABLEAU ANIMÉ » (`services/tableau-creation.ts`) : un script devient une fiche valide avec un
 * découpage simulé (tâche de fond : l'action enregistre, la boucle découpe) ; une fiche refusée déclenche UNE relance puis un refus propre ; la fabrication est refusée sans
 * confirmation du prix ; la page ne s'affiche pas quand le format est masqué. Dépôts en mémoire, double de Claude :
 * aucun appel réseau, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { repereFiche, repereTexte } from "@/domaine/relecture-tableau";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

/** Le format est actif ; le cas « masqué » est SIMULÉ (`ouvert = false`), sans lire la valeur réelle du statut. */
const aiguillage = vi.hoisted(() => ({ ouvert: true }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: (f: { id: string; statut: string } | null | undefined) => (aiguillage.ouvert ? vrai.ecranTableauVisible(f as never) : false) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { decouperScriptTableau, ecranCreationTableau, lireBrouillonTableau, fabriquerVideoTableau, travaillerTachesTableau, corrigerFicheTableau, reprendreTacheTableau, brouillonsRecentsTableau, cocherDejaVuTableau, RAISON_CASE_DEJA_VU, rouvrirFicheTableau, validerDonneesScript } = await import("@/services/tableau-creation");
const { fabriquerVideoTableauAction, decouperScriptTableauAction } = await import("@/app/(studio)/tableau/nouvelle/actions");
const { default: PageNouvelleTableau } = await import("@/app/(studio)/tableau/nouvelle/page");
const { adresseCreationFormat, listerFormatsNavigation } = await import("@/formats");
const { formatTableauAnime } = await import("@/formats/tableau-anime");

const MDP = "tableau-creation";
const fiche = ficheErreurCorrigee;
/** Le repère « script relu » de la fiche actuelle du brouillon (« Fabriquer » l'exige). */
const relu = async (videoId: string) => repereFiche(lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche);


/** Ce que l'écran envoie : le script de la fiche d'exemple, ses choix, une fin, deux réseaux. */
const donnees = {
  texte: texteScriptDe(fiche),
  serieCode: "formation",
  structure: fiche.structure,
  douleur: fiche.douleur,
  gesteMinute: fiche.gesteMinute,
  finId: "fin-if-abonnement",
  reseaux: ["verticaux", "linkedin"],
};

const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";

/** Réponse de « Claude » : la fiche d'exemple, champs fixes recopiés de la demande (comme le ferait le modèle). */
function reponseDe(entree: EntreeRole, abimer?: (f: FicheTableau) => void): string {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  // Style des nouvelles fiches (« reference/2 », 14/10) : la fiche rendue avec son gabarit de page clair.
  auStyleDemande(f);
  abimer?.(f);
  return JSON.stringify(f);
}

/** Double de l'appel Claude : compte les appels, rend une fiche (abîmée ou non). */
function doubleClaude(abimer?: (f: FicheTableau, n: number) => void) {
  const appels: EntreeRole[] = [];
  const appeler: OutilsDecoupage["appeler"] = async (_role, entree) => {
    appels.push(entree);
    return { ok: true, simule: false, donnees: reponseDe(entree, abimer ? (f) => abimer(f, appels.length) : undefined) };
  };
  return { appels, appeler };
}

/** « Découper en scènes » puis un passage de la boucle de fond : l'issue de la tâche. */
async function decouperEtAttendre(d: unknown, deps: { appeler: OutilsDecoupage["appeler"]; aujourdhui: string }) {
  // Le prix d'abord : sans montant confirmé, rien n'est enregistré ; avec, la tâche part.
  const relu = repereTexte((d as { texte: string }).texte);
  const prix = await decouperScriptTableau(d, { relu }, { aujourdhui: deps.aujourdhui });
  if (prix.statut !== "accord-requis") throw new Error(`prix attendu : ${JSON.stringify(prix)}`);
  const r = await decouperScriptTableau(d, { accord: prix.centimes, relu }, { aujourdhui: deps.aujourdhui });
  if (r.statut !== "en-cours") throw new Error(`découpage non enregistré : ${JSON.stringify(r)}`);
  await travaillerTachesTableau(deps);
  const b = lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!;
  return { statut: b.tache!.statut, videoId: r.videoId, brouillon: b, tache: b.tache! };
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  aiguillage.ouvert = true;
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
});

describe("Découper en scènes", () => {
  it("transforme un script en fiche valide (découpage simulé) et l'enregistre en brouillon", async () => {
    const claude = doubleClaude();
    const r = await decouperEtAttendre(donnees, { appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("terminee");
    if (r.statut !== "terminee") return;
    expect(claude.appels).toHaveLength(1);
    expect(r.tache.message).toBe("Scènes prêtes.");

    const video = await depots().videos.obtenir(r.videoId);
    expect(video).toMatchObject({ formatId: "tableau-anime", statut: "brouillon" });
    const b = lireBrouillonTableau(video)!;
    expect(b.donnees.reseaux).toEqual(["verticaux", "linkedin"]);
    expect(b.versions).toHaveLength(1);
    const f = b.versions[0].fiche;
    expect(f.videoId).toBe(r.videoId);
    expect(f.serie).toEqual({ code: "formation", nom: "Formation" });
    expect(f.appelId).toBe("fin-if-abonnement");
    expect(texteScriptDe(f)).toBe(donnees.texte);

    // L'écran relit le brouillon : la fiche passe les règles, la voix a un prix.
    const ecran = await ecranCreationTableau(r.videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(ecran.brouillon?.problemes).toEqual([]);
    expect(ecran.brouillon?.coutVoixCentimes).toBeGreaterThan(0);
    expect(ecran.coutDecoupageCentimes).toBeGreaterThan(0);
  });

  it("sans le prix confirmé : refus côté serveur, aucun brouillon ni tâche", async () => {
    for (const accord of [undefined, true, 0, 1]) {
      const r = await decouperScriptTableau(donnees, { accord, relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
      expect(r.statut).toBe("accord-requis");
      if (r.statut === "accord-requis") expect(r.phrase).toMatch(/Le découpage coûte au plus .* Confirmez ce prix/);
    }
    expect(await depots().videos.compter((v) => v.formatId === "tableau-anime")).toBe(0);
  });

  it("fiche refusée : une seule relance, puis un refus propre ; la fiche lisible est GARDÉE « à corriger »", async () => {
    // Le texte dit change d'un mot à chaque réponse : refusé par la règle « mot pour mot ».
    const claude = doubleClaude((f) => (f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", "floues")));
    const r = await decouperEtAttendre(donnees, { appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(claude.appels).toHaveLength(2);
    expect(claude.appels[1].variable).toContain("<refus_fiche_precedente>");
    expect(r.statut).toBe("refusee");
    expect(r.tache.message).toMatch(/refusé par les règles.*gardée/);
    expect(r.tache.motifs!.length).toBeGreaterThan(0);
    expect(r.brouillon.versions).toHaveLength(1);
    expect(r.brouillon.versions[0].origine).toBe("decoupage-a-corriger");
    // Journal : le coût réel de chaque appel et sa raison d'arrêt sont gardés.
    expect(r.tache.journal).toHaveLength(2);

    // L'écran : la fiche s'affiche avec ses défauts ; la liste des brouillons dit « Découpage à corriger ».
    const ecran = await ecranCreationTableau(r.videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(ecran.brouillon?.ficheACorriger).toBe(true);
    expect(ecran.brouillon?.problemes.length).toBeGreaterThan(0);
    expect(ecran.brouillon?.tache).toMatchObject({ statut: "refusee", type: "decoupage" });
    expect((await brouillonsRecentsTableau())[0].etat).toBe("Découpage à corriger");
    // Jamais fabriquée telle quelle.
    expect(await fabriquerVideoTableau(r.videoId, 999_999, { aujourdhui: AUJOURDHUI_EXEMPLES }, await relu(r.videoId))).toMatchObject({ statut: "refusee" });

    // Corrigée à la main : enregistrée dès qu'elle passe les règles.
    const s01 = r.brouillon.versions[0].fiche.scenes[0];
    const c = await corrigerFicheTableau(r.videoId, [{ sceneId: s01.id, texteDit: s01.texteDit.replace("floues", "vagues") }], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(c).toEqual({ statut: "enregistree", version: 2 });
    const apres = await ecranCreationTableau(r.videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(apres.brouillon?.ficheACorriger).toBe(false);
    expect(apres.brouillon?.problemes).toEqual([]);
    // Essai du 12/10 : le bandeau « Découpage refusé par les règles » et ses motifs s'effacent, l'étiquette suit.
    expect(apres.brouillon?.tache).toMatchObject({ statut: "terminee", motifs: [] });
    expect((await brouillonsRecentsTableau())[0].etat).toBe("Fiche prête");
  });

  it("essai réel n° 4 : une fiche « à corriger » dont une ancre dépasse le texte dit s'enregistre SANS changement (réparée)", async () => {
    const claude = doubleClaude((f) => (f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", "floues")));
    const r = await decouperEtAttendre(donnees, { appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.brouillon.versions[0].origine).toBe("decoupage-a-corriger");
    // Fiche gardée avant cette réparation : le texte dit juste, mais une ancre au-delà de la fin, un geste orphelin et
    // un identifiant en double (ce qu'un « Enregistrer » ne pouvait pas corriger à la main).
    const { CLE_CREATION_TABLEAU } = await import("@/services/tableau-creation");
    const video = (await depots().videos.obtenir(r.videoId))!;
    const b = JSON.parse(JSON.stringify(r.brouillon)) as typeof r.brouillon;
    const abimee = b.versions[0].fiche;
    abimee.scenes[0].texteDit = fiche.scenes[0].texteDit;
    const derniere = abimee.scenes.at(-1)!;
    const e = derniere.elements.find((x) => x.type !== "mention") as { ancre: number };
    e.ancre = 999;
    const ids = abimee.scenes.flatMap((s) => s.elements.map((x) => x.id));
    abimee.scenes[1].elements[0] = { ...abimee.scenes[1].elements[0], id: ids[0] };
    await depots().videos.modifier(r.videoId, { entrees: { ...video.entrees, [CLE_CREATION_TABLEAU]: b } });
    const avant = await ecranCreationTableau(r.videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(avant.brouillon?.problemes.some((p) => /part du mot 1000/.test(p.message))).toBe(true);

    const c = await corrigerFicheTableau(r.videoId, [], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(c).toEqual({ statut: "enregistree", version: 2 });
    const apres = await ecranCreationTableau(r.videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(apres.brouillon?.problemes).toEqual([]);
    expect(texteScriptDe(apres.brouillon!.fiche!)).toBe(donnees.texte);
  });

  it("découpage refusé : « Réessayer » demande le prix, puis refait un découpage NEUF (réponses refusées non rejouées)", async () => {
    const claude = doubleClaude((f) => (f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", "floues")));
    const r = await decouperEtAttendre(donnees, { appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("refusee");
    const sans = await reprendreTacheTableau(r.videoId);
    expect(sans.statut).toBe("accord-requis");
    if (sans.statut !== "accord-requis") return;
    expect(await reprendreTacheTableau(r.videoId, sans.centimes)).toMatchObject({ statut: "en-cours" });
    const bon = doubleClaude();
    await travaillerTachesTableau({ appeler: bon.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(bon.appels).toHaveLength(1);
    const b = lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!;
    expect(b.tache?.statut).toBe("terminee");
    expect(b.versions.map((v) => v.origine)).toEqual(["decoupage-a-corriger", "decoupage"]);
  });

  it("réponse coupée : issue « tronquee », message propre, un seul appel", async () => {
    const appels: EntreeRole[] = [];
    const appeler: OutilsDecoupage["appeler"] = async (_role, entree) => {
      appels.push(entree);
      return { ok: true, simule: false, donnees: reponseDe(entree).slice(0, 500), stopReason: "max_tokens", coutUsd: 0.17 };
    };
    const r = await decouperEtAttendre(donnees, { appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(appels).toHaveLength(1);
    expect(r.statut).toBe("refusee");
    expect(r.tache.message).toMatch(/coupée/);
    expect(r.tache.journal[0]).toMatchObject({ coutUsd: 0.17, stopReason: "max_tokens" });
    expect((await brouillonsRecentsTableau())[0].etat).toBe("Découpage refusé");
  });

  it("une relance qui réussit garde la fiche de la relance", async () => {
    const claude = doubleClaude((f, n) => {
      if (n === 1) f.scenes[0].texteDit = f.scenes[0].texteDit.replace("vagues", "floues");
    });
    const r = await decouperEtAttendre(donnees, { appeler: claude.appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(claude.appels).toHaveLength(2);
    expect(r).toMatchObject({ statut: "terminee", tache: { message: "Scènes prêtes (après une relance)." } });
  });
});

describe("Fabriquer la vidéo", () => {
  async function brouillonPret(options: { case?: boolean } = {}): Promise<string> {
    const r = await decouperEtAttendre(donnees, { appeler: doubleClaude().appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    if (r.statut !== "terminee") throw new Error("découpage attendu");
    if (options.case !== false) await cocherDejaVuTableau(r.videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
    return r.videoId;
  }

  it("sans la case « déjà vu » cochée : refus AVANT le prix, avec la raison ; cochée : datée du jour, gardée et transmise", async () => {
    const videoId = await brouillonPret({ case: false });
    const deps = { aujourdhui: AUJOURDHUI_EXEMPLES, deposerFiche: async () => undefined, lancer: async () => ({ travailId: "trav-essai" }) };
    expect(await fabriquerVideoTableau(videoId, 999_999, deps, await relu(videoId))).toEqual({ statut: "refusee", phrase: RAISON_CASE_DEJA_VU });
    const ecran = await ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(ecran.brouillon?.dejaVu).toBeNull();
    expect(ecran.brouillon?.raisonFabriquer).toBe(RAISON_CASE_DEJA_VU);

    expect(await cocherDejaVuTableau(videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES })).toEqual({ dejaVu: { coche: true, le: AUJOURDHUI_EXEMPLES } });
    const apres = await ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(apres.brouillon?.dejaVu).toEqual({ coche: true, le: AUJOURDHUI_EXEMPLES });
    expect(apres.brouillon?.raisonFabriquer).toBeNull();
    const prix = await fabriquerVideoTableau(videoId, undefined, deps, await relu(videoId));
    if (prix.statut !== "accord-requis") throw new Error("prix attendu");
    expect(await fabriquerVideoTableau(videoId, prix.centimes, deps, await relu(videoId))).toMatchObject({ statut: "lancee" });
    const video = await depots().videos.obtenir(videoId);
    expect((video?.entrees as { tableau?: { dejaVu?: unknown } }).tableau?.dejaVu).toEqual({ coche: true, le: AUJOURDHUI_EXEMPLES });
  });

  it("l'action est refusée par le serveur sans confirmation du prix : rien n'est rangé ni lancé", async () => {
    const videoId = await brouillonPret();
    const travaux = await depots().travaux.compter();
    for (const accord of [undefined, true, false, 0]) {
      const r = await fabriquerVideoTableauAction(videoId, accord, await relu(videoId));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.donnees.statut).toBe("accord-requis");
    }
    expect(await depots().travaux.compter()).toBe(travaux);
    const video = await depots().videos.obtenir(videoId);
    expect(video?.statut).toBe("brouillon");
    expect((video?.entrees as Record<string, unknown>).tableau).toBeUndefined();
  });

  it("avec le montant confirmé : la fiche est rangée, puis le lancement commun", async () => {
    const videoId = await brouillonPret();
    const deposees: string[] = [];
    const lancees: [string, number][] = [];
    const deps = {
      aujourdhui: AUJOURDHUI_EXEMPLES,
      deposerFiche: async (cle: string) => void deposees.push(cle),
      lancer: async (id: string, accord: number) => (lancees.push([id, accord]), { travailId: "trav-essai" }),
    };
    const prix = await fabriquerVideoTableau(videoId, undefined, deps, await relu(videoId));
    expect(prix.statut).toBe("accord-requis");
    if (prix.statut !== "accord-requis") return;
    expect(await fabriquerVideoTableau(videoId, prix.centimes - 1, deps, await relu(videoId))).toMatchObject({ statut: "accord-requis" });
    expect(lancees).toEqual([]);

    const r = await fabriquerVideoTableau(videoId, prix.centimes, deps, await relu(videoId));
    expect(r).toEqual({ statut: "lancee", videoId, travailId: "trav-essai" });
    expect(deposees).toEqual([`studio/dev/fiches-scenes/${videoId}/b1.json`]);
    expect(lancees).toEqual([[videoId, prix.centimes]]);
    const video = await depots().videos.obtenir(videoId);
    expect((video?.entrees as { tableau?: { ficheScenesCle?: string } }).tableau?.ficheScenesCle).toBe(deposees[0]);
  });
});

describe("Format masqué", () => {
  it("la page ne montre que « pas encore ouvert », sans entrée de menu ni brouillon possible", async () => {
    aiguillage.ouvert = false;
    const html = renderToStaticMarkup(await PageNouvelleTableau({}));
    expect(html).toContain("Pas encore ouvert");
    expect(html).not.toContain("Découper");

    const r = await decouperScriptTableauAction(donnees);
    expect(r).toMatchObject({ ok: true, donnees: { statut: "refusee" } });
    expect(await depots().videos.compter((v) => v.formatId === "tableau-anime")).toBe(0);
  });

  it("actif (valeur réelle) : la page montre le tableau, et « Nouvelle vidéo » y mène par le registre", async () => {
    aiguillage.ouvert = true;
    expect(formatTableauAnime.statut).toBe("actif");
    const html = renderToStaticMarkup(await PageNouvelleTableau({}));
    expect(html).not.toContain("Pas encore ouvert");
    expect(html).toContain("Tableau animé");
    expect(adresseCreationFormat({ id: "tableau-anime" })).toBe("/tableau/nouvelle");
    expect(listerFormatsNavigation().map((f) => f.id)).toContain("tableau-anime");
  });

  it("la carte « Tableau animé » de Nouvelle vidéo mène à son écran", () => {
    expect(adresseCreationFormat({ id: "tableau-anime" })).toBe("/tableau/nouvelle");
  });
});


describe("essai par l'écran du 12/10 : petits défauts et arrêt à la relecture", () => {
  async function brouillon(): Promise<string> {
    const r = await decouperEtAttendre(donnees, { appeler: doubleClaude().appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    if (r.statut !== "terminee") throw new Error("découpage attendu");
    return r.videoId;
  }

  it("le prix du découpage affiché d'emblée est celui que le serveur exige : une seule feuille « Confirmer ce prix »", async () => {
    // En production la marque existe déjà (migration du générateur) ; en mémoire elle est créée à la première lecture : le prix affiché la compte alors, comme celui que le serveur exige.
    await (await import("@/services/contexte-axion")).lireContexte();
    const ecran = await ecranCreationTableau(undefined, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const prix = await decouperScriptTableau(donnees, { relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(prix).toMatchObject({ statut: "accord-requis", centimes: ecran.coutDecoupageCentimes });
    // Confirmé au prix du bouton : le découpage part du premier coup.
    expect(await decouperScriptTableau(donnees, { accord: ecran.coutDecoupageCentimes, relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES })).toMatchObject({ statut: "en-cours" });
  });

  it("essai réel n° 3 : un texte au-delà de LA borne de longueur (90 s, 1 520 caractères dits) est refusé avant le prix", async () => {
    const { CARACTERES_DITS_MAX_TABLEAU } = await import("@/domaine/duree-tableau");
    let texte = donnees.texte;
    while (texte.length <= CARACTERES_DITS_MAX_TABLEAU) texte = `${texte} ${donnees.texte}`;
    const r = await decouperScriptTableau({ ...donnees, texte }, { accord: 999_999 }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/1520 au plus \(90 s de voix\)/) });
  });

  it("essai réel n° 3 : à la main, on ajoute une ligne écrite à une scène et on coupe une scène en deux à une phrase", async () => {
    const { couperScene } = await import("@/moteurs/montage-tableau/rythme");
    const { debutsDePhrase } = await import("@/domaine/controles-script/texte");
    const videoId = await brouillon();
    const f = lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche;
    // Une scène qui se coupe (deux phrases, un élément de chaque côté) ; une autre qui a de la place pour une ligne.
    const i = f.scenes.findIndex((s, j) => debutsDePhrase(s.texteDit).some((c) => couperScene(f, j, c)));
    expect(i).toBeGreaterThanOrEqual(0);
    const coupe = debutsDePhrase(f.scenes[i].texteDit).find((c) => couperScene(f, i, c))!;
    const autre = f.scenes.find((s, j) => j !== i && s.elements.length < 6)!;
    // Au gabarit clair (style des nouvelles fiches), une ligne ajoutée reprend les mots dits de sa scène.
    const ajout = autre.texteDit.replace(/[.?!]+$/, "").split(/\s+/).slice(0, 6).join(" ");
    const r = await corrigerFicheTableau(videoId, [{ sceneId: f.scenes[i].id, couperAvant: coupe }, { sceneId: autre.id, ajouts: [ajout] }], { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r).toMatchObject({ statut: "enregistree" });
    const apres = lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche;
    expect(apres.scenes).toHaveLength(f.scenes.length + 1);
    expect(apres.scenes.map((s) => s.texteDit).join(" ")).toBe(f.scenes.map((s) => s.texteDit).join(" "));
    expect(apres.scenes.flatMap((s) => s.elements).some((e) => e.type === "ligne" && e.texte === ajout && e.bloc === "detail")).toBe(true);
    // Une coupe hors d'une fin de phrase est refusée, sans rien enregistrer.
    const n = apres.scenes.length;
    const mauvaise = await corrigerFicheTableau(videoId, [{ sceneId: apres.scenes[0].id, couperAvant: 1 }], { aujourdhui: AUJOURDHUI_EXEMPLES });
    if (!debutsDePhrase(apres.scenes[0].texteDit).includes(1)) expect(mauvaise).toMatchObject({ statut: "refusee", phrase: expect.stringMatching(/ne peut pas être coupée là/) });
    expect(lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche.scenes).toHaveLength(n);
  });

  it("« Mots importants » se corrigent à la main : mots séparés par des virgules, gardés seulement dans leur ligne", async () => {
    const videoId = await brouillon();
    const f = lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche;
    const s = f.scenes.find((x) => x.elements.some((e) => e.type === "ligne"))!;
    const ligne = s.elements.find((e): e is Extract<typeof e, { type: "ligne" }> => e.type === "ligne")!;
    const mot = ligne.texte.split(/\s+/).find((m) => m.replace(/[^\p{L}]/gu, "").length > 3)!.replace(/[^\p{L}\p{N}']/gu, "");
    expect(await corrigerFicheTableau(videoId, [{ sceneId: s.id, importants: `${mot}, motabsent,` }], { aujourdhui: AUJOURDHUI_EXEMPLES })).toMatchObject({ statut: "enregistree" });
    const apres = lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche;
    const l2 = apres.scenes.find((x) => x.id === s.id)!.elements.find((e) => e.id === ligne.id) as typeof ligne;
    expect(l2.importants).toEqual([mot]);
    // Champ vidé : plus aucun mot important dans la scène.
    expect(await corrigerFicheTableau(videoId, [{ sceneId: s.id, importants: "" }], { aujourdhui: AUJOURDHUI_EXEMPLES })).toMatchObject({ statut: "enregistree" });
    const vide = lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche;
    expect(vide.scenes.find((x) => x.id === s.id)!.elements.some((e) => e.type === "ligne" && e.importants)).toBe(false);
  });

  it("l'écran montre la case juste au-dessus de « Fabriquer la vidéo », le bouton inactif et la raison tant qu'elle n'est pas cochée", async () => {
    const videoId = await brouillon();
    const html = renderToStaticMarkup(await PageNouvelleTableau({ searchParams: Promise.resolve({ brouillon: videoId }) }));
    const iCase = html.indexOf("Ce conseil n&#x27;est pas en première page d&#x27;une recherche");
    const iBouton = html.indexOf("Fabriquer la vidéo");
    expect(iCase).toBeGreaterThan(0);
    expect(iBouton).toBeGreaterThan(iCase);
    expect(html).toContain("Cherchez le sujet sur Google : si le même conseil apparaît en première page, la vidéo n&#x27;apporte rien.");
    expect(html).toContain("Cochez d&#x27;abord « Ce conseil n&#x27;est pas en première page d&#x27;une recherche ».");
    expect(html).toContain("Tout est bon");
    // L'attribut « disabled » du bouton (pas la classe « disabled:… »).
    const inactif = (h: string, i: number) => / disabled=""/.test(h.slice(h.lastIndexOf("<button", i), h.indexOf(">", h.lastIndexOf("<button", i)) + 1));
    expect(inactif(html, iBouton)).toBe(true);
    await cocherDejaVuTableau(videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const coche = renderToStaticMarkup(await PageNouvelleTableau({ searchParams: Promise.resolve({ brouillon: videoId }) }));
    const i2 = coche.indexOf("Fabriquer la vidéo");
    expect(inactif(coche, i2)).toBe(false);
  });

  it("arrêtée à la relecture : « Corriger la fiche » rouvre le brouillon, « Reprendre la fabrication » repasse par la relecture et le prix", async () => {
    const videoId = await brouillon();
    const le = new Date().toISOString();
    // Une fabrication lancée puis arrêtée à la relecture (étape « fiche » du moteur), comme le 12/10.
    await depots().videos.modifier(videoId, { statut: "echec" });
    await depots().travaux.enregistrer({ id: "trav-arret", type: "fabrication", cibleId: videoId, titre: "x", etapes: [{ cle: "fiche", nom: "La relecture de la fiche", icone: "liste", dependDe: [], statut: "echec", progression: 0, sortieFichierIds: [] }], statut: "echec", progression: 0, tentatives: 1, cleIdempotence: "x", fournisseurUtilise: "x", creeLe: le, modifieLe: le } as never);
    const deps = { aujourdhui: AUJOURDHUI_EXEMPLES, deposerFiche: async () => undefined, lancer: async () => ({ travailId: "trav-relance" }) };
    // « Reprendre la fabrication » sans la case : refusé avant tout prix, avec la raison.
    expect(await fabriquerVideoTableau(videoId, 999_999, deps, await relu(videoId))).toEqual({ statut: "refusee", phrase: RAISON_CASE_DEJA_VU });
    // « Corriger la fiche » : la vidéo redevient un brouillon, ses versions sont gardées.
    expect(await rouvrirFicheTableau(videoId)).toEqual({ videoId });
    const video = await depots().videos.obtenir(videoId);
    expect(video?.statut).toBe("brouillon");
    expect(lireBrouillonTableau(video)!.versions.length).toBe(1);
    await cocherDejaVuTableau(videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
    const prix = await fabriquerVideoTableau(videoId, undefined, deps, await relu(videoId));
    if (prix.statut !== "accord-requis") throw new Error("prix attendu");
    expect(await fabriquerVideoTableau(videoId, prix.centimes, deps, await relu(videoId))).toMatchObject({ statut: "lancee", travailId: "trav-relance" });
  });
});

describe("douleur, mots de la douleur et titre (essai réel du 12/10)", () => {
  it("le titre d'un texte collé : ses premiers mots, jamais la douleur ; il ne change pas aux versions suivantes", async () => {
    const r = await decouperEtAttendre(donnees, { appeler: doubleClaude().appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("terminee");
    expect((await depots().videos.obtenir(r.videoId))!.titre).toBe("Vos réponses d'IA sont vagues ?");
    const s01 = r.brouillon.versions[0].fiche.scenes[0];
    expect(await corrigerFicheTableau(r.videoId, [{ sceneId: s01.id, lignes: { e01: "Réponses vagues ?" } }], { aujourdhui: AUJOURDHUI_EXEMPLES })).toMatchObject({ statut: "enregistree" });
    expect((await depots().videos.obtenir(r.videoId))!.titre).toBe("Vos réponses d'IA sont vagues ?");
    expect((await brouillonsRecentsTableau())[0].titre).toBe("Vos réponses d'IA sont vagues ?");
  });

  it("une douleur trop longue pour la fiche est raccourcie (première phrase entière), jamais refusée ; un mot de la douleur absent du texte est refusé", async () => {
    const longue = `${fiche.douleur} ${"Et chaque fois, il faut tout reprendre depuis le début, sans savoir quoi changer dans la demande.".repeat(2)}`;
    const v = validerDonneesScript({ ...donnees, douleur: longue, motsDouleur: "réponses, vagues" });
    expect(v).toMatchObject({ ok: true, donnees: { douleur: fiche.douleur, motsDouleur: ["réponses", "vagues"] } });
    expect(validerDonneesScript({ ...donnees, motsDouleur: "chronomètre" })).toEqual({ ok: false, phrase: "Le mot de la douleur « chronomètre » n'est pas dans le texte dit : recopiez-le tel qu'il est dit, ou retirez-le." });
  });

  it("corriger à la main : la douleur et ses mots sont modifiables ; un refus dit quels mots écrire", async () => {
    const r = await decouperEtAttendre(donnees, { appeler: doubleClaude().appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(r.statut).toBe("terminee");
    // « pourquoi » est dit au début, mais écrit nulle part dans la première scène : le refus dit quoi écrire.
    const refus = await corrigerFicheTableau(r.videoId, { scenes: [], motsDouleur: "pourquoi" }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(refus.statut).toBe("refusee");
    expect(refus.statut === "refusee" && refus.problemes.map((p) => p.message)).toContainEqual(expect.stringContaining("écrivez dans une de ses lignes un des mots « pourquoi »"));
    // Les mots dits ET écrits au début : enregistré ; la douleur trop longue est raccourcie, pas refusée.
    const ok = await corrigerFicheTableau(r.videoId, { scenes: [], douleur: `${fiche.douleur} ${"x".repeat(150)}`, motsDouleur: "réponses, vagues" }, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(ok).toMatchObject({ statut: "enregistree" });
    const b = lireBrouillonTableau(await depots().videos.obtenir(r.videoId))!;
    expect(b.donnees.motsDouleur).toEqual(["réponses", "vagues"]);
    expect(b.donnees.douleur).toBe(fiche.douleur);
    expect(b.versions.at(-1)!.fiche.douleur).toBe(fiche.douleur);
    // Les mots suivent jusqu'à la fabrication (sa relecture cherche les mêmes).
    await cocherDejaVuTableau(r.videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
    await fabriquerVideoTableau(r.videoId, 999_999, { aujourdhui: AUJOURDHUI_EXEMPLES, deposerFiche: async () => {}, lancer: async () => ({ travailId: "t" }) }, await relu(r.videoId));
    expect(((await depots().videos.obtenir(r.videoId))!.entrees as Record<string, { motsDouleur?: string[] }>).tableau?.motsDouleur).toEqual(["réponses", "vagues"]);
  });
});
