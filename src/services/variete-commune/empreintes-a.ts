/**
 * Empreintes visuelles (E2-ANTI-REPETITION, fiche X2-06) : cas concret, image → vidéo, tableau. Fonctions PURES :
 * les données arrivent en paramètre, aucune lecture de base, aucune entrée-sortie, aucune date du jour, aucun hasard.
 * Aucun appelant en production (tout éteint). Pas de `server-only` : le module n'a rien de serveur.
 * On ne compte que ce qui est réellement dessiné à l'écran (même règle que `jeuDeLEcran`).
 */
import type { AxeCommun, EmpreinteVideo } from "@/briques/variete-commune/types";
import { VERSION_EMPREINTE } from "@/briques/variete-commune/version";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import { AXE_COMMUN_DE } from "@/briques/variete-commune/correspondances/image-video";
import { DIMENSIONS_ACTIVES, DIMENSIONS_HABILLAGE, VARIANTES_RENDUES, type DimensionEcran, type Mise } from "@/moteurs/montage-cas-concret/variete";
import { VARIANTE_PAR_VIDEO } from "@/moteurs/montage-cas-concret/sous-titres-variete";
import { recetteEffectiveIV } from "@/moteurs/montage-image-video/variete/historique";
import { VARIANTE_PAR_VERSION } from "@/moteurs/montage-image-video/sous-titres-varies";
import { AXES_VARIETE, type AxeVariete, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { ResumeVisuel } from "@/briques/variete/types";
import type { StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";

type Axes = Partial<Record<AxeCommun, string[]>>;

const unique = (l: readonly string[]): string[] => [...new Set(l)].sort();

function ajouter(axes: Axes, axe: AxeCommun, valeurs: readonly string[]): void {
  if (!valeurs.length) return;
  axes[axe] = unique([...(axes[axe] ?? []), ...valeurs]);
}

function empreinte(videoId: string, formatId: string, le: string, axes: Axes): EmpreinteVideo {
  return { version: VERSION_EMPREINTE, videoId, formatId, le, axes };
}

/** Intensité des sous-titres du cas concret → valeur commune. */
const SOUS_TITRES_CC: Readonly<Record<string, string>> = Object.freeze({ calme: "calmes", v4: "equilibres", vif: "appuyes" });

/** Valeur posée à l'écran pour une dimension : dessinée, active, non v4 et dans les variantes rendues. */
function dessinee(mise: Mise, dim: DimensionEcran, valeur: unknown): valeur is string {
  if (typeof valeur !== "string" || !DIMENSIONS_ACTIVES.includes(dim)) return false;
  if (DIMENSIONS_HABILLAGE.includes(dim) && mise.tirage.habille !== true) return false;
  const rendues = VARIANTES_RENDUES[dim];
  return !rendues || rendues.includes(valeur);
}

/**
 * Empreinte d'une vidéo du cas concret depuis son tirage EFFECTIF : une dimension tirée mais non dessinée n'apparaît pas.
 * Sous-titres : comptés seulement si `variantesSousTitres` (défaut `VARIANTE_PAR_VIDEO`) est vrai et que la mise ne les
 * déclare pas sans variante (`sousTitresSansVariante`). Mise illisible (`null`) : aucun axe.
 */
export function empreinteCasConcret(videoId: string, le: string, mise: Mise | null | undefined, variantesSousTitres: boolean = VARIANTE_PAR_VIDEO): EmpreinteVideo {
  const axes: Axes = {};
  if (mise) {
    const t = mise.tirage;
    const ecrans = Object.values(mise.ecrans);
    ajouter(axes, "ouverture", [versCommun("cas-concret", "ouverture", t.ouverture)]);
    ajouter(axes, "recit", [versCommun("cas-concret", "recit", t.structure)]);
    if (t.habille === true) ajouter(axes, "dosage", [versCommun("cas-concret", "dosage", t.jeuAnimation)]);
    if (ecrans.some((e) => dessinee(mise, "camera", e.camera) && e.camera !== "aucun")) ajouter(axes, "camera", [versCommun("cas-concret", "camera", t.camera.style)]);
    ajouter(axes, "transitions", ecrans.flatMap((e) => (dessinee(mise, "transition", e.transition) ? [versCommun("cas-concret", "transitions", e.transition)] : [])));
    if (variantesSousTitres && mise.sousTitresSansVariante !== true) ajouter(axes, "sousTitres", [SOUS_TITRES_CC[t.sousTitres.intensite] ?? `autre:cas-concret:${t.sousTitres.intensite}`]);
  }
  return empreinte(videoId, "cas-concret", le, axes);
}

/**
 * Empreinte d'une vidéo image → vidéo depuis sa recette EFFECTIVE (`recetteEffectiveIV` : axes repliés). L'axe des
 * sous-titres est à 0 (absent) tant que `variantesParVersion` (défaut `VARIANTE_PAR_VERSION`) est faux.
 */
export function empreinteImageVideo(
  videoId: string, le: string, recette: RecetteVarieteIV,
  replis?: readonly { readonly axe: AxeVariete; readonly code?: string }[],
  variantesParVersion: boolean = VARIANTE_PAR_VERSION,
): EmpreinteVideo {
  const effective = recetteEffectiveIV(recette, replis);
  const axes: Axes = {};
  for (const axeLocal of AXES_VARIETE) {
    if (axeLocal === "sousTitres" && !variantesParVersion) continue;
    ajouter(axes, AXE_COMMUN_DE[axeLocal], [versCommun("image-video", AXE_COMMUN_DE[axeLocal], effective[axeLocal])]);
  }
  return empreinte(videoId, "image-video", le, axes);
}

/** Palette d'un style de tableau (ardoise = noir, tableau blanc = ivoire ; paperboard : table X2-02, sans valeur commune). */
const PALETTE_TABLEAU: Readonly<Record<string, string>> = Object.freeze({ ardoise: "noir-dominant", "tableau-blanc": "ivoire-dominant" });

/** Empreinte d'une vidéo tableau : habillage et palette depuis le style, récit et objets depuis le résumé visuel (s'il est connu). */
export function empreinteTableau(videoId: string, le: string, style: StyleTableau, resume?: ResumeVisuel): EmpreinteVideo {
  const axes: Axes = {};
  ajouter(axes, "habillage", [versCommun("tableau", "habillage", style)]);
  ajouter(axes, "palette", [PALETTE_TABLEAU[style] ?? versCommun("tableau", "palette", style)]);
  if (resume) {
    ajouter(axes, "recit", [versCommun("tableau", "recit", resume.structure)]);
    ajouter(axes, "objets", resume.dessins);
  }
  return empreinte(videoId, "tableau", le, axes);
}
