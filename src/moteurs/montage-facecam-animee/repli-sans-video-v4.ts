/**
 * REPLI « SANS VIDÉO » du face caméra animé v4 (19/10/2026) — PUR, aucun appel.
 *
 * Cas : l'étape « videos » ne trouve pas de vidéo fidèle pour une plaquette à vidéo (AvantApres, MosaiqueVideos, duel-video) ET le plan sans
 * elle viole H1/H2. Au lieu de bloquer tout de suite, la chaîne revient UNE fois à la mise en scène : Opus reçoit son plan précédent et refait
 * ces plaquettes avec des plaquettes SANS vidéo qui montrent littéralement ce qui est dit. Les plaquettes à vidéo sont alors interdites (règle D16).
 * Rien n'est assoupli : ni la fidélité des vidéos, ni H1/H2 ; jamais de vidéo approximative ; jamais le plan minimal. Un seul repli par vidéo.
 */
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { CATALOGUE_V4, ficheV4 } from "./realisateur/catalogue-v4";
import type { PlaquetteRetireeV4 } from "./videos-v4";

/** Identifiants des plaquettes qui exigent des vidéos : lus dans le catalogue (fiche à `videos[1] > 0`), jamais écrits en dur. */
export const IDS_PLAQUETTES_A_VIDEO_V4: readonly string[] = Object.freeze(CATALOGUE_V4.filter((f) => f.videos[1] > 0).map((f) => f.id));
/** Essais Claude au plus pour refaire la mise en scène sans vidéo. */
export const ESSAIS_REPLI_SANS_VIDEO_V4 = 2;

/** Les plaquettes du plan d'Opus à garder sous les yeux : tout le plan v4, tel que Claude l'a écrit (sans `medias`). PUR. */
export function elementsPourRepliV4(plan: { elementsV4?: readonly ElementV4Plan[] }): ElementV4Plan[] {
  return (plan.elementsV4 ?? []).map((e) => {
    const copie = { ...e };
    delete copie.medias;
    return copie;
  });
}

const secondes = (x: number) => `${x.toFixed(1).replace(".", ",")} s`;

/**
 * Une erreur D16 par plaquette à vidéo retirée : ce que Claude doit faire à la place, selon l'emplacement de la plaquette.
 * `plan` : le plan refusé (pour retrouver le rang écrit par Claude). Les règles V6, V7, H1 et H2 restent celles du catalogue.
 */
export function erreursRepliV4(plan: { elementsV4?: readonly ElementV4Plan[] }, retirees: readonly PlaquetteRetireeV4[]): string[] {
  const lignes = retirees.map((r) => {
    const f = ficheV4(r.id);
    const nom = f && f.actif ? f.nom : r.id;
    const aide = f && f.actif && f.slot === "plein-cadre"
      ? "un plein cadre sans vidéo (dalle-claquee, rafale-trois-mots, EclatChiffre si un nombre est dit), seulement s'il montre ce qui est dit"
      : "FenetreTelephone, FenetreDouble, CarrouselFeuillete ou un autre emplacement sans vidéo";
    return `D16 — élément v4 ${r.rang + 1} « ${r.id} » (${nom}) à ${secondes(r.debut)} : aucune vidéo fidèle à ce que Will dit n'a été trouvée ; remplacez-la par une plaquette sans vidéo qui montre littéralement ce qui est dit (${aide}), sans « recherches ». Gardez V6, V7, H1 et H2.`;
  });
  // Plaquettes à vidéo encore présentes dans le plan refusé mais absentes de la liste des retirées (reprise partielle) : même consigne.
  const dites = new Set(retirees.map((r) => r.rang));
  (plan.elementsV4 ?? []).forEach((e, rang) => {
    if (!IDS_PLAQUETTES_A_VIDEO_V4.includes(e.id) || dites.has(rang)) return;
    lignes.push(`D16 — élément v4 ${rang + 1} « ${e.id} » à ${secondes(e.debut)} : plaquette à vidéo interdite dans ce plan ; remplacez-la par une plaquette sans vidéo, sans « recherches ».`);
  });
  return lignes;
}

/** Noms lisibles (fiche active) et instants des plaquettes retirées, trois au plus : jamais le texte écrit par Claude. */
export function nomsRetireesV4(retirees: readonly PlaquetteRetireeV4[]): string {
  return retirees.slice(0, 3).map((r) => { const f = ficheV4(r.id); return `la plaquette « ${f && f.actif ? f.nom : r.id} » à ${secondes(r.debut)}`; }).join(", ");
}

/** Phrase pour Will quand le repli réussit. */
export const phraseRepliOkV4 = (retirees: readonly PlaquetteRetireeV4[]): string =>
  `Aucune vidéo fidèle n'a été trouvée pour ${nomsRetireesV4(retirees)} : la mise en scène a été refaite sans vidéo d'illustration.`;

/** Phrase pour Will quand le repli échoue. */
export const phraseRepliEchecV4 = (retirees: readonly PlaquetteRetireeV4[]): string =>
  `Je n'ai pas trouvé de vidéo fidèle à ce que vous dites pour ${nomsRetireesV4(retirees)}, et la mise en scène refaite sans vidéo n'a pas passé les contrôles : la vidéo n'est pas fabriquée. Reprendre relance la mise en scène sans vidéo.`;
