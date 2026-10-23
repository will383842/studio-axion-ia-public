/**
 * REPRISE APRÈS UN ARRÊT (vidéo `v-9d15cce3c6e3`, 12/10) : la fabrication s'est arrêtée au calage du SECOND vertical
 * (« Fin propre à TikTok et Shorts · Scène s10 · l'écran 1 part au mot 1, mais le texte dit n'a que 0 mot »), erreur
 * marquée non réessayable, voix payée, premier vertical déposé. Avant : « Corriger la fiche » et « Reprendre la fabrication » ne
 * faisaient rien de visible. Ici, sans aucun appel payant (dépôts en mémoire, doubles) :
 *  1. l'état réel est reproduit, « Reprendre la fabrication » produit la sortie manquante : 0 lecture de voix, 0 € de plus ;
 *  2. la table des arrêts : pour chaque arrêt, chaque bouton proposé par la page est accepté par le serveur ;
 *  3. « Corriger la fiche » après la voix : la voix est reprise si le texte dit ne change pas, relue (prix annoncé) sinon ;
 *  4. l'affichage : une seule étape en échec, aucune roue sur un travail arrêté, le premier fichier téléchargeable.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { repereFiche, repereTexte } from "@/domaine/relecture-tableau";
import type { EntreeRole } from "../../../src/generateur/roles/types";
import type { CommandeFabrication, Travail } from "../../../src/domaine/types";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import type { ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, texteScriptDe } from "../regles/exemples";
import { versOutils } from "../moteur/doubles";
import { doubles } from "../fabriquer/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/components/formats/tableau-anime/aiguillage", async (original) => {
  const vrai = await original<typeof import("../../../src/components/formats/tableau-anime/aiguillage")>();
  return { ...vrai, ecranTableauVisible: () => true };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const creation = await import("@/services/tableau-creation");
/** Le repère « script relu » de la fiche actuelle du brouillon (« Fabriquer » l'exige). */
const relu = async (videoId: string) => repereFiche(creation.lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche);

const { relancerTableauAction, rouvrirFicheTableauAction } = await import("@/app/(studio)/tableau/nouvelle/actions");
const { reprendreVideo } = await import("@/services/videos");
const { lireTravauxAAvancer, ecrireAvancement } = await import("@/services/travaux");
const { brancherServicesTableau, creerMoteurMontageTableau, voixPayeeDuTravail, fichiersDuTravail } = await import("@/moteurs/montage-tableau");
const { commandeTableau, ETAPES_FABRICATION } = await import("@/moteurs/montage-tableau/fabriquer");
const { choisirFinTableau } = await import("@/services/tableau-fin");
const { sortiesDesReseaux } = await import("@/moteurs/montage-tableau/formats-sortie");
const { etapesSuivi, issuesApresArret } = await import("@/components/formats/tableau-anime/vue");
const { EtapesTableau } = await import("@/components/formats/tableau-anime/EtapesTableau");

const MDP = "tableau-reprise";
const reelle = JSON.parse(readFileSync(new URL("../temoins/fiche-consigne-ia-prod.json", import.meta.url), "utf8")) as FicheTableau;
const MESSAGE_PROD = "Le calage sur la voix n'a pas abouti. Fin propre à TikTok et Shorts · Scène s10 · l'écran 1 part au mot 1, mais le texte dit n'a que 0 mot. Modifiez la fiche de scènes, puis relancez.";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Contexte des règles de la production pour la fiche réelle (démonstrations validées). */
function contexteReel(fiche: FicheTableau): Omit<ContexteTableau, "texteScript"> {
  const ids = [...new Set(fiche.scenes.flatMap((s) => s.elements).flatMap((e) => (e.type === "preuve" ? [e.preuveId] : [])))];
  return { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: ids.map((id) => ({ id, type: "demonstration", statut: "validee", perimeLe: "2027-01-09" })) } as Omit<ContexteTableau, "texteScript">;
}

/** Fait tourner la boucle de fond (lecture, moteur, écriture) sur les travaux actifs, jusqu'à leur fin. */
async function tournerLaBoucle(moteur: ReturnType<typeof creerMoteurMontageTableau>, tours = 200): Promise<void> {
  for (let n = 0; n < tours; n++) {
    const lus = await lireTravauxAAvancer(Date.now(), () => moteur);
    if (!lus.length) return;
    for (const lu of lus) await ecrireAvancement(lu, await lu.moteur.avancer(structuredClone(lu.travail), lu.commande, Date.now()));
  }
  throw new Error("la boucle n'a pas fini");
}

