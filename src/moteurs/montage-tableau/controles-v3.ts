/**
 * CONTRÔLES PROPRES AU STYLE « reference/3 » (gabarit par parties, 14/10/2026). PURS. Chacun répond à un défaut vu par
 * Will sur le défilement de la vidéo v-f1739d6a4f51 :
 *
 * Sur la mise en page (avant la voix, dans chaque sortie) :
 *  - aucune page « problème » : aucune étiquette ni aucun titre « Le problème », « Le vrai problème » ;
 *  - chapitre nommé : chaque page est rattachée à un chapitre de la barre (l'exemple porte « Exemple illustratif ») ;
 *  - 3 blocs visibles au plus par page (une liste compte pour un) ;
 *  - page remplie et centrée : le contenu fini couvre au moins 60 % de la hauteur utile, centré à ±12 % du centre de la
 *    zone sûre ;
 *  - tailles minimales de la sortie (vertical : titre 76, phrase clé 72, détails et listes 52 px ; l'accroche 80) ;
 *  - visuels et peps (maquette validée le 15/10, PR #260) : un visuel de la banque fermée et un bloc orange au plus par
 *    page ; le visuel occupe 35 à 45 % de la largeur de référence, ne touche aucun texte (12 px d'air), ni la bande des
 *    sous-titres ; aucune couleur verte, bleue ou violette ; le visuel choisi par la fiche est bien dessiné.
 * Sur l'animation (après le calage, les heures de la vraie voix) :
 *  - accroche pleine à 0 s : la première image montre l'accroche entière (elle sert de miniature) ;
 *  - aucun bloc encore en écriture après la fin de sa phrase dite (0,15 s de tolérance) ;
 *  - aucune page vide : chaque page arrive avec au moins un bloc entier (étiquette mise à part) ;
 *  - titre jamais seul : le bloc qui suit le titre est là au plus 0,4 s après lui (la page attend que la voix le dise) ;
 *  - appel lisible : la page d'appel est entière à l'écran au moins 2,5 s avant la fin ;
 *  - appel à l'heure et animé : elle n'arrive pas avant que la voix commence sa phrase, et ne reste jamais immobile
 *    plus de 3 s (le crayon souligne l'appel, puis l'appel bat doucement).
 */
import { COULEURS_REFERENCE_3, MINIMUMS_GABARIT_3, RYTHME_REFERENCE_3, TAILLES_GABARIT_3, VISUELS_GABARIT_3, chapitresDesParties3, nomChapitre3 } from "@/briques/tableau-scene/reference/charte";
import { estIdVisuel3 } from "@/briques/tableau-scene/reference/visuels-3";
import { FONDU_SEC, immobileMax3, planPage3, suivantDuTitre, type Plan3 } from "@/briques/tableau-scene/reference/animation-3";
import type { PagePlacee as PagePlaceeBrique, ProprietesTableauScene } from "@/briques/tableau-scene/types";
import type { FauteReference } from "./controles-reference";
import type { ElementPlace, MiseEnPageTableau, RectPx } from "./mise-en-page";
import { idVisuel, type FicheTableau } from "./fiche";

const T = TAILLES_GABARIT_3;
/** Tolérance (s) sur la fin d'écriture d'un bloc, après la fin de sa phrase dite. */
export const RETARD_ECRITURE_MAX_SEC = 0.15;
/** Temps (ms) où la page d'appel doit être entière avant la fin de la vidéo. */
export const APPEL_LISIBLE_MIN_MS = 2500;
/** Une page ne reste jamais vide plus de… (ms), transition comprise. */
export const PAGE_VIDE_MAX_MS_3 = 400;
/** Un titre n'est jamais seul à l'écran plus de… (s) : la phrase qui le suit arrive avec lui. */
export const TITRE_SEUL_MAX_SEC = 0.4;
/** Trois styles du tableau : la phrase qui suit le titre commence à s'écrire au plus… (s) après lui. */
export const TITRE_SEUL_TABLEAU_MAX_SEC = 0.6;
/** La page d'appel n'arrive pas plus de… (ms) avant que la voix commence sa première phrase. */
export const APPEL_AVANCE_MAX_MS = 200;

