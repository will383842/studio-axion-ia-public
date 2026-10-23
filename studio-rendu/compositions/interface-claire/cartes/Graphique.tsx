import React from "react";
/**
 * CARTE GRAPHIQUE — « Graphique en barres » (redessinée le 15/10/2026, standard premium, designer n° 2).
 *
 * Composition : axe de base en filet encre (0,003 L) et 3 repères pointillés ; barres larges (gouttière 0,04 L) :
 * la barre accent en dégradé orange-chaud → orange-profond (le seul héros, avec relief), les autres en sable-clair à
 * chapeau sable-profond. Valeur au-dessus de la barre en titre (SEULEMENT si le script la fournit), libellé dessous en
 * corps. La barre en cours est marquée d'un CHEVRON orange (fini la colonne pleine hauteur qui se lisait comme une
 * 3ᵉ barre). La mention devient le tampon EXEMPLE standard. Les pastilles deviennent un trait de tendance qui se dessine
 * sur les sommets, puis une rangée de conclusions dont la dernière est une étiquette.
 *
 * Mouvement : N1 la base se trace (« glisse ») ; N2 chaque barre pousse en « pose » (0,22 s, ancrée à la base, ≈ 4 %
 * de dépassement) pendant que sa valeur compte, avec un flash orange de sa travée (≥ 5 % de l'image) ; chaque
 * conclusion glisse de 0,03 L sur son mot avec un flash de sa rangée ; N3 le chevron oscille au-dessus de la barre.
 * Les hauteurs sont des PROPORTIONS D'AFFICHAGE (0 → 1) : aucun chiffre n'est inventé. Pur : tout dérive de `t`.
 */
import { Icone } from "../elements";
import { alpha, degradeOrange, eclat, filetPx, fonduEntree, glisse, Grain, hauteurTampon, largeurCorps, largeurCorpsCarte, largeurTitre, NUANCES, pose, reflet, styleCorps, styleHeros, styleTitre, tailleQuiTient, TamponExemple, TYPO } from "../variantes/premium-2";

export type BarreGraphique = {
  /** Hauteur d'affichage, proportion de la hauteur utile (0 → 1). Ce n'est PAS une donnée. */
  hauteur: number;
  /** Instant (s) du mot sur lequel la barre pousse. */
  a: number;
  /** Libellé sous la barre (« S1 », « Lun »…), facultatif. */
  libelle?: string;
  /** Barre pleine orange (mise en avant, ex. la dernière). */
  accent?: boolean;
  /** Valeur qui défile en haut de la barre : UNIQUEMENT si le script la fournit (jamais inventée). */
  compteur?: { jusqua: number; suffixe?: string; decimales?: number };
};

export type PastilleGraphique = { texte: string; /** Nom d'icône d'`elements.tsx` (`NOMS_ICONES`). */ icone?: string; a: number };

export type GraphiqueProps = {
  /** Temps courant (secondes, même horloge que la carte). */
  t: number;
  largeurImage: number;
  /** Taille de ligne de référence (pixels, ≈ 0,05 × hauteur de l'image) : textes, pastilles, marges. */
  hauteurLigne: number;
  /** Hauteur de la zone des barres (pixels), ligne de base comprise. */
  hauteurGraphique: number;
  /** Instant où la ligne de base (et les filets) se dessinent, avant la 1ʳᵉ barre. */
  baseA: number;
  barres: BarreGraphique[];
  /** Une pastille par mot, sous le graphique. */
  pastilles?: PastilleGraphique[];
  /** Petite mention (ex. « Illustration ») : affichée comme le tampon EXEMPLE standard. */
  mention?: string;
};

/** Hauteur du contenu (pixels) pour dimensionner la `<Carte>`. */
export function hauteurGraphique(hauteurLigne: number, hauteurZone: number, avecLibelles: boolean, avecPastilles: boolean): number {
  return hauteurZone + (avecLibelles ? hauteurLigne * 0.45 : 0) + (avecPastilles ? hauteurLigne * 1.25 : 0);
}

const POUSSE = 0.22;

const formatValeur = (v: number, d: number) => v.toFixed(d).replace(".", ",");

