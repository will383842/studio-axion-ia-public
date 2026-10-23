/**
 * Mini-vidéo synthétique (22 s, un mot toutes les 0,5 s, « 45 » dit à 5 s) et PLAN DE RÉFÉRENCE du réalisateur, partagés
 * par `realisateur.test.ts` et `diversite.test.ts`.
 */
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { VERSION_PLAN_FACECAM_ANIMEE } from "@/domaine/facecam-animee/plan";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { groupesSousTitres } from "@/moteurs/montage-facecam-animee/realisateur/sous-titres";

export const VOCABULAIRE = [
  "Vos", "devis", "partent", "le", "soir", "relances", "factures", "agenda", "clients", "bureau",
  "45", "minutes", "atelier", "chantier", "camion", "livraison", "téléphone", "clavier", "réunion", "équipe",
  "dossier", "contrat", "signature", "carnet", "commandes", "stock", "planning", "semaine", "tableau", "écran",
  "rendez-vous", "visio", "courrier", "colis", "entrepôt", "comptable", "banque", "caisse", "boutique", "devis.",
];
export const MOTS: MotTranscrit[] = VOCABULAIRE.map((w, i) => ({ w, a: i * 0.5, f: i * 0.5 + 0.4 }));

/**
 * Plan de référence (vidéo 5 corrigée, 15/10) : 12 APPARITIONS DE 12 FAMILLES DIFFÉRENTES, jamais la même deux fois de
 * suite — trait dessiné (0,8 s : rien avant, R1a), horloge, étiquette, chiffre qui éclate, mini-vidéo « au-dessus »
 * enchaînée, téléphone, carte liste (≥ 8 s, R1d), pile de notifications, mot géant (premier objet qui couvre le visage, à
 * 13,5 s), ruban, jauge, bulles. AUCUN zoom ni mouvement de cadrage (décision de Will du 15/10) ; compté COMME LA MESURE
 * (`rythme.ts`) avec ses sous-titres ; chaque objet avec « illustre ».
 */
export function planValide(): PlanFacecamAnimee {
  return {
    version: VERSION_PLAN_FACECAM_ANIMEE,
    charte: "interface-claire/1",
    duree: 22,
    fps: 25,
    largeur: 1080,
    hauteur: 1920,
    prise: { src: "prise.mp4", finSec: 20 },
    groupes: groupesSousTitres(MOTS),
    // Décision de Will du 15/10 (« il faut supprimer le zoom car ça bouge trop ») : aucun zoom, aucun mouvement.
    zooms: [],
    mouvements: [],
    cartes: [
      {
        debut: 8.95, fin: 11.6, titre: "Réunion d'équipe", illustre: "réunion équipe dossier contrat signature", icone: "utilisateurs", entree: "chute",
        contenu: { type: "liste", lignes: [{ texte: "Réunion", icone: "utilisateurs", a: 9.0 }, { texte: "Équipe", icone: "utilisateurs", a: 9.5 }, { texte: "Dossier", icone: "dossier", a: 10.0 }, { texte: "Contrat", icone: "document", a: 10.5 }, { texte: "Signature", icone: "document", a: 11.0 }] },
      },
    ],
    fenetres: [{ debut: 6.0, fin: 7.4, media: "fenetre-1", recherche: "artisan qui charge un camion sur un chantier", illustre: "chantier camion", video: true, cadrage: "au-dessus", entree: "droite" }],
    calques: [{ type: "etiquette", debut: 4.0, fin: 4.9, texte: "Bureau", fond: "orange", icones: [{ nom: "document", a: 4.5 }] }],
    motions: [
      { debut: 0.8, fin: 2.2, famille: "trait-dessine", illustre: "partent le soir", contenu: { forme: "souligne", traits: [{ mot: "partent", a: 1.0 }, { mot: "soir", a: 2.0 }] } },
      { debut: 2.3, fin: 3.9, famille: "horloge", illustre: "soir relances factures agenda", contenu: { mode: "horloge", a: 2.5, reperes: [{ a: 3.0 }, { a: 3.5 }] } },
      { debut: 4.95, fin: 5.9, famille: "chiffre-eclate", illustre: "45 minutes", contenu: { valeur: 45, a: 5.0, suffixe: "min", eclatA: 5.5 } },
      { debut: 7.5, fin: 8.85, famille: "telephone", illustre: "livraison téléphone clavier", contenu: { appli: "notification", lignes: [{ texte: "Livraison", a: 7.5 }, { texte: "Téléphone", a: 8.0 }, { texte: "Clavier", a: 8.5 }] } },
      { debut: 11.7, fin: 13.4, famille: "pile-notifications", illustre: "commandes stock planning", contenu: { notifications: [{ titre: "Commandes", icone: "dossier", a: 12.0 }, { titre: "Stock", icone: "calendrier", a: 12.5 }, { titre: "Planning", icone: "calendrier", a: 13.0 }] } },
      { debut: 13.5, fin: 14.3, famille: "mot-geant", illustre: "semaine tableau", contenu: { mots: [{ texte: "Semaine", a: 13.5 }, { texte: "Tableau", a: 14.0 }], fond: "orange" } },
      { debut: 14.4, fin: 16.4, famille: "ruban", illustre: "écran rendez-vous visio courrier", contenu: { mots: [{ texte: "Écran", a: 14.5 }, { texte: "Rendez-vous", a: 15.0 }, { texte: "Visio", a: 15.5 }, { texte: "Courrier", a: 16.0 }] } },
      { debut: 16.5, fin: 17.9, famille: "jauge", illustre: "colis entrepôt comptable", contenu: { forme: "cadran", legende: "Colis", niveaux: [{ niveau: 0.5, a: 16.5 }, { niveau: 0.9, a: 17.0 }] } },
      { debut: 18.0, fin: 19.6, famille: "bulles", illustre: "banque caisse boutique", contenu: { questions: [{ texte: "Banque ou caisse ?", a: 18.0 }, { texte: "Boutique ?", a: 19.0 }] } },
    ],
    fin: { debut: 20, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
    sons: [],
  };
}

