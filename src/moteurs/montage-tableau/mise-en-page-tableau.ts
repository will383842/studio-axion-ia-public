/**
 * MISE EN PAGE DES TROIS STYLES DU TABLEAU « on écrit sur un vrai tableau » (maquettes validées, PR #280,
 * `maquettes/tableau-v2/`, 16/10/2026) : A tableau blanc premium, B ardoise Axion, C paperboard d'atelier. PURE et
 * déterministe ; même contrat que la page ivoire (`mise-en-page-v3.ts` : mêmes contenus de page, mêmes identifiants,
 * mêmes heures, mêmes décors lus par l'animation `animation-3.ts`), d'autres poses :
 *  - écriture MANUSCRITE (Permanent Marker en capitales et Kalam pour A, Kalam pour B, Caveat Brush pour C), mesurée
 *    sur les fichiers de police ;
 *  - une page = une idée, de haut en bas : l'en-tête de la partie (pastille d'étape et « Étape 1 sur 3 », repère
 *    « Exemple illustratif », « À retenir »), le titre en très grand, la phrase (sans le titre qu'elle répéterait), puis
 *    un DESSIN ILLUSTRÉ (sablier, horloge, feuilles, loupe…) ou les rangées d'une liste (case, dessin, texte), ou
 *    l'exemple « Avant / Maintenant » aux chiffres dits en très grand ;
 *  - le contenu couvre 85 à 95 % de la hauteur utile (sous la barre des chapitres, au-dessus de la bande des
 *    sous-titres) : les dessins grandissent ou rapetissent pour remplir la page, jamais le texte n'est coupé ;
 *  - alignée à gauche (A, C) ou centrée, symétrique (B) ; un seul accent orange fort par page.
 * Les dessins sont des polylignes ordonnées (contour → remplissage → ombre) que l'outil trace (`ElementPlace.tableau`).
 */
import { CHARTES_TABLEAU, type CharteTableau, type PoliceTableau, type StyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { INTERLIGNES_TABLEAU, couperTableau, coupeUnGroupe, largeurTableau } from "@/briques/tableau-scene/trois-styles/mesure";
import { banderole, barre, calendrier, carteCroquis, chrono, eclat, enveloppe, etoile, feuilleBrouillon, feuilleDemande, fleche, flecheCourbe, horloge, loupe, medaillon, pointeur, rayons, reveil, sablier, souligne, surligneur, telephone } from "@/briques/tableau-scene/trois-styles/dessins";
import { boiteTraits, cadrer, ellipse, graineDe, minuter, plume, polyPts, rectArr, remplir, trait, tremble, type Plume, type TraitTableau } from "@/briques/tableau-scene/trois-styles/trace";
import type { ElementTableauPlace, ObjetTableau } from "@/briques/tableau-scene/trois-styles/types";
import type { DecorGabarit } from "@/briques/tableau-scene/reference/types";
import { cleMot, idBloc, idNumero, idVisuel } from "./fiche";
import { cotesTransformation } from "./gabarit-3";
import type { RectPx } from "./mise-en-page";
import { decalerPose, union, type ContenuPage, type Groupe, type Ligne, type Pose, type Sortie } from "./mise-en-page-v3";
import { typographie } from "./mise-en-page-gabarit";

/** Tailles de référence (px, 1080 de large) de chaque style, reprises des maquettes. */
const TAILLES: Record<StyleTableau, { titre: number; accrochePetit: number; sousTitre: number; phrase: number; detail: number; item: number; etiquette: number; etape: number; chiffre: number; grandChiffre: number; bouton: number; site: number; chapitre: number; mention: number }> = {
  "tableau-blanc": { titre: 128, accrochePetit: 84, sousTitre: 58, phrase: 86, detail: 62, item: 82, etiquette: 70, etape: 66, chiffre: 168, grandChiffre: 360, bouton: 90, site: 106, chapitre: 54, mention: 54 },
  ardoise: { titre: 132, accrochePetit: 80, sousTitre: 58, phrase: 88, detail: 62, item: 74, etiquette: 70, etape: 58, chiffre: 320, grandChiffre: 350, bouton: 96, site: 106, chapitre: 54, mention: 54 },
  paperboard: { titre: 150, accrochePetit: 80, sousTitre: 66, phrase: 98, detail: 70, item: 96, etiquette: 72, etape: 66, chiffre: 180, grandChiffre: 310, bouton: 116, site: 128, chapitre: 54, mention: 56 },
};

/** Taille de départ du corps de l'accroche (px de référence), mesurée sur les maquettes (« et leurs mails » sur une ligne). */
const ACCROCHE_TABLEAU: Record<StyleTableau, number> = { "tableau-blanc": 108, ardoise: 128, paperboard: 150 };

/** Planchers (px de référence) : jamais un texte plus petit. */
const MINIMUMS = { titre: 84, phrase: 58, detail: 54, item: 54, chapitre: 44 } as const;

/** Part de la hauteur utile que couvre le contenu (visée, et bornes du contrôle). */
export const REMPLISSAGE_TABLEAU = { vise: 0.9, min: 0.85, max: 0.95 } as const;

/** Géométrie et outils d'une page. */
interface Geo {
  s: Sortie;
  S: CharteTableau;
  style: StyleTableau;
  k: number;
  /** Facteur de taille de la page (1 : tailles de référence ; descend si la page ne tient pas). */
  f: number;
  x0: number;
  x1: number;
  /** Haut et bas du contenu (sous la barre des chapitres, au-dessus de la bande). */
  haut: number;
  bas: number;
  P: Plume;
  /** Repli des sorties basses : les planchers baissent encore (1 : ceux de la sortie). */
  repli?: number;
  /** Bord gauche de la page (celui de la sortie, ou un peu plus à droite quand un décor déborderait de la zone sûre). */
  bord?: number;
}

/** Un bloc posé (haut = 0). */
interface Bloc {
  h: number;
  poses: Pose[];
}

/** Une rangée de la page : fixe (texte), ou souple (dessin, liste, exemple) entre `min` et `max` de hauteur. */
type Rang = { sorte: "fixe"; bloc: Bloc } | { sorte: "souple"; min: number; max: number; poser: (h: number) => Bloc };

const T = (g: Geo) => TAILLES[g.style];
/** Facteur des planchers selon la sortie : les sorties basses (carré, 16:9) écrivent un peu plus petit, comme la page ivoire. */
const PLANCHERS_SORTIE: Record<string, number> = { vertical: 1, portrait: 0.92, carre: 0.78, horizontal: 0.8 };
/** Plancher commun du contrôle de l'image (`texteMin` : 44 px de référence, 4,1 % de la hauteur) : jamais en dessous. */
const PLANCHER_IMAGE = 46;
const mini = (g: Geo, cle: keyof typeof MINIMUMS) => Math.max(Math.round(PLANCHER_IMAGE * g.k), Math.round(MINIMUMS[cle] * g.k * (PLANCHERS_SORTIE[g.s.format] ?? 1) * (g.repli ?? 1)));
const px = (g: Geo, v: number) => Math.round(v * g.k);
const milieu = (g: Geo) => Math.round((g.x0 + g.x1) / 2);

/* ------------------------------------------------------------------ */
/* Texte                                                                 */
/* ------------------------------------------------------------------ */

interface OptionsTexte {
  police: PoliceTableau;
  taille: number;
  min: number;
  couleur: string;
  max: number;
  x0?: number;
  x1?: number;
  centre?: boolean;
  fond?: string;
  majuscules?: boolean;
  interligne?: number;
  gabarit?: DecorGabarit;
  /** Jamais un déterminant séparé de son nom en fin de rangée : la taille baisse plutôt (accroche, critique #291 I3). */
  groupes?: boolean;
  id?: string;
  type?: Pose["type"];
}

/** Un texte posé (haut = 0), au plus grand qui tient de `taille` à `min` en `max` rangées ; `null` sinon. */
function ecrire(g: Geo, ligne: Ligne, o: OptionsTexte): { pose: Pose; h: number; rangs: { texte: string; largeur: number }[]; taille: number } | null {
  const x0 = o.x0 ?? g.x0;
  const x1 = o.x1 ?? g.x1;
  const brut = typographie(ligne.l.texte);
  const texte = o.majuscules ? brut.toLocaleUpperCase("fr-FR") : brut;
  for (let taille = Math.round(Math.max(o.taille, o.min)); taille >= Math.round(o.min); taille = Math.floor(taille * 0.96)) {
    const rs = couperTableau(texte, o.police, taille, x1 - x0);
    if (!rs || rs.length > o.max || (o.groupes && coupeUnGroupe(rs))) continue;
    const il = Math.round(taille * INTERLIGNES_TABLEAU[o.police] * (o.interligne ?? 1));
    const lignes = rs.map((r, i) => ({ texte: r.texte, px: { x: o.centre ? Math.round((x0 + x1) / 2 - r.largeur / 2) : Math.round(x0), y: i * il, largeur: r.largeur, hauteur: il } }));
    const cadre = union(lignes.map((l) => l.px));
    const tableau: ElementTableauPlace = { lignes: rs.map(() => ({ police: o.police, taille, couleur: o.couleur })) };
    const pose: Pose = { elementId: o.id ?? ligne.l.id, sceneId: ligne.sceneId, type: o.type ?? "ligne", niveau: o.police === g.S.titre && taille >= 84 * g.k ? "titre" : "corps", taillePx: taille, couleurTexte: o.couleur, couleurFond: o.fond ?? g.S.fond, lignes, role: ligne.l.role, px: cadre, enc: cadre, tableau, ...(o.gabarit ? { gabarit: o.gabarit } : {}) };
    return { pose, h: cadre.hauteur, rangs: rs, taille };
  }
  return null;
}

/** Déplace une pose, ses traits et ses objets. */
function deplacer(p: Pose, dx: number, dy: number): Pose {
  const q = decalerPose(p, dx, dy);
  if (!p.tableau) return q;
  const dt = (ts?: TraitTableau[]) => ts?.map((t) => ({ ...t, p: t.p.map((v, i) => Math.round((v + (i % 2 ? dy : dx)) * 10) / 10) }));
  const t = p.tableau;
  return { ...q, tableau: { ...t, ...(t.avant ? { avant: dt(t.avant) } : {}), ...(t.apres ? { apres: dt(t.apres) } : {}), ...(t.objets ? { objets: t.objets.map((o) => ({ ...o, x: o.x + dx, y: o.y + dy })) } : {}) } };
}

const bloc = (poses: Pose[]): Bloc => {
  const u = union(poses.map((p) => p.enc));
  return { h: u.y + u.hauteur, poses };
};

/**
 * La boîte d'un objet posé, telle que le rendu le dessine (`PageTableau.tsx`) : un ruban est CENTRÉ sur (x, y) et tourné
 * (ses pointes débordent de 3 px de référence) ; les autres objets partent de leur coin (x, y).
 */
export function boiteObjet(o: ObjetTableau): RectPx {
  if (o.sorte !== "ruban") return { x: Math.floor(o.x), y: Math.floor(o.y), largeur: Math.ceil(o.l), hauteur: Math.ceil(o.h) };
  const a = ((o.rot ?? 0) * Math.PI) / 180;
  const l = o.l + 6;
  const dx = (Math.abs(l * Math.cos(a)) + Math.abs(o.h * Math.sin(a))) / 2;
  const dy = (Math.abs(l * Math.sin(a)) + Math.abs(o.h * Math.cos(a))) / 2;
  return { x: Math.floor(o.x - dx), y: Math.floor(o.y - dy), largeur: Math.ceil(2 * dx), hauteur: Math.ceil(2 * dy) };
}

/** L'encombrement d'une pose : son texte, ses traits et ses objets. */
function encombrer(p: Pose): Pose {
  const rs: RectPx[] = [p.px, p.enc];
  const ts = [...(p.tableau?.avant ?? []), ...(p.tableau?.apres ?? [])];
  if (ts.length) {
    const b = boiteTraits(ts);
    rs.push({ x: Math.floor(b.x), y: Math.floor(b.y), largeur: Math.ceil(b.largeur), hauteur: Math.ceil(b.hauteur) });
  }
  for (const o of p.tableau?.objets ?? []) rs.push(boiteObjet(o));
  return { ...p, enc: union(rs) };
}

/** Ajoute des traits (avant ou après le texte) à une pose, minutés sur `duree` (s). */
function avecTraits(p: Pose, quand: "avant" | "apres", ts: TraitTableau[], duree: number): Pose {
  if (!ts.length) return p;
  const t = p.tableau ?? { lignes: [] };
  return encombrer({ ...p, tableau: { ...t, [quand]: [...(t[quand] ?? []), ...minuter(ts, duree)] } });
}

const avecObjets = (p: Pose, objets: ObjetTableau[]): Pose => encombrer({ ...p, tableau: { ...(p.tableau ?? { lignes: [] }), objets: [...(p.tableau?.objets ?? []), ...objets] } });

/**
 * Un élément sans texte qui ne porte que des traits (le dessin illustré de la page) ; `suit` : l'élément dont il prend
 * l'heure (il se trace juste après lui, pendant que la voix en parle) ; `null` : il part au début de sa scène.
 */
function croquis(g: Geo, id: string, sceneId: string, ts: TraitTableau[], duree: number, suit?: string | null): Pose {
  const b = boiteTraits(ts);
  const r = { x: Math.floor(b.x), y: Math.floor(b.y), largeur: Math.ceil(b.largeur), hauteur: Math.ceil(b.hauteur) };
  return { elementId: id, sceneId, type: "mention", lignes: [], px: r, enc: r, tableau: { lignes: [], apres: minuter(ts, duree) }, ...(suit !== undefined ? { heure: suit } : {}) };
}

/** Zones des mots importants d'un texte posé (pour l'accroche : soulignés ou entourés quand la voix les dit). */
function motsImportants(g: Geo, ligne: Ligne, pose: Pose, police: PoliceTableau, taille: number, depuis = 0): Extract<DecorGabarit, { sorte: "accroche" }>["mots"] {
  const voulus = (ligne.l.importants ?? []).map(cleMot);
  const res: Extract<DecorGabarit, { sorte: "accroche" }>["mots"] = [];
  if (!voulus.length) return res;
  const esp = largeurTableau(" ", police, taille);
  const pris = new Set<number>();
  pose.lignes.forEach((l, iRang) => {
    if (iRang < depuis) return;
    let x = l.px.x;
    for (const u of l.texte.split(/\s+/).filter(Boolean)) {
      const w = largeurTableau(u, police, taille);
      const k0 = voulus.findIndex((v, i) => v === cleMot(u) && !pris.has(i));
      if (k0 >= 0) {
        pris.add(k0);
        res.push({ k: k0, kFin: k0, zone: { x: Math.round(x - 8 * g.k), y: Math.round(l.px.y + l.px.hauteur * 0.1), largeur: Math.round(w + 16 * g.k), hauteur: Math.round(l.px.hauteur * 0.8) }, ligne: iRang });
      }
      x += w + esp;
    }
  });
  return res;
}

/* ------------------------------------------------------------------ */
/* Dessins illustrés : choix par les mots de la page                      */
/* ------------------------------------------------------------------ */

type Theme = "temps-mails" | "flux" | "relire" | "temps" | "mails" | "calendrier" | "telephone" | "notes" | "rapide";

/** Le thème du dessin d'une page, lu dans ses mots (écrits et dits) et dans le visuel choisi par la fiche. */
export function themeDessin(texte: string, visuel?: string): Theme {
  const t = texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const a = (re: RegExp) => re.test(t);
  if (visuel === "chrono") return "rapide";
  if (visuel === "calendrier") return "calendrier";
  if (visuel === "email-envoye") return "mails";
  if (visuel === "telephone-notification") return "telephone";
  if (visuel === "liste-cochee" || visuel === "document-barre") return "notes";
  const mails = a(/\b(e-?mails?|mails?|messages?|relances?|courriers?)\b/);
  const temps = a(/\b(temps|minutes?|heures?|journees?|attend|perd|lent|semaines?)\b/);
  if (mails && temps) return "temps-mails";
  if (a(/\b(redig|brouillon|reponses?|ecrire|ecrit)/)) return "flux";
  if (a(/\b(reli|verifi|corrig|control|regard)/)) return "relire";
  if (a(/\b(reunions?|compte rendu|notes?|documents?|dossiers?|contrats?|devis|donnees|coordonnees)\b/)) return "notes";
  if (a(/\b(lundi|calendrier|agenda|rendez-vous|planning|chaque semaine)\b/)) return "calendrier";
  if (a(/\b(appel|telephone|client)s?\b/)) return "telephone";
  if (mails) return "mails";
  if (temps) return "temps";
  if (a(/\b(vite|rapide|gagn)/)) return "rapide";
  return "notes";
}

/** Le dessin d'un thème, en coordonnées de la maquette (1080 × 1920) ; la mise en page le recadre. */
function dessinTheme(P: Plume, theme: Theme, style: StyleTableau): TraitTableau[] {
  switch (theme) {
    case "temps-mails":
      if (style === "ardoise") {
        const el = horloge(P, 540, 1062, 232);
        for (const [x, y, r] of [[196, 900, -12], [884, 920, 10], [214, 1230, 8], [866, 1222, -9]] as const) el.push(...enveloppe(P, x - 81, y - 49, 163, 98, r));
        return el;
      }
      if (style === "paperboard") return [...sablier(P, 286, 850, 1300), ...enveloppe(P, 596, 1145, 350, 158, 0), ...enveloppe(P, 622, 997, 320, 148, -4), ...enveloppe(P, 608, 852, 330, 148, 3)];
      return [...enveloppe(P, 90, 1000, 240, 144, -7), ...enveloppe(P, 106, 1150, 256, 152, 4), ...sablier(P, 540, 850, 1300), ...enveloppe(P, 760, 1030, 230, 138, 8), ...enveloppe(P, 744, 1165, 246, 146, -3)];
    case "flux":
      return [...feuilleDemande(P, 84, 604, 333, 400, { k: 1.3, l0: 212, pas: 38 }), ...fleche(P, 433, 804, 561, 804, 30), ...feuilleBrouillon(P, 579, 604, 333, 400, { l0: 158, pas: 50, k: 1.3 }), ...flecheCourbe(P, [699, 1028], [669, 1084], [569, 1100], [552, 1110], 10), ...loupe(P, 410, 1182, 140, 20)];
    case "relire":
      return [...feuilleBrouillon(P, 120, 600, 380, 460, { l0: 90, pas: 70, k: 1.4 }), ...loupe(P, 640, 980, 170, 30)];
    case "notes":
      return [...feuilleDemande(P, 140, 600, 360, 440, { k: 1.3, l0: 212, pas: 44 }), ...fleche(P, 520, 820, 600, 820, 26), ...feuilleBrouillon(P, 620, 600, 360, 440, { l0: 150, pas: 56, k: 1.3 })];
    case "calendrier":
      return [...calendrier(P, 200, 600, 520, 520), ...horloge(P, 820, 1040, 130)];
    case "telephone":
      return [...telephone(P, 540, 1000, 1.6, -18)];
    case "mails":
      return [...enveloppe(P, 200, 640, 420, 250, -6), ...enveloppe(P, 360, 860, 440, 260, 5), ...enveloppe(P, 240, 1080, 420, 250, -3)];
    case "temps":
      return style === "ardoise" ? horloge(P, 540, 1000, 300) : [...sablier(P, 540, 760, 1260)];
    case "rapide":
      return [...reveil(P, 330, 980, 170), ...fleche(P, 540, 980, 680, 980, 28), ...chrono(P, 860, 1000, 150)];
  }
}

/** Petit dessin d'une rangée de liste, choisi par le texte de l'élément. */
function iconeDe(P: Plume, texte: string): TraitTableau[] {
  const t = texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\b(reli|verifi|corrig|control|regard)/.test(t)) return loupe(P, 0, 0, 104);
  if (/\b(brouillon|redig|lignes?|court|reponses?|compte rendu|notes?)/.test(t)) return feuilleBrouillon(P, 0, 0, 238, 300);
  if (/\b(e-?mails?|mails?|messages?|relances?|envo)/.test(t)) return enveloppe(P, 0, 0, 240, 150, 0);
  if (/\b(lundi|semaine|calendrier|agenda|reunion)/.test(t)) return calendrier(P, 0, 0, 300, 300);
  if (/\b(appel|telephone)/.test(t)) return telephone(P, 0, 0, 1, -18);
  if (/\b(minutes?|heures?|temps|vite|rapide)\b/.test(t)) return chrono(P, 0, 0, 110);
  return feuilleDemande(P, 0, 0, 238, 300);
}

