import React from "react";
/**
 * CARTE « PILE D'OUTILS » (redessinée le 15/10/2026, designer n° 3 — standard premium).
 *
 * Référence (planche_11 4,25 s → planche_12 1,75 s) : la carte « Ma stack » ; les outils s'ajoutent un à un sur les
 * mots, le compteur change (« 6 outils montrés » → « 10 au quotidien »), des outils sous cadenas complètent.
 * Composition : le COMPTEUR est le héros (chiffre tambour jusqu'à 0,15 L, à gauche, légende en titre à sa droite) ;
 * dessous, un ÉVENTAIL de tuiles d'application (dégradé ivoire → ivoire-creux, micro-ombre, icône orange nue,
 * chevauchement de 30 %) et, à son bout, le PAQUET des outils sous cadenas (dalles encre empilées, « +n » sur le dessus) —
 * les tuiles gardent ainsi leur taille, quel que soit leur nombre ; le cadenas devient un BANDEAU D'ALERTE encre pleine
 * largeur, en bas.
 * Mouvement : chaque tuile TOMBE sur la pile (claque, flash orange de 0,16 s), la rangée s'écrase de 2 % et les tuiles du dessous se tassent de
 * 4 px (suivi) ; le compteur roule ; le bandeau glisse du bas (0,18 s) et remonte le haut de la carte ; N3 : la tuile
 * du dessus oscille de 1°, le point du bandeau respire.
 * Props, exports et `hauteurPileLogos` INCHANGÉS (plans, `VideoAnimee.tsx`, `cadrage.ts`).
 */
import { Icone } from "../elements";
import { bosse, ChiffreRoulant, claque, DEGRADE, encreA, filet, fondu, glisse, ivoireA, microOmbre, N3, nbChiffres, Reflet, respire, styleCorps, styleTitre, typo } from "../variantes/premium-3";

export type TuileOutil = {
  /** Nom d'icône de `elements.tsx` (NOMS_ICONES) ; sinon `initiales`. */
  icone?: string;
  /** 1 à 3 lettres affichées si pas d'icône (outil sans logo dessiné). */
  initiales?: string;
  /** Tuile sombre à petit cadenas (outil « à venir », non montré). */
  verrouillee?: boolean;
  /** Instant (s) du mot qui la nomme. */
  a: number;
};

export type EtatCompteur = {
  /** Valeur affichée (entier positif). */
  valeur: number;
  /** Légende sous le chiffre (« outils montrés »). */
  legende: string;
  /** Instant (s) où le chiffre roule vers cette valeur. */
  a: number;
};

export type PileLogosProps = {
  /** Temps courant (secondes). */
  t: number;
  largeurImage: number;
  /** Largeur disponible dans la carte (px). */
  largeur: number;
  /** Unité de base (px) : côté de référence d'une tuile (la mise en page en déduit la hauteur du composant). */
  taille: number;
  /** Gardé pour la compatibilité des plans (l'éventail n'a plus de colonnes). */
  colonnes?: number;
  /** États successifs du compteur (le premier arrive, les suivants roulent). */
  compteur: EtatCompteur[];
  tuiles: TuileOutil[];
  /** Bandeau d'alerte (ex-cadenas) : glisse du bas à `a`. `texte` = message du bandeau. */
  cadenas?: { a: number; texte?: string };
};

const ECART = 0.22;
const H_TITRE = 1.25;

/** Hauteur occupée par le composant (px), pour dimensionner la `<Carte>` (formule inchangée : la mise en page en dépend). */
export function hauteurPileLogos(taille: number, nbTuiles: number, colonnes = 5) {
  const rangees = Math.max(1, Math.ceil(nbTuiles / colonnes));
  return taille * (H_TITRE + ECART * 1.5) + rangees * taille + (rangees - 1) * taille * ECART + taille * 0.15;
}

/** Durée de chute d'une tuile (s). */
const CHUTE = 0.12;

