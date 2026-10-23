/**
 * MISE EN PAGE DU STYLE « reference/3 » : le gabarit par PARTIES (14/10/2026, regard de Will sur la vidéo
 * v-f1739d6a4f51), habillé le 15/10 à la charte Axion, direction A « Page ivoire » (maquette
 * `maquettes/tableau-charte-axion/`, PR #241). Fonction PURE et déterministe ; même contrat que les autres styles
 * (mêmes pages, mêmes sorties, mêmes heures).
 *
 * Chaque page, de haut en bas :
 *  1. la BARRE DES CHAPITRES NOMMÉS (choix de Will du 15/10) en haut de la zone sûre : une barre arrondie par chapitre
 *     (Douleur, Solution, Exemple, À vous ; règle de rattachement : `CHAPITRES_3`), son nom en petit dessous ;
 *     dessinée par le rendu, la page n'y monte jamais ;
 *  2. sur une page de l'exemple seulement, le repère discret « Exemple illustratif » (point sable + texte) ;
 *  3. le CONTENU, aligné à gauche : une icône au trait fin (ou, sur une étape, la pastille à l'encre et « Étape 2 sur
 *     4 »), puis 3 blocs au plus (titre, phrase clé, puis un détail ou un visuel). Titres et phrases en Montserrat
 *     ExtraBold très gros (texte principal ≥ 72 px en vertical) ; détails en Inter Medium (≥ 52 px). UNE seule ligne
 *     en orange par page (la dernière du titre, ou de la phrase qui le suit), surlignée d'orange pâle sur les pages de
 *     la douleur et de la solution ; le contenu couvre au moins 60 % de la hauteur utile ;
 *  4. la BANDE DES SOUS-TITRES, en bas de la zone sûre : réservée aux sous-titres communs du studio, la page n'y
 *     descend jamais.
 * L'accroche (page 1) est la douleur, en très grand (112 px), ses mots importants entourés au crayon quand ils sont
 * dits. La page d'appel garde le fond ivoire : la phrase finale en grand (fin en orange), le bouton plein à l'encre
 * « Réservez un appel de diagnostic », axion-ia.com dessous.
 * Visuels : liste à pastilles à l'encre (✓, ✎, ✕), liste cochée, exemple concret dans une carte arrondie (« Monsieur
 * Martin → Client A »), avant / maintenant (✕ et texte barré, ✓), idée reçue (✕, barrée). En horizontal (et en carré
 * si une colonne ne suffit pas) : deux colonnes, titre et phrase clé à gauche, le visuel à droite.
 * Une page qui ne tient pas (même aux minimums) ou qui montrerait plus de 3 blocs lève `ErreurMiseEnPage` : la
 * réparation automatique (`densite.ts`) la fait passer à une page de plus.
 *
 * PEPS (maquette validée par Will le 15/10, PR #260), seulement sur une page dont la fiche choisit un `visuel` ou un
 * `bloc` (une fiche sans eux se met en page comme avant) :
 *  - le VISUEL dessiné (banque fermée, `visuels-3.ts`) a sa place réservée : 35 à 45 % de la largeur de référence (vise
 *    40 %), à droite des blocs qu'il accompagne (centré sur eux) ou, en dernier recours, sous le texte, aligné à droite ;
 *    jamais à moins de 12 px d'un texte (on en laisse 40), jamais dans la bande des sous-titres ; il remplace l'icône ;
 *  - le BLOC ORANGE plein (texte ivoire, compteur facultatif en très grand) est un bloc de la page, à sa place dans
 *    l'ordre de la voix ; quand il est juste au-dessus du visuel, une FLÈCHE dessinée pointe de lui vers le visuel ;
 *  - la page n'écrit plus de ligne en orange (l'orange est au bloc et au visuel) ; sur la douleur et la solution, le
 *    MARQUEUR orange franc balaie sous le mot-clé (à l'instant où la voix le dit) ; la pastille d'étape rebondit.
 */
import { APPROCHE_REFERENCE, BOUTON_APPEL_3, CIBLES_GABARIT_3, COULEURS_REFERENCE_3, ICONES_PARTIES_3, MINIMUMS_GABARIT_3, SIGNATURE_REFERENCE, STYLE_REFERENCE_3, TAILLES_GABARIT_3, TAILLES_REFERENCE, VISUELS_GABARIT_3, libellePartie3 } from "@/briques/tableau-scene/reference/charte";
import { GRILLE_VISUEL_3, dessinVisuel3, encreVisuel3 } from "@/briques/tableau-scene/reference/visuels-3";
import type { DecorGabarit, MiseEnPageReference } from "@/briques/tableau-scene/reference/types";
import { largeurEcrite, motsEcrits } from "@/briques/stylo/mesure-ecriture";
import { cleMot, idBloc, idNumero, idVisuel, textesPeps, type BlocScene, type ElementLigne, type ElementTableau, type FicheTableau, type Geste, type SceneTableau, type VisuelScene } from "./fiche";
import { formatSortie, referenceFormat, zoneSureReference, type IdFormatSortie } from "./formats-sortie";
import { estPageSuite, numeroDePage, pagesDe, rolePage, type RolePage } from "./gabarit";
import { cotesTransformation, BORNES_GABARIT_3 } from "./gabarit-3";
import { chiffresDits, estDemande, retablirChiffres, sansEtiquette, sansTitreRepete, valeurNombre } from "./fidelite-texte";
import { geometrieTableau, poserPageTableau } from "./mise-en-page-tableau";
import { airOutil } from "@/briques/tableau-scene/trois-styles/outil";
import { estStyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { ErreurMiseEnPage, VERSION_MISE_EN_PAGE, zoneSureTableau, type ElementPlace, type GestePlace, type LigneVisuelle, type MiseEnPageTableau, type OptionsMiseEnPage, type PagePlacee, type Rect, type RectPx } from "./mise-en-page";
import { typographie } from "./mise-en-page-gabarit";
import { largeurReference, unites } from "./mise-en-page-reference";

const T = TAILLES_GABARIT_3;
const C = COULEURS_REFERENCE_3;
const arrondi6 = (v: number) => Math.round(v * 1e6) / 1e6;

/* ------------------------------------------------------------------ */
/* Sortie                                                                */
/* ------------------------------------------------------------------ */

export interface Sortie {
  W: number;
  H: number;
  k: number;
  format: IdFormatSortie;
  zone: RectPx;
  x0: number;
  x1: number;
  haut: number;
  /** Bas du contenu : au-dessus de la bande des sous-titres (et de son air). */
  bas: number;
  /** Bande réservée aux sous-titres, en bas de la zone sûre. */
  bande: RectPx;
}

function sortie(options: OptionsMiseEnPage): Sortie {
  const format: IdFormatSortie = options.format && options.format !== "vertical" ? options.format : "vertical";
  const f = formatSortie(format);
  const W = f.largeur;
  const H = f.hauteur;
  const k = referenceFormat(format).largeur / 1080;
  const z = format === "vertical" ? zoneSureReference("vertical", zoneSureTableau(options.reseaux)) : zoneSureReference(format);
  const x = Math.round((z.gauche / 100) * W);
  const y = Math.round((z.haut / 100) * H);
  const zone = { x, y, largeur: W - x - Math.round((z.droite / 100) * W), hauteur: H - y - Math.round((z.bas / 100) * H) };
  const m = Math.round(16 * k);
  const hBande = Math.round(T.bandeSousTitres[format] * k);
  const bande = { x: zone.x, y: zone.y + zone.hauteur - hBande, largeur: zone.largeur, hauteur: hBande };
  return { W, H, k, format, zone, x0: zone.x + m, x1: zone.x + zone.largeur - m, haut: zone.y + Math.round(12 * k), bas: bande.y - Math.round(T.airSousTitres * k), bande };
}

const rect = (px: RectPx, s: Sortie): Rect => ({ px, fraction: { x: arrondi6(px.x / s.W), y: arrondi6(px.y / s.H), largeur: arrondi6(px.largeur / s.W), hauteur: arrondi6(px.hauteur / s.H) } });
export const union = (rs: RectPx[]): RectPx => {
  const x = Math.floor(Math.min(...rs.map((r) => r.x)));
  const y = Math.floor(Math.min(...rs.map((r) => r.y)));
  const x2 = Math.ceil(Math.max(...rs.map((r) => r.x + r.largeur)));
  const y2 = Math.ceil(Math.max(...rs.map((r) => r.y + r.hauteur)));
  return { x, y, largeur: x2 - x, hauteur: y2 - y };
};
const decaler = (r: RectPx, dx: number, dy: number): RectPx => ({ ...r, x: r.x + dx, y: r.y + dy });

/* ------------------------------------------------------------------ */
/* Polices                                                               */
/* ------------------------------------------------------------------ */

/** « titre » : Montserrat ExtraBold (texte principal) ; « detail » : Inter Medium (détails, mentions) ; « bouton » : Inter Bold. */
type Police = "titre" | "detail" | "bouton";
const mesurer = (texte: string, taille: number, police: Police) => (police === "titre" ? largeurReference(texte, taille) : largeurEcrite(texte, police === "bouton" ? "texte" : "detail", taille, 0));

/* ------------------------------------------------------------------ */
/* Contenu d'une page                                                    */
/* ------------------------------------------------------------------ */

export interface Ligne {
  l: ElementLigne;
  sceneId: string;
}

/** Un bloc visible de la page (une liste compte pour un). */
export type Groupe =
  | { sorte: "titre"; ligne: Ligne }
  | { sorte: "accroche" | "phrase" | "detail" | "idee"; ligne: Ligne }
  | { sorte: "code" | "coche" | "liste" | "transformation"; lignes: Ligne[] }
  | { sorte: "comparaison"; avant?: Ligne; apres?: Ligne }
  | { sorte: "appel"; ligne: Ligne; bouton?: Ligne; site?: Ligne }
  /** Peps : le bloc orange de la page. */
  | { sorte: "bloc"; b: BlocScene; sceneId: string };

export interface ContenuPage {
  page: number;
  role: RolePage;
  premiere: SceneTableau;
  derniere: SceneTableau;
  suite: boolean;
  numero?: { n: number; sceneId: string; total: number; ecrit: boolean };
  mention?: { id: string; sceneId: string; texte: string };
  groupes: Groupe[];
  dessins: { e: Extract<ElementTableau, { type: "dessin" }>; sceneId: string }[];
  gestes: { e: Extract<ElementTableau, { type: "geste" }>; sceneId: string }[];
  doubles: Map<string, string>;
  /** Peps : le visuel dessiné de la page (un au plus). */
  visuel?: { v: VisuelScene; sceneId: string };
}

/** Une page « avec peps » : sa fiche lui choisit un visuel ou un bloc orange. */
const avecPeps = (c: ContenuPage) => !!c.visuel || c.groupes.some((g) => g.sorte === "bloc");

const ordreEcriture = (s: SceneTableau) =>
  s.elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => ("ancre" in a.e ? a.e.ancre : 0) - ("ancre" in b.e ? b.e.ancre : 0) || a.i - b.i)
    .map((x) => x.e);
