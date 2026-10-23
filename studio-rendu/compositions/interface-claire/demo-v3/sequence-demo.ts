/**
 * SÉQUENCE DE LA DÉMO v3 (~22 s, 1080 × 1920) — DONNÉES SEULES, sans React ni Remotion : la même liste sert à la composition
 * (`plan-demo-v3.json`, généré par `outils/facecam-animee-v3/generer-plan-demo.ts`) et au test `tests/facecam-animee/demo-v3.test.ts`, qui la fait passer par les
 * règles du réalisateur (`regles-v3.ts`, via `verifierPlan`).
 *
 * 8 éléments ACTIFS du catalogue v3, des 5 familles, choisis selon les règles : jamais le même emplacement ni la même famille deux
 * fois de suite, visage entier avant 3 s, un seul coup de poing (`dalle-claquee`, à 9,2 s, donc après 8 s), Will seul 1 s après lui,
 * aucun zoom. Chaque élément représente ce que Will DIT à cet instant (transcription fictive ci-dessous : la démo n'a pas de voix).
 *
 * Les vidéos (`broll/*.mp4`) sont des PLACEHOLDERS générés par ffmpeg (aucune banque vidéo n'est jointe au dépôt) : le rendu de
 * démonstration montre la forme, le mouvement et la place des fenêtres, pas des scènes réelles.
 */
import type { ElementV3Plan } from "../../../../src/domaine/facecam-animee/plan";

export const FPS_DEMO_V3 = 30;
export const DUREE_DEMO_V3_SEC = 22.8;
export const FIN_DEMO_V3_SEC = 21.3;
export const LARGEUR_DEMO_V3 = 1080;
export const HAUTEUR_DEMO_V3 = 1920;

/** Ce que « dit » la démo (mots horodatés, secondes). */
export const TRANSCRIPTION_DEMO_V3: readonly { w: string; a: number; f: number }[] = Object.freeze(
  (
    [
      ["Le", 0.3], ["soir", 0.5], ["vous", 0.75], ["tapez", 0.95], ["encore", 1.2], ["vos", 1.5], ["devis", 1.7],
      ["Et", 2.3], ["pendant", 2.5], ["ce", 2.8], ["temps", 3.0],
      ["vos", 3.2], ["clients", 3.45], ["attendent", 3.8], ["une", 4.15], ["relance", 4.4], ["sur", 4.75], ["leur", 4.9], ["téléphone", 5.05],
      ["Avec", 5.9], ["l'assistant", 6.1], ["relance", 6.7], ["envoyée", 7.0], ["devis", 7.5], ["signé", 7.8], ["rendez-vous", 8.1], ["confirmé", 8.5],
      ["Stop", 9.2], ["à", 9.5], ["la", 9.6], ["saisie", 9.75], ["manuelle", 10.0],
      ["Vos", 11.2], ["documents", 11.4], ["partent", 11.8], ["tout", 12.1], ["seuls", 12.3], ["chez", 12.6], ["le", 12.8], ["client", 12.9],
      ["Vous", 13.6], ["gagnez", 13.8], ["du", 14.1], ["temps", 14.2], ["sur", 14.5], ["la", 14.7], ["relance", 14.9], ["la", 15.4], ["facture", 15.6], ["et", 16.0], ["le", 16.1], ["planning", 16.3],
      ["Avec", 17.2], ["votre", 17.4], ["agenda", 17.6], ["sur", 17.9], ["mobile", 18.2],
      ["et", 19.2], ["vous", 19.4], ["restez", 19.6], ["serein", 19.9],
    ] as const
  ).map(([w, a]) => ({ w, a, f: +(a + 0.3).toFixed(2) })),
);

/** Mots forts (sur plaque dans les sous-titres) : ce que les éléments illustrent. */
export const MOTS_FORTS_DEMO_V3 = Object.freeze(["devis", "relance", "stop", "documents", "planning", "serein"]);

export const ELEMENTS_DEMO_V3: readonly ElementV3Plan[] = Object.freeze([
  { id: "mot-saute", debut: 1.6, fin: 2.8, mots: ["DEVIS"], illustre: "tapez encore vos devis" },
  { id: "fenetre-telephone", debut: 3.4, fin: 5.6, mots: ["Relance"], recherches: ["client qui lit une relance sur son téléphone"], medias: ["broll/telephone.mp4"], illustre: "relance sur leur téléphone" },
  { id: "notifications-verre", debut: 6.4, fin: 8.9, lignes: [{ texte: "Relance envoyée", a: 6.7, icone: "mail" }, { texte: "Devis signé", a: 7.5, icone: "coche" }, { texte: "Rendez-vous confirmé", a: 8.1, icone: "calendrier" }], illustre: "relance envoyée devis signé rendez-vous confirmé" },
  { id: "dalle-claquee", debut: 9.2, fin: 10.3, mots: ["Stop"], illustre: "Stop à la saisie manuelle" },
  { id: "bande-video", debut: 11.5, fin: 13.3, mots: ["Partent"], recherches: ["documents qui partent en livraison chez le client"], medias: ["broll/livraison.mp4"], illustre: "documents partent chez le client" },
  { id: "carte-verre", debut: 13.7, fin: 17.2, mots: ["Temps"], lignes: [{ texte: "Relance", a: 14.9, icone: "mail" }, { texte: "Facture", a: 15.6, icone: "document" }, { texte: "Planning", a: 16.3, icone: "calendrier" }], illustre: "temps sur la relance la facture le planning" },
  { id: "cercle-epaule", debut: 17.5, fin: 19.1, recherches: ["personne qui consulte son agenda sur un ordinateur"], medias: ["broll/agenda.mp4"], illustre: "votre agenda sur mobile" },
  { id: "mot-derriere", debut: 19.4, fin: 21.1, mots: ["SEREIN"], illustre: "vous restez serein" },
]);

export const PRISE_DEMO_V3 = Object.freeze({ src: "prise-demo.mp4", finSec: DUREE_DEMO_V3_SEC, yeux: 0.325, centreX: 0.513, largeurVisage: 0.49 });
export const FIN_ECRAN_DEMO_V3 = Object.freeze({ debut: FIN_DEMO_V3_SEC, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DEVIS", tuiles: ["mail", "calendrier", "document"] });
