/**
 * RETOUCHE D'UN CHAPITRE PAR MESSAGE — générateur « Vidéo longue » (fiche VL-08, ÉTEINT). PUR : aucun accès base, réseau,
 * Claude ni rendu. Adaptateur « chapitre = groupe de scènes » : un chapitre est une plage de temps de la vidéo entière
 * (les temps restent ceux de la vidéo, voir `moteurs/montage-video-longue/plan.ts`) ; ses scènes sont celles du plan dont
 * le milieu tombe dans la plage.
 *  - `garderUnChapitre` : ne laisse passer que les retouches qui touchent les scènes du chapitre choisi ; une retouche
 *    qui toucherait toute la vidéo est ramenée au chapitre (dynamisme) ou écartée avec une remarque ;
 *    `decaler-scene` est toujours écartée (le recalage des mots déborde sur les chapitres voisins) ;
 *  - `chapitresTouches` : quels chapitres refaire (le rendu partiel par empreinte ne refait que ceux-là) ;
 *  - `messageChapitre` : phrase de réponse, sans montant ; la voix ne change pas ;
 *  - le texte lu est le script validé : `modifier-script` reste écarté (règle de `generateurs.ts`, `scriptEstValide`).
 * Le réglage `retoucheChat.videoLongue` est déclaré dans `generateurs.ts` : éteint par défaut.
 */
import type { OperationRetouche } from "@/briques/operations";
import type { PlanValide } from "@/briques/plan-scenes/schema";

export const ID_GENERATEUR_VIDEO_LONGUE = "video-longue" as const;

export interface ChapitreRetouche {
  id: string;
  /** Titre tel que l'utilisateur l'a choisi (jamais inventé ici). */
  titre?: string;
  debutMs: number;
  finMs: number;
}

/** Identifiants des scènes d'un chapitre (le milieu de la scène tombe dans la plage), dans l'ordre du plan. */
export function scenesDuChapitre(plan: Pick<PlanValide, "scenes">, chapitre: Pick<ChapitreRetouche, "debutMs" | "finMs">): string[] {
  return plan.scenes.filter((s) => (s.debutMs + s.finMs) / 2 >= chapitre.debutMs && (s.debutMs + s.finMs) / 2 < chapitre.finMs).map((s) => s.id);
}

/** Chapitre d'une scène, ou `null`. */
export function chapitreDeScene(plan: Pick<PlanValide, "scenes">, chapitres: readonly ChapitreRetouche[], sceneId: string): ChapitreRetouche | null {
  return chapitres.find((c) => scenesDuChapitre(plan, c).includes(sceneId)) ?? null;
}

/** Scènes visées par une retouche ; `null` : toute la vidéo (aucune scène nommée). */
function scenesVisees(o: OperationRetouche): string[] | null {
  switch (o.type) {
    case "changer-habillage":
      // L'habillage est global (appliqué à toute la vidéo) : dès qu'il est présent, l'opération n'est pas ramenable à un chapitre.
      if (o.habillage) return null;
      {
        const ids = [o.transition?.sceneId, o.position?.sceneId].filter((id): id is string => typeof id === "string");
        return ids.length ? ids : null;
      }
    case "changer-transition":
      return o.sceneId ? [o.sceneId] : null;
    case "ajouter-dynamisme":
      return o.sceneIds?.length ? o.sceneIds : null; // tableau vide = « toutes les scènes » pour appliquer.ts : traité comme absent
    case "deplacer":
      return [o.sceneId, o.apresSceneId];
    case "modifier-script":
    case "couper-mots":
    case "changer-sous-titre":
      return null;
    default:
      return [o.sceneId];
  }
}

export interface ChapitreGarde {
  operations: OperationRetouche[];
  remarques: string[];
}

/**
 * Ne garde que ce qui touche le chapitre choisi. `chapitreId` inconnu : rien ne passe, une remarque demande de choisir.
 * Aucune retouche ne sort jamais du chapitre : les autres restent tels quels.
 */
export function garderUnChapitre(operations: readonly OperationRetouche[], plan: Pick<PlanValide, "scenes">, chapitres: readonly ChapitreRetouche[], chapitreId: string | null | undefined): ChapitreGarde {
  const chapitre = chapitres.find((c) => c.id === chapitreId);
  if (!chapitre) return { operations: [], remarques: ["Dites d'abord quel chapitre vous voulez changer."] };
  const siennes = new Set(scenesDuChapitre(plan, chapitre));
  const remarques: string[] = [];
  const gardees: OperationRetouche[] = [];
  for (const o of operations) {
    // `decaler-scene` recale les mots d'une scène (`mots` ou `decalageMs`) sans borne : le validateur décale ou retire
    // ensuite les scènes voisines, qui peuvent être d'un autre chapitre. Écartée pour la vidéo longue, jamais de fuite.
    if (o.type === "decaler-scene") {
      remarques.push("Une retouche sortait du chapitre choisi : elle n'est pas appliquée, les autres chapitres restent tels quels.");
      continue;
    }
    const visees = scenesVisees(o);
    if (visees === null) {
      if (o.type === "ajouter-dynamisme" && siennes.size) gardees.push({ ...o, sceneIds: [...siennes] });
      else if (o.type === "changer-transition" && siennes.size) gardees.push(...[...siennes].map((sceneId) => ({ ...o, sceneId })));
      else remarques.push("Cette retouche toucherait toute la vidéo : précisez-la pour le chapitre choisi.");
      continue;
    }
    if (visees.every((id) => siennes.has(id))) gardees.push(o);
    else remarques.push("Une retouche sortait du chapitre choisi : elle n'est pas appliquée, les autres chapitres restent tels quels.");
  }
  return { operations: gardees, remarques: [...new Set(remarques)] };
}

/** Chapitres à refaire pour ces retouches (ordre de la vidéo). */
export function chapitresTouches(operations: readonly OperationRetouche[], plan: Pick<PlanValide, "scenes">, chapitres: readonly ChapitreRetouche[]): ChapitreRetouche[] {
  const ids = new Set(operations.flatMap((o) => scenesVisees(o) ?? []));
  return chapitres.filter((c) => scenesDuChapitre(plan, c).some((id) => ids.has(id)));
}

/** Scènes à refaire : toutes celles des chapitres touchés. Le rendu partiel ne relit que ces scènes. */
export function scenesARefaire(operations: readonly OperationRetouche[], plan: Pick<PlanValide, "scenes">, chapitres: readonly ChapitreRetouche[]): string[] {
  return chapitresTouches(operations, plan, chapitres).flatMap((c) => scenesDuChapitre(plan, c));
}

/** « Seul le chapitre 3 sera refait. La voix ne change pas. Les 5 autres restent tels quels. » (aucun montant). */
export function messageChapitre(chapitres: readonly ChapitreRetouche[], chapitreId: string): string | null {
  const i = chapitres.findIndex((c) => c.id === chapitreId);
  if (i < 0) return null;
  const autres = chapitres.length - 1;
  const reste = autres === 0 ? "" : autres === 1 ? " L'autre reste tel quel." : ` Les ${autres} autres restent tels quels.`;
  return `Seul le chapitre ${i + 1} sera refait. La voix ne change pas.${reste}`;
}

/** Après la retouche : les chapitres YouTube et le texte ont bougé, à recopier. */
export const MESSAGE_APRES_RETOUCHE_VIDEO_LONGUE = "Les chapitres et le texte ont été mis à jour : recopiez-les dans YouTube.";
