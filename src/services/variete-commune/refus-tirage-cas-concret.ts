/**
 * Cas concret (X2-11a) : empreinte d'un tirage CANDIDAT et refus « tirage → raison ». Fonctions PURES, aucun appelant
 * (tout éteint) : le branchement est la fiche X2-11b. Les axes viennent du tirage seul (pas de transitions : elles
 * dépendent des écrans) ; mêmes valeurs et même ordre que `empreinteCasConcret`.
 */
import type { AxeCommun, EmpreinteVideo, ResultatGarde } from "@/briques/variete-commune/types";
import { VERSION_EMPREINTE } from "@/briques/variete-commune/version";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import type { Tirage } from "@/moteurs/montage-cas-concret/variete";

/** Intensité des sous-titres du cas concret → valeur commune (même table que `empreintes-a.ts`). */
const SOUS_TITRES_CC: Readonly<Record<string, string>> = Object.freeze({ calme: "calmes", v4: "equilibres", vif: "appuyes" });

const REPLI = "trop proche d'une vidéo récente";

/** Empreinte d'un tirage candidat : ouverture, récit, dosage (si `habille === true`), caméra (si `habille === true` et style ≠ « aucune-v4 »), sous-titres. */
export function empreinteDuTirage(videoId: string, le: string, tirage: Tirage): EmpreinteVideo {
  const axes: Partial<Record<AxeCommun, string[]>> = {};
  axes.ouverture = [versCommun("cas-concret", "ouverture", tirage.ouverture)];
  axes.recit = [versCommun("cas-concret", "recit", tirage.structure)];
  if (tirage.habille === true) {
    axes.dosage = [versCommun("cas-concret", "dosage", tirage.jeuAnimation)];
  }
  // Caméra : `empreinteCasConcret` ne l'émet que si un écran porte un mouvement ; avec « aucune-v4 », `miseDesEcrans` n'en pose aucun.
  if (tirage.habille === true && tirage.camera.style !== "aucune-v4") axes.camera = [versCommun("cas-concret", "camera", tirage.camera.style)];
  axes.sousTitres = [SOUS_TITRES_CC[tirage.sousTitres.intensite] ?? `autre:cas-concret:${tirage.sousTitres.intensite}`];
  return { version: VERSION_EMPREINTE, videoId, formatId: "cas-concret", le, axes };
}

/** `null` si le tirage passe, sinon la raison du refus (jamais vide). Une exception de `refus` → `null` (jamais bloquant). */
export function refusPourTirage(
  refus: (e: EmpreinteVideo) => ResultatGarde, videoId: string, le: string,
): (t: Tirage) => string | null {
  return (t) => {
    try {
      const r = refus(empreinteDuTirage(videoId, le, t));
      if (r.ok) return null;
      return typeof r.phrase === "string" && r.phrase.trim() ? r.phrase : REPLI;
    } catch {
      return null;
    }
  };
}
