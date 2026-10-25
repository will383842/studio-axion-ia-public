/**
 * Écrans de texte de la variété (lot TYP-SOU) : données reçues du moteur et mise en page PURE (aucun JSX, aucun calcul
 * au niveau module). La forme des données est celle de `src/moteurs/montage-image-video/variete/axes/typo.ts`
 * (recopiée : une composition n'importe jamais `src/moteurs/**`) ; un test vérifie qu'elle s'y assigne.
 */
import { largeurAnton } from "../../../../../src/briques/schema-motion/chasse-anton";

export type ObjetMot = "cloche" | "enveloppe" | "horloge";

export interface MotEcrit {
  mot: string;
  /** Heure du mot dans le bloc (s) : celle de son mot dit. */
  t: number;
  orange?: true;
  dit: boolean;
}

export interface LigneEcrite {
  texte: string;
  t: number;
  mots: MotEcrit[];
}

export interface DonneesTexte {
  fond: "ivoire" | "sombre";
  lignes: LigneEcrite[];
  objet?: { nom: ObjetMot; ligne: number; mot: number; heure?: { h: number; m: number } };
  icone: string;
  calage: "voix" | "estime";
}

/** Données d'un écran de texte (null : bouchon du banc, sans données). */
export function donneesTexte(d: unknown): DonneesTexte | null {
  const x = d as DonneesTexte | null;
  return x && Array.isArray(x.lignes) ? x : null;
}

/** Zones d'un cadre (px) : texte (haut → bas), zone d'appoint sous les sous-titres (9:16 seulement). */
export function zonesTexte(hauteur: number) {
  if (hauteur >= 1900) return { haut: 236, bas: 1112, appoint: { y: 1306, h: 214 } as { y: number; h: number } | null };
  return { haut: 150, bas: 1012, appoint: null as { y: number; h: number } | null };
}

/** Avancée 0 → 1 d'une entrée qui commence à `debut` et dure `duree` (s), adoucie (sortie rapide, arrivée douce). */
export function avancee(t: number, debut: number, duree: number): number {
  if (debut <= 1e-3 && t >= 0) return 1;
  const x = Math.max(0, Math.min(1, (t - debut) / duree));
  return 1 - (1 - x) ** 3;
}

/** Mots de l'écran dans l'ordre d'arrivée (heure, puis place). */
export function motsDansLOrdre(d: DonneesTexte): { m: MotEcrit; ligne: number; rang: number }[] {
  return d.lignes
    .flatMap((l, ligne) => l.mots.map((m, rang) => ({ m, ligne, rang })))
    .sort((a, b) => a.m.t - b.m.t || a.ligne - b.ligne || a.rang - b.rang);
}

/** TYP-B : le mot dit en dernier à l'instant `t` (−1 : aucun encore). */
export function motCourant(ordre: readonly { m: MotEcrit }[], t: number): number {
  let k = -1;
  ordre.forEach((x, i) => {
    if (x.m.t <= t + 1e-6) k = i;
  });
  return k;
}

/** Taille d'un mot géant (px) : il tient dans `largeur`, au plus `max`. */
export function tailleMotGeant(mot: string, largeur: number, max: number): number {
  return Math.min(max, largeur / largeurAnton(mot.toUpperCase(), 1));
}

/**
 * TYP-C · glissade d'un mot hors de son cache (s). Courte (intégration, défaut vu à l'œil à la répétition générale :
 * « la ligne suivante glisse sous un cache et reste illisible ») : un mot n'est jamais coupé par son cache plus de 0,1 s.
 */
export const GLISSADE_TYP_C = 0.12;
/** TYP-C : les mots de la PREMIÈRE rangée dits dans ce délai (s) sont là dès le début de l'écran (jamais un écran vide). */
export const OUVERTURE_TYP_C = 0.6;

/**
 * Heure où un mot de TYP-C commence à glisser : son mot dit ; un mot de la première rangée dit tôt, dès l'écran, sauf un
 * chiffre (jamais montré avant son mot, Q13).
 */
export function heureGlissadeTypC(m: Pick<MotEcrit, "t" | "mot">, premiereRangee: boolean): number {
  return premiereRangee && m.t <= OUVERTURE_TYP_C && !/\d/.test(m.mot) ? 0 : m.t;
}

/** Part visible (0 → 1) d'un mot de TYP-C à l'instant `t` (le reste est sous son cache). */
export function partVisibleTypC(t: number, heure: number): number {
  return avancee(t, heure, GLISSADE_TYP_C);
}

/** Une rangée de TYP-C : les mots (rang dans la ligne d'écran), sa taille, son y (haut de la boîte de ligne). */
export interface Rangee {
  ligne: number;
  mots: number[];
  taille: number;
  y: number;
  largeur: number;
}

