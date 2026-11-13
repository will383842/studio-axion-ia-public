/**
 * INCRUSTATIONS GRAPHIQUES (calque 6 bis, au-dessus de la LUT) — brique commune « composition » (née au lot M4, B.2).
 * PUR. Montant vert (gain) ou rouge (perte), objet détouré ; un montant n'est jamais écrit deux fois (incrusté ET en
 * sous-titre) ; contrôle « montant dit = montant affiché ». Géométrie : `GeometrieIncrustations` de la recette.
 */
import { PALETTE } from "../charte/axion-2026";
import { zoneDe } from "@/briques/sous-titres/largeur";
import type { AlerteQualite, CommandeFabrication, IdReseau } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";
import { GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT, type GeometrieIncrustations } from "./recette";
import { DIMENSIONS_SCENE, PREFIXE_ENTREE, type IncrustationScene, type RatioScene } from "./scene";

/** Couleurs des incrustations graphiques (au-dessus de la LUT : charte 2026 : ni vert ni bleu, orange pour un gain, filet rouge pour une perte). */
export const COULEURS_INCRUSTATION = { gain: PALETTE.orange, perte: PALETTE.erreurFilet, neutre: PALETTE.ivoire } as const;

const ref = (nom: string) => `${PREFIXE_ENTREE}${nom}`;

/**
 * Un montant n'est jamais écrit DEUX fois (défaut vu sur la démonstration : « 2 500 € » en sous-titre et
 * « + 2 500 € » incrusté en même temps). Pendant qu'une incrustation de montant est à l'écran, le groupe de
 * sous-titres qui dit ce montant (mêmes nombres, `montantDit`) est masqué de l'image : l'incrustation, en grand et
 * en couleur, le remplace. Les fichiers .srt / .vtt gardent tout le texte (seule l'image change). PUR.
 */
export function masquerMontantsDits<S extends { debutSec: number; finSec: number; mots: { mot: string; debutSec?: number; finSec?: number }[] }>(segments: S[], incrustations: Pick<IncrustationScene, "deSec" | "aSec" | "type" | "texte">[]): S[] {
  const montants = incrustations.filter((i) => i.type === "montant" && i.texte?.trim());
  if (!montants.length) return segments;
  return segments.flatMap((s) => {
    const dit = s.mots.map((m) => m.mot).join(" ");
    const concernes = montants.filter((m) => s.debutSec < m.aSec - 1e-6 && m.deSec < s.finSec - 1e-6 && nombres(m.texte!).length > 0 && montantDit(m.texte!, dit));
    if (!concernes.length) return [s];
    // GV2-13 : seuls les mots du montant (nombre, tranches de milliers, unité) sont retirés ; « vous perdez » et
    // « sans le savoir » restent. Le groupe n'est retiré que s'il ne reste aucun mot.
    const retires = new Set<number>();
    let i = 0;
    while (i < s.mots.length) {
      if (!estMotMontant(s.mots[i].mot)) { i++; continue; }
      let j = i;
      while (j < s.mots.length && estMotMontant(s.mots[j].mot)) j++;
      const nombresDuBloc = nombres(s.mots.slice(i, j).map((m) => m.mot).join(" "));
      if (concernes.some((m) => nombresDuBloc.some((n) => nombres(m.texte!).includes(n)))) for (let k = i; k < j; k++) retires.add(k);
      i = j;
    }
    const mots = s.mots.filter((_, k) => !retires.has(k));
    if (!mots.length) return [];
    if (mots.length === s.mots.length) return [s];
    const debut = mots[0].debutSec;
    const fin = mots[mots.length - 1].finSec;
    return [{ ...s, mots, ...(debut !== undefined ? { debutSec: debut } : {}), ...(fin !== undefined ? { finSec: fin } : {}) } as S];
  });
}

/** Un mot qui fait partie d'un montant dit : nombre (avec ou sans tranche de milliers collée), « € », « % », « euro(s) ». */
const estMotMontant = (mot: string): boolean => {
  const m = mot.replace(/[.,;:!?…»)\s]+$/u, "").replace(/^[«(\s]+/u, "");
  return /^\d[\d.,  ]*[€%]?$/u.test(m) || /^[€%]$/u.test(m) || /^euros?$/i.test(m);
};

