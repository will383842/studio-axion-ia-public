/**
 * COMPTES À COCHER QUAND L'OUTIL D'ENVOI EST ZERNIO (L7-06, point 4.1).
 * Sans Buffer relié, la liste « comptes à cocher » de l'écran « À publier » ne peut pas venir de Buffer : elle vient des comptes
 * Zernio lus au dernier « Tester » (Réglages) et gardés en base. L'écran ne lit JAMAIS Zernio : il ne fait que relire cette liste.
 * Les identifiants vivent en base sur le serveur, jamais dans le dépôt.
 */
import type { CompteEnvoi, ComptesEnvoi, ComptesReseauEnvoi } from "@/domaine/comptes-envoi";
import { listerReseaux } from "@/reseaux";
import type { IdReseau, ModeEnvoiPublication } from "@/domaine/types";
import { plateformeZernio } from "@/fournisseurs/publication/zernio-corps";
import { pageInterdite } from "@/fournisseurs/publication/zernio-pages-interdites";
import type { CanalPublication, FournisseurPublication } from "@/fournisseurs/types";
import { ecrireParametre, fournisseur, lireParametre, maintenant } from "./_commun";

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
 * (Zernio le prend seul), ou comptes jamais lus. Facebook et Pinterest : toujours une liste, la page ou le tableau se choisit explicitement.
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
  if (choix.length === 1 && plateforme !== "facebook" && plateforme !== "pinterest") return undefined;
  return { choix, memorises: [] };
}

/** Ce que la feuille d'envoi de la fiche vidéo sait des comptes : lu en base, jamais chez Zernio ni chez Buffer. */
export interface VueEnvoiZernio {
  /** Zernio crée toujours un brouillon : le mode affiché est donc « brouillon ». */
  mode: ModeEnvoiPublication;
  comptes: ComptesEnvoi;
}

/**
 * Feuille d'envoi de la fiche vidéo (L0-13c). Comptes = copie en base des comptes ZERNIO (`zernio.canaux`), jamais `buffer.canaux`.
 * Un réseau sans compte Zernio relié dit « Reliez ce compte dans Zernio ». null en simulation. Aucun appel réseau.
 */
export async function vueEnvoiZernio(): Promise<VueEnvoiZernio | null> {
  if ((await fournisseur("publication")).mode === "simulation") return null;
  const canaux = (await canauxZernioEnregistres().catch(() => null))?.canaux;
  const comptes: ComptesEnvoi = {};
  for (const r of listerReseaux()) {
    const aCocher = comptesACocherZernio(r.id, canaux);
    if (aCocher) {
      comptes[r.id] = aCocher;
      continue;
    }
    let plateforme: string | undefined;
    try {
      plateforme = plateformeZernio(r.id);
    } catch {
      plateforme = undefined;
    }
    const relies = (canaux ?? []).filter((c) => c.service === plateforme && !c.deconnecte);
    comptes[r.id] = relies.length === 1 ? { nom: relies[0].nom } : { probleme: "Reliez ce compte dans Zernio" };
  }
  return { mode: "brouillon", comptes };
}
