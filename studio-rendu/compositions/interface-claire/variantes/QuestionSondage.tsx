import React from "react";
/**
 * CARTE « QUESTION AU SPECTATEUR » (designer n° 5, 15/10 — nouvelle).
 * Une question posée au spectateur, qui invite à commenter.
 *
 * Composition (standard premium, CARTES-20-PREMIUM-2026-10-15.md) :
 *  - une carte de SONDAGE de réseau social : ligne d'auteur (avatar, « Sondage », horodatage), filet ;
 *  - « ? » orange HÉROS (seul élément en relief : contour 0,003 L + ombre dure 0,005 L) dans la marge gauche, question en
 *    Montserrat 0,048 L sur 2-3 lignes, casse normale (jamais une phrase en capitales) ;
 *  - 2 à 4 options en barres pleine largeur (ivoire-creux, filet, libellé en corps, case ronde à droite) ;
 *  - pied « Répondez en commentaire » en corps sable-profond. AUCUN pourcentage (aucun faux résultat) : l'option
 *    choisie se remplit seulement d'orange-voile, avec une coche.
 * Mouvement :
 *  - N1 : la carte tombe (animationCarte) ; le « ? » tombe et fait deux rebonds amortis (écrasement à chaque impact) ;
 *  - N2 : la question s'écrit par groupes de mots ; chaque option arrive sur son mot par un VOLET orange (le bloc
 *         orange s'étend de gauche à droite puis se retire et révèle l'option, qui glisse de 0,04 L) ; sur le mot du choix,
 *         un curseur-main glisse jusqu'à l'option et clique (onde, écrasement de 4 %, remplissage orange en 0,2 s puis
 *         repos orange-voile + coche) ; le pied glisse sur son mot ;
 *  - N3 : le « ? » oscille en pendule de ± 3°.
 */
import { POLICES } from "../charte";
import { Icone } from "../elements";
import { claque, Coque, DEGRADE, ecrasement, encreA, fonduEntree, glisse, grille, interieurCoque, ivoireA, microOmbre, N, ombreInterieure, pose, Reflet, reliefs, ScenePremium, STYLE_CORPS, typo } from "./premium-5";

export type GroupeQuestion = { texte: string; a: number };
export type OptionSondage = { texte: string; a: number };

export type QuestionSondageProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Question découpée en groupes de mots, chacun sur son mot. */
  question: GroupeQuestion[];
  /** 2 à 4 options. */
  options: OptionSondage[];
  /** Option cliquée par le curseur (indice) et instant du clic. */
  choix?: { index: number; a: number };
  /** Pied de carte (corps) et instant. */
  pied?: { texte: string; a: number };
  /** Ligne d'auteur. */
  auteur?: string;
  prise?: string;
  yeux?: number;
};

/** Bas de la carte (fraction de H). */
export const BAS_QUESTION_SONDAGE = 0.5;

/** Hauteur (px) du « ? » au-dessus de sa position de repos : chute puis deux rebonds amortis ; `impact` vrai pendant un écrasement. */
function rebondsQuestion(t: number, a: number, W: number): { dy: number; ecrase: number } {
  const u = t - a;
  const h0 = 0.14 * W;
  const segments = [
    { d: 0.13, h: 0 }, // chute
    { d: 0.16, h: 0.035 * W },
    { d: 0.1, h: 0.012 * W },
  ];
  if (u < 0) return { dy: -h0, ecrase: 0 };
  if (u < segments[0].d) {
    const p = u / segments[0].d;
    return { dy: -h0 * (1 - p * p), ecrase: 0 };
  }
  let v = u - segments[0].d;
  for (let i = 1; i < segments.length; i++) {
    const s = segments[i];
    if (v < s.d) {
      const p = v / s.d;
      const ecrase = v < 0.04 ? (i === 1 ? 0.12 : 0.06) * Math.sin((Math.PI * v) / 0.04) : 0;
      return { dy: -s.h * 4 * p * (1 - p), ecrase };
    }
    v -= s.d;
  }
  return { dy: 0, ecrase: v < 0.04 ? 0.04 * Math.sin((Math.PI * v) / 0.04) : 0 };
}