const motsNormalises = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’]/g, "'")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Facecam (finitions du 10/10) : un groupe de sous-titres qui ne fait que répéter un texte affiché par une carte au même
 * moment (« Réservez votre appel diagnostic gratuit » écrit en titre) n'est pas dessiné. Un groupe est une répétition
 * quand TOUS ses mots sont dans le texte de la carte (et au moins un mot de plus de 2 lettres) ; un groupe qui dit autre
 * chose reste. Les données des sous-titres ne changent pas (export SRT entier).
 */
export function masquerTextesAffiches<S extends { debutSec: number; finSec: number; mots: { mot: string }[] }>(segments: S[], textes: { debutSec: number; finSec: number; texte: string }[] | undefined): S[] {
  const affiches = (textes ?? []).map((t) => ({ ...t, mots: motsNormalises(t.texte) })).filter((t) => t.mots.length);
  if (!affiches.length) return segments;
  return segments.filter((s) => {
    const dits = motsNormalises(s.mots.map((m) => m.mot).join(" "));
    // GV2-13 : une répétition = les mots du groupe SE SUIVENT dans le texte de la carte, et au moins 2 mots porteurs.
    if (dits.filter((m) => !MOTS_DE_LIAISON.has(m)).length < 2) return true;
    return !affiches.some((a) => s.debutSec < a.finSec - 1e-6 && a.debutSec < s.finSec - 1e-6 && contientSuite(a.mots, dits));
  });
}

/** Mots de liaison, ignorés pour juger qu'un groupe « répète » une carte (comparaison sans accent ni casse). */
const MOTS_DE_LIAISON = new Set(["de", "la", "le", "les", "un", "une", "des", "et", "a", "en", "pour", "vos", "nos"]);

/** Vrai si `suite` apparaît telle quelle (mots contigus, dans l'ordre) dans `texte`. */
const contientSuite = (texte: string[], suite: string[]): boolean => {
  if (!suite.length || suite.length > texte.length) return false;
  for (let d = 0; d + suite.length <= texte.length; d++) if (suite.every((m, k) => texte[d + k] === m)) return true;
  return false;
};

/**
 * Facecam (11/10, carte « Une formation pour vos équipes ») : pendant une carte PLEIN ÉCRAN, aucun sous-titre n'est
 * dessiné. Le texte de la carte est centré et occupe une hauteur que la composition ne connaît pas ; avant, « avec des
 * aides » se posait par-dessus sa dernière ligne. Masquer est le plus sûr (aucune zone à deviner, 9:16, 4:5 et 1:1) et
 * la carte parle à la place du visage. Les cartes en demi-écran haut gardent leurs sous-titres. Les données des
 * sous-titres ne changent pas (export SRT entier).
 */
export function masquerPendantCartesPleinEcran<S extends { debutSec: number; finSec: number; mots?: { debutSec?: number; finSec?: number }[] }>(segments: S[], cartes: { debutSec: number; finSec: number }[] | undefined): S[] {
  if (!cartes?.length) return segments;
  return cartes.reduce((restants, c) => restants.flatMap((s) => rognerHorsCarte(s, c)), segments);
}

/** Durée minimale d'une partie de groupe gardée hors d'une carte plein écran (GV2-13). */
const DUREE_MIN_PARTIE_HORS_CARTE_SEC = 0.3;

/**
 * GV2-13 : un groupe qui touche la carte n'est plus retiré en entier. On garde les mots dits HORS de la carte (milieu du
 * mot hors de la carte), rognés pour finir au début de la carte ou commencer à sa fin (jamais un sous-titre sur la
 * dernière ligne d'une carte). Partie gardée trop courte (< 0,3 s) ou mots sans heures : le groupe est retiré, comme avant.
 */
