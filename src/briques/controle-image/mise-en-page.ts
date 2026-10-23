/**
 * Contrôles CALCULÉS sur la mise en page (liste de boîtes), sans rendu. PUR. Les zones sûres se lisent dans
 * `src/reseaux` (jamais recopiées) ; le contraste vient de `src/briques/habillage/contraste.ts`.
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import { zoneProtegeeCombinee } from "@/reseaux";
import { rapportContraste } from "@/briques/habillage/contraste";
import { SEUILS_CONTROLE_IMAGE, nombre, pourcent } from "./seuils";
import type { Boite, IdControle, MiseEnPage, ResultatControle, SeuilsControleImage, ZoneSure } from "./types";

/** Tolérance d'arrondi sur les positions (fractions). */
const TOLERANCE_POSITION = 1e-6;

/** Zone sûre commune aux réseaux visés pour un format d'image, en fractions ; null si aucun ne le propose. */
export function zoneSureDe(ratio: Ratio, reseaux: IdReseau[]): ZoneSure | null {
  const z = zoneProtegeeCombinee(ratio, reseaux);
  return z ? { haut: z.haut / 100, droite: z.droite / 100, bas: z.bas / 100, gauche: z.gauche / 100 } : null;
}

/** Nom lisible d'une boîte dans un message. */
export function nomBoite(b: Boite, i: number): string {
  if (b.role === "marque") return `la marque n° ${i + 1}`;
  const t = (b.texte ?? "").trim();
  return t ? `« ${t.length > 40 ? `${t.slice(0, 39)}…` : t} »` : `le texte n° ${i + 1}`;
}

function estTexte(b: Boite): boolean {
  return b.role !== "marque";
}

