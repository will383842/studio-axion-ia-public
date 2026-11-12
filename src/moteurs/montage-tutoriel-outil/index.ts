/**
 * MOTEUR « TUTORIEL D'OUTIL » (lot I) — la vraie chaîne remplace la vitrine « pas encore branchée » du lot G :
 * script (collé tel quel, ou écrit depuis une idée puis validé par Williams) → voix HeyGen épinglée → calage et
 * sous-titres → plan de scènes (générateur du lot C, validé, repli par scène) → rendu Remotion `TutorielOutil` en 4:5 →
 * autres formats demandés. Chaîne et pièces : `chaine.ts`.
 *
 * Le moteur n'importe aucun service ni fournisseur réel : les outils sont INJECTÉS (tests) ou posés par les services
 * (`services/tutoriel-branchements.ts`, `brancherServicesTutoriel`), sur le modèle du tableau animé. Sans outils reliés,
 * le travail reste en PAUSE claire (en file, sans échec, sans coût). Format sans prix : tous les montants sont nuls.
 * Les qualités à revoir sont des RÉSERVES « À vérifier · … » sur la vidéo, jamais un échec.
 */
import type { AlerteQualite, CommandeFabrication, ErreurTravail, LigneCout, Ratio, Travail } from "@/domaine/types";
import { ZERO } from "@/lib/montants";
import { obtenirReseau } from "@/reseaux";
import { reseauxDeCommande } from "@/briques/declinaison";
import { VoixNonEpingleeError } from "@/briques/voix-maitre/voix-epinglee";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, ParentRetouche, ResultatFabrication } from "../types";
import { avancerEtape, ErreurTutoriel, etatInitial, ETAPES_TUTORIEL, ratiosTutoriel, type CleEtapeTutoriel, type EtatTutoriel, type OutilsTutoriel } from "./chaine";

export { ENTREE_TUTORIEL, lireEntreesTutoriel, type EntreesTutoriel } from "./entrees";
export type { EtatTutoriel, OutilsTutoriel, OutilsVoixTutoriel } from "./chaine";

export const ID_MOTEUR_TUTORIEL_OUTIL = "montage-tutoriel-outil";
export const CODE_OUTILS_NON_RELIES = "TO_OUTILS_NON_RELIES";
export const PHRASE_OUTILS_NON_RELIES = "Le tutoriel d'outil attend ses outils de fabrication (voix, rendu) : votre demande est gardée, rien n'a échoué.";
const RESEAUX_CONSEILLES = ["linkedin", "instagram", "youtube-shorts"] as const;

/* ------------------------------------------------------------------ */
/* Raccords des services                                                */
/* ------------------------------------------------------------------ */

export type FabriqueOutilsTutoriel = (commande: CommandeFabrication, travailId: string) => Promise<OutilsTutoriel | null>;

export interface ServicesTutoriel {
  outils?: FabriqueOutilsTutoriel;
}

const cleServices = Symbol.for("studio-axion-ia.tutoriel-outil-services");
type AvecServices = typeof globalThis & { [cleServices]?: ServicesTutoriel };

export function brancherServicesTutoriel(s: ServicesTutoriel): void {
  (globalThis as AvecServices)[cleServices] = { ...((globalThis as AvecServices)[cleServices] ?? {}), ...s };
}

export function servicesTutoriel(): ServicesTutoriel {
  return (globalThis as AvecServices)[cleServices] ?? {};
}

/* ------------------------------------------------------------------ */
/* Étapes                                                               */
/* ------------------------------------------------------------------ */

const DEFINITIONS: Record<CleEtapeTutoriel, Omit<DefinitionEtapeMoteur, "dependDe">> = {
  script: { cle: "script", nom: "Le script", icone: "ecrire", dureeEstimeeSec: 2 },
  voix: { cle: "voix", nom: "La voix", icone: "micro", dureeEstimeeSec: 30 },
  calage: { cle: "calage", nom: "Le calage des mots", icone: "sous-titres", dureeEstimeeSec: 2 },
  plan: { cle: "plan", nom: "Le plan de scènes", icone: "baguette", dureeEstimeeSec: 40 },
  montage: { cle: "montage", nom: "Le montage 4:5", icone: "film", dureeEstimeeSec: 120 },
  exports: { cle: "exports", nom: "Les autres formats", icone: "film", dureeEstimeeSec: 120 },
};

