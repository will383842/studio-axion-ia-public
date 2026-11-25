/**
 * CONTRÔLE OBJECTIF GRATUIT DE LA VIDÉO LONGUE SANS VOIX (lot QUALL-4, temps A) : PUR, sans IA, sans réseau.
 * Il échantillonne le story-board toutes les 250 ms avec la mise en page INJECTÉE (vraie ou factice) et note la vidéo.
 * Chemins RELATIFS seulement (lu par le moteur et, au besoin, par Remotion) : jamais d'import « @/ ».
 */
import {
  COULEURS_LONGUE,
  TAILLES_LONGUE,
  TEMPS_LONGUE,
  ZONES_LONGUE,
  type AlerteControleLongue,
  type CodeControleLongue,
  type ControleLongue,
  type ControlerStoryboard,
  type CritereLongue,
  type ElementPose,
  type Rect,
  type SceneLongue,
  type StoryboardVideoLongue,
} from "./storyboard-types";

export const PAS_CONTROLE_MS = 250;
/** Une scène plus longue que cela doit encore apparaître quelque chose dans ses 8 dernières secondes. */
const FIGEE_SCENE_MS = 12_000;
const FIGEE_DERNIERE_MS = 8000;
const MONOTONIE_SUITE = 4;
const MOTS_PAR_SECONDE_MAX = 3.5;
const RATIO_HIERARCHIE = 1.3;
const OPACITE_CONTENU = 0.5;
/** Préfixe du message « lecture trop rapide » (sert à `controle-alertes.ts` pour choisir le code `vitesse-lecture`). */
export const PREFIXE_VITESSE_LECTURE = "Lecture trop rapide";

const CRITERES: CritereLongue[] = ["lisibilite", "collisions", "remplissage", "hierarchie", "charte", "mouvement", "rythme", "chapitres", "fin"];
const CRITERE_DU_CODE: Record<CodeControleLongue, CritereLongue> = {
  "image-vide": "remplissage",
  "texte-trop-petit": "lisibilite",
  "sous-titre-illisible": "lisibilite",
  "sur-la-bande": "collisions",
  chevauchement: "collisions",
  "hors-cadre": "collisions",
  "sans-hierarchie": "hierarchie",
  "couleur-hors-charte": "charte",
  "scene-figee": "mouvement",
  monotonie: "rythme",
  "chapitre-court": "chapitres",
  "titre-generique": "chapitres",
  "carton-absent": "chapitres",
  "fin-absente": "fin",
};
const GRAVITE_DU_CODE: Record<CodeControleLongue, AlerteControleLongue["gravite"]> = {
  "image-vide": "grave",
  "texte-trop-petit": "grave",
  "sous-titre-illisible": "grave",
  "sur-la-bande": "grave",
  chevauchement: "grave",
  "hors-cadre": "grave",
  "sans-hierarchie": "moyenne",
  "couleur-hors-charte": "moyenne",
  "scene-figee": "moyenne",
  monotonie: "moyenne",
  "chapitre-court": "moyenne",
  "titre-generique": "moyenne",
  "carton-absent": "moyenne",
  "fin-absente": "grave",
};
const PENALITE = { grave: 3, moyenne: 1, info: 0 } as const;
const COULEURS_CONNUES = new Set<string>(Object.keys(COULEURS_LONGUE));

/** Vrai si les deux rectangles se recouvrent sur une surface (les simples contacts de bord ne comptent pas). */
function seRecouvrent(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.largeur - 0.5 && b.x < a.x + a.largeur - 0.5 && a.y < b.y + b.hauteur - 0.5 && b.y < a.y + a.hauteur - 0.5;
}
function dedans(petit: Rect, grand: Rect): boolean {
  return petit.x >= grand.x - 1 && petit.y >= grand.y - 1 && petit.x + petit.largeur <= grand.x + grand.largeur + 1 && petit.y + petit.hauteur <= grand.y + grand.hauteur + 1;
}
const aLaBande = (s: SceneLongue) => s.type !== "carton-titre" && s.type !== "carton-chapitre" && s.type !== "fin";
const estCarton = (s: SceneLongue) => !aLaBande(s);
const secondes = (ms: number) => `${(ms / 1000).toFixed(2).replace(/\.?0+$/, "")} s`;

