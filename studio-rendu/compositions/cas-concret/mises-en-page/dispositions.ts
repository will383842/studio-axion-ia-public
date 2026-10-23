/**
 * L6 · DISPOSITIONS DES MISES EN PAGE (pur : ni `remotion` ni React). Pour chaque mise en page validée (#308) : où va
 * chaque texte (taille AJUSTÉE à sa place), chaque carte, chaque jauge, à l'état final de l'écran, dans le cadre de
 * l'écran (9:16 ou 4:5). Les textes et nombres sont ceux de l'écran (fiche, script validé) ; aucun n'est écrit ici.
 * Les compositions animent ces positions ; les tests vérifient que rien ne déborde, textes courts ou longs.
 */
import { sansBalises, type BoitePx, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { nombreEcrit, partDeLaPreuve, tourDeLUnite, type CodeMiseEnPageL6 } from "../../../../src/briques/ecrans-motion/mises-en-page";
import { cadrer, objetDuVisuel, RATIOS_OBJETS } from "../plans/Objet";
import { ajusterDisposition, cadre, ecrireNombre, largeurPosee as largeurTexteDe, poser, type Cadre, type DispositionL6, type FormeL6, type TexteL6 } from "./geo";

type P<T extends ProprietesEcran["type"]> = Extract<ProprietesEcran, { type: T }>;
const bas = (b: BoitePx) => b.y + b.hauteur;
const boite = (x: number, y: number, largeur: number, hauteur: number): BoitePx => ({ x, y, largeur, hauteur });

/** Étiquette en capitales espacées (Inter Bold, 28 px en 1080). */
function etiquette(nom: string, texte: string, c: Cadre, y: number, k: number, align: TexteL6["align"] = "left", x = c.x, largeur = c.largeur): TexteL6 {
  return poser(nom, sansBalises(texte), { police: "inter-gras", taille: Math.round(28 * Math.max(0.85, k)), plancher: 20, x, y, largeur, lignesMax: 2, approche: 0.32, capitales: true, align });
}
/** Affiche Anton : une ligne par texte donné (liste) ou un texte coupé en `lignesMax` lignes. */
const affiche = (nom: string, texte: string | readonly string[], c: Cadre, y: number, taille: number, o: { x?: number; largeur?: number; lignesMax?: number; align?: TexteL6["align"] } = {}) =>
  poser(nom, texte, { police: "anton", taille, x: o.x ?? c.x, y, largeur: o.largeur ?? c.largeur, lignesMax: o.lignesMax ?? 2, align: o.align, plancher: Math.max(34, Math.round(taille * 0.3)), interligne: 1.02 });
/** Texte Inter Bold (lignes, puces). */
const corps = (nom: string, texte: string, c: Cadre, y: number, taille: number, o: { x?: number; largeur?: number; lignesMax?: number; align?: TexteL6["align"] } = {}) =>
  poser(nom, texte, { police: "inter-gras", taille, x: o.x ?? c.x, y, largeur: o.largeur ?? c.largeur, lignesMax: o.lignesMax ?? 2, align: o.align, plancher: 24 });

/** Boîte d'un objet de la banque cadrée à son ratio dans la place donnée. */
function boiteObjet(v: P<"etape" | "objet">["visuel"], place: BoitePx): BoitePx {
  const r = RATIOS_OBJETS[objetDuVisuel(v)];
  return r ? cadrer(r, place) : place;
}

/** Pastilles (puces, pastilles du chiffre) en rangée(s) : tailles ajustées, boîtes posées de gauche à droite. */
function pastilles(nom: string, textes: readonly string[], c: Cadre, y: number, k: number, align: "left" | "center" = "left") {
  const taille = Math.round(40 * k);
  const hauteur = Math.round(taille * 1.9);
  const poses = textes.map((t, i) => poser(`${nom}-${i + 1}`, t, { police: "inter-gras", taille, plancher: 24, x: 0, y: 0, largeur: c.largeur - hauteur * 1.6 }));
  // Rangées : on remplit la ligne tant que ça tient.
  const formes: FormeL6[] = [];
  const textesPoses: TexteL6[] = [];
  let x = c.x;
  let ligne = 0;
  const ecart = Math.round(18 * k);
  const rangees: { i: number; x: number; largeur: number }[][] = [[]];
  poses.forEach((t, i) => {
    const l = Math.ceil(Math.min(c.largeur, largeurTexteDe(t) + hauteur * 1.4));
    if (x > c.x && x + l > c.x + c.largeur) {
      ligne++;
      x = c.x;
      rangees.push([]);
    }
    rangees[ligne]!.push({ i, x, largeur: l });
    x += l + ecart;
  });
  rangees.forEach((r, j) => {
    const total = r.reduce((s, q) => s + q.largeur, 0) + ecart * Math.max(0, r.length - 1);
    const dx = align === "center" ? (c.largeur - total) / 2 : 0;
    for (const q of r) {
      const b = boite(q.x + dx, y + j * (hauteur + ecart), q.largeur, hauteur);
      formes.push({ nom: `${nom}-${q.i + 1}`, boite: b });
      const t = poses[q.i]!;
      textesPoses.push({ ...t, boite: { x: b.x + hauteur * 0.95, y: b.y + (hauteur - t.taille * t.interligne) / 2, largeur: b.largeur - hauteur * 1.15, hauteur: t.taille * t.interligne } });
    }
  });
  return { formes, textes: textesPoses, bas: y + rangees.length * (hauteur + ecart) - ecart, hauteur };
}

/* ------------------------------------------------------------------ */
/* Accroche                                                              */
/* ------------------------------------------------------------------ */

export function dispoAccDetailRecul(p: P<"accroche">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const lignes = affiche("lignes", p.lignes, c, et ? bas(et.boite) + 18 * k : c.haut, Math.round((c.r45 ? 120 : 150) * k));
    const y0 = bas(lignes.boite) + 60 * k;
    const g = Math.round(30 * k);
    const l = (c.largeur - 3 * g) / 4;
    const h = l * 0.93;
    const rangees = Math.min(4, Math.floor((c.basDessin - y0 + g) / (h + g)));
    const cartes: FormeL6[] = [];
    for (let r = 0; r < Math.max(2, rangees); r++) for (let q = 0; q < 4; q++) cartes.push({ nom: `carte-${r}-${q}`, boite: boite(c.x + q * (l + g), y0 + r * (h + g), l, h) });
    return { textes: [...(et ? [et] : []), lignes], formes: cartes, rangees: Math.max(2, rangees) };
  });
}

