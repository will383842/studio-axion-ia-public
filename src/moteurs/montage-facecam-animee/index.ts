/**
 * MOTEUR « MONTAGE FACE CAMÉRA ANIMÉE » (plan du 14/10, lot A « Socle ») — SQUELETTE.
 *
 * Nouveau générateur, INDÉPENDANT du moteur face caméra : il a ses propres étapes (dont « La mise en scène », le
 * réalisateur Opus du lot C, et « Les bruitages », lot E) et sa propre charte (`interface-claire/1`). Les fondations
 * (transcription, coupes, Look Will, son, rendu) seront branchées par leurs versions figées aux lots suivants, sans
 * modifier le moteur face caméra.
 *
 * Il implémente `MoteurVideo` et passe `testerMoteurVideo` : étapes déclarées, avancement à l'horloge, échec typé et
 * réessayable, « Arrêter ». `estimer()` rend 0 (format sans prix).
 *
 * LOT I (17/10/2026, v4 validée par Will) — DEUX chemins :
 * - commande AVEC une prise déposée (`entrees.facecamAnimee.priseCle`) : la VRAIE chaîne v4 (`chaine-v4.ts` : transcription, coupes,
 *   réalisateur Opus ou plan v4 minimal, rendu `InterfaceClaireFaceCameraV4`) ; l'état vit dans `travail.parametres.facecamAnimeeV4`, chaque
 *   `avancer` fait un pas ; les outils réels sont fournis par le service (`brancherServicesFacecamAnimee`, `services/facecam-animee.ts`) ;
 * - sans prise : l'ancien squelette (sorties de démonstration), que `refusAuLancement` interdit en lancement réel.
 * `refusAuLancement` : pas de prise → refus ; format encore MASQUÉ → seulement avec l'accord d'essai réel de Will
 * (`entrees.facecamAnimee.accordEssaiReel`, réglage `facecamAnimee.accordEssaiReel`), même garde que « Image → vidéo ».
 * Ce fichier n'importe aucun service ni fournisseur.
 */
import type { CommandeFabrication, EtapeTravail, LigneCout, Ratio, Travail } from "@/domaine/types";
import { formatFacecamAnimee } from "@/formats/facecam-animee";
import { ZERO } from "@/lib/montants";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, ResultatFabrication, SortieProduite } from "../types";
import type { EtapeChaineV4, EtatChaineV4, OutilsChaineV4 } from "./chaine-v4";

export const ID_MOTEUR_FACECAM_ANIMEE = "montage-facecam-animee";

/** Charte visuelle figée de ce générateur (composants Remotion `studio-rendu/compositions/interface-claire/`). */
export const CHARTE_FACECAM_ANIMEE = "interface-claire/1";

export const MENTION_PLAFOND_FACECAM_ANIMEE = "Plafond du mois atteint : mise en scène par règles fixes, sans Claude — relever ?";

/** Ce que la commande porte pour la chaîne v4 (`entrees.facecamAnimee`), posé par le dépôt de la prise. */
export interface EntreesFacecamAnimee {
  priseCle?: string;
  fichierId?: string;
  dureePriseSec?: number;
  /** Texte que Will a dit (facultatif). */
  texteValide?: string;
  /** Accord d'essai réel de Will tant que le format est masqué. */
  accordEssaiReel: boolean;
}

export function lireEntreesFacecamAnimee(entrees: Record<string, unknown> | undefined): EntreesFacecamAnimee {
  const e = (entrees?.facecamAnimee ?? {}) as Record<string, unknown>;
  const texte = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : undefined);
  return {
    ...(texte(e.priseCle) ? { priseCle: texte(e.priseCle) } : {}),
    ...(texte(e.fichierId) ? { fichierId: texte(e.fichierId) } : {}),
    ...(typeof e.dureePriseSec === "number" && Number.isFinite(e.dureePriseSec) ? { dureePriseSec: e.dureePriseSec } : {}),
    ...(texte(e.texteValide) ? { texteValide: (texte(e.texteValide) as string).slice(0, 20_000) } : {}),
    accordEssaiReel: e.accordEssaiReel === true,
  };
}