export function PileLogos(p: PileLogosProps) {
  const W = p.largeurImage;
  const t = p.t;
  const ty = typo(W);
  const hTotal = hauteurPileLogos(p.taille, p.tuiles.length, p.colonnes ?? 5);
  const L = p.largeur;
  const gout = Math.round(W * 0.02);

  // Bandeau d'alerte en bas. Avant lui, le haut est centré dans toute la hauteur ; quand il arrive, le haut remonte en
  // glisse (la carte reste pleine à chaque instant).
  const hBandeau = p.cadenas ? Math.round(W * 0.078) : 0;
  const placeBandeau = p.cadenas ? hBandeau + gout : 0;
  const hHaut = hTotal - placeBandeau;
  const eB = p.cadenas ? glisse(t, p.cadenas.a, 0.18) : 0;
  const yHaut = (placeBandeau / 2) * (1 - eB);

  // Rangée A : compteur héros (tambour) + légende en titre.
  const i = p.compteur.filter((c) => t >= c.a).length - 1;
  const cur = i >= 0 ? p.compteur[i] : undefined;
  const prec = i > 0 ? p.compteur[i - 1] : undefined;
  const chiffres = nbChiffres(Math.max(1, ...p.compteur.map((c) => c.valeur)));
  const valeur = cur ? (prec ? prec.valeur : 0) + (cur.valeur - (prec ? prec.valeur : 0)) * glisse(t, cur.a, prec ? 0.4 : 0.32) : 0;
  const tailleHeros = Math.round(Math.min(W * 0.15, hHaut * 0.42));
  const hA = Math.round(tailleHeros * 1.02);
  const lChiffre = Math.round(tailleHeros * 0.66 * Math.max(1, nbChiffres(Math.max(1, valeur))));
  const e0 = cur ? claque(t, p.compteur[0].a, 0.12) : 0;
  const coupCompteur = cur && prec ? bosse(t, cur.a + 0.3, 0.12) : 0;
  const hLegende = Math.round(ty.titre * 2.3);

  // Rangée B : éventail des outils montrés + paquet des outils sous cadenas.
  const ecartRangs = Math.round(W * 0.03);
  const libres = p.tuiles.filter((u) => !u.verrouillee);
  const verrous = p.tuiles.filter((u) => u.verrouillee);
  const cote = Math.round(Math.max(W * 0.08, Math.min(W * 0.15, hHaut - hA - ecartRangs - W * 0.016)));
  const decalPaquet = cote * 0.09;
  const largeurPaquet = verrous.length ? cote + (verrous.length - 1) * decalPaquet : 0;
  const espacePaquet = verrous.length && libres.length ? Math.round(W * 0.035) : 0;
  const pas = libres.length > 1 ? Math.min(cote * 0.7, (L - cote - largeurPaquet - espacePaquet - W * 0.01) / (libres.length - 1)) : 0;
  const largeurEventail = libres.length ? cote + pas * (libres.length - 1) : 0;
  const hBloc = hA + ecartRangs + cote;
  const yA = Math.max(0, (hHaut - hBloc) / 2);
  const yB = yA + hA + ecartRangs;
  const xPaquet = largeurEventail + espacePaquet;
  // Suivi : la rangée s'écrase de 2 % à chaque tuile posée.
  const tasse = Math.min(1, p.tuiles.reduce((s, u) => s + bosse(t, u.a + CHUTE * 0.8, 0.1), 0));
  const tailleIcone = cote >= W * 0.12 ? W * 0.075 : W * 0.055;
  const dernierLibre = libres.filter((u) => t >= u.a).pop();
  const verrousPoses = verrous.filter((u) => t >= u.a);

  const chute = (u: TuileOutil) => {
    const e = claque(t, u.a, CHUTE);
    return { e, dy: -(1 - e) * W * 0.05, etire: 1 + 0.05 * Math.max(0, 1 - e), flash: t < u.a + CHUTE + 0.04 };
  };

  return (
    <div style={{ position: "relative", width: L, height: hTotal }}>
      <div style={{ position: "absolute", left: 0, top: yHaut, width: L, height: hHaut }}>
        {cur ? (
          <div style={{ position: "absolute", left: 0, top: yA, width: L, height: hA, opacity: fondu(t, p.compteur[0].a), transform: `translateY(${(1 - e0) * W * 0.04}px)` }}>
            <div style={{ position: "absolute", left: -Math.round(tailleHeros * 0.04), top: 0, transform: `scale(${1 + 0.04 * coupCompteur})`, transformOrigin: "0% 70%" }}>
              <ChiffreRoulant valeur={valeur} taille={tailleHeros} couleur={N3.encre} chiffres={chiffres} />
            </div>
            {/* Légende : l'ancienne glisse vers le haut, la nouvelle monte du bas. */}
            <div style={{ position: "absolute", left: lChiffre + Math.round(W * 0.03), right: 0, top: (hA - hLegende) / 2 + hA * 0.06, height: hLegende, overflow: "hidden" }}>
              {[prec, cur].map((etat, k) => {
                if (!etat) return null;
                const q = glisse(t, cur.a, 0.2);
                const dy = k === 0 ? -q * hLegende : prec ? (1 - q) * hLegende : 0;
                return (
                  <div key={k} style={{ position: "absolute", left: 0, right: 0, top: 0, height: hLegende, display: "flex", alignItems: "center", transform: `translateY(${dy}px)`, opacity: k === 0 ? 1 - q : 1 }}>
                    <span style={{ ...styleTitre(ty.titre, N3.encreDouce), lineHeight: 1.12 }}>{etat.legende}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Ombre portée de la rangée (posée sur la carte). */}
        {p.tuiles.some((u) => t >= u.a) ? <div style={{ position: "absolute", left: cote * 0.08, top: yB + cote * 0.94, width: Math.max(cote * 0.8, (verrousPoses.length ? xPaquet + largeurPaquet : largeurEventail) - cote * 0.16), height: cote * 0.12, borderRadius: "50%", background: encreA(0.1), filter: `blur(${Math.round(W * 0.007)}px)` }} /> : null}

        <div style={{ position: "absolute", left: 0, top: yB, width: L, height: cote, transform: `scaleY(${1 - 0.02 * tasse})`, transformOrigin: "50% 100%" }}>
          {/* Éventail : chevauchement de 30 %, légère rotation ; la tuile du dessus oscille de 1° (N3). */}
          {libres.map((u, j) => {
            if (t < u.a) return null;
            const c = chute(u);
            const dessus = u === dernierLibre;
            const sous = libres.slice(j + 1).reduce((s, v) => s + bosse(t, v.a + CHUTE * 0.8, 0.1), 0);
            const angle = (j - (libres.length - 1) / 2) * 2.5 + (dessus && t > u.a + CHUTE ? Math.sin((2 * Math.PI * (t - u.a - CHUTE)) / 1.3) : 0);
            return (
              <div
                key={`l${j}`}
                style={{
                  position: "absolute",
                  left: j * pas,
                  top: 0,
                  width: cote,
                  height: cote,
                  borderRadius: Math.round(cote * 0.24),
                  background: c.flash ? DEGRADE.orange : DEGRADE.ivoire,
                  border: c.flash ? undefined : filet(W),
                  boxSizing: "border-box",
                  boxShadow: `${microOmbre(W, 0.14)}, -${Math.round(W * 0.005)}px 0 ${Math.round(W * 0.01)}px ${encreA(0.09)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: fondu(t, u.a),
                  transform: `translateY(${c.dy + Math.min(1, sous) * 4}px) rotate(${angle}deg) scaleY(${c.etire})`,
                  transformOrigin: "50% 100%",
                }}
              >
                {c.flash ? <Reflet rayon={cote * 0.2} retrait={cote * 0.16} /> : null}
                {u.icone ? <Icone nom={u.icone} taille={tailleIcone} couleur={c.flash ? N3.ivoire : N3.orange} epaisseur={2.2} /> : <span style={{ ...styleTitre(ty.titre, c.flash ? N3.ivoire : N3.orange) }}>{u.initiales}</span>}
              </div>
            );
          })}
          {/* Paquet des outils sous cadenas : chaque tuile tombe sur le paquet, qui s'épaissit ; « +n » sur le dessus. */}
          {verrous.map((u, k) => {
            if (t < u.a) return null;
            const c = chute(u);
            const dessus = k === verrousPoses.length - 1;
            const sous = verrous.slice(k + 1).reduce((s, v) => s + bosse(t, v.a + CHUTE * 0.8, 0.1), 0);
            return (
              <div
                key={`v${k}`}
                style={{
                  position: "absolute",
                  left: xPaquet + k * decalPaquet,
                  top: -k * cote * 0.05,
                  width: cote,
                  height: cote,
                  borderRadius: Math.round(cote * 0.24),
                  background: c.flash ? DEGRADE.orange : DEGRADE.encre,
                  boxShadow: microOmbre(W, 0.16),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: fondu(t, u.a),
                  transform: `translateY(${c.dy + Math.min(1, sous) * 4}px) rotate(${2 - k * 1.2}deg) scaleY(${c.etire})`,
                  transformOrigin: "50% 100%",
                }}
              >
                <Reflet rayon={cote * 0.2} retrait={cote * 0.16} />
                {dessus ? <Icone nom="cadenas" taille={tailleIcone} couleur={c.flash ? N3.ivoire : N3.sableClair} epaisseur={2.2} /> : null}
                {dessus && verrousPoses.length > 1 ? (
                  <div style={{ position: "absolute", right: -Math.round(W * 0.014), top: -Math.round(W * 0.014), minWidth: Math.round(W * 0.05), height: Math.round(W * 0.05), borderRadius: 99, background: DEGRADE.orange, boxShadow: `0 0 0 ${Math.round(W * 0.004)}px ${N3.ivoire}`, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${Math.round(W * 0.008)}px`, boxSizing: "border-box" }}>
                    <span style={{ ...styleCorps(ty.corps, N3.ivoire), lineHeight: 1 }}>+{verrousPoses.length}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bandeau d'alerte : encre pleine largeur, reflet, icône et texte ivoire en corps ; point qui respire (N3). */}
      {p.cadenas && t >= p.cadenas.a ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: hTotal - hBandeau,
            width: L,
            height: hBandeau,
            borderRadius: Math.round(W * 0.014),
            background: DEGRADE.encre,
            boxShadow: microOmbre(W, 0.14),
            display: "flex",
            alignItems: "center",
            gap: Math.round(W * 0.018),
            padding: `0 ${Math.round(W * 0.03)}px`,
            boxSizing: "border-box",
            opacity: fondu(t, p.cadenas.a),
            transform: `translateY(${(1 - eB) * W * 0.05}px)`,
          }}
        >
          <Reflet rayon={8} retrait={10} />
          <Icone nom="cadenas" taille={W * 0.04} couleur={N3.orangeChaud} epaisseur={2.4} />
          <span style={{ ...styleCorps(Math.round(W * 0.03), N3.ivoire), flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.cadenas.texte ?? "La suite en privé"}</span>
          <div style={{ width: W * 0.014, height: W * 0.014, borderRadius: "50%", background: N3.orange, boxShadow: `0 0 0 ${Math.round(W * 0.006 * respire(t, 1.1))}px ${ivoireA(0.16)}` }} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Données d'exemple pour la galerie. ⚠️ Les nombres du compteur (4 → 8) sont des EXEMPLES neutres, pas un
 * inventaire réel : en production, le script fournit le vrai nombre d'outils montrés.
 */
export const EXEMPLE_PILE_LOGOS: Omit<PileLogosProps, "t" | "largeurImage" | "largeur" | "taille"> = {
  colonnes: 4,
  compteur: [
    { valeur: 4, legende: "outils montrés", a: 0.4 },
    { valeur: 8, legende: "outils au quotidien", a: 2.2 },
  ],
  tuiles: [
    { icone: "robot", a: 0.4 },
    { icone: "mail", a: 0.75 },
    { icone: "calendrier", a: 1.1 },
    { icone: "tableur", a: 1.45 },
    { verrouillee: true, a: 2.35 },
    { verrouillee: true, a: 2.45 },
    { verrouillee: true, a: 2.55 },
    { verrouillee: true, a: 2.65 },
  ],
  cadenas: { a: 3.0, texte: "La suite en privé" },
};
