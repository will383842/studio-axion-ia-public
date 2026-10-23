import React from "react";
/**
 * CARTE « OBJECTION BARRÉE » (`objection-barree`) — version premium du designer n° 4 (15/10/2026), reprise du
 * brouillon n° 3 et AGRANDIE : de la petite bulle (12 % de l'image) à une vraie carte sur la bande (30 %).
 * Quand : « Vous allez me dire que… », une idée reçue à démonter.
 *
 * Carte sur la bande (0,095 → 0,905 L, 0,13 → 0,47 H) : la prise descend dessous, visage ENTIER. Pas de bandeau
 * d'en-tête (variété) : la carte s'ouvre sur un grand guillemet.
 * COMPOSITION : en haut, l'objection entre de grands guillemets orange-voile (0,12 L), en titre 0,048 L sur 2 lignes,
 * casse normale (c'est une phrase) ; un filet et l'onglet « En réalité » ; en bas, la réponse en HÉROS (0,075 L) avec
 * son icône dans un disque orange — seul élément en relief. Avant la réponse, la place est tenue par un squelette de
 * chargement (sable-clair) : la carte n'est jamais à moitié vide.
 *  - N1 : la carte tombe (chute du format) ; guillemet et sur-titre entrent en cascade de 50 ms.
 *  - N2 : l'objection s'écrit MOT À MOT (translation 0,02 L + fondu, 0,12 s) ; sur le mot de bascule, un trait de
 *         FEUTRE orange irrégulier la barre (0,14 s, une ligne après l'autre) et elle passe en sable ; la réponse MONTE du
 *         bas (pose 0,22 s) et la carte s'écrase de 2 % (suivi) ; sur `fortA`, un trait orange souligne la réponse.
 *  - N3 : les guillemets pulsent (± 4 %), le squelette scintille, puis le disque héros respire.
 */
import { animationCarte } from "../cadrage";
import { largeurTexte, POLICES } from "../charte";
import { Icone } from "../elements";
import { largeurNaturelle } from "./commun";
import { alea, claque, couperLignes, DEGRADE_ORANGE, enEclat, entree, epFilet, fondu, glisse, Grain, N4, pose, refletInset, respire, styleCoque, styleHeros, suivi, TYPO4 } from "./premium-4";

export type MotObjection = { texte: string; a: number };

export type ObjectionBarreeProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Mots de l'objection (datés), en une ou plusieurs lignes : la carte les recoupe elle-même en 2 lignes au plus. */
  lignes: MotObjection[][];
  /** Sur-titre au-dessus de l'objection (par défaut « Vous allez me dire : »). */
  surTitre?: string;
  /** Instant du barré (mot de bascule : « Justement », « En réalité »…). */
  barreA: number;
  /** Onglet de la réponse (par défaut « En réalité »). */
  onglet?: string;
  /** Réponse : sur-titre (corps), texte fort (héros), icône ; `a` = arrivée, `fortA` = soulignement du texte fort. */
  reponse: { surTitre: string; texte: string; icone: string; a: number; fortA?: number };
};

/** Emprise : une carte sur la bande, comme les cartes du format (la prise descend dessous). */
export const CADRAGE_OBJECTION = Object.freeze({ x0: 0.095, x1: 0.905, y0: 0.13, y1: 0.47, couvreVisage: false });

