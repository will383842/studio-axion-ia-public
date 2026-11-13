import "server-only";
import { createHash } from "node:crypto";
import { PROFILS_RESEAUX, type Reseau } from "@/briques/visuels/reseaux";
import type { InfographieSpecType } from "@/domaine/visuels/schema-infographie";
import type { Fichier, LigneCout } from "@/domaine/types";
import type { DemandeDepotIV, IssueDepotIV } from "@/services/image-video-ecran";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import { identifiantSur, segmentStockage } from "@/fournisseurs/rendu/commun";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { exigerGenerateurAllume } from "../interrupteur";
import { canonique, DELAI_RENDU_MS, VERSION_RENDU } from "./rendu";

/** Copie locale (l'image du studio ne contient pas `studio-rendu/`, `src/` ne l'importe jamais) : gabarits, ratios, dimensions, composition de L2-06. */
export type Gabarit = "chiffres-cles" | "etapes" | "comparaison";
export type RatioInfographie = "1:1" | "9:16";
export const FORMATS_INFOGRAPHIE: Record<RatioInfographie, { largeur: number; hauteur: number }> = { "1:1": { largeur: 1080, hauteur: 1080 }, "9:16": { largeur: 1080, hauteur: 1920 } };
export const ID_COMPOSITION_INFOGRAPHIE = "Infographie";

/**
 * Service de production d'une infographie (L2-07) : l'interrupteur « infographies » est vérifié tout au début, AVANT toute réservation de
 * crédit et toute soumission. Éteint (réglage absent ou autre que le booléen `true`) : GENERATEUR_ETEINT, rien n'est réservé ni rendu.
 * Allumé : le crédit est réservé, puis UN rendu par réseau est
 * soumis (opération « image-fixe », composition « Infographie »). Un échec libère la réservation. Tout est injecté : aucun appel payant ici.
 */

export interface DependancesInfographies {
  rendu: () => ServiceRendu;
  stockage: { urlDepot(cle: string): Promise<string>; urlLecture(cle: string): Promise<string> };
  /** Réservation du crédit, fournie par l'appelant (les dossiers visuels n'appellent jamais le module des crédits : test du verrou). */
  reserver: (demande: { travailId: string; lignes: LigneCout[] }) => Promise<void>;
  /** Libération de la réservation (« consommee » au succès, « liberee » en cas d'échec). */
  liberer: (travailId: string, issue: "consommee" | "liberee") => Promise<void>;
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => number;
  delaiMs?: number;
}

export interface DemandeInfographie {
  travailId: string;
  spec: InfographieSpecType;
  gabarit: Gabarit;
  reseaux: readonly Reseau[];
  /** Défaut : carré (1:1). */
  ratio?: RatioInfographie;
  lignes?: LigneCout[];
}

export interface InfographieRendue {
  reseau: Reseau;
  ratio: RatioInfographie;
  empreinte: string;
  cle: string;
}

/** Empreinte SHA-256 d'une infographie pour un réseau : version du rendu, réseau, gabarit, ratio, spec. PUR. */
export function empreinteInfographie(spec: InfographieSpecType, gabarit: Gabarit, ratio: RatioInfographie, reseau: Reseau): string {
  return createHash("sha256").update(`${VERSION_RENDU}\ninfographie\nreseau=${reseau}\n${gabarit}\n${ratio}\n${canonique(spec)}`).digest("hex");
}

/** Clé de stockage d'une infographie : UNIQUE définition, partagée par la production et par la vérification du pont (jamais une clé libre). */
export function cleInfographie(empreinte: string, reseau: Reseau): string {
  return `studio/${segmentStockage()}/visuels/${empreinte.slice(0, 32)}/infographie-${reseau}.jpg`;
}

/** Poids maximal d'une image d'entrée d'« Image → vidéo » (même plafond que le dépôt d'une image : 25 Mo). */
export const TAILLE_MAX_RENDU_OCTETS = 25 * 1024 * 1024;

/**
 * Vérifie côté serveur un rendu reçu du navigateur : empreinte SHA-256 en hexadécimal, réseau connu, ratio connu et clé EXACTEMENT celle que
 * `produireInfographie` aurait écrite (extension comprise). Sinon : refus, avant tout dépôt.
 */
export function verifierRendu(rendu: InfographieRendue): void {
  if (!rendu || typeof rendu !== "object" || !rendu.cle) throw new Error("Cette infographie n'a pas encore d'image");
  if (typeof rendu.empreinte !== "string" || !/^[0-9a-f]{64}$/.test(rendu.empreinte)) throw new Error("Infographie refusée : empreinte invalide");
  if (typeof rendu.reseau !== "string" || !Object.hasOwn(PROFILS_RESEAUX, rendu.reseau)) throw new Error("Infographie refusée : réseau inconnu");
  if (typeof rendu.ratio !== "string" || !Object.hasOwn(FORMATS_INFOGRAPHIE, rendu.ratio)) throw new Error("Infographie refusée : ratio inconnu");
  if (rendu.cle !== cleInfographie(rendu.empreinte, rendu.reseau)) throw new Error("Infographie refusée : clé de stockage inattendue");
}

