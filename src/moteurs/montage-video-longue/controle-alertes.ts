/**
 * Traduction du contrôle de la vidéo longue (`controle.ts`) vers les alertes qualité communes du Studio (`CodeAlerteQualite`).
 * PUR. Jamais « bloquant » : le contrôle informe, il ne refuse pas une vidéo. (Pas lu par Remotion : « @/ » permis.)
 */
import type { AlerteQualite, CodeAlerteQualite } from "@/domaine/types";
import type { CodeControleLongue, ControleLongue } from "./storyboard-types";
import { PREFIXE_VITESSE_LECTURE } from "./controle";

const CODE_QUALITE: Record<CodeControleLongue, CodeAlerteQualite> = {
  "image-vide": "image-noire",
  "texte-trop-petit": "defaut-visuel",
  "sous-titre-illisible": "debordement-sous-titres",
  "sur-la-bande": "debordement-sous-titres",
  chevauchement: "chevauchement",
  "hors-cadre": "defaut-visuel",
  "sans-hierarchie": "defaut-visuel",
  "couleur-hors-charte": "defaut-visuel",
  "scene-figee": "rythme",
  monotonie: "rythme",
  "chapitre-court": "rythme",
  "titre-generique": "defaut-visuel",
  "carton-absent": "defaut-visuel",
  "fin-absente": "fin",
};

export function alertesQualiteDepuisControle(c: ControleLongue): AlerteQualite[] {
  return c.alertes.map((a) => ({
    code: a.code === "sous-titre-illisible" && a.message.startsWith(PREFIXE_VITESSE_LECTURE) ? "vitesse-lecture" : CODE_QUALITE[a.code],
    gravite: a.gravite === "info" ? "info" : "attention",
    message: a.instantMs === undefined ? a.message : `${a.message} (à ${(a.instantMs / 1000).toFixed(1)} s)`,
  }));
}
