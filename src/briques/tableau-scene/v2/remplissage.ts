/**
 * CONTRÔLE DE REMPLISSAGE D'UN ÉCRAN DU STYLE « blocs/2 » (relecture du 12/10/2026, première vidéo fabriquée : un
 * grand cadre blanc occupait la moitié de l'écran avec trois traits gris). PUR, sans alias « @/ ».
 *
 * Zone utile : le contenu de l'écran (sous l'en-tête, ou sous la barre des étapes ; au-dessus des sous-titres). Ce qui
 * la remplit : les textes, les formes qui portent quelque chose (blocs, numéros, cases, pastilles, pictogrammes) et les
 * traits, chacun entouré d'une marge (`MARGE_REMPLISSAGE`) ; les traits gris (texte figuré, sans mots) ne comptent que
 * pour leur propre trait, sans marge. Un CADRE (carte, grande case, grande bulle) ne
 * remplit pas par lui-même : seul ce qu'il contient compte. Au plus un tiers de la zone utile reste vide hors marges.
 */
import type { EcranPlace, FormeV2, GeometrieV2, RectV2 } from "./types";

/** Part vide permise de la zone utile (hors marges). */
export const VIDE_MAX_ECRAN = 1 / 3;
/** Marge autour de ce qui est écrit ou dessiné, qui ne compte pas comme du vide (px de référence). */
export const MARGE_REMPLISSAGE = 48;
/**
 * Une carte, case, bulle ou pastille qui couvre plus que cette part de la zone utile en largeur ET en hauteur est un
 * cadre : seul ce qu'elle contient compte (une rangée de liste, une case de jour, un numéro remplissent ; une grande
 * carte blanche, non).
 */
const PART_CADRE = 0.25;
/** Pas de la grille de mesure (px de l'image). */
const PAS = 6;

/** Zone utile de l'écran : le contenu, sous la barre des étapes si l'écran la montre. */
export function zoneUtileV2(e: Pick<EcranPlace, "formes">, g: GeometrieV2): RectV2 {
  return e.formes.some((f) => f.id.startsWith("barre#")) ? g.contenuEtape : g.contenu;
}

/** Grille de la zone utile : 1 là où quelque chose est écrit ou dessiné (marges comprises), 0 ailleurs. */
function grilleEcranV2(e: Pick<EcranPlace, "textes" | "formes" | "traits">, g: GeometrieV2): { plein: Uint8Array; nx: number; ny: number } {
  const z = zoneUtileV2(e, g);
  const marge = MARGE_REMPLISSAGE * g.k;
  // `nu` : sans marge autour (les traits gris ne comptent que pour leur propre place).
  const pleins: (RectV2 & { nu?: boolean })[] = [];
  for (const t of e.textes) if (!t.horsContenu) pleins.push(t);
  for (const f of e.formes) {
    if (f.horsZone || f.sorte === "jauge" || f.sorte === "deco" || f.id.startsWith("barre#") || f.id.startsWith("etq#") || f.id.startsWith("sig#") || f.id.startsWith("fil")) continue;
    const cadre = (f.sorte === "carte" || f.sorte === "case" || f.sorte === "bulle" || f.sorte === "pastille") && f.largeur > PART_CADRE * z.largeur && f.hauteur > PART_CADRE * z.hauteur;
    // Les traits gris (texte figuré, sans mots) ne remplissent que leur trait : une carte de trois traits gris est vide.
    if (!cadre) pleins.push(f.sorte === "barre-sable" ? { ...f, nu: true } : f);
  }
  for (const t of e.traits) {
    const pts = t.segments.flat();
    if (!pts.length) continue;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    pleins.push({ x: Math.min(...xs), y: Math.min(...ys), largeur: Math.max(...xs) - Math.min(...xs), hauteur: Math.max(...ys) - Math.min(...ys) });
  }
  const nx = Math.max(1, Math.ceil(z.largeur / PAS));
  const ny = Math.max(1, Math.ceil(z.hauteur / PAS));
  const plein = new Uint8Array(nx * ny);
  for (const r of pleins) {
    const m = r.nu ? 0 : marge;
    const i0 = Math.max(0, Math.floor((r.x - m - z.x) / PAS));
    const i1 = Math.min(nx - 1, Math.floor((r.x + r.largeur + m - z.x) / PAS));
    const j0 = Math.max(0, Math.floor((r.y - m - z.y) / PAS));
    const j1 = Math.min(ny - 1, Math.floor((r.y + r.hauteur + m - z.y) / PAS));
    for (let j = j0; j <= j1; j++) plein.fill(1, j * nx + i0, j * nx + i1 + 1);
  }
  return { plein, nx, ny };
}

