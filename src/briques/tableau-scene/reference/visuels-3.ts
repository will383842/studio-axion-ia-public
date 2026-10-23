/**
 * BANQUE FERMÉE DES 16 VISUELS DESSINÉS DU STYLE « reference/3 » (maquette validée par Will le 15/10/2026 : « parfait »,
 * PR #260, `maquettes/tableau-visuels-peps/gabarit.html`). PUR, sans React ni alias « @/ » : lu tel quel par
 * `studio-rendu`, par la mise en page et par l'animation.
 *
 * Chaque visuel est dessiné au crayon sur une grille de 400 × 400, dans l'ordre où une main le ferait :
 *  1. les TRAITS bruns (mine `#2B1F16`), un par un ;
 *  2. les HACHURES sable (une texture de remplissage, jamais porteuse de sens : le contour la porte) ;
 *  3. les TEXTES (Montserrat ExtraBold ou Inter SemiBold), dévoilés de gauche à droite ;
 *  4. UNE SEULE touche orange (`#B44F29`), qui s'anime : un entouré, une barre qui monte, une aiguille, une flèche…
 * Les tracés sont ceux de la maquette, recopiés à l'identique (mêmes chemins SVG) ; ce fichier les aplatit en points
 * pour que le crayon suive exactement le trait dessiné.
 */
import { largeurEcrite } from "../../stylo/mesure-ecriture";

/** Côté de la grille des visuels. */
export const GRILLE_VISUEL_3 = 400;
/** Épaisseur du trait brun (grille), des hachures, et pas des hachures. */
export const TRAIT_VISUEL_3 = 6.5;
export const TRAIT_HACHURE_3 = 3.2;
export const PAS_HACHURE_3 = 15;
/** Approche des textes en Montserrat (em), comme la maquette. */
export const APPROCHE_VISUEL_3 = -0.02;

/** Les 16 identifiants de la banque, dans l'ordre de la planche. */
export const IDS_VISUELS_3 = [
  "chiffre-entoure",
  "barres-avant-apres",
  "chrono",
  "calendrier",
  "email-envoye",
  "document-barre",
  "liste-cochee",
  "schema-a-b",
  "entonnoir",
  "balance",
  "cible",
  "telephone-notification",
  "bouclier-coche",
  "graphique-monte",
  "fenetre-discussion",
  "equipe",
] as const;
export type IdVisuel3 = (typeof IDS_VISUELS_3)[number];
export const estIdVisuel3 = (x: string): x is IdVisuel3 => (IDS_VISUELS_3 as readonly string[]).includes(x);

/** Ce qu'un visuel peut écrire (tous facultatifs) ; un champ absent n'écrit rien (aucun texte inventé). */
export interface OptionsVisuel3 {
  chiffre?: string;
  libelle?: string;
  gauche?: string;
  droite?: string;
}
export type ChampVisuel3 = keyof OptionsVisuel3;

/** Fiche de chaque visuel : nom, idée qu'il sert, ce qui bouge, champs qu'il lit (les autres sont refusés). */
export const VISUELS_3: Readonly<Record<IdVisuel3, { numero: number; nom: string; usage: string; anime: string; champs: readonly ChampVisuel3[] }>> = Object.freeze({
  "chiffre-entoure": { numero: 1, nom: "Chiffre géant entouré", usage: "Un chiffre qui frappe : 3 données, 70 %, 10 h par semaine.", anime: "L'entouré orange se trace autour du chiffre.", champs: ["chiffre", "libelle"] },
  "barres-avant-apres": { numero: 2, nom: "Barres avant / après", usage: "Un gain mesuré : temps, ventes, réponses, avant et après.", anime: "La barre « après » monte, son chiffre arrive.", champs: ["chiffre"] },
  chrono: { numero: 3, nom: "Chrono (temps gagné)", usage: "Du temps gagné ou perdu : « 2 h par semaine », délais.", anime: "L'aiguille orange fait le tour, la trace du temps suit.", champs: ["libelle"] },
  calendrier: { numero: 4, nom: "Calendrier", usage: "Une date, un planning, un rendez-vous, « chaque lundi ».", anime: "Le jour choisi est entouré d'orange.", champs: ["chiffre"] },
  "email-envoye": { numero: 5, nom: "E-mail envoyé", usage: "Relance, réponse type, message automatique au client.", anime: "La flèche d'envoi orange part de l'enveloppe.", champs: ["libelle"] },
  "document-barre": { numero: 6, nom: "Document aux lignes barrées", usage: "Données retirées, informations à ne pas coller, nettoyage.", anime: "Trois lignes sont barrées d'un trait orange.", champs: [] },
  "liste-cochee": { numero: 7, nom: "Liste cochée", usage: "Les étapes d'une méthode, une check-list, « à retenir ».", anime: "Les coches orange tombent une à une.", champs: [] },
  "schema-a-b": { numero: 8, nom: "Schéma A → B", usage: "Une transformation : avant → après, nom → lettre, tâche → outil.", anime: "La flèche orange relie A à B.", champs: ["gauche", "droite"] },
  entonnoir: { numero: 9, nom: "Entonnoir", usage: "Trier : prospects, demandes, e-mails ; garder l'essentiel.", anime: "Une goutte orange sort et rebondit en bas.", champs: ["libelle"] },
  balance: { numero: 10, nom: "Balance", usage: "Comparer deux options, deux outils, peser le pour et le contre.", anime: "Un poids orange tombe, le fléau penche.", champs: ["gauche", "droite"] },
  cible: { numero: 11, nom: "Cible", usage: "Un objectif, le bon client, la priorité du dirigeant.", anime: "La flèche orange se plante au centre.", champs: [] },
  "telephone-notification": { numero: 12, nom: "Téléphone + notification", usage: "Un client qui écrit, un appel manqué, une alerte automatique.", anime: "La pastille orange « 1 » rebondit.", champs: ["chiffre"] },
  "bouclier-coche": { numero: 13, nom: "Bouclier coché", usage: "Sécurité, données protégées, RGPD, règle respectée.", anime: "La coche orange se trace dans le bouclier.", champs: [] },
  "graphique-monte": { numero: 14, nom: "Graphique qui monte", usage: "Croissance, chiffre d'affaires, productivité qui progresse.", anime: "La courbe orange monte jusqu'à la flèche.", champs: ["chiffre"] },
  "fenetre-discussion": { numero: 15, nom: "Fenêtre de discussion", usage: "ChatGPT, une consigne, la question d'un client, la réponse.", anime: "Trois points orange « tapent » la réponse.", champs: ["libelle"] },
  equipe: { numero: 16, nom: "Équipe (3 personnes)", usage: "L'équipe à former, les salariés, le dirigeant et ses gens.", anime: "Un cercle orange désigne le référent.", champs: ["libelle"] },
});