export function dispoAccPageEcrite(p: P<"accroche">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const lignes = affiche("lignes", p.lignes, c, et ? bas(et.boite) + 18 * k : c.haut, Math.round((c.r45 ? 130 : 160) * k));
    const y = bas(lignes.boite) + 70 * k;
    const page = boite(c.L * 0.12, y, c.L * 0.76, Math.min(840 * k, c.basDessin - y - 20));
    return { textes: [...(et ? [et] : []), lignes], formes: [{ nom: "page", boite: page }, ...(page.hauteur < 260 ? [{ nom: "page-trop-petite", boite: boite(0, -1, 1, 1) }] : [])], page };
  });
}

export function dispoAccDuelTailles(p: P<"accroche">) {
  const c = cadre(p);
  const i = Math.max(0, p.lignes.findIndex((l) => nombreEcrit(l) !== null));
  const n = nombreEcrit(p.lignes[i] ?? "") ?? { texte: "", valeur: 0 };
  const autres = p.lignes.filter((_, j) => j !== i);
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const y0 = et ? bas(et.boite) + 18 * k : c.haut;
    const marge = 26 * k;
    const petit = affiche("petit", autres, c, y0 + marge, Math.round(86 * k), { x: c.x + marge, largeur: c.largeur - 2 * marge });
    const cadrePetit = boite(c.x, y0, c.largeur, petit.boite.hauteur + 2 * marge);
    const label = etiquette("ligne-du-nombre", p.lignes[i] ?? "", c, bas(cadrePetit) + 60 * k, k, "center");
    const geant = affiche("geant", [n.texte], c, bas(label.boite) + 30 * k, Math.round((c.r45 ? 420 : 600) * k), { align: "center" });
    return { textes: [...(et ? [et] : []), petit, label, geant], formes: [{ nom: "cadre-petit", boite: cadrePetit }], nombre: n.texte };
  });
}

/* ------------------------------------------------------------------ */
/* Titre                                                                 */
/* ------------------------------------------------------------------ */

export function dispoTitLignesMagazine(p: P<"titre">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const taille = Math.round((c.r45 ? 190 : 230) * k);
    let y = c.haut + 40 * k;
    const lignes = p.lignes.map((l, i) => {
      const t = affiche(`titre-${i + 1}`, l, c, y, taille, { lignesMax: 2 });
      y = bas(t.boite) + taille * 0.22;
      return t;
    });
    const filets = lignes.map((t, i) => ({ nom: `filet-${i + 1}`, boite: boite(c.x, bas(t.boite) + 2, c.largeur, 7) }));
    const yc = y + 40 * k;
    const lc = Math.round((c.r45 ? 230 : 290) * k);
    const hc = Math.round(lc * 0.86);
    const cartes = yc + hc + 40 <= c.basDessin ? [0, 1, 2].map((q) => ({ nom: `carte-${q}`, boite: boite(c.L - c.x - lc - (2 - q) * lc * 0.5, yc - q * 18, lc, hc) })) : [];
    return { textes: lignes, formes: [...filets, ...cartes] };
  });
}

export function dispoTitMotObjet(p: P<"titre">) {
  const c = cadre(p);
  const avant = p.lignes.slice(0, -1);
  const mot = p.lignes.at(-1) ?? "";
  return ajusterDisposition(c, (k) => {
    const haut = avant.length ? affiche("titre-1", avant, c, c.haut, Math.round(120 * k), { align: "center" }) : null;
    const y = haut ? bas(haut.boite) + 50 * k : c.haut + 40 * k;
    const lp = c.L * 0.72;
    const page = boite((c.L - lp) / 2, y, lp, Math.min(1100 * k, c.basDessin - y - 30));
    const ls = Math.min(660 * k, c.largeur * 0.7);
    const hs = ls * 0.52;
    const tampon = boite(c.L / 2 - ls / 2, page.y + page.hauteur * 0.45 - hs / 2, ls, hs);
    const texte = affiche(avant.length ? "titre-2" : "titre-1", [mot], c, tampon.y + hs * 0.17, Math.round(210 * k), { x: tampon.x + 50 * k, largeur: ls - 100 * k, align: "center" });
    const formes = [{ nom: "page", boite: page }, { nom: "tampon", boite: tampon }, ...(page.hauteur < 400 * k ? [{ nom: "page-trop-petite", boite: boite(0, -1, 1, 1) }] : [])];
    return { textes: [...(haut ? [haut] : []), texte], formes, page, tampon };
  });
}