/** Part (0 à 1) de la zone utile laissée vide hors marges, à la fin de l'écran (tout ce qu'il montre est là). */
export function partVideEcranV2(e: Pick<EcranPlace, "textes" | "formes" | "traits">, g: GeometrieV2): number {
  const { plein } = grilleEcranV2(e, g);
  let vides = 0;
  for (let i = 0; i < plein.length; i++) if (!plein[i]) vides++;
  return vides / plein.length;
}

/**
 * Part (0 à 1) de la zone utile prise par le plus grand rectangle VIDE d'un seul tenant (hors marges) : une carte perdue
 * dans un grand vide, une moitié d'écran blanche. Un texte seul, grand et centré (rien d'autre à montrer : le texte de
 * la scène a grandi) laisse des bandes vides modestes, pas un bloc.
 */
export function plusGrandVideV2(e: Pick<EcranPlace, "textes" | "formes" | "traits">, g: GeometrieV2): number {
  const { plein, nx, ny } = grilleEcranV2(e, g);
  const h = new Int32Array(nx);
  let max = 0;
  const pile: number[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) h[i] = plein[j * nx + i] ? 0 : h[i] + 1;
    pile.length = 0;
    for (let i = 0; i <= nx; i++) {
      const hi = i < nx ? h[i] : 0;
      while (pile.length && h[pile[pile.length - 1]] >= hi) {
        const top = pile.pop()!;
        const gauche = pile.length ? pile[pile.length - 1] + 1 : 0;
        max = Math.max(max, h[top] * (i - gauche));
      }
      pile.push(i);
    }
  }
  return max / (nx * ny);
}

/** Plus grand bloc vide permis (part de la zone utile) quand l'écran a plus d'un tiers de vide en tout. */
export const VIDE_BLOC_MAX = 1 / 3;

/**
 * Message en clair si l'écran est presque vide : plus d'un tiers de sa zone utile vide ET un bloc vide d'un seul tenant
 * de plus d'un tiers (relecture des quatre vidéos du 12/10/2026 : un écran qui n'a qu'une ligne la montre en grand et
 * centrée, sans pictogramme ajouté pour combler) ; null s'il est assez rempli.
 */
export function controleRemplissageV2(e: Pick<EcranPlace, "id" | "gabarit" | "textes" | "formes" | "traits">, g: GeometrieV2): string | null {
  // La fin sans appel de TikTok et Shorts n'écrit que le site en grand (et la phrase de sa fin) : rien d'autre à
  // montrer, et jamais un pictogramme ajouté pour combler. Ses cadres et ses ronds restent contrôlés.
  if (e.gabarit === "appel-site") return null;
  const v = partVideEcranV2(e, g);
  if (v <= VIDE_MAX_ECRAN + 1e-9) return null;
  const bloc = plusGrandVideV2(e, g);
  return bloc > VIDE_BLOC_MAX + 1e-9 ? `l'écran « ${e.id} » (gabarit « ${e.gabarit} ») laisse ${Math.round(v * 100)} % de sa zone utile vide, dont un seul bloc de ${Math.round(bloc * 100)} % (un tiers de vide au plus, ou aucun bloc vide de plus d'un tiers).` : null;
}

