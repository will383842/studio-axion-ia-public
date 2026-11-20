/**
 * PLANCHE « ÉTIQUETTES, CHIFFRES, CARTES, SCHÉMAS » (C9-40a) : une case par exemple des pièces fusionnées, dernière image de tenue,
 * sur la silhouette témoin de C9-39. Contient aussi le socle commun aux trois planches de familles (`PlancheDeFamille`).
 * Pur (aucun hook Remotion), aucune image extérieure, Manrope seulement (police des jetons). Imports relatifs seulement. Rien d'inscrit.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../../../src/briques/jetons-motion";
import type { DefinitionObjet, ZoneObjet } from "../../../../src/briques/motion/petits-objets/contrat";
import { ZONE_VISAGE_OBJETS } from "../../../../src/briques/motion/petits-objets/zones";
import { DEF_BADGE, DEF_ETIQUETTE_ICONE, DEF_PASTILLE_ICONE, DEF_TAMPON, EXEMPLES_ETIQUETTES } from "../../../../src/briques/motion/petits-objets/etiquettes";
import { EXEMPLES_CARTES, OBJET_CARTES_COCHE } from "../../../../src/briques/motion/petits-objets/cartes";
import { EXEMPLES_GROS_CHIFFRE, OBJET_GROS_CHIFFRE } from "../../../../src/briques/motion/petits-objets/gros-chiffre";
import { EXEMPLES_ETAPES, OBJET_ETAPE, OBJET_ETAPE_SEGMENTS } from "../../../../src/briques/motion/petits-objets/etapes";
import { EXEMPLES_CARTON_DEFINITION, OBJET_CARTON_DEFINITION } from "../../../../src/briques/motion/petits-objets/carton-definition";
import { EXEMPLES_SCHEMAS, OBJET_AGENTS_GLOBE, OBJET_ICONES_RELIEES, OBJET_SCHEMA_ETOILE } from "../../../../src/briques/motion/petits-objets/schemas-relies";
import { EXEMPLES_FLUX, OBJET_SCHEMA_FLUX } from "../../../../src/briques/motion/petits-objets/schema-flux";
import { DEF_APPEL_ACTION, EXEMPLES_APPEL_ACTION } from "../../../../src/briques/motion/petits-objets/appel-action";
import { DEF_APPEL_MOT, EXEMPLES_APPEL_MOT } from "../../../../src/briques/motion/petits-objets/appel-mot";
import { EXEMPLES_CARTON_MAGAZINE, OBJET_CARTON_MAGAZINE } from "../../../../src/briques/motion/petits-objets/carton-magazine";
import { EXEMPLES_ANNEAU, OBJET_ANNEAU_DONNEES } from "../../../../src/briques/motion/petits-objets/anneau-donnees";
import { FOND_FLOU_DEFAUT } from "../../../../src/briques/motion/habillage-commun/fond-flou-carte";
import { colonnesPlanche, DIMENSIONS_PLANCHE, FPS_PLANCHE, IMAGE_PLANCHE, seChevauchent, type FormatPlanche } from "./PlancheTraits";

export { seChevauchent };
export const DUREE_IMAGES_FAMILLE = 100;

export interface EntreeFamille {
  id: string;
  def: DefinitionObjet<unknown>;
  parametres: unknown;
}

/** Une case par (définition × exemple), dans l'ordre d'affichage. */
export function listerFamille(defs: readonly unknown[], exemples: readonly unknown[]): EntreeFamille[] {
  return (defs as DefinitionObjet<unknown>[]).flatMap((def) => exemples.map((parametres, i) => ({ id: `${def.id}#${i + 1}`, def, parametres })));
}

/** Zone en % du cadre quand les paramètres la donnent (`boite`) ; sinon null : l'objet remplit sa case et la place est choisie au montage. */
export function zoneDeLaCase(e: EntreeFamille): ZoneObjet | null {
  const b = (e.parametres as { boite?: ZoneObjet } | null)?.boite;
  return b && typeof b.x === "number" ? b : null;
}

/** Silhouette témoin neutre (même gabarit que C9-39) : tête et épaules dessinées, calées sur la zone du visage. */
function Silhouette({ fond }: { fond: FondAxion }): JSX.Element {
  const c = couleursSur(fond).texteDoux;
  const z = ZONE_VISAGE_OBJETS;
  const cx = z.x + z.largeur / 2;
  return (
    <svg data-silhouette-temoin="oui" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <ellipse cx={cx} cy={z.y + z.hauteur / 2} rx={z.largeur * 0.36} ry={z.hauteur * 0.5} fill={c} opacity={0.35} />
      <path d={`M ${cx - 38} 100 Q ${cx - 38} ${z.y + z.hauteur + 6} ${cx} ${z.y + z.hauteur + 6} Q ${cx + 38} ${z.y + z.hauteur + 6} ${cx + 38} 100 Z`} fill={c} opacity={0.25} />
      <rect x={z.x} y={z.y} width={z.largeur} height={z.hauteur} fill="none" stroke={c} strokeWidth={0.3} strokeDasharray="1.5 1.5" />
    </svg>
  );
}