const nom = (e: { lignes: { texte: string }[] }) => `« ${e.lignes.map((l) => l.texte).join(" ")} »`;

/** Les blocs visibles d'une page (une liste, un avant / après, la page d'appel comptent pour un). */
export function blocsDeLaPage(p: MiseEnPageTableau["pages"][number]): string[] {
  const res = new Set<string>();
  const etiquetes = new Set(p.elements.filter((e) => e.gabarit?.sorte === "avant-apres").map((e) => e.elementId.replace(/~etiquette$/, "")));
  for (const e of p.elements) {
    const g = e.gabarit?.sorte;
    // Le visuel dessiné (peps) accompagne les blocs, il n'en est pas un ; le bloc orange, lui, en est un.
    if (e.type === "dessin" || g === "partie" || g === "pastille" || g === "avant-apres" || g === "visuel") continue;
    if (g === "code" || g === "case" || g === "transformation") res.add(g);
    else if (etiquetes.has(e.elementId)) res.add("comparaison");
    else if (p.elements.some((x) => x.gabarit?.sorte === "appel-plein")) res.add("appel");
    else res.add(e.elementId);
  }
  return [...res];
}

/** Aucune étiquette ni aucun titre « problème ». */
export function pagesProbleme3(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) =>
    p.elements.filter((e) => (e.gabarit?.sorte === "partie" || e.gabarit?.sorte === "titre") && /probl[eè]me/iu.test(e.lignes.map((l) => l.texte).join(" "))).map((e) => ({ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} : le mot « problème » n'est jamais une étiquette ni un titre (la partie est « La douleur »)` })),
  );
}

/**
 * Chaque page est rattachée à un chapitre nommé de la barre (choix de Will du 15/10 : la barre des chapitres remplace
 * l'étiquette de partie) ; une page de l'exemple porte en plus le repère « Exemple illustratif ».
 */
export function etiquettesAbsentes3(mise: MiseEnPageTableau): FauteReference[] {
  const r = mise.styleReference;
  const roles = mise.pages.map((p) => r?.parties?.[p.page] ?? "");
  const chapitres = chapitresDesParties3(roles);
  return mise.pages.flatMap((p, i) => {
    const sceneId = p.elements[0]?.sceneId ?? "";
    if (!r?.barre || !r.nomsChapitres || !nomChapitre3(chapitres[i])) return [{ sceneId, message: `page ${p.page} : aucun chapitre nommé dans la barre` }];
    if (roles[i] === "exemple" && !p.elements.some((e) => e.gabarit?.sorte === "partie" && e.lignes[0]?.texte)) return [{ sceneId, message: `page ${p.page} : l'exemple n'est pas marqué « Exemple illustratif »` }];
    return [];
  });
}

/** 3 blocs visibles au plus. */
export function pagesChargees3(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) => {
    const n = blocsDeLaPage(p).length;
    return n > 3 ? [{ sceneId: p.elements.at(-1)?.sceneId ?? "", message: `page ${p.page} : ${n} blocs visibles (3 au plus)` }] : [];
  });
}

/**
 * Contenu d'une page, mesuré sur la page FINIE : le cadre englobant de son contenu (titre, phrase clé, visuel ; ni
 * le repère de partie), sa part de la HAUTEUR UTILE (sous l'en-tête, jusqu'au bas de la
 * zone sûre) et l'écart de son centre au centre de la zone sûre (en part de la hauteur de la zone sûre, + : plus bas).
 */
