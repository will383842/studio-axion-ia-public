/**
 * GÉOMÉTRIE DES PLANS D'AUJOURD'HUI POUR LE CONTRÔLE DE COMPOSITION (lot qualité 25-11, QUAL-4) — PUR, 0 €.
 * Reproduit ce que dessine `src/briques/plan-scenes/rendu.tsx` pour un `PlanValide` (chemin Claude ou repli) :
 * mise à l'échelle de la toile de la pièce dans sa zone (`rendu.tsx:46-56`), calques / sous-zones / zoom caméra
 * (`:59-75`), étiquette `texte` posée dans `ZONES.haut` (`:97,:114`) ; et les rectangles des sous-titres depuis
 * `DonneesCalque`. Règle : prudent mais honnête ; en cas de doute, une estimation PAR EXCÈS de la place prise
 * (largeur de texte large, interligne 1,4). Les tailles de police viennent de `TAILLES_TEXTE_PIECES`, relue contre
 * les `.tsx` des briques par un test (elle ne peut pas dériver en silence). Une pièce non modélisée est une simple
 * forme pleine (contenu sans texte mesuré) : jamais une fausse alerte de taille.
 */
import { adoucir, decelerer, entre, msEnImages, progression } from "@/briques/jetons-motion";
import type { ElementVisible, FormatImage, ImageSansVoix, RectPx } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import type { PlanValide, SceneValide } from "@/briques/plan-scenes/schema";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { SOUS_ZONES, ZONES, type Rectangle } from "@/briques/plan-scenes/zones";
import { pointDuTrajet } from "@/briques/plan-scenes/briques/Curseur";
import { transformZoom } from "@/briques/plan-scenes/briques/ZoomCamera";
import { escalierAuTemps, largeurElement, sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import type { RectSousTitre } from "@/briques/plan-scenes/tutoriel/controle-composition";

/** Tailles de police (px, dans la toile de 1000 de large de chaque pièce) relevées dans `briques/*.tsx`. */
export const TAILLES_TEXTE_PIECES = {
  legende: { fichier: "Legende.tsx", tailles: { titre: 84, bandeau: 58, etiquette: 40 }, sousTexteRatio: 0.5 },
  "liste-au-mot": { fichier: "PiecesDonnees.tsx", tailles: { titre: 40, element: 44 } },
  repere: { fichier: "PiecesDonnees.tsx", tailles: { genre: 28, texte: 64 } },
  "tableau-de-bord": { fichier: "TableauDeBord.tsx", tailles: { titre: 40, libelle: 26, valeur: 84 } },
  "liste-crm": { fichier: "ListeCrm.tsx", tailles: { titre: 38, initiale: 28, nom: 30, detail: 28, statut: 28 } },
  "carte-kpi": { fichier: "CarteKpi.tsx", tailles: { libelle: 34, valeur: 150, variation: 28 } },
  "fenetre-app": { fichier: "FenetreApp.tsx", tailles: { titre: 28, onglet: 28 } },
  curseur: { fichier: "Curseur.tsx", tailles: {} },
} as const;

type Brut = Omit<ElementVisible, "z"> & { z?: number };

const INTERLIGNE = 1.4;
const apparition = (image: number, debut: number, duree = 12) => progression(image, debut, duree, decelerer);

function boiteTexte(texte: string, taille: number, dispo: number, graisse: number, interligne = INTERLIGNE): { largeur: number; hauteur: number; lignes: number } {
  const brut = texte.length * taille * (graisse >= 700 ? 0.6 : 0.56);
  const lignes = Math.max(1, Math.ceil(brut / Math.max(1, dispo)));
  return { largeur: Math.min(brut, dispo), hauteur: lignes * taille * interligne, lignes };
}

function imageArrivee(aMs: number | undefined, rang: number, total: number, fps: number, dureeImages: number): number {
  if (aMs !== undefined) return Math.round((aMs * fps) / 1000);
  return Math.round((dureeImages / 2) * (rang / Math.max(1, total)));
}

const texte = (id: string, rect: RectPx, taillePx: number, t: string, opacite: number, parentId?: string): Brut => ({ id, genre: "texte", rect, opacite, taillePx, texte: t, lignes: [t], ...(parentId ? { parentId } : {}) });
const forme = (id: string, rect: RectPx, opacite: number, parentId?: string): Brut => ({ id, genre: "forme", rect, opacite, remplissage: "blanc", ...(parentId ? { parentId } : {}) });

interface ContexteP {
  image: number;
  fps: number;
  dureeImages: number;
}

function legende(p: { texte: string; sousTexte: string; style: "bandeau" | "etiquette" | "titre" }, c: ContexteP): Brut[] {
  const T = TAILLES_TEXTE_PIECES.legende;
  const taille = T.tailles[p.style];
  const padX = p.style === "bandeau" ? 44 : p.style === "etiquette" ? 30 : 0;
  const padY = p.style === "bandeau" ? 30 : p.style === "etiquette" ? 16 : 0;
  const dispo = 960 - 2 * padX;
  const t = boiteTexte(p.texte, taille, dispo, 800, 1.12);
  const tailleSous = Math.round(taille * T.sousTexteRatio);
  const s = p.sousTexte ? boiteTexte(p.sousTexte, tailleSous, dispo, 500) : null;
  const filet = p.style !== "etiquette";
  const H = t.hauteur + (s ? 10 + s.hauteur : 0) + (filet ? 22 : 0);
  const L = Math.max(t.largeur, s?.largeur ?? 0, filet ? 160 : 0);
  const boxW = Math.min(960, L + 2 * padX);
  const boxH = Math.min(280, H + 2 * padY);
  const x = (1000 - boxW) / 2;
  const y = (300 - boxH) / 2;
  const o = apparition(c.image, 0, 14);
  const parent = p.style === "titre" ? undefined : "fond";
  const out: Brut[] = [];
  if (parent) out.push(forme("fond", { x, y, largeur: boxW, hauteur: boxH }, o));
  let cy = y + padY;
  // `Legende.tsx` CENTRE le texte dans la boîte : x = centre de la boîte − largeur / 2 (jamais poussé à droite).
  out.push(texte("texte", { x: x + (boxW - t.largeur) / 2, y: cy, largeur: t.largeur, hauteur: t.hauteur }, taille, p.texte, o, parent));
  cy += t.hauteur;
  if (s) {
    cy += 10;
    out.push(texte("sous-texte", { x: x + (boxW - s.largeur) / 2, y: cy, largeur: s.largeur, hauteur: s.hauteur }, tailleSous, p.sousTexte, o, parent));
    cy += s.hauteur;
  }
  if (filet) out.push(forme("filet", { x: 500 - 80, y: cy + 16, largeur: 160, hauteur: 6 }, o, parent));
  return out;
}

function listeAuMot(p: { titre?: string; elements: { texte: string; aMs?: number }[] }, c: ContexteP): Brut[] {
  const T = TAILLES_TEXTE_PIECES["liste-au-mot"].tailles;
  const { largeur: l, hauteur: h } = TOILES["liste-au-mot"];
  const o = apparition(c.image, 0, 10);
  const out: Brut[] = [forme("panneau", { x: 20, y: 20, largeur: l - 40, hauteur: h - 40 }, o)];
  const x0 = 68;
  const innerW = l - 40 - 96;
  const innerH = h - 40 - 72;
  const rangees = p.elements.map((e) => boiteTexte(e.texte, T.element, innerW - 46, 600, 1.15));
  const titre = p.titre ? boiteTexte(p.titre, T.titre, innerW, 800) : null;
  const H = (titre ? titre.hauteur + 6 : 0) + rangees.reduce((s, r) => s + Math.max(22, r.hauteur), 0) + 18 * (rangees.length + (titre ? 1 : 0) - 1);
  let y = 56 + Math.max(0, (innerH - H) / 2);
  if (titre && p.titre) {
    out.push(texte("titre", { x: x0, y, largeur: titre.largeur, hauteur: titre.hauteur }, T.titre, p.titre, o, "panneau"));
    y += titre.hauteur + 6 + 18;
  }
  p.elements.forEach((e, i) => {
    const r = rangees[i]!;
    const oi = o * apparition(c.image, imageArrivee(e.aMs, i, p.elements.length, c.fps, c.dureeImages));
    const hauteur = Math.max(22, r.hauteur);
    out.push(forme(`puce-${i}`, { x: x0, y: y + (hauteur - 22) / 2, largeur: 22, hauteur: 22 }, oi, "panneau"));
    out.push(texte(`element-${i}`, { x: x0 + 46, y, largeur: r.largeur, hauteur: r.hauteur }, T.element, e.texte, oi, "panneau"));
    y += hauteur + 18;
  });
  return out;
}

function repere(p: { genre: "lieu" | "date" | "duree"; texte: string; aMs?: number }, c: ContexteP): Brut[] {
  const T = TAILLES_TEXTE_PIECES.repere.tailles;
  const debut = imageArrivee(p.aMs, 0, 1, c.fps, c.dureeImages);
  const o = apparition(c.image, debut);
  const etiquette = { lieu: "Lieu", date: "Date", duree: "Durée" }[p.genre];
  const wE = etiquette.length * T.genre * 0.75;
  const dispo = 960 - 88 - 22 - wE;
  const t = boiteTexte(p.texte, T.texte, dispo, 800, 1.1);
  const boxW = Math.min(960, 88 + wE + 22 + t.largeur);
  const boxH = Math.min(240, 44 + Math.max(t.hauteur, T.genre * INTERLIGNE));
  const x = (1000 - boxW) / 2;
  const y = (260 - boxH) / 2;
  return [
    forme("pastille", { x, y, largeur: boxW, hauteur: boxH }, o),
    texte("genre", { x: x + 44, y: y + (boxH - T.genre * INTERLIGNE) / 2, largeur: wE, hauteur: T.genre * INTERLIGNE }, T.genre, etiquette, o, "pastille"),
    texte("texte", { x: x + 44 + wE + 22, y: y + 22, largeur: t.largeur, hauteur: t.hauteur }, T.texte, p.texte, o, "pastille"),
  ];
}

function tableauDeBord(p: { titre: string; kpis: { libelle: string; valeur: string }[] }, c: ContexteP): Brut[] {
  const T = TAILLES_TEXTE_PIECES["tableau-de-bord"].tailles;
  const { largeur } = TOILES["tableau-de-bord"];
  const n = p.kpis.length;
  const lt = (largeur - 80 - 24 * (n - 1)) / n;
  const out: Brut[] = [];
  const t = boiteTexte(p.titre, T.titre, largeur - 80, 800);
  out.push(texte("titre", { x: 40, y: 20, largeur: t.largeur, hauteur: t.hauteur }, T.titre, p.titre, apparition(c.image, 0)));
  p.kpis.forEach((k, i) => {
    const o = apparition(c.image, 6 + i * 6);
    const x = 40 + i * (lt + 24);
    out.push(forme(`tuile-${i}`, { x, y: 110, largeur: lt, hauteur: 230 }, o));
    const a = boiteTexte(k.libelle, T.libelle, lt - 64, 600);
    const v = boiteTexte(k.valeur, T.valeur, lt - 64, 800, 1);
    out.push(texte(`libelle-${i}`, { x: x + 32, y: 140, largeur: a.largeur, hauteur: a.hauteur }, T.libelle, k.libelle, o, `tuile-${i}`));
    out.push(texte(`valeur-${i}`, { x: x + 32, y: 340 - 30 - v.hauteur, largeur: v.largeur, hauteur: v.hauteur }, T.valeur, k.valeur, o, `tuile-${i}`));
  });
  out.push(forme("courbe", { x: 40, y: 380, largeur: largeur - 80, hauteur: 340 }, apparition(c.image, 16)));
  return out;
}

function listeCrm(p: { titre: string; lignes: { nom: string; detail: string; statut: "nouveau" | "en-cours" | "gagne" | "perdu" }[] }, c: ContexteP): Brut[] {
  const T = TAILLES_TEXTE_PIECES["liste-crm"].tailles;
  const { largeur } = TOILES["liste-crm"];
  const LIB = { nouveau: "Nouveau", "en-cours": "En cours", gagne: "Signé", perdu: "Perdu" } as const;
  const t = boiteTexte(p.titre, T.titre, largeur - 80, 800);
  const out: Brut[] = [texte("titre", { x: 40, y: 20, largeur: t.largeur, hauteur: t.hauteur }, T.titre, p.titre, apparition(c.image, 0))];
  p.lignes.forEach((l, i) => {
    const o = apparition(c.image, 8 + i * 6);
    const top = 110 + i * 100;
    const id = `ligne-${i}`;
    out.push(forme(id, { x: 40, y: top, largeur: largeur - 80, hauteur: 86 }, o));
    const ini = T.initiale * INTERLIGNE;
    out.push(texte(`initiale-${i}`, { x: 68 + 17, y: top + (86 - ini) / 2, largeur: 16, hauteur: ini }, T.initiale, l.nom.slice(0, 1), o, id));
    const nom = boiteTexte(l.nom, T.nom, 560, 700);
    const det = boiteTexte(l.detail || " ", T.detail, 560, 500);
    out.push(texte(`nom-${i}`, { x: 142, y: top + (86 - nom.hauteur - det.hauteur) / 2, largeur: nom.largeur, hauteur: nom.hauteur }, T.nom, l.nom, o, id));
    if (l.detail) out.push(texte(`detail-${i}`, { x: 142, y: top + (86 - nom.hauteur - det.hauteur) / 2 + nom.hauteur, largeur: det.largeur, hauteur: det.hauteur }, T.detail, l.detail, o, id));
    const s = boiteTexte(LIB[l.statut], T.statut, 200, 700);
    out.push(texte(`statut-${i}`, { x: largeur - 40 - 28 - 18 - s.largeur, y: top + (86 - s.hauteur) / 2, largeur: s.largeur, hauteur: s.hauteur }, T.statut, LIB[l.statut], o, id));
  });
  return out;
}

function carteKpi(p: { libelle: string; valeur: number; prefixe: string; suffixe: string; decimales: number; variation: string }, c: ContexteP): Brut[] {
  const T = TAILLES_TEXTE_PIECES["carte-kpi"].tailles;
  const { largeur, hauteur } = TOILES["carte-kpi"];
  const o = apparition(c.image, 0, 12);
  const dispo = largeur - 40 - 104;
  const a = boiteTexte(p.libelle, T.libelle, dispo, 600);
  const chiffres = `${p.prefixe}${Math.abs(p.valeur).toFixed(p.decimales)}${p.suffixe}`;
  const v = boiteTexte(chiffres, T.valeur, dispo, 800, 1);
  const d = boiteTexte(`↗ ${p.variation}`, T.variation, dispo, 600);
  const y0 = 20 + 44;
  const y1 = hauteur - 20 - 44;
  return [
    forme("carte", { x: 20, y: 20, largeur: largeur - 40, hauteur: hauteur - 40 }, o),
    texte("libelle", { x: 72, y: y0, largeur: a.largeur, hauteur: a.hauteur }, T.libelle, p.libelle, o, "carte"),
    texte("valeur", { x: 72, y: (y0 + y1) / 2 - v.hauteur / 2, largeur: v.largeur, hauteur: v.hauteur }, T.valeur, chiffres, o, "carte"),
    texte("variation", { x: 72, y: y1 - d.hauteur, largeur: d.largeur, hauteur: d.hauteur }, T.variation, p.variation, o * apparition(c.image, 30), "carte"),
  ];
}

function fenetreApp(p: { titre: string; onglets: string[]; contenu: "vide" | "formulaire" | "liste" }, c: ContexteP): Brut[] {
  const T = TAILLES_TEXTE_PIECES["fenetre-app"].tailles;
  const { largeur, hauteur } = TOILES["fenetre-app"];
  const o = progression(c.image, 0, 14, adoucir);
  const out: Brut[] = [forme("fenetre", { x: 20, y: 20, largeur: largeur - 40, hauteur: hauteur - 40 }, o)];
  const t = boiteTexte(p.titre, T.titre, largeur - 40 - 160, 700);
  out.push(texte("titre", { x: 156, y: 20 + (76 - t.hauteur) / 2, largeur: t.largeur, hauteur: t.hauteur }, T.titre, p.titre, o, "fenetre"));
  let x = 52;
  p.onglets.forEach((onglet, i) => {
    const b = boiteTexte(onglet, T.onglet, 200, 600);
    out.push(texte(`onglet-${i}`, { x, y: 20 + 76 + 66 - 14 - b.hauteur, largeur: b.largeur, hauteur: b.hauteur }, T.onglet, onglet, o, "fenetre"));
    x += b.largeur + 34;
  });
  const n = p.contenu === "vide" ? 0 : p.contenu === "formulaire" ? 3 : 4;
  const y0 = 20 + 76 + (p.onglets.length ? 66 : 0) + 32;
  for (let i = 0; i < n; i++) out.push(forme(`champ-${i}`, { x: 52, y: y0 + i * 88, largeur: largeur - 104, hauteur: 66 }, o * apparition(c.image, 10 + i * 4), "fenetre"));
  return out;
}

function curseur(p: { trajet: { x: number; y: number }[]; clic: boolean; partDeplacement: number }, c: ContexteP): Brut[] {
  const { largeur, hauteur } = TOILES.curseur;
  const duree = Math.max(1, Math.round(c.dureeImages * p.partDeplacement));
  const pt = pointDuTrajet(p.trajet, progression(c.image, 0, duree, adoucir));
  const x = (pt.x / 100) * largeur;
  const y = (pt.y / 100) * hauteur;
  return [{ id: "curseur", genre: "curseur", rect: { x, y, largeur: 44, hauteur: 56 }, opacite: 1, pointe: { x, y } }];
}

function zoomSeul(p: { cible: { x: number; y: number }; facteur: number; moment: number; titreFenetre: string }, c: ContexteP): Brut[] {
  const { largeur, hauteur } = TOILES["zoom-camera"];
  const base = fenetreApp({ titre: p.titreFenetre, onglets: [], contenu: "liste" }, c);
  const s = facteurZoom(p, c.image, c.dureeImages);
  const o = { x: (p.cible.x / 100) * largeur, y: (p.cible.y / 100) * hauteur };
  const cadre: RectPx = { x: 0, y: 0, largeur, hauteur };
  const sortie: Brut[] = [];
  for (const b of base) {
    const r = zoomerRect(b.rect, o, s);
    const x0 = Math.max(r.x, cadre.x);
    const y0 = Math.max(r.y, cadre.y);
    const x1 = Math.min(r.x + r.largeur, cadre.largeur);
    const y1 = Math.min(r.y + r.hauteur, cadre.hauteur);
    // Rogner à la toile cacherait une vraie coupe : un TEXTE zoomé qui déborde de la boîte (même en partie, même en
    // entier) est signalé `coupe` (HORS_CADRE). Les formes (bords de fenêtre) qui débordent sont le zoom lui-même.
    const dehors = x1 <= x0 || y1 <= y0;
    const coupe = b.genre === "texte" && (dehors || x0 > r.x + 0.5 || y0 > r.y + 0.5 || x1 < r.x + r.largeur - 0.5 || y1 < r.y + r.hauteur - 0.5);
    if (dehors && !coupe) continue;
    const rect = dehors ? r : { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
    sortie.push({ ...b, rect, ...(b.taillePx ? { taillePx: b.taillePx * s } : {}), ...(coupe ? { coupe: true } : {}) });
  }
  return sortie;
}

function facteurZoom(p: { cible: { x: number; y: number }; facteur: number; moment: number; titreFenetre?: string }, image: number, dureeImages: number): number {
  const css = transformZoom(p as never, image, dureeImages);
  const m = /scale\(([\d.]+)\)/.exec(String(css.transform ?? ""));
  return m ? Number(m[1]) : entre(1, p.facteur, 0);
}

function zoomerRect(r: RectPx, o: { x: number; y: number }, s: number): RectPx {
  return { x: o.x + (r.x - o.x) * s, y: o.y + (r.y - o.y) * s, largeur: r.largeur * s, hauteur: r.hauteur * s };
}

/** Géométrie d'une pièce dans SA toile (px de toile) ; pièce non modélisée : une forme pleine (contenu sans texte mesuré). */
function geometriePiece(piece: string, parametres: unknown, c: ContexteP): Brut[] {
  const p = parametres as never as Record<string, never>;
  switch (piece) {
    case "legende":
      return legende(p as never, c);
    case "liste-au-mot":
      return listeAuMot(p as never, c);
    case "repere":
      return repere(p as never, c);
    case "tableau-de-bord":
      return tableauDeBord(p as never, c);
    case "liste-crm":
      return listeCrm(p as never, c);
    case "carte-kpi":
      return carteKpi(p as never, c);
    case "fenetre-app":
      return fenetreApp(p as never, c);
    case "curseur":
      return curseur(p as never, c);
    case "zoom-camera":
      return zoomSeul(p as never, c);
    default: {
      const t = (TOILES as Record<string, { largeur: number; hauteur: number }>)[piece] ?? { largeur: 1000, hauteur: 700 };
      // Forme INVENTÉE (pièce non modélisée) : jamais de fausse alerte de marge (`bordTolere`).
      return [{ ...forme("contenu", { x: 20, y: 20, largeur: t.largeur - 40, hauteur: t.hauteur - 40 }, apparition(c.image, 0, 10)), bordTolere: true }];
    }
  }
}

function enPx(r: Rectangle, largeur: number, hauteur: number): RectPx {
  return { x: (r.x / 100) * largeur, y: (r.y / 100) * hauteur, largeur: (r.largeur / 100) * largeur, hauteur: (r.hauteur / 100) * hauteur };
}

/** Une pièce posée dans sa boîte (toile centrée, proportions gardées) : éléments en px de l'image. */
function poserPiece(piece: string, parametres: unknown, boite: RectPx, c: ContexteP, prefixe: string): ElementVisible[] {
  const toile = (TOILES as Record<string, { largeur: number; hauteur: number }>)[piece] ?? { largeur: 1000, hauteur: 700 };
  const ech = Math.min(boite.largeur / toile.largeur, boite.hauteur / toile.hauteur);
  const ox = boite.x + (boite.largeur - toile.largeur * ech) / 2;
  const oy = boite.y + (boite.hauteur - toile.hauteur * ech) / 2;
  return geometriePiece(piece, parametres, c).map((b, i) => ({
    ...b,
    id: `${prefixe}${b.id}`,
    ...(b.parentId ? { parentId: `${prefixe}${b.parentId}` } : {}),
    rect: { x: ox + b.rect.x * ech, y: oy + b.rect.y * ech, largeur: b.rect.largeur * ech, hauteur: b.rect.hauteur * ech },
    ...(b.taillePx !== undefined ? { taillePx: b.taillePx * ech } : {}),
    ...(b.pointe ? { pointe: { x: ox + b.pointe.x * ech, y: oy + b.pointe.y * ech } } : {}),
    z: i,
  }));
}

function elementsDeLaScene(scene: SceneValide, plan: PlanValide, tMs: number): ElementVisible[] {
  const { largeur, hauteur, fps } = plan.format;
  const local = tMs - scene.debutMs;
  const debut = msEnImages(scene.debutMs, fps);
  const dureeImages = Math.max(1, msEnImages(scene.finMs, fps) - debut);
  const image = Math.round((local * fps) / 1000);
  const dT = Math.max(1, msEnImages(scene.transition.dureeMs, fps));
  const tEntree = progression(image, 0, dT, adoucir);
  const tSortie = 1 - progression(image, dureeImages - dT, dT, adoucir);
  const opaciteScene = Math.min(tEntree, tSortie);
  const t = tEntree < 1 ? tEntree : tSortie;
  const sens = tEntree < 1 ? scene.transition.entree : scene.transition.sortie;
  const dx = sens === "glisse-gauche" ? entre(60, 0, t) : 0;
  const dy = sens === "glisse-haut" ? entre(40, 0, t) : 0;
  const boite = enPx(ZONES[scene.position], largeur, hauteur);
  const contexte: ContexteP = { image, fps, dureeImages };
  let els: ElementVisible[] = [];
  // Scène « plein » : la toile (proportions gardées) est entièrement dans l'image ; son panneau à 20 px de la toile (≈ 21,6 px)
  // n'est pas une sortie du cadre (`bordTolere`). Posé AVANT le zoom : un zoom qui sort de l'image reste signalé.
  const sansMarge = (l: ElementVisible[]): ElementVisible[] => (scene.position === "plein" ? l.map((e) => ({ ...e, bordTolere: true })) : l);
  if (scene.niveau === 2 && scene.calques?.length) {
    const zoom = scene.calques.find((c) => c.piece === "zoom-camera");
    scene.calques.forEach((cq, i) => {
      if (cq === zoom) return;
      const depart = msEnImages(cq.debutMs, fps);
      if (image < depart) return;
      const b = enPx(SOUS_ZONES[cq.zone], boite.largeur, boite.hauteur);
      const sb: RectPx = { x: boite.x + b.x, y: boite.y + b.y, largeur: b.largeur, hauteur: b.hauteur };
      els.push(...poserPiece(cq.piece, cq.parametres, sb, { image: image - depart, fps, dureeImages: Math.max(1, dureeImages - depart) }, `${scene.id}:c${i}:${cq.piece}:`));
    });
    els = sansMarge(els);
    if (zoom) {
      const z = zoom.parametres as { cible: { x: number; y: number }; facteur: number; moment: number };
      const s = facteurZoom(z, image - msEnImages(zoom.debutMs, fps), dureeImages);
      const o = { x: boite.x + (z.cible.x / 100) * boite.largeur, y: boite.y + (z.cible.y / 100) * boite.hauteur };
      els = els.map((e) => ({ ...e, rect: zoomerRect(e.rect, o, s), ...(e.taillePx !== undefined ? { taillePx: e.taillePx * s } : {}), ...(e.pointe ? { pointe: { x: o.x + (e.pointe.x - o.x) * s, y: o.y + (e.pointe.y - o.y) * s } } : {}) }));
    }
  } else {
    els.push(...sansMarge(poserPiece(scene.piece, scene.parametres, boite, contexte, `${scene.id}:${scene.piece}:`)));
  }
  // `rendu.tsx:97` : étiquette `texte` hors légende / haut / plein, dans ZONES.haut.
  if (scene.texte && scene.piece !== "legende" && scene.position !== "haut" && scene.position !== "plein") {
    els.push(...poserPiece("legende", { texte: scene.texte, sousTexte: "", style: "etiquette" }, enPx(ZONES.haut, largeur, hauteur), contexte, `${scene.id}:etiquette:`));
  }
  // Cible d'un curseur : le plus petit élément (carte, ligne, texte) sous sa pointe.
  const cibles = els.filter((e) => e.genre === "forme" || e.genre === "texte");
  els = els.map((e) => {
    if (e.genre !== "curseur" || !e.pointe) return e;
    const p = e.pointe;
    const dessous = cibles.filter((c) => p.x >= c.rect.x && p.x <= c.rect.x + c.rect.largeur && p.y >= c.rect.y && p.y <= c.rect.y + c.rect.hauteur).sort((a, b) => a.rect.largeur * a.rect.hauteur - b.rect.largeur * b.rect.hauteur)[0];
    return dessous ? { ...e, cibleId: dessous.id } : e;
  });
  return els.map((e) => ({ ...e, opacite: Math.round(e.opacite * opaciteScene * 1000) / 1000, rect: { ...e.rect, x: e.rect.x + dx, y: e.rect.y + dy } }));
}

/** Ce que dessine `ImagePlan` à l'instant `tMs`, en éléments posés (pour `controlerComposition`). */
export function imagesPlanValideA(plan: PlanValide): (tMs: number) => ImageSansVoix {
  return (tMs) => {
    const scene = plan.scenes.find((s) => tMs >= s.debutMs && tMs < s.finMs);
    return { tMs, fond: plan.habillage.fond === "noir" ? "noir" : "ivoire", elements: scene ? elementsDeLaScene(scene, plan, tMs) : [] };
  };
}

export const formatDuPlan = (plan: PlanValide): FormatImage => plan.format;

/**
 * Rectangles des lignes de sous-titres à l'instant (ms), depuis les données du calque : largeur mesurée par
 * `largeurElement` × échelle, centre `yPx` (+ décalage d'entrée), hauteur 1,1 × taille (+ marges du bandeau et de la
 * pastille, + débord de l'inclinaison, + loupe des mots, + boîte arrondie). Chaque rectangle porte la taille de police
 * effective (`taillePx`). `escalier` présent : un rectangle large couvre sa zone sûre. Par excès : le contour et l'ombre
 * ne sont pas comptés comme vides.
 */
export function rectsSousTitresA(donnees: DonneesCalque): (tMs: number) => RectSousTitre[] {
  return (tMs) => {
    const sortie: RectSousTitre[] = [];
    const el = sceneAuTemps(donnees, tMs / 1000);
    if (el && el.opacite >= 0.05 && el.mots.length > 0) {
      const base = largeurElement(el) * el.echelle;
      if (base > 0) {
        // Loupe des mots (style « pastille ») : le mot dit grossit et monte ; par excès, toute la ligne grossit.
        const loupe = Math.max(1, ...el.mots.map((m) => m.echelle ?? 1));
        const montee = Math.max(0, ...el.mots.map((m) => Math.abs(m.monteePx ?? 0)));
        // Boîte arrondie (minimal) : sa marge en em de la taille, de chaque côté.
        const margeBoite = donnees.boite ? donnees.boite.margeEm * el.taillePx : 0;
        const largeur = base * loupe + 2 * margeBoite;
        const margeY = (el.fond ? 2 * el.fond.margeYPx : 0) + (el.pastille ? 2 * el.pastille.margeYPx : 0) + 2 * margeBoite;
        const rot = Math.abs(Math.sin((el.rotationDeg * Math.PI) / 180)) * largeur;
        const hauteur = 1.1 * el.taillePx * el.echelle * loupe + margeY + 2 * montee + rot;
        const cx = el.colonne ? el.colonne.gauchePx + el.colonne.largeurPx / 2 : donnees.largeur / 2;
        const cy = el.yPx + el.decalageYPx;
        sortie.push({ x: cx - largeur / 2, y: cy - hauteur / 2, largeur, hauteur, taillePx: el.taillePx * el.echelle });
      }
    }
    // Escalier : la zone sûre entière est occupée par les lignes (par excès : un seul grand rectangle).
    if (donnees.escalier && escalierAuTemps(donnees, tMs / 1000)) {
      const z = donnees.escalier.zone;
      sortie.push({ x: z.xPx, y: z.yPx, largeur: z.largeurPx, hauteur: z.hauteurPx, taillePx: donnees.escalier.taillePx });
    }
    return sortie;
  };
}

/** Couleurs des sous-titres à contrôler (hex) : celles du calque ; l'accent manquant vient de l'habillage du plan s'il existe. */
export function couleursSousTitresDe(donnees: DonneesCalque, plan?: PlanValide): { texte?: string; accent?: string; contour?: string } {
  const c = donnees.couleurs as Partial<DonneesCalque["couleurs"]> | undefined;
  const habillage = plan?.habillage?.accent === "orange" ? "#D97757" : plan?.habillage?.accent === "terracotta" ? "#B23F16" : undefined;
  return { ...(c?.texte ? { texte: c.texte } : {}), ...((c?.accent ?? habillage) ? { accent: c?.accent ?? habillage } : {}), ...(c?.contour ? { contour: c.contour } : {}) };
}

/** Fond de la vidéo pour la règle de l'orange. */
export const fondDuPlan = (plan: PlanValide): "ivoire" | "noir" => (plan.habillage.fond === "noir" ? "noir" : "ivoire");
