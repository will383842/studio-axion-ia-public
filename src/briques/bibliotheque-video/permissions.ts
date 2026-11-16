/**
 * Permissions du réglage (C1-U8, PLAN-FINAL § 3.4) : applique la liste `capacites` du réglage au profil du code.
 * Pur : aucune lecture, aucun service, aucune date. Rend un NOUVEL objet ; le profil du code reste figé. Ne lève jamais.
 */
import { etatCapacite } from "./catalogue";
import { familleDe } from "./noms";
import type { ReglageBibliotheque } from "./reglage";
import type { ProfilVideo } from "./types";

export function appliquerReglage(profil: ProfilVideo, reglage: ReglageBibliotheque): ProfilVideo {
  try {
    if (!reglage.actif || reglage.capacites.length === 0) return profil;
    const capacites = { ...profil.capacites };
    for (const id of reglage.capacites) {
      const regle = Object.prototype.hasOwnProperty.call(profil.capacites, id) ? profil.capacites[id] : undefined;
      if (!regle) continue;
      const etat = etatCapacite(id);
      if (etat === undefined || etat === "coulisse" || etat === "absent") continue;
      if (profil.verrous.includes(id) || profil.verrous.includes(familleDe(id))) continue;
      capacites[id] = { ...regle, permis: true };
    }
    return { ...profil, capacites };
  } catch {
    return profil;
  }
}