/* ------------------------------------------------------------------ */
/* Liste « avant »                                                        */
/* ------------------------------------------------------------------ */

/** En-tête commun d'une liste : étiquette et titre. */
function enteteListe(p: P<"liste-avant">, c: Cadre, k: number, taille = 110) {
  const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
  const titre = affiche("titre", p.titre, c, et ? bas(et.boite) + 16 * k : c.haut, Math.round(taille * k), { lignesMax: 2 });
  return { textes: [...(et ? [et] : []), titre], bas: bas(titre.boite) };
}

export function dispoAvaCartesTombent(p: P<"liste-avant">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const e = enteteListe(p, c, k, c.r45 ? 90 : 110);
    const n = p.taches.length;
    const h = Math.round((c.r45 ? 92 : 112) * k);
    const g = Math.round(16 * k);
    const y0 = e.bas + 40 * k;
    const cartes: FormeL6[] = [];
    const textes: TexteL6[] = [...e.textes];
    p.taches.forEach((t, i) => {
      const b = boite(c.x + (i % 2) * 30 * k, y0 + i * (h + g), c.largeur - 30 * k, h);
      cartes.push({ nom: `tache-${i + 1}`, boite: b });
      textes.push(corps(`tache-${i + 1}`, t, c, b.y + (h - 50 * k * 1.18) / 2, Math.round(50 * k), { x: b.x + h * 1.05, largeur: b.largeur - h * 1.25, lignesMax: 1 }));
    });
    const yt = y0 + n * (h + g) + 20 * k;
    const total = p.total ? affiche("total", `= *${sansBalises(p.total.valeur)}*`, c, yt, Math.round((c.r45 ? 150 : 200) * k), { lignesMax: 1 }) : null;
    const ligneTotal = p.total?.ligne && total ? corps("total-ligne", p.total.ligne, c, bas(total.boite) + 6 * k, Math.round(40 * k)) : null;
    return { textes: [...textes, ...(total ? [total] : []), ...(ligneTotal ? [ligneTotal] : [])], formes: cartes };
  });
}

export function dispoAvaCadran(p: P<"liste-avant">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const e = enteteListe(p, c, k, 100);
    const d = Math.round(88 * k);
    const ep = Math.round(84 * k);
    const place = c.basDessin - e.bas - 40 * k;
    const r = Math.min(320 * k, (place - 2 * (ep / 2 + 56 * k + d / 2)) / 2, (c.L / 2 - c.dessin.x - ep / 2 - 56 * k - d / 2 - 4) * 1);
    const cy = e.bas + 30 * k + ep / 2 + 56 * k + d / 2 + r;
    const cx = c.L / 2;
    const n = p.taches.length;
    const pastillesF: FormeL6[] = p.taches.map((_, i) => {
      const ang = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
      const rr = r + ep / 2 + 56 * k;
      return { nom: `tache-${i + 1}`, boite: boite(cx + rr * Math.cos(ang) - d / 2, cy + rr * Math.sin(ang) - d / 2, d, d) };
    });
    const total = affiche("total", sansBalises(p.total?.valeur ?? ""), c, cy - r * 0.42, Math.round(Math.min(220, r * 0.8)), { x: cx - r * 0.72, largeur: r * 1.44, align: "center", lignesMax: 2 });
    const ligne = p.total?.ligne ? corps("total-ligne", p.total.ligne, c, bas(total.boite) + 10 * k, Math.round(38 * k), { x: cx - r * 0.7, largeur: r * 1.4, align: "center", lignesMax: 2 }) : null;
    return { textes: [...e.textes, total, ...(ligne ? [ligne] : [])], formes: [{ nom: "cadran", boite: boite(cx - r - ep / 2, cy - r - ep / 2, 2 * r + ep, 2 * r + ep) }, ...pastillesF, ...(r < 120 ? [{ nom: "cadran-trop-petit", boite: boite(0, -1, 1, 1) }] : [])], cx, cy, r, ep, d };
  });
}

export function dispoAvaBarreFeutre(p: P<"liste-avant">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const e = enteteListe(p, c, k, 84);
    const n = p.taches.length;
    const place = c.bas - e.bas - 40 * k;
    const pas = Math.min(200 * k, place / n);
    const taille = Math.round(Math.min(118 * k, pas * 0.78));
    const textes = p.taches.map((t, i) => affiche(`tache-${i + 1}`, [t], c, e.bas + 40 * k + i * pas, taille, { lignesMax: 1 }));
    return { textes: [...e.textes, ...textes], formes: [] };
  });
}

/* ------------------------------------------------------------------ */
/* Étape                                                                 */
/* ------------------------------------------------------------------ */

/** Étiquette d'une étape : « Étape 0n / N » (nombres de la fiche). */
export const texteEtape = (p: P<"etape">) => `Étape ${String(p.numero).padStart(2, "0")} / ${p.nombreEtapes}`;

