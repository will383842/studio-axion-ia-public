/**
 * T-EXT-37a · ESSAI DE BOUT EN BOUT, AUTOMATIQUE, 0 € : du dossier zippé du pilote 05 Stocks à la vidéo découpée en
 * scènes. Moteur réel ; faux Claude, fausse voix, faux rendu (doubles de `doubles.ts`) ; aucun appel réel, aucun
 * navigateur, aucun fichier écrit, `fetch` interdit. Tous les interrupteurs ne sont allumés QUE dans les doubles.
 *
 * Maillons pas encore sur master, marqués « en attendant » (leur fiche les branchera ; ce test les reprendra alors) :
 * dépôt du formulaire (T-EXT-33), contrôle du zip (T-EXT-41), intégration des rôles dans la chaîne (T-EXT-35),
 * film de navigation (T-EXT-38), reprise après échec (T-EXT-45).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RapportControleImage, ResultatControle } from "@/briques/controle-image";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { CommandeFabrication, Notification, Travail, Video } from "@/domaine/types";
import { depots, reinitialiserDepots } from "@/donnees/memoire";
import type { EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { creerMoteurTutorielOutil, validerScriptTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import { ENTREE_DEVIS_TUTORIEL, etablirDevis, lireAccordDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { decouperEnMorceaux } from "@/moteurs/montage-tutoriel-outil/decoupage-scenes";
import { DUREE_CIBLE_SEC } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { etablirVerdict } from "@/moteurs/montage-tutoriel-outil/equipe/controleur";
import { etablirRegistre, figerRegistre, verifierRendu } from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import { noterTutoriel } from "@/moteurs/montage-tutoriel-outil/grille-qualite";
import type { MetaRangement } from "@/moteurs/montage-tutoriel-outil/index-scenes";
import { vueRoles } from "@/moteurs/montage-tutoriel-outil/vue-roles";
import type { ResultatFabrication } from "@/moteurs/types";
import { signalerSuivi, type CreerCloche } from "@/services/tutoriel-suivi";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";
import { FICHIERS_PILOTE_05, fabriquerZipPilote05, lireDossierPilote05, relireZip } from "./essai-complet/zip-pilote";

/* ------------------------------------------------------------------ */
/* Réglages et session simulés (aucune base, aucun réseau)             */
/* ------------------------------------------------------------------ */

const etat = vi.hoisted(() => ({ params: new Map<string, unknown>(), ecritures: [] as string[] }));
vi.mock("@/services/_commun", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/services/_commun")>();
  return {
    ...vrai,
    lireParametre: async (id: string, defaut: unknown) => (etat.params.has(id) ? etat.params.get(id) : defaut),
    ecrireParametre: async (id: string, valeur: unknown) => {
      etat.ecritures.push(id);
      etat.params.set(id, structuredClone(valeur));
    },
    journaliser: async () => undefined,
  };
});
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const scenes = await import("@/services/scenes-tutoriel");
const pioche = await import("@/services/pioche-commune");

const T0 = Date.UTC(2026, 10, 20, 9);
const T_ISO = new Date(T0).toISOString();
const VIDEO = "v-to";
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

/* ------------------------------------------------------------------ */
/* Le dossier du pilote 05, relu du zip fabriqué en mémoire            */
/* ------------------------------------------------------------------ */

function dossierPilote() {
  const zip = fabriquerZipPilote05();
  const fichiers = new Map(relireZip(zip).map((e) => [e.nom, new TextDecoder().decode(e.octets)]));
  return { zip, fichiers, script: fichiers.get("script-court.txt")!.trim(), pilote: JSON.parse(fichiers.get("commande-pilote.json")!) as { lancer: boolean; ratios: string[]; fin: string } };
}

/* ------------------------------------------------------------------ */
/* Faux Claude : un plan de 4 scènes (2 niveau 1, 2 niveau 2)           */
/* ------------------------------------------------------------------ */

