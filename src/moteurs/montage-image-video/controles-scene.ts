/**
 * IMAGE → VIDÉO · Contrôles BLOQUANTS de la mise en scène (lot L11, plan 50 § 7 : Q12-Q15, Q19, Q20-Q23, Q25). PUR.
 *
 * Chaque contrôle rend une ligne (code, verdict, phrase pour Will, détails). Une ligne bloquante en échec = la mise en
 * scène est refusée : rien n'est corrigé en silence, rien ne se saute quand une donnée manque (elle échoue).
 *
 * Rythme (Q14, I5) : ne comptent QUE l'apparition d'un nœud, d'un chiffre ou d'un objet, une coche, un changement de
 * fond ou de scène. Les mouvements de caméra (et les simples rappels d'un nœud déjà posé) ne comptent PAS : un trou de
 * 2,6 s qui ne contient qu'un panoramique est refusé. Un changement d'en-tête ou un texte de comblement (`remplissage`)
 * ne compte pas non plus : un trou comblé par un simple en-tête de relance est refusé.
 */
import { controlerCadrage, etatDansCadre, emprise, mesurerTrajectoire, BORNES_CAMERA, cameraA } from "@/briques/schema-motion/camera";
import { disposerEnsemble } from "@/briques/schema-motion/disposition";
import { controlerEnsemble, controlerLisibiliteToile } from "@/briques/schema-motion/lisibilite";
import { debordementsEnsemble, planEnsemble } from "@/briques/schema-motion/plan-objets";
import type { CadrageCamera } from "@/briques/schema-motion/camera";
import type { DispositionToile, MotParle, TrajectoireCamera } from "@/briques/schema-motion/types";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import type { ReseauIV } from "@/domaine/image-video/plafonds";
import type { MotHorodate } from "@/domaine/types";
import { SILENCE_MAX_SEC, type ResultatBruitagesIV } from "./bruitages";
import type { BlocRenduIV, EvenementTempsIV, LigneDeTempsIV, PlanIV } from "./mise-en-scene";
import { chiffresDuTexte } from "./regles";
import { REGLES_SCENE_IV } from "./regles-scene";
import { controlerSousTitresIV } from "./sous-titres";
import { controlerVariationsIV, sousTitresVariesIV } from "./sous-titres-varies";

const S = REGLES_SCENE_IV;

export type CodeControleScene = "Q12" | "Q13" | "Q14" | "Q15" | "Q19" | "Q20" | "Q21" | "Q22" | "Q23" | "Q25" | "FOND" | "ORANGE" | "FIN";

export interface LigneControleSceneIV {
  code: CodeControleScene;
  ok: boolean;
  bloquant: boolean;
  /** Une phrase simple pour Will (verdict). */
  phrase: string;
  details: string[];
}

export interface MesuresRythmeIV {
  /** Changements visibles comptés (les mouvements de caméra exclus). */
  changements: number;
  ecartMaxSec: number;
  /** Où se trouve le plus grand trou. */
  trou: { debutSec: number; finSec: number };
  moyenneSec: number;
  planPlusLongSec: number;
}

export interface RapportMiseEnSceneIV {
  lignes: LigneControleSceneIV[];
  bloquants: LigneControleSceneIV[];
  rythme: MesuresRythmeIV;
}

export interface ContexteControleScene {
  carte: CarteImage;
  fiche: FicheImage;
  reseaux: readonly ReseauIV[];
  bruitages: ResultatBruitagesIV;
  voix: readonly MotHorodate[];
}

const sec = (s: number) => `${s.toFixed(1).replace(".", ",")} s`;
const ligne = (code: CodeControleScene, details: string[], phraseOk: string, phraseKo: string, bloquant = true): LigneControleSceneIV => ({
  code,
  ok: details.length === 0,
  bloquant,
  phrase: details.length === 0 ? phraseOk : `${phraseKo} ${details[0]}${details.length > 1 ? ` (et ${details.length - 1} autre${details.length > 2 ? "s" : ""})` : ""}`,
  details,
});

/* ------------------------------------------------------------------ */
/* Q14 · Rythme                                                          */
/* ------------------------------------------------------------------ */

