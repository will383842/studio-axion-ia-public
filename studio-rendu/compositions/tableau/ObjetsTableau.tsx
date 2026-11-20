/**
 * N-04c : calque des petits objets d'une scène du tableau. Chaque objet est dessiné dans sa `boite` (px de la scène)
 * entre `debutMs` et `finMs` (relatifs au début de la scène). Composant NEUF, monté nulle part (N-04d le montera).
 * Liste vide, id inconnu ou paramètres invalides : rien n'est dessiné. Aucun son, rien sur le visage, aucun appel externe.
 */
import { AbsoluteFill, Sequence } from "remotion";
import type { ObjetScene } from "../../../src/briques/tableau-scene/objets";
import { OBJETS_PLAN_SCENES, graineObjet } from "../../../src/briques/plan-scenes/briques/objets-inscrits";
import type { DefinitionObjet } from "../../../src/briques/motion/petits-objets/contrat";
import { CalqueObjet } from "../petits-objets/CalqueObjet";

function definitionDe(id: string): DefinitionObjet<unknown> | undefined {
  return (OBJETS_PLAN_SCENES as readonly DefinitionObjet<unknown>[]).find((d) => d.id === id);
}

export function ObjetsTableau({ objets, fps }: { objets: readonly ObjetScene[]; fps: number }) {
  if (objets.length === 0) return null;
  const dessines = objets.flatMap((objet, i) => {
    const def = definitionDe(objet.id);
    if (!def) return [];
    let parametres: unknown = null;
    try {
      parametres = def.valider(objet.parametres);
    } catch {
      parametres = null;
    }
    if (parametres === null) return [];
    const debut = Math.max(0, Math.round((objet.debutMs / 1000) * fps));
    const duree = Math.max(1, Math.round(((objet.finMs - objet.debutMs) / 1000) * fps));
    return [
      <Sequence key={`${objet.id}-${i}`} from={debut} durationInFrames={duree} layout="none">
        <div style={{ position: "absolute", left: objet.boite.x, top: objet.boite.y, width: objet.boite.largeur, height: objet.boite.hauteur, pointerEvents: "none" }}>
          <CalqueObjet def={def} parametres={parametres} fond="ivoire" graine={graineObjet(objet.id)} dureeImages={duree} />
        </div>
      </Sequence>,
    ];
  });
  if (dessines.length === 0) return null;
  return <AbsoluteFill style={{ pointerEvents: "none" }}>{dessines}</AbsoluteFill>;
}