function planQuatreScenes(requete: RequeteClaude): string {
  const lignes = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l));
  const n = lignes.length;
  const ms = (i: number, col: 2 | 3) => Number(lignes[i].split("\t")[col]);
  const bornes = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n];
  const sc = bornes.slice(0, 4).map((premier, i) => {
    const dernier = bornes[i + 1] - 1;
    const commun = { id: `s${i + 1}`, version: 1, mots: { premier, dernier }, debutMs: ms(premier, 2), finMs: i === 3 ? ms(n - 1, 3) : ms(bornes[i + 1], 2), position: "plein" as const };
    return i % 2 === 0
      ? { ...commun, niveau: 1, transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, piece: "fenetre-app", parametres: { titre: "Stocks", onglets: ["Accueil", "Stocks"], ongletActif: i === 0 ? 0 : 1, contenu: "formulaire" } }
      : {
          ...commun,
          niveau: 2,
          transition: { entree: "glisse-haut", sortie: "fondu", dureeMs: 400 },
          piece: "legende",
          parametres: { texte: i === 1 ? "Alerte vue" : "Commande validée", sousTexte: "", style: "titre" },
          calques: [
            { piece: "curseur", parametres: { trajet: [{ x: 20, y: 20 }, { x: 70, y: 60 }], clic: true, partDeplacement: 0.6 }, debutMs: 0, zone: "plein" },
            { piece: "zoom-camera", parametres: { cible: { x: 70, y: 60 }, facteur: 1.6, moment: 0.3, titreFenetre: "Stocks" }, debutMs: 300, zone: "plein" },
          ],
        };
  });
  return JSON.stringify({ version: "plan-scenes-1", habillage: { fond: "ivoire", accent: "terracotta" }, scenes: sc });
}

/* ------------------------------------------------------------------ */
/* Les outils de l'essai : doubles + devis + finitions (allumés ici SEULEMENT) */
/* ------------------------------------------------------------------ */

interface Essai {
  journal: Journal;
  /** Textes remis à la voix (pour prouver qu'aucune phrase n'est ajoutée). */
  textesVoix: string[];
  outils: OutilsTutoriel;
}

function outilsEssai(commande: () => CommandeFabrication, options: { claudeEnPanne?: boolean; sansDevis?: boolean } = {}): Essai {
  const journal = journalVide();
  const textesVoix: string[] = [];
  const base = outilsDoubles(journal, { claudeEnPanne: options.claudeEnPanne });
  const service: ServiceRendu = {
    soumettre: (d) => base.rendu.service().soumettre(d),
    async etat(id): Promise<EtatRendu> {
      const e = await base.rendu.service().etat(id);
      const d = journal.rendus.find((x) => x.idRendu === id);
      if (d?.operation === "mesure-son" && e.statut === "termine") return { ...e, mesures: { lufs: -14.1, creteVraieDbtp: -2.3 } };
      return e;
    },
  };
  const voixDoubles = base.voix!;
  const voixBase = voixDoubles.voix();
  const voix = { ...voixBase, id: voixBase.id, async lire(d: { texte: string; idExterne: string }) { textesVoix.push(d.texte); return (voixBase as unknown as { lire: (x: typeof d) => Promise<unknown> }).lire(d); } };
  const outils: OutilsTutoriel = {
    ...base,
    voix: { ...voixDoubles, voix: () => voix as unknown as ReturnType<typeof voixDoubles.voix> },
    rendu: { ...base.rendu, service: () => service },
    finitions: { actif: true },
    claude: async (requete): Promise<ReponseClaude> => {
      if (!requete.json || options.claudeEnPanne) return base.claude(requete);
      journal.claude.push(requete);
      return { texte: planQuatreScenes(requete), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 10, sortie: 10 } } as unknown as ReponseClaude;
    },
    ...(options.sansDevis
      ? {}
      : {
          devis: {
            roles: [{ id: "plan", essaisMax: 2 }],
            accord: lireAccordDevis(commande().entrees),
            consomme: async (e) => ({ appelsClaude: (e.appelsClaude?.script ?? 0) + (e.appelsClaude?.plan ?? 0), caracteresVoix: e.audio && !e.audio.reutilise ? e.audio.caracteres : 0, rendus: e.rendus.length }),
          },
        }),
  };
  return { journal, textesVoix, outils };
}