type EvenementRythme = Pick<EvenementTempsIV, "instantSec" | "visible" | "genre" | "remplissage">;

/** Vrai si l'événement compte pour le rythme : visible, ni caméra, ni en-tête, ni texte de comblement. */
export function compteRythme(e: EvenementRythme): boolean {
  return e.visible && e.genre !== "camera" && !e.remplissage;
}

/** Instants des changements qui COMPTENT (caméra, rappels, en-têtes et textes de comblement exclus), de 0 à la fin de la voix. */
export function instantsVisibles(evenements: readonly EvenementRythme[], finVoixSec: number): number[] {
  return [...new Set(evenements.filter((e) => compteRythme(e) && e.instantSec <= finVoixSec + 1e-9).map((e) => Math.round(e.instantSec * 1000) / 1000))].sort((a, b) => a - b);
}

export function mesurerRythme(evenements: readonly EvenementRythme[], finVoixSec: number, plans: readonly Pick<PlanIV, "debut" | "fin">[] = []): MesuresRythmeIV {
  const ts = instantsVisibles(evenements, finVoixSec);
  const pts = [0, ...ts.filter((t) => t > 0), finVoixSec];
  let trou = { debutSec: 0, finSec: 0 };
  for (let k = 1; k < pts.length; k++) if (pts[k] - pts[k - 1] > trou.finSec - trou.debutSec) trou = { debutSec: pts[k - 1], finSec: pts[k] };
  // Temps : changements fusionnés à moins de 0,4 s.
  const temps: number[] = [];
  for (const t of ts) if (!temps.length || t - temps[temps.length - 1] >= S.fusion) temps.push(t);
  const moyenne = temps.length > 1 ? (temps[temps.length - 1] - temps[0]) / (temps.length - 1) : finVoixSec;
  const planPlusLong = Math.max(0, ...plans.map((p) => Math.min(p.fin, finVoixSec) - p.debut));
  return { changements: ts.length, ecartMaxSec: Math.round((trou.finSec - trou.debutSec) * 1000) / 1000, trou, moyenneSec: Math.round(moyenne * 1000) / 1000, planPlusLongSec: Math.round(planPlusLong * 1000) / 1000 };
}

/** Q14 : écart ≤ 2,4 s entre deux changements visibles, moyenne ≤ 2,2 s ; plans ≤ 5 s, jamais deux de suite > 4 s ; « Ensemble » ≤ 1,5 s. */
export function controlerRythme(l: Pick<LigneDeTempsIV, "evenements" | "plans" | "finVoixSec">): LigneControleSceneIV[] {
  const m = mesurerRythme(l.evenements, l.finVoixSec, l.plans);
  const details: string[] = [];
  const pts = [0, ...instantsVisibles(l.evenements, l.finVoixSec).filter((t) => t > 0), l.finVoixSec];
  for (let k = 1; k < pts.length; k++) {
    if (pts[k] - pts[k - 1] > S.ecartMax + 1e-6) details.push(`de ${sec(pts[k - 1])} à ${sec(pts[k])}, rien de nouveau n'apparaît pendant ${sec(pts[k] - pts[k - 1])} (2,4 s au plus ; un mouvement de caméra ne compte pas).`);
  }
  if (m.moyenneSec > S.moyenneMax + 1e-6) details.push(`un changement toutes les ${sec(m.moyenneSec)} en moyenne (2,2 s au plus).`);
  const plans: string[] = [];
  const duree = (p: Pick<PlanIV, "debut" | "fin">) => Math.min(p.fin, l.finVoixSec) - p.debut;
  l.plans.forEach((p, k) => {
    const d = duree(p);
    if (p.sorte === "ensemble" && p.fin - p.debut > S.ensembleMax + 1e-6) plans.push(`la vue d'ensemble ${p.id} dure ${sec(p.fin - p.debut)} (1,5 s au plus).`);
    else if (d > S.planMax + 1e-6) plans.push(`le plan ${p.id} (${p.ecran ?? p.scene}) dure ${sec(d)} (5 s au plus).`);
    const avant = l.plans[k - 1];
    if (avant && d > S.planLong + 1e-6 && duree(avant) > S.planLong + 1e-6) plans.push(`les plans ${avant.id} et ${p.id} durent tous deux plus de 4 s.`);
  });
  const res = [ligne("Q14", [...details, ...plans], `Rythme tenu : un changement toutes les ${sec(m.moyenneSec)} en moyenne, ${sec(m.ecartMaxSec)} au plus.`, "Rythme trop lent :")];
  if (m.moyenneSec < S.moyenneMin - 1e-6) res.push(ligne("Q14", [`un changement toutes les ${sec(m.moyenneSec)} en moyenne.`], "", "Rythme très dense (indication) :", false));
  return res;
}

