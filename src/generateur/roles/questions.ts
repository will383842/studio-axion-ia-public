/**
 * QUESTIONS BINAIRES DES JUGES, versionnées (plan v5 B.7.4 ; addendum §2 quinquies ; lot G4). PUR.
 * Les juges ÉLIMINENT, ils ne classent pas ; le total est calculé par le code. Indicatifs jusqu'au calibrage (G5).
 */

export interface QuestionJuge {
  id: string;
  version: number;
  texte: string;
  /** Réponse attendue d'un bon texte. */
  attendu: "oui" | "non";
  etapes: (4 | 9 | 11 | 12)[];
}

export const QUESTIONS_JUGES: readonly QuestionJuge[] = [
  { id: "ACC-01", version: 1, texte: "Un concurrent pourrait-il dire cette accroche telle quelle ?", attendu: "non", etapes: [4, 11] },
  { id: "ACC-02", version: 1, texte: "Si l'accroche contient un chiffre, décrit-il une anomalie pour un dirigeant ? (sans chiffre : sans objet)", attendu: "oui", etapes: [4, 11] },
  { id: "ACC-03", version: 1, texte: "À 3 secondes, le spectateur sait-il de quoi parle la vidéo et pourquoi ça le concerne ?", attendu: "oui", etapes: [4, 11] },
  { id: "ACC-04", version: 1, texte: "L'accroche respecte-t-elle le niveau de conscience visé ?", attendu: "oui", etapes: [4, 11] },
  { id: "ACC-05", version: 1, texte: "Cette accroche porte-t-elle l'angle retenu ?", attendu: "oui", etapes: [4] },
  { id: "SCR-01", version: 1, texte: "Un concurrent pourrait-il dire ce script tel quel ?", attendu: "non", etapes: [9] },
  { id: "ANC-01", version: 1, texte: "L'élément vrai du script (l'ancrage) est-il relié au sujet, et non plaqué ?", attendu: "oui", etapes: [9] },
  { id: "CRED-01", version: 1, texte: "La conclusion est-elle plus positive que ce que permettent les preuves ?", attendu: "non", etapes: [9] },
  { id: "CRED-02", version: 1, texte: "Une phrase dit-elle plus large que l'énoncé de sa preuve ou que la matière citée ?", attendu: "non", etapes: [9] },
  { id: "CRED-03", version: 1, texte: "Un dirigeant sceptique trouve-t-il une condition ou une limite explicite ?", attendu: "oui", etapes: [9] },
  { id: "CRED-05", version: 1, texte: "Chaque preuve citée sert-elle l'argument de son segment ?", attendu: "oui", etapes: [9] },
  { id: "CRED-06", version: 1, texte: "S'il y a une idée reçue et sa réfutation, parlent-elles exactement de la même chose ? (sinon : sans objet)", attendu: "oui", etapes: [9] },
  { id: "VOIX-02", version: 1, texte: "Lu à voix haute, ressemble-t-il à une plaquette commerciale ?", attendu: "non", etapes: [9] },
  { id: "RET-01", version: 1, texte: "Chaque segment apprend-il quelque chose de neuf ?", attendu: "oui", etapes: [9] },
  { id: "ENV-01", version: 1, texte: "Le destinataire nommé peut-il faire quelque chose de concret avec la vidéo ?", attendu: "oui", etapes: [9] },
  { id: "ENV-02", version: 1, texte: "Pourriez-vous expliquer la règle à retenir à quelqu'un d'autre après une seule écoute ?", attendu: "oui", etapes: [9] },
  { id: "ENV-03", version: 1, texte: "Le destinataire de l'envoi est-il la personne que la vidéo met en cause ?", attendu: "non", etapes: [9] },
  { id: "FIN-01", version: 1, texte: "La dernière phrase d'information vend-elle quelque chose ?", attendu: "non", etapes: [9] },
  { id: "FMT-01", version: 1, texte: "Un monteur peut-il couper après chaque phrase sans perdre le sens ?", attendu: "oui", etapes: [9, 12] },
  { id: "CTA-01", version: 1, texte: "S'il y a un appel, s'appuie-t-il sur quelque chose de réellement présent dans la vidéo ? (sinon : sans objet)", attendu: "oui", etapes: [9] },
  { id: "PROM-01", version: 1, texte: "La livraison tient-elle exactement ce que promettaient l'accroche et la promesse ?", attendu: "oui", etapes: [9] },
  { id: "PROB-01", version: 1, texte: "Le problème du spectateur et ce qu'il lui coûte sont-ils dits dans les 5 premières secondes ?", attendu: "oui", etapes: [9] },
  { id: "REC-01", version: 1, texte: "Un dirigeant de la cible se reconnaîtrait-il dans ce client ?", attendu: "oui", etapes: [9] },
  { id: "BCL-01", version: 1, texte: "S'il y a une boucle, assemblée avec l'accroche, forme-t-elle une phrase française correcte et naturelle dans la bouche d'un expert ? (sinon : sans objet)", attendu: "oui", etapes: [12] },
  { id: "RET-02", version: 1, texte: "Le texte de publication est-il correct et sensé, sans tic d'écriture générée ?", attendu: "oui", etapes: [12] },
];

export function questionsDeLEtape(etape: QuestionJuge["etapes"][number]): QuestionJuge[] {
  return QUESTIONS_JUGES.filter((q) => q.etapes.includes(etape));
}

/** Nombre de « oui attendus » d'un jeu de réponses (sans objet = attendu). */
export function ouiAttendus(reponses: { id: string; reponse: "oui" | "non" | "sans-objet" }[]): { obtenus: number; total: number; echecs: string[] } {
  let obtenus = 0;
  const echecs: string[] = [];
  for (const r of reponses) {
    const q = QUESTIONS_JUGES.find((x) => x.id === r.id);
    if (!q) continue;
    if (r.reponse === "sans-objet" || r.reponse === q.attendu) obtenus++;
    else echecs.push(q.id);
  }
  return { obtenus, total: reponses.filter((r) => QUESTIONS_JUGES.some((q) => q.id === r.id)).length, echecs };
}
