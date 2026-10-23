import React from "react";
/**
 * CARTE « LE CALCUL » — « Ticket de calcul » (redessinée le 15/10/2026, standard premium, designer n° 2).
 *
 * Composition : deux colonnes de TICKET DE CAISSE, « Avant » sur ivoire-creux et « Après » sur ivoire, séparées d'un
 * filet pointillé. Lignes : libellé en corps, valeur tabulaire alignée à droite. Total après un double filet, en héros
 * (0,09 L). Sous les tickets, deux BARRES HORIZONTALES de comparaison (libellé, barre, valeur au bout) ; la barre
 * « après » est le seul élément en relief. Tampon EXEMPLE au bout des barres, qui ne chevauche rien.
 *
 * Mouvement : N2 chaque ligne « s'imprime » (glisse vers le bas de 0,015 L, fondu) pendant que sa colonne flashe en
 * orange (≥ 5 % de l'image) ; la valeur roule ; le double filet se trace, le total roule en tambour ; la rature est un
 * trait orange tracé en 0,12 s SOUS le total « avant », qui reste lisible et passe en sable-profond ; les barres
 * poussent de gauche à droite (« pose »). N3 un curseur d'impression pulse sur la ligne en cours, puis une accolade
 * souligne l'écart entre les deux barres et pulse.
 * Aucun chiffre en dur : tout vient des props. Exports `Rouleau`, `ralenti`, `bosse`, `nbChiffres` inchangés
 * (utilisés par PileLogos). Pur : tout dérive de `t`.
 */
import { POLICES } from "../charte";
import { progression } from "../mouvement";
import { degradeOrange, eclat, filetPx, fonduEntree, glisse, Grain, hauteurTampon, largeurCorps, largeurTampon, largeurTitre, NUANCES, pose, reflet, styleCorps, styleHeros, styleTitre, tailleQuiTient, TamponExemple, TYPO } from "../variantes/premium-2";

/** Ralenti de fin (le compteur freine en arrivant). */
export const ralenti = (p: number) => 1 - (1 - p) ** 3;

/** Bosse 0 → 1 → 0 sur `duree` à partir de `debut` (petit choc, pulsation). */
export const bosse = (t: number, debut: number, duree: number) => Math.sin(Math.PI * progression(t, debut, duree));

/** Nombre de chiffres de la partie entière (au moins 1). */
export const nbChiffres = (v: number) => Math.max(1, String(Math.round(Math.abs(v))).length);

/**
 * Rouleau de chiffres (compteur kilométrique) : chaque chiffre est une bande 0-9 qui défile verticalement ; la
 * retenue fait tourner le chiffre de gauche pendant que celui de droite passe de 9 à 0. Les chiffres de tête
 * s'ouvrent en largeur quand la valeur les atteint (aucun saut de mise en page). Valeurs entières positives.
 */
export function Rouleau({ valeur, taille, couleur, chiffres, police = POLICES.titre, milliers = true }: { valeur: number; taille: number; couleur: string; /** Nombre de chiffres réservés (celui de la plus grande valeur affichée). */ chiffres: number; police?: string; milliers?: boolean }) {
  const v = Math.max(0, valeur);
  const h = taille * 1.15;
  const lc = taille * 0.7;
  const colonnes = [];
  for (let k = chiffres - 1; k >= 0; k--) {
    const p10 = 10 ** k;
    let pos: number;
    if (k === 0) pos = v % 10;
    else {
      const base = Math.floor(v / p10);
      const reste = v - base * p10;
      pos = (base % 10) + Math.max(0, reste - (p10 - 1));
    }
    const visible = k === 0 ? 1 : Math.min(1, Math.max(0, v - (p10 - 1)));
    colonnes.push(
      <div key={k} style={{ width: lc * visible, height: h, overflow: "hidden", opacity: visible, marginRight: milliers && k > 0 && k % 3 === 0 ? taille * 0.2 * visible : 0 }}>
        <div style={{ transform: `translateY(${-pos * h}px)` }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((c, i) => (
            <div key={i} style={{ height: h, lineHeight: `${h}px`, textAlign: "center", fontFamily: police, fontSize: taille, color: couleur }}>
              {c}
            </div>
          ))}
        </div>
      </div>,
    );
  }
  return <div style={{ display: "flex", alignItems: "center" }}>{colonnes}</div>;
}