/* ------------------------------------------------------------------ */
/* Q12 · Tout est montré ; Q13 · chiffre dit = chiffre montré            */
/* ------------------------------------------------------------------ */

export function controlerToutMontre(l: Pick<LigneDeTempsIV, "evenements">, carte: CarteImage, clesCarte: ReadonlyMap<string, string>): LigneControleSceneIV {
  const refs = new Set(l.evenements.filter((e) => e.ref).map((e) => e.ref!));
  const cles = new Set(l.evenements.filter((e) => e.visible).flatMap((e) => e.chiffres));
  const details: string[] = [];
  const montre = (id: string) => refs.has(id);
  for (const n of carte.noeuds) if (!n.photoPersonnes && !montre(n.id)) details.push(`le bloc « ${n.libelle} » n'apparaît jamais.`);
  for (const lien of carte.liens) {
    const ok = (id: string) => montre(id) || carte.noeuds.find((n) => n.id === id)?.photoPersonnes;
    if (!ok(lien.de) || !ok(lien.vers)) details.push(`la flèche ${lien.id} n'est jamais dessinée.`);
  }
  for (const g of carte.groupes) if (g.sorte === "branche" && !g.noeuds.some(montre)) details.push(`la branche « ${g.titre ?? g.id} » n'est jamais montrée.`);
  for (const c of carte.chiffres) if (!cles.has(clesCarte.get(c.id)!)) details.push(`le chiffre « ${c.brut} » n'est jamais affiché.`);
  return ligne("Q12", details, "Tout ce que porte l'image est montré.", "Il manque quelque chose à l'écran :");
}

export function controlerChiffresMontres(l: Pick<LigneDeTempsIV, "evenements" | "chiffresDits">): LigneControleSceneIV {
  const details: string[] = [];
  for (const d of l.chiffresDits) {
    const ok = l.evenements.some((e) => e.visible && e.chiffres.includes(d.cle) && e.instantSec >= d.t - S.chiffreAvant - 1e-6 && e.instantSec <= d.t + S.chiffreApres + 1e-6);
    if (!ok) details.push(`le chiffre « ${d.brut} » est dit à ${sec(d.t)} (écran ${d.ecran}) mais n'apparaît pas à l'écran à ce moment-là.`);
  }
  return ligne("Q13", details, "Chaque chiffre dit apparaît sur son mot.", "Chiffre dit mais pas montré :");
}

/* ------------------------------------------------------------------ */
/* Q15 · Caméra, lisibilité, vue d'ensemble                              */
/* ------------------------------------------------------------------ */

/** Une séquence de toile telle que la caméra la filme. */
export interface SequenceCameraIV {
  id: string;
  toile: DispositionToile;
  trajectoire: TrajectoireCamera;
  mots: readonly MotParle[];
  cadrage?: CadrageCamera;
}