const INTERLIGNE = 0.36;
/** Air ajouté entre deux rangées en plus de l'interligne (× taille) : au plus 0,1 ⇒ trou visible ≤ 0,46 × taille (D4, compositions-iv/11). */
export const ECART_MAX_RANGEES = 0.1;
/** Un morceau de plusieurs mots n'est coupé que s'il faudrait le réduire sous cette part de sa taille pour qu'il tienne sur une ligne (D5). */
const PART_MIN_UNE_LIGNE = 0.75;

/**
 * TYP-C : coupe les lignes en rangées (mots entiers, largeur ≤ `largeur`) et choisit la plus grande taille qui fait
 * tenir le tout entre `haut` et `bas` ; le groupe orange a sa propre rangée, plus grande (le point focal). Les rangées
 * sont réparties sur toute la hauteur (pas de trou en bas).
 */
export function rangeesTexte(lignes: readonly LigneEcrite[], haut: number, bas: number, largeur: number, tailleMax = 230): Rangee[] {
  const hauteur = bas - haut;
  const larg = (mots: string[], taille: number) => largeurAnton(mots.join(" ").toUpperCase(), taille);
  const couper = (taille: number): Omit<Rangee, "y">[] => {
    const res: Omit<Rangee, "y">[] = [];
    lignes.forEach((l, ligne) => {
      // Morceaux : avant l'orange, le groupe orange, après.
      const morceaux: number[][] = [];
      l.mots.forEach((m, i) => {
        const dernier = morceaux.at(-1);
        const orangePrec = i > 0 && !!l.mots[i - 1].orange;
        if (!dernier || orangePrec !== !!m.orange) morceaux.push([i]);
        else dernier.push(i);
      });
      for (const morceau of morceaux) {
        const focal = !!l.mots[morceau[0]].orange && morceaux.length > 1;
        const t = focal ? Math.min(taille * 1.6, tailleMax * 1.6) : taille;
        // Coupe gloutonne, puis équilibrée : même nombre de rangées, mais la plus étroite possible (pas de mot veuf).
        const couperA = (l0: number): number[][] => {
          const rs: number[][] = [];
          let courante: number[] = [];
          for (const i of morceau) {
            const essai = [...courante, i];
            if (courante.length && larg(essai.map((k) => l.mots[k].mot), t) > l0) {
              rs.push(courante);
              courante = [i];
            } else courante = essai;
          }
          if (courante.length) rs.push(courante);
          return rs;
        };
        // D5 : « Au matin » (~960 px à 280) tient sur une ligne à 268 : on garde l'expression entière (la réduction plus bas ajuste la taille).
        const tailleUneLigne = largeur / Math.max(1e-6, larg(morceau.map((k) => l.mots[k].mot), 1));
        let coupe = morceau.length > 1 && tailleUneLigne >= PART_MIN_UNE_LIGNE * t ? [morceau] : couperA(largeur);
        for (let l0 = largeur - 20; coupe.length > 1 && l0 > largeur * 0.4; l0 -= 20) {
          const essai = couperA(l0);
          if (essai.length > coupe.length) break;
          coupe = essai;
        }
        for (const mots of coupe) res.push({ ligne, mots, taille: t, largeur: 0 });
      }
    });
    // Une rangée trop large pour sa taille (un seul mot très long) : réduite pour tenir.
    return res.map((r) => {
      const textes = r.mots.map((k) => lignes[r.ligne].mots[k].mot);
      const taille = Math.min(r.taille, largeur / Math.max(1e-6, largeurAnton(textes.join(" ").toUpperCase(), 1)));
      return { ...r, taille, largeur: largeurAnton(textes.join(" ").toUpperCase(), taille) };
    });
  };
  const total = (rs: Omit<Rangee, "y">[]) => rs.reduce((s, r) => s + r.taille * (1 + INTERLIGNE), 0) - (rs.at(-1)?.taille ?? 0) * INTERLIGNE + 18; // + le filet sous la dernière rangée (lignes.tsx : taille + 12, 6 px de haut)
  let taille = tailleMax;
  let rs = couper(taille);
  while (taille > 70 && total(rs) > hauteur) {
    taille -= 6;
    rs = couper(taille);
  }
  // Répartition : l'air restant est partagé entre les rangées (au plus ECART_MAX_RANGEES × taille de plus par écart).
  const reste = Math.max(0, hauteur - total(rs));
  const ecart = rs.length > 1 ? Math.min(reste / (rs.length - 1), taille * ECART_MAX_RANGEES) : 0;
  let y = haut + Math.max(0, (hauteur - total(rs) - ecart * Math.max(0, rs.length - 1)) / 2);
  return rs.map((r) => {
    const posee = { ...r, y };
    y += r.taille * (1 + INTERLIGNE) + ecart;
    return posee;
  });
}
