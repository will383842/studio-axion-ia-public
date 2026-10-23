import React from "react";
/**
 * CARTE « CADRAN DE JOURNÉE » (`cadran-journee`) — version premium du designer n° 4 (15/10/2026), reprise du brouillon
 * n° 2. Quand : une journée type, des horaires, la répartition du temps (« le matin… l'après-midi… le soir »).
 *
 * Panneau qui COUVRE TOUT LE VISAGE (0,045 → 0,955 L, 0,10 → 0,575 H ; la prise ne bouge pas).
 * COMPOSITION (grille 4 colonnes, marges 0,04 L) :
 *  - en-tête : icône horloge nue + titre « Une journée type », clé de couleurs à droite (utile / subi) ;
 *  - à gauche, le CADRAN de 0,55 L : anneau de 12 h, graduations fines au quart d'heure, secteurs orange (temps utile)
 *    et sable (temps subi) ; au centre le TOTAL en héros (« 5 h ») avec « subies » et le tampon EXEMPLE ; repères
 *    8 h / 11 h / 14 h / 17 h à l'intérieur de l'anneau. AUCUN libellé posé sur l'anneau. Le cadran est le seul élément
 *    intérieur en relief (contour 0,003 L, ombre 0,005 L) ;
 *  - à droite, la LÉGENDE-LISTE alignée : pastille, activité (corps), durée (tabulaire), plage horaire ;
 *  - en bas, le RUBAN de la journée (8 h → 20 h) qui reprend les mêmes plages à plat.
 *  - N1 : le panneau tombe (chute du format) ; l'intérieur entre en cascade de 50 ms.
 *  - N2 : sur son mot, chaque secteur se REMPLIT dans le sens horaire (glisse 0,25 s) en même temps que sa ligne de
 *         légende (translation 0,03 L, éclat 0,16 s) et son segment du ruban ; la part arrive pleine depuis le centre puis
 *         se range dans l'anneau ; le total ROULE ; le cadran s'écrase de 2,5 % (suivi, 0,2 s).
 *  - N3 : l'aiguille tourne en continu sur la piste.
 */
import { animationCarte } from "../cadrage";
import { POLICES } from "../charte";
import { Icone } from "../elements";
import { ChiffreRoulant, DEGRADE_ORANGE, ECLAT, enEclat, entree, epFilet, glisse, Grain, N4, styleCoque, styleTitre, suivi, TABULAIRE, Tampon4, TYPO4 } from "./premium-4";

export type Activite = { texte: string; icone: string; de: number; a_heure: number; subi: boolean; a: number };

export type CadranJourneeProps = {
  t: number;
  largeurImage: number;
  hauteurImage: number;
  titre: string;
  /** Entrée et sortie du panneau (s). Par défaut : entre à 0, ne sort pas. */
  debut?: number;
  fin?: number;
  /** Heure du haut du cadran (8 par défaut : un tour complet = 12 h, de 8 h à 20 h). */
  heureDebut?: number;
  activites: Activite[];
  legende?: { utile: string; subi: string };
  /** Mot sous le total des heures subies (par défaut « subies »). */
  libelleTotal?: string;
  /** Tampon « EXEMPLE » (horaires d'exemple) : instant d'apparition ; par défaut avec le premier secteur. */
  exempleA?: number;
};

/** Emprise du panneau (fractions de l'image) : couvre tout le visage, cheveux → menton, oreilles comprises. */
export const CADRAGE_CADRAN = Object.freeze({ x0: 0.045, x1: 0.955, y0: 0.1, y1: 0.575, couvreVisage: true });