function rognerHorsCarte<S extends { debutSec: number; finSec: number; mots?: { debutSec?: number; finSec?: number }[] }>(s: S, c: { debutSec: number; finSec: number }): S[] {
  if (!(s.debutSec < c.finSec - 1e-6 && c.debutSec < s.finSec - 1e-6)) return [s];
  const mots = s.mots;
  if (!mots?.length || mots.some((m) => m.debutSec === undefined || m.finSec === undefined)) return [];
  const milieu = (m: { debutSec?: number; finSec?: number }) => (m.debutSec! + m.finSec!) / 2;
  const avant = mots.filter((m) => milieu(m) <= c.debutSec);
  const apres = mots.filter((m) => milieu(m) >= c.finSec);
  const parties = [
    { mots: avant, debutSec: Math.min(avant[0]?.debutSec ?? 0, c.debutSec), finSec: Math.min(avant.at(-1)?.finSec ?? 0, c.debutSec) },
    { mots: apres, debutSec: Math.max(apres[0]?.debutSec ?? 0, c.finSec), finSec: Math.max(apres.at(-1)?.finSec ?? 0, c.finSec) },
  ].filter((p) => p.mots.length && p.finSec - p.debutSec >= DUREE_MIN_PARTIE_HORS_CARTE_SEC - 1e-9);
  if (!parties.length) return [];
  // Un seul morceau par groupe (carte au milieu d'un groupe : cas rare) : la partie la plus longue.
  const p = parties.reduce((a, b) => (b.finSec - b.debutSec > a.finSec - a.debutSec ? b : a));
  return [{ ...s, mots: p.mots, debutSec: Math.max(p.debutSec, s.debutSec), finSec: Math.min(p.finSec, s.finSec) } as S];
}

const nombres = (s: string) => (s.replace(/[\s  .]/g, "").match(/\d+(?:,\d+)?/g) ?? []).map((x) => x.replace(/^0+(?=\d)/, ""));

/** Contrôle `montant` (B.2, B.8) : chaque nombre affiché doit être dit dans le plan (ou dans son segment). */
export function montantDit(affiche: string, dit: string): boolean {
  const ditNombres = new Set(nombres(dit));
  return nombres(affiche).every((n) => ditNombres.has(n));
}

/**
 * Incrustations graphiques (calque 6 bis, au-dessus de la LUT) : montant vert (gain) ou rouge (perte), objet détouré
 * à 30-40 % de la largeur. Bande verticale de 52 % jusqu'à la limite basse de la zone protégée (70 % avec Instagram
 * ou Facebook), centrées ; jamais pendant l'encadré d'ouverture ; apparition franche.
 */
export function placerIncrustations(
  plans: PlanProduit[],
  ratio: RatioScene,
  reseaux: IdReseau[],
  options: { encadreFinSec?: number; medias?: CommandeFabrication["medias"]; texteSegments?: Record<string, string>; geometrie?: GeometrieIncrustations } = {},
): { incrustations: IncrustationScene[]; entrees: Record<string, string>; alertes: AlerteQualite[] } {
  const g = options.geometrie ?? GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT;
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE[ratio];
  const k = W / 1080;
  const zone = zoneDe(ratio, reseaux);
  const haut = (g.hautPct / 100) * H;
  const bas = ((100 - zone.bas) / 100) * H;
  const incrustations: IncrustationScene[] = [];
  const entrees: Record<string, string> = {};
  const alertes: AlerteQualite[] = [];
  for (const p of plans) {
    const inc = p.incrustation;
    if (!inc) continue;
    // Lot « intensité » : apparition retardée dans le plan quand le chef d'orchestre l'a décalée (respiration).
    const deSec = Math.max(p.debutSec + (inc.decalageSec ?? 0), options.encadreFinSec ?? 0);
    if (p.finSec - deSec < g.dureeMinSec) continue;
    if (inc.type === "montant") {
      const texte = (inc.texte ?? "").trim();
      if (!texte) continue;
      const dit = `${p.texte} ${options.texteSegments?.[p.segmentId] ?? ""}`;
      if (!montantDit(texte, dit)) alertes.push({ code: "montant", gravite: "attention", message: `Le montant affiché « ${texte} » n'est pas celui qui est dit.` });
      const taille = Math.round(g.montantTaillePx * k);
      incrustations.push({ deSec, aSec: p.finSec, type: "montant", texte, couleur: inc.sens === "perte" ? COULEURS_INCRUSTATION.perte : inc.sens === "gain" ? COULEURS_INCRUSTATION.gain : COULEURS_INCRUSTATION.neutre, centreXPx: W / 2, centreYPx: Math.round(Math.min(bas - taille * 0.7, (haut + bas) / 2)), taillePx: taille });
    } else {
      const media = inc.elementId ? options.medias?.[inc.elementId] : undefined;
      if (!media) continue;
      const nom = `objet-${p.ordre}`;
      entrees[nom] = media.cle;
      // G6 (incrustation d'appel, vue sur le rendu local) : l'objet commence nettement SOUS la ligne des sous-titres
      // (descendue sur la poitrine, elle touche le haut de la bande) et reste au-dessus de la zone protégée du bas ; il
      // rétrécit au besoin (jamais sous 120 px à 1080).
      const haute = haut + 0.05 * H;
      const largeur = Math.round(Math.min((g.objetLargeurPct / 100) * W, Math.max(120 * k, bas - haute - 0.01 * H)));
      incrustations.push({ deSec, aSec: p.finSec, type: "objet", url: ref(nom), centreXPx: W / 2, centreYPx: Math.round(haute + largeur / 2), taillePx: largeur });
    }
  }
  return { incrustations, entrees, alertes };
}

