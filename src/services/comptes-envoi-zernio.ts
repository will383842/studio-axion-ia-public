/**
 * COMPTES À COCHER QUAND L'OUTIL D'ENVOI EST ZERNIO (L7-06, point 4.1).
 * Sans Buffer relié, la liste « comptes à cocher » de l'écran « À publier » ne peut pas venir de Buffer : elle vient des comptes
 * Zernio lus au dernier « Tester » (Réglages) et gardés en base. L'écran ne lit JAMAIS Zernio : il ne fait que relire cette liste.
 * Les identifiants vivent en base sur le serveur, jamais dans le dépôt.
 */
import type { CompteEnvoi, ComptesReseauEnvoi } from "@/domaine/comptes-envoi";
import type { IdReseau } from "@/domaine/types";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import { pageInterdite } from "@/fournisseurs/publication/zernio-pages-interdites";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";
import { ecrireParametre, lireParametre, maintenant } from "./_commun";

export const PARAM_CANAUX_ZERNIO = "zernio.canaux";

export interface CanauxZernioEnregistres {
  lusLe: string;
  canaux: CanalPublication[];
}

/** Garde en base les cibles que Zernio liste (comptes, pages Facebook, organisations LinkedIn). Appelé par « Tester » : un échec n'y change rien. */
export async function enregistrerCanauxZernio(service: FournisseurPublication): Promise<number> {
  if (!service.listerCanaux) return 0;
  const canaux = await service.listerCanaux();
  await ecrireParametre(PARAM_CANAUX_ZERNIO, { lusLe: maintenant(), canaux } satisfies CanauxZernioEnregistres);
  return canaux.length;
}

export async function canauxZernioEnregistres(): Promise<CanauxZernioEnregistres | null> {
  return lireParametre<CanauxZernioEnregistres | null>(PARAM_CANAUX_ZERNIO, null);
}

const idPage = (c: CanalPublication) => (c.id.includes(":fb:") ? c.id.split(":fb:")[1] : undefined);

/**
 * Les comptes à cocher pour ce réseau chez Zernio. Rien (undefined) s'il n'y a rien à cocher : un seul compte hors Facebook
 * (Zernio le prend seul), ou comptes jamais lus. Facebook : toujours une liste, la page se choisit explicitement.
 */
export function comptesACocherZernio(reseau: IdReseau, canaux: readonly CanalPublication[] | undefined): ComptesReseauEnvoi | undefined {
  let plateforme: string;
  try {
    plateforme = plateformeZernio(reseau);
  } catch {
    return undefined; // réseau que Zernio ne porte pas : rien à proposer
  }
  const choix: CompteEnvoi[] = (canaux ?? [])
    .filter((c) => c.service === plateforme && !c.deconnecte && !(c.service === "facebook" && pageInterdite(idPage(c), c.nom)))
    .map((c) => ({ id: c.id, nom: c.nom, ...(c.genre ? { genre: c.genre } : {}) }));
  if (!choix.length) return undefined;
  if (choix.length === 1 && reseau !== "facebook") return undefined;
  return { choix, memorises: [] };
}