async function mener(outils: OutilsTutoriel, c: () => CommandeFabrication, travail?: Travail, jusqua = 700) {
  const moteur = creerMoteurTutorielOutil({ outils: une(outils) });
  let t = travail ?? (await moteur.lancer(c(), { travailId: "t-essai", versionId: "ver-1", titre: "Pilote 05 Stocks", maintenant: T0 }));
  let resultat: ResultatFabrication | undefined;
  for (let i = 0; i < jusqua; i++) {
    const r = await moteur.avancer(t, c(), T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { moteur, travail: t, resultat };
}

const pause = (t: Travail) => (t.parametres?.pause as { code: string; message: string } | undefined) ?? null;
const compos = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");
const unMot = (s: string) => s.replace(/\s+/g, " ").trim();

/** Textes visibles d'un plan (titres, onglets, légendes) : les seuls champs de texte des pièces du double de plan. */
const CLES_TEXTES_PLAN = new Set(["titre", "onglets", "texte", "sousTexte"]);
function textesDuPlan(v: unknown, cle = "", sortie: string[] = []): string[] {
  if (typeof v === "string") {
    if (CLES_TEXTES_PLAN.has(cle) && v.trim() !== "") sortie.push(v);
  } else if (Array.isArray(v)) for (const x of v) textesDuPlan(x, cle, sortie);
  else if (typeof v === "object" && v !== null) for (const [k, x] of Object.entries(v)) textesDuPlan(x, k, sortie);
  return sortie;
}

function commandePilote(d: ReturnType<typeof dossierPilote>, accord?: string): CommandeFabrication {
  const c = commandeTutoriel({
    dureeCibleSec: 47,
    ratios: d.pilote.ratios as CommandeFabrication["ratios"],
    script: { blocs: [], texteComplet: d.script },
    entrees: { tutorielOutil: { scriptColle: true }, ...(accord ? { [ENTREE_DEVIS_TUTORIEL]: { empreinte: accord, le: T_ISO } } : {}) },
  });
  return c;
}

/** Le devis tel que le moteur l'établit au pas de la voix (script lu, voix à payer, un seul appel de plan permis deux fois). */
function empreinteDevis(c: CommandeFabrication): string {
  const texte = c.script.texteComplet;
  return etablirDevis({ roles: [{ id: "plan", essaisMax: 2 }], caracteresScript: texte.length, texteScript: texte, motsScript: texte.split(/\s+/).filter(Boolean).length, voixDejaPayee: false, ratios: c.ratios, essai: false }).empreinte;
}

/* ------------------------------------------------------------------ */
/* Contrôle d'image « double » : mesures du rendu simulé, le reste en attendant T-EXT-35/38 */
/* ------------------------------------------------------------------ */

const IDS_IMAGE = ["volume", "crete", "image-noire", "image-figee", "duree", "zone-sure", "taille-texte", "contraste", "premiere-image"] as const;
const imageOk = (): RapportControleImage => ({
  controles: IDS_IMAGE.map((id): ResultatControle => ({ id: id as ResultatControle["id"], libelle: id, bloquant: true, etat: "reussi", raison: `raison ${id}` })),
  verdict: "livrable",
  nonFaits: 0,
  resume: "",
});

const META = (videoId: string): MetaRangement => ({
  videoId,
  versionVideoId: `${videoId}@1`,
  maquette: "05-stocks",
  sujet: null,
  licence: { type: "propriete", usageCommercial: true, reseaux: [] },
  famille: [],
  le: T_ISO,
});

beforeEach(() => {
  etat.params.clear();
  etat.ecritures.length = 0;
  reinitialiserDepots();
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit : l'essai complet est à 0 €");
  });
});

/* ------------------------------------------------------------------ */
/* L'essai                                                              */
/* ------------------------------------------------------------------ */

