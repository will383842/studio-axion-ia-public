/**
 * EXTRAITS MODÈLES (phrases INVENTÉES pour la version publique, à la forme des modèles de ton d'origine).
 *
 * Donnée de travail : de courtes phrases d'exemple, dites par un avocat fictif, données aux rôles comme modèles de TON (phrases courtes, oral, verdict posé, récit « venu me voir →
 * j'ai fait → résultat »). Elles vont dans le bloc `<gagnants>` tant qu'il n'existe pas de statistiques propres (B.3.3).
 * Ce sont des données : jamais des instructions, jamais un contenu à reprendre.
 */

export interface ExtraitModele {
  code: string;
  structure: string;
  /** Ce que l'extrait montre (geste, verdict, récit…). */
  montre: string;
  /** Texte dit, transcrit (faster-whisper), coupé court. */
  extrait: string;
  vues: number;
}

export const EXTRAITS_AVOCATREF: readonly ExtraitModele[] = [
  { code: "D01", structure: "AV.S1", montre: "situation affirmative + geste avant 3 s", extrait: "Tu reçois une amende pour un stationnement gênant, attends avant de payer car le délai n'a pas encore couru.", vues: 959100 },
  { code: "D12", structure: "AV.S1", montre: "verdict immédiat, raison, « Par contre », fin sur le fait", extrait: "Si lors d'un contrôle d'identité, un agent vous demande lui-même de signer le procès-verbal, c'est discutable. […] Par contre, je vous conseille forcément de relire ce document.", vues: 159600 },
  { code: "D06", structure: "AV.S3", montre: "résultat d'abord, puis le récit de ce qui a été fait", extrait: "Le bailleur de ma cliente lui a réclamé 2000 euros, j'ai obtenu l'annulation de la somme. […] Elle était sur le point de payer et heureusement pour elle, elle m'a contacté. On a relu chaque ligne du décompte, on a tout recalculé.", vues: 0 },
  { code: "D04", structure: "AV.S3", montre: "« est venu me voir » à 0 s, problème concret", extrait: "Un boulanger est venu me voir, il avait reçu un courrier de la mairie.", vues: 0 },
  { code: "D18", structure: "AV.S2", montre: "chiffre à 0 s, récit, « On a repris tout son dossier »", extrait: "Un client a subi un dégât des eaux et je lui ai obtenu plus de 40 000 euros de remboursement alors que son assureur lui en proposait 8 fois moins. […] On a repris tout son dossier, on a listé l'ensemble de ses pertes.", vues: 858 },
  { code: "D08", structure: "AV.S4", montre: "idée reçue, pivot « Mais », fin sur le fait, sans appel", extrait: "Les gens, ils pensent qu'un bail résilié ou un contrat rompu, c'est définitif. Mais ça fait des années qu'on utilise des recours pour revenir dessus. […] C'est exactement ce qu'on fait.", vues: 1500000 },
  { code: "D10", structure: "AV.S10", montre: "règle cachée : anomalie, enjeu, règle, conséquence", extrait: "Lors d'une visite de contrôle, il y a une formalité que l'administration oublie très souvent. Et ça peut changer l'issue du dossier. […] Et ça, ça peut annuler une décision.", vues: 268500 },
  { code: "D17", structure: "AV.S2", montre: "chiffre d'abord, promesse courte", extrait: "J'ai fait annuler plus de 2 millions d'euros de pénalités de retard. Et je vais vous dire comment.", vues: 825 },
];

/** 2-3 extraits pour une structure donnée (ceux de la structure d'abord, puis les plus vus). */
export function extraitsPour(structure: string, n = 3): ExtraitModele[] {
  const propres = EXTRAITS_AVOCATREF.filter((x) => x.structure === structure);
  const autres = [...EXTRAITS_AVOCATREF].filter((x) => x.structure !== structure).sort((a, b) => b.vues - a.vues);
  return [...propres, ...autres].slice(0, n);
}

/** Rendu dans un bloc de données (citation courte, marquée donnée). */
export function rendreExtraits(xs: readonly ExtraitModele[]): string {
  return xs.map((x) => `<modele code="${x.code}" structure="${x.structure}" montre="${x.montre}">${x.extrait}</modele>`).join("\n");
}
