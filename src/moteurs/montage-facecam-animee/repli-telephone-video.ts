/**
 * C4-U4.9b-b : repli du téléphone qui joue un extrait quand aucun extrait n'est trouvé. Pur, importé par chaine-v4.ts (BR-TELEPHONE-c).
 * Éteint : sans l'option, la liste est exactement `IDS_PLAQUETTES_A_VIDEO_V4`.
 */
import { IDS_PLAQUETTES_A_VIDEO_V4, erreursRepliV4 } from "./repli-sans-video-v4";
import { raisonSansVideoV4, retirerPlaquettesSansVideo, type PlanAvecElementsV4, type PlaquetteRetireeV4 } from "./videos-v4";

/** Égal à `ID_TELEPHONE_VIDEO` de `rendus-lot6.tsx` (vérifié par le test) ; on n'importe pas C4-U4.9a-a, qui peut ne pas être fusionnée. */
const ID = "telephone-video";

/** Liste des plaquettes à vidéo : seul `telephoneVideo === true` y ajoute le téléphone. PUR. */
export function idsPlaquettesAVideoOuvertes(options?: { telephoneVideo?: unknown }): readonly string[] {
  if (options?.telephoneVideo !== true) return IDS_PLAQUETTES_A_VIDEO_V4;
  return Object.freeze([...IDS_PLAQUETTES_A_VIDEO_V4, ID]);
}

const secondes = (x: number) => `${x.toFixed(1).replace(".", ",")} s`;

/** Consigne D16 propre au téléphone (même forme que `erreursRepliV4`). PUR, ne lève jamais. */
export function erreurRepliTelephone(rang: number, debutSec: number): string {
  return `D16 — élément v4 ${rang + 1} « ${ID} » à ${secondes(debutSec)} : aucun extrait des vidéos de Will n'a été trouvé ; remplacez-le par une plaquette sans vidéo qui montre littéralement ce qui est dit (FenetreTelephone, FenetreDouble, CarrouselFeuillete…), sans « recherches ». Gardez V6, V7, H1 et H2.`;
}

const sansCle = (e: { medias?: string[] }) => !(e.medias ?? []).some((m) => typeof m === "string" && m.trim() !== "");

/** BR-TELEPHONE-c : rangs des téléphones sans aucun extrait ; `[]` tant que `telephoneVideo !== true`. PUR. */
export function telephonesSansMediaV4(plan: PlanAvecElementsV4, options?: { telephoneVideo?: unknown }): number[] {
  if (options?.telephoneVideo !== true) return [];
  return (plan.elementsV4 ?? []).flatMap((e, i) => (e.id === ID && sansCle(e) ? [i] : []));
}

/** BR-TELEPHONE-c : `retirerPlaquettesSansVideo` qui retire aussi le téléphone sans extrait (allumé). Éteint ou rien à retirer : le MÊME appel. PUR. */
export function retirerSansVideoOuvertV4<P extends PlanAvecElementsV4>(plan: P, options?: { telephoneVideo?: unknown }): { plan: P; retirees: PlaquetteRetireeV4[] } {
  if (options?.telephoneVideo !== true || !telephonesSansMediaV4(plan, options).length) return retirerPlaquettesSansVideo(plan);
  const retirees: PlaquetteRetireeV4[] = [];
  const gardees = (plan.elementsV4 ?? []).filter((e, rang) => {
    const raison = raisonSansVideoV4(e) ?? (e.id === ID && sansCle(e) ? `aucun extrait des vidéos de Will trouvé pour « ${ID} »` : null);
    if (raison) retirees.push({ rang, id: e.id, debut: e.debut, fin: e.fin, raison });
    return !raison;
  });
  return { plan: { ...plan, elementsV4: gardees }, retirees };
}

/** BR-TELEPHONE-c : consignes du repli ; le téléphone retiré a la sienne (`erreurRepliTelephone`). Éteint : le MÊME appel. PUR. */
export function erreursRepliOuvertesV4(plan: PlanAvecElementsV4, retirees: readonly PlaquetteRetireeV4[], options?: { telephoneVideo?: unknown }): string[] {
  if (options?.telephoneVideo !== true) return erreursRepliV4(plan, retirees);
  return [...erreursRepliV4(plan, retirees.filter((r) => r.id !== ID)), ...retirees.filter((r) => r.id === ID).map((r) => erreurRepliTelephone(r.rang, r.debut))];
}