export function Graphique(p: GraphiqueProps) {
  const { t, hauteurLigne: h, largeurImage: W } = p;
  const n = Math.max(1, p.barres.length);
  const largeur = largeurCorpsCarte(W);
  const fil = filetPx(W);
  const avecLibelles = p.barres.some((b) => b.libelle);
  const avecPastilles = !!p.pastilles?.length;
  const total = hauteurGraphique(h, p.hauteurGraphique, avecLibelles, avecPastilles);

  // Rangées : tampon (si mention ou valeurs), zone des barres, libellés, conclusions.
  const avecTampon = !!p.mention || p.barres.some((b) => b.compteur);
  const hLibelles = avecLibelles ? W * 0.045 : 0;
  const hConclusions = avecPastilles ? Math.max(W * 0.075, h * 0.85) : 0;
  const hZone = total - hLibelles - hConclusions - (avecPastilles ? W * 0.012 : 0);
  const tTitre = W * TYPO.titre;
  const avecValeurs = p.barres.some((b) => b.compteur);
  const reserveHaut = Math.max(avecTampon ? hauteurTampon(W) : 0, avecValeurs ? tTitre * 1.15 + W * 0.03 : W * 0.058);
  const utile = hZone - reserveHaut;

  // Barres larges : gouttière 0,04 L (réduite au-delà de 5 barres), largeur plafonnée à 0,17 L.
  const gouttiere = n > 5 ? W * 0.024 : W * 0.04;
  const lBarre = Math.min(W * 0.17, (largeur - gouttiere * (n + 1)) / n);
  const pas = lBarre + gouttiere;
  const x0 = (largeur - (n * lBarre + (n - 1) * gouttiere)) / 2;
  const cx = (i: number) => x0 + i * pas + lBarre / 2;

  const base = glisse(t, p.baseA, 0.2);
  const parues = p.barres.map((b) => t >= b.a);
  const enCours = p.barres.reduce((k, b, i) => (t >= b.a && (k < 0 || b.a >= p.barres[k].a) ? i : k), -1);
  const aAccent = p.barres.some((b) => b.accent);
  const plusHaute = p.barres.reduce((k, b, i) => (b.hauteur > p.barres[k].hauteur ? i : k), 0);
  const estAccent = (i: number) => (aAccent ? !!p.barres[i].accent : i === plusHaute);
  const tousLa = p.barres.every((b) => t >= b.a);
  // Chevron : sur la barre en cours ; quand toutes sont là, il rejoint la barre accent (« glisse »).
  const accentI = p.barres.findIndex((_, i) => estAccent(i));
  const dernierA = Math.max(...p.barres.map((b) => b.a));
  const cible = tousLa ? accentI : enCours;
  const versAccent = tousLa ? glisse(t, dernierA + 0.3, 0.2) : 0;
  const xChevron = enCours < 0 ? 0 : cx(enCours) + (cx(accentI) - cx(enCours)) * versAccent;
  const hauteurBarre = (i: number) => Math.max(0, Math.min(1, p.barres[i].hauteur)) * utile;
  const hChevronBarre = enCours < 0 ? 0 : hauteurBarre(enCours) + (hauteurBarre(accentI) - hauteurBarre(enCours)) * versAccent;

  // Flash N2 de la travée de la barre qui pousse (au moins 34 % de la largeur, bornée à la zone).
  const flashBarre = eclat(t, p.barres.map((b) => b.a));
  const lTravee = Math.max(pas, largeur * 0.34);
  const xTravee = enCours < 0 ? 0 : Math.max(0, Math.min(largeur - lTravee, cx(enCours) - lTravee / 2));

  // Conclusions : trait de tendance au 1er mot, rangée d'items, la dernière en étiquette (héros si aucune barre accent).
  const pastilles = p.pastilles ?? [];
  const trait = pastilles.length ? glisse(t, pastilles[0].a, 0.3) : 0;
  const flashConcl = eclat(t, pastilles.map((x) => x.a));
  const sommets = p.barres.map((_, i) => ({ x: cx(i), y: reserveHaut + utile - hauteurBarre(i) - W * 0.012 }));
  let longueur = 0;
  for (let i = 1; i < sommets.length; i++) longueur += Math.hypot(sommets[i].x - sommets[i - 1].x, sommets[i].y - sommets[i - 1].y);

  // Libellés : corps (jamais sous 26 px), ajustés à la largeur d'une barre + gouttière.
  const tLib = tailleQuiTient(W * TYPO.corps, W * TYPO.minimum, pas - W * 0.008, (x) => Math.max(1e-6, ...p.barres.map((b) => largeurCorps(b.libelle ?? "", x))));

  const rayon = W * 0.012;
  const oscille = Math.sin(t * 2 * Math.PI * 1.6) * W * 0.006;

  return (
    <div style={{ position: "relative", width: "100%", height: total }}>
      {/* Zone des barres : surface plate, grain, flash de travée. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: hZone + hLibelles, borderRadius: rayon, overflow: "hidden", background: NUANCES.ivoire, boxShadow: `inset 0 0 0 ${fil}px ${NUANCES.filet}` }}>
        {flashBarre > 0 && enCours >= 0 ? <div style={{ position: "absolute", left: xTravee, width: lTravee, top: 0, bottom: 0, background: NUANCES.orange, opacity: flashBarre, borderRadius: rayon }} /> : null}
        <Grain rayon={rayon} />
      </div>

      {/* Trois repères en pointillés (filet), qui se déroulent avec la base. */}
      {[0.25, 0.5, 0.75].map((f) => (
        <div key={f} style={{ position: "absolute", left: 0, top: reserveHaut + utile * (1 - f), width: largeur * base, borderTop: `${fil}px dashed ${NUANCES.filet}` }} />
      ))}

      {avecTampon ? <TamponExemple t={t} a={p.baseA} W={W} style={{ position: "absolute", right: W * 0.01, top: W * 0.008 }} /> : null}

      {/* Barres : chacune pousse en « pose » sur son mot, ancrée à la base. */}
      {p.barres.map((b, i) => {
        if (!parues[i]) return null;
        const e = pose(t, b.a, POUSSE, 0.04);
        const hb = hauteurBarre(i) * Math.max(0, e);
        const accent = estAccent(i);
        const allume = flashBarre > 0.5 && i === enCours;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x0 + i * pas,
                width: lBarre,
                top: reserveHaut + utile - hb,
                height: hb,
                borderRadius: `${W * 0.01}px ${W * 0.01}px 0 0`,
                background: accent ? degradeOrange : NUANCES.sableClair,
                ...(accent && aAccent ? { ...styleHeros(W), borderBottom: "none" } : accent ? { boxShadow: reflet(W) } : { boxShadow: `inset 0 ${Math.max(3, W * 0.004)}px 0 ${NUANCES.sableProfond}` }),
                overflow: "hidden",
              }}
            >
              {accent ? <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${alpha(NUANCES.ivoire, 0.1)} 0%, ${alpha(NUANCES.ivoire, 0)} 45%)`, boxShadow: reflet(W) }} /> : null}
            </div>
            {b.compteur ? (
              <div style={{ position: "absolute", left: cx(i) - pas / 2, width: pas, top: reserveHaut + utile - hb - tTitre * 1.15 - W * 0.006, textAlign: "center", ...styleTitre(tailleQuiTient(tTitre, W * TYPO.minimum, pas, (x) => largeurTitre(formatValeur(b.compteur!.jusqua, b.compteur!.decimales ?? 0) + (b.compteur!.suffixe ?? ""), x)), allume ? NUANCES.ivoire : accent ? NUANCES.orange : NUANCES.encre), fontVariantNumeric: "tabular-nums" }}>
                {formatValeur(b.compteur.jusqua * Math.min(1, Math.max(0, e)), b.compteur.decimales ?? 0)}
                {b.compteur.suffixe ?? ""}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}

      {/* Chevron orange au-dessus de la barre en cours (N3 : oscille). Masqué si une valeur occupe le sommet. */}
      {enCours >= 0 && !p.barres[cible]?.compteur ? (
        <div style={{ position: "absolute", left: xChevron - W * 0.022, top: reserveHaut + utile - hChevronBarre - W * 0.05 + oscille, width: W * 0.044, height: W * 0.03, opacity: fonduEntree(t, p.barres[enCours].a) }}>
          <svg width="100%" height="100%" viewBox="0 0 44 30">
            <path d="M4 6 L22 24 L40 6" fill="none" stroke={flashBarre > 0.5 ? NUANCES.ivoire : NUANCES.orange} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}

      {/* Trait de tendance : se dessine sur les sommets au 1er mot de conclusion. */}
      {trait > 0 ? (
        <svg style={{ position: "absolute", left: 0, top: 0, width: largeur, height: hZone, overflow: "visible", pointerEvents: "none" }}>
          <polyline points={sommets.map((s) => `${s.x},${s.y}`).join(" ")} fill="none" stroke={NUANCES.encre} strokeWidth={Math.max(3, W * 0.004)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={longueur} strokeDashoffset={longueur * (1 - trait)} />
          {sommets.map((s, i) => (trait * longueur >= sommets.slice(1, i + 1).reduce((m, q, k) => m + Math.hypot(q.x - sommets[k].x, q.y - sommets[k].y), 0) ? <circle key={i} cx={s.x} cy={s.y} r={W * 0.007} fill={NUANCES.ivoire} stroke={NUANCES.encre} strokeWidth={Math.max(3, W * 0.003)} /> : null))}
        </svg>
      ) : null}

      {/* Ligne de base : filet encre de 0,003 L qui se trace de gauche à droite. */}
      <div style={{ position: "absolute", left: 0, top: reserveHaut + utile - Math.max(2, W * 0.0015), width: largeur * base, height: Math.max(3, W * 0.003), background: NUANCES.encre, borderRadius: 2 }} />

      {/* Libellés sous les barres (corps). */}
      {avecLibelles
        ? p.barres.map((b, i) => (
            <div key={`l${i}`} style={{ position: "absolute", left: cx(i) - pas / 2, width: pas, top: hZone + (hLibelles - tLib * 1.15) / 2, textAlign: "center", ...styleCorps(tLib, parues[i] ? (flashBarre > 0.5 && i === enCours ? NUANCES.ivoire : estAccent(i) ? NUANCES.orange : NUANCES.encre) : NUANCES.sableProfond), opacity: base }}>
              {b.libelle ?? ""}
            </div>
          ))
        : null}

      {/* Conclusions : une par mot, séparées de filets ; la dernière est l'étiquette finale. */}
      {avecPastilles ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: hConclusions, display: "flex", alignItems: "center", justifyContent: "space-evenly", borderTop: `${fil}px solid ${NUANCES.filet}` }}>
          {flashConcl > 0 ? <div style={{ position: "absolute", left: 0, right: 0, top: -W * 0.012, bottom: 0, background: NUANCES.orange, opacity: flashConcl, borderRadius: rayon }} /> : null}
          {pastilles.map((x, i) => (
            <Conclusion key={x.texte + i} t={t} pastille={x} derniere={i === pastilles.length - 1 && pastilles.length > 1} W={W} allume={flashConcl > 0.5} largeurMax={(largeur - W * 0.02 * (pastilles.length + 1)) / pastilles.length} heros={!aAccent && i === pastilles.length - 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Une conclusion : icône nue + texte en corps ; la dernière dans une étiquette encre. */
function Conclusion({ t, pastille: x, derniere, W, allume, largeurMax, heros }: { t: number; pastille: PastilleGraphique; derniere: boolean; W: number; allume: boolean; largeurMax: number; heros: boolean }) {
  if (t < x.a) return <div style={{ width: 1 }} />;
  const e = glisse(t, x.a, 0.18);
  const icone = W * 0.04;
  const pad = derniere ? W * 0.022 : 0;
  const taille = tailleQuiTient(W * TYPO.corps, W * TYPO.minimum, largeurMax - 2 * pad - (x.icone ? icone + W * 0.01 : 0), (s) => largeurCorps(x.texte, s));
  const couleur = derniere ? NUANCES.ivoire : allume ? NUANCES.ivoire : NUANCES.encre;
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: W * 0.01,
        padding: derniere ? `${W * 0.012}px ${pad}px` : 0,
        borderRadius: 999,
        background: derniere ? NUANCES.encre : "transparent",
        ...(derniere ? (heros ? styleHeros(W) : { boxShadow: reflet(W) }) : {}),
        opacity: fonduEntree(t, x.a),
        transform: `translateX(${(1 - e) * -W * 0.03}px)`,
      }}
    >
      {x.icone ? <Icone nom={x.icone} taille={icone} couleur={derniere ? NUANCES.orangeVoile : allume ? NUANCES.ivoire : NUANCES.orange} epaisseur={2.4} /> : null}
      <span style={styleCorps(taille, couleur)}>{x.texte}</span>
    </div>
  );
}

/**
 * Exemple pour la galerie : la régularité de publication d'une PME, semaine après semaine. Hauteurs = proportions
 * d'affichage ; aucun compteur (aucun chiffre présenté comme résultat) ; tampon EXEMPLE.
 */
export const EXEMPLE_GRAPHIQUE = {
  titre: "Statistiques",
  iconeTitre: "graphique",
  baseA: 0.25,
  barres: [
    { hauteur: 0.3, a: 0.45, libelle: "S1" },
    { hauteur: 0.42, a: 0.65, libelle: "S2" },
    { hauteur: 0.55, a: 0.85, libelle: "S3" },
    { hauteur: 0.68, a: 1.05, libelle: "S4" },
    { hauteur: 0.95, a: 1.3, libelle: "S5", accent: true },
  ],
  pastilles: [
    { texte: "Portée", icone: "tendance", a: 1.9 },
    { texte: "Engagement", icone: "coeur", a: 2.25 },
    { texte: "Abonnés", icone: "utilisateurs", a: 2.6 },
  ],
  mention: "Illustration",
} satisfies Omit<GraphiqueProps, "t" | "largeurImage" | "hauteurLigne" | "hauteurGraphique"> & { titre: string; iconeTitre: string };