export function mesureContenu3(mise: MiseEnPageTableau, p: MiseEnPageTableau["pages"][number]): { couverture: number; ecartCentre: number } | null {
  const z = mise.zoneSure.px;
  // L'icône au trait (un dessin) est en tête du CONTENU (charte Axion, 15/10/2026) : seuls la barre des chapitres et le
  // repère « Exemple illustratif » sont à part.
  const tete = p.elements.filter((e) => e.gabarit?.sorte === "partie");
  const contenu = p.elements.filter((e) => !tete.includes(e) && (e.lignes.length || e.gabarit || e.type === "dessin"));
  if (!contenu.length) return null;
  const n = mise.styleReference?.nomsChapitres;
  const basTete = Math.max(z.y, n ? n.y + n.hauteur : z.y, ...tete.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur));
  const y0 = Math.min(...contenu.map((e) => e.encombrement.px.y));
  const y1 = Math.max(...contenu.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur));
  const utile = Math.max(1, z.y + z.hauteur - basTete);
  return { couverture: (y1 - y0) / utile, ecartCentre: ((y0 + y1) / 2 - (z.y + z.hauteur / 2)) / z.hauteur };
}

/**
 * Page remplie et centrée (15/10, « le bas des pages est vide ») : le contenu fini couvre au moins 60 % de la hauteur
 * utile, et son centre est à 12 % au plus du centre de la zone sûre.
 */
export function pagesVides3(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) => {
    const m = mesureContenu3(mise, p);
    const sceneId = p.elements.at(-1)?.sceneId ?? "";
    if (!m) return [{ sceneId, message: `page ${p.page} : aucun contenu sous l'étiquette` }];
    const fautes: FauteReference[] = [];
    if (m.couverture + 1e-6 < T.remplissageMin) fautes.push({ sceneId, message: `page ${p.page} : le contenu ne couvre que ${Math.round(m.couverture * 100)} % de la hauteur utile (au moins ${Math.round(T.remplissageMin * 100)} %)` });
    if (Math.abs(m.ecartCentre) > T.centreEcartMax + 1e-6) fautes.push({ sceneId, message: `page ${p.page} : le contenu est centré ${Math.round(Math.abs(m.ecartCentre) * 100)} % ${m.ecartCentre < 0 ? "au-dessus" : "au-dessous"} du centre de la zone sûre (${Math.round(T.centreEcartMax * 100)} % au plus)` });
    return fautes;
  });
}