export type LigneCalcul = {
  /** Libellé (« Saisie des devis »). */
  libelle: string;
  /** Valeur de la ligne (entier positif, dans l'unité de la carte). */
  valeur: number;
  /** Instant (s) du mot qui la nomme : la ligne s'imprime et sa valeur roule. */
  a: number;
};

export type ColonneCalcul = {
  /** Titre de la colonne (« Avant », « Avec l'IA »…). */
  titre: string;
  /** Instant (s) où la colonne s'ouvre (son titre arrive). */
  a: number;
  lignes: LigneCalcul[];
  /** Libellé du total (« Total / mois »). */
  libelleTotal: string;
  /** Instant (s) où le double filet se trace et le total se calcule. */
  totalA: number;
  /** Total imposé par le script ; par défaut la somme des lignes. */
  total?: number;
  /** Instant (s) où la barre de comparaison pousse. */
  barreA?: number;
};

export type CalculProps = {
  /** Temps courant (secondes). */
  t: number;
  largeurImage: number;
  /** Largeur disponible dans la carte (px). */
  largeur: number;
  /** Unité de base (px) : sert au calcul de la hauteur (`hauteurCalcul`). */
  taille: number;
  avant: ColonneCalcul;
  apres: ColonneCalcul;
  /** Unité affichée après chaque nombre (« € », « h »…). */
  unite: string;
  /** Instant (s) où un trait orange vient barrer le total « avant ». */
  barreTotalAvantA?: number;
  /** « Exemple » : instant du tampon ; autre texte (« × 5 »…) : légende de l'accolade d'écart. */
  badge?: { texte: string; a: number };
  /** Hauteur maximale d'une barre (px) ; défaut 2,4 × taille (sert au calcul de la hauteur). */
  hauteurBarre?: number;
};

const H_TITRE = 0.72;
const H_LIGNE = 0.62;
const H_TRAIT = 0.16;
const H_TOTAL = 0.95;
const H_ESPACE = 0.3;

/** Hauteur occupée par le composant (px), pour dimensionner la `<Carte>`. */
export function hauteurCalcul(taille: number, nbLignesMax: number, hauteurBarre = taille * 2.4) {
  return taille * (H_TITRE + nbLignesMax * H_LIGNE + H_TRAIT + H_TOTAL + H_ESPACE) + hauteurBarre + taille * 0.2;
}

const totalDe = (c: ColonneCalcul) => c.total ?? c.lignes.reduce((s, l) => s + l.valeur, 0);
const formatNombre = (v: number) => Math.round(v).toLocaleString("fr-FR").replace(/ | /g, " ");

/** Géométrie commune aux deux tickets (px). */
type Grille = { W: number; l: number; hTab: number; hLigne: number; hFilet: number; hTotal: number; pad: number; tCorps: number; tValeur: number; tHeros: number; tTab: number };

