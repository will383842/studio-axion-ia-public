/**
 * MOTEUR « MONTAGE FACE CAMÉRA » (plan facecam v4, lot A « Fondations ») — SQUELETTE.
 *
 * Il implémente `MoteurVideo` et passe `testerMoteurVideo` : étapes déclarées (les 4 étapes parlantes : le son, les
 * coupes, l'image, les sous-titres et cartes), avancement à l'horloge, échec typé et réessayable, « Arrêter ». Le vrai
 * travail (studio-aligneur : transcription, visages, image, son ; studio-rendu : assemblage et composition) viendra aux
 * lots B à D. D'ici là :
 * - `estimer()` rend 0 (format sans prix, v4 n° 11) ; toutes les lignes sont à 0 € ;
 * - `refusAuLancement` refuse tout lancement réel (« pas encore prêt ») : aucune sortie de démonstration ne peut
 *   passer pour une vraie vidéo ;
 * - plafond Claude du mois atteint (`commande.plafondClaudeAtteint`) : la vidéo sort quand même, en VERSION SIMPLE
 *   (sans relecture Claude), avec la mention « Plafond du mois atteint — relever ? ».
 * Le chemin de l'avocat n'est pas touché : ce moteur n'est désigné que par `format.moteur` du format `facecam`.
 * Fonctions pures, hors la relecture injectée : aucun dépôt, aucun réseau.
 */
import type { CommandeFabrication, EtapeTravail, LigneCout, Ratio, Travail } from "@/domaine/types";
import { MENTION_PLAFOND_FACECAM } from "@/domaine/facecam";
import { ZERO } from "@/lib/montants";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, ResultatFabrication, SortieProduite } from "../types";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "./chaine";
import { dependancesChaineParDefaut, servicesFacecam, type ContexteRelecture } from "./dependances";
import { imagesControleEffets } from "./effets-chaine"; // Lot I
import { etapesSelonChaine, resultatChaine } from "./etapes-chaine";
import { cartesDesPassages } from "./raccords";
import { effetsDesEntrees, etapesRetouche, etatPourRetouche, lireReprise, partiesARefaire, signatureMontage } from "./retouche";
import { lireEntreesFacecam } from "@/domaine/facecam";
import type { PassageMonteur } from "./monteur/appliquer";
import { avancerReexportFacecam, completerAvecDeclinaisons, estimationNouveauFormat, etatRepriseFormats } from "./declinaisons";

export const ID_MOTEUR_FACECAM = "montage-facecam";

export interface DependancesMoteurFacecam {
  /**
   * Relecture Claude ciblée (images de contrôle, lot D). Jamais appelée quand le plafond du mois est atteint.
   * Absente : rien n'est relu (squelette).
   */
  relire?: (commande: CommandeFabrication, contexte?: ContexteRelecture) => Promise<void>;
  /**
   * Lot B (ajout facultatif) : la CHAÎNE VIDÉO réelle (studio-aligneur, coupes, son, réalisation, passe image,
   * contrôles). Rend `null` : squelette du lot A (avancement à l'horloge, lancement réel refusé). Absente : le réel
   * n'est pris que si la commande le demande (`entrees.facecamAligneurReel`) et que `STUDIO_ALIGNEUR_URL` existe.
   */
  chaine?: (commande: CommandeFabrication) => DependancesChaine | null;
}

/** Version fabriquée : complète, ou simple quand le plafond Claude du mois est atteint (règles et modèles fixes). */
export type VersionFacecam = "complete" | "simple";

/** L'option Décor IA était allumée à la construction de la commande (`entrees.facecamDecorIa`, figé pour le travail). */
export function decorIaDemande(commande: Pick<CommandeFabrication, "entrees">): boolean {
  return (commande.entrees as { facecamDecorIa?: unknown } | undefined)?.facecamDecorIa === true;
}

export function versionSelonPlafond(commande: Pick<CommandeFabrication, "plafondClaudeAtteint">): VersionFacecam {
  return commande.plafondClaudeAtteint ? "simple" : "complete";
}