export function dispoEtaSchemaFeutre(p: P<"etape">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const et = etiquette("etiquette", texteEtape(p), c, c.haut, k);
    const puces = p.puces.length ? pastilles("puce", p.puces, c, 0, k, "center") : null;
    const yDe = bas(et.boite) + 110 * k;
    const yA = c.basDessin - (puces ? puces.bas + 50 * k : 60 * k) - 30 * k;
    const n = p.nombreEtapes;
    const xs = [c.L * 0.27, c.L * 0.73];
    const actif = Math.min(n, Math.max(1, p.numero)) - 1;
    const dPetit = Math.round(104 * k);
    const dActif = Math.round(140 * k);
    const noeuds = Array.from({ length: n }, (_, i) => ({ x: xs[i % 2]!, y: yDe + ((yA - yDe) * i) / Math.max(1, n - 1) }));
    const formes: FormeL6[] = noeuds.map((q, i) => {
      const d = i === actif ? dActif + 20 * k : dPetit;
      return { nom: `noeud-${i + 1}`, boite: boite(q.x - d / 2, q.y - d / 2, d, d) };
    });
    const a = noeuds[actif]!;
    const aDroite = actif % 2 === 0;
    const xT = aDroite ? a.x + dActif / 2 + 40 * k : c.x;
    const lT = aDroite ? c.x + c.largeur - xT : a.x - dActif / 2 - 40 * k - c.x;
    const titre = affiche("titre", p.titre, c, a.y - 64 * k, Math.round((c.r45 ? 100 : 120) * k), { x: xT, largeur: lT, lignesMax: 2, align: aDroite ? "left" : "right" });
    const ligne = corps("ligne", p.ligne, c, bas(titre.boite) + 10 * k, Math.round(36 * k), { x: xT, largeur: lT, lignesMax: 3, align: aDroite ? "left" : "right" });
    const numeros: TexteL6[] = [];
    // Le titre actif ne doit pas recouvrir un nœud voisin : on vérifie sa hauteur contre l'écart entre nœuds.
    const ecart = (yA - yDe) / Math.max(1, n - 1);
    const chevauche = bas(ligne.boite) - (a.y - 64 * k) > ecart * 2 - dPetit;
    const pucesPosees = puces ? pastilles("puce", p.puces, c, yA + 70 * k, k, "center") : null;
    return { textes: [et, titre, ligne, ...numeros, ...(pucesPosees?.textes ?? [])], formes: [...formes, ...(pucesPosees?.formes ?? []), ...(chevauche ? [{ nom: "titre-sur-voisin", boite: boite(0, -1, 1, 1) }] : [])], noeuds, actif, dActif, dPetit };
  });
}

export function dispoEtaEntrerDedans(p: P<"etape">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const et = etiquette("etiquette", texteEtape(p), c, c.haut, k);
    const titre = affiche("titre", p.titre, c, bas(et.boite) + 16 * k, Math.round((c.r45 ? 110 : 140) * k), { lignesMax: 2 });
    const ligne = corps("ligne", p.ligne, c, bas(titre.boite) + 14 * k, Math.round(44 * k), { lignesMax: 3 });
    const puces = p.puces.length ? pastilles("puce", p.puces, c, 0, k) : null;
    const yv = bas(ligne.boite) + 40 * k;
    const hv = c.basDessin - yv - (puces ? puces.bas + 40 * k : 30 * k);
    const visuel = boiteObjet(p.visuel, boite(c.x, yv, c.largeur, Math.max(1, hv)));
    const pucesPosees = puces ? pastilles("puce", p.puces, c, bas(visuel) + 30 * k, k) : null;
    // La carte de départ (au centre) et les voisines : leurs numéros viennent de la fiche.
    const lc = Math.round(236 * Math.min(1, c.H / 1920 + 0.15));
    const hc = Math.round(lc * 1.78);
    const carte = boite(c.L / 2 - lc / 2, c.H * 0.47 - hc / 2, lc, hc);
    return { textes: [et, titre, ligne, ...(pucesPosees?.textes ?? [])], formes: [{ nom: "visuel", boite: visuel }, ...(pucesPosees?.formes ?? []), ...(visuel.hauteur < 240 ? [{ nom: "visuel-trop-petit", boite: boite(0, -1, 1, 1) }] : [])], visuel, carte };
  });
}

export function dispoEtaFantome(p: P<"etape">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const n = p.nombreEtapes;
    const puces = p.puces.length ? pastilles("puce", p.puces, c, 0, k) : null;
    const y0 = c.haut + 30 * k;
    const yFin = c.basDessin - (puces ? puces.bas + 40 * k : 20 * k);
    const actif = Math.min(n, Math.max(1, p.numero)) - 1;
    const hA = Math.min(300 * k, (yFin - y0) * 0.36);
    const g = 20 * k;
    const h = Math.min(196 * k, (yFin - y0 - hA - g * (n - 1)) / Math.max(1, n - 1));
    const rangs: FormeL6[] = [];
    let y = y0;
    const textes: TexteL6[] = [];
    for (let i = 0; i < n; i++) {
      const hh = i === actif ? hA : h;
      const b = boite(c.x, y, c.largeur, hh);
      rangs.push({ nom: `rang-${i + 1}`, boite: b });
      const tn = Math.round(Math.min(96 * k, hh * 0.55));
      textes.push(affiche(`numero-${i + 1}`, [String(i + 1).padStart(2, "0")], c, y + (hh - tn) / 2, tn, { x: b.x + 36 * k, largeur: tn * 1.2, lignesMax: 1 }));
      if (i === actif) {
        const xT = b.x + 36 * k + tn * 1.25 + 24 * k;
        const lT = b.x + b.largeur - xT - (p.puces.length ? 120 * k : 30 * k);
        const titre = affiche("titre", [p.titre], c, y + hh * 0.14, Math.round(Math.min(92 * k, hh * 0.36)), { x: xT, largeur: lT, lignesMax: 1 });
        const ligne = corps("ligne", p.ligne, c, bas(titre.boite) + 8 * k, Math.round(Math.min(38 * k, hh * 0.14)), { x: xT, largeur: lT, lignesMax: 2 });
        if (bas(ligne.boite) > y + hh - 8) rangs.push({ nom: "ligne-hors-du-rang", boite: boite(0, -1, 1, 1) });
        textes.push(titre, ligne);
      }
      y += hh + g;
    }
    const pucesPosees = puces ? pastilles("puce", p.puces, c, y + 20 * k, k) : null;
    return { textes: [...textes, ...(pucesPosees?.textes ?? [])], formes: [...rangs, ...(pucesPosees?.formes ?? []), ...(h < 60 ? [{ nom: "rangs-trop-petits", boite: boite(0, -1, 1, 1) }] : [])], actif };
  });
}