/** Mots pleins (trois lettres au moins) d'un texte, sans casse ni accents. */
const motsPleins = (t: string) =>
  t
    .replace(/'/g, "’")
    .split(/[^\p{L}\p{N}]+/u)
    .map((m) => m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""))
    .filter((m) => m.length >= 3);

/** Étiquettes et repères du corps (« AVANT », « APRÈS », mention, numéro) : jamais comptés comme une ligne écrite. */
const estReperage = (id: string) => /#(av|ap)(e|ef|g|gf)$/.test(id) || /#mentiont$/.test(id) || /#numt$/.test(id) || /#rnt\d+$/.test(id);

/**
 * Lignes écrites deux fois dans un écran (relecture du 12/10/2026, puis des quatre vidéos du même jour) : une ligne de
 * la fiche posée en TITRE et le même texte écrit dans le corps par une autre source (élément de liste, tampon, case,
 * panneau), sans casse, accents ni ponctuation ; ou un texte dont chaque mot plein est déjà écrit de l'autre côté
 * (« Livrable, lecteur » au-dessus de « 1 LIVRABLE » et « 2 LECTEUR » ; « UN MOIS APRÈS » dans une case sous « Un mois
 * après : plus personne ne l'ouvre »). Le mot tapé dans la bulle de l'appel (il reprend le mot du titre, c'est le
 * geste demandé) n'en est pas un, ni les étiquettes « AVANT » / « APRÈS ».
 */
export function textesEnDoubleV2(e: Pick<EcranPlace, "textes" | "frappe">): string[] {
  const cle = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const estTitre = (id: string) => /^[^#]+#\d+\.\d+$/.test(id);
  // Le texte entier de chaque titre (ses mots, dans l'ordre de lecture) et de chaque texte du corps (ses rangées).
  const groupes = new Map<string, { titre: boolean; source: string; morceaux: string[] }>();
  for (const t of [...e.textes].filter((x) => !x.horsContenu && x.id !== e.frappe?.texteId && !x.id.endsWith("#frappe") && !estReperage(x.id)).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const titre = estTitre(t.id);
    const k = titre ? `T|${t.source}` : `C|${t.id.replace(/(\.\d+|~\d+)$/, "")}`;
    const g = groupes.get(k) ?? { titre, source: t.source, morceaux: [] };
    g.morceaux.push(t.texte);
    groupes.set(k, g);
  }
  const titres = [...groupes.values()].filter((g) => g.titre);
  const corps = [...groupes.values()].filter((g) => !g.titre);
  // Les morceaux de la ligne d'appel (« ÉCRIVEZ » / mot / « EN COMMENTAIRE ») forment une seule ligne.
  const motsTitres = new Set(titres.flatMap((t) => motsPleins(t.morceaux.join(" "))));
  const motsCorps = new Set(corps.flatMap((t) => motsPleins(t.morceaux.join(" "))));
  const couvert = (texte: string, ailleurs: Set<string>) => {
    const m = motsPleins(texte);
    return m.length > 0 && m.every((x) => ailleurs.has(x));
  };
  const doubles: string[] = [];
  for (const t of titres) {
    const texte = t.morceaux.join(" ");
    const c = cle(texte);
    if (c.length < 4) continue;
    if (corps.some((x) => cle(x.morceaux.join(" ")) === c) || couvert(texte, motsCorps)) doubles.push(texte);
  }
  for (const x of corps) {
    const texte = x.morceaux.join(" ");
    if (cle(texte).length >= 4 && couvert(texte, motsTitres) && !doubles.some((d) => cle(d) === cle(texte))) doubles.push(texte);
  }
  return doubles;
}

/** Rectangle (boîte englobante, rotation comprise) d'un texte ou d'une forme. */
function boite(x: { x: number; y: number; largeur: number; hauteur: number; rotation?: number; pivot?: { x: number; y: number } }): RectV2 {
  if (!x.rotation) return { x: x.x, y: x.y, largeur: x.largeur, hauteur: x.hauteur };
  const a = (x.rotation * Math.PI) / 180;
  const c = x.pivot ?? { x: x.x + x.largeur / 2, y: x.y + x.hauteur / 2 };
  const pts = [
    [x.x, x.y],
    [x.x + x.largeur, x.y],
    [x.x, x.y + x.hauteur],
    [x.x + x.largeur, x.y + x.hauteur],
  ].map(([px, py]) => ({ x: c.x + (px - c.x) * Math.cos(a) - (py - c.y) * Math.sin(a), y: c.y + (px - c.x) * Math.sin(a) + (py - c.y) * Math.cos(a) }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), largeur: Math.max(...xs) - Math.min(...xs), hauteur: Math.max(...ys) - Math.min(...ys) };
}

const dedans = (a: RectV2, b: RectV2, tol: number) => a.x >= b.x - tol && a.y >= b.y - tol && a.x + a.largeur <= b.x + b.largeur + tol && a.y + a.hauteur <= b.y + b.hauteur + tol;
const recouvrement = (a: RectV2, b: RectV2) => Math.max(0, Math.min(a.x + a.largeur, b.x + b.largeur) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.hauteur, b.y + b.hauteur) - Math.max(a.y, b.y));