/** Tailles jamais sous les minimums de la sortie (vertical : texte principal 72 px, détails 52 px). */
export function taillesTropPetites3(mise: MiseEnPageTableau): FauteReference[] {
  const M = MINIMUMS_GABARIT_3[mise.format && mise.format !== "vertical" ? mise.format : "vertical"];
  const min = (e: ElementPlace) => {
    const g = e.gabarit?.sorte;
    if (g === "accroche") return M.accroche;
    if (g === "titre") return M.titre;
    if (g === "phrase") return M.phrase;
    if (g === "appel-plein") return M.appel;
    if (g === "partie" || g === "avant-apres" || g === "pastille" || g === "bouton" || e.type === "dessin" || !e.lignes.length) return null;
    return Math.min(M.detail, M.item);
  };
  return mise.pages.flatMap((p) =>
    p.elements.flatMap((e) => {
      const m = min(e);
      return m !== null && (e.taillePx ?? 0) + 0.5 < m ? [{ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} est écrit en ${e.taillePx} px (au moins ${m})` }] : [];
    }),
  );
}

/**
 * Teinte d'une couleur « #RRGGBB » hors de la famille brun-orange (teintes 355° à 60°) et assez saturée pour se voir :
 * un vert, un bleu ou un violet (même règle que le contrôle des pixels des aperçus).
 */
export function couleurHorsFamille(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (d < 0.06 || mx < 0.15 || d / mx < 0.12) return false;
  const h = mx === r ? (60 * ((g - b) / d) + 360) % 360 : mx === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240;
  return h > 60 && h < 355;
}

/** Distance (px) entre deux rectangles (0 s'ils se touchent). */
const distanceRects = (a: RectPx, b: RectPx) => Math.hypot(Math.max(0, a.x - (b.x + b.largeur), b.x - (a.x + a.largeur)), Math.max(0, a.y - (b.y + b.hauteur), b.y - (a.y + a.hauteur)));

/**
 * VISUELS ET PEPS (maquette validée par Will le 15/10, PR #260), sur la page finie : un visuel de la banque fermée et
 * un bloc orange au plus par page ; le visuel (son encre, mouvements compris) occupe 35 à 45 % de la largeur de
 * référence, reste à 12 px au moins de tout texte (sa flèche aussi), au-dessus de la bande des sous-titres ; aucune
 * couleur d'élément verte, bleue ou violette.
 */
export function visuelsPeps3(mise: MiseEnPageTableau): FauteReference[] {
  const k = mise.styleReference?.k ?? 1;
  const bande = mise.bandeSousTitres.px;
  const res: FauteReference[] = [];
  const air = VISUELS_GABARIT_3.airMin - 0.5;
  for (const p of mise.pages) {
    const visuels = p.elements.filter((e) => e.gabarit?.sorte === "visuel");
    const blocs = p.elements.filter((e) => e.gabarit?.sorte === "bloc-orange");
    const sceneId = p.elements.at(-1)?.sceneId ?? "";
    if (visuels.length > 1) res.push({ sceneId, message: `page ${p.page} : ${visuels.length} visuels (un seul par page)` });
    if (blocs.length > 1) res.push({ sceneId, message: `page ${p.page} : ${blocs.length} blocs orange (un seul par page)` });
    for (const b of blocs) if (b.gabarit?.sorte === "bloc-orange" && (b.gabarit.fond !== COULEURS_REFERENCE_3.accent || b.couleurTexte !== COULEURS_REFERENCE_3.fond)) res.push({ sceneId: b.sceneId, message: `page ${p.page} : le bloc orange n'est pas orange plein (${b.gabarit.fond}) à texte ivoire (${b.couleurTexte})` });
    const textes = p.elements.filter((e) => e.gabarit?.sorte !== "visuel").flatMap((e) => e.lignes.map((l) => ({ e, r: l.px })));
    for (const v of visuels) {
      const g = v.gabarit;
      if (g?.sorte !== "visuel") continue;
      if (!estIdVisuel3(g.id)) res.push({ sceneId: v.sceneId, message: `page ${p.page} : le visuel « ${g.id} » n'est pas dans la banque` });
      const part = g.encre.largeur / (1080 * k);
      if (part < VISUELS_GABARIT_3.partMin - 0.005 || part > VISUELS_GABARIT_3.partMax + 0.005) res.push({ sceneId: v.sceneId, message: `page ${p.page} : le visuel « ${g.id} » occupe ${Math.round(part * 100)} % de la largeur (35 à 45 %)` });
      for (const x of textes) {
        const d = distanceRects(g.encre, x.r);
        if (d < air) res.push({ sceneId: v.sceneId, message: `page ${p.page} : le visuel « ${g.id} » est à ${Math.max(0, Math.round(d))} px de ${nom(x.e)} (12 px au moins)` });
      }
      if (g.encre.y + g.encre.hauteur > bande.y) res.push({ sceneId: v.sceneId, message: `page ${p.page} : le visuel « ${g.id} » entre dans la bande des sous-titres` });
      for (const q of [...(g.fleche?.corps ?? []), ...(g.fleche?.tete ?? [])]) {
        const proche = textes.find((x) => distanceRects({ x: q.x, y: q.y, largeur: 0, hauteur: 0 }, x.r) < air);
        if (proche) {
          res.push({ sceneId: v.sceneId, message: `page ${p.page} : la flèche vers le visuel touche ${nom(proche.e)}` });
          break;
        }
        if (q.y > bande.y) {
          res.push({ sceneId: v.sceneId, message: `page ${p.page} : la flèche vers le visuel entre dans la bande des sous-titres` });
          break;
        }
      }
    }
    for (const e of p.elements) {
      const g = e.gabarit as Record<string, unknown> | undefined;
      const couleurs = [e.couleurTexte, e.couleurFond, e.couleurMarque, g?.couleur, g?.fond, g?.couleurPoint].filter((c): c is string => typeof c === "string");
      for (const c of couleurs) if (couleurHorsFamille(c)) res.push({ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} prend la couleur ${c} (ni vert, ni bleu, ni violet)` });
    }
  }
  return res;
}

/** Chaque visuel choisi par la fiche est dessiné (une page trop pleine le laisse de côté plutôt que de casser). */
export function visuelsNonDessines3(fiche: FicheTableau, mise: MiseEnPageTableau): FauteReference[] {
  const poses = new Set(mise.pages.flatMap((p) => p.elements.map((e) => e.elementId)));
  return fiche.scenes.filter((s) => s.gabarit?.visuel && !poses.has(idVisuel(s.id))).map((s) => ({ sceneId: s.id, message: `page ${s.page} : le visuel « ${s.gabarit!.visuel!.id} » ne tient pas sur la page, il n'est pas dessiné` }));
}

/**
 * Trois styles du tableau : combien de temps (s) le titre de la page reste seul, de la fin de son écriture (ou de la
 * transition) au premier trait du bloc qui le suit (ses satellites compris : étiquette, petit dessin). `null` : pas de
 * titre, ou rien après lui. Mesure commune au contrôle « Titre jamais seul » et au plan de l'outil (`planPage3`, qui
 * écrit le titre au rythme de la voix et avance la phrase suivante pour la tenir sous `TITRE_SEUL_TABLEAU_MAX_SEC`).
 */
export function titreSeulSec(plan: Pick<Plan3, "actions" | "finTransition">, page: Pick<PagePlaceeBrique, "elements">): { seul: number; titre: string; suivant: string } | null {
  const titre = page.elements.find((e) => e.gabarit?.sorte === "titre");
  const debut = (id: string) => Math.min(...plan.actions.filter((a) => a.id === id || a.id.startsWith(`${id}~`)).map((a) => a.debut));
  const suivant = titre && suivantDuTitre(page.elements, titre, (e) => debut(e.elementId));
  if (!titre || !suivant || !Number.isFinite(debut(suivant.elementId))) return null;
  const finTitre = Math.max(...plan.actions.filter((a) => a.id === titre.elementId).map((a) => a.debut + a.duree), plan.finTransition);
  return { seul: debut(suivant.elementId) - finTitre, titre: titre.elementId, suivant: suivant.elementId };
}

/** Une faute d'animation (scène, message). */
export type FauteAnimation = FauteReference;

/**
 * Contrôles de l'animation d'une vidéo « reference/3 » (toutes ses scènes, dans l'ordre) : accroche pleine à 0 s, blocs
 * écrits à l'heure, aucune page vide, titre jamais seul, appel lisible, appel à l'heure et animé. Rend chaque contrôle avec ses fautes (vide : réussi).
 */
export function controlerAnimation3(props: readonly ProprietesTableauScene[]): { libelle: string; fautes: FauteAnimation[] }[] {
  const ref = props.filter((p) => p.styleReference?.style === "reference/3");
  if (!ref.length) return [];
  const premiere = ref[0];
  const accroche: FauteAnimation[] = [];
  const p1 = premiere.page.elements.find((e) => e.gabarit?.sorte === "accroche");
  if (!p1) accroche.push({ sceneId: premiere.scene.id, message: "la page 1 n'a pas d'accroche écrite en grand" });
  else if (!premiere.styleReference!.poses?.includes(p1.elementId) || premiere.scene.debutMs > 0) accroche.push({ sceneId: premiere.scene.id, message: `l'accroche ${nom(p1)} n'est pas entière à la première image` });
  const ecriture: FauteAnimation[] = [];
  const vides: FauteAnimation[] = [];
  const titreSeul: FauteAnimation[] = [];
  const vues = new Set<number>();
  for (const p of ref) {
    if (vues.has(p.page.page)) continue;
    vues.add(p.page.page);
    const r = p.styleReference!;
    const plan = planPage3(p.page, r, { largeur: p.largeur, hauteur: p.hauteur });
    for (const a of plan.actions) {
      if (a.trace !== "ecrire") continue;
      // Trois styles : le titre s'écrit d'un trait dès la fin de l'effacement (critique #291, I2), au plus tôt possible.
      if (r.tableau && p.page.elements.find((x) => x.elementId === a.id)?.gabarit?.sorte === "titre" && Math.min(...plan.actions.filter((x) => x.id === a.id).map((x) => x.debut)) <= plan.finTransition + 0.05) continue;
      const fin = r.temps3?.[`${a.id}~fin`];
      // Trois styles : un bloc dit pendant que la page tourne (la page arrive 0,35 s après sa coupe, puis 0,4 s de
      // transition) ne peut pas être là avant elle ; il est à l'heure s'il est entier juste à la fin de la transition.
      const auPlusTot = r.tableau ? plan.finTransition + FONDU_SEC + RETARD_ECRITURE_MAX_SEC : -Infinity;
      if (fin !== undefined && a.debut + a.duree > Math.max(fin / 1000 + RETARD_ECRITURE_MAX_SEC, auPlusTot)) {
        const e = p.page.elements.find((x) => x.elementId === a.id);
        ecriture.push({ sceneId: e?.sceneId ?? p.scene.id, message: `page ${p.page.page} : ${e ? nom(e) : a.id} finit de s'écrire ${(a.debut + a.duree - fin / 1000).toFixed(2).replace(".", ",")} s après la fin de sa phrase dite` });
      }
    }
    const titre = p.page.elements.find((e) => e.gabarit?.sorte === "titre");
    if (r.tableau) {
      // Trois styles du tableau (critique #291, I2) : rien d'autre que le repère et le numéro n'arrive avec la page ;
      // l'outil écrit dès la fin de l'effacement (jamais une page vide), le titre vite, puis la phrase qui le suit sans
      // attendre (le titre n'est jamais seul).
      const traces = plan.actions.filter((a) => a.duree > 0 || a.fondu);
      const premier = Math.min(...traces.map((a) => a.debut));
      if (plan.debutPage > 0.01 && !plan.poses.size && !(premier - plan.finTransition <= PAGE_VIDE_MAX_MS_3 / 1000 + 0.1)) vides.push({ sceneId: p.scene.id, message: `page ${p.page.page} : l'outil n'écrit rien pendant ${Number.isFinite(premier) ? (premier - plan.finTransition).toFixed(1).replace(".", ",") : "toute la page"} s après l'effacement` });
      const m = titreSeulSec(plan, p.page);
      if (m && m.seul > TITRE_SEUL_TABLEAU_MAX_SEC) {
        const t = p.page.elements.find((e) => e.elementId === m.titre)!;
        const sv = p.page.elements.find((e) => e.elementId === m.suivant)!;
        titreSeul.push({ sceneId: p.scene.id, message: `page ${p.page.page} : le titre ${nom(t)} reste seul ${m.seul.toFixed(1).replace(".", ",")} s avant que ${nom(sv)} commence à s'écrire` });
      }
      continue;
    }
    // Titre jamais seul : le premier bloc qui suit le titre est là (posé, ou fini d'écrire) au plus 0,4 s après lui.
    if (titre) {
      const suivant = p.page.elements.filter((e) => e.type !== "dessin" && e.lignes.length && !["partie", "titre", "pastille", "etiquette"].includes(e.gabarit?.sorte ?? "")).sort((a, b) => a.ordre - b.ordre)[0];
      if (suivant && !(r.poses ?? []).includes(suivant.elementId)) {
        const fin = Math.max(...plan.actions.filter((a) => a.id === suivant.elementId && a.trace === "ecrire").map((a) => a.debut + a.duree), plan.finTransition);
        const seul = fin - plan.finTransition;
        if (seul > TITRE_SEUL_MAX_SEC) titreSeul.push({ sceneId: p.scene.id, message: `page ${p.page.page} : le titre ${nom(titre)} est seul ${seul.toFixed(1).replace(".", ",")} s avant ${nom(suivant)}` });
      }
    }
    // Un bloc entier dès l'arrivée de la page (l'étiquette ne compte pas).
    const contenus = p.page.elements.filter((e) => e.type !== "dessin" && e.gabarit?.sorte !== "partie" && e.lignes.length);
    const entier = contenus.some((e) => (r.poses ?? []).includes(e.elementId));
    if (!entier) {
      const premierFini = Math.min(...contenus.map((e) => Math.max(...plan.actions.filter((a) => a.id === e.elementId && a.trace === "ecrire").map((a) => a.debut + a.duree), -Infinity)).filter(Number.isFinite));
      const attente = (premierFini - plan.debutPage) * 1000;
      if (!(attente <= PAGE_VIDE_MAX_MS_3 + 300)) vides.push({ sceneId: p.scene.id, message: `page ${p.page.page} : aucun bloc entier pendant ${Number.isFinite(attente) ? (attente / 1000).toFixed(1).replace(".", ",") : "toute la page"} s` });
    }
  }
  const appel: FauteAnimation[] = [];
  const derniere = ref[ref.length - 1];
  const pageAppel = ref.find((p) => p.page.elements.some((e) => e.gabarit?.sorte === "appel-plein"));
  if (!pageAppel) appel.push({ sceneId: derniere.scene.id, message: "aucune page d'appel plein cadre" });
  else {
    const entiere = (pageAppel.styleReference!.debutPageMs ?? pageAppel.scene.debutMs) + 300;
    const marge = derniere.scene.finMs - entiere;
    if (marge < APPEL_LISIBLE_MIN_MS) appel.push({ sceneId: pageAppel.scene.id, message: `la page d'appel n'est entière que ${(marge / 1000).toFixed(1).replace(".", ",")} s avant la fin (au moins ${APPEL_LISIBLE_MIN_MS / 1000} s)` });
  }
  const appelAnime: FauteAnimation[] = [];
  if (pageAppel) {
    const r = pageAppel.styleReference!;
    const plan = planPage3(pageAppel.page, r, { largeur: pageAppel.largeur, hauteur: pageAppel.hauteur });
    // À l'heure : pas avant que la voix commence la première phrase de la page (Axion, ou l'appel).
    const debuts = pageAppel.page.elements.map((e) => r.temps3?.[`${e.elementId}~debut`]).filter((v): v is number => v !== undefined);
    if (debuts.length && plan.debutPage * 1000 < Math.min(...debuts) - APPEL_AVANCE_MAX_MS) appelAnime.push({ sceneId: pageAppel.scene.id, message: `la page d'appel arrive ${((Math.min(...debuts) - plan.debutPage * 1000) / 1000).toFixed(1).replace(".", ",")} s avant que la voix commence sa phrase` });
    // Jamais figée : de son arrivée au début du fondu final.
    const fin = Math.max(...ref.filter((p) => p.page.page === pageAppel.page.page).map((p) => p.scene.finMs)) / 1000 - 0.5;
    const immobile = immobileMax3(plan, plan.finTransition, fin);
    if (immobile > RYTHME_REFERENCE_3.immobileMaxSec + 1e-6) appelAnime.push({ sceneId: pageAppel.scene.id, message: `la page d'appel reste immobile ${immobile.toFixed(1).replace(".", ",")} s (${RYTHME_REFERENCE_3.immobileMaxSec} s au plus)` });
  }
  return [
    { libelle: "Accroche pleine à 0 s", fautes: accroche },
    { libelle: "Blocs écrits à l'heure", fautes: ecriture },
    { libelle: "Aucune page vide", fautes: vides },
    { libelle: "Titre jamais seul", fautes: titreSeul },
    { libelle: "Appel lisible", fautes: appel },
    { libelle: "Appel à l'heure et animé", fautes: appelAnime },
  ];
}

/** Problèmes d'animation en phrases (fabrication : un échec bloquant avant le rendu des scènes). */
export function problemesAnimation3(props: readonly ProprietesTableauScene[]): string[] {
  return controlerAnimation3(props).flatMap((c) => c.fautes.map((f) => `Scène ${f.sceneId} · ${c.libelle} : ${f.message}.`));
}