/* ------------------------------------------------------------------ */
/* Les rangées de la page                                                */
/* ------------------------------------------------------------------ */

const fixe = (b: Bloc | null): Rang | null => (b ? { sorte: "fixe", bloc: b } : null);

/** En-tête : pastille d'étape et « Étape 1 sur 3 », repère « Exemple illustratif », « À retenir ». */
function entete(g: Geo, c: ContenuPage): Rang | null {
  const S = g.S;
  const k = g.k;
  if (c.numero) {
    const n = c.numero;
    const B = px(g, (g.style === "tableau-blanc" ? 150 : 150) * Math.min(1, Math.max(0.75, g.f)));
    const tChiffre = Math.round(B * 0.86);
    const te = Math.round(Math.max(mini(g, "detail"), T(g).etape * k * Math.min(1, g.f)));
    const texteEtape = `Étape ${n.n} sur ${n.total}`;
    const pe = g.style === "ardoise" ? "caveat" : g.style === "paperboard" ? "caveat" : "caveat";
    const le = Math.ceil(largeurTableau(texteEtape, pe, te));
    const ile = Math.round(te * INTERLIGNES_TABLEAU[pe]);
    // L'ardoise centre la pastille et « Étape 1 sur 3 » dessous ; dans les sorties basses, côte à côte (la place manque).
    const centre = S.centre && g.s.H >= g.s.W * 1.4;
    const disque = centre ? { x: milieu(g) - Math.round(B / 2), y: 0, largeur: B, hauteur: B } : { x: g.x0, y: 0, largeur: B, hauteur: B };
    const etape = centre ? { texte: texteEtape, x: milieu(g) - Math.round(le / 2), y: B + px(g, 10), largeur: le, hauteur: ile, taille: te } : { texte: texteEtape, x: g.x0 + B + px(g, 34), y: Math.round((B - ile) / 2), largeur: le, hauteur: ile, taille: te };
    const chiffre = String(n.n);
    const lc = Math.ceil(largeurTableau(chiffre, "caveat", tChiffre));
    const ilc = Math.round(tChiffre * INTERLIGNES_TABLEAU.caveat);
    const objets: ObjetTableau[] = g.style === "tableau-blanc" ? [{ sorte: "postit", x: disque.x, y: disque.y, l: B, h: B, rot: -4, c: S.fondPostit }, { sorte: "aimant", x: disque.x + B - px(g, 42), y: disque.y + px(g, 2), l: px(g, 36), h: px(g, 36), c: "#2A1F17" }] : [];
    const fond = g.style === "ardoise" ? S.fond : S.fondPostit;
    const pose: Pose = {
      elementId: n.ecrit ? idNumero(n.sceneId) : `${c.premiere.id}~numero`,
      sceneId: n.sceneId,
      type: "chiffre",
      niveau: "titre",
      taillePx: tChiffre,
      couleurTexte: S.encre,
      couleurFond: fond,
      lignes: [{ texte: chiffre, px: { x: Math.round(disque.x + (B - lc) / 2), y: Math.round((B - ilc) / 2), largeur: lc, hauteur: ilc } }],
      gabarit: { sorte: "pastille", n: n.n, disque, couleur: g.style === "ardoise" ? S.accent : S.fondPostit, etape },
      px: disque,
      enc: union([disque, { x: etape.x, y: etape.y, largeur: etape.largeur, hauteur: etape.hauteur }]),
      tableau: { lignes: [{ police: "caveat", taille: tChiffre, couleur: S.encre }], objets },
      ...(n.ecrit ? {} : { heure: null }),
    };
    // Le cercle à la craie terracotta (B) ou le disque orange au marqueur (C), tracés par l'outil.
    let p = encombrer(pose);
    if (g.style !== "tableau-blanc") {
      const P = plume(S, graineDe(`${pose.elementId}~pastille`));
      const cx = disque.x + B / 2;
      const cy = disque.y + B / 2;
      const r = B * 0.48;
      p = avecTraits(p, "avant", g.style === "ardoise" ? [trait(ellipse(P, cx, cy, r, r * 0.95, -1.8, 1.08, 2), 13 * k, S.accent), ...remplir(P, [polyPts(cx, cy, r * 0.8, r * 0.76)], S.accent, { angle: -40, w: 9 * k, ecart: 13 * k, a: 0.4 })] : [...remplir(P, [polyPts(cx, cy, r, r)], S.fondPostit, { angle: -40, w: 26 * k, ecart: 15 * k, a: 1 }), trait(ellipse(P, cx, cy, r * 1.02, r, -1.8, 1.06, 1.5), 7 * k, S.encre)], 0.45);
    }
    return fixe(bloc([p]));
  }
  if (c.role === "exemple" || c.role === "retenir") {
    const libelle = c.role === "exemple" ? (c.mention?.texte.trim() || "Exemple illustratif") : "À retenir";
    const id = c.role === "exemple" && c.mention ? c.mention.id : `${c.premiere.id}~partie`;
    const sceneId = c.role === "exemple" && c.mention ? c.mention.sceneId : c.premiere.id;
    if (c.role === "retenir") {
      // « À retenir » : un titre de la partie, souligné (A, B) ou dans une banderole (C).
      const lg: Ligne = { l: { id, type: "ligne", texte: libelle, niveau: "titre", role: "regle", ancre: 0 }, sceneId };
      const r = ecrire(g, lg, { police: S.titre, taille: T(g).titre * 1.05 * k * g.f, min: mini(g, "titre"), couleur: S.encre, max: 1, centre: S.centre || g.style === "paperboard", majuscules: S.capitales, type: "mention", gabarit: { sorte: "partie", role: c.role, point: { x: g.x0, y: 0, largeur: 0, hauteur: 0 }, couleur: S.encre, couleurPoint: S.accent } });
      if (!r) return null;
      let p = { ...r.pose, heure: null } as Pose;
      const l = p.lignes[0].px;
      if (g.style === "paperboard") {
        // Ses ailes restent sur la page (leurs pointes dépassent de 10 px de référence) : jamais hors de la zone sûre.
        const ban = banderole(g.P, Math.max(g.x0 + px(g, 12), l.x - px(g, 120)), Math.min(g.x1 - px(g, 12), l.x + l.largeur + px(g, 120)), l.y - px(g, 6), l.hauteur + px(g, 12));
        p = avecTraits(p, "avant", ban, 0.36);
        p = { ...p, couleurFond: S.clair };
      } else p = avecTraits(p, "apres", [souligne(g.P, l.x, l.x + l.largeur, l.y + l.hauteur * 0.96, g.style === "ardoise" ? 7 : 9, g.style === "ardoise" ? S.doux : S.encre)], 0.18);
      return fixe(bloc([p]));
    }
    const pol: PoliceTableau = g.style === "paperboard" ? "caveat" : "kalam";
    const basse = g.s.W >= g.s.H * 0.99;
    const mx = px(g, basse ? 28 : 38);
    let taille = Math.round(Math.max(mini(g, "detail"), T(g).mention * k));
    // Le repère tient dans sa colonne (étoile de l'ardoise comprise), jamais sous le plancher de l'image (4,1 % de la
    // hauteur : une page d'exemple resserrée l'y faisait descendre en carré).
    while (taille > Math.max(Math.round(PLANCHER_IMAGE * g.k), mini(g, "detail") * 0.8) && largeurTableau(libelle, pol, taille) + 2 * mx + px(g, 40) > g.x1 - g.x0) taille--;
    const il = Math.round(taille * INTERLIGNES_TABLEAU[pol]);
    const l = Math.ceil(largeurTableau(libelle, pol, taille));
    const my = px(g, basse ? 8 : 18);
    const xCarte = S.centre ? Math.max(g.x0 + px(g, 34), milieu(g) - Math.round((l + 2 * mx) / 2)) : g.x0;
    const carte = { x: xCarte, y: 0, largeur: l + 2 * mx, hauteur: il + 2 * my };
    const fond = g.style === "ardoise" ? S.fond : S.fondCarte;
    const lignes = [{ texte: libelle, px: { x: carte.x + mx, y: my, largeur: l, hauteur: il } }];
    const objets: ObjetTableau[] =
      g.style === "tableau-blanc"
        ? [{ sorte: "carte", x: carte.x, y: carte.y, l: carte.largeur, h: carte.hauteur, rot: -1.5, c: fond }, { sorte: "aimant", x: carte.x + carte.largeur - px(g, 30), y: carte.y - px(g, 12), l: px(g, 34), h: px(g, 34), c: "#3A2A1E" }]
        : g.style === "paperboard"
          ? [{ sorte: "carte", x: carte.x, y: carte.y, l: carte.largeur, h: carte.hauteur, rot: -1.2, c: fond }, { sorte: "ruban", x: carte.x + px(g, 16), y: carte.y + px(g, 6), l: px(g, 66), h: px(g, 24), rot: -30, c: "#E2D2B6", dessus: true }, { sorte: "ruban", x: carte.x + carte.largeur - px(g, 16), y: carte.y + px(g, 6), l: px(g, 66), h: px(g, 24), rot: 28, c: "#E2D2B6", dessus: true }]
          : [];
    let pose: Pose = { elementId: id, sceneId, type: "mention", niveau: "corps", taillePx: taille, couleurTexte: g.style === "ardoise" ? S.doux : S.encre, couleurFond: fond, lignes, gabarit: { sorte: "partie", role: c.role, point: { x: carte.x, y: carte.y, largeur: 0, hauteur: 0 }, couleur: S.encre, couleurPoint: S.accent }, px: carte, enc: carte, heure: null, tableau: { lignes: [{ police: pol, taille, couleur: g.style === "ardoise" ? S.doux : S.encre }], objets } } as Pose;
    if (g.style === "ardoise") pose = avecTraits(pose, "avant", etoile(g.P, carte.x - px(g, 10), carte.y + carte.hauteur / 2, px(g, 15)), 0.2);
    return fixe(bloc([encombrer(pose)]));
  }
  return null;
}