const cleTexte = (t: string) => t.split(/\s+/).map(cleMot).filter(Boolean).join(" ");
/** L'appel à réserver (il devient le bouton de la page d'appel). */
export const estBouton = (t: string) => /r[ée]serv/iu.test(t) && /appel/iu.test(t);
/** Code d'une liste à pastilles : le nom de la couleur n'est plus écrit (le signe ✓, ✎, ✕ le montre). */
const sansCouleur = (t: string) => {
  const r = t.replace(/^\s*(vert|orange|rouge)\s*:\s*/iu, "");
  return r === t || !r ? t : r.charAt(0).toUpperCase() + r.slice(1);
};

const avecTexte = (x: Ligne, texte: string): Ligne => (texte === x.l.texte ? x : { ...x, l: { ...x.l, texte } });

/**
 * Le texte écrit de la page, fidèle et sans doublon (vidéo d'essai v-667edcd8e3a8) : la phrase (ou le détail) ne
 * reprend pas le titre au début ; « avant » et « maintenant » ne répètent pas leur étiquette ; sur l'exemple (il porte
 * toujours la mention « Exemple illustratif »), le chiffre que la voix dit et que la fiche a retiré est rétabli en
 * chiffres (« des minutes » → « 10 minutes »).
 */
function fideliser(c: ContenuPage, dits: ReadonlyMap<string, string>): void {
  const titre = c.groupes.find((g): g is Extract<Groupe, { sorte: "titre" }> => g.sorte === "titre");
  const exemple = c.role === "exemple";
  // Chaque texte est comparé à ce que dit SA scène (l'« après » ne reprend pas le chiffre de l'« avant »).
  const fidele = (x: Ligne) => (exemple ? avecTexte(x, retablirChiffres(x.l.texte, dits.get(x.sceneId) ?? "")) : x);
  c.groupes = c.groupes.flatMap((g): Groupe[] => {
    if ((g.sorte === "phrase" || g.sorte === "detail") && titre) {
      const reste = sansTitreRepete(g.ligne.l.texte, titre.ligne.l.texte);
      if (reste === null) {
        c.doubles.set(g.ligne.l.id, titre.ligne.l.id);
        return [];
      }
      return [{ ...g, ligne: fidele(avecTexte(g.ligne, reste)) }];
    }
    if (g.sorte === "comparaison") {
      const avant = g.avant ? fidele(avecTexte(g.avant, sansEtiquette(g.avant.l.texte, "avant"))) : undefined;
      const apres = g.apres ? fidele(avecTexte(g.apres, sansEtiquette(g.apres.l.texte, "apres"))) : undefined;
      return [{ sorte: "comparaison", ...(avant ? { avant } : {}), ...(apres ? { apres } : {}) }];
    }
    if (g.sorte === "phrase" || g.sorte === "detail" || g.sorte === "accroche" || g.sorte === "idee") return [{ ...g, ligne: fidele(g.ligne) }];
    if (g.sorte === "code" || g.sorte === "coche" || g.sorte === "liste" || g.sorte === "transformation") return [{ ...g, lignes: g.lignes.map(fidele) }];
    return [g];
  });
  // Un chiffre dit que la page n'écrit nulle part (« …et l'envoie : trois minutes. », critique #291 B2) s'écrit à la
  // fin du texte de sa scène (son « avant » ou son « maintenant » d'abord).
  if (exemple) ecrireOublis(c, dits);
}

/** Les lignes d'une page, dans l'ordre (avec de quoi les remplacer). */
function lignesDe(c: ContenuPage): { x: Ligne; remplacer: (y: Ligne) => void }[] {
  const res: { x: Ligne; remplacer: (y: Ligne) => void }[] = [];
  c.groupes.forEach((g, i) => {
    if ("ligne" in g) res.push({ x: g.ligne, remplacer: (y) => (c.groupes[i] = { ...g, ligne: y } as Groupe) });
    else if ("lignes" in g) g.lignes.forEach((x, j) => res.push({ x, remplacer: (y) => (g.lignes[j] = y) }));
    else if (g.sorte === "comparaison") {
      if (g.avant) res.push({ x: g.avant, remplacer: (y) => (g.avant = y) });
      if (g.apres) res.push({ x: g.apres, remplacer: (y) => (g.apres = y) });
    }
  });
  return res;
}

/** Exemple : chaque chiffre dit et écrit nulle part sur la page est écrit à la fin d'un texte de sa scène. */
function ecrireOublis(c: ContenuPage, dits: ReadonlyMap<string, string>): void {
  const valeurs = (t: string) => t.split(/[^\p{L}\p{N}]+/u).map(valeurNombre).filter((v): v is number => v !== undefined);
  const ecrits = new Set(lignesDe(c).flatMap((l) => valeurs(l.x.l.texte)));
  for (const [sceneId, dit] of dits) {
    if (chiffresDits(dit).every((v) => ecrits.has(v))) continue;
    const ls = lignesDe(c).filter((l) => l.x.sceneId === sceneId);
    const comparaison = c.groupes.find((g): g is Extract<Groupe, { sorte: "comparaison" }> => g.sorte === "comparaison");
    const cible = ls.find((l) => l.x === comparaison?.apres || l.x === comparaison?.avant) ?? ls.at(-1);
    if (!cible) continue;
    const texte = retablirChiffres(cible.x.l.texte, dit, { oublies: true, dejaEcrits: ecrits });
    cible.remplacer(avecTexte(cible.x, texte));
    for (const v of valeurs(texte)) ecrits.add(v);
  }
}

