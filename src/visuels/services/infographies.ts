import "server-only";
import { createHash } from "node:crypto";
import { PROFILS_RESEAUX, type Reseau } from "@/briques/visuels/reseaux";
import type { InfographieSpecType } from "@/domaine/visuels/schema-infographie";
import type { Fichier, LigneCout } from "@/domaine/types";
import type { DemandeDepotIV, IssueDepotIV } from "@/services/image-video-ecran";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import { identifiantSur, segmentStockage } from "@/fournisseurs/rendu/commun";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { libererReservation, reserverCredits } from "@/services/credits";
import { exigerGenerateurAllume } from "../interrupteur";
import {
  FORMATS_INFOGRAPHIE,
  ID_COMPOSITION_INFOGRAPHIE,
  miseEnPageInfographie,
  type Gabarit,
  type RatioInfographie,
} from "../../../studio-rendu/compositions/visuels/infographie/gabarits/mise-en-page";
import { canonique, DELAI_RENDU_MS, VERSION_RENDU } from "./rendu";

/**
 * Service de production d'une infographie (L2-07) : l'interrupteur « infographies » est vérifié tout au début, AVANT toute réservation de
 * crédit et toute soumission. Éteint (réglage absent ou autre que le booléen `true`) : GENERATEUR_ETEINT, rien n'est réservé ni rendu.
 * Allumé : le texte est mesuré (un texte qui déborde est refusé avant la réservation), le crédit est réservé, puis UN rendu par réseau est
 * soumis (opération « image-fixe », composition « Infographie »). Un échec libère la réservation. Tout est injecté : aucun appel payant ici.
 */

export interface DependancesInfographies {
  rendu: () => ServiceRendu;
  stockage: { urlDepot(cle: string): Promise<string>; urlLecture(cle: string): Promise<string> };
  /** Par défaut : `reserverCredits` (le rendu maison ne coûte rien, les lignes sont celles que l'appelant fournit). */
  reserver?: (demande: { travailId: string; lignes: LigneCout[] }) => Promise<void>;
  /** Par défaut : `libererReservation`. */
  liberer?: (travailId: string, issue: "consommee" | "liberee") => Promise<void>;
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

export async function produireInfographie(demande: DemandeInfographie, deps: DependancesInfographies): Promise<InfographieRendue[]> {
  // Interrupteur d'abord : éteint, rien d'autre ne se passe.
  await exigerGenerateurAllume("infographies");
  const { travailId, spec, gabarit } = demande;
  const ratio = demande.ratio ?? "1:1";
  if (demande.reseaux.length === 0) throw new Error("Aucun réseau demandé");
  const inconnu = demande.reseaux.find((r) => !Object.hasOwn(PROFILS_RESEAUX, r));
  if (inconnu !== undefined) throw new Error(`Réseau inconnu « ${String(inconnu)} »`);
  const reseaux = [...new Set(demande.reseaux)];
  // Un texte qui déborde lève ici, avant la réservation.
  miseEnPageInfographie(gabarit, ratio, spec);

  const reserver = deps.reserver ?? reserverCredits;
  const liberer = deps.liberer ?? libererReservation;
  await reserver({ travailId, lignes: demande.lignes ?? [] });
  try {
    const service = deps.rendu();
    const attente = { delaiMs: deps.delaiMs ?? DELAI_RENDU_MS, attendre: deps.attendre, maintenant: deps.maintenant };
    const rendus: InfographieRendue[] = [];
    for (const reseau of reseaux) {
      const empreinte = empreinteInfographie(spec, gabarit, ratio, reseau);
      const cle = `studio/${segmentStockage()}/visuels/${empreinte.slice(0, 32)}/infographie-${reseau}.jpg`;
      const requete: DemandeRendu = {
        idRendu: identifiantSur(`infographie-${empreinte.slice(0, 32)}`),
        operation: "image-fixe",
        file: "courte",
        entrees: {},
        sortie: { urlDepot: await deps.stockage.urlDepot(cle), cle },
        parametres: { composition: ID_COMPOSITION_INFOGRAPHIE, proprietes: { gabarit, ratio, spec } },
      };
      await executerRendu(service, requete, attente);
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
 * La taille est inconnue ici (0) ; le contrôle de poids du dépôt la laisse passer, l'image rendue étant celle du studio.
 */
export function fichierImageVideo(rendu: InfographieRendue, maintenant: () => string = () => new Date().toISOString()): Fichier {
  const { largeur, hauteur } = FORMATS_INFOGRAPHIE[rendu.ratio];
  const date = maintenant();
  return {
    id: `inf-${rendu.empreinte.slice(0, 32)}`,
    cleStockage: rendu.cle,
    nom: `infographie-${rendu.reseau}.jpg`,
    mime: "image/jpeg",
    taille: 0,
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
 */
export function creerPontImageVideo(deposer: (demande: DemandeDepotIV, fichier: Fichier) => Promise<IssueDepotIV>) {
  const enCours = new Map<string, Promise<IssueDepotIV>>();
  return (rendu: InfographieRendue, options: OptionsPontImageVideo): Promise<IssueDepotIV> => {
    if (!rendu.cle) return Promise.reject(new Error("Cette infographie n'a pas encore d'image"));
    const cle = `${rendu.empreinte}|${[...options.reseaux].sort().join(",")}`;
    const deja = enCours.get(cle);
    if (deja) return deja;
    const fichier = fichierImageVideo(rendu);
    const demande: DemandeDepotIV = {
      fichierId: fichier.id,
      reseaux: options.reseaux,
      largeur: fichier.largeur!,
      hauteur: fichier.hauteur!,
      ...(options.offre ? { offre: options.offre } : {}),
      ...(options.titre ? { titre: options.titre } : {}),
      ...(typeof options.accordCentimes === "number" ? { accordCentimes: options.accordCentimes } : {}),
    };
    const p = deposer(demande, fichier).finally(() => enCours.delete(cle));
    enCours.set(cle, p);
    return p;
  };
}