/** Q15 (et texte coupé, Q23) sur une séquence : vitesse, zoom, nœud parlé dans le cadre, taille effective ≥ plancher. */
export function controlerCamera(s: SequenceCameraIV): { q15: string[]; coupes: string[] } {
  const q15: string[] = [];
  const m = mesurerTrajectoire(s.trajectoire);
  if (m.vitesseMax > BORNES_CAMERA.vitesseMax + 1e-3) q15.push(`la caméra va trop vite (${m.vitesseMax.toFixed(2).replace(".", ",")} écran/s, 1,2 au plus).`);
  if (m.zoomMin < BORNES_CAMERA.zoomMin - 1e-6 || m.zoomMax > BORNES_CAMERA.zoomMax + 1e-6) q15.push(`le zoom sort des bornes 0,8-1,6.`);
  // Un retard d'arrivée n'est qu'une indication : ce qui compte est que le bloc soit entier dans le cadre sur son mot.
  for (const a of s.trajectoire.alertes) if (!/trop tard/.test(a)) q15.push(a);
  const parId = new Map(s.toile.boites.map((b) => [b.id, b]));
  // Plusieurs mots au même instant : la caméra cadre le dernier (ordre de `trajectoireCamera` : heure, puis bloc) ; les
  // autres blocs de cet instant doivent être entiers OU hors du cadre, jamais coupés.
  const suite = [...s.mots].filter((m) => parId.has(m.noeud)).sort((a, b) => a.t - b.t || a.noeud.localeCompare(b.noeud));
  suite.forEach((mot, i) => {
    const etat = etatDansCadre(emprise(parId.get(mot.noeud)!, s.cadrage), cameraA(s.trajectoire, mot.t), s.cadrage);
    const cadre = !(suite[i + 1] && Math.abs(suite[i + 1].t - mot.t) < 1e-9 && suite[i + 1].noeud !== mot.noeud);
    if (cadre ? etat !== "entier" : etat === "coupe") q15.push(`au mot du bloc ${mot.noeud} (${sec(mot.t)}), le bloc n'est pas entier dans le cadre.`);
  });
  const lisibilite = controlerLisibiliteToile(s.toile, s.trajectoire);
  const vus = new Set<string>();
  for (const d of lisibilite) {
    const cle = `${d.noeud}|${d.texte}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    q15.push(`« ${d.texte} » est lu trop petit à ${sec(d.t)} (taille × zoom sous le plancher de la charte).`);
  }
  const coupes = controlerCadrage(s.toile, s.trajectoire, s.mots, s.cadrage).map((d) => `à ${sec(d.t)}, le bloc ${d.id} est coupé par le bord de l'écran.`);
  return { q15: [...new Set(q15)].map((x) => `séquence ${s.id} : ${x}`), coupes: [...new Set(coupes)].map((x) => `séquence ${s.id} : ${x}`) };
}

/* ------------------------------------------------------------------ */
/* Contrôle d'ensemble                                                   */
/* ------------------------------------------------------------------ */

export function controlerMiseEnSceneIV(l: LigneDeTempsIV, ctx: ContexteControleScene): RapportMiseEnSceneIV {
  const { carte, fiche } = ctx;
  const lignes: LigneControleSceneIV[] = [];
  const clesCarte = clesChiffresCarte(carte);

  lignes.push(controlerToutMontre(l, carte, clesCarte));
  lignes.push(controlerChiffresMontres(l));
  lignes.push(...controlerRythme(l));

  // Q15 · caméra et lisibilité sur chaque séquence de toile ; vue d'ensemble présente et lisible.
  const q15: string[] = [];
  const coupes: string[] = [];
  const toiles = l.blocs.filter((b): b is Extract<BlocRenduIV, { sorte: "toile" }> => b.sorte === "toile");
  for (const b of toiles) {
    const r = controlerCamera({ id: b.id, toile: b.toile, trajectoire: b.trajectoire, mots: b.proprietes.mots, cadrage: b.cadrage });
    q15.push(...r.q15);
    coupes.push(...r.coupes);
    for (const e of b.proprietes.ensembles ?? []) {
      const d = disposerEnsemble(b.toile, b.proprietes.schema, { allumes: e.allumes, chiffresCles: e.chiffresCles });
      q15.push(...controlerEnsemble(d).map((x) => `séquence ${b.id}, vue d'ensemble : ${x}`));
    }
  }
  const branches = carte.groupes.filter((g) => g.sorte === "branche").length;
  const ensembles = l.plans.filter((p) => p.sorte === "ensemble").length + toiles.reduce((n, b) => n + (b.proprietes.ensembles?.length ?? 0), 0);
  if ((branches >= 2 || fiche.chapitres.length > 0) && ensembles === 0) q15.push("aucune vue d'ensemble alors que l'image a des branches ou des chapitres.");
  lignes.push(ligne("Q15", q15, "Caméra dans ses bornes, textes lisibles, vue d'ensemble présente.", "Caméra ou lisibilité :"));

  // Q19 (ligne de temps) · la voix finit au moins 1,5 s avant la fin de la vidéo.
  const queue = l.dureeSec - l.finVoixSec;
  lignes.push(ligne("Q19", queue + 1e-6 >= S.queueMin ? [] : [`la voix finit ${sec(queue)} avant la fin de la vidéo (1,5 s au moins).`], "La voix finit avant la fin de la vidéo.", "Fin trop courte :"));

  // Q20 · bruitages : posés, un par changement visible, aucun silence total > 1,5 s, jamais de musique.
  const q20: string[] = [];
  if (!ctx.bruitages.ok) q20.push(`${ctx.bruitages.motif} : la vidéo ne peut pas partir muette.`);
  else {
    if (ctx.bruitages.rapport.changementsSansSon.length) q20.push(`${ctx.bruitages.rapport.changementsSansSon.length} changement(s) visible(s) sans son (${ctx.bruitages.rapport.changementsSansSon.slice(0, 3).join(", ")}).`);
    const silence = plusLongSilenceTotal(ctx.voix, ctx.bruitages.bruitages, l.finVoixSec);
    if (silence.duree > SILENCE_MAX_SEC + 1e-6) q20.push(`silence total de ${sec(silence.duree)} à partir de ${sec(silence.debut)} (1,5 s au plus).`);
  }
  lignes.push(ligne("Q20", q20, "Bruitages posés sur chaque changement, sans musique.", "Bruitages :"));

  // Q21 · textes : longueur tenable au plancher ; Q22 · sous-titres.
  const q21: string[] = [];
  for (const p of l.plans) for (const t of p.textes) if (t.replace(/\*/g, "").length > S.signesMax) q21.push(`« ${t.replace(/\*/g, "")} » (plan ${p.id}) est trop long pour rester lisible.`);
  for (const b of toiles) for (const e of b.proprietes.ensembles ?? []) q21.push(...debordementsEnsemble(planEnsemble(b.proprietes.schema, { allumes: e.allumes, chiffresCles: e.chiffresCles })).map((x) => `séquence ${b.id}, vue d'ensemble : ${x}`));
  lignes.push(ligne("Q21", q21, "Textes d'écran lisibles.", "Texte trop long :"));
  // Q22 : la bande, puis CHAQUE groupe tel que la composition le dessine (variations Impact / Bandeau comprises), mesuré.
  const q22 = [...controlerSousTitresIV(l.sousTitres, ctx.reseaux), ...controlerVariationsIV(sousTitresVariesIV(l), l)];
  lignes.push(ligne("Q22", q22, "Sous-titres et leurs variations dans leur bande, sous le contenu, hors des zones masquées des réseaux.", "Sous-titres mal placés :"));

  // Q23 · défauts visibles : texte coupé, écran vide, même texte deux plans de suite.
  const q23 = [...coupes];
  l.plans.forEach((p, k) => {
    const avant = l.plans[k - 1];
    if (p.sorte === "emotion" && p.textes.length === 0) q23.push(`le plan ${p.id} (${p.ecran}) n'affiche rien.`);
    if (avant && p.textes.length && avant.textes.length && p.textes.join("|") === avant.textes.join("|") && p.coupe !== "sous-plan" && p.ecran !== avant.ecran) q23.push(`les plans ${avant.id} et ${p.id} affichent le même texte.`);
  });
  lignes.push(ligne("Q23", q23, "Aucun défaut visible.", "Défaut visible :"));

  // Q25 · la marque sur chaque plan.
  lignes.push(ligne("Q25", l.plans.filter((p) => p.marque !== "axion-ia.com").map((p) => `le plan ${p.id} n'a pas la marque.`), "« axion-ia.com » visible sur chaque plan.", "Marque absente :"));

  // Fonds : les deux fonds alternent ; bandeau et phrase-choc sur fond sombre.
  const fond: string[] = [];
  if (new Set(l.plans.map((p) => p.fond)).size < 2) fond.push("un seul fond de bout en bout : les fonds sombre et ivoire doivent alterner.");
  for (const p of l.plans) if ((p.scene === "bandeau-chiffres" || p.scene === "phrase-choc") && p.fond !== "sombre") fond.push(`le plan ${p.id} (${p.scene}) doit être sur fond sombre.`);
  lignes.push(ligne("FOND", fond, "Fonds sombre et ivoire alternés.", "Fonds :"));

  // Un seul mot orange par plan.
  lignes.push(ligne("ORANGE", l.plans.filter((p) => p.textes.reduce((n, t) => n + (t.match(/\*[^*]+\*/g)?.length ?? 0), 0) > 1).map((p) => `le plan ${p.id} a plus d'un mot orange.`), "Un mot orange au plus par plan.", "Mot orange :"));

  // Segment de fin : question dite quand la fin en porte une ; LinkedIn dit la fin comme les autres depuis le 26/10/2026.
  // Seule une version muette d'AVANT (LinkedIn seul) n'a rien après la phrase-choc.
  const finPlans = l.plans.filter((p) => p.partie === "fin");
  const fin: string[] = [];
  if (l.segmentFin.muet && finPlans.length) fin.push("la version LinkedIn montre une fin : rien ne doit suivre la phrase-choc.");
  if (l.segmentFin.muet && l.reseaux.some((r) => r !== "linkedin")) fin.push(`une version sans fin vise ${l.reseaux.filter((r) => r !== "linkedin").join(", ")}.`);
  if (l.segmentFin.question && !finPlans.some((p) => p.scene === "question")) fin.push("la question de commentaire n'est pas à l'écran.");
  if (l.segmentFin.question && finPlans.length && finPlans[0].scene !== "question") fin.push("la question de commentaire doit ouvrir le segment de fin.");
  lignes.push(ligne("FIN", fin, "Segment de fin conforme au réseau.", "Segment de fin :"));

  return { lignes, bloquants: lignes.filter((x) => x.bloquant && !x.ok), rythme: mesurerRythme(l.evenements, l.finVoixSec, l.plans) };
}

/** Plus long intervalle sans voix ni bruitage, de 0 à la fin de la voix. */
export function plusLongSilenceTotal(voix: readonly MotHorodate[], sons: readonly { debutSec: number; dureeSec: number }[], finVoixSec: number): { debut: number; duree: number } {
  const occupes = [...voix.map((m) => [m.debutSec, m.finSec] as const), ...sons.map((s) => [s.debutSec, s.debutSec + s.dureeSec] as const)].sort((a, b) => a[0] - b[0]);
  let t = 0;
  let meilleur = { debut: 0, duree: 0 };
  for (const [a, b] of occupes) {
    if (a > t && a - t > meilleur.duree) meilleur = { debut: t, duree: a - t };
    t = Math.max(t, b);
    if (t >= finVoixSec) break;
  }
  if (finVoixSec > t && finVoixSec - t > meilleur.duree) meilleur = { debut: t, duree: finVoixSec - t };
  return { debut: Math.round(meilleur.debut * 1000) / 1000, duree: Math.round(meilleur.duree * 1000) / 1000 };
}

/* ------------------------------------------------------------------ */
/* Clés des chiffres (lecture commune à la mise en scène)                */
/* ------------------------------------------------------------------ */

/** Clé d'un chiffre : « valeur|unité », ou « plage|écriture » (« 24h/24 »). Même clé que les règles de L6. */
export function cleChiffre(c: { valeur: number | null; unite: string; brut: string }): string {
  return c.valeur === null ? `plage|${c.brut.replace(/\s+/g, "").toLowerCase()}` : `${c.valeur}|${c.unite}`;
}

/** Clés des chiffres écrits dans un texte d'écran. */
export function clesDuTexte(t: string): string[] {
  return chiffresDuTexte(t.replace(/\*/g, "")).map(cleChiffre);
}

/** Clé de chaque chiffre de la carte. */
export function clesDeLaCarte(carte: Pick<CarteImage, "chiffres">): Map<string, string> {
  return new Map(
    carte.chiffres.map((c) => [c.id, c.valeur === null ? cleChiffre(chiffresDuTexte(c.brut)[0] ?? { valeur: null, unite: c.unite, brut: c.brut }) : cleChiffre({ valeur: c.valeur, unite: c.unite, brut: c.brut })]),
  );
}

const clesChiffresCarte = clesDeLaCarte;