/** L'accroche : la première proposition en plus petit, puis la douleur en très grand ; ses mots importants marqués. */
function accroche(g: Geo, x: Ligne): Rang | null {
  const S = g.S;
  const k = g.k;
  const texte = typographie(x.l.texte);
  const mots = texte.split(/\s+/);
  const iVirgule = mots.findIndex((m, i) => /,$/.test(m) && i < mots.length * 0.55 && i >= 1);
  const tete = iVirgule >= 0 && mots.length >= 7 ? mots.slice(0, iVirgule + 1).join(" ") : "";
  const corps = tete ? mots.slice(iVirgule + 1).join(" ") : texte;
  const poses: Pose[] = [];
  const lignes: Pose["lignes"] = [];
  const meta: ElementTableauPlace["lignes"] = [];
  let y = 0;
  if (tete) {
    const r = ecrire(g, { ...x, l: { ...x.l, texte: tete } }, { police: S.corps, taille: T(g).accrochePetit * k * g.f, min: mini(g, "phrase"), couleur: g.style === "ardoise" ? S.doux : S.encre, max: 2, centre: S.centre });
    if (!r) return null;
    lignes.push(...r.pose.lignes);
    meta.push(...r.pose.tableau!.lignes);
    y = r.h + px(g, 18);
  }
  // Critique #291, I3 : 3 lignes (4 au pire) à la taille des maquettes, coupées en groupes (« le même temps »).
  const ox = { police: S.titre, taille: ACCROCHE_TABLEAU[g.style] * k * g.f, min: mini(g, "titre"), couleur: S.encre, centre: S.centre, majuscules: S.capitales, interligne: 1 };
  const lx = { ...x, l: { ...x.l, texte: corps } };
  const r = ecrire(g, lx, { ...ox, max: 3, groupes: true }) ?? ecrire(g, lx, { ...ox, max: 4, groupes: true }) ?? ecrire(g, lx, { ...ox, max: 4 }) ?? ecrire(g, lx, { ...ox, max: 6 });
  if (!r) return null;
  const premier = lignes.length;
  lignes.push(...r.pose.lignes.map((l) => ({ ...l, px: { ...l.px, y: l.px.y + y } })));
  meta.push(...r.pose.tableau!.lignes);
  const cadre = union(lignes.map((l) => l.px));
  let pose: Pose = { elementId: x.l.id, sceneId: x.sceneId, type: "ligne", niveau: "titre", taillePx: r.taille, couleurTexte: S.encre, couleurFond: S.fond, lignes, role: x.l.role, px: cadre, enc: cadre, tableau: { lignes: meta } };
  // Mots importants (ceux de la douleur) : soulignés (A, B) ou entourés (C) quand la voix les dit.
  const mots3 = motsImportants(g, { ...x, l: { ...x.l, importants: (x.l.importants ?? []).map((m) => (S.capitales ? m.toLocaleUpperCase("fr-FR") : m)) } }, pose, S.titre, r.taille, premier);
  pose.gabarit = { sorte: "accroche", mots: mots3, couleur: S.accent };
  pose.importants = x.l.importants ? [...x.l.importants] : undefined;
  if (!mots3.length) {
    // Sans mot important : la dernière rangée soulignée d'orange (le seul accent de la page).
    const l = lignes[lignes.length - 1].px;
    pose = avecTraits(pose, "apres", [souligne(g.P, l.x, l.x + l.largeur, l.y + l.hauteur * 0.95, g.style === "ardoise" ? 13 : 16, S.accent)], 0.24);
  }
  poses.push(encombrer(pose));
  return fixe(bloc(poses));
}

/** Titre de la page (très grand). */
function titre(g: Geo, x: Ligne): Rang | null {
  const S = g.S;
  const r = ecrire(g, x, { police: S.titre, taille: T(g).titre * g.k * g.f, min: mini(g, "titre"), couleur: S.encre, max: 2, centre: S.centre, majuscules: S.capitales, interligne: 1, gabarit: { sorte: "titre" } });
  return r ? fixe(bloc([r.pose])) : null;
}

