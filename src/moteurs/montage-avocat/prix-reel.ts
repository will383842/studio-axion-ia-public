/**
 * PRIX D'UNE VIDÉO AVOCAT MONTÉE POUR DE VRAI (lot R8). PUR, testé (prouvé par mutation).
 *
 * Montré AVANT d'allumer « Montage réel des vidéos avocat » (Réglages > Connexions > Montage) : une vidéo de référence
 * de 45 s, aux tarifs relevés que le moteur applique déjà :
 *  - voix HeyGen : au caractère lu (`CENTIMES_USD_PAR_CARACTERE_HEYGEN`), 16 caractères par seconde parlée ;
 *  - double HeyGen (Avatar V) : à la seconde rendue (`CENTIMES_USD_PAR_SECONDE_AVATAR_V`), l'angle principal sur toute
 *    la durée ; et, quand deux avatars prêts existent, le second angle sur sa part (même règle que la brique « visage »
 *    et `secondesAnnonceesDouble` : ⌈durée × part × 1,3 + 2⌉ s) ;
 *  - textes des réseaux (Claude) : la même estimation réaliste que le lancement, réseau par réseau ;
 *  - illustrations fabriquées (fal.ai : une image puis un clip de 5 s) : INTÉGRATION FINALE, le nombre « type » d'une
 *    vidéo avocat, tiré de sa recette (`illustrationsTypes`), quand la fabrication est branchée ;
 *  - montage, sous-titres, couleurs, son, miniature : sur notre serveur, 0 €.
 * Avant CHAQUE lancement, c'est l'estimation de la vidéo elle-même qui est montrée et confirmée (`fabrication.ts`).
 */
import type { IdReseau, Montant } from "@/domaine/types";
import { centimesUsd } from "@/fournisseurs/claude/tarifs";
import { CENTIMES_USD_PAR_SECONDE_AVATAR_V } from "@/fournisseurs/heygen/rendus";
import { CENTIMES_USD_PAR_CARACTERE_HEYGEN } from "@/fournisseurs/heygen/voix";
import { prixFabricationUsd } from "@/domaine/illustrations";
import { RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { estimationRealisteRole } from "@/generateur/roles/estimation";
import { donneesPublication, entreePublication, rolePublication } from "@/generateur/roles/publication";
import { additionner, centimes, TAUX_USD_EUR_PAR_DEFAUT, usdVersEur } from "@/lib/montants";

/** Durée de la vidéo de référence du prix affiché. */
export const DUREE_PRIX_REFERENCE_SEC = 45;
/** Débit parlé moyen en français (caractères lus par seconde), le même que la démonstration. */
export const CARACTERES_PAR_SECONDE = 16;

export interface LignePrixReel {
  quoi: string;
  montant: Montant;
}

export interface PrixVideoReelle {
  dureeSec: number;
  lignes: LignePrixReel[];
  total: Montant;
}

/** Estimation réaliste des textes des réseaux (Claude) pour une vidéo de cette durée, en centimes de dollar. */
export function centimesUsdTextesReseaux(reseaux: IdReseau[], dureeSec = DUREE_PRIX_REFERENCE_SEC): number {
  const texteValide = "Votre question juridique, expliquée simplement. ".repeat(Math.ceil((dureeSec * CARACTERES_PAR_SECONDE) / 48)).slice(0, dureeSec * CARACTERES_PAR_SECONDE);
  let usd = 0;
  for (const reseau of reseaux) usd += estimationRealisteRole(rolePublication, entreePublication(donneesPublication({ reseau, titre: "Vidéo de 45 secondes", texteValide, formatId: "avocat", dureeSec, mention: "", credits: [], regles: [] })));
  return centimesUsd(usd);
}

/**
 * Nombre « type » d'illustrations fabriquées dans une vidéo avocat de cette durée, tiré de la recette : la couverture
 * visée (25 %) découpée en plans les plus courts (1,5 s) : ⌈45 × 0,25 ÷ 1,5⌉ = 8 pour 45 s. C'est le plus que la
 * cascade puisse laisser « à fabriquer » : le prix annoncé n'est jamais sous-estimé (souvent la Bibliothèque ou une
 * banque gratuite en fournit une partie).
 */
export function illustrationsTypes(dureeSec = DUREE_PRIX_REFERENCE_SEC): number {
  const { couverturePct, dureeSec: [plusCourte] } = RECETTE_MONTAGE_AVOCAT.illustrations;
  return Math.ceil((dureeSec * couverturePct) / 100 / plusCourte - 1e-9);
}

/** Secondes du second angle (même règle que la brique « visage ») ; 0 sans second angle. */
export function secondesSecondAngle(dureeSec: number, partSecondAngle: number): number {
  return partSecondAngle > 0 ? Math.ceil(dureeSec * partSecondAngle * 1.3 + 2) : 0;
}

/**
 * Le prix d'une vidéo montée pour de vrai, ligne par ligne (en euros au taux du studio). `partSecondAngle` : part du
 * second angle quand deux avatars prêts existent (0 ou absent : un seul angle).
 */
export function prixVideoReelle(o: { dureeSec?: number; tauxUsdEur?: number; reseaux: IdReseau[]; partSecondAngle?: number; illustrationsFabriquees?: boolean; lecturesVoixMax?: number }): PrixVideoReelle {
  const dureeSec = o.dureeSec ?? DUREE_PRIX_REFERENCE_SEC;
  const taux = o.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT;
  const second = secondesSecondAngle(dureeSec, o.partSecondAngle ?? 0);
  const illustrations = o.illustrationsFabriquees ? illustrationsTypes(dureeSec) : 0;
  const lignes: LignePrixReel[] = [
    // Voix : arrondie au centime SUPÉRIEUR (jamais « 0 € » pour une voix payée). 14/10 (voix de référence) : lue jusqu'à
    // `lecturesVoixMax` fois (contrôle de ressemblance) : le prix montré est ce maximum (absent : 1 lecture).
    { quoi: "Voix", montant: centimes(Math.ceil(dureeSec * CARACTERES_PAR_SECONDE * CENTIMES_USD_PAR_CARACTERE_HEYGEN * taux - 1e-9) * Math.max(1, Math.floor(o.lecturesVoixMax ?? 1))) },
    { quoi: "Votre avatar", montant: usdVersEur(dureeSec * CENTIMES_USD_PAR_SECONDE_AVATAR_V, taux) },
    ...(second > 0 ? [{ quoi: "Votre avatar, second angle", montant: usdVersEur(second * CENTIMES_USD_PAR_SECONDE_AVATAR_V, taux) }] : []),
    ...(illustrations > 0 ? [{ quoi: `Illustrations fabriquées (jusqu'à ${illustrations})`, montant: centimes(Math.ceil(illustrations * prixFabricationUsd() * taux - 1e-9)) }] : []),
    ...(o.reseaux.length ? [{ quoi: "Textes des réseaux", montant: usdVersEur(centimesUsdTextesReseaux(o.reseaux, dureeSec), taux) }] : []),
    { quoi: "Montage, sous-titres, couleurs, son, miniature", montant: centimes(0) },
  ];
  return { dureeSec, lignes, total: additionner(...lignes.map((l) => l.montant)) };
}