function contenus(fiche: FicheTableau, options: OptionsMiseEnPage): ContenuPage[] {
  const pages = pagesDe(fiche);
  const total = Math.max(0, ...fiche.scenes.map((s) => s.gabarit?.numero?.n ?? 0));
  const derniereScene = fiche.scenes[fiche.scenes.length - 1];
  return pages.map((p, i) => {
    const role = (rolePage(p) ?? "douleur") as RolePage;
    const c: ContenuPage = { page: p.page, role, premiere: p.scenes[0], derniere: p.scenes[p.scenes.length - 1], suite: estPageSuite(pages, i), groupes: [], dessins: [], gestes: [], doubles: new Map() };
    const n = numeroDePage(pages, i);
    const sceneNumero = p.scenes.find((s) => s.gabarit?.numero);
    if (n !== undefined && role === "solution") c.numero = { n, sceneId: sceneNumero?.id ?? p.scenes[0].id, total: Math.max(total, n), ecrit: !!sceneNumero };
    const vus = new Map<string, string>();
    const listes = new Map<string, Ligne[]>();
    const ajouterListe = (sorte: "code" | "coche" | "liste" | "transformation", x: Ligne) => {
      let l = listes.get(sorte);
      if (!l) {
        l = [];
        listes.set(sorte, l);
        c.groupes.push({ sorte, lignes: l });
      }
      l.push(x);
    };
    let comparaison: Extract<Groupe, { sorte: "comparaison" }> | undefined;
    const lignesAppel: Ligne[] = [];
    for (const s of p.scenes) {
      if (s.gabarit?.visuel && !c.visuel) c.visuel = { v: s.gabarit.visuel, sceneId: s.id };
      // Le bloc orange prend sa place dans l'ordre de la voix (avant le premier élément dit après lui).
      let bloc: Extract<Groupe, { sorte: "bloc" }> | undefined = s.gabarit?.bloc && role !== "appel" && !c.groupes.some((g) => g.sorte === "bloc") ? { sorte: "bloc", b: s.gabarit.bloc, sceneId: s.id } : undefined;
      // Un chiffre sourcé que montre le visuel ou le bloc n'est pas écrit une seconde fois.
      const montres = new Set(textesPeps(s).flatMap((t) => t.match(/\d+/g) ?? []));
      for (const e of ordreEcriture(s)) {
        if (bloc && "ancre" in e && e.ancre > (bloc.b.ancre ?? 0)) {
          c.groupes.push(bloc);
          bloc = undefined;
        }
        if (e.type === "chiffre" && (e.valeur.match(/\d+/g) ?? []).length && (e.valeur.match(/\d+/g) ?? []).every((d) => montres.has(d))) {
          c.doubles.set(e.id, s.gabarit?.bloc ? idBloc(s.id) : idVisuel(s.id));
          continue;
        }
        if (e.type === "dessin") c.dessins.push({ e, sceneId: s.id });
        else if (e.type === "geste") c.gestes.push({ e, sceneId: s.id });
        else if (e.type === "mention") c.mention ??= { id: e.id, sceneId: s.id, texte: e.texte };
        else if (e.type === "chiffre") c.groupes.push({ sorte: "detail", ligne: { l: { id: e.id, type: "ligne", texte: e.unite ? `${e.valeur} ${e.unite}` : e.valeur, niveau: "texte", role: "resultat", bloc: "detail", ancre: e.ancre }, sceneId: s.id } });
        else if (e.type === "preuve") {
          e.lignes.forEach((texte, j) => {
            const m = /^\s*(avant|après|apres)\s*:\s*/iu.exec(texte);
            const ton = m ? (m[1].toLowerCase() === "avant" ? "avant" : "apres") : null;
            // Trois styles : le texte sans « Après : » commence par une majuscule (« Elle relit… »).
            const sans = m ? texte.slice(m[0].length) : texte;
            const l: ElementLigne = { id: j === 0 ? e.id : `${e.id}~${j}`, type: "ligne", texte: m && estStyleTableau(fiche.styleTableau) ? sans.charAt(0).toUpperCase() + sans.slice(1) : sans, niveau: "texte", role: ton === "avant" ? "alerte" : "resultat", bloc: ton ?? "detail", ancre: e.ancre };
            const x = { l, sceneId: s.id };
            if (ton) {
              if (!comparaison) c.groupes.push((comparaison = { sorte: "comparaison" }));
              if (ton === "avant") comparaison.avant ??= x;
              else comparaison.apres ??= x;
            } else c.groupes.push({ sorte: "detail", ligne: x });
          });
        } else if (e.type === "ligne") {
          const cle = cleTexte(e.texte);
          const deja = vus.get(cle);
          if (deja) {
            c.doubles.set(e.id, deja);
            continue;
          }
          vus.set(cle, e.id);
          const x = { l: e, sceneId: s.id };
          if (role === "appel") {
            if (e.bloc === "appel") lignesAppel.unshift(x);
            else lignesAppel.push(x);
            continue;
          }
          switch (e.bloc) {
            case "titre":
              if (!c.groupes.some((g) => g.sorte === "titre")) c.groupes.unshift({ sorte: "titre", ligne: x });
              break;
            case "phrase-cle":
              c.groupes.push({ sorte: role === "accroche" && s === fiche.scenes[0] && e.ancre === 0 ? "accroche" : "phrase", ligne: x });
              break;
            case "idee-recue":
              c.groupes.push({ sorte: "idee", ligne: x });
              break;
            case "code":
              ajouterListe("code", { ...x, l: { ...e, texte: sansCouleur(e.texte) } });
              break;
            case "coche":
            case "liste":
            case "transformation":
              ajouterListe(e.bloc, x);
              break;
            case "avant":
            case "apres":
              if (!comparaison) c.groupes.push((comparaison = { sorte: "comparaison" }));
              if (e.bloc === "avant") comparaison.avant ??= x;
              else comparaison.apres ??= x;
              break;
            default:
              c.groupes.push({ sorte: "detail", ligne: x });
          }
        }
      }
      if (bloc) c.groupes.push(bloc);
    }
    fideliser(c, new Map(p.scenes.map((s) => [s.id, s.texteDit])));
    if (role === "appel") {
      // Page d'appel : la phrase finale en grand (la phrase de la fin de la sortie quand elle en a une, sinon la ligne
      // de la fiche qui n'est pas l'appel à réserver), le bouton « Réservez un appel de diagnostic », le site.
      const site: Ligne = { l: { id: `${c.derniere.id}~site`, type: "ligne", texte: SIGNATURE_REFERENCE, niveau: "texte", role: "regle", bloc: "appel", ancre: 0 }, sceneId: c.derniere.id };
      const ap = options.appel;
      const phrase: Ligne | undefined = ap && "site" in ap && ap.phrase?.trim() ? { l: { id: `${c.derniere.id}~phrase`, type: "ligne", texte: ap.phrase.trim(), niveau: "texte", role: "regle", bloc: "appel", ancre: 0 }, sceneId: c.derniere.id } : undefined;
      // UNE demande par fin (vidéo d'essai v-667edcd8e3a8 : « Enregistrez pour la retrouver » ET le bouton « Réservez un
      // appel » sur TikTok) : la phrase de la fin de la sortie, quand elle en a une, est LA demande (sans bouton) ;
      // sinon l'appel à réserver devient le bouton, sous la phrase de la fiche qui n'est pas une demande ; sinon la
      // seule demande de la fiche s'écrit en grand, sans bouton.
      const candidats = [...(phrase ? [phrase] : []), ...lignesAppel];
      const bouton = phrase ? undefined : candidats.find((x) => estBouton(x.l.texte));
      const grand = phrase ?? (bouton ? candidats.find((x) => x !== bouton && !estDemande(x.l.texte)) : (candidats.find((x) => estDemande(x.l.texte)) ?? candidats[0])) ?? bouton;
      if (grand && p.scenes.includes(derniereScene)) {
        const b: Ligne | undefined = bouton && bouton !== grand ? { ...bouton, l: { ...bouton.l, texte: BOUTON_APPEL_3 } } : undefined;
        // La fin « adresse seule » (TikTok et Shorts, LinkedIn sans phrase de fin) écrit déjà le site en grand : il n'est
        // pas écrit une seconde fois dessous.
        const memeSite = grand.l.texte.trim().toLowerCase().replace(/[.\s]+$/u, "") === SIGNATURE_REFERENCE.toLowerCase();
        c.groupes.push({ sorte: "appel", ligne: grand, ...(b ? { bouton: b } : {}), ...(memeSite ? {} : { site }) });
        // Les autres lignes de la fiche (au-delà de la phrase et du bouton) ne sont pas écrites : la page reste claire.
        for (const x of candidats) if (x !== grand && x !== b && x.l.id !== b?.l.id) c.doubles.set(x.l.id, grand.l.id);
      } else for (const d of lignesAppel) c.groupes.push({ sorte: "detail", ligne: d });
    }
    return c;
  });
}

/* ------------------------------------------------------------------ */
/* Pose des blocs                                                        */
/* ------------------------------------------------------------------ */

interface Tailles {
  k: number;
  f: number;
  accroche: number;
  titre: number;
  phrase: number;
  detail: number;
  item: number;
  appel: number;
  /** Aération : facteur des écarts entre deux éléments d'une liste, d'un avant / après, de la page d'appel. */
  aere: number;
  /** Dernier repli d'une page qui ne tient pas : les cartes « avant → après » se serrent (marges, « après » moins grand). */
  serre?: boolean;
}

/** Planchers des tailles : ceux visés pour la sortie (`CIBLES_GABARIT_3`), ou ses minimums (`MINIMUMS_GABARIT_3`). */
type Planchers = Readonly<{ accroche: number; titre: number; phrase: number; detail: number; item: number; appel: number }>;

function tailles(k: number, f: number, plancher: Planchers, aere = 1, P: Planchers = T.plafonds): Tailles {
  const t = (base: number, min: number, max: number) => Math.round(Math.max(min, k * Math.min(max, base * f)));
  return { k, f, aere, accroche: t(T.accroche, plancher.accroche, P.accroche), titre: t(T.titre, plancher.titre, P.titre), phrase: t(T.phrase, plancher.phrase, P.phrase), detail: t(T.detail, plancher.detail, P.detail), item: t(T.item, plancher.item, P.item), appel: t(T.appel, plancher.appel, P.appel) };
}

/** Un élément posé, relatif au haut de son bloc. */
export type Pose = Omit<ElementPlace, "ordre" | "px" | "fraction" | "encombrement" | "lignes"> & { px: RectPx; enc: RectPx; lignes: (Omit<LigneVisuelle, "fraction"> & { px: RectPx })[]; heure?: string | null };

interface Bloc {
  hauteur: number;
  largeur: number;
  poses: Pose[];
}