/** Outils réels de la chaîne v4 pour une commande (null : le studio n'est pas relié). */
export type FabriqueOutilsFacecamV4 = (commande: CommandeFabrication, travailId: string) => Promise<OutilsChaineV4 | null>;

/** Branchement des services (la boucle de fond charge `services/facecam-animee.ts`, qui appelle ceci). */
let servicesBranches: { outils?: FabriqueOutilsFacecamV4 } = {};
export function brancherServicesFacecamAnimee(s: { outils?: FabriqueOutilsFacecamV4 }): void {
  servicesBranches = s;
}

export const PHRASE_FORMAT_MASQUE_FA = "Le format « Face caméra animée » est en essai : un essai réel demande l'accord de Will.";
const NON_RELIE_FA = "« Face caméra animée » n'est pas relié (stockage, transcription ou serveur de rendu). Vérifiez Réglages > Connexions, puis réessayez.";

export interface DependancesMoteurFacecamAnimee {
  /** Outils réels de la chaîne v4 (tests : doubles) ; absent : ceux branchés par le service. */
  outils?: FabriqueOutilsFacecamV4;
  /** Statut du format (tests) ; absent : celui de la fiche. */
  statutFormat?: "actif" | "bientot" | "masque";
  /** Relecture Claude des images de contrôle (lot H). Jamais appelée quand le plafond du mois est atteint. */
  relire?: (commande: CommandeFabrication) => Promise<void>;
  /**
   * « Les photos et logos » (passe 3) : remplit les fenêtres du plan en MINI-VIDÉOS vérifiées, par le chemin de
   * production `etapeImagesStudio` (`images/production.ts`, branché sur `adaptateurStudio`). Le format reste fermé
   * (`refusAuLancement`) : cette étape ne tourne que sur un lancement réel, une fois le format activé.
   */
  images?: (commande: CommandeFabrication) => Promise<void>;
}

/** Version fabriquée : complète (mise en scène par Claude Opus), ou simple quand le plafond Claude est atteint. */
export type VersionFacecamAnimee = "complete" | "simple";

export function versionSelonPlafond(commande: Pick<CommandeFabrication, "plafondClaudeAtteint">): VersionFacecamAnimee {
  return commande.plafondClaudeAtteint ? "simple" : "complete";
}