/** Phrase : sous le titre (plus petite, son mot-clé souligné ou surligné), ou seule (grande). */
function phrase(g: Geo, x: Ligne, sousTitre: boolean, role: string): Rang | null {
  const S = g.S;
  const k = g.k;
  const grand = !sousTitre && (role === "douleur" || role === "retenir" || role === "solution" || role === "appel");
  const taille = (sousTitre ? T(g).sousTitre : grand ? T(g).phrase : T(g).detail) * k * g.f;
  const couleur = sousTitre && g.style === "ardoise" ? S.doux : S.encre;
  const r = ecrire(g, x, { police: S.corps, taille, min: mini(g, sousTitre ? "detail" : "phrase"), couleur, max: (sousTitre ? 3 : 5) + (g.x1 - g.x0 < 600 * g.k ? 1 : 0), centre: S.centre, gabarit: { sorte: "phrase" } });
  if (!r) return null;
  let p = r.pose;
  if (sousTitre && g.style !== "ardoise") {
    // Les deux derniers mots : soulignés à l'encre (A) ou surlignés de sable (C), comme la maquette.
    const l = p.lignes[p.lignes.length - 1];
    const ms = l.texte.split(/\s+/);
    const debut = ms.slice(0, Math.max(0, ms.length - 2)).join(" ");
    const x0 = l.px.x + (debut ? largeurTableau(`${debut} `, S.corps, r.taille) : 0);
    const x1 = l.px.x + l.px.largeur;
    if (g.style === "paperboard") p = avecTraits(p, "avant", [surligneur(g.P, x0, x1, l.px.y + l.px.hauteur * 0.52, l.px.hauteur * 0.62)], 0.18);
    else p = avecTraits(p, "apres", [souligne(g.P, x0, x1, l.px.y + l.px.hauteur * 0.9, 6, S.encre)], 0.16);
  }
  return fixe(bloc([p]));
}

function detail(g: Geo, x: Ligne): Rang | null {
  const S = g.S;
  const r = ecrire(g, x, { police: S.corps, taille: T(g).detail * g.k * g.f, min: mini(g, "detail"), couleur: S.doux, max: 3, centre: S.centre });
  return r ? fixe(bloc([r.pose])) : null;
}

/** Idée reçue : « Idée reçue » au-dessus, le texte barré quand la voix a fini de le dire. */
function idee(g: Geo, x: Ligne): Rang | null {
  const S = g.S;
  const k = g.k;
  const tl = Math.round(Math.max(mini(g, "detail"), T(g).etiquette * k * Math.min(1, g.f)));
  const ll = Math.ceil(largeurTableau("Idée reçue", S.corps, tl));
  const il = Math.round(tl * INTERLIGNES_TABLEAU[S.corps]);
  const r = ecrire(g, x, { police: S.corps, taille: T(g).phrase * k * g.f, min: mini(g, "phrase"), couleur: S.encre, max: 3, centre: S.centre });
  if (!r) return null;
  const xl = S.centre ? milieu(g) - Math.round(ll / 2) : g.x0;
  const cadre = { x: xl, y: 0, largeur: ll, hauteur: il };
  const p = deplacer(r.pose, 0, il + px(g, 12));
  p.gabarit = { sorte: "idee", cadre, signe: { x: xl, y: 0, largeur: 0, hauteur: 0 }, texte: { texte: "Idée reçue", x: xl, y: 0, largeur: ll, hauteur: il, taille: tl }, couleur: S.accentTexte };
  return fixe(bloc([encombrer({ ...p, enc: union([p.px, cadre]) })]));
}

/** La case vide d'une liste (carré à main levée, coins à peine arrondis, comme la maquette). */
function caseVide(P: Plume, b: RectPx, couleur: string, k: number): TraitTableau {
  const m = b.largeur * 0.1;
  return trait(tremble(P, rectArr(b.x + m, b.y + m, b.largeur - 2 * m, b.hauteur - 2 * m, 8 * k), 1.2), 6 * k, couleur);
}

/** Liste (cochée, à pastilles, « À retenir ») : une rangée par élément (case, petit dessin, texte), hauteur souple. */
function liste(g: Geo, gr: Extract<Groupe, { lignes: Ligne[] }>): Rang | null {
  const S = g.S;
  const k = g.k;
  const n = gr.lignes.length;
  const L = g.x1 - g.x0;
  const tcase = Math.round(px(g, 92) * (PLANCHERS_SORTIE[g.s.format] ?? 1));
  const icMax = Math.round(Math.min(L * 0.26, px(g, 200)));
  const ecart = px(g, 26);
  // Le texte de chaque rangée : une taille commune (la plus grande qui tient pour tous), 2 rangées au plus.
  const xtDe = (ic: number) => g.x0 + (gr.sorte === "code" ? 0 : tcase + ecart) + ic + ecart;
  const essai = (ic: number, max = g.x0 > (g.bord ?? g.s.x0) + 1 ? 3 : 2, plancher = mini(g, "item")) => {
    for (let t = Math.round(Math.max(plancher, T(g).item * k * g.f)); t >= plancher; t = Math.floor(t * 0.96)) {
      // Paperboard : le surligneur déborde du texte (10 px et son bout arrondi) ; il reste dans la zone sûre.
      const marge = g.style === "paperboard" ? Math.ceil(12 + t * 0.4) : 0;
      const rs = gr.lignes.map((x) => ecrire(g, x, { police: S.corps, taille: t, min: t, couleur: S.encre, max, x0: xtDe(ic), x1: g.x1 - marge }));
      if (rs.every(Boolean)) return rs as NonNullable<ReturnType<typeof ecrire>>[];
    }
    return null;
  };
  /** Chaque élément sur UNE ligne quand il y a la place (maquette, critique #291 D2) : le dessin rapetisse, le texte un peu. */
  const surUneLigne = (icPlafond: number) => {
    for (let ic = icPlafond; ic >= icMin; ic = Math.round(ic * 0.92)) {
      const rs = essai(ic, 1, Math.max(mini(g, "item"), Math.round(T(g).item * k * g.f * 0.82)));
      if (rs) return { ic, rs };
      if (ic === icMin) break;
      if (Math.round(ic * 0.92) < icMin) ic = Math.round(icMin / 0.92);
    }
    return null;
  };
  // Dans les sorties basses, le petit dessin de chaque rangée cède la place au texte (jamais sous 60 px).
  const icMin = Math.round(px(g, g.s.format === "vertical" ? 96 : 64) * (g.repli ?? 1));
  const textes = surUneLigne(icMin)?.rs ?? essai(icMin);
  if (!textes) return null;
  const hTexte = Math.max(...textes.map((r) => r.h));
  // Un peu d'air entre deux rangées (moins dans les sorties basses).
  const air = px(g, g.s.W >= g.s.H * 0.99 ? 2 : 12);
  const min = n * (Math.max(hTexte, icMin, tcase) + air) + (n - 1) * px(g, g.s.W >= g.s.H * 0.99 ? 8 : 18);
  const max = n * Math.max(hTexte, icMax) + (n - 1) * px(g, 70);
  const poser = (h: number): Bloc => {
    const pas = h / n;
    let ic = Math.round(Math.max(icMin, Math.min(icMax, pas - px(g, 18))));
    // Le dessin rapetisse tant qu'il fait passer un texte de plus sur une seule ligne (D2).
    const rangees = (x: ReturnType<typeof essai>) => (x ? x.reduce((sm, r) => sm + r.pose.lignes.length, 0) : Infinity);
    for (let c = ic, moins = rangees(essai(ic)); c > icMin; ) {
      c = Math.max(icMin, Math.round(c * 0.9));
      const n = rangees(essai(c));
      if (n < moins) {
        moins = n;
        ic = c;
      }
    }
    const une = surUneLigne(ic);
    // Le dessin rapetisse tant que les textes ne tiennent pas à sa droite, dans la hauteur de leur rangée.
    const tient = (x: ReturnType<typeof essai>) => !!x && Math.max(...x.map((r) => r.h)) <= pas - air;
    let rs = une?.rs ?? essai(ic);
    if (une) ic = une.ic;
    while (!une && !tient(rs) && ic > icMin) {
      ic = Math.max(icMin, Math.round(ic * 0.9));
      rs = essai(ic);
    }
    rs ??= textes;
    const poses: Pose[] = [];
    rs.forEach((r, i) => {
      const yc = Math.round(pas * i + pas / 2);
      let p = deplacer(r.pose, xtDe(ic) - r.pose.px.x, Math.round(yc - r.h / 2));
      const boite = { x: g.x0, y: Math.round(yc - tcase / 2), largeur: tcase, hauteur: tcase };
      const xi = gr.sorte === "code" ? g.x0 : g.x0 + tcase + ecart;
      const P = plume(S, graineDe(r.pose.elementId));
      const icone = cadrer(gr.sorte === "code" ? [...medaillon(P, 0, 0, 104), ...cadrer(iconeDe(P, r.pose.lignes.map((l) => l.texte).join(" ")), { x: -70, y: -70, largeur: 140, hauteur: 140 })] : iconeDe(P, r.pose.lignes.map((l) => l.texte).join(" ")), { x: xi, y: yc - ic / 2, largeur: ic, hauteur: ic }, 1.4);
      // La case vide, tracée avant le petit dessin et le texte, puis cochée quand la voix finit l'élément (D2).
      if (gr.sorte !== "code") p = avecTraits(p, "avant", [caseVide(plume(S, graineDe(`${r.pose.elementId}~case`)), boite, S.encre, k)], 0.22);
      p = avecTraits(p, "avant", icone, 0.4);
      if (gr.sorte !== "code") p = encombrer({ ...p, gabarit: { sorte: "case", boite, couleur: S.accent, attente: false }, enc: union([p.enc, boite]) });
      else p = encombrer({ ...p, gabarit: { sorte: "code", code: gr.lignes[i].l.code ?? "vert", disque: { x: xi, y: Math.round(yc - ic / 2), largeur: ic, hauteur: ic }, couleur: S.encre } });
      // Paperboard : le texte surligné de sable.
      if (g.style === "paperboard") {
        const l = p.lignes[0].px;
        p = avecTraits(p, "avant", [surligneur(P, l.x, l.x + l.largeur, l.y + l.hauteur * 0.55, l.hauteur * 0.6)], 0.14);
      }
      poses.push(p);
    });
    return bloc(poses);
  };
  return { sorte: "souple", min, max, poser };
}

