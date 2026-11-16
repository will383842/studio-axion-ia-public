/**
 * Journal du chat de retouche (G8-01) : une ligne par aperçu, application, retour.
 * Ajout seul, jamais d'exception, aucun montant (le « coût » = le seul booléen `claudeAppele`).
 * Rien n'est câblé ici : le câblage vient avec les fiches qui ouvrent service.ts / route.ts / studio.ts.
 */
import "server-only";
import { masquerSecretsClaude } from "@/fournisseurs/claude/secret";
import { journaliser } from "@/services/_commun";

export type LigneJournalRetouche = {
  evenement: "apercu" | "application" | "retour";
  videoId: string;
  /** Identifiant de session, jamais un courriel. */
  qui: string;
  /** Date ISO. */
  quand: string;
  /** Texte de la demande. */
  demande: string;
  /** Types des opérations lues (jamais leur contenu). */
  operationsLues: string[];
  operationsEcartees: { type: string; raison: string }[];
  versionId?: string;
  generateur?: string;
  claudeAppele: boolean;
};

const LIMITE = 500;

function borner(t: string, max: number): string {
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;
}

/** Message lisible, borné à 500 caractères, secrets masqués. Pure. */
export function ligneJournal(e: LigneJournalRetouche): string {
  const ecartees = e.operationsEcartees.map((o) => `${o.type} (${o.raison})`).join(", ") || "aucune";
  const fin =
    ` | lues : ${e.operationsLues.join(", ") || "aucune"}` +
    ` | écartées : ${ecartees}` +
    (e.versionId ? ` | version : ${e.versionId}` : "") +
    (e.generateur ? ` | générateur : ${e.generateur}` : "") +
    ` | Claude appelé : ${e.claudeAppele ? "oui" : "non"}`;
  const debut = `${e.evenement} ${e.videoId} par ${e.qui} le ${e.quand} : « `;
  const reste = LIMITE - debut.length - 1 - fin.length;
  const demande = reste > 1 ? borner(e.demande.replace(/\s+/g, " "), reste) : "";
  // Masquer avant de borner : une clé coupée en deux ne doit pas échapper au masque.
  const complet = masquerSecretsClaude(`${debut}${e.demande.replace(/\s+/g, " ")} »${fin}`);
  if (demande === e.demande.replace(/\s+/g, " ") || reste <= 1) return borner(complet, LIMITE);
  return borner(masquerSecretsClaude(`${debut}${demande} »${fin}`), LIMITE);
}

type Ecrire = (type: string, message: string, entite?: { type: string; id: string }) => Promise<void>;

/** Écrit un événement neuf par appel. N'échoue jamais. */
export async function journaliserRetouche(e: LigneJournalRetouche, ecrire: Ecrire = journaliser): Promise<void> {
  try {
    await ecrire(`retouche-chat.${e.evenement}`, ligneJournal(e), { type: "video", id: e.videoId });
  } catch {
    /* le chat ne tombe jamais à cause du journal */
  }
}