const RESOLUTIONS: Record<Ratio, string> = { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" };
/** Sorties du squelette : vidéos de démonstration (le lancement réel est refusé tant que le montage n'est pas prêt). */
const DEMO = "/demo/avocat-droits";

function etapesFabrication(commande: CommandeFabrication): DefinitionEtapeMoteur[] {
  const b = commande.briques;
  const avecVoix = commande.distribution.length > 0;
  const e: DefinitionEtapeMoteur[] = [{ cle: "reception", nom: "Votre vidéo reçue", icone: "camera", dependDe: [], dureeEstimeeSec: 2 }];
  // Les 4 étapes parlantes (v4, parcours § C.4).
  if (avecVoix) e.push({ cle: "son", nom: "Le son", icone: "son", dependDe: ["reception"], dureeEstimeeSec: 3 });
  e.push({ cle: "coupes", nom: "Les coupes", icone: "ciseaux", dependDe: ["reception"], dureeEstimeeSec: 4 });
  if (b.etalonnage) e.push({ cle: "etalonnage", nom: "L'image", icone: "contraste", dependDe: ["reception"], dureeEstimeeSec: 4 });
  // Lot E1 (raccord du lot E) : « Le décor », seulement quand l'option Décor IA est allumée (coupée par défaut).
  if (decorIaDemande(commande)) e.push({ cle: "decor", nom: "Le décor", icone: "image", dependDe: [b.etalonnage ? "etalonnage" : "reception"], dureeEstimeeSec: 4 });
  const avantMontage = e.filter((x) => x.cle !== "reception").map((x) => x.cle);
  e.push({ cle: "montage", nom: "Le montage", icone: "ciseaux", dependDe: avantMontage, dureeEstimeeSec: 3 });
  if (b["sous-titres"]) e.push({ cle: "sous-titres", nom: "Les sous-titres et cartes", icone: "sous-titres", dependDe: ["montage"], dureeEstimeeSec: 3 });
  const avantExport = ["montage", ...e.filter((x) => x.cle === "sous-titres").map((x) => x.cle)];
  e.push({ cle: "export", nom: "La vidéo finale", icone: "telecharger", dependDe: avantExport, dureeEstimeeSec: 2 });
  e.push({ cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["export"], dureeEstimeeSec: 1.5 });
  // Relecture Claude : seulement sous le plafond (sinon version simple, sans aucun appel Claude).
  if (versionSelonPlafond(commande) === "complete") e.push({ cle: "relecture", nom: "La relecture", icone: "oeil", dependDe: ["controle"], dureeEstimeeSec: 1.5 });
  return e;
}

/** Une seule ligne, à 0 € : le montage tourne sur le serveur du studio (aucun fournisseur payant). */
function lignes(nature: LigneCout["nature"]): LigneCout[] {
  return [{ etape: "Montage face caméra", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature }];
}

function estimation(dureeFabricationSec: number): Estimation {
  return { dureeFabricationSec, lignes: lignes("estime"), total: ZERO };
}

/** Planifie les étapes non terminées à partir de `depart` (ms), dans l'ordre des dépendances. */
function planifier(etapes: EtapeTravail[], durees: Record<string, number>, depart: number, echec?: string): EtapeTravail[] {
  const fin: Record<string, number> = {};
  for (const e of etapes) if (e.statut === "terminee" || e.statut === "ignoree") fin[e.cle] = depart;
  const resultat = etapes.map((e) => ({ ...e }));
  let restantes = resultat.filter((e) => fin[e.cle] === undefined);
  for (let garde = 0; restantes.length && garde < 100; garde++) {
    for (const e of restantes) {
      if (!e.dependDe.every((d) => fin[d] !== undefined)) continue;
      const debut = Math.max(depart, ...e.dependDe.map((d) => fin[d]));
      const duree = (durees[e.cle] ?? 2) * 1000;
      e.planifie = { debut, fin: debut + duree, echecA: echec === e.cle ? debut + duree / 2 : undefined };
      e.statut = "en_attente";
      e.progression = 0;
      e.erreur = undefined;
      fin[e.cle] = debut + duree;
    }
    restantes = restantes.filter((e) => fin[e.cle] === undefined);
  }
  return resultat;
}

function nouveauTravail(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, echec?: string): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
  const etapes = planifier(
    defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    Object.fromEntries(defs.map((d) => [d.cle, d.dureeEstimeeSec])),
    maintenant + 500,
    echec,
  );
  const type = ctx.type ?? "fabrication";
  return {
    id: ctx.travailId,
    type,
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes,
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${type}`,
    fournisseurUtilise: ID_MOTEUR_FACECAM,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(Math.max(...etapes.map((e) => e.planifie?.fin ?? maintenant))).toISOString(),
    parametres: { version: versionSelonPlafond(commande) },
  };
}

function bloquee(e: EtapeTravail, etapes: EtapeTravail[]): boolean {
  return e.dependDe.some((d) => {
    const dep = etapes.find((x) => x.cle === d);
    return !dep || dep.statut === "echec" || bloquee(dep, etapes);
  });
}

function resultatPour(commande: CommandeFabrication): ResultatFabrication {
  const simple = versionSelonPlafond(commande) === "simple";
  const alertes = simple ? [{ code: "montant" as const, gravite: "info" as const, message: MENTION_PLAFOND_FACECAM }] : [];
  const note = simple ? 80 : 85;
  const sorties: SortieProduite[] = commande.ratios.map((ratio) => ({
    ratio,
    fichierCle: `${DEMO}.mp4`,
    vignetteCle: `${DEMO}.jpg`,
    resolution: RESOLUTIONS[ratio],
    dureeSec: commande.dureeCibleSec,
    taille: 0,
    rapportQualite: { note, verifie: { image: true, son: true, sousTitres: !!commande.briques["sous-titres"], mentionIA: !!commande.briques["mention-ia"], droits: false }, alertes, niveauSonoreLufs: -14 },
  }));
  return {
    sorties,
    noteQualite: { globale: note, alertes },
    lignesReelles: lignes("reel"),
    projetMontage: { moteur: ID_MOTEUR_FACECAM, squelette: true, version: simple ? "simple" : "complete" },
  };
}

/** Un tour de la chaîne réelle (lot B) : les étapes suivent les travaux ; à la fin, relecture puis résultat. */
async function avancerAvecChaine(travail: Travail, commande: CommandeFabrication, deps: DependancesChaine, maintenant: number, relire?: DependancesMoteurFacecam["relire"]): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  const precedent = travail.parametres?.chaine as EtatChaine;
  let etat: EtatChaine;
  try {
    // Lot G : la vidéo finie est relue (images ciblées, 1 correction) à la fabrication en version complète seulement.
    const relecture = (travail.type ?? "fabrication") === "fabrication" && versionSelonPlafond(commande) === "complete";
    etat = await avancerChaine(precedent, commande, { travailId: travail.id, versionId: travail.versionId ?? commande.videoId, relecture }, deps);
  } catch (e) {
    // Panne imprévue (stockage, réseau) : on retentera au tour suivant, sans rien perdre.
    etat = { ...precedent, sauts: precedent.sauts };
    void e;
  }
  let etapes = etapesSelonChaine(travail.etapes, etat);
  const simple = versionSelonPlafond(commande) === "simple";
  if (etat.fini) {
    // Lot G : la relecture ciblée est DANS la chaîne (`deps.relire`) ; l'ancienne relecture de la vignette ne sert plus
    // que si la chaîne n'en a pas (dépendances injectées sans relecture).
    if (!simple && !deps.relire && (travail.type ?? "fabrication") === "fabrication") {
      const resultat = resultatChaine(commande, etat, simple).sorties[0];
      const imagesEffets = imagesControleEffets(etat.habillage?.effets); // Lot I
      await relire?.(commande, { travailId: travail.id, vignetteCle: resultat?.vignetteCle || undefined, fichierCle: resultat?.fichierCle || undefined, ...(imagesEffets.length ? { imagesEffets } : {}) })?.catch(() => undefined);
    }
    etapes = etapes.map((e) => (e.cle === "relecture" && e.statut !== "ignoree" ? { ...e, statut: "terminee" as const, progression: 100, coutReel: ZERO } : e));
  }
  const enEchec = etapes.find((e) => e.statut === "echec");
  const fini = etapes.every((e) => e.statut === "terminee" || e.statut === "ignoree");
  const iso = new Date(maintenant).toISOString();
  const suivant: Travail = {
    ...travail,
    etapes,
    progression: fini ? 100 : Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(etapes.length, 1)),
    statut: enEchec ? "echec" : fini ? "termine" : "en_cours",
    erreur: enEchec?.erreur,
    modifieLe: iso,
    termineLe: fini ? iso : undefined,
    parametres: { ...travail.parametres, chaine: etat },
  };
  // Lot F1 : une sortie par format demandé en plus du 9:16 (inchangé), et de quoi en ajouter un plus tard.
  return fini ? { travail: suivant, resultat: completerAvecDeclinaisons(resultatChaine(commande, etat, simple), etat) } : { travail: suivant };
}

export function creerMoteurMontageFacecam(dependances: DependancesMoteurFacecam = {}): MoteurVideo {
  const chaineDe = (c: CommandeFabrication, travailId?: string): DependancesChaine | null => (dependances.chaine ? dependances.chaine(c) : dependancesChaineParDefaut(c, process.env, travailId));
  // Relecture : celle injectée, sinon celle des services (lot D, branchée par `services/facecam-branchements.ts`).
  const relire: DependancesMoteurFacecam["relire"] = dependances.relire ?? (dependances.chaine ? undefined : (c, ctx) => servicesFacecam().relire?.(c, ctx) ?? Promise.resolve());
  return {
    id: ID_MOTEUR_FACECAM,
    nom: "Montage face caméra",
    capacites: {
      dureeMaxSec: 600,
      // v1 : 9:16 ; lot F1 : déclinaisons 4:5, 1:1 et 16:9 de la même vidéo (le 9:16 reste la référence).
      ratios: ["9:16", "4:5", "1:1", "16:9"],
      langues: ["fr-FR"],
      // Lot G : retouche réelle (seules les étapes touchées sont refaites) dès que la chaîne réelle est là ; sinon
      // `refusRetouche` la refuse avant toute réservation (jamais une vidéo d'essai à la place de la vraie).
      retoucheParPlan: true,
      asynchrone: true,
      accordExige: false,
      maquette: false,
    },

    async estimer(commande) {
      return estimation(etapesFabrication(commande).reduce((t, e) => t + e.dureeEstimeeSec, 0));
    },
    async estimerRetouche() {
      return estimation(6);
    },
    async estimerReexport() {
      return estimation(3);
    },

    etapes: etapesFabrication,

    refusAuLancement(commande) {
      // Lot B : la chaîne réelle monte vraiment la vidéo ; sans elle, le squelette ne doit jamais passer pour réel.
      if (commande && chaineDe(commande)) return null;
      // Mise en ligne : le squelette ne part jamais ; sans chaîne réelle (serveur de montage non relié), on le dit.
      return { code: "FACECAM_EN_CHANTIER", message: "Le serveur de montage face caméra n'est pas relié. Vérifiez Réglages > Connexions." };
    },

    async lancer(commande, contexte) {
      const travail = nouveauTravail(etapesFabrication(commande), contexte, commande, commande.simulerEchecEtape);
      return chaineDe(commande) ? { ...travail, parametres: { ...travail.parametres, chaine: etatChaineInitial() } } : travail;
    },

    async avancer(travail, commande, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return { travail };
      const deps = travail.parametres?.chaine ? chaineDe(commande, travail.id) : null;
      // Lot F1 : format ajouté après coup, seules ses pistes pré-cadrées restent à faire.
      if (deps && travail.type === "reexport") return avancerReexportFacecam(travail, commande, deps, maintenant);
      if (deps) return avancerAvecChaine(travail, commande, deps, maintenant, relire);
      const etapes = travail.etapes.map((e) => ({ ...e }));
      for (const e of etapes) {
        if (e.statut === "terminee" || e.statut === "ignoree" || e.statut === "echec" || !e.planifie || bloquee(e, etapes)) continue;
        const { debut, fin, echecA } = e.planifie;
        if (echecA !== undefined && maintenant >= echecA) {
          e.statut = "echec";
          e.progression = 50;
          e.erreur = { code: "FACECAM_ECHEC", reessayable: true, messagePourWill: `${e.nom} n'a pas abouti. Vous pouvez réessayer cette étape seule.`, detailTechnique: `Échec de l'étape « ${e.cle} ».` };
        } else if (maintenant >= fin) {
          // La relecture Claude n'existe que sous le plafond (l'étape est absente de la version simple).
          if (e.cle === "relecture") await dependances.relire?.(commande);
          e.statut = "terminee";
          e.progression = 100;
          e.coutReel = ZERO;
        } else if (maintenant >= debut) {
          e.statut = "en_cours";
          e.progression = Math.min(99, Math.round(((maintenant - debut) / (fin - debut)) * 100));
        }
      }
      const enEchec = etapes.find((e) => e.statut === "echec");
      const fini = etapes.every((e) => e.statut === "terminee" || e.statut === "ignoree");
      const iso = new Date(maintenant).toISOString();
      const suivant: Travail = {
        ...travail,
        etapes,
        progression: fini ? 100 : Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(etapes.length, 1)),
        statut: enEchec ? "echec" : fini ? "termine" : etapes.some((e) => e.statut !== "en_attente") ? "en_cours" : "en_file",
        erreur: enEchec?.erreur,
        modifieLe: iso,
        termineLe: fini ? iso : undefined,
      };
      return fini ? { travail: suivant, resultat: resultatPour(commande) } : { travail: suivant };
    },

    async reessayer(travail, maintenant = Date.now()) {
      const etatChaine = travail.parametres?.chaine as EtatChaine | undefined;
      if (etatChaine) {
        // Chaîne : l'étape en échec repart (essais remis à zéro) ; tout ce qui est fait reste fait.
        const travaux = Object.fromEntries(Object.entries(etatChaine.travaux).filter(([, t]) => t && t.statut !== "echec"));
        return { ...travail, statut: "en_cours", erreur: undefined, tentatives: travail.tentatives + 1, modifieLe: new Date(maintenant).toISOString(), parametres: { ...travail.parametres, chaine: { ...etatChaine, travaux, echec: undefined } } };
      }
      const durees = Object.fromEntries(travail.etapes.map((e) => [e.cle, e.planifie ? (e.planifie.fin - e.planifie.debut) / 1000 : 2]));
      // Les étapes terminées restent faites ; l'étape en échec et ses suites sont replanifiées, sans nouvel échec.
      const etapes = planifier(travail.etapes, durees, maintenant + 300);
      return {
        ...travail,
        etapes,
        statut: "en_cours",
        erreur: undefined,
        tentatives: travail.tentatives + 1,
        modifieLe: new Date(maintenant).toISOString(),
        finEstimee: new Date(Math.max(...etapes.map((e) => e.planifie?.fin ?? maintenant))).toISOString(),
      };
    },

    refusRetouche(commande) {
      if (chaineDe(commande)) return null;
      return { code: "RETOUCHE_INDISPONIBLE", message: "La retouche d'un passage n'est pas encore disponible pour cette vidéo. Votre vidéo reste telle quelle." };
    },

    async retoucher({ commande, contexte, planIds, parent }) {
      // Lot G : retouche RÉELLE — on repart de la version d'avant (`projetMontage.reprise`) et on ne refait que ce que la
      // consigne touche ; la nouvelle version est une vraie vidéo, l'ancienne reste visible pendant le recalcul.
      if (chaineDe(commande)) {
        const reprise = lireReprise(parent?.projetMontage);
        const apres = signatureMontage(commande.entrees);
        const parties = partiesARefaire(reprise?.signature, apres);
        const cartes = cartesDesPassages(lireEntreesFacecam(commande.entrees).passages as PassageMonteur[]);
        const etat = reprise ? etatPourRetouche(reprise, commande, parties, cartes) : { ...etatChaineInitial(), monteur: { statut: "fait" as const, cartes, ...effetsDesEntrees(commande.entrees) } };
        const aRendre = Math.max(0, cartes.length - (reprise?.cartes.length ?? 0)) + (reprise && reprise.signature.habillage !== apres.habillage && cartes.length ? 1 : 0);
        const defs = reprise ? etapesRetouche(parties, reprise.dureeSec, aRendre) : etapesFabrication(commande).filter((e) => e.cle !== "relecture");
        const travail = nouveauTravail(defs, { ...contexte, type: "retouche" }, commande);
        return { ...travail, parametres: { planIds, version: versionSelonPlafond(commande), chaine: etat, refaire: [...(reprise ? parties : ["tout"])] } };
      }
      const defs: DefinitionEtapeMoteur[] = [
        { cle: "montage", nom: "Le montage", icone: "ciseaux", dependDe: [], dureeEstimeeSec: 3 },
        { cle: "export", nom: "La vidéo finale", icone: "telecharger", dependDe: ["montage"], dureeEstimeeSec: 2 },
      ];
      return { ...nouveauTravail(defs, { ...contexte, type: "retouche" }, commande), parametres: { planIds, version: versionSelonPlafond(commande) } };
    },

    /**
     * Lot G : sous-titres corrigés (onglet Sous-titres) → l'habillage SEUL, avec ces groupes ; tout le reste est repris
     * de la version d'avant (aucune étape du studio-aligneur, aucune carte rendue de nouveau).
     */
    async recalquer({ commande, contexte, segments, parent }) {
      // Le service refuse avant (`refusRetouche`) quand la chaîne réelle manque.
      const reprise = lireReprise(parent.projetMontage);
      const parties = new Set<"habillage">(["habillage"]);
      const cartes = cartesDesPassages(lireEntreesFacecam(commande.entrees).passages as PassageMonteur[]);
      // Version d'avant le lot G (sans reprise) : tout est refait, avec ces sous-titres.
      const etat = { ...(reprise ? etatPourRetouche(reprise, commande, parties, cartes) : { ...etatChaineInitial(), monteur: { statut: "fait" as const, cartes, ...effetsDesEntrees(commande.entrees) } }), sousTitres: segments };
      const defs = reprise ? etapesRetouche(parties, reprise.dureeSec, 0) : etapesFabrication(commande).filter((e) => e.cle !== "relecture");
      const travail = nouveauTravail(defs, { ...contexte, type: "recalque-sous-titres" }, commande);
      return { ...travail, parametres: { version: versionSelonPlafond(commande), chaine: etat, refaire: reprise ? ["habillage"] : ["tout"] } };
    },

    async reexporter({ commande, contexte, cible, parent }) {
      const ratio = "ratio" in cible ? cible.ratio : commande.ratios[0];
      // Lot F1 : la chaîne réelle a gardé de quoi décliner la vidéo (aucun : squelette, comme avant).
      const reprise = chaineDe(commande) ? etatRepriseFormats(parent?.projetMontage, [ratio]) : null;
      // 10/10 : durée annoncée honnête (passe image élargie comprise, ≈ 10 à 20 min), au lieu de 3 s.
      const estimation = reprise ? estimationNouveauFormat(reprise) : null;
      const defs: DefinitionEtapeMoteur[] = [{ cle: "export", nom: "Le nouveau format", icone: "telecharger", dependDe: [], dureeEstimeeSec: estimation?.totalSec ?? 3 }];
      return { ...nouveauTravail(defs, { ...contexte, type: "reexport" }, commande), parametres: { ratio, ...(reprise ? { chaine: reprise } : {}), ...(estimation ? { estimation } : {}) } };
    },

    async maquette(commande) {
      // Pas de maquette (capacites.maquette = false) : la vidéo filmée tient lieu d'aperçu.
      return { dureeSec: commande.dureeCibleSec };
    },

    async annuler(travail, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return {
        ...travail,
        statut: "annule",
        etapes: travail.etapes.map((e) => (e.statut === "terminee" ? { ...e } : { ...e, statut: "ignoree" as const, planifie: undefined, erreur: undefined })),
        erreur: undefined,
        modifieLe: iso,
        termineLe: iso,
      };
    },
  };
}

export const moteurMontageFacecam = creerMoteurMontageFacecam();