/** Petit mot à ne pas laisser en fin de rangée. */
const petitMot = (u: string) => /^[\p{L}'’]{1,3}$/u.test(u) && !/^\p{Lu}{2,}$/u.test(u);

/**
 * Coupe d'un texte dans `largeurMax` : le moins de rangées, puis la plus longue la plus courte possible (rangées
 * équilibrées, un petit mot jamais en fin de rangée quand c'est évitable). `null` si un mot ne tient pas.
 */
function couper(texte: string, taille: number, largeurMax: number, police: Police): { texte: string; largeur: number }[] | null {
  const u = unites(texte);
  if (!u.length) return null;
  const lu = u.map((m) => mesurer(m, taille, police));
  if (lu.some((x) => x > largeurMax)) return null;
  const esp = mesurer(" ", taille, police);
  const larg = (i: number, j: number) => lu.slice(i, j).reduce((s, x) => s + x, 0) + (j - i - 1) * esp;
  let n0 = 1;
  for (let i = 0, w = 0; i < u.length; i++) {
    if (w > 0 && w + esp + lu[i] > largeurMax) {
      n0++;
      w = lu[i];
    } else w += (w > 0 ? esp : 0) + lu[i];
  }
  const n = u.length;
  const memo = new Map<string, { cout: number; coupes: number[] }>();
  const meilleur = (i: number, r: number): { cout: number; coupes: number[] } => {
    const cle = `${i},${r}`;
    const m = memo.get(cle);
    if (m) return m;
    let res = { cout: Infinity, coupes: [] as number[] };
    if (r === 1) {
      const w = larg(i, n);
      res = w <= largeurMax ? { cout: w, coupes: [n] } : res;
    } else
      for (let j = i + 1; j <= n - r + 1; j++) {
        const w = larg(i, j);
        if (w > largeurMax) break;
        const reste = meilleur(j, r - 1);
        const cout = Math.max(w, reste.cout) + (petitMot(u[j - 1]) ? largeurMax * 0.05 : 0);
        if (cout < res.cout) res = { cout, coupes: [j, ...reste.coupes] };
      }
    memo.set(cle, res);
    return res;
  };
  const r = meilleur(0, n0);
  if (!Number.isFinite(r.cout)) return null;
  let i = 0;
  return r.coupes.map((j) => {
    const x = { texte: u.slice(i, j).join(" "), largeur: Math.ceil(larg(i, j)) };
    i = j;
    return x;
  });
}

/** Un texte posé à (x, 0), aligné à gauche dans `largeur`, `max` rangées au plus. */
function texte(ligne: Ligne, x: number, largeur: number, taille: number, interligne: number, max: number, extra: Partial<Pose> & { couleur: string; fond?: string }, police: Police = "titre"): { pose: Pose; hauteur: number; rangs: { texte: string; largeur: number }[] } | null {
  if (largeur <= 0) return null;
  const rs = couper(ligne.l.texte, taille, largeur, police);
  if (!rs || rs.length > max) return null;
  const il = Math.round(taille * interligne);
  const lignes = rs.map((r, i) => ({ texte: typographie(r.texte), px: { x: Math.round(x), y: i * il, largeur: r.largeur, hauteur: il } }));
  const px = union(lignes.map((l) => l.px));
  const { couleur, fond, ...reste } = extra;
  return {
    pose: { elementId: ligne.l.id, sceneId: ligne.sceneId, type: "ligne", niveau: police === "titre" ? "titre" : "corps", taillePx: taille, couleurTexte: couleur, couleurFond: fond ?? C.fond, lignes, role: ligne.l.role, px, enc: px, ...reste },
    hauteur: px.hauteur,
    rangs: rs,
  };
}

export const decalerPose = (p: Pose, dx: number, dy: number): Pose => ({ ...p, px: decaler(p.px, dx, dy), enc: decaler(p.enc, dx, dy), lignes: p.lignes.map((l) => ({ ...l, px: decaler(l.px, dx, dy) })), ...(p.gabarit ? { gabarit: decalerDecor(p.gabarit, dx, dy) } : {}) });

/** Zones des mots importants d'un texte posé (groupes de mots voisins sur une même rangée). */
function zonesImportants(ligne: ElementLigne, pose: Pose, rangs: { texte: string; largeur: number }[], taille: number, k: number): Extract<DecorGabarit, { sorte: "accroche" }>["mots"] {
  const voulus = (ligne.importants ?? []).map(cleMot);
  if (!voulus.length) return [];
  const esp = largeurReference(" ", taille);
  const res: Extract<DecorGabarit, { sorte: "accroche" }>["mots"] = [];
  const pris = new Set<number>();
  rangs.forEach((r, iRang) => {
    const l = pose.lignes[iRang];
    let x = l.px.x;
    let courant: (typeof res)[number] | null = null;
    for (const u of unites(r.texte)) {
      const w = largeurReference(u, taille);
      const c = cleMot(u);
      const k0 = voulus.findIndex((v, i) => v === c && !pris.has(i));
      if (k0 >= 0) {
        pris.add(k0);
        const zone = { x: Math.round(x - 12 * k), y: Math.round(l.px.y + l.px.hauteur * 0.04), largeur: Math.round(w + 24 * k), hauteur: Math.round(l.px.hauteur * 0.94) };
        if (courant && courant.kFin === k0 - 1) {
          courant.kFin = k0;
          courant.zone = union([courant.zone, zone]);
        } else {
          courant = { k: k0, kFin: k0, zone, ligne: iRang };
          res.push(courant);
        }
      } else courant = null;
      x += w + esp;
    }
  });
  return res;
}

/** Signe (✕ ou ✓) suivi d'un libellé de mention : « ✕ Avant », « ✓ Maintenant », « ✕ Idée reçue ». */
function libelleSigne(libelle: string, x0: number, taille: number, k: number) {
  const il = Math.round(taille * 1.2);
  const D = Math.round(taille * 1.12);
  const disque = { x: x0, y: Math.round((il - D) / 2), largeur: D, hauteur: D };
  const xl = x0 + D + Math.round(22 * k);
  const l = Math.ceil(mesurer(libelle, taille, "detail"));
  const ligne = { texte: libelle, px: { x: xl, y: 0, largeur: l, hauteur: il } };
  return { disque, ligne, cadre: union([disque, ligne.px]), retrait: D + Math.round(22 * k) };
}

/**
 * Le bloc d'un groupe, posé entre `x0` et `x1` (haut = 0). `null` s'il ne tient pas. `enLigne` (dernier recours des
 * sorties basses) : la pastille d'étape est posée à gauche du titre, au lieu d'être au-dessus ; « ✕ Avant » et
 * « ✓ Maintenant » à gauche de leur texte, au lieu d'être dessus.
 */
function bloc(g: Groupe, c: ContenuPage, x0: number, x1: number, t: Tailles, enLigne = false): Bloc | null {
  const k = t.k;
  const L = x1 - x0;
  const fini = (poses: Pose[]): Bloc => {
    const u = union(poses.map((p) => p.enc));
    return { hauteur: u.y + u.hauteur, largeur: u.largeur, poses };
  };
  switch (g.sorte) {
    case "accroche": {
      // Une accroche courte, seule sur sa page, s'aère aussi : ses rangées s'écartent (interligne 1,4 au plus).
      const il = Math.min(1.4, T.interligneAccroche * (1 + (t.aere - 1) * 0.1));
      const r = texte(g.ligne, x0, L, t.accroche, il, 5, { couleur: C.encre });
      if (!r) return null;
      const mots = zonesImportants(g.ligne.l, r.pose, r.rangs, t.accroche, k);
      r.pose.gabarit = { sorte: "accroche", mots, couleur: C.accentTexte };
      r.pose.importants = g.ligne.l.importants ? [...g.ligne.l.importants] : undefined;
      delete r.pose.marque;
      r.pose.enc = union([r.pose.px, ...mots.map((m) => m.zone)]);
      return fini([r.pose]);
    }
    case "titre": {
      if (enLigne && c.numero) {
        const v = visuel(c, x0, x0, k, 0.7);
        const P = v.hauteur;
        const xt = x0 + P + Math.round(28 * k);
        const r = texte(g.ligne, xt, x1 - xt, t.titre, T.interligneTitre, 2, { couleur: C.encre, gabarit: { sorte: "titre" } });
        if (!r) return null;
        delete r.pose.marque;
        const h = Math.max(P, r.hauteur);
        return fini([...v.poses.map((p) => decalerPose(p, 0, Math.round((h - P) / 2))), decalerPose(r.pose, 0, Math.round((h - r.hauteur) / 2))]);
      }
      const r = texte(g.ligne, x0, L, t.titre, T.interligneTitre, 3, { couleur: C.encre, gabarit: { sorte: "titre" } });
      if (!r) return null;
      delete r.pose.marque;
      return fini([r.pose]);
    }
    case "phrase": {
      // Phrase clé : 5 rangées au plus (une phrase de 12 mots, en grand, dans la colonne étroite du vertical).
      const r = texte(g.ligne, x0, L, t.phrase, T.interlignePhrase, 5, { couleur: C.encre, gabarit: { sorte: "phrase" } });
      if (!r) return null;
      delete r.pose.marque;
      return fini([r.pose]);
    }
    case "detail": {
      const r = texte(g.ligne, x0, L, t.detail, T.interligneDetail, 3, { couleur: C.mention }, "detail");
      if (!r) return null;
      delete r.pose.marque;
      return fini([r.pose]);
    }
    case "idee": {
      // « ✕ Idée reçue », puis le texte (barré quand la voix a fini de le dire).
      const tl = Math.round(t.detail * 0.95);
      const s = libelleSigne("Idée reçue", x0, tl, k);
      const r = texte(g.ligne, x0, L, t.phrase, T.interlignePhrase, 3, { couleur: C.encre });
      if (!r) return null;
      delete r.pose.marque;
      const dy = s.cadre.hauteur + Math.round(16 * k);
      const pose = decalerPose(r.pose, 0, dy);
      pose.gabarit = { sorte: "idee", cadre: s.cadre, signe: s.disque, texte: { texte: s.ligne.texte, x: s.ligne.px.x, y: s.ligne.px.y, largeur: s.ligne.px.largeur, hauteur: s.ligne.px.hauteur, taille: tl }, couleur: C.encre };
      pose.enc = union([pose.px, s.cadre]);
      return fini([pose]);
    }
    case "code":
    case "coche":
    case "liste": {
      const taille = t.item;
      const D = Math.round((g.sorte === "code" ? T.disque : T.case) * taille);
      const xt = x0 + D + Math.round(T.ecartPuce * k);
      const poses: Pose[] = [];
      let y = 0;
      for (const [i, x] of g.lignes.entries()) {
        const r = texte(x, xt, x1 - xt, taille, T.interligneDetail, 2, { couleur: C.encre }, "detail");
        if (!r) return null;
        delete r.pose.marque;
        const l0 = r.pose.lignes[0].px;
        const boite = { x: x0, y: Math.round(l0.y + (l0.hauteur - D) / 2), largeur: D, hauteur: D };
        const gab: DecorGabarit = g.sorte === "code" ? { sorte: "code", code: x.l.code ?? "vert", disque: boite, couleur: C.encre } : { sorte: "case", boite, couleur: C.encre, attente: g.sorte === "liste" };
        const pose: Pose = { ...r.pose, gabarit: gab, enc: union([r.pose.px, boite]) };
        const dy = i ? y + Math.round(T.ecartItems * k * Math.min(1.4, t.f) * t.aere) : 0;
        const pp = decalerPose(pose, 0, dy);
        poses.push(pp);
        y = pp.enc.y + pp.enc.hauteur;
      }
      return fini(poses);
    }
    case "transformation": {
      // Une carte arrondie par exemple : « Monsieur Martin » (Inter), puis « → Client A » (Montserrat, plus grand).
      const tDe = t.detail;
      const tVers = Math.round(t.item * (t.serre ? 1.15 : 1.4));
      const mx = Math.round(T.margeCarteX * k);
      const my = Math.round(T.margeCarteY * k * (t.serre ? 0.5 : 1));
      const fl = Math.round(84 * k);
      const ec = Math.round(26 * k);
      const poses: Pose[] = [];
      let y = 0;
      for (const [i, x] of g.lignes.entries()) {
        const cotes = cotesTransformation(x.l.texte);
        if (!cotes) return null;
        const wDe = Math.ceil(mesurer(cotes.de, tDe, "detail"));
        const wVers = Math.ceil(mesurer(cotes.vers, tVers, "titre"));
        if (wDe > L - 2 * mx || fl + ec + wVers > L - 2 * mx) return null;
        const ilDe = Math.round(tDe * 1.25);
        const ilVers = Math.round(tVers * 1.2);
        const dy = i ? y + Math.round(T.ecartItems * k * (t.serre ? 0.6 : 1.2) * t.aere) : 0;
        const xv = x0 + mx + fl + ec;
        const yv = dy + my + ilDe + Math.round(4 * k);
        const lignes = [
          { texte: typographie(cotes.de), ton: "avant" as const, px: { x: x0 + mx, y: dy + my, largeur: wDe, hauteur: ilDe } },
          { texte: typographie(cotes.vers), ton: "apres" as const, px: { x: xv, y: yv, largeur: wVers, hauteur: ilVers } },
        ];
        const carte = { x: x0, y: dy, largeur: L, hauteur: yv + ilVers + my - dy };
        const ym = yv + Math.round(ilVers * 0.55);
        poses.push({ elementId: x.l.id, sceneId: x.sceneId, type: "ligne", niveau: "titre", taillePx: tVers, couleurTexte: C.encre, couleurFond: C.carte, lignes, role: x.l.role, px: union(lignes.map((l) => l.px)), enc: carte, gabarit: { sorte: "transformation", fleche: { x1: x0 + mx, y1: ym, x2: x0 + mx + fl, y2: ym }, couleur: C.encre, carte, rayon: Math.round(T.rayonCarte * k), fond: C.carte, tailleDe: tDe } });
        y = carte.y + carte.hauteur;
      }
      return fini(poses);
    }
    case "comparaison": {
      // « ✕ Avant » puis le texte barré (sable assombri) ; « ✓ Maintenant » puis le texte à l'encre.
      const tl = Math.round(t.detail * 0.95);
      const poses: Pose[] = [];
      let y = 0;
      for (const [ton, x] of [
        ["avant", g.avant],
        ["apres", g.apres],
      ] as const) {
        if (!x) continue;
        const s = libelleSigne(ton === "avant" ? "Avant" : "Maintenant", x0, tl, k);
        const colonne = Math.ceil(libelleSigne("Maintenant", x0, tl, k).cadre.largeur) + Math.round(28 * k);
        const xt = x0 + (enLigne ? colonne : s.retrait);
        const r = texte(x, xt, x1 - xt, t.detail, 1.22, 3, { couleur: ton === "avant" ? C.mention : C.encre }, "detail");
        if (!r) return null;
        delete r.pose.marque;
        if (ton === "avant") r.pose.marque = "barre";
        const dy = poses.length ? y + Math.round(T.ecartItems * k * 1.6 * t.aere) : 0;
        const etiquette: Pose = { elementId: `${x.l.id}~etiquette`, sceneId: x.sceneId, type: "mention", niveau: "corps", taillePx: tl, couleurTexte: ton === "avant" ? C.mention : C.encre, couleurFond: C.fond, lignes: [s.ligne], gabarit: { sorte: "avant-apres", cadre: s.cadre, signe: ton === "avant" ? "croix" : "coche", disque: s.disque }, px: s.cadre, enc: s.cadre, heure: x.l.id };
        const te = decalerPose(r.pose, 0, enLigne ? Math.round((s.cadre.hauteur - r.pose.lignes[0].px.hauteur) / 2) : s.cadre.hauteur + Math.round(10 * k));
        poses.push(decalerPose(etiquette, 0, dy), decalerPose(te, 0, dy));
        y = dy + te.px.y + te.px.hauteur;
      }
      return poses.length ? fini(poses) : null;
    }
    case "bloc": {
      // Bloc orange plein (maquette PR #260) : le compteur en très grand à gauche (s'il y en a un), le texte ivoire en
      // Montserrat ExtraBold, deux rangées au plus. Il grandit avec la page, jamais sous `tailleMin`.
      const V = VISUELS_GABARIT_3.bloc;
      const tb = Math.round(Math.max(V.tailleMin * k, Math.min(V.taille * 1.15, V.taille * t.f) * k));
      const mx = Math.round(V.margeX * k);
      const my = Math.round(V.margeY * k);
      const cpt = g.b.compteur;
      const lignePseudo: Ligne = { l: { id: idBloc(g.sceneId), type: "ligne", texte: g.b.texte, niveau: "titre", role: "resultat", ancre: g.b.ancre ?? 0 }, sceneId: g.sceneId };
      // Un compteur à côté d'un texte de 3 mots ou plus, au-dessus d'un visuel : le bloc se fait compact, sur deux rangées
      // (la maquette : « 3 | données / de trop. », la place à sa droite pour la flèche) ; sinon une rangée d'abord.
      const compact = !!cpt && !!c.visuel && unites(g.b.texte).length >= 3;
      for (const rangs of compact ? [2, 1] : [1, 2]) {
        const tc = cpt ? Math.round(tb * (rangs === 2 ? 2.47 : 1.75)) : 0;
        const wc = cpt ? Math.ceil(Math.max(largeurReference(String(cpt.de), tc), largeurReference(String(cpt.a), tc))) : 0;
        const xt = x0 + mx + (cpt ? wc + Math.round(V.ecartCompteur * k) : 0);
        const plein = Math.ceil(mesurer(g.b.texte, tb, "titre"));
        const largeurTexte = rangs === 2 && compact ? Math.min(x1 - mx - xt, Math.ceil(plein * 0.62)) : x1 - mx - xt;
        const r = texte(lignePseudo, xt, largeurTexte, tb, 1.02, rangs, { couleur: C.fond, fond: C.accent });
        if (!r) continue;
        if (rangs === 2 && r.rangs.length < 2) continue;
        delete r.pose.marque;
        const hc = cpt ? Math.round(tc * 0.9) : 0;
        const hInt = Math.max(r.hauteur, hc);
        const cadre = { x: x0, y: 0, largeur: xt - x0 + Math.max(...r.rangs.map((x) => x.largeur)) + mx + Math.round(6 * k), hauteur: hInt + 2 * my };
        const pose = decalerPose(r.pose, 0, my + Math.round((hInt - r.hauteur) / 2));
        const zone = { x: x0 + mx, y: my + Math.round((hInt - hc) / 2), largeur: wc, hauteur: hc };
        pose.elementId = idBloc(g.sceneId);
        pose.type = "mention";
        pose.niveau = "titre";
        pose.role = "resultat";
        pose.gabarit = { sorte: "bloc-orange", cadre, rayon: Math.round(V.rayon * k), fond: C.accent, ...(cpt ? { compteur: { de: cpt.de, a: cpt.a, zone, taille: tc } } : {}) };
        pose.px = cadre;
        pose.enc = cadre;
        return fini([pose]);
      }
      return null;
    }
    case "appel": {
      // La phrase finale en grand (sa dernière ligne en orange), le bouton plein à l'encre, l'adresse du site.
      const r = texte(g.ligne, x0, L, t.appel, 1.08, 5, { couleur: C.encre, gabarit: { sorte: "appel-plein", fond: C.fond } });
      if (!r) return null;
      delete r.pose.marque;
      r.pose.gabarit = { sorte: "appel-plein", fond: C.fond, accent: r.pose.lignes.length - 1 };
      const poses: Pose[] = [r.pose];
      let y = r.hauteur;
      // Le bouton, seulement quand la fin a un appel à réserver ET une autre phrase (une seule demande par fin).
      if (g.bouton) {
        const tb = Math.round(Math.max(T.bouton * k, t.detail) * Math.max(1, Math.min(1.12, t.f)));
        const mx = Math.round(T.margeBoutonX * k);
        const my = Math.round(T.margeBoutonY * k);
        const b = texte(g.bouton, x0 + mx, L - 2 * mx, tb, 1.18, 2, { couleur: C.fond, fond: C.encre }, "bouton");
        if (!b) return null;
        delete b.pose.marque;
        y += Math.round(64 * k * Math.min(1.3, t.f) * t.aere);
        const cadre = { x: x0, y: 0, largeur: b.pose.px.largeur + 2 * mx, hauteur: b.hauteur + 2 * my };
        const bp: Pose = { ...b.pose, type: "mention", gabarit: { sorte: "bouton", cadre, rayon: Math.round(T.rayonBouton * k), fond: C.encre }, enc: cadre };
        const bouton = decalerPose({ ...bp, lignes: bp.lignes.map((l) => ({ ...l, px: decaler(l.px, 0, my) })), px: decaler(bp.px, 0, my) }, 0, y);
        poses.push(bouton);
        y += cadre.hauteur;
      }
      if (!g.site) return fini(poses);
      const ts = Math.round(Math.max(T.site * k, t.detail));
      const site = texte(g.site, x0, L, ts, 1.2, 1, { couleur: C.mention, marque: "souligne", couleurMarque: C.accentTexte, epaisseurMarque: Math.round(T.trait * k) }, "detail");
      if (!site) return null;
      y += Math.round(44 * k * Math.min(1.3, t.f) * t.aere);
      const sp = decalerPose(site.pose, 0, y);
      sp.enc = { ...sp.px, hauteur: sp.px.hauteur + Math.round(14 * k) };
      poses.push(sp);
      return fini(poses);
    }
  }
}

/* ------------------------------------------------------------------ */
/* En-tête et visuel de la page                                          */
/* ------------------------------------------------------------------ */

/**
 * En-tête de la page, sous la barre des chapitres (qui nomme déjà la partie, choix de Will du 15/10) : rien, sauf sur
 * une page de l'exemple, où « Exemple illustratif » reste écrit en repère discret (un point sable et le texte, Inter,
 * sable assombri) : il dit que l'exemple est inventé (la mention du script, quand elle existe, y est écrite).
 */
function entete(c: ContenuPage, s: Sortie, basChapitres: number): { poses: Pose[]; bas: number } {
  const k = s.k;
  if (c.role !== "exemple") return { poses: [], bas: basChapitres };
  const yHaut = basChapitres + Math.round(T.ecartEtiquette * k);
  const taille = Math.round(T.partie * k);
  const il = Math.round(taille * 1.2);
  const libelle = typographie(libellePartie3(c.role));
  const P = Math.round(T.point * k);
  const point = { x: s.x0, y: Math.round(yHaut + (il - P) / 2), largeur: P, hauteur: P };
  const xl = s.x0 + P + Math.round(22 * k);
  const l = Math.ceil(mesurer(libelle, taille, "detail"));
  const lignes: Pose["lignes"] = [{ texte: libelle, px: { x: xl, y: yHaut, largeur: l, hauteur: il } }];
  const px = union([point, lignes[0].px]);
  const pose: Pose = {
    elementId: c.mention ? c.mention.id : `${c.premiere.id}~partie`,
    sceneId: c.mention ? c.mention.sceneId : c.premiere.id,
    type: "mention",
    niveau: "corps",
    taillePx: taille,
    couleurTexte: C.mention,
    couleurFond: C.fond,
    lignes,
    gabarit: { sorte: "partie", role: c.role, point, couleur: C.mention, couleurPoint: C.bordCarte },
    px,
    enc: px,
    heure: null,
  };
  return { poses: [pose], bas: px.y + px.hauteur };
}

/**
 * Le visuel en tête du contenu : la pastille d'étape à l'encre et « Étape 2 sur 4 » (une étape de la solution), sinon
 * UNE icône au trait fin (le dessin de la page, ou celui de sa partie).
 */
function visuel(c: ContenuPage, x0: number, x1: number, k: number, f: number): Bloc {
  if (c.numero) {
    const n = c.numero;
    const P = Math.round(T.pastille * k * Math.min(1.1, Math.max(0.7, f)));
    const disque = { x: x0, y: 0, largeur: P, hauteur: P };
    const taille = Math.round(P * 0.56);
    const il = Math.round(taille * 1.1);
    const chiffre = String(n.n);
    const l = Math.ceil(largeurReference(chiffre, taille));
    const te = Math.round(T.etape * k);
    const ile = Math.round(te * 1.2);
    const texteEtape = `Étape ${n.n} sur ${n.total}`;
    const le = Math.ceil(mesurer(texteEtape, te, "detail"));
    const xe = x0 + P + Math.round(30 * k);
    const etape = xe + le <= x1 ? { texte: texteEtape, x: xe, y: Math.round((P - ile) / 2), largeur: le, hauteur: ile, taille: te } : undefined;
    const enc = union([disque, ...(etape ? [{ x: etape.x, y: etape.y, largeur: etape.largeur, hauteur: etape.hauteur }] : [])]);
    const pose: Pose = { elementId: n.ecrit ? idNumero(n.sceneId) : `${c.premiere.id}~numero`, sceneId: n.sceneId, type: "chiffre", niveau: "titre", taillePx: taille, couleurTexte: C.fond, couleurFond: C.encre, lignes: [{ texte: chiffre, px: { x: Math.round(x0 + (P - l) / 2), y: Math.round((P - il) / 2), largeur: l, hauteur: il } }], gabarit: { sorte: "pastille", n: n.n, disque, couleur: C.encre, ...(etape ? { etape } : {}) }, px: disque, enc, ...(n.ecrit ? {} : { heure: null }) };
    return { hauteur: enc.hauteur, largeur: enc.largeur, poses: [pose] };
  }
  const D = Math.round(T.icone * k * Math.min(1.1, Math.max(0.8, f)));
  const r = { x: x0, y: 0, largeur: D, hauteur: D };
  const d = c.dessins[0];
  const pose: Pose = d
    ? { elementId: d.e.id, sceneId: d.sceneId, type: "dessin", lignes: [], dessinId: d.e.dessinId, cote: "gauche", px: r, enc: r }
    : { elementId: `${c.premiere.id}~icone`, sceneId: c.premiere.id, type: "dessin", lignes: [], dessinId: ICONES_PARTIES_3[c.role] ?? "document", cote: "gauche", px: r, enc: r, heure: null };
  return { hauteur: D, largeur: D, poses: [pose] };
}

/* ------------------------------------------------------------------ */
/* Page                                                                  */
/* ------------------------------------------------------------------ */

export interface PageRetenue {
  poses: Pose[];
  occupation: number;
  t: Tailles;
}

/**
 * La ligne en orange de la page, et son surlignage (pages de la douleur et de la solution). Page avec peps : aucune
 * ligne en orange (l'orange est au bloc et au visuel) ; sur la douleur et la solution, le marqueur orange franc sous le
 * mot-clé ; la pastille d'étape rebondit.
 */
function accentuer(poses: Pose[], c: ContenuPage, k: number): void {
  const peps = avecPeps(c);
  if (peps) for (const p of poses) if (p.gabarit?.sorte === "pastille") p.gabarit = { ...p.gabarit, peps: true };
  const titre = poses.find((p) => p.gabarit?.sorte === "titre");
  const phrase = poses.find((p) => p.gabarit?.sorte === "phrase");
  const cible = titre && (titre.lignes.length >= 2 || !phrase) ? titre : (phrase ?? titre);
  if (!cible || (cible.gabarit?.sorte !== "titre" && cible.gabarit?.sorte !== "phrase")) return;
  const i = cible.lignes.length - 1;
  const l = cible.lignes[i];
  let surligne: RectPx | undefined;
  if (c.role === "douleur" || c.role === "solution") {
    // Sous les deux derniers mots de la ligne (toute la ligne si elle n'en a que deux).
    const mots = motsEcrits(l.texte, "titre", cible.taillePx ?? 100, APPROCHE_REFERENCE);
    const de = mots[Math.max(0, mots.length - 2)];
    const fin = mots[mots.length - 1];
    if (de && fin) {
      const m = Math.round(10 * k);
      surligne = { x: Math.round(l.px.x + de.x - m), y: Math.round(l.px.y + l.px.hauteur * T.surlignageHaut), largeur: Math.round(fin.x + fin.largeur - de.x + 2 * m), hauteur: Math.round(l.px.hauteur * T.surlignageHauteur) };
    }
  }
  if (peps && surligne) {
    // Le marqueur balaie un peu plus haut et plus épais que le surlignage (maquette : 34 % à 96 % de la ligne).
    const m = Math.round(16 * k);
    surligne = { x: surligne.x - m + Math.round(10 * k), y: Math.round(l.px.y + l.px.hauteur * 0.34), largeur: surligne.largeur + 2 * (m - Math.round(10 * k)), hauteur: Math.round(l.px.hauteur * 0.6) };
  }
  cible.gabarit = { sorte: cible.gabarit.sorte, ...(peps ? {} : { accent: i }), ...(surligne ? { surligne } : {}), ...(peps && surligne ? { marqueur: true as const } : {}) };
}

/**
 * Pose une page : repère, puis le contenu (visuel, puis les blocs, en une ou deux colonnes) au plus grand qui tient,
 * AÉRÉ jusqu'à couvrir `T.remplissageVise` de la hauteur utile, au-dessus de la bande des sous-titres. Tailles : d'abord
 * celles visées pour la sortie (`CIBLES_GABARIT_3`), puis, si la page ne tient pas, ses minimums.
 */
function poserPage(c: ContenuPage, s: Sortie, basChapitres: number, avecDessin = true): PageRetenue | null {
  const k = s.k;
  const tete = entete(c, s, basChapitres);
  const haut = tete.bas + Math.round(T.ecartContenu * k * 0.6);
  const place = s.bas - haut;
  const utile = s.zone.y + s.zone.hauteur - tete.bas;
  const groupes = c.groupes;
  const minimums = MINIMUMS_GABARIT_3[s.format];
  if (!groupes.length) return { poses: tete.poses, occupation: 0, t: tailles(k, 1, minimums) };
  const centre = c.role === "accroche" || c.role === "appel";
  const modes: boolean[] = s.format === "horizontal" && groupes.length >= 2 && !centre ? [true, false] : s.format !== "vertical" && groupes.length >= 2 && !centre ? [false, true] : [false];
  // La tête de la page : le titre et le premier bloc qui le suit (ce qui arrive avec la page).
  const iPremier = groupes.findIndex((g) => g.sorte !== "titre");
  const enTete = (i: number) => groupes[i].sorte === "titre" || i === iPremier;
  // Peps : le visuel dessiné de la page (il remplace l'icône ; la pastille d'étape reste).
  const V = VISUELS_GABARIT_3;
  const vis = avecDessin && c.visuel ? { ...c.visuel, dessin: dessinVisuel3(c.visuel.v.id, optionsVisuel(c.visuel.v)) } : undefined;
  const E = vis ? encreVisuel3(vis.dessin) : undefined;
  const largeurRef = 1080 * k;
  let part: number = V.partVisee;
  /** Le visuel posé (encre à droite de `x1`, haut = `y`), et son décor. */
  const poseVisuel = (x1: number, y: number): Bloc => {
    const wv = Math.round(part * largeurRef);
    const sg = wv / E!.l;
    const encre = { x: x1 - wv, y, largeur: wv, hauteur: Math.round(E!.h * sg) };
    const boite = { x: Math.round(encre.x - E!.x * sg), y: Math.round(encre.y - E!.y * sg), largeur: Math.round(GRILLE_VISUEL_3 * sg), hauteur: Math.round(GRILLE_VISUEL_3 * sg) };
    const pose: Pose = { elementId: idVisuel(vis!.sceneId), sceneId: vis!.sceneId, type: "mention", lignes: [], gabarit: { sorte: "visuel", id: vis!.v.id, options: optionsVisuel(vis!.v), boite, encre }, px: encre, enc: encre };
    return { hauteur: encre.hauteur, largeur: encre.largeur, poses: [pose] };
  };
  const hVisuel = () => Math.round(E!.h * (Math.round(part * largeurRef) / E!.l));
  // Places possibles du visuel (une seule colonne) : les blocs [0, j) au-dessus, pleine largeur ; [j, m) à sa gauche,
  // dans une colonne réduite ; [m, n) dessous. Jamais le titre ni l'accroche à côté de lui ; (n, n) : le visuel sous le
  // texte, seul sur sa rangée.
  const n = groupes.length;
  // Dernier recours (sorties basses, où la place manque en hauteur) : tout le texte en colonne à gauche du visuel.
  const combos: [number, number][] = [];
  const recours: [number, number][] = [];
  if (vis) {
    for (let j = 0; j < n; j++) for (let m = j + 1; m <= n; m++) (groupes.slice(j, m).some((g) => g.sorte === "titre" || g.sorte === "accroche" || g.sorte === "appel") ? recours : combos).push([j, m]);
    combos.push([n, n]);
  }
  // L'icône peut céder sa place quand la page ne tient pas sans elle (sorties basses) ; la pastille d'étape, jamais :
  // elle passe alors à gauche du titre (`enLigne`).
  let avecIcone = !vis;
  let enLigne = false;
  let serre = false;
  const essayer = (f: number, deux: boolean, ecart: number, plancher: Planchers, ft = 1, combo?: [number, number]) => {
    const t = { ...tailles(k, f, plancher, ecart), serre };
    const tt = ft > 1 ? { ...tailles(k, f * ft, plancher, ecart, T.plafondsTete), serre } : t;
    const tDe = (i: number) => (enTete(i) ? tt : t);
    const e = Math.round(T.ecartBlocs * k * Math.min(1.2, Math.max(0.6, f)) * ecart);
    const blocsDe = (gs: Groupe[], decal: number, x0: number, x1: number) => {
      // Un bloc de tête qui ne tient plus en plus grand (un titre d'un mot, déjà à pleine largeur) garde sa taille.
      const bs = gs.map((g, i) => bloc(g, c, x0, x1, tDe(decal + i), enLigne) ?? (tDe(decal + i) !== t ? bloc(g, c, x0, x1, t, enLigne) : null));
      return bs.some((b) => !b) ? null : (bs as Bloc[]);
    };
    const colonne = (gs: Groupe[], decal: number, x0: number, x1: number, avecVisuel: boolean) => {
      const bs = blocsDe(gs, decal, x0, x1);
      if (!bs) return null;
      const pastilleEnLigne = enLigne && !!c.numero && groupes.some((g) => g.sorte === "titre");
      const blocs = [...(avecVisuel && !pastilleEnLigne && (avecIcone || c.numero) ? [visuel(c, x0, x1, k, f)] : []), ...bs];
      return { blocs, h: blocs.reduce((sm, b) => sm + b.hauteur, 0) + e * (blocs.length - 1) };
    };
    const hTeteDe = (blocs: Bloc[]) => blocs.slice(0, 1 + groupes.filter((_, i) => enTete(i)).length).reduce((sm, b) => sm + b.hauteur + e, -e);
    if (!deux && vis && combo) {
      // Une colonne, le visuel à sa place : au-dessus, la rangée du visuel (les blocs à sa gauche, centrés sur lui), dessous.
      const [j, m] = combo;
      const gap = Math.max(Math.round(V.ecartVisuel * k), V.airMin);
      const xVis = s.x1 - Math.round(part * largeurRef) - gap;
      const avant = colonne(groupes.slice(0, j), 0, s.x0, s.x1, true);
      const cote = blocsDe(groupes.slice(j, m), j, s.x0, j === m ? s.x1 : xVis);
      const apres = blocsDe(groupes.slice(m), m, s.x0, s.x1);
      if (!avant || !cote || !apres) return null;
      const hv = hVisuel();
      const hCote = cote.reduce((sm, b) => sm + b.hauteur, 0) + e * Math.max(0, cote.length - 1);
      const hZone = Math.max(hv, hCote);
      const poses: Pose[] = [];
      let y = Math.round((hZone - hCote) / 2);
      for (const b of cote) {
        poses.push(...b.poses.map((p) => decalerPose(p, 0, y)));
        y += b.hauteur + e;
      }
      poses.push(...poseVisuel(s.x1, Math.round((hZone - hv) / 2)).poses);
      const zone: Bloc = { hauteur: hZone, largeur: s.x1 - s.x0, poses };
      const blocs = [...avant.blocs, zone, ...apres];
      const h = blocs.reduce((sm, b) => sm + b.hauteur, 0) + e * (blocs.length - 1);
      return { t, colonnes: [{ blocs, h }], h, hTete: hTeteDe(blocs), e, deux, plancher, ft, combo };
    }
    if (!deux) {
      const col = colonne(groupes, 0, s.x0, s.x1, true);
      if (!col) return null;
      return { t, colonnes: [col], h: col.h, hTete: hTeteDe(col.blocs), e, deux, plancher, ft, combo };
    }
    // Deux colonnes : le visuel, le titre et la phrase clé à gauche, le reste à droite (et le visuel dessiné, dessous).
    const gout = Math.round(72 * k);
    const mil = Math.round((s.x0 + s.x1) / 2);
    let coupe = groupes.findIndex((g) => g.sorte !== "titre" && g.sorte !== "phrase");
    if (coupe <= 0) coupe = vis ? n : Math.ceil(groupes.length / 2);
    const c1 = colonne(groupes.slice(0, coupe), 0, s.x0, mil - gout / 2, true);
    const c2 = colonne(groupes.slice(coupe), coupe, mil + gout / 2, s.x1, false);
    if (!c1 || !c2) return null;
    if (vis) {
      // Le visuel va sous la colonne la plus courte, aligné à droite de sa colonne.
      if (Math.round(part * largeurRef) > s.x1 - mil - gout / 2) return null;
      const [col, x1] = c1.h <= c2.h ? [c1, Math.round(mil - gout / 2)] : [c2, s.x1];
      col.blocs.push(poseVisuel(x1, 0));
      col.h = col.blocs.reduce((sm, b) => sm + b.hauteur, 0) + e * (col.blocs.length - 1);
    }
    if (!c2.blocs.length) return null;
    return { t, colonnes: [c1, c2], h: Math.max(c1.h, c2.h), hTete: c1.h, e, deux, plancher, ft, combo };
  };
  /** Le meilleur essai à un facteur donné : le plus compact des combos qui tiennent (sans visuel : l'unique). */
  const meilleur = (f: number, deux: boolean, ecart: number, plancher: Planchers, limite: number, ft = 1) => {
    if (!vis || deux) {
      const x = essayer(f, deux, ecart, plancher, ft);
      return x && x.h <= limite ? x : null;
    }
    let res: ReturnType<typeof essayer> = null;
    for (const liste of [combos, recours]) {
      for (const cb of liste) {
        const x = essayer(f, deux, ecart, plancher, ft, cb);
        if (x && x.h <= limite && (!res || x.h < res.h - 0.5)) res = x;
      }
      if (res) break;
    }
    return res;
  };
  const cible = CIBLES_GABARIT_3[s.format];
  let r: ReturnType<typeof essayer> = null;
  // Replis, dans l'ordre : l'icône cède sa place (la pastille passe à gauche du titre), puis les cartes « avant →
  // après » se serrent (une étape « Remplacez » à deux exemples, dans les sorties basses). Avec un visuel : il se fait
  // un peu plus petit (40 %, puis 37,5 %, puis 35 % de la largeur de référence) avant tout repli.
  const replis: [boolean, boolean][] = [[false, false], [true, false], ...(groupes.some((g) => g.sorte === "transformation") ? [[true, true] as [boolean, boolean]] : [])];
  const parts = vis ? [V.partVisee, (V.partVisee + V.partMin) / 2, V.partMin] : [V.partVisee];
  for (const [repli, serrer] of replis) {
    enLigne = repli;
    serre = serrer;
    if (!c.numero && !vis) avecIcone = !repli;
    for (const plancher of [cible, minimums]) {
      for (const pv of parts) {
        part = pv;
        for (const deux of modes) {
          // Plus grand facteur qui tient (jusqu'à `grandirMax`, à 85 % de la place pour garder de l'air), sinon on réduit.
          for (let f = T.grandirMax; f >= 0.5 - 1e-9 && !r; f -= 0.025) r = meilleur(f, deux, 1, plancher, f > 1 ? place * 0.85 : place);
          if (r) break;
        }
        if (r) break;
      }
      if (r) break;
    }
    if (r) break;
  }
  if (!r) return vis ? poserPage(c, s, basChapitres, false) : null;
  // La tête grandit jusqu'à couvrir la part visée de la hauteur utile (le reste de la page tient toujours) ; puis, tant
  // que la page n'est pas remplie, elle grandit encore plutôt que d'écarter les blocs.
  const base = r;
  for (let ft = 1.05; ft <= T.grandirTeteMax + 1e-9 && (r.hTete < T.teteVisee * utile || r.h < T.remplissageVise * utile) && !centre; ft += 0.05) {
    const x = essayer(base.t.f, base.deux, 1, base.plancher, ft, base.combo);
    if (x && x.h <= place * 0.92 && x.hTete > r.hTete) r = x;
  }
  // Aération : les écarts s'ouvrent jusqu'à ce que le contenu couvre la part visée de la hauteur utile.
  for (let g = 1.1; g <= T.ecartMaxFacteur + 1e-9 && r.h < T.remplissageVise * utile; g += 0.1) {
    const x = essayer(r.t.f, r.deux, g, r.plancher, r.ft, r.combo);
    if (!x || x.h > place) break;
    r = x;
  }
  const poses: Pose[] = [...tete.poses];
  // Centré dans la place libre (un peu au-dessus, comme la maquette), jamais sous le repère ni dans la bande.
  const y0 = Math.round(Math.max(haut, Math.min(s.bas - r.h, haut + (place - r.h) * (0.5 - T.centreOptique))));
  r.colonnes.forEach((col) => {
    // Deux colonnes : même haut (les deux colonnes se lisent côte à côte).
    let y = y0;
    for (const b of col.blocs) {
      poses.push(...b.poses.map((p) => decalerPose(p, 0, y)));
      y += b.hauteur + r!.e;
    }
  });
  accentuer(poses, c, k);
  if (vis) flecheVersVisuel(poses, k);
  const contenu = poses.filter((p) => !tete.poses.includes(p));
  const bas = Math.max(...contenu.map((p) => p.enc.y + p.enc.hauteur));
  const dessus = Math.min(...contenu.map((p) => p.enc.y));
  return { poses, occupation: arrondi6((bas - dessus) / utile), t: r.t };
}

/** Ce qu'écrit un visuel (les champs de la fiche, sans son mot de départ). */
function optionsVisuel(v: VisuelScene): { chiffre?: string; libelle?: string; gauche?: string; droite?: string } {
  return { ...(v.chiffre ? { chiffre: v.chiffre } : {}), ...(v.libelle ? { libelle: v.libelle } : {}), ...(v.gauche ? { gauche: v.gauche } : {}), ...(v.droite ? { droite: v.droite } : {}) };
}

/** Distance (px) d'un point à un rectangle (0 dedans). */
const distanceRect = (q: { x: number; y: number }, r: RectPx) => Math.hypot(Math.max(r.x - q.x, 0, q.x - (r.x + r.largeur)), Math.max(r.y - q.y, 0, q.y - (r.y + r.hauteur)));

/**
 * Flèche dessinée du bloc orange vers le visuel (maquette, page d'accroche) : seulement quand le bloc est juste
 * au-dessus du visuel et qu'il reste de la place à sa droite ; elle part 20 px à droite du bloc, à mi-hauteur, et
 * pique sur le haut du visuel ; jamais à moins de 12 px d'un texte (sinon, pas de flèche).
 */
function flecheVersVisuel(poses: Pose[], k: number): void {
  const v = poses.find((p) => p.gabarit?.sorte === "visuel");
  const b = poses.find((p) => p.gabarit?.sorte === "bloc-orange");
  if (!v || !b || v.gabarit?.sorte !== "visuel") return;
  const e = v.gabarit.encre;
  const ax = b.px.x + b.px.largeur + 20 * k;
  const ay = b.px.y + b.px.hauteur * 0.42;
  const bx = e.x + e.largeur * 0.6;
  const by = e.y - 8 * k;
  // Le bloc est au-dessus du visuel, à sa gauche, et rien ne s'intercale entre eux.
  if (b.px.y + b.px.hauteur > e.y || ax > bx - 60 * k || by - ay < 40 * k) return;
  const corps: { x: number; y: number }[] = [];
  const c1 = { x: ax + 70 * k, y: ay - 18 * k };
  const c2 = { x: bx + 4 * k, y: ay - 8 * k };
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const w = 1 - u;
    corps.push({ x: Math.round((w * w * w * ax + 3 * w * w * u * c1.x + 3 * w * u * u * c2.x + u * u * u * bx) * 10) / 10, y: Math.round((w * w * w * ay + 3 * w * w * u * c1.y + 3 * w * u * u * c2.y + u * u * u * by) * 10) / 10 });
  }
  const tete = [
    { x: bx - 24 * k, y: by - 28 * k },
    { x: bx, y: by },
    { x: bx + 22 * k, y: by - 30 * k },
  ];
  const textes = poses.filter((p) => p !== v && p.lignes.length).flatMap((p) => p.lignes.map((l) => l.px));
  const air = VISUELS_GABARIT_3.airMin;
  if ([...corps, ...tete].some((q) => textes.some((r) => distanceRect(q, r) < air + VISUELS_GABARIT_3.traitFleche * k))) return;
  v.gabarit = { ...v.gabarit, fleche: { corps, tete } };
}