/* ------------------------------------------------------------------ */
/* Objet                                                                 */
/* ------------------------------------------------------------------ */

export function dispoObjEtiquettePend(p: P<"objet">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const titre = affiche("titre", p.titre, c, c.haut, Math.round((c.r45 ? 150 : 190) * k), { lignesMax: 2 });
    const y = bas(titre.boite) + 40 * k;
    const lt = Math.round(380 * k);
    const ht = Math.round(230 * k);
    const hCadre = Math.min(760 * k, c.basDessin - y - ht * 0.75);
    const cadreB = boite(c.L * 0.093, y, c.L * 0.74, hCadre);
    const marge = 36 * k;
    const visuel = boiteObjet(p.visuel, boite(cadreB.x + marge, cadreB.y + marge, cadreB.largeur - 2 * marge, cadreB.hauteur - 2 * marge));
    const attache = { x: cadreB.x + cadreB.largeur - 40 * k, y: bas(cadreB) - 40 * k };
    const fil = 70 * k;
    const tag = boite(Math.min(attache.x - lt / 2, c.L - c.dessin.x - lt), attache.y + fil, lt, ht);
    const texteTag = affiche("ligne", p.ligne ?? "", c, tag.y + 46 * k, Math.round(66 * k), { x: tag.x + 20 * k, largeur: lt - 40 * k, lignesMax: 2, align: "center" });
    const formes = [{ nom: "cadre", boite: cadreB }, { nom: "visuel", boite: visuel }, { nom: "etiquette-pendue", boite: tag }, ...(texteTag.boite.hauteur > ht - 50 * k ? [{ nom: "texte-hors-etiquette", boite: boite(0, -1, 1, 1) }] : []), ...(visuel.hauteur < 200 ? [{ nom: "visuel-trop-petit", boite: boite(0, -1, 1, 1) }] : [])];
    return { textes: [titre, texteTag], formes, cadre: cadreB, visuel, tag, attache };
  });
}

export function dispoObjPleinCadre(p: P<"objet">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const titre = affiche("titre", p.titre, c, c.haut, Math.round((c.r45 ? 100 : 120) * k), { lignesMax: 2 });
    const hp = Math.round(110 * k);
    const pilule = p.ligne ? boite(c.x, c.basDessin - hp - 10 * k, c.largeur, hp) : null;
    const ligne = pilule ? corps("ligne", p.ligne!, c, pilule.y + (hp - 40 * k * 2.36) / 2, Math.round(40 * k), { x: pilule.x + hp * 1.05, largeur: pilule.largeur - hp * 1.3, lignesMax: 2 }) : null;
    const y = bas(titre.boite) + 40 * k;
    const place = boite(c.dessin.x + 20, y, c.dessin.largeur - 40, (pilule ? pilule.y - 40 * k : c.basDessin) - y);
    const visuel = boiteObjet(p.visuel, place);
    return { textes: [titre, ...(ligne ? [ligne] : [])], formes: [{ nom: "visuel", boite: visuel }, ...(pilule ? [{ nom: "pilule", boite: pilule }] : []), ...(visuel.hauteur < 260 ? [{ nom: "visuel-trop-petit", boite: boite(0, -1, 1, 1) }] : [])], visuel, pilule };
  });
}

/* ------------------------------------------------------------------ */
/* Preuve                                                                */
/* ------------------------------------------------------------------ */

export function dispoPreJaugeSeuil(p: P<"preuve">) {
  const c = cadre(p);
  const part = partDeLaPreuve(p) ?? { valeur: 0, total: 1, texte: "", source: "" };
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const titre = affiche("titre", p.titre, c, et ? bas(et.boite) + 16 * k : c.haut, Math.round(100 * k), { lignesMax: 2 });
    const puces = pastilles("puce", p.puces, c, 0, k);
    const ep = Math.round(76 * k);
    const place = c.basDessin - bas(titre.boite) - 60 * k - puces.bas - 40 * k;
    const r = Math.min(310 * k, (place - ep) / 2);
    const cy = bas(titre.boite) + 40 * k + ep / 2 + r;
    const cx = c.L / 2;
    const centre = affiche("part", [part.texte], c, cy - r * 0.35, Math.round(r * 0.62), { x: cx - r * 0.75, largeur: r * 1.5, align: "center", lignesMax: 1 });
    const pucesPosees = pastilles("puce", p.puces, c, cy + r + ep / 2 + 40 * k, k);
    return { textes: [...(et ? [et] : []), titre, centre, ...pucesPosees.textes], formes: [{ nom: "jauge", boite: boite(cx - r - ep / 2, cy - r - ep / 2, 2 * r + ep, 2 * r + ep) }, ...pucesPosees.formes, ...(r < 130 ? [{ nom: "jauge-trop-petite", boite: boite(0, -1, 1, 1) }] : [])], cx, cy, r, ep, part };
  });
}