/** Trait de feutre : polyligne irrégulière (déterministe) en coordonnées 0-100 × 0-20, légèrement montante. */
function traitFeutre(graine: number): string {
  const pts: string[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const x = -2 + (104 * i) / n;
    const y = 11.5 - i * 0.35 + (alea(graine * 13 + i) - 0.5) * 3.2;
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

export function ObjectionBarree(p: ObjectionBarreeProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const t = p.t;
  const C = CADRAGE_OBJECTION;
  const a = animationCarte(t, p.debut, p.fin, { x0: C.x0, x1: C.x1, y0: C.y0, y1: C.y1 }, "chute");
  const l = (C.x1 - C.x0) * W;
  const h = (C.y1 - C.y0) * H;
  const pad = 0.04 * W;
  const contour = Math.max(3, Math.round(0.0045 * W));
  const li = l - 2 * contour - 2 * pad;
  const corps = TYPO4.corps * W;
  const filet = epFilet(W);
  const r = p.reponse;
  const s = suivi(t, [r.a + 0.16], 0.02);

  // Objection : recoupée en 2 lignes au plus, en titre 0,048 L (réduit jusqu'à 0,041 L si besoin).
  const mots = p.lignes.flat();
  const lObj = li - 0.1 * W; // place réservée au guillemet fermant
  let tObj = 0.048 * W;
  let lignesObj = couperLignes(mots, lObj, (x) => largeurNaturelle(x, tObj));
  while (lignesObj.length > 2 && tObj > TYPO4.titre * W) {
    tObj -= 0.001 * W;
    lignesObj = couperLignes(mots, lObj, (x) => largeurNaturelle(x, tObj));
  }
  const barre = t >= p.barreA;
  const coup = pose(t, p.barreA + 0.04, 0.2);

  // Réponse : héros en capitales, 2 lignes au plus, 0,075 L au plus.
  const disque = 0.105 * W;
  const lRep = li - disque - 0.032 * W;
  const motsRep = r.texte.split(/\s+/).map((texte) => ({ texte }));
  let tRep = 0.075 * W;
  let lignesRep = couperLignes(motsRep, lRep, (x) => largeurTexte(x, tRep));
  const tropLarge = () => lignesRep.length > 2 || Math.max(...lignesRep.map((x) => largeurTexte(x.map((m) => m.texte).join(" "), tRep))) > lRep;
  while (tropLarge() && tRep > 0.06 * W) {
    tRep -= 0.001 * W;
    lignesRep = couperLignes(motsRep, lRep, (x) => largeurTexte(x, tRep));
  }
  const repLa = t >= r.a;
  const eRep = pose(t, r.a, 0.22);
  const eclatRep = enEclat(t, r.a + 0.02);

  // Cascade d'entrée de l'en-tête.
  const c0 = p.debut + 0.08;
  const eGuil = entree(t, c0, 0.2);
  const eSur = entree(t, c0 + 0.05, 0.2);
  const pulse = respire(t, 0, 0.04, 1.1);
  const dy = 0.02 * W;

  const guillemet = (txt: string, style: React.CSSProperties) => (
    <span style={{ position: "absolute", fontFamily: POLICES.titre, fontSize: 0.12 * W, lineHeight: 1, color: N4.orangeVoile, ...style }}>{txt}</span>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: C.x0 * W,
        top: C.y0 * H,
        width: l,
        height: h,
        transform: `translate(${a.dx * W}px, ${a.dy * H}px) rotate(${a.rotation}deg) scale(${a.echelle * s.sx}, ${a.echelle * s.sy})`,
        transformOrigin: "50% 0%",
        ...styleCoque(W),
        overflow: "hidden",
      }}
    >
      <Grain id="ob4-grain" />
      <div style={{ position: "absolute", inset: 0, padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {/* ---------------- L'objection ---------------- */}
        <div style={{ position: "relative" }}>
          {/* Grand guillemet ouvrant (orange-voile, 0,12 L), qui pulse (N3). */}
          <div style={{ position: "relative", height: 0.07 * W, opacity: eGuil.o, transform: `translateY(${eGuil.d * dy}px)` }}>
            {guillemet("“", { left: -0.004 * W, top: -0.018 * W, transform: `scale(${pulse})`, transformOrigin: "30% 40%" })}
            <span style={{ position: "absolute", left: 0.088 * W, top: 0.014 * W, fontFamily: POLICES.texte, fontSize: corps, color: N4.sableProfond, whiteSpace: "nowrap", opacity: eSur.o / Math.max(1e-6, eGuil.o), transform: `translateY(${(eSur.d - eGuil.d) * dy}px)` }}>
              {p.surTitre ?? "Vous allez me dire :"}
            </span>
          </div>
          {/* Le coup de feutre BOUSCULE la phrase : elle descend de 0,014 L et s'incline de -1,5° (pose 0,2 s). */}
          <div style={{ display: "flex", flexDirection: "column", gap: tObj * 0.1, marginTop: 0.006 * W, transform: `translateY(${0.014 * W * coup}px) rotate(${-1.5 * coup}deg)`, transformOrigin: "0% 50%", position: "relative" }}>
            {/* Éclat du barré (N2, 0,16 s) : l'objection passe un instant sur l'encre-douce, puis retombe en sable. */}
            {enEclat(t, p.barreA) ? <div style={{ position: "absolute", left: -0.02 * W, right: -0.02 * W, top: -0.012 * W, bottom: -0.012 * W, borderRadius: 0.02 * W, background: N4.encreDouce }} /> : null}
            {lignesObj.map((ligne, i) => {
              const trace = glisse(t, p.barreA + i * 0.04, 0.1);
              return (
                <div key={i} style={{ position: "relative", alignSelf: "flex-start", display: "flex", gap: tObj * 0.26 }}>
                  {ligne.map((m, k) => {
                    const e = entree(t, m.a, 0.12);
                    return (
                      <span key={k} style={{ fontFamily: POLICES.titre, fontSize: tObj, lineHeight: 1.12, color: enEclat(t, p.barreA) ? N4.ivoire : barre ? N4.sable : N4.encre, whiteSpace: "nowrap", opacity: e.o, transform: `translateY(${e.d * dy}px)` }}>
                        {m.texte}
                      </span>
                    );
                  })}
                  {/* Trait de feutre orange, irrégulier, tracé de gauche à droite (0,1 s par ligne, cascade 40 ms). */}
                  {barre ? (
                    <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ position: "absolute", left: -0.012 * W, top: "18%", width: `calc(100% + ${0.024 * W}px)`, height: "64%", overflow: "visible", clipPath: `inset(-50% ${(1 - trace) * 100}% -50% -5%)` }}>
                      <path d={traitFeutre(i + 1)} fill="none" stroke={N4.orange} strokeWidth={0.011 * W} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.94} />
                    </svg>
                  ) : null}
                </div>
              );
            })}
          </div>
          {/* Guillemet fermant, en bas à droite de l'objection. */}
          {mots.length && t >= mots[mots.length - 1].a ? guillemet("”", { right: -0.004 * W, bottom: -0.085 * W, transform: `scale(${pulse})`, transformOrigin: "60% 30%", opacity: fondu(t, mots[mots.length - 1].a) }) : null}
        </div>

        {/* ---------------- Onglet « En réalité » sur son filet ---------------- */}
        <div style={{ position: "relative", height: 0.05 * W, display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: filet, background: N4.filet }} />
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 0.012 * W,
              padding: `${0.008 * W}px ${0.02 * W}px`,
              borderRadius: 999,
              background: repLa ? N4.orangeVoile : N4.ivoireCreux,
              boxShadow: `0 0 0 ${0.012 * W}px ${N4.ivoire}`,
            }}
          >
            <Icone nom="eclair" taille={0.04 * W} couleur={repLa ? N4.orangeProfond : N4.sable} epaisseur={2.4} />
            <span style={{ fontFamily: POLICES.texte, fontSize: corps, lineHeight: 1.1, color: repLa ? N4.encre : N4.sableProfond, whiteSpace: "nowrap" }}>{p.onglet ?? "En réalité"}</span>
          </div>
        </div>

        {/* ---------------- La réponse (héros) ---------------- */}
        <div style={{ position: "relative", height: 0.205 * W }}>
          {/* Squelette de chargement tant que la réponse n'est pas dite (sable-clair, scintille : N3). */}
          {fondu(t, r.a) < 1 ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 0.032 * W, opacity: 1 - fondu(t, r.a) }}>
              <div style={{ width: disque, height: disque, borderRadius: "50%", background: N4.ivoireCreux, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.018 * W }}>
                {[0.42, 0.86, 0.62].map((f, i) => {
                  const ondee = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.9 * t - i * 0.9);
                  return <div key={i} style={{ width: `${f * 100}%`, height: i === 0 ? 0.026 * W : 0.05 * W, borderRadius: 999, background: ondee > 0.6 ? N4.ivoireCreux : N4.sableClair, opacity: i === 0 ? 0.8 : 1 }} />;
                })}
              </div>
            </div>
          ) : null}
          {repLa ? (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 0.032 * W, opacity: fondu(t, r.a), transform: `translateY(${(1 - eRep) * 0.04 * W}px)` }}>
              {/* Éclat d'arrivée (N2, 0,16 s) : la réponse claque sur un fond orange plein, puis se pose sur l'ivoire. */}
              {eclatRep ? <div style={{ position: "absolute", left: -0.022 * W, right: -0.022 * W, top: -0.014 * W, bottom: -0.014 * W, borderRadius: 0.02 * W, background: DEGRADE_ORANGE }} /> : null}
              {/* Disque héros : dégradé orange, reflet, contour 0,003 L, ombre 0,005 L ; claque à l'arrivée puis respire. */}
              <div
                style={{
                  position: "relative",
                  width: disque,
                  height: disque,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: DEGRADE_ORANGE,
                  ...styleHeros(W),
                  boxShadow: `${Math.max(3, Math.round(0.005 * W))}px ${Math.max(3, Math.round(0.005 * W))}px 0 ${N4.encre}, ${refletInset(W)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${(0.92 + 0.08 * claque(t, r.a + 0.06, 0.1)) * respire(t - r.a, 1, 0.015)})`,
                }}
              >
                <Icone nom={r.icone} taille={0.055 * W} couleur={N4.ivoire} epaisseur={2.4} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0.006 * W, minWidth: 0 }}>
                <span style={{ fontFamily: POLICES.texte, fontSize: corps, lineHeight: 1.15, color: eclatRep ? N4.ivoire : N4.encreDouce, whiteSpace: "nowrap", position: "relative" }}>{r.surTitre}</span>
                {lignesRep.map((ligne, i) => {
                  const e = entree(t, r.a + 0.05 * (i + 1), 0.2);
                  const souligne = r.fortA !== undefined && i === lignesRep.length - 1 ? glisse(t, r.fortA, 0.16) : 0;
                  return (
                    <div key={i} style={{ position: "relative", alignSelf: "flex-start", opacity: e.o, transform: `translateY(${e.d * 0.025 * W}px)` }}>
                      {souligne > 0 ? <div style={{ position: "absolute", left: 0, bottom: tRep * 0.02, width: `${100 * souligne}%`, height: tRep * 0.12, borderRadius: 999, background: N4.orange }} /> : null}
                      <span style={{ position: "relative", fontFamily: POLICES.titre, fontSize: tRep, lineHeight: 1.0, color: eclatRep ? N4.ivoire : N4.encre, textTransform: "uppercase", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>{ligne.map((m) => m.texte).join(" ")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const PHRASE_OBJECTION = "Vous allez me dire : « Je n'ai pas le temps de me former. » Justement, la formation se fait sur vos dossiers.";

export const EXEMPLE_OBJECTION_BARREE = {
  debut: 0,
  fin: 5.6,
  surTitre: "Vous allez me dire :",
  lignes: [
    [{ texte: "Je", a: 0.95 }, { texte: "n'ai", a: 1.08 }, { texte: "pas", a: 1.22 }],
    [{ texte: "le", a: 1.38 }, { texte: "temps", a: 1.5 }, { texte: "de", a: 1.72 }],
    [{ texte: "me", a: 1.82 }, { texte: "former.", a: 1.95 }],
  ],
  barreA: 2.85,
  onglet: "En réalité",
  reponse: { surTitre: "La formation se fait", texte: "Sur vos dossiers", icone: "dossier", a: 3.55, fortA: 4.3 },
} satisfies Omit<ObjectionBarreeProps, "t" | "largeurImage" | "hauteurImage">;

/** Instants représentatifs : objection barrée, réponse en attente (3,2 s) ; réponse posée et soulignée (4,7 s). */
export const INSTANT_FIXE_OBJECTION = 3.2;
export const INSTANT_FIXE_OBJECTION_REPONSE = 4.7;
/** Instant de construction : l'objection s'écrit. */
export const INSTANT_CONSTRUCTION_OBJECTION = 1.6;