function Ticket({ t, c, cote, g, unite, nbLignes, barreeA }: { t: number; c: ColonneCalcul; cote: "avant" | "apres"; g: Grille; unite: string; nbLignes: number; barreeA?: number }) {
  const { W } = g;
  const apres = cote === "apres";
  const ouverte = t >= c.a;
  const fil = filetPx(W);
  const total = totalDe(c);
  const instants = [c.a, ...c.lignes.map((l) => l.a), c.totalA, ...(barreeA !== undefined ? [barreeA] : [])];
  const flash = eclat(t, instants);
  const allume = flash > 0.5;
  const eOuvre = glisse(t, c.a, 0.18);
  const dites = c.lignes.filter((li) => t >= li.a).length;
  const active = t < c.totalA ? dites - 1 : -1;
  const double = glisse(t, c.totalA, 0.12);
  const vTotal = total * ralenti(progression(t, c.totalA + 0.04, 0.5));
  const rature = barreeA === undefined ? 0 : glisse(t, barreeA, 0.12);
  const couleurTotal = allume ? NUANCES.ivoire : apres ? NUANCES.orange : rature >= 1 ? NUANCES.sableProfond : NUANCES.encre;
  const chiffresTotal = nbChiffres(total);
  // Héros : 0,09 L, réduit s'il ne tient pas dans le ticket (le libellé de l'unité compris).
  const lHeros = (x: number) => chiffresTotal * x * 0.7 + Math.floor((chiffresTotal - 1) / 3) * x * 0.2 + x * 0.12 + largeurTitre(unite, x * 0.5);
  const tHeros = tailleQuiTient(g.tHeros, W * TYPO.titre * 1.5, g.l - 2 * g.pad, lHeros);
  const rayon = W * 0.012;
  if (!ouverte) return <div style={{ width: g.l }} />;
  return (
    <div
      style={{
        position: "relative",
        width: g.l,
        height: "100%",
        borderRadius: rayon,
        background: apres ? NUANCES.ivoire : NUANCES.ivoireCreux,
        boxShadow: apres ? `inset 0 0 0 ${fil}px ${NUANCES.filet}` : "none",
        overflow: "hidden",
        opacity: fonduEntree(t, c.a),
        transform: `translateY(${(1 - eOuvre) * -W * 0.02}px)`,
      }}
    >
      {flash > 0 ? <div style={{ position: "absolute", inset: 0, background: NUANCES.orange, opacity: flash }} /> : null}
      <Grain rayon={rayon} graine={apres ? 11 : 5} />
      <div style={{ position: "relative", padding: `0 ${g.pad}px` }}>
        {/* Onglet : titre de la colonne, filet dessous. */}
        <div style={{ height: g.hTab, display: "flex", alignItems: "center", borderBottom: `${fil}px solid ${allume ? NUANCES.ivoire : NUANCES.filet}`, boxSizing: "border-box" }}>
          <span style={styleTitre(tailleQuiTient(g.tTab, W * TYPO.minimum, g.l - 2 * g.pad, (x) => largeurTitre(c.titre, x)), allume ? NUANCES.ivoire : apres ? NUANCES.orange : NUANCES.encreDouce)}>{c.titre}</span>
        </div>
        {/* Lignes : chacune s'imprime sur son mot. */}
        {Array.from({ length: nbLignes }, (_, i) => {
          const li = c.lignes[i];
          if (!li || t < li.a) return <div key={i} style={{ height: g.hLigne }} />;
          const e = glisse(t, li.a, 0.15);
          const v = li.valeur * ralenti(progression(t, li.a + 0.03, 0.4));
          const tLib = tailleQuiTient(g.tCorps, W * TYPO.minimum, g.l - 2 * g.pad - g.tValeur * (nbChiffres(li.valeur) * 0.7 + 0.4) - largeurCorps(unite, g.tCorps) - W * 0.02, (x) => largeurCorps(li.libelle, x));
          return (
            <div key={i} style={{ height: g.hLigne, position: "relative", display: "flex", alignItems: "center", gap: W * 0.01, opacity: fonduEntree(t, li.a), transform: `translateY(${(1 - e) * -W * 0.015}px)` }}>
              {i === active ? <div style={{ position: "absolute", left: -g.pad * 0.6, top: "22%", bottom: "22%", width: Math.max(3, W * 0.004), borderRadius: 2, background: NUANCES.orange, opacity: 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 2.2)) }} /> : null}
              <span style={{ ...styleCorps(tLib, allume ? NUANCES.ivoire : NUANCES.encre), flex: 1, minWidth: 0 }}>{li.libelle}</span>
              <Rouleau valeur={v} taille={g.tValeur} couleur={allume ? NUANCES.ivoire : apres ? NUANCES.orange : NUANCES.encre} chiffres={nbChiffres(li.valeur)} />
              <span style={styleCorps(g.tCorps, allume ? NUANCES.ivoire : NUANCES.sableProfond)}>{unite}</span>
            </div>
          );
        })}
        {/* Double filet : se trace de gauche à droite. */}
        <div style={{ height: g.hFilet, display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.max(3, W * 0.004) }}>
          {[0, 1].map((k) => (
            <div key={k} style={{ height: Math.max(2, W * 0.002), width: `${100 * double}%`, background: allume ? NUANCES.ivoire : NUANCES.encre, borderRadius: 2 }} />
          ))}
        </div>
        {/* Total : libellé en corps, valeur en héros qui roule ; « avant » raturé par un trait orange SOUS les chiffres. */}
        <div style={{ height: g.hTotal, display: "flex", flexDirection: "column", justifyContent: "center", opacity: t >= c.totalA ? fonduEntree(t, c.totalA) : 0 }}>
          <span style={styleCorps(W * TYPO.corpsMin, allume ? NUANCES.ivoire : NUANCES.sableProfond)}>{c.libelleTotal}</span>
          <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: tHeros * 0.12, height: tHeros * 1.02, overflow: "visible" }}>
            {rature > 0 ? <div style={{ position: "absolute", left: -W * 0.006, top: tHeros * 0.5, width: lHeros(tHeros) * rature + W * 0.012, height: Math.max(8, W * 0.01), background: NUANCES.orange, borderRadius: 99, transform: "rotate(-4deg)", transformOrigin: "left center" }} /> : null}
            <div style={{ position: "relative", marginTop: -tHeros * 0.07 }}>
              <Rouleau valeur={vTotal} taille={tHeros} couleur={couleurTotal} chiffres={chiffresTotal} />
            </div>
            <span style={{ position: "relative", ...styleTitre(tHeros * 0.5, couleurTotal), textTransform: "none" }}>{unite}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Calcul(p: CalculProps) {
  const W = p.largeurImage;
  const nbLignes = Math.max(1, p.avant.lignes.length, p.apres.lignes.length);
  const total = hauteurCalcul(p.taille, nbLignes, p.hauteurBarre ?? p.taille * 2.4);
  const fil = filetPx(W);
  const ecart = W * 0.03;
  const l = (p.largeur - ecart) / 2;
  // Grille verticale : barres (2 rangées) en bas, tickets au-dessus ; le héros se réduit si les lignes manquent de place.
  const hBarres = W * 0.125;
  const espace = W * 0.016;
  const hTickets = total - hBarres - espace;
  const pad = W * 0.022;
  const hTab = W * 0.05;
  const hFilet = W * 0.02;
  const hLibTotal = W * TYPO.corpsMin * 1.2;
  const hLigneMin = W * 0.038;
  const tHeros = Math.max(W * 0.06, Math.min(W * TYPO.heros, (hTickets - hTab - hFilet - nbLignes * hLigneMin - hLibTotal - W * 0.014) / 1.08));
  const hTotal = hLibTotal + tHeros * 1.08 + W * 0.006;
  const hLigne = Math.max(W * 0.034, (hTickets - hTab - hFilet - hTotal - W * 0.008) / nbLignes);
  const tCorps = Math.min(W * TYPO.corps, hLigne * 0.72);
  const g: Grille = { W, l, hTab, hLigne, hFilet, hTotal, pad, tCorps, tValeur: Math.min(W * 0.036, hLigne * 0.78), tHeros, tTab: W * TYPO.titre };

  // Barres horizontales : [libellé][piste][valeur][tampon].
  const tA = totalDe(p.avant);
  const tB = totalDe(p.apres);
  const max = Math.max(tA, tB, 1e-9);
  const tLibBarre = W * TYPO.corps;
  const lLibelle = Math.min(W * 0.2, Math.max(largeurCorps(p.avant.titre, tLibBarre), largeurCorps(p.apres.titre, tLibBarre)) + W * 0.01);
  const tLibB = tailleQuiTient(tLibBarre, W * TYPO.minimum, lLibelle - W * 0.01, (x) => Math.max(largeurCorps(p.avant.titre, x), largeurCorps(p.apres.titre, x)));
  const tVal = W * TYPO.titre;
  const lValeur = Math.max(largeurTitre(`${formatNombre(tA)} ${p.unite}`, tVal), largeurTitre(`${formatNombre(tB)} ${p.unite}`, tVal)) + W * 0.012;
  const lTampon = largeurTampon(W) + W * 0.012;
  const gap = W * 0.014;
  const piste = Math.max(W * 0.1, p.largeur - lLibelle - lValeur - lTampon - 3 * gap);
  const hRang = (hBarres - W * 0.012) / 2;
  const epaisseur = Math.min(W * 0.036, hRang * 0.55);

  const instantsBarres = [p.avant.barreA, p.apres.barreA].filter((x): x is number => x !== undefined);
  const flashBarres = eclat(p.t, instantsBarres);
  const debutTampon = Math.min(p.avant.lignes[0]?.a ?? p.avant.a, p.badge && /^exemple$/i.test(p.badge.texte.trim()) ? p.badge.a : Infinity);
  const legende = p.badge && !/^exemple$/i.test(p.badge.texte.trim()) ? p.badge : undefined;

  const barre = (c: ColonneCalcul, v: number) => (c.barreA === undefined ? 0 : pose(p.t, c.barreA, 0.22, 0.04) * (v / max) * piste);
  const lA = barre(p.avant, tA);
  const lB = barre(p.apres, tB);
  const lesDeux = p.avant.barreA !== undefined && p.apres.barreA !== undefined && p.t >= Math.max(p.avant.barreA, p.apres.barreA) + 0.22;
  const texteEcart = legende ? legende.texte : `− ${formatNombre(Math.abs(tA - tB))} ${p.unite}`;
  const montrerEcart = lesDeux && (!legende || p.t >= legende.a);
  const pulse = 1 + 0.03 * Math.sin(p.t * 2 * Math.PI * 1.5);
  const lEcart = Math.abs(lA - lB);
  const tEcart = W * TYPO.corps;
  const ecartLisible = largeurCorps(texteEcart, tEcart) + W * 0.02 <= lEcart;

  const rangee = (c: ColonneCalcul, v: number, lg: number, apres: boolean, k: number) => {
    const vu = c.barreA !== undefined && p.t >= c.barreA;
    const allume = flashBarres > 0.5;
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: W * 0.008 + k * hRang, height: hRang, display: "flex", alignItems: "center", gap }}>
        <span style={{ ...styleCorps(tLibB, allume ? NUANCES.ivoire : apres ? NUANCES.encre : NUANCES.encreDouce), width: lLibelle }}>{c.titre}</span>
        <div style={{ position: "relative", width: piste, height: epaisseur }}>
          {/* Rail en creux, puis la barre qui pousse de gauche à droite. */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 99, background: allume ? "transparent" : NUANCES.ivoireCreux }} />
          {vu ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: epaisseur,
                width: Math.max(epaisseur, lg),
                borderRadius: 99,
                background: apres ? degradeOrange : NUANCES.encreDouce,
                ...(apres ? styleHeros(W) : { boxShadow: reflet(W) }),
              }}
            />
          ) : null}
        </div>
        <span style={{ ...styleTitre(tVal, allume ? NUANCES.ivoire : apres ? NUANCES.orange : NUANCES.encre), textTransform: "none", width: lValeur, textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: vu ? fonduEntree(p.t, c.barreA!) : 0 }}>
          {formatNombre(v * Math.min(1, ralenti(progression(p.t, c.barreA ?? 0, 0.3))))} {p.unite}
        </span>
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: p.largeur, height: total }}>
      {/* Tickets côte à côte, séparés d'un filet pointillé. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: p.largeur, height: hTickets, display: "flex", gap: ecart }}>
        <Ticket t={p.t} c={p.avant} cote="avant" g={g} unite={p.unite} nbLignes={nbLignes} barreeA={p.barreTotalAvantA} />
        <Ticket t={p.t} c={p.apres} cote="apres" g={g} unite={p.unite} nbLignes={nbLignes} />
      </div>
      {p.t >= p.avant.a ? <div style={{ position: "absolute", left: l + ecart / 2 - fil / 2, top: W * 0.01, height: (hTickets - W * 0.02) * glisse(p.t, p.avant.a, 0.2), borderLeft: `${fil}px dotted ${NUANCES.sableProfond}` }} /> : null}

      {/* Barres de comparaison. */}
      <div style={{ position: "absolute", left: 0, top: hTickets + espace, width: p.largeur, height: hBarres, borderRadius: W * 0.012 }}>
        {flashBarres > 0 ? <div style={{ position: "absolute", inset: 0, background: NUANCES.orange, opacity: flashBarres, borderRadius: W * 0.012 }} /> : null}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: fil, background: NUANCES.filet }} />
        {rangee(p.avant, tA, lA, false, 0)}
        {rangee(p.apres, tB, lB, true, 1)}
        {/* Accolade d'écart (N3 : pulse) sous la rangée « avant », de la fin de la barre la plus courte à la plus longue. */}
        {montrerEcart && lEcart > W * 0.03 ? (
          <div style={{ position: "absolute", left: lLibelle + gap + Math.min(lA, lB), width: lEcart, top: W * 0.008 + hRang * 0.5 + epaisseur / 2 + W * 0.006, height: hRang - epaisseur, transformOrigin: "50% 0%", transform: `scaleY(${pulse})`, opacity: fonduEntree(p.t, Math.max(p.avant.barreA!, p.apres.barreA!) + 0.22) }}>
            <svg width="100%" height={W * 0.02} viewBox={`0 0 ${lEcart} 20`} preserveAspectRatio="none" style={{ display: "block" }}>
              <path d={`M2 2 Q2 10 12 10 L${lEcart / 2 - 10} 10 Q${lEcart / 2} 10 ${lEcart / 2} 18 Q${lEcart / 2} 10 ${lEcart / 2 + 10} 10 L${lEcart - 12} 10 Q${lEcart - 2} 10 ${lEcart - 2} 2`} fill="none" stroke={NUANCES.orange} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        ) : null}
        {/* Légende de l'écart : sur la rangée « après », à droite de la barre courte, si elle y tient. */}
        {montrerEcart && ecartLisible && lB < lA ? (
          <div style={{ position: "absolute", left: lLibelle + gap + lB + W * 0.012, width: lEcart - W * 0.012, top: W * 0.008 + hRang, height: hRang, display: "flex", alignItems: "center", justifyContent: "center", ...styleCorps(tEcart, flashBarres > 0.5 ? NUANCES.ivoire : NUANCES.orangeProfond), transform: `scale(${pulse})` }}>
            {texteEcart}
          </div>
        ) : null}
        <TamponExemple t={p.t} a={debutTampon} W={W} style={{ position: "absolute", right: W * 0.006, top: (hBarres - hauteurTampon(W)) / 2 + W * 0.006 }} />
      </div>
    </div>
  );
}