export function dispoPreCompterObjets(p: P<"preuve">) {
  const c = cadre(p);
  const n0 = [p.titre, p.etiquette ?? ""].map(nombreEcrit).find((x) => x && Number.isInteger(x.valeur) && x.valeur >= p.puces.length && x.valeur <= 30)?.valeur ?? p.puces.length;
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const titre = affiche("titre", p.titre, c, et ? bas(et.boite) + 16 * k : c.haut, Math.round(130 * k), { lignesMax: 2 });
    const h = Math.round(124 * k);
    const g = Math.round(26 * k);
    let y = bas(titre.boite) + 50 * k;
    const formes: FormeL6[] = [];
    const textes: TexteL6[] = [...(et ? [et] : []), titre];
    p.puces.forEach((t, i) => {
      const b = boite(c.x, y, c.largeur, h);
      formes.push({ nom: `puce-${i + 1}`, boite: b });
      textes.push(corps(`puce-${i + 1}`, t, c, y + (h - 52 * k * 1.18) / 2, Math.round(52 * k), { x: b.x + 36 * k, largeur: b.largeur - 160 * k, lignesMax: 1 }));
      y += h + g;
    });
    const reste = n0 - p.puces.length;
    const col = 5;
    const lc = (c.largeur - (col - 1) * g) / col;
    const hc = Math.min(lc, 150 * k);
    for (let i = 0; i < reste; i++) formes.push({ nom: `case-${i + 1}`, boite: boite(c.x + (i % col) * (lc + g), y + Math.floor(i / col) * (hc + g), lc, hc) });
    return { textes, formes, total: n0 };
  });
}

export function dispoPreCasesCochees(p: P<"preuve">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const titre = affiche("titre", p.titre, c, et ? bas(et.boite) + 16 * k : c.haut, Math.round((c.r45 ? 120 : 150) * k), { lignesMax: 2 });
    const h = Math.round((c.r45 ? 150 : 190) * k);
    const g = Math.round(34 * k);
    const y0 = bas(titre.boite) + 60 * k;
    const formes: FormeL6[] = [];
    const textes: TexteL6[] = [...(et ? [et] : []), titre];
    p.puces.forEach((t, i) => {
      const b = boite(c.x, y0 + i * (h + g), c.largeur, h);
      formes.push({ nom: `puce-${i + 1}`, boite: b });
      const tt = Math.round(Math.min(90 * k, h * 0.48));
      textes.push(affiche(`puce-${i + 1}`, [t], c, b.y + (h - tt) / 2, tt, { x: b.x + 48 * k, largeur: b.largeur - 48 * k - h * 0.9, lignesMax: 1 }));
    });
    return { textes, formes };
  });
}

/* ------------------------------------------------------------------ */
/* Chiffre                                                               */
/* ------------------------------------------------------------------ */

export function dispoChiAplatOrange(p: P<"chiffre">) {
  const c = cadre(p);
  const tour = tourDeLUnite(p.unite, p.nombre);
  return ajusterDisposition(c, (k) => {
    const nombre = affiche("nombre", [ecrireNombre(p.nombre)], c, c.haut + 20 * k, Math.round((c.r45 ? 340 : 470) * k), { lignesMax: 1 });
    const unite = affiche("unite", p.unite, c, bas(nombre.boite) - 10 * k, Math.round((c.r45 ? 200 : 260) * k), { lignesMax: 2 });
    const pas = p.pastilles.length ? pastilles("pastille", p.pastilles, c, 0, k) : null;
    const y = bas(unite.boite) + 50 * k;
    const r = tour ? Math.min(190 * k, (c.basDessin - y - (pas ? pas.bas + 40 * k : 20 * k)) / 2) : 0;
    const cadranB = tour && r >= 80 ? boite(c.L / 2 - r, y, 2 * r, 2 * r) : null;
    const pasPosees = pas ? pastilles("pastille", p.pastilles, c, cadranB ? bas(cadranB) + 40 * k : y, k) : null;
    return { textes: [nombre, unite, ...(pasPosees?.textes ?? [])], formes: [...(cadranB ? [{ nom: "cadran", boite: cadranB }] : []), ...(pasPosees?.formes ?? [])], cadran: cadranB, part: tour ? p.nombre / tour : 0 };
  });
}

export function dispoChiJaugeAnneau(p: P<"chiffre">) {
  const c = cadre(p);
  const tour = tourDeLUnite(p.unite, p.nombre) ?? 1;
  return ajusterDisposition(c, (k) => {
    const pas = p.pastilles.length ? pastilles("pastille", p.pastilles, c, 0, k, "center") : null;
    const ep = Math.round(88 * k);
    const place = c.basDessin - c.haut - 40 * k - (pas ? pas.bas + 50 * k : 0);
    const r = Math.min(360 * k, (place - ep) / 2, c.L / 2 - c.dessin.x - ep / 2);
    const cx = c.L / 2;
    const cy = c.haut + 20 * k + ep / 2 + r;
    const nombre = affiche("nombre", [ecrireNombre(p.nombre)], c, cy - r * 0.55, Math.round(r * 0.75), { x: cx - r * 0.72, largeur: r * 1.44, align: "center", lignesMax: 1 });
    const unite = corps("unite", p.unite, c, bas(nombre.boite) + 6 * k, Math.round(Math.min(56 * k, r * 0.16)), { x: cx - r * 0.7, largeur: r * 1.4, align: "center", lignesMax: 2 });
    const pasPosees = pas ? pastilles("pastille", p.pastilles, c, cy + r + ep / 2 + 50 * k, k, "center") : null;
    return { textes: [nombre, unite, ...(pasPosees?.textes ?? [])], formes: [{ nom: "anneau", boite: boite(cx - r - ep / 2, cy - r - ep / 2, 2 * r + ep, 2 * r + ep) }, ...(pasPosees?.formes ?? []), ...(r < 140 ? [{ nom: "anneau-trop-petit", boite: boite(0, -1, 1, 1) }] : [])], cx, cy, r, ep, part: p.nombre / tour };
  });
}