/** Ce que la planche de la maquette écrit dans chaque visuel (exemples ; le découpage écrit ses propres mots). */
export const EXEMPLES_VISUELS_3: Readonly<Record<IdVisuel3, OptionsVisuel3>> = Object.freeze({
  "chiffre-entoure": { chiffre: "3", libelle: "données de trop" },
  "barres-avant-apres": { chiffre: "×2" },
  chrono: { libelle: "−2 h" },
  calendrier: { chiffre: "15" },
  "email-envoye": { libelle: "Relance envoyée" },
  "document-barre": {},
  "liste-cochee": {},
  "schema-a-b": { gauche: "A", droite: "B" },
  entonnoir: { libelle: "5 rendez-vous" },
  balance: {},
  cible: {},
  "telephone-notification": { chiffre: "1" },
  "bouclier-coche": {},
  "graphique-monte": { chiffre: "+30 %" },
  "fenetre-discussion": { libelle: "Assistant IA" },
  equipe: { libelle: "Votre équipe" },
});

/** Longueur maximale (caractères) de ce qu'un visuel écrit, par champ (le dessin garde sa place). */
export const BORNES_VISUEL_3 = Object.freeze({ chiffre: 6, libelle: 22, gauche: 12, droite: 12 });

/* ------------------------------------------------------------------ */
/* Dessins (grille 400 × 400)                                            */
/* ------------------------------------------------------------------ */

export interface PointV {
  x: number;
  y: number;
}
export type PoliceVisuel3 = "titre" | "detail";
export interface TexteVisuel3 {
  t: string;
  x: number;
  /** Ligne de base. */
  y: number;
  taille: number;
  police: PoliceVisuel3;
  couleur: "encre" | "mention";
  ancre: "start" | "middle" | "end";
}
export interface HachureVisuel3 {
  x: number;
  y: number;
  l: number;
  h: number;
  /** Forme qui découpe les hachures (chemin SVG), et sa règle de remplissage. */
  clip?: string;
  regle?: "evenodd";
}
/** La touche orange du visuel (une seule). */
export type OrangeVisuel3 =
  | { sorte: "trace"; traces: string[]; epaisseur: number }
  | { sorte: "barre"; x: number; l: number; bas: number; haut: number; etiquette?: { t: string; x: number; y: number } }
  | { sorte: "aiguille"; cx: number; cy: number; r: number; tours: number }
  | { sorte: "goutte"; x: number; y0: number; y1: number; r: number }
  | { sorte: "poids"; x: number; y: number; l: number; h: number }
  | { sorte: "fleche"; x: number; y: number; dx: number; dy: number }
  | { sorte: "badge"; x: number; y: number; r: number; t: string }
  | { sorte: "points"; x: number; y: number; ecart: number; r: number };

