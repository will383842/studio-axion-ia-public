import { capaciteEtape } from "../../src/briques/visuels/registre-pages.js";
import { casMax, texteMotsLongs } from "./contenu-essai-visuel.js";

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

/** Étapes à leur budget (registre), en mots longs : le cas le plus rude de la colonne étroite. */
const etapesMax = (n: number) => Array.from({ length: n }, (_, i) => ({ titre: texteMotsLongs(capaciteEtape(n).titre, i), corps: texteMotsLongs(capaciteEtape(n).corps, i + 3) }));

export const CAS_L10_L11: CasL10L11[] = [
  // Ancienne page étapes (sans la clé `variante`) : empreinte JPEG identique avant et après le lot.
  ...[3, 4, 5].map((n) => ({ nom: `t20-ancienne-${n}`, page: { type: "T20", titre: "La méthode type", etapes: etapes(n) } })),
  // Variante à mini-maquettes : contenu ordinaire, puis budgets maximaux en mots longs.
  ...[3, 4, 5].map((n) => ({ nom: `t20-maquettes-${n}`, page: { type: "T20", titre: "La méthode type", etapes: etapes(n), variante: "maquettes" } })),
  ...[3, 4, 5].map((n) => ({ nom: `t20-maquettes-max-${n}`, page: { type: "T20", titre: "Construire messages", etapes: etapesMax(n), variante: "maquettes" } })),
  // T29 : contenu ordinaire (question, phrase forte), mots longs, budgets maximaux.
  { nom: "t29-question", page: { type: "T29", relance: "Et chez vous, par où commencer ?", rappels: [{ texte: "Repérer une tâche qui revient" }, { texte: "Garder la main sur chaque étape" }] } },
  { nom: "t29-phrase", page: { type: "T29", relance: "Le plus dur, c'est de commencer.", rappels: [{ texte: "Une tâche précise suffit" }, { texte: "Un essai court, sans risque" }, { texte: "Vous décidez de la suite" }] } },
  { nom: "t29-mots-longs", page: { type: "T29", relance: "Professionnalisation administrative indispensable", rappels: [{ texte: "Professionnalisation des correspondances" }, { texte: "Responsabilités hiérarchiques" }, { texte: "Vérifications indispensables" }] } },
  ...casMax("T29", texteMotsLongs).map((c, i) => ({ nom: `t29-maximal-v${i + 1}`, page: c.page })),
];
