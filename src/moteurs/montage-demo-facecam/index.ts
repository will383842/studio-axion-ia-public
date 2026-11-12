/**
 * MOTEUR « DÉMO FACECAM » (lot J) — rendu RÉEL branché à la place de la pause « pas encore branchée » du lot G.
 * Williams en facecam sur une moitié, son écran réel sur l'autre, il explique en direct : voir `chaine.ts`.
 *
 * - Durée : celle de Williams, jamais refusée ni raccourcie. Aucun prix (lignes à 0). Aucun refus au lancement.
 * - Sans chaîne réelle reliée (serveurs de montage absents) : la fabrication reste en PAUSE claire, comme la vitrine
 *   du lot G (en file, sans échec, sans coût) ; jamais une vidéo d'essai à la place de la vraie.
 * - Fiche vidéo : sorties par format (4:5 d'abord), sous-titres calés, remarques (info) et réserves « À vérifier · … »
 *   (attention) dans `noteQualite.alertes`, plan de scènes et reprise dans `projetMontage`.
 * - Retouche : seules les parties touchées (empreintes de scènes du lot C) ; rien de touché → vidéo d'avant reprise.
 */
import type { AlerteQualite, CommandeFabrication, EtapeTravail, LigneCout, Travail } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import { listerReseaux } from "@/reseaux";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, ResultatFabrication, SortieProduite } from "../types";
import { fabriquerPasEncoreBranche, type DefinitionVitrine } from "../montage-vitrines/pause";
import { avancerChaineDemo, etatDemoInitial, etatPourRetoucheDemo, groupesSousTitres, lireRepriseDemo, ratiosDemo, signatureConsignes, type DependancesDemo, type EtatDemo, type RepriseDemo } from "./chaine";
import { dependancesDemoParDefaut } from "./dependances";
import { lireEntreesDemo } from "./entrees";
import { DUREE_CARTE_FIN_MS, TAILLES_DEMO, type RatioDemo } from "./mise-en-page";

export const ID_MOTEUR_DEMO_FACECAM = "montage-demo-facecam";

export const PHRASE_PAUSE_DEMO_FACECAM = "Le serveur de montage de la démo facecam n'est pas relié : vos vidéos sont gardées, rien n'a échoué.";

const ETAPES_FABRICATION: DefinitionEtapeMoteur[] = [
  { cle: "reception", nom: "Vos vidéos reçues", icone: "camera", dependDe: [], dureeEstimeeSec: 2 },
  { cle: "transcription", nom: "Votre parole", icone: "son", dependDe: ["reception"], dureeEstimeeSec: 30 },
  { cle: "sous-titres", nom: "Les sous-titres calés", icone: "sous-titres", dependDe: ["transcription"], dureeEstimeeSec: 20 },
  { cle: "plan", nom: "Le motion design", icone: "image", dependDe: ["sous-titres"], dureeEstimeeSec: 20 },
  { cle: "montage", nom: "L'écran partagé", icone: "ecran-partage", dependDe: ["plan"], dureeEstimeeSec: 120 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 2 },
];

const ETAPES_RETOUCHE: DefinitionEtapeMoteur[] = [
  { cle: "plan", nom: "Les scènes touchées", icone: "image", dependDe: [], dureeEstimeeSec: 2 },
  { cle: "montage", nom: "L'écran partagé", icone: "ecran-partage", dependDe: ["plan"], dureeEstimeeSec: 120 },
  { cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["montage"], dureeEstimeeSec: 2 },
];

const VITRINE: DefinitionVitrine = { id: ID_MOTEUR_DEMO_FACECAM, nom: "Montage démo facecam", phrasePause: PHRASE_PAUSE_DEMO_FACECAM, etapes: ETAPES_FABRICATION };

function lignes(nature: LigneCout["nature"]): LigneCout[] {
  return [{ etape: "Montage démo facecam", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature }];
}