/** Exemple concret « Monsieur Martin → Client A » dans une carte posée. */
function transformation(g: Geo, x: Ligne): Rang | null {
  const S = g.S;
  const k = g.k;
  const c = cotesTransformation(x.l.texte);
  if (!c) return detail(g, x);
  const mx = px(g, 40);
  const my = px(g, 24);
  // Les deux textes rapetissent ensemble jusqu'à tenir dans la largeur (jamais sous le plancher des détails).
  let tDe = Math.round(Math.max(mini(g, "detail"), T(g).detail * k * g.f));
  let tVers = Math.round(Math.max(mini(g, "phrase"), T(g).phrase * k * g.f));
  const pv: PoliceTableau = S.titre === "marker" ? "kalam" : S.titre;
  while (tVers > mini(g, "detail") && Math.max(largeurTableau(c.de, S.corps, tDe), largeurTableau(c.vers, pv, tVers) + px(g, 130)) + px(g, 80) > g.x1 - g.x0) {
    tVers = Math.round(tVers * 0.95);
    tDe = Math.max(mini(g, "detail"), Math.round(tDe * 0.95));
  }
  const lDe = Math.ceil(largeurTableau(c.de, S.corps, tDe));
  const lVers = Math.ceil(largeurTableau(c.vers, S.titre === "marker" ? "kalam" : S.titre, tVers));
  const pVers: PoliceTableau = S.titre === "marker" ? "kalam" : S.titre;
  const ilDe = Math.round(tDe * INTERLIGNES_TABLEAU[S.corps]);
  const ilVers = Math.round(tVers * INTERLIGNES_TABLEAU[pVers]);
  const lf = px(g, 110);
  const largeurMax = g.x1 - g.x0;
  const enLigne = 2 * mx + lDe + lf + lVers + px(g, 40) <= largeurMax;
  let lignes: Pose["lignes"];
  let carte: RectPx;
  let fleche3: { x1: number; y1: number; x2: number; y2: number };
  if (enLigne) {
    const w = 2 * mx + lDe + lf + lVers + px(g, 40);
    const x0 = S.centre ? milieu(g) - Math.round(w / 2) : g.x0;
    const h = Math.max(ilDe, ilVers) + 2 * my;
    carte = { x: x0, y: 0, largeur: w, hauteur: h };
    const xa = x0 + mx + lDe + px(g, 20);
    lignes = [
      { texte: c.de, px: { x: x0 + mx, y: Math.round((h - ilDe) / 2), largeur: lDe, hauteur: ilDe } },
      { texte: c.vers, px: { x: xa + lf + px(g, 20), y: Math.round((h - ilVers) / 2), largeur: lVers, hauteur: ilVers } },
    ];
    fleche3 = { x1: xa, y1: Math.round(h / 2), x2: xa + lf, y2: Math.round(h / 2) };
  } else {
    if (Math.max(lDe, lVers + lf) + 2 * mx > largeurMax) return null;
    const w = Math.min(largeurMax, Math.max(lDe, lVers + lf + px(g, 20)) + 2 * mx);
    const x0 = S.centre ? milieu(g) - Math.round(w / 2) : g.x0;
    const h = ilDe + ilVers + 2 * my + px(g, 8);
    carte = { x: x0, y: 0, largeur: w, hauteur: h };
    lignes = [
      { texte: c.de, px: { x: x0 + mx, y: my, largeur: lDe, hauteur: ilDe } },
      { texte: c.vers, px: { x: x0 + mx + lf + px(g, 20), y: my + ilDe + px(g, 8), largeur: lVers, hauteur: ilVers } },
    ];
    fleche3 = { x1: x0 + mx, y1: my + ilDe + px(g, 8) + Math.round(ilVers / 2), x2: x0 + mx + lf, y2: my + ilDe + px(g, 8) + Math.round(ilVers / 2) };
  }
  const fond = g.style === "ardoise" ? S.fond : S.fondCarte;
  const objets: ObjetTableau[] = g.style === "ardoise" ? [] : [{ sorte: "carte", x: carte.x, y: carte.y, l: carte.largeur, h: carte.hauteur, rot: -1, c: fond }, ...(g.style === "paperboard" ? [{ sorte: "ruban" as const, x: carte.x + carte.largeur / 2, y: carte.y + px(g, 4), l: px(g, 110), h: px(g, 30), rot: -3, c: "#E2D2B6", dessus: true }] : [{ sorte: "aimant" as const, x: carte.x + carte.largeur - px(g, 36), y: carte.y - px(g, 12), l: px(g, 32), h: px(g, 32), c: "#2A1F17" }])];
  const pose: Pose = { elementId: x.l.id, sceneId: x.sceneId, type: "ligne", niveau: "corps", taillePx: tVers, couleurTexte: S.encre, couleurFond: fond, lignes, role: x.l.role, px: union(lignes.map((l) => l.px)), enc: carte, gabarit: { sorte: "transformation", fleche: fleche3, couleur: S.encre, carte, rayon: px(g, 16), fond, tailleDe: tDe }, tableau: { lignes: [{ police: S.corps, taille: tDe, couleur: S.doux }, { police: pVers, taille: tVers, couleur: S.encre }], objets } };
  let p = encombrer(pose);
  // Ardoise : la carte tracée à la craie, exactement autour de ses deux textes (jamais sur un mot).
  if (g.style === "ardoise") p = avecTraits(p, "avant", [trait(tremble(g.P, rectArr(carte.x, carte.y, carte.largeur, carte.hauteur, px(g, 16)), 1.2), 6 * k, S.doux)], 0.3);
  return fixe(bloc([p]));
}

/** Taille la plus petite d'un chiffre de l'exemple (px), dans toutes les sorties (critique #291). */
export const CHIFFRE_EXEMPLE_MIN_PX = 100;

/** Le nombre d'un texte d'exemple (« 10 minutes » → « 10 », « min ») et ce qui l'entoure. */
export function chiffreDuTexte(texte: string): { avant: string; nombre: string; unite: string; apres: string } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(minutes?|min|heures?|h|secondes?|sec|s|jours?|semaines?|%|€|euros?)?(?![\p{L}\d])/iu.exec(texte);
  if (!m) return null;
  const u = (m[2] ?? "").toLowerCase();
  const unite = /^min/.test(u) ? "min" : /^h/.test(u) ? "h" : /^s(ec)?/.test(u) && !/^sem/.test(u) ? "s" : u;
  const avant = texte.slice(0, m.index).replace(/[\s,:–—-]+$/u, "").trim();
  const apres = texte.slice(m.index + m[0].length).replace(/^[\s,.:;]+/u, "").replace(/\.$/, "").trim();
  return { avant, nombre: m[1], unite, apres };
}

/**
 * Ce qui reste écrit en petit sous le chiffre d'un exemple, toujours une phrase juste (critique #291, D4 ; vidéo
 * v-6616b3800357) : le nombre ouvrait le texte (« 10 minutes par mail. ») → la suite, « par mail » ; il était le
 * complément d'un « chaque » (« Chaque mail lui prenait 10 minutes. ») → « par mail » ; un texte qui le présentait par
 * deux-points (« Elle relit un brouillon et l'envoie : 3 minutes. ») → ce qui le présente. Partout ailleurs, le nombre
 * tient à la phrase (« Ses notes partaient 3 jours après. ») : la phrase ENTIÈRE reste écrite sous le chiffre en grand,
 * jamais « Ses notes partaient après ».
 */