const RESOLUTIONS: Record<Ratio, string> = { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" };
/** Sorties du squelette : vidéos de démonstration (le lancement réel est refusé tant que le montage n'est pas prêt). */
const DEMO = "/demo/avocat-droits";

/** Le parcours d'une vidéo (plan § 1), en étapes parlantes pour Will. */
export function etapesFabrication(commande: CommandeFabrication): DefinitionEtapeMoteur[] {
  const b = commande.briques;
  const avecVoix = commande.distribution.length > 0;
  const complete = versionSelonPlafond(commande) === "complete";
  const e: DefinitionEtapeMoteur[] = [{ cle: "reception", nom: "Votre vidéo reçue", icone: "camera", dependDe: [], dureeEstimeeSec: 2 }];
  // Fondations partagées (versions figées).
  if (avecVoix) e.push({ cle: "son", nom: "Le son", icone: "son", dependDe: ["reception"], dureeEstimeeSec: 3 });
  e.push({ cle: "coupes", nom: "Les coupes", icone: "ciseaux", dependDe: ["reception"], dureeEstimeeSec: 4 });
  if (b.etalonnage) e.push({ cle: "etalonnage", nom: "L'image", icone: "contraste", dependDe: ["reception"], dureeEstimeeSec: 4 });
  // Propre à ce générateur : la mise en scène d'après les mots (Opus, ou règles fixes en version simple).
  e.push({ cle: "mise-en-scene", nom: complete ? "La mise en scène" : "La mise en scène (règles fixes)", icone: "baguette", dependDe: ["coupes"], dureeEstimeeSec: 4 });
  e.push({ cle: "images", nom: "Les photos et logos", icone: "images", dependDe: ["mise-en-scene"], dureeEstimeeSec: 3 });
  e.push({ cle: "bruitages", nom: "Les bruitages", icone: "volume", dependDe: ["mise-en-scene"], dureeEstimeeSec: 2 });
  // Le montage assemble la prise réglée, la mise en scène, les photos et les bruitages (rendu Remotion, lot I).
  const avantMontage = e.filter((x) => x.cle !== "reception" && x.cle !== "coupes" && x.cle !== "mise-en-scene").map((x) => x.cle);
  e.push({ cle: "montage", nom: "Le montage", icone: "film", dependDe: avantMontage, dureeEstimeeSec: 3 });
  e.push({ cle: "export", nom: "La vidéo finale", icone: "telecharger", dependDe: ["montage"], dureeEstimeeSec: 2 });
  e.push({ cle: "controle", nom: "La vérification", icone: "bouclier", dependDe: ["export"], dureeEstimeeSec: 1.5 });
  if (complete) e.push({ cle: "relecture", nom: "La relecture", icone: "oeil", dependDe: ["controle"], dureeEstimeeSec: 1.5 });
  return e;
}

/** Une seule ligne, à 0 € : le montage tourne sur le serveur du studio (aucun fournisseur payant). */
function lignes(nature: LigneCout["nature"]): LigneCout[] {
  return [{ etape: "Montage face caméra animée", fournisseur: "studio", unite: "forfait", quantite: 1, prixUnitaire: ZERO, total: ZERO, nature }];
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
    fournisseurUtilise: ID_MOTEUR_FACECAM_ANIMEE,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(Math.max(...etapes.map((e) => e.planifie?.fin ?? maintenant))).toISOString(),
    parametres: { version: versionSelonPlafond(commande), charte: CHARTE_FACECAM_ANIMEE },
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
  const alertes = simple ? [{ code: "montant" as const, gravite: "info" as const, message: MENTION_PLAFOND_FACECAM_ANIMEE }] : [];
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
    projetMontage: { moteur: ID_MOTEUR_FACECAM_ANIMEE, squelette: true, version: simple ? "simple" : "complete", charte: CHARTE_FACECAM_ANIMEE },
  };
}

/* ------------------------------------------------------------------ */
/* Chaîne v4 (Lot I)                                                     */
/* ------------------------------------------------------------------ */

const CLE_ETAT_V4 = "facecamAnimeeV4";

/** Étapes montrées à Will pour la vraie chaîne (une par pas de `chaine-v4.ts`). */
export function etapesV4(commande: CommandeFabrication): DefinitionEtapeMoteur[] {
  const complete = versionSelonPlafond(commande) === "complete";
  return [
    { cle: "transcription", nom: "Vos mots", icone: "camera", dependDe: [], dureeEstimeeSec: 90 },
    { cle: "coupes", nom: "Les coupes", icone: "ciseaux", dependDe: ["transcription"], dureeEstimeeSec: 2 },
    { cle: "mise-en-scene", nom: complete ? "La mise en scène" : "La mise en scène (simple)", icone: "baguette", dependDe: ["coupes"], dureeEstimeeSec: 120 },
    { cle: "videos", nom: "Les vidéos d'illustration", icone: "film", dependDe: ["mise-en-scene"], dureeEstimeeSec: 180 },
    { cle: "rendu", nom: "Le montage", icone: "film", dependDe: ["videos"], dureeEstimeeSec: 600 },
  ];
}

const avecPrise = (commande: Pick<CommandeFabrication, "entrees">) => !!lireEntreesFacecamAnimee(commande.entrees).priseCle;