/**
 * Données d'exemple pour la galerie. ⚠️ VALEURS D'EXEMPLE NEUTRES (10 / 2), NON RÉELLES et non sourcées : elles ne
 * servent qu'à voir le mouvement (tampon EXEMPLE). En production, chaque valeur vient du script, avec sa source.
 */
export const EXEMPLE_CALCUL: Omit<CalculProps, "t" | "largeurImage" | "largeur" | "taille"> = {
  unite: "h",
  avant: {
    titre: "Avant",
    a: 0.3,
    lignes: [
      { libelle: "Saisie des devis", valeur: 10, a: 0.5 },
      { libelle: "Relances clients", valeur: 10, a: 0.9 },
      { libelle: "Comptes rendus", valeur: 10, a: 1.3 },
    ],
    libelleTotal: "Total par mois",
    totalA: 1.7,
    barreA: 2.0,
  },
  apres: {
    titre: "Avec l'IA",
    a: 2.6,
    lignes: [
      { libelle: "Saisie des devis", valeur: 2, a: 2.8 },
      { libelle: "Relances clients", valeur: 2, a: 3.1 },
      { libelle: "Comptes rendus", valeur: 2, a: 3.4 },
    ],
    libelleTotal: "Total par mois",
    totalA: 3.7,
    barreA: 4.0,
  },
  barreTotalAvantA: 4.4,
  badge: { texte: "Exemple", a: 4.7 },
};