/** Étapes d'un travail : `ratios` (réexport) remplace les formats de la commande ; `seulementRendu` : rien d'autre à faire. */
function etapesDe(commande: CommandeFabrication, ratios: Ratio[] = ratiosTutoriel(commande.ratios), seulementRendu = false): DefinitionEtapeMoteur[] {
  const cles = ETAPES_TUTORIEL.filter((c) => {
    if (seulementRendu) return c === "montage";
    if (c === "voix") return commande.distribution.length > 0;
    if (c === "exports") return ratios.length > 1;
    return true;
  });
  return cles.map((c, i) => ({ ...DEFINITIONS[c], ...(c === "montage" ? { nom: `Le montage ${ratios[0]}` } : {}), dependDe: i ? [cles[i - 1]] : [] }));
}

/* ------------------------------------------------------------------ */
/* Estimation (format sans prix : quantités visibles, montants nuls)   */
/* ------------------------------------------------------------------ */

function ligne(etape: string, fournisseur: string, unite: LigneCout["unite"], quantite: number, nature: LigneCout["nature"]): LigneCout {
  return { etape, fournisseur, unite, quantite, prixUnitaire: ZERO, total: ZERO, nature };
}

function estimation(lignes: LigneCout[], dureeFabricationSec: number): Estimation {
  return { dureeFabricationSec, lignes, total: ZERO };
}

function lignesEstimees(commande: CommandeFabrication): LigneCout[] {
  const l: LigneCout[] = [];
  if (commande.distribution.length) l.push(ligne("Voix", "heygen", "caractere", (commande.script.texteComplet ?? "").length, "estime"));
  l.push(ligne("Plan de scènes", "claude", "appel", 1, "estime"));
  l.push(ligne("Montage tutoriel d'outil", "studio", "forfait", 1, "estime"));
  return l;
}

/* ------------------------------------------------------------------ */
/* Travaux                                                              */
/* ------------------------------------------------------------------ */

function lireEtat(travail: Travail): EtatTutoriel {
  const e = travail.parametres?.tutoriel as EtatTutoriel | undefined;
  return e && typeof e === "object" && Array.isArray(e.rendus) ? e : { ratios: ["4:5"], rendus: [], reserves: [] };
}

function avecEtat(travail: Travail, etat: EtatTutoriel): Travail {
  return { ...travail, parametres: { ...travail.parametres, tutoriel: etat } };
}

function sansPause(travail: Travail): Travail {
  if (!travail.parametres?.pause) return travail;
  const { pause: _p, ...parametres } = travail.parametres;
  void _p;
  return { ...travail, parametres };
}

function nouveauTravail(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, etat: EtatTutoriel): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
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
    fournisseurUtilise: ID_MOTEUR_TUTORIEL_OUTIL,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(maintenant + defs.reduce((s, d) => s + d.dureeEstimeeSec, 0) * 1000).toISOString(),
    parametres: { tutoriel: etat },
  };
}

/** Ce que la version d'avant offre (projet de montage) : son plan et sa voix, repris sans être refaits ni repayés. */
export function lireProjetTutoriel(projetMontage: Record<string, unknown> | undefined): Pick<EtatTutoriel, "script" | "audio" | "sousTitres" | "motsPlan" | "plan"> | null {
  const p = projetMontage?.tutoriel as Pick<EtatTutoriel, "script" | "audio" | "sousTitres" | "motsPlan" | "plan"> | undefined;
  return p && typeof p === "object" && p.plan?.plan ? p : null;
}