export interface DessinVisuel3 {
  id: IdVisuel3;
  /** Traits bruns, dans l'ordre du crayon. */
  traits: string[];
  /** Balance : le fléau et ses plateaux (ils penchent avec le poids), tracés après le pied. */
  fleau?: string[];
  hachures: HachureVisuel3[];
  textes: TexteVisuel3[];
  orange: OrangeVisuel3;
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** Lissage Catmull-Rom → Bézier : un trait de crayon souple (maquette). */
function lisse(pts: [number, number][]): string {
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${f1(P[1][0])} ${f1(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}

/** Boucle « entourée à la main » autour d'un centre : elle se referme en dépassant un peu (maquette). */
export function boucleVisuel3(cx: number, cy: number, rx: number, ry: number, tours = 1.12, depart = -2.2): string {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const a = depart + (i / 14) * tours * 2 * Math.PI;
    const r = 1 + 0.05 * Math.sin(i * 1.7);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return lisse(pts);
}

const rect = (x: number, y: number, l: number, h: number, r = 0) =>
  r ? `M${x + r} ${y} H${x + l - r} Q${x + l} ${y} ${x + l} ${y + r} V${y + h - r} Q${x + l} ${y + h} ${x + l - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z` : `M${x} ${y} H${x + l} V${y + h} H${x} Z`;
/** Cercle (deux demi-arcs de Bézier par quart : écrit en « C », que l'aplatissement suit exactement). */
const cercle = (cx: number, cy: number, r: number) => {
  const c = r * 0.5523;
  return `M${cx} ${cy - r} C${f1(cx + c)} ${cy - r} ${cx + r} ${f1(cy - c)} ${cx + r} ${cy} C${cx + r} ${f1(cy + c)} ${f1(cx + c)} ${cy + r} ${cx} ${cy + r} C${f1(cx - c)} ${cy + r} ${cx - r} ${f1(cy + c)} ${cx - r} ${cy} C${cx - r} ${f1(cy - c)} ${f1(cx - c)} ${cy - r} ${cx} ${cy - r} Z`;
};

/** Le dessin d'un visuel, avec ce qu'il écrit (`o`). Un champ absent n'écrit rien. */
export function dessinVisuel3(id: IdVisuel3, o: OptionsVisuel3 = {}): DessinVisuel3 {
  const D = (x: Omit<DessinVisuel3, "id" | "hachures" | "textes"> & Partial<Pick<DessinVisuel3, "hachures" | "textes">>): DessinVisuel3 => ({ id, hachures: [], textes: [], ...x });
  const lib = (t: string | undefined, x: number, y: number, extra: Partial<TexteVisuel3> = {}): TexteVisuel3[] => (t ? [{ t, x, y, taille: 30, police: "detail", couleur: "mention", ancre: "middle", ...extra }] : []);
  switch (id) {
    case "chiffre-entoure":
      return D({
        traits: ["M300 92 L324 58", "M318 122 L356 106", "M96 90 L74 60"],
        textes: [...(o.chiffre ? [{ t: o.chiffre, x: 200, y: 282, taille: o.chiffre.length > 2 ? Math.round(250 * Math.min(1, 2.6 / o.chiffre.length)) : 250, police: "titre" as const, couleur: "encre" as const, ancre: "middle" as const }] : []), ...lib(o.libelle, 200, 372, { taille: 32 })],
        orange: { sorte: "trace", traces: [boucleVisuel3(200, 196, 112, 120, 1.1, -2.3)], epaisseur: 9 },
      });
    case "barres-avant-apres":
      return D({
        traits: ["M44 330 H362", "M95 330 V196 H175 V330"],
        hachures: [{ x: 95, y: 196, l: 80, h: 134 }],
        textes: [...lib("Avant", 135, 374), ...lib("Après", 265, 374)],
        orange: { sorte: "barre", x: 225, l: 80, bas: 330, haut: 86, ...(o.chiffre ? { etiquette: { t: o.chiffre, x: 265, y: 66 } } : {}) },
      });
    case "chrono":
      return D({
        traits: [cercle(200, 200, 118), "M184 64 V46 H216 V64", "M172 44 H228", "M284 104 L306 82", "M200 92 V108", "M308 200 H292", "M200 308 V292", "M92 200 H108", cercle(200, 200, 7)],
        textes: o.libelle ? [{ t: o.libelle, x: 200, y: 386, taille: 54, police: "titre", couleur: "encre", ancre: "middle" }] : [],
        orange: { sorte: "aiguille", cx: 200, cy: 200, r: 86, tours: 0.83 },
      });
    case "calendrier": {
      const jours: string[] = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (!(r === 1 && c === 2 && o.chiffre)) jours.push(`M${94 + c * 50} ${200 + r * 50} h22`);
      return D({
        traits: [rect(60, 96, 280, 246, 16), "M60 152 H340", "M126 74 V118", "M274 74 V118", ...jours],
        hachures: [{ x: 60, y: 96, l: 280, h: 56 }],
        textes: o.chiffre ? [{ t: o.chiffre, x: 205, y: 262, taille: 36, police: "titre", couleur: "encre", ancre: "middle" }] : [],
        orange: { sorte: "trace", traces: [boucleVisuel3(205, 249, 38, 32, 1.1, -2.6)], epaisseur: 8 },
      });
    }
    case "email-envoye":
      return D({
        traits: [rect(46, 128, 246, 178, 12), "M50 134 L169 226 L288 134", "M52 300 L138 228", "M286 300 L200 228"],
        hachures: [{ x: 46, y: 128, l: 246, h: 178, clip: "M50 134 L169 226 L288 134 Z" }],
        textes: lib(o.libelle, 169, 362),
        orange: { sorte: "trace", traces: ["M300 220 C330 206 346 178 352 136", "M330 150 L352 132 L366 158"], epaisseur: 8 },
      });
    case "document-barre":
      return D({
        traits: ["M64 30 H270 L336 96 V372 H64 Z", "M270 30 V96 H336", "M100 78 H210", "M100 144 H300", "M100 190 H276", "M100 236 H304", "M100 282 H260", "M100 328 H292"],
        hachures: [{ x: 270, y: 30, l: 66, h: 66, clip: "M270 30 V96 H336 Z" }],
        orange: { sorte: "trace", traces: ["M86 148 C150 136 230 152 316 138", "M86 240 C160 230 240 244 318 228", "M86 332 C150 320 236 336 310 322"], epaisseur: 9 },
      });
    case "liste-cochee":
      return D({
        traits: [rect(58, 82, 52, 52, 8), "M138 108 H330", rect(58, 176, 52, 52, 8), "M138 202 H300", rect(58, 270, 52, 52, 8), "M138 296 H318"],
        orange: { sorte: "trace", traces: ["M68 106 L84 124 L122 70", "M68 200 L84 218 L122 164", "M68 294 L84 312 L122 258"], epaisseur: 9 },
      });
    case "schema-a-b": {
      const g = o.gauche ?? "A";
      const d = o.droite ?? "B";
      const traits = [rect(20, 24, 170, 170, 22), rect(210, 206, 170, 170, 22)];
      const textes: TexteVisuel3[] = [];
      const taille = (t: string) => (t.length <= 2 ? 110 : Math.max(40, Math.round(110 * Math.min(1, 2.2 / t.length))));
      if (g === "personne") traits.push(cercle(105, 88, 30), "M55 172 C62 112 148 112 155 172");
      // Lignes de base de la maquette (146 et 330 pour 110 px), remontées quand le mot est écrit plus petit.
      else textes.push({ t: g, x: 105, y: 146 - (110 - taille(g)) * 0.34, taille: taille(g), police: "titre", couleur: "encre", ancre: "middle" });
      textes.push({ t: d, x: 295, y: 330 - (110 - taille(d)) * 0.34, taille: taille(d), police: "titre", couleur: "encre", ancre: "middle" });
      return D({ traits, textes, hachures: [{ x: 210, y: 206, l: 170, h: 170, clip: rect(210, 206, 170, 170, 22) }], orange: { sorte: "trace", traces: ["M208 92 C290 92 312 130 304 186", "M286 166 L304 192 L322 164"], epaisseur: 10 } });
    }
    case "entonnoir":
      return D({
        traits: ["M58 92 C58 64 342 64 342 92 C342 120 58 120 58 92 Z", "M60 96 L172 232 V306", "M340 96 L228 232 V292", "M172 306 Q200 318 228 292", cercle(120, 40, 9), cercle(176, 30, 9), cercle(232, 44, 9), cercle(286, 34, 9)],
        hachures: [{ x: 60, y: 96, l: 280, h: 210, clip: "M60 96 L172 232 V306 Q200 318 228 292 V232 L340 96 C300 116 100 116 60 96 Z" }],
        textes: o.libelle ? [{ t: o.libelle, x: 200, y: 386, taille: 30, police: "detail", couleur: "encre", ancre: "middle" }] : [],
        orange: { sorte: "goutte", x: 200, y0: 262, y1: 340, r: 15 },
      });
    case "balance":
      return D({
        traits: ["M200 96 V330", "M140 340 H260", "M172 340 L200 310 L228 340", cercle(200, 92, 9)],
        fleau: ["M62 100 H338", "M92 100 L62 196", "M92 100 L122 196", "M52 196 Q92 232 132 196 Z", "M308 100 L278 196", "M308 100 L338 196", "M268 196 Q308 232 348 196 Z"],
        textes: [...lib(o.gauche, 92, 386), ...lib(o.droite, 308, 386)],
        orange: { sorte: "poids", x: 66, y: 150, l: 52, h: 42 },
      });
    case "cible":
      return D({
        traits: [cercle(180, 222, 136), cercle(180, 222, 90), cercle(180, 222, 44)],
        hachures: [{ x: 90, y: 132, l: 180, h: 180, clip: `${cercle(180, 222, 90)} ${cercle(180, 222, 44)}`, regle: "evenodd" }],
        orange: { sorte: "fleche", x: 180, y: 222, dx: 150, dy: -150 },
      });
    case "telephone-notification":
      return D({
        traits: [rect(112, 44, 176, 320, 28), rect(128, 86, 144, 232, 6), "M182 66 H218", "M184 340 H216", rect(144, 120, 112, 64, 10), "M158 142 H236", "M158 164 H214", rect(144, 204, 112, 64, 10), "M158 226 H230"],
        hachures: [{ x: 144, y: 204, l: 112, h: 64 }],
        orange: { sorte: "badge", x: 286, y: 62, r: 32, t: o.chiffre ?? "1" },
      });
    case "bouclier-coche":
      return D({
        traits: ["M200 42 C258 68 315 74 354 70 C359 204 306 300 200 362 C94 300 41 204 46 70 C85 74 142 68 200 42 Z", "M200 74 C246 92 290 98 320 98 C317 198 276 276 200 326"],
        hachures: [{ x: 40, y: 40, l: 160, h: 330, clip: "M200 42 C142 68 85 74 46 70 C41 204 94 300 200 362 Z" }],
        orange: { sorte: "trace", traces: ["M128 204 L184 258 L284 136"], epaisseur: 15 },
      });
    case "graphique-monte":
      return D({
        traits: ["M60 46 V340 H362", "M54 270 H66", "M54 200 H66", "M54 130 H66"],
        textes: o.chiffre ? [{ t: o.chiffre, x: 84, y: 112, taille: 46, police: "titre", couleur: "encre", ancre: "start" }] : [],
        orange: { sorte: "trace", traces: ["M76 302 L140 256 L188 276 L252 176 L332 98", "M302 96 L334 96 L330 128"], epaisseur: 10 },
      });
    case "fenetre-discussion":
      return D({
        traits: [rect(36, 56, 328, 288, 22), "M36 106 H364", cercle(66, 82, 7), cercle(90, 82, 7), cercle(114, 82, 7), rect(62, 130, 196, 66, 18), "M84 154 H232", "M84 176 H196", rect(140, 222, 196, 80, 18)],
        hachures: [{ x: 62, y: 130, l: 196, h: 66, clip: rect(62, 130, 196, 66, 18) }],
        textes: o.libelle ? [{ t: o.libelle, x: 346, y: 92, taille: 26, police: "detail", couleur: "mention", ancre: "end" }] : [],
        orange: { sorte: "points", x: 238, y: 262, ecart: 30, r: 10 },
      });
    case "equipe":
      return D({
        traits: [cercle(78, 166, 26), "M36 292 C40 226 116 226 120 292", cercle(322, 166, 26), "M280 292 C284 226 360 226 364 292", cercle(200, 140, 34), "M144 300 C150 208 250 208 256 300"],
        hachures: [{ x: 144, y: 214, l: 112, h: 86, clip: "M144 300 C150 208 250 208 256 300 Z" }],
        textes: lib(o.libelle, 200, 380),
        orange: { sorte: "trace", traces: [boucleVisuel3(200, 200, 86, 130, 1.1, -2.0)], epaisseur: 8 },
      });
  }
}

/* ------------------------------------------------------------------ */
/* Aplatissement des chemins (le crayon suit le trait exact)             */
/* ------------------------------------------------------------------ */

const NOMBRE = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giy;

/**
 * Aplatit un chemin SVG (commandes M L H V C Q Z, absolues ou relatives) en sous-chemins de points, un point au plus
 * tous les 3 px de grille sur les courbes. Lève sur une commande inconnue (la banque n'en a pas).
 */
export function aplatirChemin3(d: string): PointV[][] {
  const res: PointV[][] = [];
  let courant: PointV[] = [];
  let x = 0;
  let y = 0;
  let depart = { x: 0, y: 0 };
  let i = 0;
  let cmd = "";
  const espaces = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const nombre = (): number => {
    espaces();
    NOMBRE.lastIndex = i;
    const m = NOMBRE.exec(d);
    if (!m) throw new Error(`chemin illisible près de « ${d.slice(i, i + 12)} »`);
    i = NOMBRE.lastIndex;
    return Number(m[0]);
  };
  const vers = (p: PointV) => {
    courant.push(p);
    x = p.x;
    y = p.y;
  };
  const courbe = (pts: PointV[]) => {
    const long = pts.slice(1).reduce((s, p, j) => s + Math.hypot(p.x - pts[j].x, p.y - pts[j].y), 0);
    const n = Math.max(4, Math.ceil(long / 3));
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      const v = 1 - u;
      if (pts.length === 4) vers({ x: v * v * v * pts[0].x + 3 * v * v * u * pts[1].x + 3 * v * u * u * pts[2].x + u * u * u * pts[3].x, y: v * v * v * pts[0].y + 3 * v * v * u * pts[1].y + 3 * v * u * u * pts[2].y + u * u * u * pts[3].y });
      else vers({ x: v * v * pts[0].x + 2 * v * u * pts[1].x + u * u * pts[2].x, y: v * v * pts[0].y + 2 * v * u * pts[1].y + u * u * pts[2].y });
    }
  };
  while (i < d.length) {
    espaces();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) cmd = d[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": {
        if (courant.length > 1) res.push(courant);
        const p = { x: ox + nombre(), y: oy + nombre() };
        courant = [p];
        x = p.x;
        y = p.y;
        depart = p;
        cmd = rel ? "l" : "L";
        break;
      }
      case "L":
        vers({ x: ox + nombre(), y: oy + nombre() });
        break;
      case "H":
        vers({ x: ox + nombre(), y });
        break;
      case "V":
        vers({ x, y: oy + nombre() });
        break;
      case "C": {
        const p0 = { x, y };
        const a = { x: ox + nombre(), y: oy + nombre() };
        const b = { x: ox + nombre(), y: oy + nombre() };
        const c = { x: ox + nombre(), y: oy + nombre() };
        courbe([p0, a, b, c]);
        break;
      }
      case "Q": {
        const p0 = { x, y };
        const a = { x: ox + nombre(), y: oy + nombre() };
        const c = { x: ox + nombre(), y: oy + nombre() };
        courbe([p0, a, c]);
        break;
      }
      case "Z":
        if (x !== depart.x || y !== depart.y) vers({ ...depart });
        break;
      default:
        throw new Error(`commande de chemin « ${cmd} » inconnue`);
    }
  }
  if (courant.length > 1) res.push(courant);
  return res;
}

