"use client";

/**
 * Bouton « Animations » à 4 crans (X3-09a). Composant neuf, monté nulle part (le montage est X3-09b).
 * Il ne lit aucun réglage et n'écrit rien : il reçoit `valeur` et rend le choix par `surChoix`.
 */
import { SelecteurPastilles, type OptionPastille } from "@/components/ui";
import { CRANS_PERMIS, PHRASE_CRAN_GRISE, type DosageMotion, type IdGenerateurDosage } from "@/briques/dosage-motion";

export const LIBELLES_CRANS: Record<DosageMotion, string> = {
  aucun: "Aucun",
  sobre: "Sobre",
  equilibre: "Équilibré",
  dynamique: "Dynamique",
};

export const AIDES_CRANS: Record<DosageMotion, string> = {
  aucun: "Sous-titres seuls, image fixe, coupes franches",
  sobre: "Peu d'animations, calmes",
  equilibre: "Comme d'habitude",
  dynamique: "Plus d'animations, plus de rythme",
};

const ORDRE: readonly DosageMotion[] = ["aucun", "sobre", "equilibre", "dynamique"];

/** Phrase du cran grisé : celle de la v4 pour la face caméra animée, l'autre sinon. */
export function phraseCranGrise(generateur: IdGenerateurDosage): string {
  return generateur === "facecam-animee" ? PHRASE_CRAN_GRISE.v4 : PHRASE_CRAN_GRISE.animations;
}

/** Un cran est grisé s'il est absent des crans permis du générateur. */
export function cranGrise(generateur: IdGenerateurDosage, cran: DosageMotion): boolean {
  return !CRANS_PERMIS[generateur].includes(cran);
}

/** Le choix d'un cran : ignoré s'il est grisé, sinon rendu à `surChoix`. */
export function choisirCran(generateur: IdGenerateurDosage, cran: DosageMotion, surChoix: (c: DosageMotion) => void): void {
  if (cranGrise(generateur, cran)) return;
  surChoix(cran);
}

export interface BoutonDosageProps {
  generateur: IdGenerateurDosage;
  valeur: DosageMotion;
  surChoix: (cran: DosageMotion) => void;
  desactive?: boolean;
}

export function BoutonDosage({ generateur, valeur, surChoix, desactive }: BoutonDosageProps) {
  const phrase = phraseCranGrise(generateur);
  const options: OptionPastille<DosageMotion>[] = ORDRE.map((cran) => {
    const grise = cranGrise(generateur, cran);
    return { valeur: cran, libelle: LIBELLES_CRANS[cran], desactive: desactive || grise, raison: grise ? phrase : undefined };
  });
  const aGrise = ORDRE.some((c) => cranGrise(generateur, c));
  return (
    <div className="flex flex-col gap-2">
      <SelecteurPastilles<DosageMotion> libelle="Animations" options={options} valeur={valeur} onChange={(c) => choisirCran(generateur, c, surChoix)} />
      <p className="text-sm text-texte-doux">{AIDES_CRANS[valeur]}</p>
      {aGrise && <p className="text-sm text-texte-faible">{phrase}</p>}
    </div>
  );
}