/** Met en page une fiche « reference/3 ». Lève `ErreurMiseEnPage` si une page ne tient pas ou montre plus de 3 blocs. */
export function mettreEnPageParties(fiche: FicheTableau, options: OptionsMiseEnPage = {}): MiseEnPageTableau {
  const s = sortie(options);
  const k = s.k;
  // Trois styles du tableau (16/10/2026) : le style de la fiche (posé à la fabrication depuis sa série) ; absent, la
  // page ivoire d'avant.
  const style = estStyleTableau(fiche.styleTableau) ? fiche.styleTableau : undefined;
  const geo = style ? geometrieTableau(s, style) : undefined;
  // Barre des chapitres nommés, en haut de la zone sûre : les barres, puis leurs noms dessous (dessinés par le rendu).
  const barre = { x: s.x0, y: s.haut, largeur: s.x1 - s.x0, hauteur: Math.max(4, Math.round(T.barre * k)) };
  const tailleNom = geo ? geo.tailleChapitre : Math.round(T.nomChapitre * k);
  const nomsChapitres = geo ? { ...union(geo.chapitres), taille: tailleNom } : { x: s.x0, y: barre.y + barre.hauteur + Math.round(T.ecartNomChapitre * k), largeur: s.x1 - s.x0, hauteur: Math.round(tailleNom * 1.25), taille: tailleNom };
  const basChapitres = geo ? geo.hautContenu : nomsChapitres.y + nomsChapitres.hauteur;
  const ecritsUneFois: string[] = [];
  const suivent: Record<string, string | null> = {};
  const poses3: string[] = [];
  const parties: Record<number, string> = {};
  const minimums = MINIMUMS_GABARIT_3[s.format];
  const pages = contenus(fiche, options).map((c): PagePlacee => {
    parties[c.page] = c.role;
    const nBlocs = c.groupes.length;
    if (nBlocs > BORNES_GABARIT_3.blocsMax)
      throw new ErreurMiseEnPage(`Page ${c.page} · scène ${c.derniere.id} · la page montre ${nBlocs} blocs ; ${BORNES_GABARIT_3.blocsMax} au plus : mettez la dernière scène sur une page de plus.`, c.page);
    // Trois styles : l'air sous le contenu laisse la place à l'outil quand il écrit la dernière ligne (maquettes).
    // L'air sous le contenu : celui des maquettes, et si la page tient, ce que l'outil occupe sous sa pointe (paperboard
    // en 16:9, vidéo v-b2d772d28b97 : le marqueur entrait dans la bande des sous-titres en écrivant la dernière ligne).
    const air = Math.round((s.H > s.W ? 64 : 40) * k);
    const airPlein = Math.max(air, Math.ceil(airOutil(style ?? "ardoise", k)));
    const r = style ? (poserPageTableau(c, s, style, basChapitres, s.bande.y - airPlein) ?? (airPlein > air ? poserPageTableau(c, s, style, basChapitres, s.bande.y - air) : null)) : poserPage(c, s, basChapitres);
    if (!r) throw new ErreurMiseEnPage(`Page ${c.page} · scène ${c.derniere.id} · la page ne tient pas au-dessus de la bande des sous-titres, même aux tailles minimales (titre ${minimums.titre}, phrase clé ${minimums.phrase}, détails ${minimums.detail} px) : raccourcissez une ligne, ou mettez la dernière scène sur une page de plus.`, c.page);
    ecritsUneFois.push(...c.doubles.keys());
    const elements: ElementPlace[] = [];
    let ordre = 0;
    // Ce qui arrive avec la page : le repère, son visuel, le titre ET le premier bloc qui le suit (jamais un titre
    // seul : la page arrive quand la voix dit ce bloc, `debutPage3`), l'accroche, la page d'appel entière.
    const premierBloc = c.groupes.find((g) => g.sorte !== "titre");
    const idsPoses = new Set<string>();
    for (const p of r.poses) {
      const g = p.gabarit?.sorte;
      // Trois styles du tableau (critique #291, I2) : seuls le repère et le numéro arrivent avec la page (et l'accroche,
      // entière à la première image) ; tout le reste naît sous la pointe de l'outil.
      if (style ? g === "partie" || g === "pastille" || g === "accroche" : g === "partie" || g === "titre" || g === "accroche" || g === "pastille" || p.type === "dessin" || c.role === "appel") idsPoses.add(p.elementId);
    }
    if (!style && premierBloc && c.role !== "accroche" && c.role !== "appel") {
      const comp = premierBloc.sorte === "comparaison" ? (premierBloc.avant ?? premierBloc.apres)?.l.id : undefined;
      const ids = premierBloc.sorte === "bloc" ? [idBloc(premierBloc.sceneId)] : "ligne" in premierBloc ? [premierBloc.ligne.l.id] : "lignes" in premierBloc ? [premierBloc.lignes[0].l.id] : comp ? [comp, `${comp}~etiquette`] : [];
      for (const id of ids) idsPoses.add(id);
    }
    // « À retenir » : la liste est déjà là, pâle ; chaque élément se coche quand la voix le dit.
    for (const p of r.poses) if (p.gabarit?.sorte === "case" && p.gabarit.attente) idsPoses.add(`${p.elementId}#attente`);
    poses3.push(...idsPoses);
    for (const p of r.poses) {
      const { enc, heure, px, lignes, ...reste } = p;
      elements.push({ ...reste, ordre: ordre++, ...rect(px, s), lignes: lignes.map((l) => ({ ...l, ...rect(l.px, s) })) as LigneVisuelle[], encombrement: rect(enc, s) });
      if (heure !== undefined) suivent[p.elementId] = heure;
      else if (/~\d+$/.test(p.elementId)) suivent[p.elementId] = p.elementId.replace(/~\d+$/, "");
      else if (/~(site|phrase|bouton)$/.test(p.elementId)) suivent[p.elementId] = null;
    }
    const gestes: GestePlace[] = [];
    for (const { e, sceneId } of c.gestes) {
      const id = c.doubles.get(e.cibleId) ?? e.cibleId;
      const cible = elements.find((x) => x.elementId === id && x.type !== "dessin");
      if (!cible) continue;
      gestes.push({ elementId: e.id, sceneId, geste: e.geste as Geste, cibleId: id, cible: { px: cible.px, fraction: cible.fraction }, ordre: ordre++ });
    }
    return { page: c.page, echelle: "t" in r ? r.t.f : r.f, occupation: r.occupation, elements, gestes };
  });
  const reference: MiseEnPageReference = {
    style: STYLE_REFERENCE_3,
    k,
    signature: { x: s.zone.x, y: s.zone.y + s.zone.hauteur, largeur: 0, hauteur: 0, taillePx: Math.round(TAILLES_REFERENCE.signature * k) },
    pagesSansSignature: pages.map((p) => p.page),
    ajouts: [],
    ecritsUneFois,
    suivent,
    poses: poses3,
    barre,
    nomsChapitres,
    parties,
    ...(style && geo ? { tableau: { style, chapitres: geo.chapitres, tailleChapitre: geo.tailleChapitre, surface: geo.surface, basSupport: geo.basSupport, contenu: geo.contenu } } : {}),
  };
  const autre = s.format !== "vertical";
  return {
    version: VERSION_MISE_EN_PAGE,
    ...(autre ? { format: s.format, reference: referenceFormat(s.format) } : {}),
    largeurPx: s.W,
    hauteurPx: s.H,
    zoneSure: rect(s.zone, s),
    bandeSousTitres: rect(s.bande, s),
    cadre: rect({ x: s.x0, y: s.haut, largeur: s.x1 - s.x0, hauteur: s.bas - s.haut }, s),
    pages,
    styleReference: reference,
  };
}