/** Exemple : « Le matin, les e-mails ; l'après-midi, les devis ; le soir, la facturation. » (horaires d'exemple). */
export const EXEMPLE_CADRAN_JOURNEE = {
  phrase: "Le matin, les e-mails ; l'après-midi, les devis ; le soir, la facturation.",
  duree: 4.4,
  debut: 0,
  fin: 4.6,
  mots: [
    { texte: "Le", a: 0.0 },
    { texte: "matin,", a: 0.15, fort: true },
    { texte: "les", a: 0.6 },
    { texte: "e-mails ;", a: 0.7, fort: true },
    { texte: "l'après-midi,", a: 1.3, fort: true },
    { texte: "les", a: 1.85 },
    { texte: "devis ;", a: 1.95, fort: true },
    { texte: "le", a: 2.5 },
    { texte: "soir,", a: 2.6, fort: true },
    { texte: "la", a: 3.05 },
    { texte: "facturation.", a: 3.15, fort: true },
  ],
  titre: "Une journée type",
  activites: [
    { texte: "E-mails", icone: "mail", de: 8, a_heure: 10, subi: true, a: 0.7 },
    { texte: "Devis", icone: "document", de: 13, a_heure: 17, subi: false, a: 1.95 },
    { texte: "Facturation", icone: "euro", de: 17, a_heure: 20, subi: true, a: 3.15 },
  ],
  legende: { utile: "Utile", subi: "Subi" },
  libelleTotal: "subies",
};