export async function produireInfographie(demande: DemandeInfographie, deps: DependancesInfographies): Promise<InfographieRendue[]> {
  // Interrupteur d'abord : éteint, rien d'autre ne se passe.
  await exigerGenerateurAllume("infographies");
  const { travailId, spec, gabarit } = demande;
  const ratio = demande.ratio ?? "1:1";
  if (demande.reseaux.length === 0) throw new Error("Aucun réseau demandé");
  const inconnu = demande.reseaux.find((r) => !Object.hasOwn(PROFILS_RESEAUX, r));
  if (inconnu !== undefined) throw new Error(`Réseau inconnu « ${String(inconnu)} »`);
  const reseaux = [...new Set(demande.reseaux)];

  const { reserver, liberer } = deps;
  await reserver({ travailId, lignes: demande.lignes ?? [] });
  try {
    const service = deps.rendu();
    const attente = { delaiMs: deps.delaiMs ?? DELAI_RENDU_MS, attendre: deps.attendre, maintenant: deps.maintenant };
    const rendus: InfographieRendue[] = [];
    for (const reseau of reseaux) {
      const empreinte = empreinteInfographie(spec, gabarit, ratio, reseau);
      const cle = cleInfographie(empreinte, reseau);
      const requete: DemandeRendu = {
        idRendu: identifiantSur(`infographie-${empreinte.slice(0, 32)}`),
        operation: "image-fixe",
        file: "courte",
        entrees: {},
        sortie: { urlDepot: await deps.stockage.urlDepot(cle), cle },
        parametres: { composition: ID_COMPOSITION_INFOGRAPHIE, proprietes: { gabarit, ratio, spec } },
      };
      const fini = await executerRendu(service, requete, attente);
      // Texte qui déborde, mesuré par le serveur de rendu : refusé (le crédit est libéré). Mesure absente : rien à contrôler ici.
      const debordements = fini.mesures?.debordements;
      if (typeof debordements === "number" && debordements >= 1) throw new Error(`L'infographie pour ${reseau} déborde de son cadre (${debordements} débordement(s)) : texte coupé`);
      rendus.push({ reseau, ratio, empreinte, cle });
    }
    await liberer(travailId, "consommee");
    return rendus;
  } catch (e) {
    await liberer(travailId, "liberee");
    throw e;
  }
}

/* ---- Pont vers « Image → vidéo » (L7-34) ---------------------------------------------------------------------------------- */

/**
 * Le fichier d'entrée d'« Image → vidéo » pour une infographie DÉJÀ rendue : la clé de stockage du rendu, rien n'est rendu de nouveau.
 * `taille` est le poids RÉEL de l'objet stocké, mesuré par le serveur (jamais 0 par défaut) : le contrôle de poids du dépôt s'applique.
 */
export function fichierImageVideo(rendu: InfographieRendue, taille: number, maintenant: () => string = () => new Date().toISOString()): Fichier {
  const { largeur, hauteur } = FORMATS_INFOGRAPHIE[rendu.ratio];
  const date = maintenant();
  return {
    id: `inf-${rendu.empreinte.slice(0, 32)}`,
    cleStockage: rendu.cle,
    nom: `infographie-${rendu.reseau}.jpg`,
    mime: "image/jpeg",
    taille,
    largeur,
    hauteur,
    origine: "fabrication",
    statut: "pret",
    creeLe: date,
    modifieLe: date,
  };
}

export interface OptionsPontImageVideo {
  /** Réseaux de la vidéo (ceux du format « Image → vidéo »). */
  reseaux: string[];
  offre?: string;
  titre?: string;
  /** Montant déjà confirmé à l'écran (centimes) : transmis tel quel, jamais décidé ici. */
  accordCentimes?: number;
}

/**
 * Un clic = une vidéo : le dépôt reçoit le fichier de l'infographie rendue. Deux clics en même temps sur la même infographie et les
 * mêmes réseaux partagent un seul dépôt ; une fois fini (refus compris), un nouveau clic reste possible. Aucun rendu n'est soumis.
 * Le rendu reçu du navigateur est vérifié ici (`verifierRendu`) avant tout dépôt, et son poids est mesuré par le serveur (`tailleDe`,
 * injecté : `null` = objet introuvable) : absent, nul ou au-dessus du plafond, il est refusé. Le contrôle de poids n'est jamais sauté.
 */
export function creerPontImageVideo(
  deposer: (demande: DemandeDepotIV, fichier: Fichier) => Promise<IssueDepotIV>,
  tailleDe: (cle: string) => Promise<number | null>,
) {
  const enCours = new Map<string, Promise<IssueDepotIV>>();
  return (rendu: InfographieRendue, options: OptionsPontImageVideo): Promise<IssueDepotIV> => {
    try {
      verifierRendu(rendu);
    } catch (e) {
      return Promise.reject(e);
    }
    const cle = `${rendu.empreinte}|${[...options.reseaux].sort().join(",")}`;
    const deja = enCours.get(cle);
    if (deja) return deja;
    const p = (async () => {
      const taille = await tailleDe(rendu.cle);
      if (typeof taille !== "number" || !Number.isFinite(taille) || taille <= 0) throw new Error("Infographie refusée : image introuvable dans le stockage");
      if (taille > TAILLE_MAX_RENDU_OCTETS) throw new Error("Infographie refusée : image trop lourde");
      const fichier = fichierImageVideo(rendu, taille);
      const demande: DemandeDepotIV = {
        fichierId: fichier.id,
        reseaux: options.reseaux,
        largeur: fichier.largeur!,
        hauteur: fichier.hauteur!,
        ...(options.offre ? { offre: options.offre } : {}),
        ...(options.titre ? { titre: options.titre } : {}),
        ...(typeof options.accordCentimes === "number" ? { accordCentimes: options.accordCentimes } : {}),
      };
      return deposer(demande, fichier);
    })().finally(() => enCours.delete(cle));
    enCours.set(cle, p);
    return p;
  };
}