/** Formes qui ENCADRENT (carte, case, bulle) : un texte ou un dessin qui y entre n'en déborde jamais. */
const estCadre = (f: FormeV2) => f.sorte === "carte" || f.sorte === "case" || f.sorte === "bulle";

/**
 * Textes coupés ou illisibles (relecture des quatre vidéos du 12/10/2026 : « : phrase, une par » coupé au bord gauche,
 * titre coupé en plein milieu, trois tampons l'un sur l'autre) :
 *  - un texte qui sort de l'image ou de la zone sûre (en largeur) ;
 *  - un texte qui commence dans un cadre (carte, case, bulle) et en déborde ;
 *  - deux textes de lignes différentes qui se recouvrent (plus d'un cinquième du plus petit).
 */
export function textesCoupesV2(e: Pick<EcranPlace, "id" | "textes" | "formes">, g: GeometrieV2): string[] {
  const fautes: string[] = [];
  const z = g.zoneSure;
  const tl = g.titresLarges;
  const cadres = e.formes.filter((f) => estCadre(f) && !f.horsZone);
  const textes = e.textes.filter((t) => t.texte.trim());
  for (const t of textes) {
    const b = boite(t);
    if (b.x < -0.5 || b.y < -0.5 || b.x + b.largeur > g.largeur + 0.5 || b.y + b.hauteur > g.hauteur + 0.5) fautes.push(`« ${t.texte} » sort de l'image`);
    // Vertical : les titres du haut peuvent aller jusqu'à la marge des titres larges (`GeometrieV2.titresLarges`).
    else if (b.x < z.x - 0.5 || (b.x + b.largeur > z.x + z.largeur + 0.5 && !(tl && b.x + b.largeur <= tl.droite + 12 * g.k && b.y + b.hauteur <= tl.basMax))) fautes.push(`« ${t.texte} » sort de la zone sûre`);
    const cx = t.x + Math.min(t.largeur, t.hauteur) / 2;
    const cy = t.y + t.hauteur / 2;
    const cadre = cadres.filter((c) => cx >= c.x && cx <= c.x + c.largeur && cy >= c.y && cy <= c.y + c.hauteur).sort((a, c) => a.largeur * a.hauteur - c.largeur * c.hauteur)[0];
    if (cadre && !t.rotation && !dedans(b, cadre, 2 * g.k)) fautes.push(`« ${t.texte} » déborde de son cadre`);
  }
  // Recouvrements : par ligne (source), les rangées d'une même ligne ne comptent pas entre elles.
  for (let i = 0; i < textes.length; i++)
    for (let j = i + 1; j < textes.length; j++) {
      const a = textes[i];
      const b = textes[j];
      // Deux groupes de titres qui défilent à la même place ne sont jamais ensemble à l'écran.
      if (a.source === b.source || a.horsContenu || b.horsContenu || (a.groupe !== undefined && b.groupe !== undefined && a.groupe !== b.groupe)) continue;
      const ra = boite(a);
      const rb = boite(b);
      const r = recouvrement(ra, rb);
      if (r > 0.2 * Math.min(ra.largeur * ra.hauteur, rb.largeur * rb.hauteur)) fautes.push(`« ${a.texte} » et « ${b.texte} » se recouvrent`);
    }
  return [...new Set(fautes)];
}