const longueur = (pts: readonly PointV[]) => pts.slice(1).reduce((s, p, j) => s + Math.hypot(p.x - pts[j].x, p.y - pts[j].y), 0);

/** Segments d'une hachure (lignes à 45°, tous les 15 px de grille), coupés au rectangle. */
export function segmentsHachure3(h: HachureVisuel3): PointV[][] {
  const res: PointV[][] = [];
  for (let s = -h.h; s < h.l; s += PAS_HACHURE_3) {
    // Ligne de (x + s, y + h) à (x + s + h, y) : on garde la partie où x reste dans [x, x + l].
    const u0 = Math.max(0, -s / h.h);
    const u1 = Math.min(1, (h.l - s) / h.h);
    if (u1 - u0 <= 1e-6) continue;
    const p = (u: number) => ({ x: h.x + s + u * h.h, y: h.y + h.h - u * h.h });
    res.push([p(u0), p(u1)]);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Textes : boîtes mesurées                                              */
/* ------------------------------------------------------------------ */

/** Largeur (grille) d'un texte du visuel : Montserrat ExtraBold mesuré ; Inter SemiBold mesuré en Inter Bold (un peu plus large : la boîte couvre toujours le texte). */
export function largeurTexteVisuel3(x: Pick<TexteVisuel3, "t" | "taille" | "police">): number {
  return x.police === "titre" ? largeurEcrite(x.t, "titre", x.taille, APPROCHE_VISUEL_3) : largeurEcrite(x.t, "texte", x.taille, 0);
}

/** Boîte (grille) de l'encre d'un texte du visuel. */
export function boiteTexteVisuel3(x: TexteVisuel3): { x: number; y: number; l: number; h: number } {
  const l = largeurTexteVisuel3(x);
  const x0 = x.ancre === "middle" ? x.x - l / 2 : x.ancre === "end" ? x.x - l : x.x;
  return { x: x0, y: x.y - x.taille * 0.76, l, h: x.taille * 0.98 };
}

/* ------------------------------------------------------------------ */
/* Étapes du crayon et encombrement                                      */
/* ------------------------------------------------------------------ */

/** Une étape du dessin, dans l'ordre du crayon ; `points` : ce que suit la pointe (grille), sous-chemins à la suite. */
export interface EtapeVisuel3 {
  sorte: "trait" | "fleau" | "hachure" | "texte" | "orange";
  /** Rang dans sa liste (traits, fléau, hachures, textes, traces orange). */
  i: number;
  /** Sous-chemins (grille) ; la pointe les suit à la suite (elle saute de l'un à l'autre). */
  chemins: PointV[][];
  longueur: number;
  /** La pointe dessine (faux : une touche orange qui s'anime seule, le crayon s'écarte). */
  crayon: boolean;
}

/** Points que suit la pointe pendant qu'un texte se dévoile (une écriture, légère ondulation). */
function pointeTexte(b: { x: number; y: number; l: number; h: number }): PointV[] {
  const pts: PointV[] = [];
  for (let k = 0; k <= 24; k++) {
    const u = k / 24;
    pts.push({ x: b.x + b.l * u, y: b.y + b.h * 0.62 + Math.sin(u * 40) * b.h * 0.12 });
  }
  return pts;
}

/** Les étapes d'un dessin, dans l'ordre où une main le trace : traits, fléau, hachures, textes, puis la touche orange. */
export function etapesVisuel3(v: DessinVisuel3): EtapeVisuel3[] {
  const res: EtapeVisuel3[] = [];
  const ajoute = (sorte: EtapeVisuel3["sorte"], i: number, chemins: PointV[][], crayon = true) => res.push({ sorte, i, chemins, longueur: chemins.reduce((s, c) => s + longueur(c), 0), crayon });
  v.traits.forEach((d, i) => ajoute("trait", i, aplatirChemin3(d)));
  (v.fleau ?? []).forEach((d, i) => ajoute("fleau", i, aplatirChemin3(d)));
  v.hachures.forEach((h, i) => ajoute("hachure", i, segmentsHachure3(h)));
  v.textes.forEach((x, i) => ajoute("texte", i, [pointeTexte(boiteTexteVisuel3(x))]));
  const O = v.orange;
  if (O.sorte === "trace") O.traces.forEach((d, i) => ajoute("orange", i, aplatirChemin3(d)));
  else ajoute("orange", 0, [], false);
  return res;
}

/**
 * Répartition du temps d'un visuel (maquette, `planVisuel`) sur `D` secondes : la touche orange prend 32 % (0,75 s au
 * plus), les textes 14 % (0,32 s), les hachures 12 % (0,3 s), les traits le reste, au prorata de leur longueur.
 * Rend, pour chaque étape, son début et sa fin (s, depuis le début du visuel).
 */
export function tempsVisuel3(etapes: readonly EtapeVisuel3[], D: number): { t0: number; t1: number }[] {
  const n = (s: EtapeVisuel3["sorte"]) => etapes.filter((e) => e.sorte === s).length;
  const dOrange = Math.min(0.75, D * 0.32);
  const dTextes = n("texte") ? Math.min(0.32, D * 0.14) : 0;
  const dHach = n("hachure") ? Math.min(0.3, D * 0.12) : 0;
  const dTraits = D - dOrange - dTextes - dHach;
  const traits = etapes.filter((e) => e.sorte === "trait" || e.sorte === "fleau");
  const Ltot = traits.reduce((s, e) => s + e.longueur + 40, 0) || 1;
  const nOrange = n("orange");
  let t = 0;
  let orange = 0;
  return etapes.map((e) => {
    const t0 = t;
    if (e.sorte === "trait" || e.sorte === "fleau") t += (dTraits * (e.longueur + 40)) / Ltot;
    else if (e.sorte === "hachure") t += dHach / n("hachure");
    else if (e.sorte === "texte") t += dTextes / n("texte");
    else {
      // Les traces orange se suivent sur la même durée (les coches tombent une à une).
      const d = dOrange / nOrange;
      const r = { t0: D - dOrange + orange * d, t1: D - dOrange + (orange + 1) * d };
      orange++;
      return r;
    }
    return { t0, t1: e.sorte === "trait" || e.sorte === "fleau" ? t - 0.02 : t };
  });
}

/**
 * Part visible (0 à 1) de chaque sous-chemin quand la pointe a parcouru `u` (0 à 1) de leur suite, sauts compris :
 * exactement ce que suit le crayon (`pointA` sur les points mis bout à bout).
 */
export function portionsChemins3(chemins: readonly (readonly PointV[])[], u: number): number[] {
  const tous = chemins.flat();
  const total = longueur(tous) || 1;
  let parcouru = Math.max(0, Math.min(1, u)) * total;
  return chemins.map((c, i) => {
    if (i > 0) {
      const prec = chemins[i - 1];
      parcouru -= Math.hypot(c[0].x - prec[prec.length - 1].x, c[0].y - prec[prec.length - 1].y);
    }
    const l = longueur(c);
    const v = l > 0 ? Math.max(0, Math.min(1, parcouru / l)) : parcouru >= 0 ? 1 : 0;
    parcouru -= l;
    return v;
  });
}

/** Chemin SVG d'une suite de points (polyligne). */
export const cheminPoints3 = (pts: readonly PointV[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

/** Rectangle (grille). */
export interface BoiteV {
  x: number;
  y: number;
  l: number;
  h: number;
}
const boiteDe = (pts: readonly PointV[], marge: number): BoiteV => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs) - marge;
  const y = Math.min(...ys) - marge;
  return { x, y, l: Math.max(...xs) + marge - x, h: Math.max(...ys) + marge - y };
};
const unir = (bs: readonly BoiteV[]): BoiteV => {
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, l: Math.max(...bs.map((b) => b.x + b.l)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
};
const tourner = (p: PointV, c: PointV, deg: number): PointV => {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
};

/** Fléau de la balance : il penche de… (degrés, sens inverse des aiguilles) autour de son pivot, un peu plus en rebond. */
export const FLEAU_3 = Object.freeze({ angle: -11, rebond: 2.2, pivot: { x: 200, y: 100 } });
/** Flèche de la cible : elle arrive de… (part de sa longueur) avant de se planter. */
export const VOL_FLECHE_3 = 0.3;
/** Le grain de la mine déplace le trait d'au plus… (grille). */
const GRAIN_3 = 2.5;

/**
 * Encombrement (grille) du visuel FINI ET PENDANT SES MOUVEMENTS (le poids qui tombe, le fléau qui penche, la flèche qui
 * arrive, la pastille qui rebondit, les points qui tapent) : tout ce qui est dessiné, à toute heure, est dedans. Les
 * hachures restent dans leurs contours. La mise en page garde le texte à 12 px au moins de cette boîte.
 */
export function encreVisuel3(v: DessinVisuel3): BoiteV {
  const bs: BoiteV[] = [];
  for (const d of v.traits) for (const c of aplatirChemin3(d)) bs.push(boiteDe(c, TRAIT_VISUEL_3 / 2 + GRAIN_3));
  const fleau = (v.fleau ?? []).flatMap((d) => aplatirChemin3(d)).flat();
  const O = v.orange;
  if (fleau.length) {
    const enPente = [0, FLEAU_3.angle - FLEAU_3.rebond, FLEAU_3.angle + FLEAU_3.rebond].flatMap((a) => fleau.map((p) => tourner(p, FLEAU_3.pivot, a)));
    bs.push(boiteDe(enPente, TRAIT_VISUEL_3 / 2 + GRAIN_3));
  }
  for (const x of v.textes) {
    const b = boiteTexteVisuel3(x);
    bs.push(b);
  }
  switch (O.sorte) {
    case "trace":
      for (const d of O.traces) for (const c of aplatirChemin3(d)) bs.push(boiteDe(c, O.epaisseur / 2));
      break;
    case "barre": {
      bs.push({ x: O.x, y: O.haut, l: O.l, h: O.bas - O.haut });
      if (O.etiquette) bs.push(boiteTexteVisuel3({ t: O.etiquette.t, x: O.etiquette.x, y: O.etiquette.y, taille: 44, police: "titre", couleur: "encre", ancre: "middle" }));
      break;
    }
    case "aiguille":
      bs.push({ x: O.cx - O.r - 5, y: O.cy - O.r - 5, l: 2 * O.r + 10, h: 2 * O.r + 10 });
      break;
    case "goutte":
      bs.push({ x: O.x - O.r, y: O.y0 - O.r, l: 2 * O.r, h: O.y1 - O.y0 + 2 * O.r });
      break;
    case "poids": {
      const coins = [0, FLEAU_3.angle - FLEAU_3.rebond, FLEAU_3.angle + FLEAU_3.rebond].flatMap((a) =>
        [
          { x: O.x, y: O.y - 150 },
          { x: O.x + O.l, y: O.y - 150 },
          { x: O.x, y: O.y + O.h },
          { x: O.x + O.l, y: O.y + O.h },
        ].map((p) => tourner(p, FLEAU_3.pivot, a)),
      );
      bs.push(boiteDe(coins, 0));
      break;
    }
    case "fleche": {
      for (const k of [0, VOL_FLECHE_3]) {
        const dx = O.dx * k;
        const dy = O.dy * k;
        bs.push(boiteDe([{ x: O.x + dx, y: O.y + dy }, { x: O.x + O.dx + dx, y: O.y + O.dy + dy }], 30));
      }
      bs.push({ x: O.x - 58, y: O.y - 20, l: 116, h: 70 });
      break;
    }
    case "badge":
      bs.push({ x: O.x - O.r * 1.2, y: O.y - O.r * 1.2, l: O.r * 2.4, h: O.r * 2.4 });
      break;
    case "points":
      bs.push({ x: O.x - O.ecart - O.r, y: O.y - 14 - O.r, l: 2 * (O.ecart + O.r), h: 14 + 2 * O.r });
      break;
  }
  return unir(bs);
}

/* ------------------------------------------------------------------ */
/* Mouvements de la touche orange (lus par le rendu)                     */
/* ------------------------------------------------------------------ */

const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Courbe douce (entrée et sortie). */
export const douceVisuel3 = (x: number) => {
  const u = borne(x);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
export const sortieVisuel3 = (x: number) => 1 - Math.pow(1 - borne(x), 3);
/** Rebond de la maquette (dépassement franc, puis 1). */
export const rebondVisuel3 = (x: number) => {
  const u = borne(x);
  const c1 = 1.7;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};
/** Cloche (0 → 1 → 0) sur [0, 1]. */
export const clocheVisuel3 = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));

/**
 * État de la touche orange à l'avancement `u` (0 à 1) et `dt` secondes après sa fin (ce qui continue de vivre : la
 * pastille rebondit de temps en temps, les points tapent) ; `vie` (0 à 1) : l'ampleur de ces mouvements continus (0 :
 * la page finie, au repos). Repère : la grille.
 */
export function etatOrange3(O: OrangeVisuel3, u: number, dt: number, vie = 1) {
  switch (O.sorte) {
    case "barre": {
      const h = (O.bas - O.haut) * sortieVisuel3(u / 0.8);
      return { sorte: O.sorte, y: O.bas - h, hauteur: h, etiquette: borne((u - 0.7) / 0.3) };
    }
    case "aiguille":
      return { sorte: O.sorte, angle: 360 * O.tours * douceVisuel3(u), visible: u > 0 };
    case "goutte": {
      const ch = borne(u / 0.55);
      const rb = borne((u - 0.55) / 0.45);
      return { sorte: O.sorte, y: u < 0.55 ? O.y0 + (O.y1 - O.y0) * ch * ch : O.y1 - Math.abs(Math.sin(rb * Math.PI * 2)) * 26 * (1 - rb), visible: u > 0 };
    }
    case "poids": {
      const ch = borne(u / 0.45);
      const angle = FLEAU_3.angle * sortieVisuel3(borne((u - 0.42) / 0.58)) + (u > 0.42 ? FLEAU_3.rebond * Math.sin((u - 0.42) * 22) * (1 - u) : 0);
      return { sorte: O.sorte, y: O.y - 150 * (1 - ch * ch), angle, visible: u > 0 };
    }
    case "fleche": {
      const w = sortieVisuel3(borne(u / 0.6));
      const vib = u > 0.6 ? Math.sin((u - 0.6) * 60) * 5 * (1 - u) : 0;
      return { sorte: O.sorte, dx: O.dx * VOL_FLECHE_3 * (1 - w), dy: O.dy * VOL_FLECHE_3 * (1 - w) + vib, impact: u > 0.6, visible: u > 0, opacite: borne(u / 0.15) };
    }
    case "badge": {
      const s = u <= 0 ? 0.3 : 0.3 + 0.7 * rebondVisuel3(borne(u / 0.7));
      const re = dt > 0 ? 1 + 0.08 * vie * clocheVisuel3(((dt % 2.2) - 0.6) / 0.4) : 1;
      return { sorte: O.sorte, echelle: s * re, opacite: u > 0 ? borne(u * 4) : 0 };
    }
    case "points":
      return { sorte: O.sorte, dy: [0, 1, 2].map((i) => -14 * vie * clocheVisuel3((((u * 1.6 + Math.max(0, dt) * 1.6 - i * 0.18) % 0.9) + 0.9) % 0.9 / 0.5)), visible: u > 0 };
    case "trace":
      return { sorte: O.sorte };
  }
}

/** Le visuel respire une fois dessiné : ±5 px (référence 1080) en 3,4 s, et une échelle de ±0,8 %. */
export const SOUFFLE_3 = Object.freeze({ amplitudePx: 5, periodeSec: 3.4, echelle: 0.008, monteeSec: 0.8 });
export function souffle3(dt: number, vie = 1): { dy: number; echelle: number } {
  if (dt <= 0) return { dy: 0, echelle: 1 };
  const k = borne(dt / SOUFFLE_3.monteeSec) * vie;
  const a = (dt * 2 * Math.PI) / SOUFFLE_3.periodeSec;
  return { dy: -SOUFFLE_3.amplitudePx * Math.sin(a) * k, echelle: 1 + SOUFFLE_3.echelle * Math.sin(a + 1) * k };
}