export function dispoChiCompterObjets(p: P<"chiffre">) {
  const c = cadre(p);
  const n = Math.max(1, Math.round(p.nombre));
  const col = n <= 12 ? 4 : n <= 30 ? 6 : n <= 100 ? 10 : 20;
  const lignesG = Math.ceil(n / col);
  return ajusterDisposition(c, (k) => {
    const nombre = affiche("nombre", [ecrireNombre(n)], c, c.haut, Math.round((c.r45 ? 240 : 320) * k), { lignesMax: 1, largeur: c.largeur * 0.5 });
    const unite = affiche("unite", p.unite, c, c.haut + nombre.boite.hauteur * 0.2, Math.round(100 * k), { x: c.x + c.largeur * 0.52, largeur: c.largeur * 0.48, lignesMax: 2 });
    const yG = Math.max(bas(nombre.boite), bas(unite.boite)) + 50 * k;
    const pas = p.pastilles.length ? pastilles("pastille", p.pastilles, c, 0, k) : null;
    const g = col >= 20 ? 8 * k : 14 * k;
    const cote = Math.min(130 * k, (c.largeur - (col - 1) * g) / col, (c.basDessin - yG - (pas ? pas.bas + 40 * k : 20) - (lignesG - 1) * g) / lignesG);
    const largeurG = col * cote + (col - 1) * g;
    const x0 = c.L / 2 - largeurG / 2;
    const grille = boite(x0, yG, largeurG, lignesG * cote + (lignesG - 1) * g);
    const pasPosees = pas ? pastilles("pastille", p.pastilles, c, bas(grille) + 40 * k, k) : null;
    return { textes: [nombre, unite, ...(pasPosees?.textes ?? [])], formes: [{ nom: "grille", boite: grille }, ...(pasPosees?.formes ?? []), ...(cote < 14 ? [{ nom: "cases-trop-petites", boite: boite(0, -1, 1, 1) }] : [])], grille, cote, ecart: g, colonnes: col, n };
  });
}

/* ------------------------------------------------------------------ */
/* Question                                                              */
/* ------------------------------------------------------------------ */

export function dispoQueGeante(p: P<"question">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const taille = Math.round((c.r45 ? 150 : 190) * k);
    let y = c.haut + 60 * k;
    const lignes = p.lignes.map((l, i) => {
      const t = affiche(`titre-${i + 1}`, l, c, y, taille, { lignesMax: 2 });
      y = bas(t.boite) + 10 * k;
      return t;
    });
    const question = corps("question", p.question, c, 0, Math.round(52 * k), { lignesMax: 3 });
    const yq = c.bas - question.boite.hauteur - 10 * k;
    const q = { ...question, boite: { ...question.boite, y: yq } };
    // Le « ? » géant occupe la place libre entre les lignes et la question, à droite.
    const hg = Math.max(200, yq - y - 40 * k);
    const geant = boite(c.L - Math.min(hg * 0.75, c.L * 0.6) - 20, y + 20 * k, Math.min(hg * 0.75, c.L * 0.6), hg);
    return { textes: [...lignes, q], formes: [{ nom: "point-d-interrogation", boite: geant, deco: true }, ...(yq < y + 20 ? [{ nom: "question-sur-lignes", boite: boite(0, -1, 1, 1) }] : [])], geant };
  });
}

export function dispoQueChampReponse(p: P<"question">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const taille = Math.round((c.r45 ? 130 : 172) * k);
    let y = c.haut + 40 * k;
    const lignes = p.lignes.map((l, i) => {
      const t = affiche(`titre-${i + 1}`, l, c, y, taille, { lignesMax: 2 });
      y = bas(t.boite) + taille * 0.3;
      return t;
    });
    const filets = lignes.map((t, i) => ({ nom: `filet-${i + 1}`, boite: boite(c.x, bas(t.boite) + 4, c.largeur, 6) }));
    const av = Math.round(110 * k);
    const question = corps("question", p.question, c, 0, Math.round(44 * k), { x: c.x + 44 * k + av + 30 * k, largeur: c.largeur - (44 * k + av + 30 * k) - 44 * k - av * 0.9, lignesMax: 3 });
    const h = Math.max(av + 60 * k, question.boite.hauteur + 70 * k);
    const champ = boite(c.x, Math.max(y + 40 * k, Math.min(c.basDessin - h - 20 * k, y + 120 * k)), c.largeur, h);
    const q = { ...question, boite: { ...question.boite, y: champ.y + (h - question.boite.hauteur) / 2 } };
    return { textes: [...lignes, q], formes: [...filets, { nom: "champ", boite: champ }], champ, avatar: av };
  });
}