/** Instants représentatifs : construction (2 secteurs) et cadran complet. */
export const INSTANT_CONSTRUCTION_CADRAN = 2.3;
export const INSTANT_FIXE_CADRAN = 3.8;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Secteur d'anneau (SVG) de `a0` à `a1` degrés (0° = 3 h, sens horaire), rayons `r0` < `r1`, centre (cx, cy). */
function anneau(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const grand = a1 - a0 > 180 ? 1 : 0;
  const p = (r: number, a: number) => `${(cx + r * Math.cos(rad(a))).toFixed(2)} ${(cy + r * Math.sin(rad(a))).toFixed(2)}`;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${grand} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${grand} 0 ${p(r0, a0)} Z`;
}

const heureTexte = (h: number) => `${Math.floor(h)} h${h % 1 ? String(Math.round((h % 1) * 60)).padStart(2, "0") : ""}`;

export function CadranJournee(p: CadranJourneeProps) {
  const debut = p.debut ?? 0;
  const fin = p.fin ?? Number.POSITIVE_INFINITY;
  const t = p.t;
  if (t < debut || t >= fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const C = CADRAGE_CADRAN;
  const an = animationCarte(t, debut, Number.isFinite(fin) ? fin : 1e9, { x0: C.x0, x1: C.x1, y0: C.y0, y1: C.y1 }, "chute");
  const l = (C.x1 - C.x0) * W;
  const h = (C.y1 - C.y0) * H;
  const pad = 0.04 * W;
  const contour = Math.max(3, Math.round(0.0045 * W));
  const li = l - 2 * contour - 2 * pad;
  const corps = TYPO4.corps * W;
  const filet = epFilet(W);
  const h0 = p.heureDebut ?? 8;
  const angle = (heure: number) => (heure - h0) * 30 - 90;
  const acts = p.activites;

  // Instants : chaque secteur se remplit en 0,25 s ; il se « pose » à a + 0,25 (suivi du cadran).
  const REMPLI = 0.25;
  // Suivi : le cadran s'écrase de 2,5 % pendant 0,2 s quand la part tombe dessus.
  const s = suivi(t, acts.map((x) => x.a), 0.025, 0.2);

  // Cascade d'entrée de l'intérieur (50 ms).
  const c0 = debut + 0.08;
  const eTete = entree(t, c0, 0.2);
  const eCadran = entree(t, c0 + 0.05, 0.22);
  const eRuban = entree(t, c0 + 0.1, 0.2);
  const dy = 0.02 * W;

  // Cadran.
  const D = 0.55 * W;
  const R = D / 2;
  const rPisteExt = R * 0.86;
  const rPisteInt = R * 0.64;
  const cH = Math.max(2, Math.round(0.003 * W));
  const oH = Math.max(3, Math.round(0.005 * W));
  const total = acts.filter((x) => x.subi).reduce<[number, number][]>((acc, x) => [...acc, [x.a + 0.06, (acc.length ? acc[acc.length - 1][1] : 0) + (x.a_heure - x.de)]], []);
  // N3 : aiguille continue (un tour en 9 s), sur la piste seulement (ne croise jamais le total).
  const angleAiguille = -90 + ((t - debut) / 9) * 360;

  // Légende.
  const xLegende = D + 0.03 * W;
  const lLegende = li - xLegende;

  const hTete = 0.06 * W;
  const hRuban = 0.075 * W;

  return (
    <div
      style={{
        position: "absolute",
        left: C.x0 * W,
        top: C.y0 * H,
        width: l,
        height: h,
        transform: `translate(${an.dx * W}px, ${an.dy * H}px) rotate(${an.rotation}deg) scale(${an.echelle})`,
        transformOrigin: "50% 0%",
        ...styleCoque(W),
        overflow: "hidden",
      }}
    >
      <Grain id="cj4-grain" />
      <div style={{ position: "absolute", inset: 0, padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {/* ---------------- En-tête ---------------- */}
        <div style={{ height: hTete, display: "flex", alignItems: "center", gap: 0.016 * W, borderBottom: `${filet}px solid ${N4.filet}`, paddingBottom: 0.01 * W, opacity: eTete.o, transform: `translateY(${eTete.d * dy}px)` }}>
          <Icone nom="horloge" taille={0.04 * W} couleur={N4.orange} epaisseur={2.4} />
          <span style={{ ...styleTitre(W), flex: 1 }}>{p.titre}</span>
          {p.legende
            ? [
                { texte: p.legende.utile, fond: DEGRADE_ORANGE },
                { texte: p.legende.subi, fond: N4.sable },
              ].map((x) => (
                <span key={x.texte} style={{ display: "inline-flex", alignItems: "center", gap: 0.008 * W, marginLeft: 0.018 * W }}>
                  <span style={{ width: 0.02 * W, height: 0.02 * W, borderRadius: "50%", background: x.fond }} />
                  <span style={{ fontFamily: POLICES.texte, fontSize: corps, color: N4.encreDouce, whiteSpace: "nowrap" }}>{x.texte}</span>
                </span>
              ))
            : null}
        </div>

        {/* ---------------- Cadran + légende ---------------- */}
        <div style={{ position: "relative", height: D }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: D, height: D, opacity: eCadran.o, transform: `translateY(${eCadran.d * dy}px) scale(${s.sx}, ${s.sy})`, transformOrigin: "50% 100%" }}>
            <svg width={D + oH} height={D + oH} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              <defs>
                <linearGradient id="cj4-orange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={N4.orangeChaud} />
                  <stop offset="1" stopColor={N4.orangeProfond} />
                </linearGradient>
                <linearGradient id="cj4-ivoire" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={N4.ivoire} />
                  <stop offset="1" stopColor={N4.ivoireCreux} />
                </linearGradient>
              </defs>
              {/* Corps du cadran : le héros en relief (ombre dure 0,005 L + contour 0,003 L). */}
              <circle cx={R + oH} cy={R + oH} r={R - cH / 2} fill={N4.encre} />
              <circle cx={R} cy={R} r={R - cH / 2} fill="url(#cj4-ivoire)" stroke={N4.encre} strokeWidth={cH} />
              {/* Piste en creux (ivoire-creux, bords en filet) : le temps non dit reste lisible comme « vide ». */}
              <path d={anneau(R, R, rPisteInt, rPisteExt, -90, 269.99)} fill={N4.ivoireCreux} stroke={N4.filet} strokeWidth={2} />
              {/* Secteurs, remplis dans le sens horaire (glisse 0,25 s). Petit jour de 0,6° entre deux secteurs. */}
              {acts.map((x) => {
                if (t < x.a) return null;
                const u = glisse(t, x.a, REMPLI);
                const a0 = angle(x.de) + 0.3;
                const a1 = a0 + (angle(x.a_heure) - 0.3 - a0) * Math.max(0.01, u);
                // La part arrive PLEINE (part de tarte depuis le centre, couleur pleine 0,16 s) puis se range dans l'anneau.
                const range = glisse(t, x.a + ECLAT, 0.2);
                const r0 = rPisteInt * range;
                const eclat = enEclat(t, x.a);
                const fond = eclat ? (x.subi ? N4.encreDouce : N4.orange) : x.subi ? N4.sable : "url(#cj4-orange)";
                return <path key={x.texte} d={anneau(R, R, Math.max(0.5, r0), eclat ? R - cH : rPisteExt, a0, a1)} fill={fond} />;
              })}
              {/* Reflet ivoire sur le bord haut de la piste (2 px, 20 %). */}
              <path d={anneau(R, R, rPisteExt - 2, rPisteExt, -170, -10)} fill="rgba(233, 220, 200, 0.2)" />
              {/* Graduations fines : 48 quarts d'heure (filet), heures plus longues (encre-douce). */}
              {Array.from({ length: 48 }, (_, i) => {
                const a = rad(-90 + i * 7.5);
                const heure = i % 4 === 0;
                const r0 = heure ? R * 0.885 : R * 0.905;
                const r1 = R * 0.955;
                return <line key={i} x1={R + r0 * Math.cos(a)} y1={R + r0 * Math.sin(a)} x2={R + r1 * Math.cos(a)} y2={R + r1 * Math.sin(a)} stroke={heure ? N4.encreDouce : N4.sableProfond} strokeWidth={heure ? 3 : 1.6} strokeLinecap="round" opacity={heure ? 1 : 0.7} />;
              })}
              {/* Aiguille (N3) : filet encre-douce en travers de la piste + point orange, tourne en continu. */}
              <g transform={`rotate(${angleAiguille} ${R} ${R})`}>
                <line x1={R + rPisteInt - R * 0.03} y1={R} x2={R + rPisteExt + R * 0.02} y2={R} stroke={N4.encre} strokeWidth={4} strokeLinecap="round" />
                <circle cx={R + rPisteExt + R * 0.02} cy={R} r={R * 0.03} fill={N4.orange} stroke={N4.ivoire} strokeWidth={2} />
              </g>
              {/* Repères horaires à l'intérieur de la piste (corps 26 px, sable-profond). */}
              {[0, 3, 6, 9].map((k) => {
                const a = rad(-90 + k * 30);
                const r = rPisteInt - R * 0.13;
                return (
                  <text key={k} x={R + r * Math.cos(a)} y={R + r * Math.sin(a)} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: POLICES.texte, fontSize: Math.max(26, 0.025 * W), fill: N4.sableProfond }}>
                    {`${h0 + k} h`}
                  </text>
                );
              })}
            </svg>
            {/* Total en héros, au centre. */}
            <div style={{ position: "absolute", left: R - rPisteInt * 0.7, top: R - 0.108 * W, width: rPisteInt * 1.4, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 0.006 * W }}>
                <ChiffreRoulant t={t} etapes={total} taille={0.13 * W} couleur={N4.encre} />
                <span style={{ fontFamily: POLICES.titre, fontSize: 0.065 * W, color: N4.encre, lineHeight: 1 }}>h</span>
              </div>
              <span style={{ fontFamily: POLICES.texte, fontSize: corps, color: N4.encreDouce, marginTop: 0.002 * W }}>{p.libelleTotal ?? "subies"}</span>
            </div>
            <Tampon4 t={t} a={p.exempleA ?? (acts[0]?.a ?? debut) + 0.3} W={W} style={{ left: R - 0.083 * W, top: R + 0.066 * W }} />
          </div>

          {/* Légende-liste alignée, à droite du cadran : une ligne par activité, sur son mot. */}
          <div style={{ position: "absolute", left: xLegende, top: 0, width: lLegende, height: D, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {acts.map((x, i) => {
              const e = entree(t, x.a, 0.2);
              const duree = x.a_heure - x.de;
              return (
                <div
                  key={x.texte}
                  style={{
                    position: "relative",
                    padding: `${0.02 * W}px 0`,
                    ...(enEclat(t, x.a) ? { background: x.subi ? N4.encreDouce : DEGRADE_ORANGE, borderRadius: 0.016 * W, margin: `${-0.012 * W}px ${-0.026 * W}px ${-0.012 * W}px ${-0.03 * W}px`, padding: `${0.032 * W}px ${0.026 * W}px ${0.032 * W}px ${0.03 * W}px` } : {}),
                    borderTop: i ? `${filet}px solid ${N4.filet}` : undefined,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 0.016 * W,
                  }}
                >
                  {/* Emplacement en attente (sable) tant que l'activité n'est pas dite : la liste garde sa forme. */}
                  {!e.visible ? (
                    <>
                      <span style={{ width: 0.022 * W, height: 0.022 * W, marginTop: 0.01 * W, borderRadius: "50%", border: `${filet}px solid ${N4.sable}`, boxSizing: "border-box", flexShrink: 0 }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.012 * W, paddingTop: 0.008 * W }}>
                        <div style={{ width: "72%", height: 0.022 * W, borderRadius: 999, background: N4.ivoireCreux }} />
                        <div style={{ width: "48%", height: 0.018 * W, borderRadius: 999, background: N4.ivoireCreux }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ width: 0.022 * W, height: 0.022 * W, marginTop: 0.01 * W, borderRadius: "50%", background: x.subi ? N4.sable : DEGRADE_ORANGE, flexShrink: 0, opacity: e.o, transform: `scale(${0.6 + 0.4 * glisse(t, x.a, 0.18)})` }} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", opacity: e.o, transform: `translateX(${e.d * 0.03 * W}px)` }}>
                        <span style={{ fontFamily: POLICES.texte, fontSize: corps * 1.08, color: enEclat(t, x.a) ? N4.ivoire : N4.encre, whiteSpace: "nowrap" }}>{x.texte}</span>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 0.01 * W }}>
                          <span style={{ fontFamily: POLICES.texte, fontSize: Math.max(26, 0.025 * W), color: enEclat(t, x.a) ? N4.ivoire : N4.sableProfond, whiteSpace: "nowrap", ...TABULAIRE }}>{`${heureTexte(x.de)} – ${heureTexte(x.a_heure)}`}</span>
                          <span style={{ fontFamily: POLICES.texte, fontSize: Math.max(26, 0.025 * W), color: enEclat(t, x.a) ? N4.ivoire : x.subi ? N4.encreDouce : N4.orangeProfond, whiteSpace: "nowrap", ...TABULAIRE }}>{`${duree} h`}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- Ruban de la journée (8 h → 20 h) ---------------- */}
        <div style={{ height: hRuban, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 0.008 * W, opacity: eRuban.o, transform: `translateY(${eRuban.d * dy}px)` }}>
          <div style={{ position: "relative", height: 0.024 * W, borderRadius: 999, background: N4.ivoireCreux, overflow: "hidden", boxShadow: `inset 0 0 0 2px ${N4.filet}` }}>
            {acts.map((x) => {
              if (t < x.a) return null;
              const u = glisse(t, x.a, REMPLI);
              const g = ((x.de - h0) / 12) * 100;
              const d = ((x.a_heure - x.de) / 12) * 100 * u;
              return <div key={x.texte} style={{ position: "absolute", left: `calc(${g}% + 1px)`, width: `calc(${d}% - 2px)`, top: 0, bottom: 0, background: x.subi ? N4.sable : DEGRADE_ORANGE }} />;
            })}
            {/* Tête « maintenant » du ruban, synchronisée avec l'aiguille. */}
            <div style={{ position: "absolute", left: `${((((t - debut) / 9) % 1) + 1) % 1 * 100}%`, top: 0, bottom: 0, width: 3, background: N4.encre }} />
          </div>
          <div style={{ position: "relative", height: Math.max(26, 0.025 * W) * 1.2 }}>
            {[0, 4, 8, 12].map((k) => (
              <span key={k} style={{ position: "absolute", left: `${(k / 12) * 100}%`, transform: `translateX(${k === 0 ? 0 : k === 12 ? -100 : -50}%)`, fontFamily: POLICES.texte, fontSize: Math.max(26, 0.025 * W), color: N4.sableProfond, whiteSpace: "nowrap", ...TABULAIRE }}>
                {`${h0 + k} h`}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Instants (s) des remplissages : utile pour poser un bruitage léger à chacun. */
export const instantsSecteurs = (p: Pick<CadranJourneeProps, "activites">) => p.activites.map((x) => x.a);
