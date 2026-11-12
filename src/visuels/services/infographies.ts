import "server-only";
import { createHash } from "node:crypto";
import { PROFILS_RESEAUX, type Reseau } from "@/briques/visuels/reseaux";
import type { InfographieSpecType } from "@/domaine/visuels/schema-infographie";
import type { LigneCout } from "@/domaine/types";
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
      const cle = `studio/${segmentStockage()}/visuels/${empreinte.slice(0, 32)}/infographie-${reseau}.jpg`;
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