/** Curseur-main (grille 24 × 24), pointe de l'index en (8, 2). */
function Main({ taille }: { taille: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" style={{ display: "block", overflow: "visible" }}>
      <path d="M8 2.2 C9.2 2.2 10 3 10 4.2 V9.4 C10.3 8.4 11 7.9 12 7.9 C13.1 7.9 13.9 8.6 14 9.7 C14.3 8.9 15 8.4 16 8.4 C17.1 8.4 17.9 9.2 18 10.3 C18.3 9.6 19 9.2 19.9 9.2 C21.1 9.2 22 10.1 22 11.3 V14.2 C22 18.6 18.6 22 14.2 22 H12.4 C9.8 22 8.2 21.2 6.7 19.7 L2.9 15.9 C2.1 15.1 2.1 13.9 2.9 13.1 C3.7 12.3 4.9 12.3 5.7 13.1 L6 13.4 V4.2 C6 3 6.8 2.2 8 2.2 Z" fill={N.ivoire} stroke={N.encre} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 9.6 V13.6 M14 9.8 V13.6 M18 10.4 V13.6" stroke={N.sableProfond} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function QuestionSondage(p: QuestionSondageProps) {
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const t = p.t;
  const bas = BAS_QUESTION_SONDAGE;
  const ty = typo(W);
  const g = grille(W);
  const r = reliefs(W);
  const inter = interieurCoque(W, H, bas);

  // --- Grille verticale (px, repère intérieur).
  const hAuteur = Math.round(0.078 * W);
  const yQuestion = hAuteur + Math.round(0.03 * W);
  const tailleQ = Math.round(0.048 * W);
  const colQ = Math.round(0.11 * W);
  const xQ = g.marge + colQ + g.gouttiere;
  const lQ = inter.l - g.marge - xQ;
  const options = p.options.slice(0, 4);
  const nO = options.length;
  const hPied = Math.round(ty.corps * 1.3);
  const yPied = inter.h - g.marge * 0.8 - hPied;
  const ecartO = Math.round(0.012 * W);
  const hO = Math.round(nO <= 3 ? 0.074 * W : 0.062 * W);
  const yOptions = yPied - Math.round(0.026 * W) - (nO * hO + (nO - 1) * ecartO);
  const lO = inter.l - 2 * g.marge;

  // --- « ? » : chute + rebonds, puis pendule (N3).
  const aQ = p.debut + 0.08;
  const rq = rebondsQuestion(t, aQ, W);
  const pendule = t > aQ + 0.4 ? 3 * Math.sin(2 * Math.PI * 0.65 * (t - aQ - 0.4)) * Math.min(1, (t - aQ - 0.4) / 0.3) : 0;
  const tailleInterro = Math.round(0.15 * W);

  // --- Choix.
  const c = p.choix;
  const clic = c && t >= c.a;
  const ecraseCarte = (c ? ecrasement(t, [c.a + 0.02], 0.025, 0.14) : 0) + ecrasement(t, p.options.map((o) => o.a + 0.06), 0.02, 0.12);

  const contenu = (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Ligne d'auteur : avatar monogramme, « Sondage », horodatage ; filet. */}
      <div style={{ position: "absolute", left: g.marge, right: g.marge, top: 0, height: hAuteur, display: "flex", alignItems: "center", gap: Math.round(0.02 * W), borderBottom: `${r.filet}px solid ${N.filet}` }}>
        <div style={{ position: "relative", width: 0.055 * W, height: 0.055 * W, borderRadius: "50%", background: DEGRADE.encre, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: POLICES.titre, fontSize: ty.corps, color: N.ivoire, flexShrink: 0 }}>
          <Reflet rayon={0.02 * W} opacite={0.2} />
          {(p.auteur ?? "Axion").slice(0, 1).toUpperCase()}
        </div>
        <span style={{ ...STYLE_CORPS, fontSize: ty.corps, color: N.encre, whiteSpace: "nowrap" }}>{p.auteur ?? "Sondage"}</span>
        <span style={{ ...STYLE_CORPS, fontSize: ty.corps, color: N.sableProfond, whiteSpace: "nowrap" }}>· maintenant</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 0.008 * W }}>
          {[0, 1, 2].map((k) => (
            <span key={k} style={{ width: 0.008 * W, height: 0.008 * W, borderRadius: "50%", background: N.sableProfond }} />
          ))}
        </span>
      </div>

      {/* « ? » héros (relief), pendule autour de son sommet. */}
      <div style={{ position: "absolute", left: g.marge, top: yQuestion - 0.01 * W, width: colQ, height: tailleInterro, display: "flex", justifyContent: "center", transform: `translateY(${rq.dy}px) rotate(${pendule}deg) scale(${1 + rq.ecrase * 0.5}, ${1 - rq.ecrase})`, transformOrigin: "50% 100%", opacity: fonduEntree(t, aQ) }}>
        <span
          style={{
            fontFamily: POLICES.titre,
            fontSize: tailleInterro,
            lineHeight: 0.9,
            color: N.orange,
            WebkitTextStroke: `${r.contourHeros}px ${N.encre}`,
            paintOrder: "stroke fill",
            textShadow: `${r.ombreHeros}px ${r.ombreHeros}px 0 ${N.encre}`,
          }}
        >
          ?
        </span>
      </div>

      {/* Question : groupes de mots qui s'écrivent sur leur mot (place réservée : aucun saut de ligne). */}
      <div style={{ position: "absolute", left: xQ, top: yQuestion, width: lQ, fontFamily: POLICES.titre, fontSize: tailleQ, lineHeight: 1.12, color: N.encre, letterSpacing: "-0.005em" }}>
        {p.question.map((gq, i) => {
          const e = glisse(t, gq.a, 0.16);
          return (
            <span key={i} style={{ display: "inline", opacity: t < gq.a ? 0 : fonduEntree(t, gq.a), position: "relative", top: (1 - e) * 0.015 * W }}>
              {gq.texte}
              {i < p.question.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>

      {/* Options. */}
      {options.map((o, i) => {
        const y = yOptions + i * (hO + ecartO);
        if (t < o.a) {
          // Emplacement en attente : rien (la carte reste lisible, aucune case vide).
          return null;
        }
        const u = t - o.a;
        // Volet orange : s'étend (0 → 0,08 s, glisse), tient, puis se retire vers la droite (0,14 → 0,24 s, accélère puis freine).
        const ouvre = glisse(t, o.a, 0.08);
        const r0 = Math.min(1, Math.max(0, (u - 0.14) / 0.1));
        const retire = r0 * r0 * (3 - 2 * r0);
        const voletG = retire * 100;
        const voletD = (1 - ouvre) * 100;
        const revele = u >= 0.08;
        const glisseO = glisse(t, o.a, 0.2);
        const choisie = c && c.index === i && clic;
        const ecraseO = choisie ? 0.04 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - c!.a) / 0.1))) : 0;
        const rempli = choisie ? Math.min(1, glisse(t, c!.a + 0.04, 0.2) * 1.0) : 0;
        const enFlash = choisie && t < c!.a + 0.36;
        const autreAtenue = clic && !(c && c.index === i);
        return (
          <div key={i} style={{ position: "absolute", left: g.marge, top: y, width: lO, height: hO, transform: `translateX(${(1 - glisseO) * -0.04 * W}px) scaleY(${1 - ecraseO})` }}>
            {revele ? (
              <div style={{ position: "absolute", inset: 0, borderRadius: r.rayon, background: N.ivoireCreux, border: `${r.filet}px solid ${choisie ? N.orange : N.filet}`, boxShadow: ombreInterieure(W), boxSizing: "border-box", overflow: "hidden" }}>
                {/* Remplissage du choix : orange pendant 0,36 s (flash), puis orange-voile + liseré orange. */}
                {choisie ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${rempli * 100}%`, background: enFlash ? DEGRADE.orange : N.orangeVoile }} /> : null}
                {choisie && !enFlash ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 0.007 * W, background: N.orange }} /> : null}
                {choisie && enFlash ? <Reflet opacite={0.22} /> : null}
                <div style={{ position: "absolute", left: 0.03 * W, right: 0.03 * W, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ ...STYLE_CORPS, fontSize: Math.round(0.031 * W), color: choisie && enFlash && rempli > 0.4 ? N.ivoire : autreAtenue ? N.sableProfond : N.encre, whiteSpace: "nowrap" }}>{o.texte}</span>
                  {/* Case ronde : vide (filet), puis pleine orange avec coche au choix. */}
                  <div style={{ width: 0.05 * W, height: 0.05 * W, borderRadius: "50%", boxSizing: "border-box", border: choisie ? "none" : `${r.filet * 1.3}px solid ${N.sable}`, background: choisie ? (enFlash ? N.ivoire : N.orange) : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${choisie ? 0.8 + 0.2 * claque(t, c!.a + 0.1, 0.12) : 1})` }}>
                    {choisie ? (
                      <svg width={0.032 * W} height={0.032 * W} viewBox="0 0 24 24">
                        <path d="M20 6 9 17l-5-5" fill="none" stroke={enFlash ? N.orange : N.ivoire} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30" strokeDashoffset={30 * (1 - Math.min(1, (t - c!.a - 0.1) / 0.14))} />
                      </svg>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {/* Volet orange. */}
            {voletG < 100 ? <div style={{ position: "absolute", top: 0, bottom: 0, left: `${voletG}%`, right: `${voletD}%`, borderRadius: r.rayon, background: DEGRADE.orange, boxShadow: microOmbre(W, 0.14) }} /> : null}
          </div>
        );
      })}

      {/* Pied : « Répondez en commentaire ». */}
      {p.pied && t >= p.pied.a ? (
        <div style={{ position: "absolute", left: g.marge, top: yPied, display: "flex", alignItems: "center", gap: 0.016 * W, opacity: fonduEntree(t, p.pied.a), transform: `translateY(${(1 - glisse(t, p.pied.a, 0.18)) * 0.03 * W}px)` }}>
          <Icone nom="message" taille={Math.round(0.04 * W)} couleur={N.orange} epaisseur={2.4} />
          <span style={{ ...STYLE_CORPS, fontSize: ty.corps, color: N.sableProfond, whiteSpace: "nowrap" }}>{p.pied.texte}</span>
        </div>
      ) : null}

      {/* Curseur-main : glisse jusqu'à l'option choisie, clique (onde). */}
      {c && t >= c.a - 0.4 ? (() => {
        const yCible = yOptions + c.index * (hO + ecartO) + hO * 0.5;
        const xCible = g.marge + lO * 0.62;
        const m = glisse(t, c.a - 0.4, 0.36);
        const x = xCible + (1 - m) * 0.22 * W;
        const y = yCible + (1 - m) * 0.12 * W;
        const appui = t >= c.a && t < c.a + 0.12 ? 0.88 : 1;
        const onde = t >= c.a ? Math.min(1, (t - c.a) / 0.32) : 0;
        const tailleMain = Math.round(0.085 * W);
        return (
          <>
            {onde > 0 && onde < 1 ? <div style={{ position: "absolute", left: xCible - onde * 0.07 * W, top: yCible - onde * 0.07 * W, width: onde * 0.14 * W, height: onde * 0.14 * W, borderRadius: "50%", border: `${0.004 * W}px solid ${N.ivoire}`, opacity: 1 - onde, boxSizing: "border-box" }} /> : null}
            <div style={{ position: "absolute", left: x - tailleMain * (8 / 24), top: y - tailleMain * (2.2 / 24), transform: `scale(${appui}) rotate(-8deg)`, transformOrigin: `${(8 / 24) * 100}% ${(2.2 / 24) * 100}%`, filter: `drop-shadow(0 ${0.004 * W}px ${0.005 * W}px ${encreA(0.25)})`, opacity: fonduEntree(t, c.a - 0.4) }}>
              <Main taille={tailleMain} />
            </div>
          </>
        );
      })() : null}
    </div>
  );

  const carte = <Coque t={t} debut={p.debut} fin={p.fin} W={W} H={H} bas={bas} id="question-sondage" ecrase={ecraseCarte} enfants={contenu} />;
  if (!p.prise) return carte;
  return (
    <ScenePremium t={t} debut={p.debut} fin={p.fin} W={W} H={H} bas={bas} prise={p.prise} yeux={p.yeux}>
      {carte}
    </ScenePremium>
  );
}

/** Phrase d'exemple. */
export const PHRASE_QUESTION_SONDAGE = "Et vous, combien d'heures perdez-vous par semaine ? Moins d'une heure, une à trois heures, ou plus ? Je parie que pour vous, c'est plus. Répondez en commentaire.";

export const EXEMPLE_QUESTION_SONDAGE = {
  debut: 0,
  fin: 6.6,
  auteur: "Sondage",
  question: [
    { texte: "Et vous,", a: 0.12 },
    { texte: "combien d'heures", a: 0.5 },
    { texte: "perdez-vous", a: 0.95 },
    { texte: "par semaine ?", a: 1.35 },
  ],
  options: [
    { texte: "Moins d'une heure", a: 1.95 }, // « Moins d'une heure »
    { texte: "Une à trois heures", a: 2.7 }, // « une à trois heures »
    { texte: "Plus de trois heures", a: 3.45 }, // « ou plus »
  ],
  choix: { index: 2, a: 4.45 }, // « vous » (« pour vous, c'est plus »)
  pied: { texte: "Répondez en commentaire", a: 5.55 }, // « commentaire »
} satisfies Omit<QuestionSondageProps, "t" | "largeurImage" | "hauteurImage">;

/** Instant le plus représentatif pour une image fixe (choix posé, pied affiché). */
export const INSTANT_FIXE_QUESTION_SONDAGE = 6.0;
/** Instant « en construction » (2ᵉ option sous son volet orange). */
export const INSTANT_CONSTRUCTION_QUESTION_SONDAGE = 2.82;