export function PlancheDeFamille({ nom, entrees, fond, format, image = IMAGE_PLANCHE }: { nom: string; entrees: readonly EntreeFamille[]; fond: FondAxion; format: FormatPlanche; image?: number }): JSX.Element {
  const { largeur, hauteur } = DIMENSIONS_PLANCHE[format];
  const cols = colonnesPlanche(entrees.length, largeur, hauteur);
  const cote = largeur / cols;
  const pal = couleursSur(fond);
  return (
    <div data-planche={`${nom}-${format}-${fond}`} style={{ position: "relative", width: largeur, height: hauteur, background: pal.fond, display: "flex", flexWrap: "wrap", alignContent: "flex-start", overflow: "hidden", fontFamily: FAMILLE_CSS_AXION }}>
      {entrees.map((e, i) => {
        const z = zoneDeLaCase(e);
        const touche = z !== null && seChevauchent(z, ZONE_VISAGE_OBJETS);
        return (
          <div key={e.id} data-objet={e.id} data-case={`${(i % cols) * cote},${Math.floor(i / cols) * cote},${cote}`} style={{ position: "relative", width: cote, height: cote, boxSizing: "border-box", border: `1px solid ${pal.texteDoux}` }}>
            <Silhouette fond={fond} />
            <div style={{ position: "absolute", inset: 0 }}>
              {e.def.Rendu({ image, fps: FPS_PLANCHE, dureeImages: DUREE_IMAGES_FAMILLE, fond, graine: 7, parametres: e.parametres })}
            </div>
            <span data-chevauche-visage={touche ? "oui" : "non"} style={{ position: "absolute", left: 4, top: 2, fontSize: Math.max(8, cote / 16), color: touche ? "#C0392B" : pal.texte }}>
              {e.id.replace("objet-", "")}{touche ? " · touche le visage" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** C10-04b : la 1re case du carton magazine est posée sur un décor déjà adouci (dégradés, sans filtre) et voilé comme le rendu : « carton sur image floutée ». Même id, même nombre de cases. */
const DEF_CARTON_SUR_FLOU: DefinitionObjet<unknown> = {
  ...(OBJET_CARTON_MAGAZINE as DefinitionObjet<unknown>),
  Rendu: (p) => (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 40%, #b8a58c 0%, #6f7a85 55%, #3d4650 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${FOND_FLOU_DEFAUT.assombrir})` }} />
      {OBJET_CARTON_MAGAZINE.Rendu(p as never)}
    </div>
  ),
};

/** Toutes les entrées de la planche, dans l'ordre d'affichage. */
export const ENTREES_ETIQUETTES: readonly EntreeFamille[] = [
  ...listerFamille([DEF_PASTILLE_ICONE], EXEMPLES_ETIQUETTES.pastille),
  ...listerFamille([DEF_ETIQUETTE_ICONE], EXEMPLES_ETIQUETTES.etiquette),
  ...listerFamille([DEF_BADGE], EXEMPLES_ETIQUETTES.badge),
  ...listerFamille([DEF_TAMPON], EXEMPLES_ETIQUETTES.tampon),
  ...listerFamille([OBJET_CARTES_COCHE], EXEMPLES_CARTES),
  ...listerFamille([OBJET_GROS_CHIFFRE], EXEMPLES_GROS_CHIFFRE),
  ...listerFamille([OBJET_ETAPE, OBJET_ETAPE_SEGMENTS], EXEMPLES_ETAPES),
  ...listerFamille([OBJET_CARTON_DEFINITION], EXEMPLES_CARTON_DEFINITION),
  ...listerFamille([OBJET_SCHEMA_ETOILE], EXEMPLES_SCHEMAS.etoile),
  ...listerFamille([OBJET_ICONES_RELIEES], EXEMPLES_SCHEMAS.icones),
  ...listerFamille([OBJET_AGENTS_GLOBE], EXEMPLES_SCHEMAS.agents),
  ...listerFamille([OBJET_SCHEMA_FLUX], EXEMPLES_FLUX),
  ...listerFamille([DEF_APPEL_ACTION], EXEMPLES_APPEL_ACTION),
  ...listerFamille([DEF_APPEL_MOT], EXEMPLES_APPEL_MOT.map((e) => DEF_APPEL_MOT.valider(e))),
  ...listerFamille([OBJET_CARTON_MAGAZINE], EXEMPLES_CARTON_MAGAZINE).map((e, i) => (i === 0 ? { ...e, def: DEF_CARTON_SUR_FLOU } : e)),
  ...listerFamille([OBJET_ANNEAU_DONNEES], EXEMPLES_ANNEAU),
];

export function PlancheEtiquettes({ fond, format, image }: { fond: FondAxion; format: FormatPlanche; image?: number }): JSX.Element {
  return <PlancheDeFamille nom="etiquettes" entrees={ENTREES_ETIQUETTES} fond={fond} format={format} image={image} />;
}