function etatV4De(travail: Travail): EtatChaineV4 | null {
  const e = travail.parametres?.[CLE_ETAT_V4] as EtatChaineV4 | undefined;
  return e && typeof e === "object" && e.version === "chaine-facecam-v4/1" ? e : null;
}

/** Statut des étapes d'après l'étape courante de la chaîne. PUR. */
function etapesDepuisEtat(travail: Travail, etape: EtapeChaineV4): EtapeTravail[] {
  const ordre: EtapeChaineV4[] = ["transcription", "coupes", "mise-en-scene", "videos", "rendu", "prete"];
  const rang = ordre.indexOf(etape);
  return travail.etapes.map((e) => {
    const k = ordre.indexOf(e.cle as EtapeChaineV4);
    if (k < 0) return e;
    if (k < rang) return { ...e, statut: "terminee" as const, progression: 100, erreur: undefined, coutReel: ZERO };
    if (k === rang) return { ...e, statut: "en_cours" as const, progression: Math.max(1, Math.min(99, e.progression || 1)), erreur: undefined };
    return { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined };
  });
}

function travailV4(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, etat: EtatChaineV4): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
  const type = ctx.type ?? "fabrication";
  const base: Travail = {
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
    fournisseurUtilise: ID_MOTEUR_FACECAM_ANIMEE,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(maintenant + defs.reduce((t, d) => t + d.dureeEstimeeSec, 0) * 1000).toISOString(),
    parametres: { version: versionSelonPlafond(commande), charte: CHARTE_FACECAM_ANIMEE, [CLE_ETAT_V4]: etat },
  };
  return { ...base, etapes: etapesDepuisEtat(base, etat.etape) };
}

/** Résultat d'une chaîne v4 finie : UNE vidéo 9:16, rangée par le studio comme celles des autres générateurs. PUR. */
export function resultatV4(etat: EtatChaineV4): ResultatFabrication {
  const r = etat.rendu;
  if (!r) throw new Error("chaîne v4 sans rendu");
  const simple = etat.realisation?.version === "simple";
  // Repli « sans vidéo » réussi : Will est prévenu que la mise en scène a été refaite sans vidéo d'illustration.
  const alertes = [
    ...(simple ? [{ code: "montant" as const, gravite: "info" as const, message: etat.realisation?.phrase ?? "Mise en scène simple (sans Claude)." }] : []),
    ...(etat.repliSansVideo?.fait ? [{ code: "montant" as const, gravite: "info" as const, message: etat.realisation?.phrase ?? "La mise en scène a été refaite sans vidéo d'illustration." }] : []),
  ];
  const note = simple ? 80 : 90;
  return {
    sorties: [{ ratio: "9:16", fichierCle: r.cle, vignetteCle: r.vignetteCle, resolution: RESOLUTIONS["9:16"], dureeSec: r.dureeSec, taille: r.taille, rapportQualite: { note, verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: false }, alertes, niveauSonoreLufs: -14 } }],
    noteQualite: { globale: note, alertes },
    lignesReelles: lignes("reel"),
    projetMontage: { moteur: ID_MOTEUR_FACECAM_ANIMEE, squelette: false, version: etat.realisation?.version ?? "complete", charte: CHARTE_FACECAM_ANIMEE, plaquettes: etat.realisation?.plan.elementsV4?.length ?? 0, essaisClaude: etat.realisation?.essais ?? 0 },
  };
}

