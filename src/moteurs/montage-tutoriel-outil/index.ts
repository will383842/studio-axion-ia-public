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
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { jsonCanonique } from "@/briques/plan-scenes/empreinte";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "../types";
import { empreinteAudioMaitre } from "@/briques/empreinte-audio";
import { bilanReprise, relancerRendusTombes } from "./reprise";
import { cibleSon, rapportSon } from "./finitions";
import { accordValide, etablirDevis, resteDuDevis, texteDevis, type Consommation } from "./devis-tutoriel";
import { scriptRetenu } from "./script";
import { figerScriptChoisi, type ChoixScript, type ScriptChoisi } from "./equipe/scenariste";
import { estSansVoix, lireEntreesTutoriel, NAVIGATION_REFUSEE_MAX } from "./entrees";
import { alertesDeGrille, marqueReussie, type AvecGrille } from "./grille-qualite";
import type { ResultatControleComposition } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import { lecturesVoixMax } from "@/briques/voix-maitre/reference";
import { avancerEtape, ErreurTutoriel, outilsVoixMaitre, etatInitial, ETAPES_TUTORIEL, prochainPasPaye, ratiosTutoriel, type CleEtapeTutoriel, type EtatTutoriel, type OutilsTutoriel, type SortieFormatTutoriel, sortieGardee } from "./chaine";
import { etapeIdsDuFilm, lireReglagesFilm, REMARQUE_REGLAGES_ILLISIBLES } from "@/services/retouche-chat/tutoriel-retouche-film";

export { ENTREE_TUTORIEL, lireEntreesTutoriel, type EntreesTutoriel } from "./entrees";
export type { EtatTutoriel, OutilsTutoriel, OutilsVoixTutoriel } from "./chaine";

export const ID_MOTEUR_TUTORIEL_OUTIL = "montage-tutoriel-outil";
export const CODE_OUTILS_NON_RELIES = "TO_OUTILS_NON_RELIES";
export const PHRASE_OUTILS_NON_RELIES = "Le tutoriel d'outil attend ses outils de fabrication : votre demande est gardée, rien n'a échoué.";
export const CODE_DEVIS_A_ACCEPTER = "TO_DEVIS_A_ACCEPTER";
export const PHRASE_DEVIS_A_ACCEPTER = "Le devis de cette vidéo attend votre accord : ouvrez l'écran de validation.";
export const CODE_DEVIS_ATTEINT = "TO_DEVIS_ATTEINT";
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
    if (c === "voix") return commande.distribution.length > 0 && !estSansVoix(commande.entrees);
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
  // T-EXT-SV : mode sans voix = aucune ligne « voix », donc rien à bloquer côté crédits.
  if (commande.distribution.length && !estSansVoix(commande.entrees)) l.push(ligne("Voix", "heygen", "caractere", (commande.script.texteComplet ?? "").length, "estime"));
  // QUAL-5 : sans voix et sans film de navigation, le plan est composé du script (0 appel Claude).
  if (!(estSansVoix(commande.entrees) && !lireEntreesTutoriel(commande.entrees).navigationFilmee)) l.push(ligne("Plan de scènes", "claude", "appel", 1, "estime"));
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
export function lireProjetTutoriel(projetMontage: Record<string, unknown> | undefined): (Pick<EtatTutoriel, "script" | "audio" | "sousTitres" | "motsPlan" | "plan" | "empreintesFormats" | "film" | "navigationFilm" | "reglagesFilm" | "equipe"> & { sortiesFormats?: Partial<Record<Ratio, SortieFormatTutoriel>> }) | null {
  const p = projetMontage?.tutoriel as (Pick<EtatTutoriel, "script" | "audio" | "sousTitres" | "motsPlan" | "plan" | "empreintesFormats" | "film" | "navigationFilm" | "reglagesFilm" | "equipe"> & { sortiesFormats?: Partial<Record<Ratio, SortieFormatTutoriel>> }) | undefined;
  return p && typeof p === "object" && p.plan?.plan ? p : null;
}