/** Instant de la dernière apparition d'un élément dans la scène (son début si rien ne vient après). */
function derniereApparitionMs(s: SceneLongue): number {
  let dernier = s.debutMs;
  if (s.type === "liste" || s.type === "etapes") for (const e of s.elements) dernier = Math.max(dernier, e.apparitionMs);
  else if (s.type === "chiffre") for (const c of s.chiffres) dernier = Math.max(dernier, c.apparitionMs);
  else if (s.type === "avant-apres") dernier = Math.max(dernier, s.apparitionApresMs);
  return dernier;
}

export const controlerStoryboard: ControlerStoryboard = (sb: StoryboardVideoLongue, poser): ControleLongue => {
  const alertes: AlerteControleLongue[] = [];
  const vues = new Set<string>();
  const ajouter = (code: CodeControleLongue, message: string, extra: { instantMs?: number; sceneId?: string; cle?: string } = {}) => {
    const cle = `${code}|${extra.sceneId ?? ""}|${extra.cle ?? ""}`;
    if (vues.has(cle)) return;
    vues.add(cle);
    const a: AlerteControleLongue = { code, critere: CRITERE_DU_CODE[code], gravite: GRAVITE_DU_CODE[code], message };
    if (extra.instantMs !== undefined) a.instantMs = extra.instantMs;
    if (extra.sceneId !== undefined) a.sceneId = extra.sceneId;
    alertes.push(a);
  };

  const scenes = sb.scenes;
  const sceneA = (t: number) => scenes.find((s) => t >= s.debutMs && t < s.finMs);

  /* --- Rythme du découpage : trous entre scènes, fin, monotonie, figées --- */
  let curseur = 0;
  for (const s of scenes) {
    if (s.debutMs - curseur > TEMPS_LONGUE.videMaxMs) ajouter("image-vide", `Trou de ${secondes(s.debutMs - curseur)} sans scène (avant « ${s.id} »).`, { instantMs: curseur, cle: `trou-${curseur}` });
    curseur = Math.max(curseur, s.finMs);
  }
  if (sb.dureeMs - curseur > TEMPS_LONGUE.videMaxMs) ajouter("image-vide", `Fin de la vidéo sans scène pendant ${secondes(sb.dureeMs - curseur)}.`, { instantMs: curseur, cle: "trou-fin" });
  if (scenes.length === 0) ajouter("image-vide", "Aucune scène.", { instantMs: 0, cle: "aucune" });

  const fin = scenes.find((s) => s.type === "fin");
  if (!fin) ajouter("fin-absente", "Aucune carte de fin « Prendre rendez-vous ».");
  else {
    if (scenes[scenes.length - 1] !== fin) ajouter("fin-absente", "La carte de fin n'est pas la dernière scène.", { sceneId: fin.id, instantMs: fin.debutMs });
    if (fin.finMs - fin.debutMs < 4000) ajouter("fin-absente", `La carte de fin ne dure que ${secondes(fin.finMs - fin.debutMs)} (4 s au moins).`, { sceneId: fin.id, instantMs: fin.debutMs });
  }

  let suite = 0;
  scenes.forEach((s, i) => {
    suite = i > 0 && scenes[i - 1].type === s.type ? suite + 1 : 1;
    if (suite === MONOTONIE_SUITE) ajouter("monotonie", `${MONOTONIE_SUITE} scènes « ${s.type} » de suite.`, { sceneId: s.id, instantMs: s.debutMs });
    if (s.finMs - s.debutMs > FIGEE_SCENE_MS && s.finMs - derniereApparitionMs(s) > FIGEE_DERNIERE_MS)
      ajouter("scene-figee", `Scène figée : plus rien n'apparaît pendant ${secondes(s.finMs - derniereApparitionMs(s))}.`, { sceneId: s.id, instantMs: derniereApparitionMs(s) });
  });

  /* --- Chapitres --- */
  const cartonsTitre = scenes.filter((s) => s.type === "carton-titre");
  if (sb.question && sb.question.trim() && cartonsTitre.length === 0) ajouter("carton-absent", "La question n'a pas de carton de titre.", { instantMs: 0, cle: "question" });
  for (const c of sb.chapitres) {
    if (c.finMs - c.debutMs < TEMPS_LONGUE.chapitreMinMs) ajouter("chapitre-court", `Chapitre ${c.rang} de ${secondes(c.finMs - c.debutMs)} (10 s au moins).`, { instantMs: c.debutMs, cle: c.id });
    if (!c.titre.trim() || /^chapitre\s*\d+$/i.test(c.titre.trim())) ajouter("titre-generique", `Chapitre ${c.rang} sans vrai titre (« ${c.titre.trim()} »).`, { instantMs: c.debutMs, cle: c.id });
    if (!scenes.some((s) => s.type === "carton-chapitre" && s.chapitreId === c.id)) ajouter("carton-absent", `Chapitre ${c.rang} sans carton de chapitre.`, { instantMs: c.debutMs, cle: c.id });
  }

  /* --- Échantillonnage des scènes --- */
  let videDepuis: number | null = null;
  let videSignale = false;
  const meilleurHierarchie = new Map<string, number[]>();
  for (let t = 0; t < sb.dureeMs; t += PAS_CONTROLE_MS) {
    const s = sceneA(t);
    if (!s) {
      videDepuis = null;
      videSignale = false;
      continue;
    }
    const elements = poser.scene(s, t);
    const visibles = elements.filter((e) => e.opacite > 0);

    // Image vide : plus de 1 s sans contenu opaque à moitié.
    if (elements.some((e) => e.role === "contenu" && e.opacite >= OPACITE_CONTENU)) {
      videDepuis = null;
      videSignale = false;
    } else {
      videDepuis ??= t;
      if (!videSignale && t + PAS_CONTROLE_MS - videDepuis > TEMPS_LONGUE.videMaxMs) {
        videSignale = true;
        ajouter("image-vide", `Plus aucun contenu à l'écran depuis ${secondes(videDepuis)} (scène « ${s.id} »).`, { instantMs: videDepuis, sceneId: s.id, cle: String(videDepuis) });
      }
    }

    const zone: Rect = aLaBande(s) ? ZONES_LONGUE.scene : ZONES_LONGUE.plein;
    for (const e of visibles) {
      if (e.nature === "texte" && e.taillePx !== undefined) {
        const plancher = e.role === "etiquette" ? TAILLES_LONGUE.etiquetteMinPx : e.role === "contenu" ? TAILLES_LONGUE.texteMinPx : 0;
        if (e.taillePx < plancher) ajouter("texte-trop-petit", `Texte de ${e.taillePx} px (plancher ${plancher} px) : « ${e.id} ».`, { instantMs: t, sceneId: s.id, cle: e.id });
      }
      if (aLaBande(s) && e.nature !== "volet" && seRecouvrent(e.rect, ZONES_LONGUE.bandeSousTitres))
        ajouter("sur-la-bande", `« ${e.id} » touche la bande des sous-titres.`, { instantMs: t, sceneId: s.id, cle: e.id });
      if (e.role !== "decor" && !dedans(e.rect, zone)) ajouter("hors-cadre", `« ${e.id} » sort de la zone de la scène.`, { instantMs: t, sceneId: s.id, cle: e.id });
      for (const c of [e.couleur, e.couleurAccent, e.fond, e.bordure]) {
        if (c !== undefined && !COULEURS_CONNUES.has(c)) ajouter("couleur-hors-charte", `Couleur « ${c} » hors de la charte (« ${e.id} »).`, { instantMs: t, sceneId: s.id, cle: `${e.id}-${c}` });
      }
      if (s.fond === "ivoire" && [e.couleur, e.couleurAccent].some((c) => c === "orange" || c === "grisSurNoir"))
        ajouter("couleur-hors-charte", `Orange ou gris sur noir utilisé sur fond ivoire (« ${e.id} »).`, { instantMs: t, sceneId: s.id, cle: `${e.id}-fond` });
    }
    const comparables = visibles.filter((e) => e.role !== "decor" && e.nature !== "volet" && e.nature !== "trait");
    for (let i = 0; i < comparables.length; i++)
      for (let j = i + 1; j < comparables.length; j++) {
        const a: ElementPose = comparables[i];
        const b: ElementPose = comparables[j];
        if (a.dans === b.id || b.dans === a.id) continue;
        if (seRecouvrent(a.rect, b.rect)) ajouter("chevauchement", `« ${a.id} » et « ${b.id} » se recouvrent.`, { instantMs: t, sceneId: s.id, cle: `${a.id}-${b.id}` });
      }
    // Hiérarchie : tailles des textes de contenu au moment où il y en a le plus.
    if (s.type !== "carton-titre" && s.type !== "carton-chapitre" && s.type !== "fin") {
      const tailles = elements.filter((e) => e.nature === "texte" && e.role === "contenu" && e.opacite >= OPACITE_CONTENU && e.taillePx !== undefined).map((e) => e.taillePx as number);
      if (tailles.length >= (meilleurHierarchie.get(s.id)?.length ?? 0)) meilleurHierarchie.set(s.id, tailles);
    }
  }
  for (const [id, tailles] of meilleurHierarchie)
    if (tailles.length >= 2 && Math.max(...tailles) < RATIO_HIERARCHIE * Math.min(...tailles))
      ajouter("sans-hierarchie", `Scène « ${id} » : aucun texte n'est ${RATIO_HIERARCHIE} fois plus grand que le plus petit.`, { sceneId: id, instantMs: scenes.find((s) => s.id === id)?.debutMs });

  /* --- Sous-titres --- */
  for (const l of sb.sousTitres) {
    const duree = l.finMs - l.debutMs;
    const mots = l.texte.trim().split(/\s+/).filter(Boolean).length;
    if (duree < TEMPS_LONGUE.sousTitreMinMs) ajouter("sous-titre-illisible", `Sous-titre affiché ${secondes(duree)} seulement (${secondes(TEMPS_LONGUE.sousTitreMinMs)} au moins).`, { instantMs: l.debutMs, cle: String(l.debutMs) });
    else if (mots / (duree / 1000) > MOTS_PAR_SECONDE_MAX) ajouter("sous-titre-illisible", `${PREFIXE_VITESSE_LECTURE} : ${mots} mots en ${secondes(duree)}.`, { instantMs: l.debutMs, cle: String(l.debutMs) });
    for (let t = l.debutMs; t < l.finMs; t += PAS_CONTROLE_MS) {
      const s = sceneA(t);
      if (s && estCarton(s)) ajouter("sur-la-bande", `Sous-titre pendant ${s.type === "fin" ? "la fin" : "un carton"} (« ${s.id} »).`, { instantMs: t, sceneId: s.id, cle: String(l.debutMs) });
    }
    const e = poser.sousTitre(l, Math.min(l.finMs - 1, l.debutMs + Math.floor(duree / 2)));
    if (!e) continue;
    const cle = String(l.debutMs);
    if ((e.lignes?.length ?? 0) > TAILLES_LONGUE.sousTitreLignesMax) ajouter("sous-titre-illisible", `Sous-titre sur ${e.lignes?.length} lignes (${TAILLES_LONGUE.sousTitreLignesMax} au plus).`, { instantMs: l.debutMs, cle });
    if (e.taillePx !== undefined && e.taillePx < TAILLES_LONGUE.texteMinPx) ajouter("texte-trop-petit", `Sous-titre de ${e.taillePx} px (plancher ${TAILLES_LONGUE.texteMinPx} px).`, { instantMs: l.debutMs, cle: `st-${cle}` });
    if (!dedans(e.rect, ZONES_LONGUE.bandeSousTitres)) ajouter("hors-cadre", "Sous-titre hors de la bande des sous-titres.", { instantMs: l.debutMs, cle: `st-${cle}` });
  }

  /* --- Notes --- */
  const criteres = Object.fromEntries(CRITERES.map((c) => [c, 10])) as Record<CritereLongue, number>;
  for (const a of alertes) criteres[a.critere] = Math.max(0, criteres[a.critere] - PENALITE[a.gravite]);
  const moyenne = CRITERES.reduce((somme, c) => somme + criteres[c], 0) / CRITERES.length;
  let note = Math.round(moyenne * 10);
  if (alertes.some((a) => a.gravite === "grave")) note = Math.min(note, 60);
  return { note, criteres, alertes };
};
