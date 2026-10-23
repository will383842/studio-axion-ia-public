/** Réglages › « Sujets déjà traités » : Will règle LUI-MÊME `sujets.garde` (lu à chaque dépôt par `lireGardeSujets`, sans cache). Serveur seulement, aucune dépense. */
import "server-only";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { lireGardeSujets, REGLAGE_GARDE_SUJETS } from "./sujets-traites";
import { GARDES_SUJETS, type GardeSujets } from "@/domaine/sujets-traites";

/** Liste fermée : seule une des trois valeurs exactes passe (jamais une valeur libre venue du client). */
export const estGardeSujets = (v: unknown): v is GardeSujets => typeof v === "string" && (GARDES_SUJETS as readonly string[]).includes(v);

const LIBELLES_JOURNAL: Record<GardeSujets, string> = { bloquant: "bloquant", avertissement: "avertissement seulement", eteint: "éteint" };

/** Écrit le réglage (seul endroit). Session exigée ; valeur hors liste refusée ; même valeur → rien d'écrit ni journalisé. */
export async function definirGardeSujets(valeur: unknown): Promise<GardeSujets> {
  await exigerSession();
  if (!estGardeSujets(valeur)) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
  return sousVerrou(async () => {
    // Comparaison avec la valeur BRUTE en base : une valeur illisible (lue « bloquant ») est réécrite proprement.
    const brut = await lireParametre<unknown>(REGLAGE_GARDE_SUJETS, null);
    if (brut === valeur) return valeur;
    const avant = await lireGardeSujets();
    await ecrireParametre(REGLAGE_GARDE_SUJETS, valeur);
    await journaliser("reglages", `Sujets déjà traités : ${LIBELLES_JOURNAL[avant]} → ${LIBELLES_JOURNAL[valeur]}`);
    return valeur;
  });
}