function erreurLisible(err: unknown): ErreurTravail {
  if (err instanceof VoixNonEpingleeError) return { code: err.code, reessayable: false, messagePourWill: err.messagePourWill };
  if (err instanceof ErreurTutoriel) return { code: err.code, reessayable: err.reessayable, messagePourWill: err.messagePourWill };
  if (err instanceof ErreurRendu) return { code: "TO_RENDU", reessayable: true, messagePourWill: "Le rendu de la vidéo n'a pas abouti : « Réessayer » ne refait que le rendu." };
  const message = err instanceof Error ? err.message : "erreur inattendue";
  return { code: "TO_ETAPE", reessayable: true, messagePourWill: `Une étape s'est arrêtée (${message}) : « Réessayer » ne refait que cette étape et la suite.` };
}

const REMARQUES_PLAN_GRAVES: ReadonlySet<string> = new Set(["SCENE_RETIREE", "SOUS_TITRES", "LITTERALITE", "TROP_COURT", "DENSITE", "TEXTE_TROP_LONG"]);

/** QUAL-4 : poids de la note sans grille (mêmes poids que `grille-qualite.ts`, + 10 par alerte « attention » comme avant). */
export function noteSansGrille(e: { bloquants: number; aCorriger: number; attention: number }): number {
  return Math.max(0, Math.min(100, 100 - 25 * e.bloquants - 8 * e.aCorriger - 10 * e.attention));
}

/** QUAL-4 : le contrôle de composition en alertes lisibles (absent : « non vérifiée », jamais réussi ; même règle que la grille, où l'absence vaut « non fait » et la note ne peut pas être de 100). */
function alertesComposition(compo: ResultatControleComposition | undefined): AlerteQualite[] {
  if (!compo) return [{ code: "defaut-visuel", gravite: "info", message: "Composition de l'image : non vérifiée (la note ne peut pas être de 100)" }];
  return compo.defauts.map((d) => ({ code: "defaut-visuel" as const, gravite: d.gravite === "bloquant" ? ("bloquant" as const) : ("attention" as const), message: `Composition · ${d.message}` }));
}

/** Avec une grille, le critère « composition » y est déjà (alertes de `alertesDeGrille`) : on n'ajoute les alertes de composition que sans grille, pour ne pas les dire deux fois. */
export function alertesCompositionSansDoublon(grille: unknown, compo: ResultatControleComposition | undefined): AlerteQualite[] {
  return grille ? [] : alertesComposition(compo);
}

/** Réserves (« À vérifier · … ») et remarques du plan, en alertes de la fiche vidéo. */
export function alertesDe(etat: EtatTutoriel): AlerteQualite[] {
  const reserves = etat.reserves.map((message) => ({ code: "defaut-visuel" as const, gravite: "attention" as const, message }));
  const script = (etat.script?.remarques ?? []).map((m) => ({ code: "duree" as const, gravite: "info" as const, message: `Script : ${m}` }));
  // QUAL-4 : une scène retirée ou déplacée, un texte trop long ou un plan trop dense changent ce que voit le spectateur : « attention », plus « info ».
  const plan = (etat.plan?.remarques ?? []).filter((r) => r.code !== "LLM_INDISPONIBLE" && r.code !== "LLM_ILLISIBLE").map((r) => ({ code: "defaut-visuel" as const, gravite: REMARQUES_PLAN_GRAVES.has(r.code) ? ("attention" as const) : ("info" as const), message: `Plan · ${r.message}` }));
  return [...reserves, ...script, ...plan];
}

/** Erreurs du lecteur du film dites en phrase simple : jamais un code de version ni un nom de champ. */
const phraseFilm = (erreur: string): string =>
  erreur.startsWith("Version inconnue") ? "le fichier de navigation n'est pas d'une version connue"
  : erreur.startsWith("La navigation filmée n'est pas un objet") ? "le fichier de navigation est illisible"
  : erreur.startsWith("La clé du film") ? "le film doit être un fichier .mp4 ou .webm"
  : erreur.startsWith("Les plages figées") ? "les arrêts sur image du film sont invalides"
  : erreur.replace(/\.$/, "");