/* ------------------------------------------------------------------ */
/* Résultat                                                              */
/* ------------------------------------------------------------------ */

export function dispoResCoupeDeux(p: P<"resultat">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const yA = et ? bas(et.boite) + 24 * k : c.haut;
    const labelAvant = etiquette("etiquette-avant", "Avant", c, yA, k);
    const avant = affiche("avant", [p.avant], c, bas(labelAvant.boite) + 14 * k, Math.round((c.r45 ? 100 : 130) * k), { lignesMax: 1, x: c.x + 220 * k, largeur: c.largeur - 220 * k });
    const carte = boite(c.x, bas(labelAvant.boite) + 14 * k, 190 * k, Math.max(150 * k, avant.boite.hauteur));
    const coupe = Math.max(bas(carte), bas(avant.boite)) + 70 * k;
    const labelMaint = etiquette("etiquette-maintenant", "Maintenant", c, coupe + 70 * k, k);
    const maintenant = affiche("maintenant", [p.maintenant], c, bas(labelMaint.boite) + 10 * k, Math.round((c.r45 ? 220 : 300) * k), { lignesMax: 1 });
    const titre = affiche("titre", p.titre, c, bas(maintenant.boite) + 20 * k, Math.round((c.r45 ? 80 : 100) * k), { lignesMax: 2 });
    const ligne = corps("ligne", p.ligne, c, bas(titre.boite) + 14 * k, Math.round(40 * k), { lignesMax: 2 });
    return { textes: [...(et ? [et] : []), labelAvant, avant, labelMaint, maintenant, titre, ligne], formes: [{ nom: "carte-avant", boite: carte }], coupe };
  });
}

export function dispoResMoisRempli(p: P<"resultat">) {
  const c = cadre(p);
  return ajusterDisposition(c, (k) => {
    const et = p.etiquette ? etiquette("etiquette", p.etiquette, c, c.haut, k) : null;
    const titre = affiche("titre", p.titre, c, et ? bas(et.boite) + 16 * k : c.haut, Math.round((c.r45 ? 130 : 170) * k), { lignesMax: 2 });
    const pas = pastilles("valeur", [`Avant : ${sansBalises(p.avant)}`, `Maintenant : ${sansBalises(p.maintenant)}`], c, 0, k);
    const ligne = corps("ligne", p.ligne, c, 0, Math.round(40 * k), { lignesMax: 2 });
    const yJ = bas(titre.boite) + 60 * k;
    const g = 12 * k;
    const rangees = 5;
    const cote = Math.min((c.largeur - 6 * g) / 7, (c.basDessin - yJ - 46 * k - pas.bas - ligne.boite.hauteur - 70 * k - 4 * g) / rangees);
    const lg = 7 * cote + 6 * g;
    const grille = boite(c.L / 2 - lg / 2, yJ + 46 * k, lg, rangees * cote + 4 * g);
    const pasPosees = pastilles("valeur", [`Avant : ${sansBalises(p.avant)}`, `Maintenant : ${sansBalises(p.maintenant)}`], c, bas(grille) + 36 * k, k);
    const l = { ...ligne, boite: { ...ligne.boite, y: pasPosees.bas + 24 * k } };
    // Les noms des pastilles : « Avant » et « Maintenant » sont les étiquettes de la brique (comme la v4).
    return { textes: [...(et ? [et] : []), titre, ...pasPosees.textes, l], formes: [{ nom: "mois", boite: grille }, ...pasPosees.formes, ...(cote < 50 ? [{ nom: "jours-trop-petits", boite: boite(0, -1, 1, 1) }] : [])], grille, cote, ecart: g };
  });
}

/* ------------------------------------------------------------------ */
/* Aiguillage                                                            */
/* ------------------------------------------------------------------ */

/** La disposition d'une mise en page pour un écran (le type doit correspondre au code). */
export function disposition(code: CodeMiseEnPageL6, p: ProprietesEcran): DispositionL6 {
  const t = p as never;
  const table: Record<CodeMiseEnPageL6, (x: never) => DispositionL6> = {
    "acc-detail-recul": dispoAccDetailRecul,
    "acc-page-ecrite": dispoAccPageEcrite,
    "acc-duel-tailles": dispoAccDuelTailles,
    "tit-lignes-magazine": dispoTitLignesMagazine,
    "tit-mot-objet": dispoTitMotObjet,
    "ava-cartes-tombent": dispoAvaCartesTombent,
    "ava-cadran": dispoAvaCadran,
    "ava-barre-feutre": dispoAvaBarreFeutre,
    "eta-schema-feutre": dispoEtaSchemaFeutre,
    "eta-entrer-dedans": dispoEtaEntrerDedans,
    "eta-fantome": dispoEtaFantome,
    "obj-etiquette-pend": dispoObjEtiquettePend,
    "obj-plein-cadre": dispoObjPleinCadre,
    "pre-jauge-seuil": dispoPreJaugeSeuil,
    "pre-compter-objets": dispoPreCompterObjets,
    "pre-cases-cochees": dispoPreCasesCochees,
    "chi-aplat-orange": dispoChiAplatOrange,
    "chi-jauge-anneau": dispoChiJaugeAnneau,
    "chi-compter-objets": dispoChiCompterObjets,
    "que-geante": dispoQueGeante,
    "que-champ-reponse": dispoQueChampReponse,
    "res-coupe-deux": dispoResCoupeDeux,
    "res-mois-rempli": dispoResMoisRempli,
  };
  return table[code](t);
}