/**
 * Grands cadres vides (relecture des quatre vidéos du 12/10/2026 : la carte « LE PROBLÈME, C'EST L'IA » puis un grand
 * cadre blanc jusqu'en bas de l'image ; une carte de trois traits gris) : dans chaque carte, case ou bulle de quelque
 * taille, la part que rien ne remplit (marge de 40 px autour de ce qui est écrit
 * ou dessiné ; traits gris sans marge) ne dépasse pas 60 %. Mesuré sur la partie visible du cadre (l'image).
 */
export const VIDE_MAX_CADRE = 0.6;
export function cadresVidesV2(e: Pick<EcranPlace, "id" | "textes" | "formes" | "traits">, g: GeometrieV2): string[] {
  const z = zoneUtileV2(e, g);
  const marge = 40 * g.k;
  const fautes: string[] = [];
  const vus = new Set<string>();
  for (const c of e.formes) {
    if (!estCadre(c)) continue;
    const r: RectV2 = { x: Math.max(0, c.x), y: Math.max(0, c.y), largeur: Math.min(g.largeur, c.x + c.largeur) - Math.max(0, c.x), hauteur: Math.min(g.hauteur, c.y + c.hauteur) - Math.max(0, c.y) };
    // Cadres de quelque taille seulement (un dixième de la zone utile, un quart de sa hauteur) : ni la barre des
    // étapes, ni les bandes d'une liste.
    if (c.id.startsWith("barre#") || r.largeur * r.hauteur < 0.1 * z.largeur * z.hauteur || r.hauteur < 0.25 * z.hauteur) continue;
    const cleR = `${Math.round(r.x)}:${Math.round(r.y)}:${Math.round(r.largeur)}:${Math.round(r.hauteur)}`;
    if (vus.has(cleR)) continue;
    vus.add(cleR);
    const dans = (x: RectV2) => x.x + x.largeur / 2 >= r.x && x.x + x.largeur / 2 <= r.x + r.largeur && x.y + x.hauteur / 2 >= r.y && x.y + x.hauteur / 2 <= r.y + r.hauteur;
    const pleins: (RectV2 & { nu?: boolean })[] = [];
    for (const t of e.textes) if (!t.horsContenu && dans(boite(t))) pleins.push(boite(t));
    for (const f of e.formes) {
      if (f === c || f.sorte === "jauge" || f.sorte === "deco" || f.horsZone) continue;
      // Un autre cadre aussi grand (son emplacement en pointillés) ne remplit pas celui-ci.
      if (estCadre(f) && f.largeur * f.hauteur >= 0.6 * c.largeur * c.hauteur) continue;
      if (dans(f)) pleins.push(f.sorte === "barre-sable" ? { ...f, nu: true } : f);
    }
    for (const t of e.traits) {
      const pts = t.segments.flat().filter((q) => q.x >= r.x && q.x <= r.x + r.largeur && q.y >= r.y && q.y <= r.y + r.hauteur);
      if (pts.length < 2) continue;
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      pleins.push({ x: Math.min(...xs), y: Math.min(...ys), largeur: Math.max(...xs) - Math.min(...xs), hauteur: Math.max(...ys) - Math.min(...ys) });
    }
    const nx = Math.max(1, Math.ceil(r.largeur / PAS));
    const ny = Math.max(1, Math.ceil(r.hauteur / PAS));
    const plein = new Uint8Array(nx * ny);
    for (const q of pleins) {
      const m = q.nu ? 0 : marge;
      const i0 = Math.max(0, Math.floor((q.x - m - r.x) / PAS));
      const i1 = Math.min(nx - 1, Math.floor((q.x + q.largeur + m - r.x) / PAS));
      const j0 = Math.max(0, Math.floor((q.y - m - r.y) / PAS));
      const j1 = Math.min(ny - 1, Math.floor((q.y + q.hauteur + m - r.y) / PAS));
      for (let j = j0; j <= j1; j++) if (i1 >= i0) plein.fill(1, j * nx + i0, j * nx + i1 + 1);
    }
    let vides = 0;
    for (let i = 0; i < plein.length; i++) if (!plein[i]) vides++;
    const part = vides / plein.length;
    if (part > VIDE_MAX_CADRE + 1e-9) fautes.push(`le cadre « ${c.id} » est vide aux ${Math.round(part * 100)} %`);
  }
  return fautes;
}

