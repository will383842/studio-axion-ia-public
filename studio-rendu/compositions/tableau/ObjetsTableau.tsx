/**
 * N-04c : calque des petits objets d'une scène du tableau. Chaque objet est dessiné dans sa `boite` (px de la scène)
 * entre `debutMs` et `finMs` (relatifs au début de la scène). Composant NEUF, monté nulle part (N-04d le montera).
 * Liste vide, id inconnu ou paramètres invalides : rien n'est dessiné. Aucun son, rien sur le visage, aucun appel externe.
 */
import { AbsoluteFill, Sequence } from "remotion";
import type { ObjetScene } from "../../../src/briques/tableau-scene/objets";
import { OBJET_GROS_CHIFFRE } from "../../../src/briques/motion/petits-objets/gros-chiffre";
import { OBJET_ETAPE } from "../../../src/briques/motion/petits-objets/etapes";
import { OBJET_CARTES_COCHE } from "../../../src/briques/motion/petits-objets/cartes";
import { OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE } from "../../../src/briques/motion/petits-objets/marques";
import { OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR } from "../../../src/briques/motion/petits-objets/soulignements";
import { OBJET_COMPTEUR_ROULEAU } from "../../../src/briques/motion/petits-objets/compteur-rouleau";
import { OBJET_CARTON_DEFINITION } from "../../../src/briques/motion/petits-objets/carton-definition";
import { OBJET_FLECHE_MAIN_LEVEE, OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE } from "../../../src/briques/motion/petits-objets/fleches";
import { OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT } from "../../../src/briques/motion/petits-objets/objets-2027";
import { OBJET_CARTON_MAGAZINE } from "../../../src/briques/motion/petits-objets/carton-magazine";
import { OBJET_TOURNE } from "../../../src/briques/motion/petits-objets/objet-tourne";
import { OBJET_PARTICULES } from "../../../src/briques/motion/petits-objets/particules";
import { OBJET_PANNEAU_REGLAGES } from "../../../src/briques/motion/petits-objets/panneau-reglages";
import { OBJET_ANNEAU_DONNEES } from "../../../src/briques/motion/petits-objets/anneau-donnees";
import type { DefinitionObjet } from "../../../src/briques/motion/petits-objets/contrat";
import { CalqueObjet } from "../petits-objets/CalqueObjet";
import { chargerPoliceMarque } from "../commune/police-marque";

const OBJETS_PLAN_SCENES = [
  OBJET_GROS_CHIFFRE, OBJET_ETAPE, OBJET_CARTES_COCHE, OBJET_COCHE,
  // BR-OBJETS-c : 6 petits objets de plus (porte fermée)
  OBJET_SOULIGNEMENT_DROIT, OBJET_CROIX, OBJET_MOT_BARRE, OBJET_COMPTEUR_ROULEAU, OBJET_CARTON_DEFINITION, OBJET_FLECHE_MAIN_LEVEE,
  // BR-OBJETS-2027-b : croquis et traits de feutre
  OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT,
  // N-05-v19b : carton magazine, icône qui tourne, particules, panneau de réglages, anneau de données (porte fermée)
  OBJET_CARTON_MAGAZINE, OBJET_TOURNE, OBJET_PARTICULES, OBJET_PANNEAU_REGLAGES, OBJET_ANNEAU_DONNEES,
  // C9-34-TRAITS-v19c : 2 soulignements, surligneur, 3 flèches (porte fermée)
  OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR, OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE,
];

/** Graine fixe et pure : somme des codes de caractères de l'identifiant (calculée ici, sans importer plan-scenes). */
function graineObjet(id: string): number {
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  return somme;
}

function definitionDe(id: string): DefinitionObjet<unknown> | undefined {
  return (OBJETS_PLAN_SCENES as readonly DefinitionObjet<unknown>[]).find((d) => d.id === id);
}

export function ObjetsTableau({ objets, fps }: { objets: readonly ObjetScene[]; fps: number }) {
  if (objets.length === 0) return null;
  chargerPoliceMarque();
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