/** Réseaux de référence pour la TAILLE d'un objet incrusté : la même dans toutes les versions par réseau. */
const RESEAUX_REFERENCE_OBJET: IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube-shorts"];
/** Écart visible entre le bas des sous-titres dessinés et le haut d'un objet incrusté (px à 1080 de large). */
export const ECART_OBJET_SOUS_TITRES_PX = 48;

/**
 * E2E-1 n° 12 (03/10) : objet incrusté (logo d'appel…) recalé sur les sous-titres RÉELLEMENT dessinés et de taille
 * COHÉRENTE d'un réseau à l'autre. Taille : celle que permet la zone protégée la plus stricte des réseaux verticaux
 * (plafonnée à `objetLargeurPct`), donc identique en TikTok, Reels, Shorts, LinkedIn, Facebook. Position : au moins
 * `ECART_OBJET_SOUS_TITRES_PX` sous le bas des sous-titres (`basSousTitres`, null : aucun), au-dessus de la zone protégée
 * du bas de CE réseau (l'objet ne rétrécit qu'à défaut de place, jamais sous 120 px). Les montants ne bougent pas. PUR.
 */
export function recalerObjets(
  incrustations: IncrustationScene[],
  ratio: RatioScene,
  reseaux: IdReseau[],
  options: { geometrie?: GeometrieIncrustations; basSousTitres?: (deSec: number, aSec: number) => number | null } = {},
): IncrustationScene[] {
  if (!incrustations.some((i) => i.type === "objet")) return incrustations;
  const g = options.geometrie ?? GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT;
  const { largeur: W, hauteur: H } = DIMENSIONS_SCENE[ratio];
  const k = W / 1080;
  const haute = (g.hautPct / 100) * H + 0.05 * H;
  // Bas de référence : la zone protégée la plus stricte des réseaux verticaux (jamais plus bas que celle de CE réseau).
  const bas = ((100 - zoneDe(ratio, reseaux).bas) / 100) * H - 0.01 * H;
  const basReference = Math.min(bas, ((100 - zoneDe(ratio, RESEAUX_REFERENCE_OBJET).bas) / 100) * H - 0.01 * H);
  return incrustations.map((i) => {
    if (i.type !== "objet") return i;
    const basTexte = options.basSousTitres?.(i.deSec, i.aSec) ?? null;
    const haut = Math.max(haute, basTexte === null ? -Infinity : basTexte + ECART_OBJET_SOUS_TITRES_PX * k);
    // Même taille sur tous les réseaux : celle que laisse le bas de référence (plafonnée, jamais sous 120 px).
    const taille = Math.round(Math.max(120 * k, Math.min((g.objetLargeurPct / 100) * W, basReference - haut)));
    // Place manquante (sous-titres très bas) : l'objet remonte au plus juste au-dessus de la zone protégée du bas.
    const top = Math.min(haut, bas - taille);
    return { ...i, taillePx: taille, centreYPx: Math.round(top + taille / 2) };
  });
}