const estimation = (dureeFabricationSec: number): Estimation => ({ dureeFabricationSec, lignes: lignes("estime"), total: ZERO });

function nouveauTravail(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, etat: EtatDemo): Travail {
  const iso = new Date(ctx.maintenant ?? Date.now()).toISOString();
  const type = ctx.type ?? "fabrication";
  return {
    id: ctx.travailId,
    type,
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${type}`,
    fournisseurUtilise: ID_MOTEUR_DEMO_FACECAM,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    parametres: { demo: etat },
  };
}

/** Avancement de chaque étape d'après l'état de la chaîne. */
export function etapesSelonEtat(etapes: EtapeTravail[], etat: EtatDemo): EtapeTravail[] {
  const rendus = Object.entries(etat.travaux).filter(([n]) => n.startsWith("rendu-"));
  const faite: Record<string, boolean> = {
    reception: true,
    transcription: etat.mots !== undefined,
    "sous-titres": etat.mots !== undefined && etat.synchro !== undefined,
    plan: etat.plan !== undefined,
    montage: !!etat.fini,
    controle: !!etat.fini,
  };
  const enCours: Record<string, boolean> = {
    transcription: Object.keys(etat.travaux).some((n) => n.startsWith("transcrire")),
    "sous-titres": !!etat.travaux.alignement,
    plan: etat.mots !== undefined,
    montage: rendus.length > 0,
  };
  let echecPose = false;
  return etapes.map((e) => {
    if (faite[e.cle]) return { ...e, statut: "terminee" as const, progression: 100, coutReel: ZERO, erreur: undefined };
    if (etat.echec && !echecPose) {
      echecPose = true;
      return { ...e, statut: "echec" as const, progression: 50, erreur: { code: "DEMO_FACECAM_ECHEC", reessayable: etat.echec.reessayable, messagePourWill: etat.echec.message, detailTechnique: `Étape « ${e.cle} ».` } };
    }
    if (enCours[e.cle]) {
      const p = e.cle === "montage" ? Math.round((rendus.filter(([, t]) => t.statut === "termine").length / Math.max(1, rendus.length)) * 90) + 5 : 50;
      return { ...e, statut: "en_cours" as const, progression: p };
    }
    return e;
  });
}

const reseauxDuRatio = (ratio: RatioDemo) => listerReseaux().filter((r) => !!r.zonesProtegees[ratio]).map((r) => r.id);

/** Alertes de la fiche vidéo : remarques (info) puis réserves « À vérifier » (attention). Jamais « bloquant ». */
export function alertesDemo(etat: EtatDemo): AlerteQualite[] {
  const code = (texte: string): AlerteQualite["code"] => (/synchro|calage/i.test(texte) ? "synchronisation" : /sous-titres/i.test(texte) ? "debordement-sous-titres" : /format|export/i.test(texte) ? "export" : "defaut-visuel");
  return [...etat.remarques.map((r) => ({ code: code(r.message), gravite: "info" as const, message: r.message })), ...etat.reserves.map((r) => ({ code: code(r), gravite: "attention" as const, message: r }))];
}

export function resultatDemo(commande: CommandeFabrication, etat: EtatDemo): ResultatFabrication {
  const alertes = alertesDemo(etat);
  const note = Math.max(60, 90 - 5 * etat.reserves.length);
  const dureeSec = Math.round(((etat.dureeSec ?? 0) + DUREE_CARTE_FIN_MS / 1000) * 100) / 100;
  const sorties: SortieProduite[] = ratiosDemo(commande)
    .filter((r) => etat.sorties[r])
    .map((ratio) => ({
      ratio,
      fichierCle: etat.sorties[ratio]!.fichierCle,
      vignetteCle: "",
      resolution: `${TAILLES_DEMO[ratio].largeur}x${TAILLES_DEMO[ratio].hauteur}`,
      dureeSec,
      taille: 0,
      reseaux: reseauxDuRatio(ratio),
      rapportQualite: { note, verifie: { image: true, son: true, sousTitres: (etat.mots?.length ?? 0) > 0, mentionIA: false, droits: false }, alertes, niveauSonoreLufs: -14 },
    }));
  const entrees = lireEntreesDemo(commande);
  const reprise: RepriseDemo = { mots: etat.mots ?? [], calage: etat.calage, dureeSec: etat.dureeSec ?? 0, synchro: etat.synchro ?? { mode: "aucune", decalageSec: 0 }, plan: etat.plan!, sorties: etat.sorties, signatureConsignes: signatureConsignes(entrees) };
  return {
    sorties,
    noteQualite: { globale: note, alertes },
    lignesReelles: lignes("reel"),
    sousTitres: groupesSousTitres(etat.mots ?? []).map((g, i) => ({ id: `st-${i}`, debutSec: g.debutMs / 1000, finSec: g.finMs / 1000, mots: g.mots.map((m) => ({ mot: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 })) })),
    projetMontage: {
      moteur: ID_MOTEUR_DEMO_FACECAM,
      version: "demo-facecam-1",
      sourcePlan: etat.sourcePlan,
      calage: etat.calage,
      synchro: etat.synchro,
      scenes: etat.plan?.scenes.map((s) => ({ id: s.id, empreinte: s.empreinte, niveau: s.niveau, piece: s.piece })) ?? [],
      ...(etat.scenesTouchees ? { scenesTouchees: etat.scenesTouchees } : {}),
      reprise,
    },
  };
}

export function creerMoteurMontageDemoFacecam(dependances: { chaine?: (c: CommandeFabrication, travailId?: string) => DependancesDemo | null } = {}): MoteurVideo {
  const chaineDe = (c: CommandeFabrication, travailId?: string) => (dependances.chaine ? dependances.chaine(c, travailId) : dependancesDemoParDefaut(c, process.env, travailId));

  async function avancer(travail: Travail, commande: CommandeFabrication, maintenant = Date.now()) {
    if (travail.statut === "termine" || travail.statut === "annule") return { travail };
    const precedent = travail.parametres?.demo as EtatDemo | undefined;
    const deps = precedent ? chaineDe(commande, travail.id) : null;
    // Pause (aucune chaîne reliée) : rien ne bouge, rien n'échoue.
    if (!precedent || !deps) return { travail };
    let etat: EtatDemo;
    try {
      etat = await avancerChaineDemo(precedent, commande, { travailId: travail.id, versionId: travail.versionId ?? commande.videoId }, deps);
    } catch {
      // Panne imprévue (stockage, réseau) : on retentera au tour suivant, rien n'est perdu.
      etat = precedent;
    }
    const etapes = etapesSelonEtat(travail.etapes, etat);
    const fini = !!etat.fini;
    const enEchec = etapes.find((e) => e.statut === "echec");
    const iso = new Date(maintenant).toISOString();
    const suivant: Travail = {
      ...travail,
      etapes,
      progression: fini ? 100 : Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(1, etapes.length)),
      statut: enEchec ? "echec" : fini ? "termine" : "en_cours",
      erreur: enEchec?.erreur,
      modifieLe: iso,
      termineLe: fini ? iso : undefined,
      parametres: { ...travail.parametres, demo: etat },
    };
    return fini ? { travail: suivant, resultat: resultatDemo(commande, etat) } : { travail: suivant };
  }

  const lancerAvec = (defs: DefinitionEtapeMoteur[], etat: EtatDemo) => (commande: CommandeFabrication, contexte: ContexteLancement) => {
    if (!chaineDe(commande)) return fabriquerPasEncoreBranche({ ...VITRINE, etapes: defs }, commande, contexte);
    return nouveauTravail(defs, contexte, commande, etat);
  };

  return {
    id: ID_MOTEUR_DEMO_FACECAM,
    nom: "Montage démo facecam",
    capacites: {
      // La durée est celle de Williams : aucune limite pratique, jamais de refus.
      dureeMaxSec: 3 * 3600,
      ratios: ["4:5", "9:16", "1:1", "16:9"],
      langues: ["fr", "fr-FR"],
      retoucheParPlan: true,
      asynchrone: true,
      accordExige: false,
      maquette: false,
    },
    estimer: async () => estimation(ETAPES_FABRICATION.reduce((t, e) => t + e.dureeEstimeeSec, 0)),
    estimerRetouche: async () => estimation(ETAPES_RETOUCHE.reduce((t, e) => t + e.dureeEstimeeSec, 0)),
    estimerReexport: async () => estimation(120),
    etapes: () => ETAPES_FABRICATION,
    // Rien n'est refusé : sans serveurs reliés, la demande est reçue puis mise en pause.
    refusAuLancement: () => null,
    refusRetouche: () => null,
    async lancer(commande, contexte) {
      return lancerAvec(ETAPES_FABRICATION, etatDemoInitial())(commande, contexte);
    },
    avancer,
    async reessayer(travail, maintenant = Date.now()) {
      const etat = travail.parametres?.demo as EtatDemo | undefined;
      if (!etat) return travail;
      // L'étape en échec repart (essais remis à zéro) ; tout ce qui est fait reste fait.
      const travaux = Object.fromEntries(Object.entries(etat.travaux).filter(([, t]) => t.statut !== "echec"));
      return { ...travail, statut: "en_cours", erreur: undefined, tentatives: travail.tentatives + 1, modifieLe: new Date(maintenant).toISOString(), parametres: { ...travail.parametres, demo: { ...etat, travaux, echec: undefined } } };
    },
    async retoucher({ commande, contexte, parent }) {
      const reprise = lireRepriseDemo(parent?.projetMontage);
      const ctx = { ...contexte, type: "retouche" as const };
      // Version d'avant sans reprise : tout est refait (jamais un refus).
      if (!reprise) return lancerAvec(ETAPES_FABRICATION, etatDemoInitial())(commande, ctx);
      return lancerAvec(ETAPES_RETOUCHE, etatPourRetoucheDemo(reprise, commande))(commande, ctx);
    },
    async reexporter({ commande, contexte, cible, parent }) {
      // Un format de plus : la reprise sert telle quelle, seul ce format est rendu.
      const ratio = "ratio" in cible ? cible.ratio : commande.ratios[0];
      const reprise = lireRepriseDemo(parent?.projetMontage);
      const c = { ...commande, ratios: [ratio] };
      const ctx = { ...contexte, type: "reexport" as const };
      if (!reprise) return lancerAvec(ETAPES_FABRICATION, etatDemoInitial())(c, ctx);
      const etat: EtatDemo = { ...etatDemoInitial(), mots: reprise.mots, calage: reprise.calage, dureeSec: reprise.dureeSec, synchro: reprise.synchro, plan: reprise.plan, sourcePlan: "reprise" };
      // Le 4:5 déjà fait est repris : seul le format ajouté passe au rendu.
      const maitre = reprise.sorties["4:5"];
      if (maitre) {
        etat.travaux["rendu-4:5"] = { id: "reprise", statut: "termine", essais: 1, resultat: { sortieCle: maitre.fichierCle } };
        etat.sorties["4:5"] = maitre;
      }
      return lancerAvec(ETAPES_RETOUCHE.filter((e) => e.cle !== "plan").map((e) => ({ ...e, dependDe: e.dependDe.filter((d) => d !== "plan") })), etat)(c, ctx);
    },
    maquette: async (commande) => ({ dureeSec: commande.dureeCibleSec }),
    async annuler(travail, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return { ...travail, statut: "annule", etapes: travail.etapes.map((e) => (e.statut === "terminee" ? e : { ...e, statut: "ignoree" as const, erreur: undefined })), erreur: undefined, modifieLe: iso, termineLe: iso };
    },
  };
}

export const moteurMontageDemoFacecam = creerMoteurMontageDemoFacecam();