function erreurLisible(err: unknown): ErreurTravail {
  if (err instanceof VoixNonEpingleeError) return { code: err.code, reessayable: false, messagePourWill: err.messagePourWill };
  if (err instanceof ErreurTutoriel) return { code: err.code, reessayable: err.reessayable, messagePourWill: err.messagePourWill };
  if (err instanceof ErreurRendu) return { code: "TO_RENDU", reessayable: true, messagePourWill: "Le rendu de la vidéo n'a pas abouti : « Réessayer » ne refait que le rendu." };
  const message = err instanceof Error ? err.message : "erreur inattendue";
  return { code: "TO_ETAPE", reessayable: true, messagePourWill: `Une étape s'est arrêtée (${message}) : « Réessayer » ne refait que cette étape et la suite.` };
}

/** Réserves (« À vérifier · … ») et remarques du plan, en alertes de la fiche vidéo. */
function alertesDe(etat: EtatTutoriel): AlerteQualite[] {
  const reserves = etat.reserves.map((message) => ({ code: "defaut-visuel" as const, gravite: "attention" as const, message }));
  const script = (etat.script?.remarques ?? []).map((m) => ({ code: "duree" as const, gravite: "info" as const, message: `Script : ${m}` }));
  const plan = (etat.plan?.remarques ?? []).filter((r) => r.code !== "LLM_INDISPONIBLE" && r.code !== "LLM_ILLISIBLE").map((r) => ({ code: "defaut-visuel" as const, gravite: "info" as const, message: `Plan · ${r.message}` }));
  return [...reserves, ...script, ...plan];
}

