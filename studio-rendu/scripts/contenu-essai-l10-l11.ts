/** Contenu FIGÉ et INVENTÉ de l'essai du lot L10 / L11 (« exemple type » neutre) : aucun chiffre, aucune marque, aucun fait réel. */
export interface CasL10L11 {
  nom: string;
  page: Record<string, unknown>;
}

/** Étapes d'exemple type (titre / corps) : les budgets de T20 restent ceux du registre. */
const ETAPES = [
  { titre: "Lister les tâches", corps: "Noter ce qui revient chaque semaine." },
  { titre: "Remplir la fiche", corps: "Décrire la tâche en quelques lignes." },
  { titre: "Répondre au message", corps: "Un brouillon prêt à relire." },
  { titre: "Planifier", corps: "Choisir le bon moment." },
  { titre: "Valider", corps: "Vous gardez la main." },
] as const;

const etapes = (n: number) => ETAPES.slice(0, n).map((e) => ({ ...e }));

export const CAS_L10_L11: CasL10L11[] = [
  ...[3, 4, 5].map((n) => ({ nom: `t20-ancienne-${n}`, page: { type: "T20", titre: "La méthode type", etapes: etapes(n) } })),
];