export function creerMoteurMontageFacecamAnimee(dependances: DependancesMoteurFacecamAnimee = {}): MoteurVideo {
  const fabrique = (): FabriqueOutilsFacecamV4 | undefined => dependances.outils ?? servicesBranches.outils;
  const statut = () => dependances.statutFormat ?? formatFacecamAnimee.statut;
  return {
    id: ID_MOTEUR_FACECAM_ANIMEE,
    nom: "Montage face caméra animée",
    capacites: {
      dureeMaxSec: 300,
      ratios: ["9:16"],
      langues: ["fr-FR"],
      retoucheParPlan: false,
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

    etapes: (commande) => (avecPrise(commande) ? etapesV4(commande) : etapesFabrication(commande)),

    refusAuLancement(commande) {
      const e = lireEntreesFacecamAnimee(commande?.entrees);
      // Sans prise déposée, seul le squelette (sorties de démonstration) existe : jamais en lancement réel.
      if (!e.priseCle) return { code: "FACECAM_ANIMEE_EN_CHANTIER", message: "Déposez votre vidéo filmée depuis la page « Face caméra animée » pour la faire animer." };
      if ((statut() === "masque" || formatFacecamAnimee.reserveAWill) && !e.accordEssaiReel) return { code: "FACECAM_ANIMEE_FORMAT_MASQUE", message: PHRASE_FORMAT_MASQUE_FA };
      return null;
    },
    refusRetouche: (commande) => (avecPrise(commande) ? { code: "RETOUCHE_NON_PRISE_EN_CHARGE", message: "La retouche d'une vidéo face caméra animée viendra plus tard : déposez la prise à nouveau pour une nouvelle mise en scène." } : null),

    async lancer(commande, contexte) {
      const e = lireEntreesFacecamAnimee(commande.entrees);
      if (e.priseCle) {
        const { etatInitialV4 } = await import("./chaine-v4");
        return travailV4(etapesV4(commande), contexte, commande, etatInitialV4({ videoId: commande.videoId, versionId: contexte.versionId, priseCle: e.priseCle, titre: contexte.titre, ...(e.texteValide ? { texteValide: e.texteValide } : {}) }));
      }
      return nouveauTravail(etapesFabrication(commande), contexte, commande, commande.simulerEchecEtape);
    },

    async avancer(travail, commande, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return { travail };
      const etatV4 = etatV4De(travail);
      if (etatV4) {
        if (travail.statut === "echec") return { travail };
        const iso = new Date(maintenant).toISOString();
        const echec = (code: string, messagePourWill: string, reessayable: boolean, detailTechnique?: string, etatGarde?: EtatChaineV4): { travail: Travail } => {
          const erreur = { code, reessayable, messagePourWill, ...(detailTechnique ? { detailTechnique } : {}) };
          return { travail: { ...travail, statut: "echec", erreur, ...(etatGarde ? { parametres: { ...travail.parametres, [CLE_ETAT_V4]: etatGarde } } : {}), etapes: travail.etapes.map((x) => (x.cle === etatV4.etape ? { ...x, statut: "echec" as const, erreur } : x)), modifieLe: iso } };
        };
        let outils: OutilsChaineV4 | null = null;
        try {
          outils = (await fabrique()?.(commande, travail.id)) ?? null;
        } catch (err) {
          return echec("FACECAM_ANIMEE_NON_RELIE", `${err instanceof Error ? err.message : String(err)} Vous pouvez réessayer.`, true);
        }
        if (!outils) return echec("FACECAM_ANIMEE_NON_RELIE", NON_RELIE_FA, true);
        const { avancerChaineV4, EnCoursChaineV4, ErreurChaineV4 } = await import("./chaine-v4");
        let apres: EtatChaineV4;
        try {
          apres = await avancerChaineV4(etatV4, outils);
        } catch (err) {
          if (err instanceof EnCoursChaineV4) {
            const etapes = etapesDepuisEtat(travail, etatV4.etape).map((x) => (x.cle === etatV4.etape ? { ...x, progression: Math.min(95, (x.progression || 1) + 2) } : x));
            return { travail: { ...travail, statut: "en_cours", etapes, progression: Math.round(etapes.reduce((t, x) => t + x.progression, 0) / Math.max(1, etapes.length)), modifieLe: iso } };
          }
          if (err instanceof ErreurChaineV4) return echec("FACECAM_ANIMEE_ECHEC", err.message, err.reessayable, err.detail, err.etat);
          return echec("FACECAM_ANIMEE_ECHEC", "Une étape n'a pas abouti. Vous pouvez réessayer.", true, err instanceof Error ? err.message.slice(0, 300) : String(err));
        }
        const etapes = etapesDepuisEtat(travail, apres.etape);
        const fini = apres.etape === "prete";
        const suivant: Travail = {
          ...travail,
          etapes,
          statut: fini ? "termine" : "en_cours",
          progression: fini ? 100 : Math.round(etapes.reduce((t, x) => t + x.progression, 0) / Math.max(1, etapes.length)),
          erreur: undefined,
          modifieLe: iso,
          termineLe: fini ? iso : undefined,
          parametres: { ...travail.parametres, [CLE_ETAT_V4]: apres, ...(apres.realisation ? { version: apres.realisation.version } : {}) },
        };
        return fini ? { travail: suivant, resultat: resultatV4(apres) } : { travail: suivant };
      }
      const etapes = travail.etapes.map((e) => ({ ...e }));
      for (const e of etapes) {
        if (e.statut === "terminee" || e.statut === "ignoree" || e.statut === "echec" || !e.planifie || bloquee(e, etapes)) continue;
        const { debut, fin, echecA } = e.planifie;
        if (echecA !== undefined && maintenant >= echecA) {
          e.statut = "echec";
          e.progression = 50;
          e.erreur = { code: "FACECAM_ANIMEE_ECHEC", reessayable: true, messagePourWill: `${e.nom} n'a pas abouti. Vous pouvez réessayer cette étape seule.`, detailTechnique: `Échec de l'étape « ${e.cle} ».` };
        } else if (maintenant >= fin) {
          if (e.cle === "relecture") await dependances.relire?.(commande);
          if (e.cle === "images" && dependances.images) {
            try {
              await dependances.images(commande);
            } catch (err) {
              e.statut = "echec";
              e.progression = 50;
              e.erreur = { code: "FACECAM_ANIMEE_IMAGES", reessayable: true, messagePourWill: "Les mini-vidéos n'ont pas pu être trouvées. Vous pouvez réessayer cette étape seule.", detailTechnique: (err as Error).message ?? "échec des images" };
              continue;
            }
          }
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
      if (etatV4De(travail)) {
        // Chaîne v4 : l'étape arrêtée est refaite ; ce qui est fait (transcription, coupes, plan) reste dans l'état.
        return { ...travail, statut: "en_cours", erreur: undefined, termineLe: undefined, etapes: travail.etapes.map((e) => (e.statut === "echec" ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined } : e)), tentatives: travail.tentatives + 1, modifieLe: new Date(maintenant).toISOString() };
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

    // Retouche par la conversation (lot G) : seule la mise en scène touchée est refaite, puis la vidéo finale.
    async retoucher({ commande, contexte, planIds }) {
      const defs: DefinitionEtapeMoteur[] = [
        { cle: "mise-en-scene", nom: "La mise en scène", icone: "baguette", dependDe: [], dureeEstimeeSec: 3 },
        { cle: "montage", nom: "Le montage", icone: "film", dependDe: ["mise-en-scene"], dureeEstimeeSec: 3 },
        { cle: "export", nom: "La vidéo finale", icone: "telecharger", dependDe: ["montage"], dureeEstimeeSec: 2 },
      ];
      return { ...nouveauTravail(defs, { ...contexte, type: "retouche" }, commande), parametres: { planIds, version: versionSelonPlafond(commande), charte: CHARTE_FACECAM_ANIMEE } };
    },

    async reexporter({ commande, contexte, cible }) {
      const defs: DefinitionEtapeMoteur[] = [{ cle: "export", nom: "Le nouveau format", icone: "telecharger", dependDe: [], dureeEstimeeSec: 3 }];
      const ratio = "ratio" in cible ? cible.ratio : commande.ratios[0];
      return { ...nouveauTravail(defs, { ...contexte, type: "reexport" }, commande), parametres: { ratio } };
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

export const moteurMontageFacecamAnimee = creerMoteurMontageFacecamAnimee();