/* ------------------------------------------------------------------ */
/* 1. L'état réel du 12/10                                               */
/* ------------------------------------------------------------------ */

describe("état réel du 12/10 : arrêt au calage du second vertical, voix payée, premier vertical déposé", { timeout: 120_000 }, () => {
  const VIDEO = reelle.videoId;
  const sorties = sortiesDesReseaux(["verticaux"]);

  async function reproduire() {
    const d = doubles(reelle);
    const fiches = new Map<string, FicheTableau>();
    const cle = `studio/dev/fiches/${VIDEO}/1.json`;
    fiches.set(cle, structuredClone(reelle));
    const outils = async () => versOutils(d, fiches, { contexte: contexteReel(reelle), choisirFin: choisirFinTableau({}, { sorties, mot: "CONSIGNE" }) });
    brancherServicesTableau({ outils });
    const moteur = creerMoteurMontageTableau({ outils });
    const commande: CommandeFabrication = {
      ...commandeTableau({ videoId: VIDEO, fiche: reelle, texteScript: texteScriptDe(reelle), dureeSec: 60, centreSousTitresPct: 80, scenes: [], personnageId: "williams" }),
      entrees: { tableau: { ficheScenesCle: cle, empreinte: "e1", version: 1, sorties, mot: "CONSIGNE", dejaVu: { coche: true, le: "2026-10-12" } } },
    };

    // La vidéo et sa version, comme en production (une copie de la vidéo d'exemple, passée au tableau animé).
    const exemple = (await depots().videos.obtenir("v-03"))!;
    const versionExemple = (await depots().versions.obtenir(exemple.versionChoisieId!))!;
    // Le brouillon de la console (fiche, choix, case « déjà vu ») reste dans la vidéo lancée.
    const brouillon = { donnees: { texte: texteScriptDe(reelle), serieCode: "formation", structure: reelle.structure, douleur: reelle.douleur, gesteMinute: reelle.gesteMinute, finId: "fin-if-mot-envoi", mot: "CONSIGNE", reseaux: ["verticaux"] }, versions: [{ numero: 1, fiche: reelle, enregistreeLe: "2026-10-12T10:00:00.000Z", origine: "decoupage" }], dejaVu: { coche: true, le: "2026-10-12" } };
    await depots().videos.enregistrer({ ...exemple, id: VIDEO, formatId: "tableau-anime", estDemo: false, statut: "echec", versionChoisieId: undefined, entrees: { ...commande.entrees, tableauCreation: brouillon } });
    await depots().versions.enregistrer({ ...versionExemple, id: "ver-prod", videoId: VIDEO, commande, statut: "echec", estDemo: false, choisie: false });

    // Première fabrication (doubles) : la voix lue et payée, les deux verticaux faits…
    let t = await moteur.lancer(commande, { travailId: "trav-87c2d1235740", versionId: "ver-prod", titre: "Consigne IA" });
    for (let n = 0; n < 200 && t.statut !== "termine"; n++) t = (await moteur.avancer(structuredClone(t), commande)).travail;
    expect(t.statut).toBe("termine");
    const lectures = d.lectures();
    expect(lectures).toBeGreaterThan(0);
    // … puis l'état gardé en production au moment de l'arrêt : rien du second vertical au journal, ses fichiers absents.
    const etat = structuredClone((t.parametres as { tableau: { journal: { sorties?: Record<string, unknown> } } }).tableau);
    delete etat.journal.sorties?.["vertical-liens"];
    for (const x of [...d.scenesSoumises().slice(reelle.scenes.length), ...d.compositionsSoumises().slice(1)]) d.fichiers.delete(x.sortie.cle);
    const statuts: Record<string, Travail["etapes"][number]["statut"]> = { fiche: "terminee", voix: "terminee", calage: "echec", pages: "terminee", scenes: "terminee", montage: "terminee", controle: "en_attente" };
    const erreur = { code: "TABLEAU_ECHEC", reessayable: false, messagePourWill: MESSAGE_PROD };
    const arret: Travail = {
      ...t,
      statut: "echec",
      erreur,
      progression: 80,
      termineLe: new Date().toISOString(),
      parametres: { ...t.parametres, tableau: { ...etat, atteinte: ETAPES_FABRICATION.indexOf("composition") } },
      etapes: t.etapes.map((e) => ({ ...e, statut: statuts[e.cle], ...(e.cle === "calage" ? { erreur } : { erreur: undefined }) })),
    };
    await depots().travaux.enregistrer(arret);
    // La voix est déjà enregistrée en dépense (0,34 € en production) : écrite à l'échec.
    const voix = moteur.lignesPayees!(arret, commande);
    expect(voix.map((l) => l.etape)).toEqual(["Voix"]);
    const total = { centimes: voix.reduce((s, l) => s + l.total.centimes, 0), devise: "EUR" as const };
    await depots().depenses.enregistrer({ id: "dep-voix", videoId: VIDEO, travailId: arret.id, lignes: voix, total, date: new Date().toISOString(), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
    return { d, moteur, arret, lectures, total };
  }

  it("la page montre UNE étape en échec (« Les pages » : le calage), aucune roue, le premier vertical téléchargeable", async () => {
    const { arret } = await reproduire();
    const groupes = etapesSuivi(arret.etapes, { arrete: true });
    expect(groupes).toEqual([
      { nom: "La relecture", statut: "faite" },
      { nom: "La voix", statut: "faite" },
      { nom: "Les pages", statut: "echec" },
      { nom: "Les finitions", statut: "a-venir" },
    ]);
    expect(groupes.filter((g) => g.statut === "echec")).toHaveLength(1);
    expect(groupes.some((g) => g.statut === "en-cours")).toBe(false);
    // Le premier fichier vient du journal ; le second manque.
    expect(Object.keys(fichiersDuTravail(arret))).toEqual(["vertical"]);
    const fichiers = await creation.fichiersApresArretTableau(VIDEO);
    expect(fichiers?.prets.map((f) => f.libelle)).toEqual(["Vertical 9:16 · Reels et stories"]);
    expect(fichiers?.prets[0].url).toBeTruthy();
    expect(fichiers?.manquants).toEqual(["Vertical 9:16 · TikTok et Shorts"]);
    const html = renderToStaticMarkup(createElement(EtapesTableau, { travail: arret as never, fichiers, actionsArret: createElement("span", null, "Corriger la fiche · Reprendre la fabrication") }));
    expect(html).not.toContain("animate-spin");
    expect(html).toContain("Télécharger");
    expect(html).toContain("Il manque : Vertical 9:16 · TikTok et Shorts.");
    expect(html).toContain("Corriger la fiche · Reprendre la fabrication");
    expect(issuesApresArret(arret)).toEqual(["corriger", "relancer"]);
  });

  it("« Reprendre la fabrication » : aucun prix, l'erreur effacée, la sortie manquante produite, 0 lecture de voix, 0 € de plus", async () => {
    const { d, moteur, arret, lectures, total } = await reproduire();
    const r = await relancerTableauAction(arret.id);
    expect(r).toMatchObject({ ok: true, donnees: { statut: "relancee", travailId: arret.id } });
    const relance = (await depots().travaux.obtenir(arret.id))!;
    expect(relance).toMatchObject({ statut: "en_cours", erreur: undefined, tentatives: arret.tentatives + 1 });
    expect(relance.etapes.find((e) => e.cle === "calage")?.statut).toBe("en_attente");
    expect((await depots().videos.obtenir(VIDEO))?.statut).toBe("en_fabrication");

    await tournerLaBoucle(moteur);
    const fin = (await depots().travaux.obtenir(arret.id))!;
    expect(fin.statut).toBe("termine");
    expect(d.lectures()).toBe(lectures);
    // Le premier vertical est repris tel quel ; seule la composition du second part.
    expect(d.compositionsSoumises()).toHaveLength(3);
    expect((await depots().sorties.lister((s) => s.videoId === VIDEO)).length).toBe(2);
    const depenses = await depots().depenses.lister((x) => x.travailId === arret.id);
    const somme = depenses.reduce((s, x) => s + x.total.centimes, 0);
    expect(somme).toBe(total.centimes);
    expect((await depots().videos.obtenir(VIDEO))?.statut).toBe("prete");
  });

  it("« Corriger la fiche » est permis après la voix : brouillon rouvert, rien n'est perdu", async () => {
    const { arret } = await reproduire();
    const r = await rouvrirFicheTableauAction(VIDEO);
    expect(r).toEqual({ ok: true, donnees: { videoId: VIDEO } });
    expect((await depots().videos.obtenir(VIDEO))?.statut).toBe("brouillon");
    // La voix payée de ce travail reste disponible pour la fabrication suivante, annoncée avant : rien à repayer.
    expect(voixPayeeDuTravail(arret)?.travailId).toBe(arret.id);
    const ecran = await creation.ecranCreationTableau(VIDEO, { aujourdhui: "2026-10-12" });
    expect(ecran.brouillon).toMatchObject({ voix: "reutilisee", coutVoixCentimes: 0 });
  });
});

/* ------------------------------------------------------------------ */
/* 2. Table des arrêts : le bouton proposé est accepté par le serveur    */
/* ------------------------------------------------------------------ */

const fiche = ficheErreurCorrigee;
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux"] };
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";
const appeler: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  // Style des nouvelles fiches (« reference/2 », 14/10) : la fiche rendue avec son gabarit de page clair.
  auStyleDemande(f);
  return { ok: true, simule: false, donnees: JSON.stringify(f) };
};
const deps = { aujourdhui: AUJOURDHUI_EXEMPLES, deposerFiche: async () => undefined };

/** Un brouillon découpé, case cochée, puis fabriqué (prix confirmé) : la vidéo et son travail, tels que lancés. */
async function videoLancee(): Promise<{ videoId: string; travail: Travail }> {
  const { texteScript: _s, ...regles } = contexteExemple(fiche);
  void _s;
  for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
  for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
  const prix = await creation.decouperScriptTableau(donnees, { relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error("prix du découpage attendu");
  const r = await creation.decouperScriptTableau(donnees, { accord: prix.centimes, relu: repereTexte(donnees.texte) }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error("découpage attendu");
  await creation.travaillerTachesTableau({ appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  await creation.cocherDejaVuTableau(r.videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
  const voix = await creation.fabriquerVideoTableau(r.videoId, undefined, deps, await relu(r.videoId));
  if (voix.statut !== "accord-requis") throw new Error(`prix de la voix attendu : ${JSON.stringify(voix)}`);
  const lancee = await creation.fabriquerVideoTableau(r.videoId, voix.centimes, deps, await relu(r.videoId));
  if (lancee.statut !== "lancee") throw new Error(`lancement attendu : ${JSON.stringify(lancee)}`);
  return { videoId: r.videoId, travail: (await depots().travaux.obtenir(lancee.travailId))! };
}

const ORDRE = ["fiche", "voix", "calage", "pages", "scenes", "montage", "controle"];

/** Le travail arrêté à `cle` (les étapes d'avant faites ; `suite` : celles d'après aussi, comme une autre sortie). */
async function arreter(videoId: string, t: Travail, cle: string, erreur: { code: string; reessayable: boolean; messagePourWill: string }, options: { suite?: boolean; journal?: unknown } = {}): Promise<Travail> {
  const i = ORDRE.indexOf(cle);
  const statut = (c: string): Travail["etapes"][number]["statut"] => {
    const j = ORDRE.indexOf(c);
    if (j < i) return "terminee";
    if (j === i) return "echec";
    return options.suite && c !== "controle" ? "terminee" : "en_attente";
  };
  const arret: Travail = {
    ...t,
    statut: "echec",
    erreur,
    termineLe: new Date().toISOString(),
    etapes: t.etapes.map((e) => ({ ...e, statut: statut(e.cle), erreur: e.cle === cle ? erreur : undefined })),
    ...(options.journal ? { parametres: { ...t.parametres, tableau: { journal: options.journal, atteinte: 2 } } } : {}),
  };
  await depots().travaux.enregistrer(arret);
  await depots().videos.modifier(videoId, { statut: "echec" });
  return arret;
}

/**
 * LA TABLE DES ARRÊTS (point 1) : où la fabrication s'arrête, l'étape montrée en échec, et ce que la page propose.
 * Après tout échec : « Corriger la fiche » et « Reprendre la fabrication ». Après un arrêt par Will : « Reprendre ».
 */
const TABLE: { arret: string; cle: string; groupe: string; erreur: { code: string; reessayable: boolean; messagePourWill: string }; suite?: boolean; prix?: boolean }[] = [
  { arret: "relecture de la fiche", cle: "fiche", groupe: "La relecture", erreur: { code: "TABLEAU_FICHE_REFUSEE", reessayable: false, messagePourWill: "La relecture de la fiche n'a pas abouti." }, prix: true },
  { arret: "voix (lecture pas finie)", cle: "voix", groupe: "La voix", erreur: { code: "TABLEAU_ECHEC", reessayable: true, messagePourWill: "La voix n'a pas abouti." }, prix: true },
  { arret: "calage du premier vertical", cle: "calage", groupe: "Les pages", erreur: { code: "TABLEAU_ECHEC", reessayable: false, messagePourWill: "Le calage sur la voix n'a pas abouti." } },
  { arret: "calage d'une autre sortie", cle: "calage", groupe: "Les pages", erreur: { code: "TABLEAU_ECHEC", reessayable: false, messagePourWill: MESSAGE_PROD }, suite: true },
  { arret: "mise en page", cle: "pages", groupe: "Les pages", erreur: { code: "TABLEAU_ECHEC", reessayable: false, messagePourWill: "Les pages n'ont pas abouti." } },
  { arret: "dessin d'une scène", cle: "scenes", groupe: "Les pages", erreur: { code: "TABLEAU_SCENE_RATEE", reessayable: true, messagePourWill: "Le dessin d'une scène n'a pas abouti." } },
  { arret: "montage", cle: "montage", groupe: "Les finitions", erreur: { code: "TABLEAU_ECHEC", reessayable: true, messagePourWill: "Le montage est arrêté." } },
  { arret: "contrôles finaux", cle: "controle", groupe: "Les finitions", erreur: { code: "TABLEAU_CONTROLES_BLOQUANTS", reessayable: false, messagePourWill: "La vérification bloque la livraison." } },
  { arret: "délai de garde", cle: "scenes", groupe: "Les pages", erreur: { code: "TABLEAU_SANS_NOUVELLE", reessayable: true, messagePourWill: "La fabrication n'a plus avancé depuis 45 min." } },
];

describe("table des arrêts : après chaque arrêt, chaque bouton proposé est accepté par le serveur", { timeout: 120_000 }, () => {
  for (const ligne of TABLE) {
    it(`${ligne.arret} : une étape en échec (« ${ligne.groupe} »), aucune roue ; « Reprendre la fabrication » et « Corriger la fiche » marchent`, async () => {
      const { videoId, travail } = await videoLancee();
      const arret = await arreter(videoId, travail, ligne.cle, ligne.erreur, { suite: ligne.suite });
      const groupes = etapesSuivi(arret.etapes, { arrete: true });
      expect(groupes.filter((g) => g.statut === "echec")).toEqual([{ nom: ligne.groupe, statut: "echec" }]);
      expect(groupes.some((g) => g.statut === "en-cours")).toBe(false);
      expect(issuesApresArret(arret)).toEqual(["corriger", "relancer"]);

      // « Reprendre la fabrication » : accepté (un prix à confirmer seulement si la voix n'est pas payée), la fabrication repart.
      // (Le service de l'action, avec le dépôt de la fiche simulé : la relance d'une relecture la range de nouveau.)
      let r = await creation.relancerTableau(arret.id, undefined, deps);
      if (ligne.prix) {
        expect(r.statut).toBe("accord-requis");
        if (r.statut !== "accord-requis") return;
        r = await creation.relancerTableau(arret.id, r.centimes, deps);
      } else expect((await relancerTableauAction(arret.id)).ok).toBe(true);
      expect(r).toMatchObject({ statut: "relancee" });
      if (r.statut !== "relancee") return;
      const relance = (await depots().travaux.obtenir(r.travailId))!;
      expect(["en_cours", "en_file"]).toContain(relance.statut);
      expect(relance.erreur).toBeUndefined();
      if (ligne.cle !== "fiche") expect(relance.id).toBe(arret.id);

      // « Corriger la fiche » (même arrêt, autre essai) : accepté, la vidéo redevient un brouillon.
      const second = await videoLancee();
      await arreter(second.videoId, second.travail, ligne.cle, ligne.erreur, { suite: ligne.suite });
      expect(await rouvrirFicheTableauAction(second.videoId)).toEqual({ ok: true, donnees: { videoId: second.videoId } });
      expect((await depots().videos.obtenir(second.videoId))?.statut).toBe("brouillon");
    });
  }

  it("arrêt par Will : la page propose « Reprendre » (et « Reprendre la fiche »), acceptés ; « Reprendre la fabrication » répond par une phrase", async () => {
    const { videoId, travail } = await videoLancee();
    await depots().travaux.enregistrer({ ...travail, statut: "annule", etapes: travail.etapes.map((e) => ({ ...e, statut: "ignoree" as const })) });
    await depots().videos.modifier(videoId, { statut: "annulee" });
    expect(issuesApresArret({ statut: "annule" })).toEqual(["corriger"]);
    expect(etapesSuivi(travail.etapes.map((e) => ({ ...e, statut: "en_attente" as const })), { arrete: true }).some((g) => g.statut === "en-cours")).toBe(false);
    const relance = await relancerTableauAction(travail.id);
    expect(relance).toMatchObject({ ok: true, donnees: { statut: "refusee", phrase: expect.stringContaining("Reprendre la fiche") } });
    expect(await rouvrirFicheTableauAction(videoId)).toEqual({ ok: true, donnees: { videoId } });
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("brouillon");
    // Le bouton « Reprendre » de la page (vidéo arrêtée) passe par le chemin commun : accepté lui aussi.
    await depots().videos.modifier(videoId, { statut: "annulee" });
    await reprendreVideo(videoId);
    expect((await depots().videos.obtenir(videoId))?.statut).toBe("brouillon");
  });

  it("arrêt à la relecture, puis la fiche change avant « Reprendre la fabrication » : refus (script à relire), aucun nouveau travail", async () => {
    const { videoId, travail } = await videoLancee();
    const arret = await arreter(videoId, travail, "fiche", TABLE[0].erreur);
    // Une nouvelle version de la fiche entre l'arrêt et la relance : ce n'est plus la fiche relue au lancement.
    const v = (await depots().videos.obtenir(videoId))!;
    const b = creation.lireBrouillonTableau(v)!;
    const autre = copie(b.versions.at(-1)!.fiche);
    autre.scenes[0] = { ...autre.scenes[0], texteDit: `${autre.scenes[0].texteDit} Encore.` };
    await depots().videos.modifier(videoId, { entrees: { ...v.entrees, tableauCreation: { ...b, versions: [...b.versions, { numero: b.versions.length + 1, fiche: autre, enregistreeLe: new Date().toISOString(), origine: "correction" }] } } });
    const travaux = await depots().travaux.compter();
    expect(await creation.relancerTableau(arret.id, 999_999, deps)).toEqual({ statut: "refusee", phrase: creation.RAISON_SCRIPT_NON_RELU });
    expect(await depots().travaux.compter()).toBe(travaux);
    expect((await depots().travaux.obtenir(arret.id))?.statut).toBe("echec");
  });

  it("aucun clic sans effet : une fabrication terminée ou introuvable répond par une phrase", async () => {
    const { travail } = await videoLancee();
    await depots().travaux.enregistrer({ ...travail, statut: "termine" });
    expect(await relancerTableauAction(travail.id)).toMatchObject({ ok: true, donnees: { statut: "refusee", phrase: expect.any(String) } });
    expect(await relancerTableauAction("trav-inconnu")).toMatchObject({ ok: true, donnees: { statut: "refusee", phrase: expect.any(String) } });
  });
});

/* ------------------------------------------------------------------ */
/* 3. « Corriger la fiche » après la voix : la voix est reprise ou relue  */
/* ------------------------------------------------------------------ */

describe("corriger la fiche après la voix : la voix n'est repayée que si le texte dit change", { timeout: 120_000 }, () => {
  const journalVoix = { version: "fabrication-tableau/1", etapes: { voix: { empreinte: "voix-1", dureeMs: 1, sortie: { coutCentimes: 34, caracteres: 900, fournisseur: "heygen" } } } };

  it("même texte dit : « la voix déjà payée sera réutilisée », aucun prix, la voix passe au moteur ; texte changé : relue, prix annoncé", async () => {
    const { videoId, travail } = await videoLancee();
    const arret = await arreter(videoId, travail, "calage", { code: "TABLEAU_ECHEC", reessayable: false, messagePourWill: MESSAGE_PROD }, { journal: journalVoix });
    await creation.rouvrirFicheTableau(videoId);
    const ecran = await creation.ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(ecran.brouillon).toMatchObject({ voix: "reutilisee", coutVoixCentimes: 0 });

    const lancements: string[] = [];
    const r = await creation.fabriquerVideoTableau(videoId, undefined, { ...deps, lancer: async (id) => (lancements.push(id), { travailId: "trav-suivant" }) }, await relu(videoId));
    expect(r).toMatchObject({ statut: "lancee" });
    expect(lancements).toEqual([videoId]);
    const entrees = (await depots().videos.obtenir(videoId))?.entrees as { tableau: { voixPayee?: { travailId: string; journal: unknown } } };
    expect(entrees.tableau.voixPayee?.travailId).toBe(arret.id);

    // Le texte dit change : la voix sera relue, et le prix est annoncé (et exigé) avant.
    await depots().videos.modifier(videoId, { statut: "echec" });
    await creation.rouvrirFicheTableau(videoId);
    const b = creation.lireBrouillonTableau(await depots().videos.obtenir(videoId))!;
    const s = b.versions.at(-1)!.fiche.scenes[0];
    expect(await creation.corrigerFicheTableau(videoId, [{ sceneId: s.id, texteDit: `${s.texteDit.replace(/[.!?]$/, "")} vraiment.` }], { aujourdhui: AUJOURDHUI_EXEMPLES })).toMatchObject({ statut: "enregistree" });
    const apres = await creation.ecranCreationTableau(videoId, { aujourdhui: AUJOURDHUI_EXEMPLES });
    expect(apres.brouillon?.raisonFabriquer).toBeNull();
    expect(apres.brouillon).toMatchObject({ voix: "relue" });
    expect(apres.brouillon!.coutVoixCentimes).toBeGreaterThan(0);
    const prix = await creation.fabriquerVideoTableau(videoId, undefined, { ...deps, lancer: async () => ({ travailId: "x" }) }, await relu(videoId));
    expect(prix).toMatchObject({ statut: "accord-requis", phrase: expect.stringContaining("Le texte dit a changé") });
  });

  it("moteur : une voix payée passée au lancement n'est ni relue ni recomptée", { timeout: 60_000 }, async () => {
    const d = doubles(ficheErreurCorrigee);
    const fiches = new Map<string, FicheTableau>();
    const outils = async () => versOutils(d, fiches);
    const moteur = creerMoteurMontageTableau({ outils });
    const cle = `studio/dev/fiches/${ficheErreurCorrigee.videoId}/1.json`;
    fiches.set(cle, structuredClone(ficheErreurCorrigee));
    const commande: CommandeFabrication = { ...commandeTableau({ videoId: ficheErreurCorrigee.videoId, fiche: ficheErreurCorrigee, texteScript: texteScriptDe(ficheErreurCorrigee), dureeSec: 30, centreSousTitresPct: 80, scenes: [], personnageId: "williams" }), entrees: { tableau: { ficheScenesCle: cle, version: 1 } } };
    let t = await moteur.lancer(commande, { travailId: "t1", versionId: "v1", titre: "x" });
    for (let n = 0; n < 200 && t.statut !== "termine"; n++) t = (await moteur.avancer(structuredClone(t), commande)).travail;
    expect(d.lectures()).toBe(1);
    const reprise = voixPayeeDuTravail(t)!;
    const suite = { ...commande, entrees: { tableau: { ...(commande.entrees as { tableau: object }).tableau, voixPayee: JSON.parse(JSON.stringify(reprise)) } } };
    let t2 = await moteur.lancer(suite, { travailId: "t2", versionId: "v2", titre: "x" });
    for (let n = 0; n < 200 && t2.statut !== "termine"; n++) t2 = (await moteur.avancer(structuredClone(t2), suite)).travail;
    expect(t2.statut).toBe("termine");
    expect(d.lectures()).toBe(1);
    expect(moteur.lignesPayees!(t2, suite).filter((l) => l.etape === "Voix")).toEqual([]);
  });
});