/** Réserve « film refusé » : au plus NAVIGATION_REFUSEE_MAX raisons, « … » seulement s'il y en avait d'autres. */
export function messageFilmRefuse(erreurs: readonly string[]): string {
  const raisons = erreurs.slice(0, NAVIGATION_REFUSEE_MAX).map(phraseFilm).join(" ; ");
  return `À vérifier · Navigation : film refusé (${raisons}${erreurs.length > NAVIGATION_REFUSEE_MAX ? "…" : ""}). La vidéo a été montée sans le film. Refaites la capture, puis déposez de nouveau le film.`;
}

function resultatDe(etat: EtatTutoriel, commande: CommandeFabrication): ResultatFabrication {
  // T-EXT-27 : la grille chiffrée n'est rangée dans l'état que par le pas « regarder » (27b). Absente : exactement comme avant.
  const grille = (etat as EtatTutoriel & AvecGrille).grille;
  const alertesCommunes = alertesDe(etat);
  // QUAL-4 : lu de façon tolérante (le pas qui le calcule vient d'un autre lot) ; absent = non vérifié.
  const composition = (etat as EtatTutoriel & { composition?: ResultatControleComposition }).composition;
  const alertesCompo = alertesCompositionSansDoublon(grille, composition);
  const bloquantsCompo = composition?.defauts.filter((d) => d.gravite === "bloquant").length ?? 0;
  const aCorrigerCompo = (composition?.defauts.length ?? 0) - bloquantsCompo + (composition ? 0 : 1);
  if (grille) for (const a of alertesDeGrille(grille)) alertesCommunes.push({ code: "defaut-visuel", gravite: a.bloquant ? "attention" : "info", message: a.message });
  if (commande.briques["mention-ia"] === true) alertesCommunes.push({ code: "defaut-visuel", gravite: "info", message: "Mention IA demandée : pas encore posée par le tutoriel" });
  // ESS-6 : un film de navigation refusé n'est plus ignoré en silence ; le montage est resté sans film, on le dit.
  const refusee = lireEntreesTutoriel(commande.entrees).navigationRefusee;
  if (refusee?.length) alertesCommunes.push({ code: "defaut-visuel", gravite: "attention", message: messageFilmRefuse(refusee) });
  const cible = cibleSon(commande);
  const toutesAlertes: AlerteQualite[] = [...alertesCommunes];
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
    // T-EXT-31 : le son et la vignette disent ce qui est vrai (valeur mesurée, vignette réellement produite).
    const mesure = r.mesure?.resultat && r.mesure.resultat !== "echec" ? r.mesure.resultat : null;
    const son = rapportSon(mesure, cible, !!etat.audio?.fichierCle);
    const vignette = r.vignette?.resultat && r.vignette.resultat !== "echec" ? r.vignette.resultat.cle : undefined;
    const alertesSon: AlerteQualite[] = [
      ...(son.alerte ? [{ code: "defaut-visuel" as const, gravite: son.gravite ?? ("info" as const), message: son.alerte }] : []),
      ...(vignette ? [] : [{ code: "defaut-visuel" as const, gravite: "info" as const, message: "Vignette non produite" }]),
    ];
    const alertes = [...alertesCommunes, ...alertesSon];
    const alertesAffichees = [...alertes, ...alertesCompo];
    for (const a of alertesSon) if (!toutesAlertes.some((x) => x.message === a.message)) toutesAlertes.push(a);
    const attention = alertes.filter((a) => a.gravite === "attention").length;
    const noteSortie = grille ? grille.note : noteSansGrille({ bloquants: bloquantsCompo, aCorriger: aCorrigerCompo, attention });
    return {
      ratio,
      fichierCle: r.sortie!.fichierCle,
      // `SortieProduite.vignetteCle` est obligatoire : sans vignette produite, la chaîne vide est la valeur des autres moteurs pour « aucune »
      // (fabrication.ts lit `vignetteCle ?? ""`). On n'invente plus une clé .jpg qui n'existe pas.
      vignetteCle: vignette ?? "",
      resolution: `${largeur}x${hauteur}`,
      dureeSec: r.sortie!.dureeSec,
      taille: r.sortie!.taille,
      rapportQualite: { note: noteSortie, verifie: { image: true, son: son.sonVerifie, sousTitres: commande.briques["sous-titres"] !== false, mentionIA: false, droits: grille ? marqueReussie(grille) : false }, alertes: alertesAffichees, niveauSonoreLufs: son.niveauSonoreLufs },
      ...(servis.length ? { reseaux: servis } : {}),
    };
  });
  const attentionGlobale = toutesAlertes.filter((a) => a.gravite === "attention").length;
  for (const a of alertesCompo) toutesAlertes.push(a);
  const lignesReelles: LigneCout[] = [];
  if (etat.audio && etat.audio.caracteres > 0) lignesReelles.push(ligne("Voix", etat.audio.fournisseur, "caractere", etat.audio.caracteres, "reel"));
  // T-EXT-55 : une ligne réelle par rôle de l'équipe (appels REVENUS ; un appel repris par `payerUneFois` n'est pas recompté).
  for (const [role, n] of Object.entries(etat.appelsClaude?.roles ?? {})) if (n > 0) lignesReelles.push(ligne(`Tutoriel · ${role}`, "claude", "appel", n, "reel"));
  if (etat.appelsClaude?.script) lignesReelles.push(ligne("Script", "claude", "appel", etat.appelsClaude.script, "reel"));
  if (etat.appelsClaude?.plan) lignesReelles.push(ligne("Plan de scènes", "claude", "appel", etat.appelsClaude.plan, "reel"));
  lignesReelles.push(ligne("Montage tutoriel d'outil", "studio", "forfait", 1, "reel"));
  return {
    sorties,
    noteQualite: { globale: grille ? grille.note : noteSansGrille({ bloquants: bloquantsCompo, aCorriger: aCorrigerCompo, attention: attentionGlobale }), alertes: toutesAlertes },
    lignesReelles,
    ...(etat.sousTitres && commande.briques["sous-titres"] !== false ? { sousTitres: etat.sousTitres } : {}),
    projetMontage: {
      moteur: ID_MOTEUR_TUTORIEL_OUTIL,
      tutoriel: {
        script: etat.script,
        audio: etat.audio,
        sousTitres: etat.sousTitres,
        motsPlan: etat.motsPlan,
        plan: etat.plan,
        // T-EXT-53c : réglages du film (retouche par chat), gardés pour la version suivante ; absents : comme avant.
        ...(etat.reglagesFilm !== undefined ? { reglagesFilm: etat.reglagesFilm } : {}),
        // T-EXT-55 : l'équipe reste dans le projet (la retouche et le regardeur en ont besoin).
        ...(etat.equipe ? { equipe: etat.equipe } : {}),
        // T-EXT-52b : écrit seulement quand le réglage a calculé les empreintes (éteint : exactement comme avant).
        ...(etat.empreintesFormats
          ? {
              empreintesFormats: etat.empreintesFormats,
              sortiesFormats: Object.fromEntries(etat.rendus.filter((r) => r.sortie).map((r) => [r.ratio, sortieGardee(r)])),
              origineFormats: Object.fromEntries(etat.rendus.filter((r) => r.sortie).map((r) => [r.ratio, r.reprise ? "reprise" : "rendu"])),
              ...(etat.film ? { film: etat.film } : {}),
              ...(etat.navigationFilm ? { navigationFilm: etat.navigationFilm } : {}),
            }
          : {}),
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Validation du script écrit (Williams)                                */
/* ------------------------------------------------------------------ */

/**
 * Williams valide (et a pu modifier) le script proposé : il fait foi, la fabrication reprend au pas suivant. Le texte
 * vide garde la proposition telle quelle. Aucune vérification bloquante : seules des remarques.
 *
 * T-EXT-55 · ÉQUIPE présente dans l'état : il faut un choix (`{ version }` ou `{ corrige }`), ou un texte égal à celui déjà
 * choisi ou à l'une des deux versions ; le registre des textes doit être FIGÉ, sinon rien ne change. Le texte retenu est
 * celui de `figerScriptChoisi` (la correction de Williams, mot pour mot), jamais repassé par un rôle.
 */
export function validerScriptTutoriel(travail: Travail, texte?: string, choix?: ChoixScript): Travail {
  const etat = lireEtat(travail);
  const equipe = etat.equipe;
  if (!equipe) {
    const valide = (texte ?? etat.proposition ?? "").trim();
    if (!valide) return travail;
    const { proposition: _p, ...reste } = etat;
    void _p;
    return sansPause(avecEtat({ ...travail, statut: "en_cours" }, { ...reste, script: { texte: valide, source: "valide", remarques: [] } }));
  }
  if (!equipe.registre?.fige) return travail;
  const retenu = scriptDeValidation(equipe, texte, choix);
  if (!retenu?.texte.trim()) return travail;
  const { proposition: _p, ...reste } = etat;
  void _p;
  return sansPause(avecEtat({ ...travail, statut: "en_cours" }, { ...reste, equipe: { ...equipe, scriptChoisi: retenu }, script: { texte: retenu.texte, source: "valide", remarques: [] } }));
}

/** Le script que Williams a choisi : son choix, sinon celui déjà figé (même texte), sinon une des deux versions (même texte). */
function scriptDeValidation(equipe: NonNullable<EtatTutoriel["equipe"]>, texte: string | undefined, choix: ChoixScript | undefined): ScriptChoisi | null {
  const p = equipe.propositionScripts;
  if (choix) {
    if ("corrige" in choix ? typeof choix.corrige !== "string" || !choix.corrige.trim() : choix.version !== "A" && choix.version !== "B") return null;
    return p ? figerScriptChoisi(p, choix) : null;
  }
  const t = (texte ?? equipe.scriptChoisi?.texte ?? "").trim();
  if (!t) return null;
  if (equipe.scriptChoisi && equipe.scriptChoisi.texte.trim() === t) return equipe.scriptChoisi;
  const v = p?.versions.find((x) => x.phrases.map((ph) => ph.texte).join(" ").trim() === t);
  return p && v ? figerScriptChoisi(p, { version: v.id }) : null;
}

/* ------------------------------------------------------------------ */
/* Moteur                                                               */
/* ------------------------------------------------------------------ */

export interface DependancesMoteurTutoriel {
  /** Outils injectés (tests) ; absents : ceux des services. */
  outils?: FabriqueOutilsTutoriel;
}

const RATIOS_TUTORIEL: Ratio[] = ["4:5", "9:16", "1:1", "16:9"];

/** Pause du devis ; `devis` (AUD-7) n'est posé que pour TO_DEVIS_A_ACCEPTER. */
type PauseDevis = { code: string; message: string; devis?: { phrases: string[]; empreinte: string } };

/**
 * T-EXT-42 : garde du devis. `null` : pas de devis (éteint) ou étape sans dépense. Sinon une promesse de la pause à poser
 * (`null` = accord valide et plafond respecté, l'étape peut avancer). Jamais un échec, jamais un appel.
 * `accordExige` du moteur reste `false` et le format reste `sansPrix` : l'accord du tutoriel passe par SON devis en
 * quantités (écran de validation, T-EXT-24), pas par l'écran de prix, qui n'existe plus.
 */
function garderDevis(cle: CleEtapeTutoriel, etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PauseDevis | null> | null {
  const port = outils.devis;
  if (!port) return null;
  const entrees = lireEntreesTutoriel(commande.entrees);
  const aEcrire = "aEcrire" in scriptRetenu(commande.script.texteComplet, entrees);
  // Équipe allumée : un dossier, une phrase ou une idée passent par l'équipe (payante) MÊME si un travail d'avant la PR garde une
  // proposition de l'ancien écrivain (chaine.ts : pasScript va dans pasEquipe avant de regarder `etat.proposition`). La garde suit le même chemin.
  const idee = !etat.script && (!!outils.equipe ? (!!entrees.depot || aEcrire) : (!etat.proposition && aEcrire));
  const depense = cle === "script" ? idee : cle === "voix" || cle === "plan" || cle === "montage" || cle === "exports";
  if (!depense) return null;
  return (async () => {
    const texte = etat.script?.texte ?? commande.script.texteComplet ?? "";
    const lit = !!outils.voix && commande.distribution.length > 0 && !estSansVoix(commande.entrees) && !!etat.script;
    const parent = etat.parent?.audio;
    // Le devis reste le même du premier au dernier pas : seule la voix d'une version d'avant, reprise telle quelle, est « déjà payée ».
    const payee = (!!parent?.fichierCle && !!etat.script && parent.empreinte === empreinteAudioMaitre({ ...commande, script: { ...commande.script, texteComplet: etat.script.texte } }));
    // La voix compte le texte RÉELLEMENT lu (prononciations appliquées), à chaque prise : le devis couvre toutes les lectures permises.
    const lu = lit ? outilsVoixMaitre(outils.voix!, commande, texte).texte() : "";
    const lectures = lit ? lecturesVoixMax(outils.voix!.ressemblance) : 0;
    const devis = etablirDevis({
      roles: port.roles,
      caracteresScript: lu.length * lectures,
      texteScript: etat.script ? texte : "",
      motsScript: lu.split(/\s+/).filter(Boolean).length * lectures,
      voixDejaPayee: payee,
      ratios: etat.ratios,
      essai: false,
    });
    // AUD-7 : le devis montré part avec la pause (phrases + empreinte) : le geste « accepter le devis » ne vaut que pour CETTE empreinte.
    if (!accordValide(devis, port.accord)) return { code: CODE_DEVIS_A_ACCEPTER, message: PHRASE_DEVIS_A_ACCEPTER, devis: { phrases: texteDevis(devis), empreinte: devis.empreinte } };
    // Avant chaque dépense : le déjà consommé PLUS ce que cette étape peut encore dépenser doit tenir dans le devis.
    const essais = (id: string) => port.roles.filter((r) => r.id === id).reduce((s, r) => s + Math.max(0, Math.floor(r.essaisMax)), 0);
    const aVenir: Partial<Consommation> = {};
    // Le script : « script » (ancien écrivain) et, équipe allumée, chaque rôle de l'équipe (tout sauf le plan de scènes).
    // Équipe : seuls les essais RESTANTS (essais permis moins appels déjà faits) comptent, car `consomme` contient déjà ceux des rôles passés.
    // Le « +1 » (un rôle qui va être appelé coûte au moins un appel, même si tous les essais du devis sont faits : l'orchestre peut
    // permettre un essai de plus, qui ne passe que si « consommé + 1 » tient dans le devis) ne se compte QUE si le prochain pas paie
    // vraiment. Un pas gratuit (lecture d'une sortie déjà payée, réalisateur, contrôleur, registre, pause « à valider ») ne réserve rien :
    // sinon la vidéo s'arrêterait APRÈS son dernier appel payé et n'atteindrait jamais l'écran de validation.
    // Le plan de scènes, pas encore fait, reste RÉSERVÉ dans le devis : le total du devis le compte, donc un rôle ne peut pas
    // prendre ses appels (un essai de plus que ceux que le devis lui donne). Rôles + plan : « consommé + restants + plan » ≤ total.
    if (cle === "script") {
      // PHRASE-4 : un rôle qui ne peut plus être appelé ne réserve rien (la garde est exacte, le devis et son total ne changent pas).
      // Vérifié dans equipe/orchestre.ts (étapes citées par leur nom, pas par numéro de ligne) :
      //  - chef de projet : seul le test « pas de cahier » de « 1. Chef de projet » mène à l'appel du chef, et la lecture de sa sortie
      //    n'a lieu qu'après un tel appel. Dès que le cahier existe, plus aucun pas ne l'appelle, quel que soit le chemin (dossier ou phrase).
      //  - analyste : le seul appel de l'analyste est dans « 3. Analyste », qui exige qu'il n'y ait pas encore de carte. Sur le chemin
      //    « pièce créée » (phrase ouverte, aucun dossier lu), la carte vient de la pièce gardée, sans Claude, avec son empreinte, et le
      //    dossier de la pièce n'a aucun fichier. Une pièce non gardée s'arrête avant, par une pause, et si la déduction échoue la pièce
      //    repasse « à revoir » (pause au pas suivant) : l'analyste n'est jamais appelé tant que la pièce créée existe.
      //    Le dossier (.zip) n'a jamais de pièce créée : il garde ses essais d'analyste. Dans le doute (cahier sans entrée « C », port sans
      //    phrase ouverte, dépôt « dossier »), l'analyste reste réservé : le sens prudent.
      const sansChef = !!etat.equipe?.cahier;
      const sansAnalyste = !!etat.equipe?.pieceCreee && etat.equipe.cahier?.entree === "C" && outils.equipe?.phraseOuverte === true && entrees.depot?.mode !== "dossier";
      const ferme = (id: string) => (id === "chef-de-projet" && sansChef) || (id === "analyste" && sansAnalyste);
      const restants = port.roles.filter((r) => r.id !== "plan" && !ferme(r.id)).reduce((s, r) => s + Math.max(0, Math.floor(r.essaisMax) - (etat.appelsClaude?.roles?.[r.id] ?? 0)), 0);
      const paie = await prochainPasPaye(etat, commande, outils);
      aVenir.appelsClaude = (paie ? Math.max(1, restants) : restants) + (etat.plan ? 0 : essais("plan"));
    }
    else if (cle === "plan" && !etat.plan) aVenir.appelsClaude = essais("plan");
    else if (cle === "voix" && !etat.audio && lit && !payee) aVenir.caracteresVoix = lu.length;
    const reste = resteDuDevis(devis, await port.consomme(etat), aVenir);
    return reste.ok ? null : { code: CODE_DEVIS_ATTEINT, message: reste.message };
  })();
}

/** Une lecture partagée : le premier appel lit, les suivants rendent le même résultat (ou la même erreur). */
function lectureUnique<T>(lire: () => Promise<T>): () => Promise<T> {
  let promesse: Promise<T> | undefined;
  return () => (promesse ??= lire());
}

export function creerMoteurTutorielOutil(deps: DependancesMoteurTutoriel = {}): MoteurVideo {
  const fabriqueOutils = (): FabriqueOutilsTutoriel | undefined => deps.outils ?? servicesTutoriel().outils;

  async function avancer(travail: Travail, commande: CommandeFabrication, maintenant = Date.now()): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
    if (["termine", "echec", "annule"].includes(travail.statut)) return { travail };
    const iso = new Date(maintenant).toISOString();
    const fabrique = fabriqueOutils();
    const outilsBruts = fabrique ? await fabrique(commande, travail.id) : null;
    // Le dossier est lu UNE SEULE fois par pas : la garde du devis et le pas d'équipe décident sur la même lecture.
    const outils = outilsBruts?.equipe ? { ...outilsBruts, equipe: { ...outilsBruts.equipe, lireDossier: lectureUnique(outilsBruts.equipe.lireDossier.bind(outilsBruts.equipe)) } } : outilsBruts;
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

    // T-EXT-42 : le devis en quantités, montré et accepté AVANT toute étape qui peut dépenser. Absent = comportement d'avant.
    const arret = garderDevis(cle, etat, commande, outils);
    if (arret) {
      const pause = await arret;
      if (pause) {
        const attente: Travail = { ...base, statut: "en_file", modifieLe: iso, parametres: { ...base.parametres, pause } };
        // AUD-7 : le devis est rangé dans l'état de l'équipe quand elle existe (lu par l'écran de validation) ; sinon la pause seule le porte
        // (jamais d'équipe partielle : la chaîne en fabrique une complète quand elle n'en trouve pas).
        // Le cast : `devis` n'est pas dans EtatEquipe (equipe/orchestre.ts, interdit d'écriture) ; il n'est lu que par tutoriel-validation-ecran.ts.
        const avecDevis = pause.devis && etat.equipe ? avecEtat(attente, { ...etat, equipe: { ...etat.equipe, devis: pause.devis } as NonNullable<EtatTutoriel["equipe"]> }) : attente;
        return { travail: avecDevis };
      }
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
  function etatDepuisParent(commande: CommandeFabrication, parent: ParentRetouche | undefined, ratios?: Ratio[], operations?: OperationMontage[]): EtatTutoriel {
    const p = lireProjetTutoriel(parent?.projetMontage);
    const e = etatInitial(commande);
    const plan = p?.plan?.plan ? planRetouche(p.plan.plan, operations) : p?.plan?.plan;
    // T-EXT-52b : rendus, empreintes de formats et film de la version d'avant (absents si elle n'en a pas écrit).
    const avant = p ? { ...(p.sortiesFormats ? { rendus: p.sortiesFormats } : {}), ...(p.empreintesFormats ? { empreintesFormats: p.empreintesFormats } : {}), ...(p.film ? { film: p.film } : {}), ...(p.navigationFilm ? { navigationFilm: p.navigationFilm } : {}) } : {};
    const reglagesFilm = reglagesDeRetouche(p?.reglagesFilm, operations, etapeIdsDuFilm(commande.entrees), (m) => (e.reserves = [...e.reserves, m]));
    return { ...e, ...(ratios ? { ratios } : {}), ...(reglagesFilm !== undefined ? { reglagesFilm } : {}), ...(p ? { parent: { plan, ...(p.audio ? { audio: p.audio } : {}), ...avant } } : {}), ...(p?.equipe ? { equipe: p.equipe } : {}) };
  }

  /**
   * T-EXT-53c : la dernière opération `reglagesFilm` remplace les réglages d'avant, relue STRICTEMENT (étape absente du film, cran
   * inconnu ou champ en trop → refus). Illisible : réglages d'avant gardés, avec une réserve ; jamais d'exception.
   */
  function reglagesDeRetouche(avant: unknown, operations: OperationMontage[] | undefined, etapeIds: readonly string[], reserver: (m: string) => void): unknown {
    const op = operations?.filter((o): o is Extract<OperationMontage, { type: "reglagesFilm" }> => o.type === "reglagesFilm").at(-1);
    if (!op) return avant;
    const lu = lireReglagesFilm(op.reglages, etapeIds);
    if (!lu) {
      reserver(REMARQUE_REGLAGES_ILLISIBLES);
      return avant;
    }
    return lu;
  }

  /**
   * R3-01 : la dernière opération `planScenes` remplace le plan d'avant. Ignorée (plan d'avant gardé) si ses mots ou
   * son format diffèrent (sinon `pasPlan` rappellerait Claude, payant) ou si le plan est illisible.
   */
  function planRetouche(parent: PlanValide, operations?: OperationMontage[]): PlanValide {
    const op = operations?.filter((o): o is Extract<OperationMontage, { type: "planScenes" }> => o.type === "planScenes").at(-1);
    if (!op) return parent;
    const brut = op.plan as { mots?: unknown; format?: unknown } | null | undefined;
    if (!brut || typeof brut !== "object") return parent;
    if (brut.mots !== undefined && jsonCanonique(brut.mots) !== jsonCanonique(parent.mots)) return parent;
    if (brut.format !== undefined && jsonCanonique(brut.format) !== jsonCanonique(parent.format)) return parent;
    const r = validerPlan(op.plan, { mots: parent.mots, format: parent.format, facecam: false, dureeMs: parent.dureeMs });
    return r.remarques.some((x) => x.code === "PLAN_ILLISIBLE") ? parent : r.plan;
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
      // T-EXT-45b : un rendu tombé repart en série neuve (« Réessayer » le redemande vraiment) ; un rendu fini n'est jamais touché.
      const repris = enEchec.has("montage") || enEchec.has("exports") ? avecEtat(reste as Travail, relancerRendusTombes(lireEtat(travail))) : reste;
      // Fiche 45 point 5 : la phrase « ce qui est refait, ce qui est gardé » est rangée dans les paramètres du travail, où le suivi la lit.
      const bilan = bilanReprise(lireEtat(travail), [...enEchec]);
      const avecBilan = { ...repris, parametres: { ...repris.parametres, bilanReprise: { phrase: bilan.phrase, refait: bilan.refait, garde: bilan.garde } } };
      return { ...avecBilan, statut: "en_cours", tentatives: travail.tentatives + 1, modifieLe: iso, etapes: travail.etapes.map((e) => (enEchec.has(e.cle) ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined } : e)) };
    },
    retoucher: async ({ commande, contexte, parent, operations }) => {
      const ctx = { ...contexte, type: "retouche" as const };
      return nouveauTravail(etapesDe(commande), ctx, commande, etatDepuisParent(commande, parent, undefined, operations));
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
