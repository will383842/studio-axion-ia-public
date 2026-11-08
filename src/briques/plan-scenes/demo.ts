/**
 * PLAN DE DÉMO (lot C) — 15 s, 3 scènes : niveau 1 (carte KPI), niveau 2 (fenêtre d'app + frappe + curseur + zoom),
 * niveau 1 (tableau de bord). Minutage des mots FICTIF et régulier (420 ms par mot, une phrase toutes les 5 s).
 * Sert à la démo rendue (`studio-rendu/scripts/demo-plan-scenes.ts`) et aux tests.
 */
import type { MotMinute, PlanDeScenes } from "./schema";
import { VERSION_PLAN_SCENES } from "./schema";

const PHRASES = [
  "Chaque mois, plus 38 % de devis envoyés.",
  "La demande arrive, l'assistant remplit la fiche du client tout seul.",
  "Résultat : 27 demandes cette semaine, réponse en 12 minutes.",
];

export const SCRIPT_DEMO = PHRASES.join(" ");

function minuter(): MotMinute[] {
  return PHRASES.flatMap((p, i) => p.split(/\s+/).map((texte, j) => ({ texte, debutMs: i * 5000 + j * 420, finMs: i * 5000 + j * 420 + 360 })));
}

export const MOTS_DEMO: MotMinute[] = minuter();
const n1 = PHRASES[0]!.split(/\s+/).length;
const n2 = PHRASES[1]!.split(/\s+/).length;
const transition = { entree: "glisse-haut", sortie: "fondu", dureeMs: 400 } as const;

export const PLAN_DEMO: PlanDeScenes = {
  version: VERSION_PLAN_SCENES,
  format: { largeur: 1080, hauteur: 1920, fps: 25 },
  facecam: false,
  dureeMs: 15_000,
  habillage: { fond: "ivoire", accent: "terracotta" },
  mots: MOTS_DEMO,
  scenes: [
    {
      id: "s1",
      version: 1,
      mots: { premier: 0, dernier: n1 - 1 },
      debutMs: 0,
      finMs: 5000,
      niveau: 1,
      position: "centre",
      transition,
      piece: "carte-kpi",
      parametres: { libelle: "Devis envoyés ce mois", valeur: 38, prefixe: "+", suffixe: " %", decimales: 0, tendance: "hausse", variation: "vs septembre" },
    },
    {
      id: "s2",
      version: 1,
      mots: { premier: n1, dernier: n1 + n2 - 1 },
      debutMs: 5000,
      finMs: 10_000,
      niveau: 2,
      texte: "L'assistant remplit la fiche",
      position: "centre",
      transition: { entree: "zoom-doux", sortie: "fondu", dureeMs: 400 },
      piece: "fenetre-app",
      parametres: { titre: "Axion CRM", onglets: ["Demandes", "Fiche client", "Devis"], ongletActif: 1, contenu: "vide" },
      calques: [
        { piece: "zoom-camera", parametres: { cible: { x: 50, y: 45 }, facteur: 1.25, moment: 0.45, titreFenetre: "Axion CRM" }, debutMs: 0, zone: "plein" },
        { piece: "fenetre-app", parametres: { titre: "Axion CRM", onglets: ["Demandes", "Fiche client", "Devis"], ongletActif: 1, contenu: "vide" }, debutMs: 0, zone: "plein" },
        { piece: "frappe-clavier", parametres: { champ: "Demande", texte: "Fuite sous l'évier, cuisine", vitesse: 16 }, debutMs: 900, zone: "centre" },
        { piece: "curseur", parametres: { trajet: [{ x: 15, y: 85 }, { x: 50, y: 52 }, { x: 78, y: 82 }], clic: true, partDeplacement: 0.7 }, debutMs: 600, zone: "plein" },
      ],
    },
    {
      id: "s3",
      version: 1,
      mots: { premier: n1 + n2, dernier: MOTS_DEMO.length - 1 },
      debutMs: 10_000,
      finMs: 15_000,
      niveau: 1,
      position: "centre",
      transition,
      piece: "tableau-de-bord",
      parametres: {
        titre: "Cette semaine",
        kpis: [
          { libelle: "Demandes", valeur: "27" },
          { libelle: "Temps de réponse", valeur: "12 min" },
        ],
        serie: [4, 6, 5, 8, 7, 11, 13],
      },
    },
  ],
};