function compter(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

function liste(noms: string[]): string {
  return noms.length <= 3 ? noms.join(", ") : `${noms.slice(0, 3).join(", ")} et ${noms.length - 3} autre${noms.length > 4 ? "s" : ""}`;
}

function fait(id: IdControle, libelle: string, fautifs: string[], raisonOk: string, raisonKo: (l: string) => string): ResultatControle {
  return fautifs.length
    ? { id, libelle, bloquant: true, etat: "echoue", raison: raisonKo(liste(fautifs)) }
    : { id, libelle, bloquant: true, etat: "reussi", raison: raisonOk };
}

export function controleZoneSure(p: MiseEnPage, zone: ZoneSure | null): ResultatControle {
  const libelle = "Zone sûre";
  if (!zone) return { id: "zone-sure", libelle, bloquant: true, etat: "non-fait", raison: "Aucune zone sûre connue pour ce format d'image et ces réseaux." };
  const fautifs = p.boites.flatMap((b, i) =>
    b.x < zone.gauche - TOLERANCE_POSITION || b.y < zone.haut - TOLERANCE_POSITION || b.x + b.largeur > 1 - zone.droite + TOLERANCE_POSITION || b.y + b.hauteur > 1 - zone.bas + TOLERANCE_POSITION ? [nomBoite(b, i)] : [],
  );
  return fait("zone-sure", libelle, fautifs, "Tout est dans la zone sûre.", (l) => `Hors zone sûre, caché par les boutons du réseau : ${l}.`);
}

/** Bande des sous-titres : en bas de la zone sûre, haute de `bandeSousTitres`. Aucune boîte ne doit la toucher. */
export function controleBandeSousTitres(p: MiseEnPage, zone: ZoneSure | null, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle {
  const libelle = "Bande des sous-titres";
  if (!zone) return { id: "bande-sous-titres", libelle, bloquant: true, etat: "non-fait", raison: "Bande des sous-titres inconnue : aucune zone sûre pour ce format d'image." };
  const bas = 1 - zone.bas;
  const haut = bas - s.bandeSousTitres;
  const fautifs = p.boites.flatMap((b, i) => (b.y < bas - TOLERANCE_POSITION && b.y + b.hauteur > haut + TOLERANCE_POSITION ? [nomBoite(b, i)] : []));
  return fait("bande-sous-titres", libelle, fautifs, "Rien dans la bande réservée aux sous-titres.", (l) => `Dans la bande réservée aux sous-titres : ${l}.`);
}

export function controleTailleTexte(p: MiseEnPage, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle {
  const fautifs = p.boites.flatMap((b, i) => (estTexte(b) && !((b.taille ?? 0) >= s.tailleTexteMin - TOLERANCE_POSITION) ? [`${nomBoite(b, i)} (${b.taille === undefined ? "taille absente" : pourcent(b.taille)})`] : []));
  return fait("taille-texte", "Taille du texte", fautifs, `Tout texte fait au moins ${pourcent(s.tailleTexteMin)} de la hauteur.`, (l) => `Texte trop petit (moins de ${pourcent(s.tailleTexteMin)} de la hauteur) : ${l}.`);
}

/** Contraste : un texte ≥ `contrasteTexteMin`, une marque ≥ `contrasteMarqueMin`. Une couleur illisible échoue. */
export function controleContraste(p: MiseEnPage, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle {
  const fautifs = p.boites.flatMap((b, i) => {
    const min = estTexte(b) ? s.contrasteTexteMin : s.contrasteMarqueMin;
    let r: number;
    try {
      r = rapportContraste(b.couleur, b.fond);
    } catch {
      return [`${nomBoite(b, i)} (couleur illisible)`];
    }
    return r < min ? [`${nomBoite(b, i)} (${nombre(r)} pour 1, il faut ${nombre(min, 0)} pour 1)`] : [];
  });
  return fait(
    "contraste",
    "Contraste",
    fautifs,
    `Contraste suffisant : ${nombre(s.contrasteTexteMin, 0)} pour 1 au moins pour le texte, ${nombre(s.contrasteMarqueMin, 0)} pour 1 pour les marques.`,
    (l) => `Contraste insuffisant : ${l}.`,
  );
}

/** Première image : une accroche visible dès 0 s, d'au plus `accrocheMotsMax` mots, assez grande et contrastée. */
export function controlePremiereImage(p: MiseEnPage, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle {
  const libelle = "Première image";
  const ko = (raison: string): ResultatControle => ({ id: "premiere-image", libelle, bloquant: true, etat: "echoue", raison });
  const accroche = p.boites.find((b) => b.role === "accroche" && b.debutSec <= TOLERANCE_POSITION && (b.texte ?? "").trim());
  if (!accroche) return ko("Aucune accroche sur la première image : sans le son, rien ne dit de quoi parle la vidéo.");
  const mots = (accroche.texte ?? "").trim().split(/\s+/).length;
  if (mots > s.accrocheMotsMax) return ko(`Accroche trop longue pour être lue d'un coup d'œil : ${compter(mots, "mot")}, ${s.accrocheMotsMax} au plus.`);
  if (!((accroche.taille ?? 0) >= s.tailleTexteMin - TOLERANCE_POSITION)) return ko(`Accroche trop petite pour être lue : moins de ${pourcent(s.tailleTexteMin)} de la hauteur.`);
  let r = 0;
  try {
    r = rapportContraste(accroche.couleur, accroche.fond);
  } catch {
    return ko("Accroche illisible : couleur inconnue.");
  }
  if (r < s.contrasteTexteMin) return ko(`Accroche peu lisible : contraste de ${nombre(r)} pour 1, il faut ${nombre(s.contrasteTexteMin, 0)} pour 1.`);
  return { id: "premiere-image", libelle, bloquant: true, etat: "reussi", raison: `Accroche lisible dès la première image (${compter(mots, "mot")}).` };
}

/** Tous les contrôles calculés sur la mise en page, dans l'ordre du rapport. */
export function controlerMiseEnPage(p: MiseEnPage, zone: ZoneSure | null, s: SeuilsControleImage = SEUILS_CONTROLE_IMAGE): ResultatControle[] {
  return [controleZoneSure(p, zone), controleBandeSousTitres(p, zone, s), controleTailleTexte(p, s), controleContraste(p, s), controlePremiereImage(p, s)];
}
