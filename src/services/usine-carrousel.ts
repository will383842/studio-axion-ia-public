/**
 * Plan usine #63 · PR B : « Retenir ce sujet » sur une carte CARROUSEL de la semaine proposée.
 * On crée UN brouillon de carrousel à relire (texte sans API payante, par `creerDepuisSujet`), au réseau visé, puis l'usine est prévenue (porte `retenir`).
 * Jamais de validation, de préparation pour les réseaux, de programmation ni de publication d'ici : le fondateur relit, valide et programme lui-même.
 * Le rendu des aperçus part après la réponse, côté action. SERVEUR UNIQUEMENT.
 */
import "server-only";
import type { Reseau } from "@/briques/visuels/reseaux";
import { PROFILS_RESEAUX } from "@/briques/visuels/reseaux";
import type { IdeeUsine, OrigineUsine } from "@/domaine/usine";
import { ErreurStudio, maintenant } from "@/services/_commun";
import { avecViseeUsine, retenirSujetUsine } from "@/services/usine-porte";
import { creerDepuisSujet, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { dependancesCarrousels } from "@/visuels/services/production";

export const PHRASE_RESEAU_SANS_CARROUSEL = "Ce réseau ne reçoit pas de carrousel : le sujet n'a pas été retenu.";
export const PHRASE_GENERATEUR_ETEINT_USINE = "Le générateur de carrousels est éteint (Réglages › Carrousels) : allumez-le, puis retenez le sujet.";
const PHRASE_DEJA = "Ce sujet est déjà retenu.";
const PHRASE_TEXTE = "Cette carte n'a pas de texte utilisable pour un carrousel : le sujet n'a pas été retenu.";
const TEXTE_MAX = 200;
const TEXTE_MIN = 3;

/** Coupe à 200 signes sur la fin d'un mot (jamais au milieu), sans espace ni ponctuation de queue. */
export function couperSurUnMot(texte: string, max = TEXTE_MAX): string {
  const net = texte.trim().replace(/\s+/g, " ");
  if (net.length <= max) return net;
  const coupe = net.slice(0, max + 1);
  const espace = coupe.lastIndexOf(" ");
  return (espace > 0 ? coupe.slice(0, espace) : net.slice(0, max)).replace(/[\s,;:.\-–—]+$/u, "");
}

const reseauAvecCarrousel = (r: string): r is Reseau => Object.hasOwn(PROFILS_RESEAUX, r);

/** Texte du carrousel : titre de la carte, sinon le sujet, sinon la douleur. */
function texteDuCarrousel(idee: IdeeUsine, titre?: string): string {
  for (const t of [titre, idee.sujet, idee.douleur]) if (t && t.trim().length >= TEXTE_MIN) return couperSurUnMot(t);
  throw new ErreurStudio("RETENIR_TEXTE", PHRASE_TEXTE);
}

/**
 * À appeler SOUS le verrou de l'action (`creerVerrou()`), pas sous `sousVerrou` : `creerDepuisSujet` le prend (non réentrant).
 * Refus (rien d'écrit, usine non appelée) : réseau sans carrousel, générateur éteint, texte invalide. Déjà retenu : « Ce sujet est déjà retenu. »
 */
export async function creerCarrouselDeLUsine(
  idee: IdeeUsine,
  carte: { reseau: string; jour: string; titre?: string },
  deps: DependancesCarrousels = dependancesCarrousels(),
): Promise<{ id: string; rappelUsine: boolean }> {
  if (!reseauAvecCarrousel(carte.reseau)) throw new ErreurStudio("RETENIR_RESEAU", PHRASE_RESEAU_SANS_CARROUSEL);
  if (!(await deps.allume())) throw new ErreurStudio("GENERATEUR_ETEINT", PHRASE_GENERATEUR_ETEINT_USINE);
  const visee = { jour: carte.jour, reseau: carte.reseau };
  const origine: OrigineUsine = { signature: idee.signature, parts: idee.parts, typeContenu: "carrousel" };

  const dejaRetenu = await deps.depot.trouver((v) => !v.corbeilleLe && v.origineUsine?.signature === idee.signature);
  if (dejaRetenu) {
    // L'usine n'avait pas confirmé : on la rappelle (le contrat prévoit le rejeu), puis on refuse.
    const o = dejaRetenu.origineUsine;
    if (o && !o.prevenueLe && (await avecViseeUsine(visee, () => retenirSujetUsine(o, dejaRetenu.id)))) {
      await deps.verrou(() => deps.depot.modifier(dejaRetenu.id, { origineUsine: { ...o, prevenueLe: maintenant() } }));
    }
    throw new ErreurStudio("RETENIR_DEJA", PHRASE_DEJA);
  }

  const texte = texteDuCarrousel(idee, carte.titre);
  let id: string;
  try {
    ({ id } = await creerDepuisSujet(texte, deps));
  } catch (e) {
    if ((e as { code?: string }).code === "SUJET_INVALIDE") throw new ErreurStudio("RETENIR_TEXTE", PHRASE_TEXTE);
    throw e;
  }
  await deps.verrou(() => deps.depot.modifier(id, { reseaux: [carte.reseau as Reseau], origineUsine: origine, dateVisee: carte.jour }));
  const prevenue = await avecViseeUsine(visee, () => retenirSujetUsine(origine, id));
  if (prevenue) await deps.verrou(() => deps.depot.modifier(id, { origineUsine: { ...origine, prevenueLe: maintenant() } }));
  return { id, rappelUsine: !prevenue };
}