/** Le décor d'un élément, déplacé. */
function decalerDecor(g: DecorGabarit, dx: number, dy: number): DecorGabarit {
  const d = (r: { x: number; y: number; largeur: number; hauteur: number }) => decaler(r, dx, dy);
  switch (g.sorte) {
    case "pastille":
      return { ...g, disque: d(g.disque), ...(g.etape ? { etape: { ...g.etape, x: g.etape.x + dx, y: g.etape.y + dy } } : {}) };
    case "code":
      return { ...g, disque: d(g.disque) };
    case "case":
      return { ...g, boite: d(g.boite) };
    case "avant-apres":
      return { ...g, cadre: d(g.cadre), disque: d(g.disque) };
    case "bouton":
      return { ...g, cadre: d(g.cadre) };
    case "partie":
      return { ...g, point: d(g.point) };
    case "idee":
      return { ...g, cadre: d(g.cadre), signe: d(g.signe), texte: { ...g.texte, x: g.texte.x + dx, y: g.texte.y + dy } };
    case "accroche":
      return { ...g, mots: g.mots.map((m) => ({ ...m, zone: d(m.zone) })) };
    case "transformation":
      return { ...g, carte: d(g.carte), fleche: { x1: g.fleche.x1 + dx, y1: g.fleche.y1 + dy, x2: g.fleche.x2 + dx, y2: g.fleche.y2 + dy } };
    case "titre":
    case "phrase":
      return "surligne" in g && g.surligne ? { ...g, surligne: d(g.surligne) } : g;
    case "visuel": {
      const pt = (q: { x: number; y: number }) => ({ x: q.x + dx, y: q.y + dy });
      return { ...g, boite: d(g.boite), encre: d(g.encre), ...(g.fleche ? { fleche: { corps: g.fleche.corps.map(pt), tete: g.fleche.tete.map(pt) } } : {}) };
    }
    case "bloc-orange":
      return { ...g, cadre: d(g.cadre), ...(g.compteur ? { compteur: { ...g.compteur, zone: d(g.compteur.zone) } } : {}) };
    default:
      return g;
  }
}

/** Largeur d'un texte dans la police du style (pour les contrôles). */
export const largeurParties = (t: string, taille: number) => largeurEcrite(t, "titre", taille, APPROCHE_REFERENCE);