/**
 * Pictogrammes (relecture des quatre vidéos du 12/10/2026 : ronds avec flèche, coche, engrenage, étoile sans rapport ;
 * un rond VIDE) : chaque disque porte son pictogramme, qui entre avec lui (sauf l'avatar de la bulle de commentaire), et chaque pictogramme
 * est l'un de ceux que la fiche demande pour cette scène (`autorises`, éléments « dessin » de la scène).
 */
export function pictogrammesFautifsV2(e: Pick<EcranPlace, "id" | "formes">, autorises: ReadonlySet<string>): string[] {
  const fautes: string[] = [];
  const dessins = e.formes.filter((f) => f.sorte === "dessin");
  for (const d of dessins) if (!d.dessin || !autorises.has(d.dessin)) fautes.push(`pictogramme « ${d.dessin ?? "?"} » absent de la fiche`);
  for (const r of e.formes) {
    if (r.sorte !== "rond" || r.id.endsWith("#avatar")) continue;
    const porte = dessins.find((d) => d.x >= r.x - 1 && d.y >= r.y - 1 && d.x + d.largeur <= r.x + r.largeur + 1 && d.y + d.hauteur <= r.y + r.hauteur + 1);
    if (!porte) fautes.push(`rond vide « ${r.id} »`);
    // Le disque et son dessin entrent ensemble : jamais un rond vide en attendant son pictogramme.
    else if (porte.source !== r.source || (porte.decalageMs ?? 0) !== (r.decalageMs ?? 0) || !!porte.desLArrivee !== !!r.desLArrivee) fautes.push(`le rond « ${r.id} » arrive avant son pictogramme`);
  }
  return fautes;
}

/**
 * Étiquettes « AVANT » / « APRÈS » de l'exemple (relecture des quatre vidéos du 12/10/2026 : sous « AVANT », « Fin du
 * mois : toute l'agence ») : une étiquette avant ou après ne coiffe qu'une ligne qui le dit (préfixe « Avant : » ou
 * « Après : »).
 */
export function etiquettesIncoherentesV2(e: Pick<EcranPlace, "id" | "textes">): string[] {
  const fautes: string[] = [];
  for (const cle of ["av", "ap"]) {
    const etiq = e.textes.find((t) => t.id === `${e.id}#${cle}e`)?.texte;
    if (!etiq) continue;
    const texte = e.textes
      .filter((t) => t.id.startsWith(`${e.id}#${cle}t`))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((t) => t.texte)
      .join(" ");
    const ton = /^\s*avant\s*:/iu.test(texte) ? "AVANT" : /^\s*apr[eè]s\s*:/iu.test(texte) ? "APRÈS" : null;
    if ((etiq === "AVANT" || etiq === "APRÈS") && ton !== etiq) fautes.push(`l'étiquette « ${etiq} » coiffe « ${texte} »`);
  }
  return fautes;
}
