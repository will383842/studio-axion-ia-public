/**
 * Le formulaire « Ajouter un cas » : l'état de l'écran (tout en texte) et sa traduction en formulaire du serveur. PUR.
 */
import { OBJETS, type ObjetCas } from "@/formats/cas-concret/cas";

export interface EtapeSaisie {
  ligne: string;
  titre: string;
  detail: string;
  objet: "" | ObjetCas;
}

export interface SaisieCas {
  titre: string;
  theme: string;
  offre: "integration" | "audit" | "formation" | "coaching";
  nature: "automatisation" | "outils-relies";
  secteur: string;
  taille: string;
  cible: string;
  promesse: string;
  sujet: string;
  scene: string;
  exemple: string;
  /** Une tâche par ligne. */
  taches: string;
  etapes: EtapeSaisie[];
  resteHumain: string;
  /** Rang de l'étape après laquelle vient la partie humaine (texte du champ). */
  apres: string;
  resultat: string;
  mot: string;
  valider: boolean;
  script: string;
}

export const ETAPES_MIN = 3;
export const ETAPES_MAX = 7;
export const etapeVide = (): EtapeSaisie => ({ ligne: "", titre: "", detail: "", objet: "" });

export const saisieVide = (): SaisieCas => ({
  titre: "", theme: "", offre: "integration", nature: "automatisation", secteur: "", taille: "", cible: "", promesse: "", sujet: "", scene: "", exemple: "", taches: "",
  etapes: [etapeVide(), etapeVide(), etapeVide()], resteHumain: "", apres: "", resultat: "", mot: "", valider: true, script: "",
});

/** Libellés en clair des objets montrés à l'écran. */
export const LIBELLES_OBJETS: Record<ObjetCas, string> = {
  "telephone-capture": "Téléphone (capture)", "telephone-notification": "Téléphone (notification)", "pile-notifications": "Pile de notifications", chrono: "Chronomètre",
  "contrat-signature": "Contrat à signer", "dossier-classe": "Dossier classé", "bouclier-coche": "Bouclier coché", "champ-commentaire": "Champ de commentaire", "bulle-lien": "Bulle avec lien",
  "liste-taches": "Liste de tâches", "barres-avant-apres": "Barres avant / après", calendrier: "Calendrier", programme: "Programme", rapport: "Rapport", "carte-taches": "Carte de tâches",
  "outils-relies": "Outils reliés", "e-mail": "E-mail",
};
export const OBJETS_CHOIX: readonly ObjetCas[] = OBJETS;

const net = (t: string): string => t.trim();

/** Le formulaire tel que le serveur l'attend : les champs vides facultatifs sont omis, les tâches séparées par ligne. */
export function versFormulaire(s: SaisieCas): Record<string, unknown> {
  const rang = Number(net(s.apres));
  return {
    titre: net(s.titre),
    theme: net(s.theme),
    offre: s.offre,
    ...(s.offre === "integration" ? { nature: s.nature } : {}),
    ...(s.secteur ? { secteur: s.secteur } : {}),
    ...(s.taille ? { taille: s.taille } : {}),
    cible: net(s.cible),
    promesse: net(s.promesse),
    sujet: net(s.sujet),
    scene: net(s.scene),
    exemple: net(s.exemple),
    taches: s.taches.split("\n").map(net).filter(Boolean),
    etapes: s.etapes.map((e) => ({ ligne: net(e.ligne), ...(net(e.titre) ? { titre: net(e.titre) } : {}), ...(net(e.detail) ? { detail: net(e.detail) } : {}), ...(e.objet ? { objet: e.objet } : {}) })),
    resteHumain: net(s.resteHumain),
    resteHumainApresEtape: Number.isInteger(rang) ? rang : 0,
    resultat: net(s.resultat),
    mot: net(s.mot),
  };
}

/** Le champ en faute d'une raison « Champ : … » (pour y placer le curseur) ; absent : on reste sur la liste. */
export function champEnFaute(raison: string): string | null {
  const nom = raison.split(" : ")[0]?.trim() ?? "";
  const fixes: Record<string, string> = { Titre: "titre", "Thème": "theme", Promesse: "promesse", "Pour qui": "cible", Sujet: "sujet", "Scène": "scene", Exemple: "exemple", "Ce qui reste humain": "resteHumain", "Résultat": "resultat", "Mot à commenter": "mot", "Mon script": "script" };
  if (fixes[nom]) return fixes[nom];
  if (/^Tâche \d+$/.test(nom)) return "taches";
  const e = /^Étape (\d+)/.exec(nom);
  if (e) return `etape-${Number(e[1]) - 1}`;
  return null;
}