export function resteDuChiffre(texte: string, ch: NonNullable<ReturnType<typeof chiffreDuTexte>>): string {
  if (!ch.avant) return ch.apres;
  const i = texte.indexOf(ch.nombre);
  const presente = /[:–—]\s*$/u.test(texte.slice(0, Math.max(0, i)));
  if (!ch.apres && presente) return ch.avant;
  const chaque = /\bchaque\s+([\p{L}’'-]+)/iu.exec(ch.avant);
  if (!ch.apres && chaque) return `par ${chaque[1].toLowerCase()}`;
  return texte.trim();
}

/** Avant / Maintenant de l'exemple : étiquettes, petits dessins (réveil, chrono), chiffres dits en très grand. */
function comparaison(g: Geo, gr: Extract<Groupe, { sorte: "comparaison" }>): Rang | null {
  const S = g.S;
  const k = g.k;
  const cotes = ([["avant", gr.avant], ["apres", gr.apres]] as const).filter((x): x is ["avant" | "apres", Ligne] => !!x[1]);
  if (!cotes.length) return null;
  const tl = Math.round(Math.max(mini(g, "detail"), T(g).etiquette * k * Math.min(1, g.f)));
  // Ardoise, et sorties basses (4:5, carré, 16:9) : « Avant » et « Maintenant » côte à côte.
  const colonnes = (S.centre || g.s.H < g.s.W * 1.4) && cotes.length === 2;
  const L = g.x1 - g.x0;
  /** Un côté posé dans [x0, x1] pour une hauteur de dessin `hd` : étiquette, dessin + chiffre, texte. */
  const cote = (ton: "avant" | "apres", x: Ligne, x0: number, x1: number, hd: number, centre: boolean): Pose[] | null => {
    const lw = x1 - x0;
    // « Maintenant », sous l'« avant », s'écrit à droite de la flèche courbe qui y mène.
    const xe = ton === "apres" && !colonnes && cotes.length === 2 ? x0 + px(g, 230) : x0;
    const etiquette = ecrire(g, { l: { id: `${x.l.id}~etiquette`, type: "ligne", texte: ton === "avant" ? "Avant" : "Maintenant", niveau: "texte", role: "regle", ancre: x.l.ancre }, sceneId: x.sceneId }, { police: S.corps, taille: tl, min: tl, couleur: S.doux, max: 1, x0: xe, x1, centre, type: "mention", id: `${x.l.id}~etiquette` });
    if (!etiquette) return null;
    const et = { ...etiquette.pose, heure: x.l.id } as Pose;
    let y = etiquette.h + px(g, 10);
    const ch = chiffreDuTexte(x.l.texte);
    const P = plume(S, graineDe(x.l.id));
    const dessin = ton === "avant" ? reveil(P, 0, 0, 118) : chrono(P, 0, 0, 118);
    const poses: Pose[] = [et];
    const couleurChiffre = ton === "apres" ? S.accentTexte : S.encre;
    if (ch) {
      // Le chiffre dit en très grand (barré pour « avant »), le dessin à côté, le reste du texte en petit.
      const grand = ton === "apres" && !colonnes;
      const pc: PoliceTableau = colonnes || grand ? "caveat" : S.titre;
      // Le chiffre suit la place (la hauteur du dessin) ; dans une page serrée (4:5, carré, 16:9 avec un « avant » et un
      // « maintenant », vidéo v-6616b3800357), il descend jusqu'à 100 px, jamais en dessous (critique #291).
      const tc = Math.round(Math.max(mini(g, "titre"), CHIFFRE_EXEMPLE_MIN_PX, (colonnes ? T(g).chiffre : grand ? T(g).grandChiffre : T(g).chiffre) * k * Math.min(1, g.f) * Math.min(1.15, Math.max(colonnes ? 0.4 : 0.35, hd / px(g, 330)))));
      const nombre = colonnes ? ch.nombre : `${ch.nombre}${ch.unite && !grand ? ` ${S.capitales ? ch.unite.toUpperCase() : ch.unite}` : ""}`;
      const lc = Math.ceil(largeurTableau(nombre, pc, tc));
      const ilc = Math.round(tc * INTERLIGNES_TABLEAU[pc] * 0.92);
      const tu = Math.round(Math.max(mini(g, "detail"), tc * (colonnes ? 0.32 : 0.48)));
      const pu: PoliceTableau = colonnes ? S.corps : S.titre;
      const unite = colonnes || grand ? (S.capitales ? ch.unite.toUpperCase() : ch.unite) : "";
      const lu = unite ? Math.ceil(largeurTableau(unite, pu, tu)) : 0;
      const ilu = Math.round(tu * INTERLIGNES_TABLEAU[pu]);
      const reste = resteDuChiffre(x.l.texte, ch);
      const td = Math.round(Math.max(mini(g, "detail"), T(g).detail * k * Math.min(1, g.f)));
      const lignes: Pose["lignes"] = [];
      const meta: ElementTableauPlace["lignes"] = [];
      const hDessin = Math.round(Math.min(hd, colonnes ? lw * 0.62 : L * 0.34));
      let xNombre: number;
      let yNombre: number;
      if (colonnes) {
        // Ardoise : dessin, puis le chiffre centré, l'unité dessous.
        const r = { x: Math.round((x0 + x1) / 2 - hDessin / 2), y, largeur: hDessin, hauteur: hDessin };
        poses.push(croquis(g, `${x.l.id}~dessin`, x.sceneId, cadrer(dessin, r, 2), 0.45, x.l.id));
        y += hDessin + px(g, 8);
        xNombre = Math.round((x0 + x1) / 2 - lc / 2);
        yNombre = y;
        lignes.push({ texte: nombre, px: { x: xNombre, y, largeur: lc, hauteur: ilc } });
        meta.push({ police: pc, taille: tc, couleur: couleurChiffre });
        y += ilc;
        if (unite) {
          lignes.push({ texte: unite, px: { x: Math.round((x0 + x1) / 2 - lu / 2), y, largeur: lu, hauteur: ilu } });
          meta.push({ police: pu, taille: tu, couleur: S.encre });
          y += ilu;
        }
      } else {
        // Paperboard : l'unité se pose hors de l'éclat dessiné autour du chiffre (jamais dessus).
        const ecartUnite = ton === "apres" && g.style === "paperboard" ? Math.max(px(g, 30), Math.round(0.62 * Math.max(lc, ilc) - lc / 2 + px(g, 18))) : px(g, 30);
        const largeurNombre = lc + (unite ? lu + ecartUnite : 0);
        // Le dessin cède la place au chiffre dans une colonne étroite (il ne descend jamais sous 70 px).
        const ld = Math.min(hDessin, lw - largeurNombre - px(g, 40));
        const avecDessinGauche = ton === "avant";
        if (ld < px(g, 70)) return null;
        const xd = avecDessinGauche ? x0 : x1 - ld;
        xNombre = avecDessinGauche ? x0 + ld + px(g, 40) : x0 + (grand ? px(g, 70) : 0);
        const hLigne = Math.max(ilc, ld);
        yNombre = y + Math.round((hLigne - ilc) / 2);
        poses.push(croquis(g, `${x.l.id}~dessin`, x.sceneId, cadrer(dessin, { x: xd, y, largeur: ld, hauteur: ld }, 2), 0.45, x.l.id));
        lignes.push({ texte: nombre, px: { x: xNombre, y: yNombre, largeur: lc, hauteur: ilc } });
        meta.push({ police: pc, taille: tc, couleur: couleurChiffre });
        if (unite) {
          lignes.push({ texte: unite, px: { x: xNombre + lc + ecartUnite, y: yNombre + ilc - ilu, largeur: lu, hauteur: ilu } });
          meta.push({ police: pu, taille: tu, couleur: S.encre });
        }
        y += hLigne;
      }
      if (reste) {
        const r = ecrire(g, { ...x, l: { ...x.l, texte: reste } }, { police: S.corps, taille: td, min: mini(g, "detail"), couleur: S.doux, max: colonnes ? 3 : 2, x0: colonnes ? x0 : xNombre, x1, centre });
        if (!r) return null;
        y += px(g, 6);
        for (const l of r.pose.lignes) lignes.push({ ...l, px: { ...l.px, y: l.px.y + y } });
        meta.push(...r.pose.tableau!.lignes);
        y += r.h;
      }
      const cadre = union(lignes.map((l) => l.px));
      let p: Pose = { elementId: x.l.id, sceneId: x.sceneId, type: "ligne", niveau: "titre", taillePx: tc, couleurTexte: couleurChiffre, couleurFond: S.fond, lignes, role: x.l.role, px: cadre, enc: cadre, tableau: { lignes: meta } };
      const n0 = lignes[0].px;
      if (ton === "avant") p = avecTraits(p, "apres", barre(P, n0.x - 8, n0.y + n0.hauteur * 0.15, n0.largeur + 22, n0.hauteur * 0.7), 0.22);
      else if (g.style === "paperboard") p = avecTraits(p, "avant", eclat(P, n0.x + n0.largeur / 2, n0.y + n0.hauteur * 0.52, Math.max(n0.largeur, n0.hauteur) * 0.62, Math.max(n0.largeur, n0.hauteur) * 0.48), 0.35);
      else p = avecTraits(p, "apres", rayons(P, n0.x + n0.largeur / 2, n0.y + n0.hauteur * 0.5, Math.max(n0.largeur, n0.hauteur) * 0.9, S.accent), 0.24);
      poses.push(p);
      return poses;
    }
    // Sans chiffre : le dessin et le texte à côté.
    const hDessin = Math.round(Math.min(hd, colonnes ? lw * 0.6 : L * 0.3));
    const r = ecrire(g, x, { police: S.corps, taille: (colonnes && g.s.H < g.s.W * 1.4 ? T(g).detail : T(g).phrase * 0.9) * k * g.f, min: mini(g, "detail"), couleur: ton === "avant" ? S.doux : S.encre, max: 4, x0: colonnes ? x0 : x0 + hDessin + px(g, 34), x1, centre });
    if (!r) return null;
    if (colonnes) {
      poses.push(croquis(g, `${x.l.id}~dessin`, x.sceneId, cadrer(dessin, { x: Math.round((x0 + x1) / 2 - hDessin / 2), y, largeur: hDessin, hauteur: hDessin }, 2), 0.6, x.l.id));
      poses.push(deplacer(r.pose, 0, y + hDessin + px(g, 10)));
    } else {
      const h = Math.max(hDessin, r.h);
      poses.push(croquis(g, `${x.l.id}~dessin`, x.sceneId, cadrer(dessin, { x: x0, y: y + Math.round((h - hDessin) / 2), largeur: hDessin, hauteur: hDessin }, 2), 0.6, x.l.id));
      poses.push(deplacer(r.pose, 0, y + Math.round((h - r.h) / 2)));
    }
    return poses;
  };
  const essai = (hd: number): Bloc | null => {
    if (colonnes) {
      const mil = milieu(g);
      const a = cote("avant", cotes[0][1], g.x0, mil - px(g, 20), hd, true);
      const b = cote("apres", cotes[1][1], mil + px(g, 20), g.x1, hd, true);
      if (!a || !b) return null;
      const bl = bloc([...a, ...b]);
      // Le trait de craie entre les deux colonnes, et la flèche de l'une à l'autre.
      const P = plume(S, graineDe(`${cotes[0][1].l.id}~separe`));
      const sep = croquis(g, `${cotes[1][1].l.id}~separe`, cotes[1][1].sceneId, [{ p: [mil, 0, mil, bl.h], w: 4, c: S.doux, a: 0.8 }, ...fleche(P, mil - px(g, 46), Math.round(bl.h * 0.42), mil + px(g, 46), Math.round(bl.h * 0.42), 18)], 0.3, cotes[1][1].l.id);
      return bloc([...bl.poses, sep]);
    }
    const poses: Pose[] = [];
    let y = 0;
    for (const [ton, x] of cotes) {
      // Paperboard : l'« avant » laisse la place au bord de sa carte dessinée.
      const ps = cote(ton, x, g.x0, g.style === "paperboard" && ton === "avant" ? g.x1 - px(g, 44) : g.x1, hd, false);
      if (!ps) return null;
      const b = bloc(ps);
      if (poses.length) {
        // La flèche courbe de « avant » vers « maintenant ».
        const P = plume(S, graineDe(`${x.l.id}~fleche`));
        const fc = flecheCourbe(P, [g.x0 + px(g, 60), y - px(g, 10)], [g.x0 + px(g, 50), y + px(g, 50)], [g.x0 + px(g, 100), y + px(g, 74)], [g.x0 + px(g, 205), y + px(g, 66)], 12);
        poses.push(croquis(g, `${x.l.id}~fleche`, x.sceneId, fc, 0.22, x.l.id));
        y += px(g, 24);
      }
      poses.push(...b.poses.map((p) => deplacer(p, 0, y)));
      y += b.h + px(g, 30);
    }
    if (g.style === "paperboard" && gr.avant) {
      // La carte dessinée sous l'« avant ».
      const av = poses.filter((p) => p.elementId.startsWith(gr.avant!.l.id));
      const u = union(av.map((p) => p.enc));
      const P = plume(S, graineDe(`${gr.avant.l.id}~carte`));
      poses.unshift(croquis(g, `${gr.avant.l.id}~carte`, gr.avant.sceneId, carteCroquis(P, u.x - px(g, 30), u.y - px(g, 24), Math.min(g.x1 + px(g, 10) - (u.x - px(g, 30)), u.largeur + px(g, 60)), u.hauteur + px(g, 48)), 0.25, gr.avant.l.id));
    }
    return bloc(poses);
  };
  const hMin = px(g, g.s.W >= g.s.H * 0.99 ? 72 : 110);
  const hMax = px(g, colonnes ? 330 : 300);
  const bMin = essai(hMin);
  if (!bMin) return null;
  const bMax = essai(hMax) ?? bMin;
  return { sorte: "souple", min: bMin.h, max: Math.max(bMin.h, bMax.h), poser: (h) => {
    // La plus grande hauteur de dessin qui tient dans `h`.
    let lo = hMin;
    let hi = hMax;
    let meilleur = bMin;
    for (let i = 0; i < 10; i++) {
      const m = (lo + hi) / 2;
      const b = essai(m);
      if (b && b.h <= h) {
        meilleur = b;
        lo = m;
      } else hi = m;
    }
    return meilleur;
  } };
}

/** Bloc orange (peps) : le mot-clé sur un post-it (A), dans un cadre de craie orange (B), sur une carte (C). */
function blocOrange(g: Geo, gr: Extract<Groupe, { sorte: "bloc" }>): Rang | null {
  const S = g.S;
  const k = g.k;
  const ligne: Ligne = { l: { id: idBloc(gr.sceneId), type: "ligne", texte: gr.b.compteur ? `${gr.b.compteur.a} ${gr.b.texte}` : gr.b.texte, niveau: "titre", role: "resultat", ancre: gr.b.ancre ?? 0 }, sceneId: gr.sceneId };
  const mx = px(g, 40);
  const my = px(g, 26);
  const fond = g.style === "ardoise" ? S.fond : g.style === "paperboard" ? S.fondBouton : S.fondPostit;
  // Paperboard : le mot-clé sur la carte terracotta pleine s'écrit à l'encre du bouton (#FBF7EF, 4,8:1 ; l'encre sombre
  // n'y faisait que 3,8:1).
  const couleur = g.style === "ardoise" ? S.accentTexte : g.style === "paperboard" ? S.encreBouton : S.encre;
  const r = ecrire(g, ligne, { police: S.corps, taille: T(g).phrase * k * g.f, min: mini(g, "phrase"), couleur, max: 2, x0: g.x0 + mx, x1: g.x1 - mx, centre: S.centre, fond, type: "mention" });
  if (!r) return null;
  const u = r.pose.px;
  const cadre = { x: u.x - mx, y: 0, largeur: u.largeur + 2 * mx, hauteur: u.hauteur + 2 * my };
  let p = deplacer(r.pose, 0, my);
  p = { ...p, gabarit: { sorte: "bloc-orange", cadre, rayon: px(g, 18), fond } };
  if (g.style === "ardoise") p = avecTraits(p, "avant", [{ p: [cadre.x, cadre.y, cadre.x + cadre.largeur, cadre.y, cadre.x + cadre.largeur, cadre.y + cadre.hauteur, cadre.x, cadre.y + cadre.hauteur, cadre.x, cadre.y], w: 9, c: S.accent }], 0.3);
  else p = avecObjets(p, [{ sorte: g.style === "paperboard" ? "carte" : "postit", x: cadre.x, y: cadre.y, l: cadre.largeur, h: cadre.hauteur, rot: -1.2, c: fond }]);
  return fixe(bloc([encombrer({ ...p, enc: union([p.enc, cadre]) })]));
}

/** Page d'appel : dessins (calendrier, combiné), la phrase de la fiche, LA demande sur sa plaque, le site souligné. */
function appel(g: Geo, c: ContenuPage, gr: Extract<Groupe, { sorte: "appel" }>, gs: Geo = g): Rang[] | null {
  const S = g.S;
  const k = g.k;
  const rangs: Rang[] = [];
  // Une seule demande (vidéo d'essai v-667edcd8e3a8) : le bouton s'il y en a un, sinon la phrase de la fin.
  const demande = gr.bouton ?? gr.ligne;
  const phraseFiche = gr.bouton ? gr.ligne : undefined;
  const P = plume(S, graineDe(`${c.derniere.id}~appel`));
  const idDessin = `${c.derniere.id}~croquis`;
  const sceneId = c.derniere.id;
  rangs.push({ sorte: "souple", min: px(g, g.s.W >= g.s.H * 0.99 ? 120 : 180), max: px(g, 420), poser: (h) => {
    const ts = [...calendrier(P, 120, 236, 360, 360), ...telephone(P, 770, 450, 1.05, -24)];
    return bloc([croquis(gs, idDessin, sceneId, cadrer(ts, { x: gs.x0, y: 0, largeur: gs.x1 - gs.x0, hauteur: h }, 2), 0.9, null)]);
  } });
  if (phraseFiche) {
    const r = ecrire(g, phraseFiche, { police: S.corps, taille: T(g).detail * k * g.f, min: mini(g, "detail"), couleur: S.encre, max: 4, centre: true, gabarit: { sorte: "appel-plein", fond: S.fond } });
    if (!r) return null;
    rangs.push({ sorte: "fixe", bloc: bloc([r.pose]) });
  }
  // La plaque (A), le bouton à la craie (B), la carte scotchée (C) ; la demande écrite dessus.
  const basse = g.s.W >= g.s.H * 0.99;
  // Marge intérieure de 40 px au moins (critique #291, I5).
  const mx = px(g, basse ? 40 : 48);
  const my = px(g, basse ? 18 : 40);
  const pBouton: PoliceTableau = g.style === "tableau-blanc" ? "marker" : g.style === "ardoise" ? "kalam" : "caveat";
  const r = ecrire(g, { ...demande, l: { ...demande.l, texte: demande.l.texte.replace(/\.$/, "") } }, { police: pBouton, taille: T(g).bouton * k * g.f, min: mini(g, "phrase"), couleur: S.encreBouton, max: g.s.W >= g.s.H * 0.99 ? 3 : 2, x0: g.x0 + mx, x1: g.x1 - mx, centre: true, fond: S.fondBouton, majuscules: S.capitales });
  if (!r) return null;
  const cadre = { x: g.x0, y: 0, largeur: g.x1 - g.x0, hauteur: r.h + 2 * my };
  let b = deplacer(r.pose, 0, my);
  const gab: DecorGabarit = phraseFiche ? { sorte: "bouton", cadre, rayon: px(g, 46), fond: S.fondBouton } : { sorte: "appel-plein", fond: S.fondBouton };
  b = { ...b, type: phraseFiche ? "mention" : "ligne", gabarit: gab };
  if (g.style === "ardoise") {
    // Le bouton plein terracotta, cerné d'un trait de craie ivoire (le double contour de la maquette).
    const Pb = plume(S, graineDe(`${demande.l.id}~bouton`));
    b = avecObjets(b, [{ sorte: "plaque", x: cadre.x, y: cadre.y, l: cadre.largeur, h: cadre.hauteur, rot: 0, c: S.fondBouton }]);
    const m = px(g, 9);
    b = avecTraits(b, "avant", [trait(tremble(Pb, rectArr(cadre.x - m, cadre.y - m, cadre.largeur + 2 * m, cadre.hauteur + 2 * m, px(g, 52)), 1.4), 7 * k, S.encre)], 0.4);
  } else
    b = avecObjets(b, [
      { sorte: g.style === "paperboard" ? "carte" : "plaque", x: cadre.x, y: cadre.y, l: cadre.largeur, h: cadre.hauteur, rot: -0.8, c: S.fondBouton },
      ...(g.style === "paperboard"
        ? ([[cadre.x + px(g, 30), cadre.y + px(g, 8), -32], [cadre.x + cadre.largeur - px(g, 30), cadre.y + px(g, 8), 30], [cadre.x + px(g, 30), cadre.y + cadre.hauteur - px(g, 6), 30], [cadre.x + cadre.largeur - px(g, 30), cadre.y + cadre.hauteur - px(g, 6), -32]] as const).map(([x, y, rot]) => ({ sorte: "ruban" as const, x, y, l: px(g, 96), h: px(g, 32), rot, c: "#E2D2B6", dessus: true }))
        : [{ sorte: "aimant" as const, x: cadre.x + px(g, 18), y: cadre.y + px(g, 12), l: px(g, 38), h: px(g, 38), c: "#2A1F17" }, { sorte: "aimant" as const, x: cadre.x + cadre.largeur - px(g, 56), y: cadre.y + px(g, 8), l: px(g, 38), h: px(g, 38), c: "#2A1F17" }]),
    ]);
  b = avecTraits(b, "apres", pointeur(P, cadre.x + cadre.largeur - px(g, 130), cadre.y + cadre.hauteur - px(g, 56), 1.1 * k), 0.3);
  rangs.push({ sorte: "fixe", bloc: bloc([encombrer({ ...b, enc: union([b.enc, cadre]) })]) });
  if (!gr.site) return rangs;
  const rs = ecrire(g, gr.site, { police: g.style === "paperboard" ? "caveat" : "kalam", taille: T(g).site * k * g.f, min: mini(g, "phrase"), couleur: S.encre, max: 1, centre: true });
  if (!rs) return null;
  rangs.push({ sorte: "fixe", bloc: bloc([{ ...rs.pose, heure: demande.l.id, marque: "souligne", couleurMarque: g.style === "ardoise" ? S.doux : S.encre, epaisseurMarque: px(g, 10), enc: { ...rs.pose.enc, hauteur: rs.pose.enc.hauteur + px(g, 16) } }]) });
  return rangs;
}

/** Le dessin illustré de la page (souple : il remplit la place qui reste). */
/** Le dessin seul d'un thème, plus haut que large (colonne de droite du carré et du 16:9). */
function dessinHaut(P: Plume, theme: Theme, style: StyleTableau): TraitTableau[] {
  switch (theme) {
    case "temps-mails":
    case "temps":
      return style === "ardoise" ? [...horloge(P, 540, 900, 260), ...enveloppe(P, 380, 1200, 320, 190, -4)] : sablier(P, 540, 760, 1260);
    case "flux":
    case "relire":
      return [...feuilleBrouillon(P, 400, 500, 380, 460, { l0: 90, pas: 70, k: 1.4 }), ...loupe(P, 540, 1120, 150, 30)];
    case "mails":
      return [...enveloppe(P, 300, 640, 420, 250, -6), ...enveloppe(P, 340, 860, 440, 260, 5), ...enveloppe(P, 300, 1080, 420, 250, -3)];
    case "calendrier":
      return calendrier(P, 300, 600, 480, 520);
    case "telephone":
      return telephone(P, 540, 1000, 1.6, -18);
    case "rapide":
      return [...reveil(P, 540, 760, 170), ...chrono(P, 540, 1160, 150)];
    default:
      return [...feuilleDemande(P, 360, 560, 360, 440, { k: 1.3, l0: 212, pas: 44 }), ...loupe(P, 600, 1120, 140, 30)];
  }
}

/** Des traits recadrés dans une zone, collés en haut (le bloc mesure ce que le dessin occupe vraiment). */
function cadrerEnHaut(ts: TraitTableau[], r: RectPx, smax: number): TraitTableau[] {
  const c = cadrer(ts, r, smax);
  const dy = r.y - boiteTraits(c).y;
  return c.map((t) => ({ ...t, p: t.p.map((v, i) => (i % 2 ? Math.round((v + dy) * 10) / 10 : v)) }));
}

/**
 * Dessins des thèmes déjà tracés (même graine, même style, même thème : les mêmes traits) : la mise en page essaie
 * beaucoup de tailles, et le tracé (hachures, tremblé) coûtait l'essentiel de son temps (une page carrée : 1,4 s).
 */
const DESSINS_TRACES = new Map<string, { ts: TraitTableau[]; b: ReturnType<typeof boiteTraits> }>();

function dessinPage(g: Geo, c: ContenuPage, texte: string, suit?: string): Rang {
  const id = c.visuel ? idVisuel(c.visuel.sceneId) : c.dessins[0]?.e.id ?? `${c.derniere.id}~croquis`;
  const sceneId = c.visuel?.sceneId ?? c.dessins[0]?.sceneId ?? c.derniere.id;
  const colonneDroite = g.x0 > (g.bord ?? g.s.x0) + 1;
  const theme = themeDessin(texte, c.visuel?.v.id);
  const cle = `${id}~${g.style}~${theme}~${colonneDroite ? "haut" : "large"}`;
  let trace = DESSINS_TRACES.get(cle);
  if (!trace) {
    const P = plume(g.S, graineDe(`${id}~${g.style}`));
    const traits = colonneDroite ? dessinHaut(P, theme, g.style) : dessinTheme(P, theme, g.style);
    trace = { ts: traits, b: boiteTraits(traits) };
    if (DESSINS_TRACES.size > 500) DESSINS_TRACES.clear();
    DESSINS_TRACES.set(cle, trace);
  }
  const { ts, b } = trace;
  const largeur = g.x1 - g.x0;
  // Il ne grandit pas au-delà de ce que sa largeur permet (le dessin garde ses proportions).
  const hMax = Math.min(px(g, 760), Math.round((largeur * b.hauteur) / b.largeur));
  // Le dessin recadré à une hauteur donnée ne change pas d'un essai à l'autre (même largeur, même graine).
  const poses = new Map<number, TraitTableau[]>();
  const cadre = (h: number) => {
    let t = poses.get(h);
    if (!t) poses.set(h, (t = cadrerEnHaut(ts, { x: g.x0, y: 0, largeur, hauteur: h }, 2.2)));
    return t;
  };
  return { sorte: "souple", min: Math.min(px(g, 220), hMax), max: hMax, poser: (h) => bloc([croquis(g, id, sceneId, cadre(h), 0.9, suit)]) };
}

/* ------------------------------------------------------------------ */
/* La page                                                               */
/* ------------------------------------------------------------------ */

/** Les rangées d'une page, à la taille `g.f` ; `null` si un texte ne tient pas. */
function rangsDePage(g: Geo, c: ContenuPage, texte: string, gs: Geo = g, sansDessin = false): Rang[] | null {
  const rangs: Rang[] = [];
  const e = entete(g, c);
  if (e) rangs.push(e);
  let apresTitre = false;
  let souple = false;
  for (const gr of c.groupes) {
    let r: Rang | Rang[] | null = null;
    switch (gr.sorte) {
      case "titre":
        r = titre(g, gr.ligne);
        apresTitre = true;
        break;
      case "accroche":
        r = accroche(g, gr.ligne);
        break;
      case "phrase":
        r = phrase(g, gr.ligne, apresTitre, c.role);
        apresTitre = false;
        break;
      case "detail":
        r = detail(g, gr.ligne);
        break;
      case "idee":
        r = idee(g, gr.ligne);
        break;
      case "code":
      case "coche":
      case "liste":
        r = liste(gs, gr);
        souple = true;
        break;
      case "transformation":
        r = gr.lignes.map((x) => transformation(g, x)).every(Boolean) ? (gr.lignes.map((x) => transformation(g, x)) as Rang[]) : null;
        break;
      case "comparaison":
        r = comparaison(gs, gr);
        souple = true;
        break;
      case "bloc":
        r = blocOrange(g, gr);
        break;
      case "appel":
        r = appel(g, c, gr, gs);
        souple = true;
        break;
    }
    if (!r) return null;
    rangs.push(...(Array.isArray(r) ? r : [r]));
  }
  // Une page sans liste ni exemple ni appel : son dessin illustré, sous le texte (il remplit la page).
  // Il se trace après le dernier texte de la page (pendant que la voix en parle), jamais avant lui.
  const dernier = [...rangs].reverse().flatMap((r) => (r.sorte === "fixe" ? [...r.bloc.poses].reverse() : [])).find((p) => p.lignes.length && p.gabarit?.sorte !== "partie" && p.gabarit?.sorte !== "pastille");
  if (!souple && !sansDessin) rangs.push(dessinPage(gs, c, texte, dernier?.elementId));
  return rangs;
}

/** Résultat d'une page posée. */
export interface PageTableau {
  poses: Pose[];
  occupation: number;
  f: number;
}

/**
 * Une colonne de rangées posée entre `haut` et `bas` : les parties souples (dessins, listes, exemple) grandissent
 * jusqu'à couvrir `REMPLISSAGE_TABLEAU.vise` de la hauteur, puis les écarts s'ouvrent ; `null` si elle ne tient pas.
 */
function colonne(rangs: Rang[], haut: number, bas: number, k: number, f: number): { poses: Pose[]; dessus: number; dessous: number } | null {
  const utile = bas - haut;
  const n = rangs.length;
  if (!n) return { poses: [], dessus: haut, dessous: haut };
  const ecartBase = Math.round(34 * k * Math.min(1, f));
  const fixes = rangs.reduce((sm, r) => sm + (r.sorte === "fixe" ? r.bloc.h : 0), 0);
  const mins = rangs.reduce((sm, r) => sm + (r.sorte === "souple" ? r.min : 0), 0);
  if (fixes + mins + ecartBase * 0.25 * (n - 1) > utile * REMPLISSAGE_TABLEAU.max) return null;
  const souples = rangs.filter((r): r is Extract<Rang, { sorte: "souple" }> => r.sorte === "souple");
  // Chaque rangée souple posée une fois par hauteur (ses traits ne sont jamais modifiés ensuite) ; les traits ne sont
  // déplacés que pour la pose retenue (le tracé des dessins et leur déplacement coûtaient l'essentiel du temps d'une
  // page carrée : 1,4 s, essayée à chaque taille ; ~0,35 s ainsi).
  const memo = new Map<Rang, Map<number, Bloc>>();
  const poserRang = (r: Extract<Rang, { sorte: "souple" }>, h: number): Bloc => {
    const m = memo.get(r) ?? new Map<number, Bloc>();
    memo.set(r, m);
    let b = m.get(h);
    if (!b) m.set(h, (b = r.poser(h)));
    return b;
  };
  const poser = (vise: number) => {
    let reste = vise - fixes - mins - ecartBase * (n - 1);
    const hauteurs = new Map(souples.map((r) => [r, r.min]));
    for (let tour = 0; tour < 4 && reste > 1 && souples.length; tour++) {
      const ouverts = souples.filter((r) => hauteurs.get(r)! < r.max - 0.5);
      if (!ouverts.length) break;
      const part = reste / ouverts.length;
      for (const r of ouverts) {
        const h = Math.min(r.max, hauteurs.get(r)! + part);
        reste -= h - hauteurs.get(r)!;
        hauteurs.set(r, h);
      }
    }
    const blocs = rangs.map((r) => (r.sorte === "fixe" ? r.bloc : poserRang(r, Math.floor(hauteurs.get(r)!))));
    const hBlocs = blocs.reduce((sm, b) => sm + b.h, 0);
    const ecart = n > 1 ? Math.min(ecartBase * 10, Math.max(ecartBase * 0.25, (vise - hBlocs) / (n - 1))) : 0;
    const total = hBlocs + ecart * (n - 1);
    const y0 = Math.round(haut + Math.max(0, (utile - total) * 0.42));
    const places: { b: Bloc; dy: number }[] = [];
    let y = y0;
    for (const b of blocs) {
      places.push({ b, dy: Math.round(y) });
      y += b.h + ecart;
    }
    const dessus = Math.min(...places.flatMap(({ b, dy }) => b.poses.map((p) => p.enc.y + dy)));
    const dessous = Math.max(...places.flatMap(({ b, dy }) => b.poses.map((p) => p.enc.y + p.enc.hauteur + dy)));
    let poses: Pose[] | undefined;
    return {
      get poses(): Pose[] {
        return (poses ??= places.flatMap(({ b, dy }) => b.poses.map((p) => deplacer(p, 0, dy))));
      },
      dessus,
      dessous,
    };
  };
  // Le contenu mesuré (traits et objets compris) doit couvrir 85 à 95 % : on vise 90 %, puis on corrige l'écart mesuré.
  let vise = utile * REMPLISSAGE_TABLEAU.vise;
  let r = poser(vise);
  for (let i = 0; i < 6; i++) {
    const occ = (r.dessous - r.dessus) / utile;
    if (occ >= REMPLISSAGE_TABLEAU.min + 0.005 && occ <= REMPLISSAGE_TABLEAU.max - 0.005) break;
    vise += (REMPLISSAGE_TABLEAU.vise - occ) * utile;
    r = poser(vise);
  }
  if (r.dessous > bas + 0.5 || r.dessus < haut - 0.5 || (r.dessous - r.dessus) / utile > REMPLISSAGE_TABLEAU.max) return null;
  return r;
}

/**
 * Pose une page dans l'un des trois styles : au plus grand facteur de taille qui tient (de 1 à 0,6). En vertical et en
 * 4:5, une colonne ; en carré et en 16:9, deux colonnes (le texte à gauche ; le dessin, la liste ou l'exemple à droite).
 * `null` si la page ne tient pas, même au plus petit.
 */
export function poserPageTableau(c: ContenuPage, s: Sortie, style: StyleTableau, haut: number, bas: number): PageTableau | null {
  const texte = [...c.groupes.flatMap((gr) => ("ligne" in gr ? [gr.ligne.l.texte] : "lignes" in gr ? gr.lignes.map((x) => x.l.texte) : gr.sorte === "comparaison" ? [gr.avant?.l.texte ?? "", gr.apres?.l.texte ?? ""] : [])), c.premiere.texteDit, c.derniere.texteDit].join(" ");
  // Une page d'exemple « avant / maintenant » se pose en une colonne (ses deux côtés y sont déjà côte à côte).
  const basse = s.W >= s.H * 0.99;
  // Le 4:5 essaie d'abord une colonne, puis les replis des sorties basses.
  const portrait = !basse && s.H < s.W * 1.4;
  const deuxPermis = (basse || portrait) && !c.groupes.some((x) => x.sorte === "comparaison");
  // Replis : deux colonnes (sorties basses), puis une seule ; enfin, planchers un peu plus bas (sorties basses).
  // Dernier recours : la page sans son dessin illustré (il n'est qu'une illustration ; le texte, lui, est entier).
  const essais: { deux: boolean; repli: number; sansDessin?: boolean }[] = (
    basse
      ? [{ deux: true, repli: 1 }, { deux: false, repli: 1 }, { deux: true, repli: 0.85 }, { deux: false, repli: 0.85 }, { deux: false, repli: 0.85, sansDessin: true }, { deux: true, repli: 0.72 }, { deux: false, repli: 0.72, sansDessin: true }]
      : portrait
        ? [{ deux: false, repli: 1 }, { deux: true, repli: 1 }, { deux: false, repli: 0.85 }, { deux: true, repli: 0.85 }, { deux: false, repli: 0.85, sansDessin: true }]
        : [{ deux: false, repli: 1 }, { deux: false, repli: 1, sansDessin: true }]
  ).filter((x) => deuxPermis || !x.deux);
  // Rien ne dépasse de la zone sûre (contrôle « Rien ne dépasse » de la fabrication) : quand un décor (surligneur,
  // ruban, carte, case) déborde du bord, la page se repose un peu plus étroite de ce côté (vidéo v-b2d772d28b97).
  const marges = { g: 0, d: 0 };
  for (let tour = 0; tour < 4; tour++) {
    const r = essayerPageTableau(c, s, style, haut, bas, essais, texte, marges);
    if (!r) return null;
    const u = union(r.poses.map((p) => p.enc));
    const g = Math.max(0, Math.ceil(s.zone.x - u.x));
    const d = Math.max(0, Math.ceil(u.x + u.largeur - (s.zone.x + s.zone.largeur)));
    if ((!g && !d) || tour === 3) return r;
    marges.g += g ? g + 2 : 0;
    marges.d += d ? d + 2 : 0;
  }
  return null;
}

function essayerPageTableau(c: ContenuPage, s: Sortie, style: StyleTableau, haut: number, bas: number, essais: { deux: boolean; repli: number; sansDessin?: boolean }[], texte: string, marges: { g: number; d: number }): PageTableau | null {
  const S = CHARTES_TABLEAU[style];
  const k = s.k;
  const utile = bas - haut;
  const x0 = s.x0 + marges.g;
  const x1 = s.x1 - marges.d;
  for (const { deux, repli, sansDessin } of essais)
  for (let f = 1; f >= 0.6 - 1e-9; f -= 0.05) {
    const P = plume(S, graineDe(`${c.page}~${style}`));
    const g: Geo = { s, S, style, k, f, x0, x1, haut, bas, P, repli, bord: x0 };
    // Deux colonnes : le texte prend un peu plus de la moitié.
    const avecTexteADroite = c.groupes.some((x) => x.sorte === "code" || x.sorte === "coche" || x.sorte === "liste" || x.sorte === "comparaison");
    const mil = Math.round(x0 + (x1 - x0) * (avecTexteADroite ? 0.46 : c.groupes.some((x) => x.sorte === "transformation") ? 0.56 : 0.5));
    const gauche: Geo = deux ? { ...g, x1: mil - Math.round(36 * k) } : g;
    const droite: Geo = deux ? { ...g, x0: mil + Math.round(36 * k) } : g;
    const rangs = rangsDePage(gauche, c, texte, droite, sansDessin);
    if (!rangs) continue;
    const fixes = rangs.filter((r) => r.sorte === "fixe");
    const souples = rangs.filter((r) => r.sorte === "souple");
    const cols = deux && fixes.length && souples.length ? [colonne(fixes, haut, bas, k, f), colonne(souples, haut, bas, k, f)] : [colonne(rangs, haut, bas, k, f)];
    if (cols.some((x) => !x)) continue;
    const poses = cols.flatMap((x) => x!.poses);
    // Deux colonnes : chacune remplit sa hauteur ; la page compte la plus haute.
    const occupation = Math.max(...cols.map((x) => (x!.dessous - x!.dessus) / utile));
    return { poses, occupation: Math.round(occupation * 1e6) / 1e6, f };
  }
  return null;
}

/** Géométrie du style : libellés des chapitres, surface d'écriture, bas du support, haut du contenu. */
export function geometrieTableau(s: Sortie, style: StyleTableau): { chapitres: RectPx[]; tailleChapitre: number; surface: RectPx; basSupport: number; hautContenu: number; contenu: RectPx } {
  const k = s.k;
  const S = CHARTES_TABLEAU[style];
  const pol: PoliceTableau = style === "paperboard" ? "caveat" : "kalam";
  const noms = ["Douleur", "Solution", "Exemple", "À vous"];
  const col = (s.x1 - s.x0) / 4;
  let taille = Math.round(TAILLES[style].chapitre * k);
  const marge = style === "paperboard" ? 30 * k : 18 * k;
  while (taille > MINIMUMS.chapitre * k && noms.some((n) => largeurTableau(n, pol, taille) > col - marge)) taille--;
  const il = Math.round(taille * INTERLIGNES_TABLEAU[pol]);
  const y = style === "paperboard" ? s.haut + Math.round(14 * k) : s.haut;
  const chapitres = noms.map((n, i) => {
    const l = Math.ceil(largeurTableau(n, pol, taille));
    const x = style === "paperboard" ? Math.round(s.x0 + col * i + (col - l) / 2) : Math.round(s.x0 + col * i);
    return { x, y, largeur: l, hauteur: il };
  });
  const basChapitres = y + il + Math.round((style === "paperboard" ? 22 : 30) * k);
  const bandeBas = s.bande.y + s.bande.hauteur;
  const part = style === "paperboard" ? 0.65 : style === "ardoise" ? 0.47 : 0.46;
  const basSupport = Math.round(bandeBas + (s.H - bandeBas) * part);
  const surface = style === "paperboard" ? { x: Math.round(40 * k), y: Math.round(84 * k), largeur: s.W - Math.round(80 * k), hauteur: basSupport - Math.round(84 * k) } : style === "ardoise" ? { x: Math.round(24 * k), y: Math.round(30 * k), largeur: s.W - Math.round(48 * k), hauteur: basSupport - Math.round(58 * k) } : { x: Math.round(26 * k), y: Math.round(34 * k), largeur: s.W - Math.round(52 * k), hauteur: basSupport - Math.round(34 * k) };
  void S;
  const hautContenu = basChapitres + Math.round(20 * k);
  const contenu = { x: s.x0 - Math.round(28 * k), y: hautContenu - Math.round(30 * k), largeur: s.x1 - s.x0 + Math.round(56 * k), hauteur: s.bande.y - Math.round(10 * k) - (hautContenu - Math.round(30 * k)) };
  return { chapitres, tailleChapitre: taille, surface, basSupport, hautContenu, contenu };
}