function resultatDe(etat: EtatTutoriel, commande: CommandeFabrication): ResultatFabrication {
  const alertes = alertesDe(etat);
  const attention = alertes.filter((a) => a.gravite === "attention").length;
  const reseaux = reseauxDeCommande(commande, [...RESEAUX_CONSEILLES]);
  const sorties = etat.ratios.map((ratio) => {
    const r = etat.rendus.find((x) => x.ratio === ratio)!;
    const { largeur, hauteur } = r.demande.parametres.proprietes ? (r.demande.parametres.proprietes as { plan: { format: { largeur: number; hauteur: number } } }).plan.format : { largeur: 0, hauteur: 0 };
    const servis = reseaux.filter((id) => {
      try {
        return obtenirReseau(id).ratioPrefere === ratio;
      } catch {
        return false;
      }
    });
    return {
      ratio,
      fichierCle: r.sortie!.fichierCle,
      vignetteCle: r.sortie!.fichierCle.replace(/\.mp4$/, ".jpg"),
      resolution: `${largeur}x${hauteur}`,
      dureeSec: r.sortie!.dureeSec,
      taille: r.sortie!.taille,
      rapportQualite: { note: Math.max(50, 100 - 10 * attention), verifie: { image: true, son: !!etat.audio?.fichierCle, sousTitres: commande.briques["sous-titres"] !== false, mentionIA: false, droits: true }, alertes, niveauSonoreLufs: -14 },
      ...(servis.length ? { reseaux: servis } : {}),
    };
  });
  const lignesReelles: LigneCout[] = [];
  if (etat.audio && etat.audio.caracteres > 0) lignesReelles.push(ligne("Voix", etat.audio.fournisseur, "caractere", etat.audio.caracteres, "reel"));
  if (etat.plan && etat.plan.source !== "repris") lignesReelles.push(ligne("Plan de scènes", "claude", "appel", 1, "reel"));
  lignesReelles.push(ligne("Montage tutoriel d'outil", "studio", "forfait", 1, "reel"));
  return {
    sorties,
    noteQualite: { globale: Math.max(50, 100 - 10 * attention), alertes },
    lignesReelles,
    ...(etat.sousTitres && commande.briques["sous-titres"] !== false ? { sousTitres: etat.sousTitres } : {}),
    projetMontage: {
      moteur: ID_MOTEUR_TUTORIEL_OUTIL,
      tutoriel: { script: etat.script, audio: etat.audio, sousTitres: etat.sousTitres, motsPlan: etat.motsPlan, plan: etat.plan },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Validation du script écrit (Williams)                                */
/* ------------------------------------------------------------------ */

/**
 * Williams valide (et a pu modifier) le script proposé : il fait foi, la fabrication reprend au pas suivant. Le texte
 * vide garde la proposition telle quelle. Aucune vérification bloquante : seules des remarques.
 */
export function validerScriptTutoriel(travail: Travail, texte?: string): Travail {
  const etat = lireEtat(travail);
  const valide = (texte ?? etat.proposition ?? "").trim();
  if (!valide) return travail;
  const { proposition: _p, ...reste } = etat;
  void _p;
  return sansPause(avecEtat({ ...travail, statut: "en_cours" }, { ...reste, script: { texte: valide, source: "valide", remarques: [] } }));
}

/* ------------------------------------------------------------------ */
/* Moteur                                                               */
/* ------------------------------------------------------------------ */

export interface DependancesMoteurTutoriel {
  /** Outils injectés (tests) ; absents : ceux des services. */
  outils?: FabriqueOutilsTutoriel;
}

const RATIOS_TUTORIEL: Ratio[] = ["4:5", "9:16", "1:1", "16:9"];

export function creerMoteurTutorielOutil(deps: DependancesMoteurTutoriel = {}): MoteurVideo {
  const fabriqueOutils = (): FabriqueOutilsTutoriel | undefined => deps.outils ?? servicesTutoriel().outils;

  async function avancer(travail: Travail, commande: CommandeFabrication, maintenant = Date.now()): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
    if (["termine", "echec", "annule"].includes(travail.statut)) return { travail };
    const iso = new Date(maintenant).toISOString();
    const fabrique = fabriqueOutils();
    const outils = fabrique ? await fabrique(commande, travail.id) : null;
    if (!outils) return { travail: { ...travail, statut: "en_file", modifieLe: iso, parametres: { ...travail.parametres, pause: { code: CODE_OUTILS_NON_RELIES, message: PHRASE_OUTILS_NON_RELIES } } } };

    let etat = lireEtat(travail);
    const etape = travail.etapes.find((e) => e.statut !== "terminee" && e.statut !== "ignoree");
    if (!etape) return { travail };
    const cle = etape.cle as CleEtapeTutoriel;
    const base = sansPause(travail);

    if (commande.simulerEchecEtape === cle && !etat.echecSimuleFait) {
      etat = { ...etat, echecSimuleFait: true };
      const erreur: ErreurTravail = { code: "TO_ECHEC_SIMULE", reessayable: true, messagePourWill: `Échec simulé de l'étape « ${etape.nom} » : « Réessayer » la reprend.` };
      return { travail: avecEtat({ ...base, statut: "echec", erreur, modifieLe: iso, etapes: base.etapes.map((e) => (e.cle === cle ? { ...e, statut: "echec" as const, erreur } : e)) }, etat) };
    }

    let pas;
    try {
      pas = await avancerEtape(cle, etat, commande, outils, travail.id);
    } catch (err) {
      const erreur = erreurLisible(err);
      return { travail: { ...base, statut: "echec", erreur, modifieLe: iso, etapes: base.etapes.map((e) => (e.cle === cle ? { ...e, statut: "echec" as const, erreur } : e)) } };
    }
    if (pas.statut === "pause") {
      const t = avecEtat({ ...base, statut: "en_file", modifieLe: iso, parametres: { ...base.parametres, pause: { code: pas.code, message: pas.message, ...(pas.etat.proposition ? { script: pas.etat.proposition } : {}) } } }, pas.etat);
      return { travail: t };
    }
    const faite = pas.statut === "faite";
    const etapes = base.etapes.map((e) =>
      e.cle === cle ? { ...e, statut: faite ? ("terminee" as const) : ("en_cours" as const), progression: faite ? 100 : 50, ...(faite ? { coutReel: ZERO } : {}) } : e,
    );
    const finies = etapes.filter((e) => e.statut === "terminee" || e.statut === "ignoree").length;
    const tout = finies === etapes.length;
    const suivant = avecEtat({ ...base, etapes, statut: tout ? "termine" : "en_cours", progression: tout ? 100 : Math.round((finies / etapes.length) * 100), modifieLe: iso, ...(tout ? { termineLe: iso } : {}) }, pas.etat);
    return tout ? { travail: suivant, resultat: resultatDe(pas.etat, commande) } : { travail: suivant };
  }

  /** Travail repris d'une version d'avant : son script, sa voix et son plan, jamais repayés. */
  function etatDepuisParent(commande: CommandeFabrication, parent: ParentRetouche | undefined, ratios?: Ratio[]): EtatTutoriel {
    const p = lireProjetTutoriel(parent?.projetMontage);
    const e = etatInitial(commande);
    return { ...e, ...(ratios ? { ratios } : {}), ...(p ? { parent: { plan: p.plan?.plan, ...(p.audio ? { audio: p.audio } : {}) } } : {}) };
  }

  return {
    id: ID_MOTEUR_TUTORIEL_OUTIL,
    nom: "Montage tutoriel d'outil",
    capacites: { dureeMaxSec: 120, ratios: RATIOS_TUTORIEL, langues: ["fr"], retoucheParPlan: true, asynchrone: true, accordExige: false, maquette: false },
    estimer: async (c) => estimation(lignesEstimees(c), etapesDe(c).reduce((s, d) => s + d.dureeEstimeeSec, 0)),
    estimerRetouche: async () => estimation([ligne("Retouche tutoriel d'outil", "studio", "forfait", 1, "estime")], 120),
    estimerReexport: async (_c, ratio) => estimation([ligne(`Format ${ratio}`, "studio", "forfait", 1, "estime")], 120),
    etapes: (c) => etapesDe(c),
    lancer: async (commande, contexte) => nouveauTravail(etapesDe(commande), contexte, commande, etatInitial(commande)),
    refusAuLancement: () => null,
    avancer,
    reessayer: async (travail, maintenant = Date.now()) => {
      const iso = new Date(maintenant).toISOString();
      const enEchec = new Set(travail.etapes.filter((e) => e.statut === "echec").map((e) => e.cle));
      // Les étapes qui dépendent d'une étape en échec (directement ou non) reprennent aussi.
      let ajoute = true;
      while (ajoute) {
        ajoute = false;
        for (const e of travail.etapes) if (!enEchec.has(e.cle) && e.statut !== "terminee" && e.dependDe.some((d) => enEchec.has(d))) ajoute = !!enEchec.add(e.cle);
      }
      const { erreur: _e, ...reste } = travail;
      void _e;
      return { ...reste, statut: "en_cours", tentatives: travail.tentatives + 1, modifieLe: iso, etapes: travail.etapes.map((e) => (enEchec.has(e.cle) ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined } : e)) };
    },
    retoucher: async ({ commande, contexte, parent }) => {
      const ctx = { ...contexte, type: "retouche" as const };
      return nouveauTravail(etapesDe(commande), ctx, commande, etatDepuisParent(commande, parent));
    },
    reexporter: async ({ commande, contexte, cible, parent }) => {
      const ratio = "ratio" in cible ? cible.ratio : obtenirReseau(cible.reseau).ratioPrefere;
      const ctx = { ...contexte, type: "reexport" as const };
      const p = lireProjetTutoriel(parent?.projetMontage);
      // Rien à reprendre : toute la chaîne, pour ce seul format.
      if (!p?.script || !p.audio || !p.sousTitres || !p.motsPlan || !p.plan) return nouveauTravail(etapesDe(commande, [ratio]), ctx, commande, { ...etatInitial(commande), ratios: [ratio] });
      const etat: EtatTutoriel = { ratios: [ratio], rendus: [], reserves: [], script: p.script, audio: p.audio, sousTitres: p.sousTitres, motsPlan: p.motsPlan, plan: { ...p.plan, source: "repris", scenesTouchees: [] } };
      return nouveauTravail(etapesDe(commande, [ratio], true), ctx, commande, etat);
    },
    // Pas de maquette : la durée attendue est celle du script.
    maquette: async (commande) => ({ dureeSec: commande.dureeCibleSec }),
    annuler: async (travail, maintenant = Date.now()) => {
      if (travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      // Les étapes terminées gardent leur état (et leur coût) ; les autres ne reprendront pas.
      return { ...travail, statut: "annule", modifieLe: iso, etapes: travail.etapes.map((e) => (e.statut === "en_cours" ? { ...e, statut: "ignoree" as const } : e)) };
    },
  };
}

export const moteurMontageTutorielOutil = creerMoteurTutorielOutil();
