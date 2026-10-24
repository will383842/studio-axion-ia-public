import type { EtatCreation } from "../../domaine/visuels/etat-creation";
import { ErreurVisuel, creerDepuisSujet, deposerSession, type DependancesCarrousels } from "./carrousels";

const PHRASES: Record<string, string> = {
  API_PAYANTE_VERROUILLEE: "Le texte par API payante est verrouillé",
  SUJET_INVALIDE: "Le sujet fait de 3 à 200 signes, sans lien",
  PAQUET_INVALIDE: "Le texte déposé est vide, trop long ou illisible",
};

/**
 * Crée un carrousel depuis le formulaire (sujet ou texte déposé). Aucune fiche n'est créée si le texte déposé est invalide :
 * on rend les phrases précises et le texte collé. Générateur éteint : un seul état, la page porte le message.
 */
export async function creerDepuisFormulaire(donnees: FormData, deps: DependancesCarrousels): Promise<EtatCreation> {
  const type = donnees.get("type");
  const sujet = typeof donnees.get("sujet") === "string" ? (donnees.get("sujet") as string) : undefined;
  const contenu = typeof donnees.get("contenu") === "string" ? (donnees.get("contenu") as string) : undefined;
  const garde = { ...(sujet !== undefined ? { sujet } : {}), ...(contenu !== undefined ? { contenu } : {}) };
  try {
    if (type === "sujet") return await creerDepuisSujet(sujet ?? "", deps);
    if (type === "paquet-session") return await deposerSession(contenu ?? "", deps);
    return { erreurs: ["Un souci est survenu. Réessayez dans un instant."], ...garde };
  } catch (e) {
    if (e instanceof ErreurVisuel) {
      if (e.code === "GENERATEUR_ETEINT") return { eteint: true, ...garde };
      return { erreurs: e.details ?? [PHRASES[e.code] ?? "Un souci est survenu. Réessayez dans un instant."], ...garde };
    }
    return { erreurs: ["Un souci est survenu. Réessayez dans un instant."], ...garde };
  }
}
