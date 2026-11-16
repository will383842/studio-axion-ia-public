/**
 * GUIDES PDF (lot G2) · petit appel Claude pour la rédaction d'un brouillon de guide. Vit ici (dossier du fournisseur Claude)
 * pour que les services n'importent pas directement la fonction d'envoi du client : ce n'est PAS une méthode d'envoi de
 * message d'un réseau social, et la garde du port Inbox ne doit pas la confondre avec une.
 */
import { envoyerMessage, type RequeteClaude } from "./client";

export async function appelerClaudeRedaction(requete: RequeteClaude, cle: string): Promise<{ texte: string }> {
  const reponse = await envoyerMessage(requete, { cle });
  return { texte: reponse.texte };
}