describe("T-EXT-37a · essai complet du pilote 05 Stocks, à 0 €", () => {
  it("du zip du pilote à la vidéo découpée, validée et piochable", async () => {
    // 1. Le dossier complet est fabriqué en mémoire et se relit à l'identique (en attendant T-EXT-41 pour le vrai contrôle).
    const d = dossierPilote();
    expect([...d.fichiers.keys()]).toEqual([...FICHIERS_PILOTE_05]);
    for (const e of lireDossierPilote05()) expect(d.fichiers.get(e.nom)).toBe(new TextDecoder().decode(e.octets));
    expect(d.pilote.lancer).toBe(false); // le dossier du pilote reste éteint : l'essai n'y touche pas
    expect(d.pilote.ratios).toEqual(["4:5", "9:16", "1:1"]);

    // 2. Dépôt (en attendant T-EXT-33 `deposerTutoriel`) : la commande du pilote, accord du devis simulé à la bonne empreinte.
    const sans = commandePilote(d);
    const c = commandePilote(d, empreinteDevis(sans));
    const { journal: j, textesVoix, outils } = outilsEssai(() => c);

    // 3. La chaîne complète avec doubles, jusqu'au bout.
    const { travail, resultat } = await mener(outils, () => c);
    expect(travail.statut).toBe("termine");
    expect(travail.erreur).toBeUndefined();
    expect(pause(travail)).toBeNull();
    expect(resultat).toBeDefined();

    // 4. Vérifications.
    // 3 ratios, dans l'ordre 4:5 → 9:16 → 1:1.
    expect(resultat!.sorties.map((s) => s.ratio)).toEqual(["4:5", "9:16", "1:1"]);
    expect(compos(j).map((x) => x.parametres.composition)).toEqual(["TutorielOutil", "TutorielOutil", "TutorielOutil"]);
    const p45 = compos(j)[0].parametres.proprietes as { plan: PlanValide; fin: { titre: string; sousTitre: string }; finMs: number };
    const p916 = compos(j)[1].parametres.proprietes as { plan: PlanValide };
    const p11 = compos(j)[2].parametres.proprietes as { plan: PlanValide };
    expect(p45.plan.format).toEqual({ largeur: 1080, hauteur: 1350, fps: 25 });
    expect(p916.plan.format).toEqual({ largeur: 1080, hauteur: 1920, fps: 25 });
    expect(p11.plan.format).toEqual({ largeur: 1080, hauteur: 1080, fps: 25 });

    // Durée 40 à 55 s hors fin ; la carte de fin est celle du Studio (jamais écrite par la voix).
    const dureeHorsFin = p45.plan.dureeMs / 1000;
    expect(dureeHorsFin).toBeGreaterThanOrEqual(DUREE_CIBLE_SEC[0]);
    expect(dureeHorsFin).toBeLessThanOrEqual(DUREE_CIBLE_SEC[1]);
    expect(p45.finMs).toBeGreaterThan(0);
    expect(p45.fin.titre).toBe("Axion IA"); // la fin « Prendre rendez-vous » se choisit dans le formulaire : en attendant T-EXT-33

    // Aucune phrase ajoutée à la voix : le texte lu est le script du dossier, mot pour mot, lu une seule fois.
    expect(textesVoix.map(unMot)).toEqual([unMot(d.script)]);
    expect(j.voix).toHaveLength(1);
    // Un seul plan demandé à Claude (double), aucun appel d'écriture : le script collé fait foi.
    expect(j.claude).toHaveLength(1);

    // Rendu : mixage une fois, mesure du son et vignette par format, tous simulés.
    expect(j.rendus.filter((x) => x.operation === "mixage")).toHaveLength(1);
    expect(j.rendus.filter((x) => x.operation === "mesure-son")).toHaveLength(3);
    expect(j.rendus.filter((x) => x.operation === "miniature")).toHaveLength(3);
    const lufs = resultat!.sorties[0].rapportQualite.niveauSonoreLufs;
    expect(lufs).toBe(-14.1);

    // 0 € : aucune ligne de dépense « reel » à un montant non nul, aucun réglage écrit, aucun fichier écrit.
    expect(resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
    expect(etat.ecritures).toEqual([]);

    // Découpe (14) en morceaux autonomes, un par scène du plan.
    const plan = (resultat!.projetMontage.tutoriel as { plan: { plan: PlanValide } }).plan.plan;
    expect(plan.scenes).toHaveLength(4);
    const decoupe = decouperEnMorceaux({ plan });
    if (!decoupe.ok) throw new Error(`découpage refusé : ${decoupe.erreurs.join(" ; ")}`);
    expect(decoupe.morceaux).toHaveLength(4);

    // Index (15) : appelé par le test lui-même tant qu'aucune fiche ne le branche en production (T-EXT-35).
    etat.params.set(scenes.PARAM_SCENES_TUTORIEL, true); // allumé dans le double seulement
    const index = await scenes.rangerScenesDeVideo({ morceaux: decoupe.morceaux, meta: META(VIDEO) });
    expect(index.entrees.map((e) => e.etat)).toEqual(["brouillon", "brouillon", "brouillon", "brouillon"]);
    expect(index.entrees.every((e) => e.cle.startsWith(`scene:${VIDEO}:`))).toBe(true);

    // Pioche (32) : avant la validation de Williams, rien n'est piochable.
    const besoin = {
      capacite: "ecran.telephone-extrait" as const,
      usage: "ecran" as const,
      sujet: null,
      sources: ["scene" as const],
      videoDemandeuse: "v-autre",
      reseaux: ["linkedin" as const],
      dejaUtilisees: [] as string[],
      graine: "essai",
      maintenant: new Date(T0),
      accepteTexteIncruste: true,
    };
    expect(pioche.candidatsScenes(await scenes.lireScenesGardees(), besoin)).toEqual([]);

    // Validation simulée de Williams sur 3 scènes : la pioche ne prend que les `validee`.
    for (const e of index.entrees.slice(0, 3)) await scenes.validerSceneGardee(e.cle);
    const apres = await scenes.lireScenesGardees();
    expect(apres.entrees.filter((e) => e.etat === "validee")).toHaveLength(3);
    const piochables = pioche.candidatsScenes(apres, besoin);
    expect(piochables.length).toBeGreaterThanOrEqual(3);
    expect(piochables.every((p) => p.cle.startsWith("scene:"))).toBe(true);
    expect(piochables.map((p) => p.cle)).not.toContain(index.entrees[3].cle);
    etat.params.set(pioche.PARAM_PIOCHE_COMMUNE, true);
    expect((await pioche.piocherCommun({ ...besoin }, { scenes: scenes.lireScenesGardees }))?.cle).toMatch(/^scene:/);

    // Grille (27) : mesures du rendu simulé ; contrôles d'image et du contrôleur en double (en attendant T-EXT-35/38).
    // Registre des textes (40, sur master) : établi et figé à partir du script du dossier et des textes du plan validé, puis vérifié
    // mot pour mot sur la voix réellement lue et les textes d'écran réellement passés au rendu double (4:5).
    const registre = etablirRegistre({
      script: { phrases: [d.script] },
      fin: "aucune",
      parcours: {},
      textesMaquette: plan.scenes.map((sc) => ({ etapeId: sc.id, textes: textesDuPlan(sc), creee: false })).filter((m) => m.textes.length > 0),
    });
    const fige = figerRegistre(registre, T_ISO);
    if (!fige.ok) throw new Error(fige.erreur);
    const ecranRendu = p45.plan.scenes.flatMap((sc) => textesDuPlan(sc)).map((texte) => ({ texte, ou: "maquette" as const }));
    expect(ecranRendu.length).toBeGreaterThan(0);
    const controleRegistre = verifierRendu(fige.registre, { voix: textesVoix[0] ?? "", sousTitres: [], ecran: ecranRendu });
    expect(controleRegistre).toMatchObject({ id: "TUT-REGISTRE", ok: true });
    // Le contrôle mord : une phrase ajoutée à la voix, ou un texte d'écran inconnu, le fait échouer.
    expect(verifierRendu(fige.registre, { voix: `${textesVoix[0] ?? ""} Essayez dès aujourd'hui.`, sousTitres: [], ecran: ecranRendu }).ok).toBe(false);
    expect(verifierRendu(fige.registre, { voix: textesVoix[0] ?? "", sousTitres: [], ecran: [...ecranRendu, { texte: "Texte jamais choisi", ou: "maquette" }] }).ok).toBe(false);
    // Les autres contrôles restent doubles, « en attendant » : écran immobile (TUT-IMAGE-FIXE dépend du film de T-EXT-38) et regardeur.
    const verdictDouble = etablirVerdict([
      ...["TUT-CHIFFRES", "TUT-MOMENTS", "MARQUE-MOTS", "MARQUE-COULEURS", "MARQUE-POLICE"].map((id) => ({ id, libelle: id, etat: "reussi" as const, bloquant: true, details: ["ok"] })),
      { id: controleRegistre.id, libelle: controleRegistre.id, etat: controleRegistre.ok ? ("reussi" as const) : ("echoue" as const), bloquant: true, details: [controleRegistre.message] },
    ]);
    const entreeGrille = { controleImage: imageOk(), controleur: verdictDouble, regardeur: { defauts: [], relues: 6, nonRelues: 0, partiesFautives: [] }, dureeSec: dureeHorsFin, imageFixeMaxSec: 0, niveauSonoreLufs: lufs };
    // QUAL-4 : sans contrôle de composition, il est « non fait » = à corriger (−8), jamais bloquant : la vidéo reste proposable mais jamais à 100.
    const sansCompo = noterTutoriel(entreeGrille);
    expect(sansCompo.criteres.filter((k) => k.etat !== "reussi").map((k) => [k.id, k.etat, k.gravite])).toEqual([["composition", "non-fait", "a-corriger"]]);
    expect(sansCompo.note).toBe(92);
    expect(sansCompo.proposable).toBe(true);
    const grille = noterTutoriel({ ...entreeGrille, composition: { ok: true, defauts: [], mesures: { textePlusPetitPx: null, videMaxMs: 0, echantillons: 1 } } });
    expect(grille.criteres.filter((k) => k.etat !== "reussi")).toEqual([]);
    expect(grille.proposable).toBe(true);

    // Suivi (34) : chaque étape faite, la vidéo prête est signalée UNE fois dans la cloche, jamais un échec.
    const roles = vueRoles(travail);
    expect(roles.some((r) => r.etat === "a-revoir" || r.etat === "attend-williams")).toBe(false);
    expect(roles.find((r) => r.role === "scenariste")!.etat).toBe("fait"); // les autres rôles : en attendant T-EXT-35
    expect(roles.find((r) => r.role === "realisateur")!.etat).toBe("fait");
    await depots().videos.enregistrer({ id: VIDEO, titre: "Stocks : le seuil franchi", creeLe: T_ISO, modifieLe: T_ISO } as Video);
    const posees: Parameters<CreerCloche>[0][] = [];
    const creer: CreerCloche = async (n) => {
      posees.push(n);
      await depots().notifications.enregistrer({ id: `not_${posees.length}`, lue: false, creeLe: T_ISO, modifieLe: T_ISO, ...n } as Notification);
    };
    await signalerSuivi({ ...travail, cibleId: VIDEO }, { creer, actif: true });
    await signalerSuivi({ ...travail, cibleId: VIDEO }, { creer, actif: true });
    expect(posees.map((n) => n.type)).toEqual(["video-prete"]);
    expect(posees.some((n) => n.type === "echec")).toBe(false);

    // Journal des doubles : seulement des appels simulés, et le dossier du pilote est resté tel quel.
    expect(d.pilote.lancer).toBe(false);
  });

  it("sans accord du devis : pause « TO_DEVIS_A_ACCEPTER », 0 appel voix / Claude / rendu, jamais un échec", async () => {
    const d = dossierPilote();
    const c = commandePilote(d);
    const { journal: j, outils } = outilsEssai(() => c);
    const { travail } = await mener(outils, () => c);
    expect(pause(travail)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    expect(travail.statut).toBe("en_file");
    expect(travail.erreur).toBeUndefined();
    expect([j.voix.length, j.claude.length, j.rendus.length]).toEqual([0, 0, 0]);
  });

  it("accord donné à un AUTRE devis (script modifié) : la pause revient, rien n'est dépensé", async () => {
    const d = dossierPilote();
    const c = commandePilote(d, empreinteDevis(commandePilote(d)));
    const modifie: CommandeFabrication = { ...c, script: { blocs: [], texteComplet: `${d.script} Essayez dès aujourd'hui.` } };
    const { journal: j, outils } = outilsEssai(() => modifie);
    const { travail } = await mener(outils, () => modifie);
    expect(pause(travail)?.code).toBe("TO_DEVIS_A_ACCEPTER");
    expect([j.voix.length, j.claude.length, j.rendus.length]).toEqual([0, 0, 0]);
  });

  it("panne : Claude indisponible quand le script est à écrire → pause claire, aucune voix payée, reprise après validation", async () => {
    const d = dossierPilote();
    const idee: CommandeFabrication = { ...commandePilote(d), script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { idee: "Stocks : le seuil franchi" } } };
    const { journal: j, outils } = outilsEssai(() => idee, { claudeEnPanne: true, sansDevis: true });
    const { travail } = await mener(outils, () => idee);
    expect(travail.statut).toBe("en_file");
    expect(travail.erreur).toBeUndefined(); // une pause claire, jamais un échec
    expect(pause(travail)?.code).toBe("TO_SCRIPT_NON_ECRIT");
    expect(j.voix).toEqual([]);
    expect(j.rendus).toEqual([]);
    // Williams colle son script : la fabrication reprend, la voix n'est payée qu'une fois (reprise complète : en attendant T-EXT-45).
    const reprise = await mener(outils, () => idee, validerScriptTutoriel(travail, d.script));
    expect(reprise.travail.statut).toBe("termine");
    expect(j.voix).toHaveLength(1);
  });
});
