import React from "react";
/**
 * CARTE « MESSAGE VOCAL » (`message-vocal`) — version premium du designer n° 4 (15/10/2026), reprise du brouillon n° 3.
 * Quand : une situation vécue, ce que disent souvent les dirigeants, « on m'appelle souvent pour… ». Jamais un client
 * réel : avatar en silhouette neutre, en-tête « Situation fréquente », aucune étoile, aucun nom, aucun logo. La
 * transcription est la phrase que dit Will, rien d'inventé.
 *
 * Carte sur la bande (0,095 → 0,905 L, 0,13 → 0,475 H) : la prise descend dessous, visage ENTIER.
 * COMPOSITION : ligne d'expéditeur (avatar, « Situation fréquente », horodatage) ; bulle vocale en creux pleine
 * largeur avec le bouton lecture HÉROS (dégradé orange, seul élément en relief) et la forme d'onde RÉELLE de la prise
 * (48 barres arrondies : jouées en orange, à venir en sable-clair), compteur « 0:03 / 0:04 » tabulaire ; dessous, la
 * transcription en grand (0,041 L, casse normale), mots forts surlignés orange-voile.
 *  - N1 : la carte tombe (chute du format) ; l'intérieur entre en cascade de 50 ms (translation 0,02 L + fondu).
 *  - N2 : le bouton est pressé (écrasement 8 %) au début de la lecture ; chaque mot passe du sable à l'encre quand il est
 *         dit ; chaque MOT FORT reçoit un surlignage qui se dessine de gauche à droite (flash orange 0,12 s puis voile)
 *         et la carte s'écrase de 2,5 % (suivi, 0,2 s).
 *  - N3 : la tête de lecture avance en continu, la barre sous la tête respire avec le niveau sonore réel.
 * Niveaux : `niveaux` (0 → 1), un toutes les `pasNiveaux` s depuis `lectureA` (RMS de la prise par tranche de 40 ms).
 */
import { animationCarte } from "../cadrage";
import { POLICES } from "../charte";
import { claque, DEGRADE_ORANGE, enEclat, encreA, entree, epFilet, glisse, Grain, largeurInter, lin, microOmbre, N4, ombreCreux, refletInset, styleCoque, styleHeros, suivi, TABULAIRE, TYPO4 } from "./premium-4";

export type MotTranscription = { texte: string; a: number; fort?: boolean };

export type MessageVocalTypeProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Nom affiché à côté de l'avatar (jamais un nom réel). Par défaut « Situation fréquente ». */
  entete?: string;
  /** Horodatage affiché sous le nom. */
  horodatage?: string;
  /** Instant où le bouton lecture est pressé et où l'onde commence. */
  lectureA: number;
  /** Durée du message (s) : la tête de lecture traverse l'onde en ce temps. */
  dureeLecture: number;
  niveaux: number[];
  pasNiveaux: number;
  /** Transcription : 1 à 3 lignes de mots datés. */
  transcription: MotTranscription[][];
};

export const CADRAGE_MESSAGE_VOCAL = Object.freeze({ x0: 0.095, x1: 0.905, y0: 0.13, y1: 0.475, descente: 0.255, couvreVisage: false });

const NB_BARRES = 48;

/** Niveau sonore (0 → 1) à l'instant `t` (interpolé entre deux mesures). */
export function niveauA(niveaux: number[], pas: number, depuis: number, t: number): number {
  if (!niveaux.length) return 0;
  const x = (t - depuis) / pas;
  if (x <= 0) return niveaux[0];
  if (x >= niveaux.length - 1) return niveaux[niveaux.length - 1];
  const i = Math.floor(x);
  return niveaux[i] + (niveaux[i + 1] - niveaux[i]) * (x - i);
}

/** Niveau de crête sur une tranche [t0, t1] (forme d'onde fidèle : chaque barre = le plus fort de sa tranche). */
function creteSur(niveaux: number[], pas: number, depuis: number, t0: number, t1: number): number {
  let m = 0;
  for (let x = t0; x <= t1 + 1e-9; x += pas / 2) m = Math.max(m, niveauA(niveaux, pas, depuis, x));
  return m;
}

const minSec = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s)) % 60).padStart(2, "0")}`;

/** Avatar neutre : silhouette (tête + épaules) en sable-profond sur ivoire-creux, jamais une photo. */
function Avatar({ d }: { d: number }) {
  return (
    <svg width={d} height={d} viewBox="0 0 100 100" style={{ flexShrink: 0, display: "block" }}>
      <defs>
        <clipPath id="mv4-avatar">
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="50" fill={N4.ivoireCreux} />
      <g clipPath="url(#mv4-avatar)" fill={N4.sableProfond}>
        <circle cx="50" cy="40" r="17" />
        <ellipse cx="50" cy="96" rx="34" ry="28" />
      </g>
      <circle cx="50" cy="50" r="49" fill="none" stroke={N4.filet} strokeWidth="2" />
    </svg>
  );
}

export function MessageVocalType(p: MessageVocalTypeProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const t = p.t;
  const C = CADRAGE_MESSAGE_VOCAL;
  const a = animationCarte(t, p.debut, p.fin, { x0: C.x0, x1: C.x1, y0: C.y0, y1: C.y1 }, "chute");
  const l = (C.x1 - C.x0) * W;
  const h = (C.y1 - C.y0) * H;
  const pad = 0.04 * W;
  const corps = TYPO4.corps * W;
  const filet = epFilet(W);

  // Mots forts : suivi de la carte (écrasement 1,5 %) à leur arrivée.
  const forts = p.transcription.flat().filter((m) => m.fort).map((m) => m.a);
  const s = suivi(t, forts.map((x) => x + 0.02), 0.025, 0.2);

  // Cascade d'entrée de l'intérieur (50 ms), après la chute de la carte.
  const c0 = p.debut + 0.08;
  const eLigne = entree(t, c0, 0.2);
  const eBulle = entree(t, c0 + 0.05, 0.2);
  const eTexte = entree(t, c0 + 0.1, 0.2);
  const dy = 0.02 * W;

  // Lecture.
  const enLecture = t >= p.lectureA;
  const tete = lin(t, p.lectureA, p.dureeLecture);
  const presse = Math.sin(Math.PI * lin(t, p.lectureA - 0.02, 0.14));
  const niv = (x: number) => niveauA(p.niveaux, p.pasNiveaux, p.lectureA, x);
  const maintenant = enLecture && tete < 1 ? niv(t) : 0;

  // Bulle vocale.
  const hBulle = 0.205 * W;
  const bouton = 0.112 * W;
  const padBulle = 0.026 * W;
  const lBulle = l - 2 * pad - 2 * Math.round(0.0045 * W);
  const lOnde = lBulle - 2 * padBulle - bouton - 0.03 * W;
  const hOnde = 0.085 * W;
  const pasBarre = lOnde / NB_BARRES;
  const lBarre = Math.max(4, pasBarre * 0.56);

  // Transcription : le contenu principal, taille commune qui tient dans la largeur (0,05 L au plus, 0,034 L au moins).
  const lTexte = lBulle;
  const lignes = p.transcription;
  const tailleT = Math.max(0.034 * W, Math.min(0.05 * W, ...lignes.map((li) => (lTexte * 0.98) / Math.max(1e-6, largeurInter(li.map((m) => m.texte).join(" "), 1) + li.filter((m) => m.fort).length * 0.5))));

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
      <Grain id="mv4-grain" />
      <div style={{ position: "absolute", inset: 0, padding: pad, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {/* Expéditeur : avatar neutre, nom de situation, horodatage. */}
        <div style={{ display: "flex", alignItems: "center", gap: 0.022 * W, opacity: eLigne.o, transform: `translateY(${eLigne.d * dy}px)` }}>
          <div style={{ position: "relative" }}>
            <Avatar d={0.075 * W} />
            {/* Pastille micro : indique un message VOCAL (orange-voile, icône nue). */}
            <div style={{ position: "absolute", right: -0.008 * W, bottom: -0.004 * W, width: 0.036 * W, height: 0.036 * W, borderRadius: "50%", background: N4.orangeVoile, boxShadow: `0 0 0 ${filet + 1}px ${N4.ivoire}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={0.022 * W} height={0.022 * W} viewBox="0 0 24 24" fill="none" stroke={N4.orangeProfond} strokeWidth={2.6} strokeLinecap="round">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
              </svg>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0.004 * W, flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: POLICES.texte, fontSize: corps * 1.08, color: N4.encre, lineHeight: 1.1, whiteSpace: "nowrap" }}>{p.entete ?? "Situation fréquente"}</span>
            <span style={{ fontFamily: POLICES.texte, fontSize: corps, color: N4.sableProfond, lineHeight: 1.1, whiteSpace: "nowrap" }}>{p.horodatage ?? "Message vocal · 21:47"}</span>
          </div>
        </div>

        {/* Bulle vocale en creux : bouton héros + onde réelle + compteur. */}
        <div
          style={{
            position: "relative",
            height: hBulle,
            borderRadius: 0.03 * W,
            background: N4.ivoireCreux,
            boxShadow: ombreCreux(W),
            display: "flex",
            alignItems: "center",
            gap: 0.03 * W,
            padding: `0 ${padBulle}px`,
            opacity: eBulle.o,
            transform: `translateY(${eBulle.d * dy}px)`,
          }}
        >
          {/* Bouton lecture : le seul héros en relief (dégradé orange, reflet, contour 0,003 L, ombre 0,005 L). */}
          <div
            style={{
              position: "relative",
              width: bouton,
              height: bouton,
              flexShrink: 0,
              borderRadius: "50%",
              background: DEGRADE_ORANGE,
              ...styleHeros(W),
              boxShadow: `${Math.round(0.005 * W * (1 - presse))}px ${Math.round(0.005 * W * (1 - presse))}px 0 ${N4.encre}, ${refletInset(W)}`,
              transform: `translate(${0.005 * W * presse}px, ${0.005 * W * presse}px) scale(${1 - 0.08 * presse})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={bouton * 0.4} height={bouton * 0.4} viewBox="0 0 24 24" fill={N4.ivoire}>
              {enLecture && tete < 1 ? (
                <>
                  <rect x="5" y="3" width="5" height="18" rx="1.6" />
                  <rect x="14" y="3" width="5" height="18" rx="1.6" />
                </>
              ) : (
                <path d="M7.5 4.2v15.6a1 1 0 0 0 1.52.85l12.6-7.8a1 1 0 0 0 0-1.7L9.02 3.35A1 1 0 0 0 7.5 4.2z" />
              )}
            </svg>
          </div>

          {/* Onde + compteur. */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.008 * W }}>
            <div style={{ position: "relative", height: hOnde, display: "flex", alignItems: "center" }}>
              {Array.from({ length: NB_BARRES }, (_, i) => {
                const t0 = p.lectureA + (i / NB_BARRES) * p.dureeLecture;
                const t1 = p.lectureA + ((i + 1) / NB_BARRES) * p.dureeLecture;
                const crete = creteSur(p.niveaux, p.pasNiveaux, p.lectureA, t0, t1);
                const jouee = enLecture && t >= (t0 + t1) / 2;
                const sousTete = enLecture && t >= t0 && t < t1;
                // N3 : la barre sous la tête de lecture respire avec le niveau réel du moment.
                const vie = sousTete ? 1 + 0.25 * maintenant : 1;
                const hb = Math.max(lBarre, hOnde * Math.min(1, (0.14 + 0.86 * crete) * vie));
                return (
                  <div key={i} style={{ position: "absolute", left: i * pasBarre + (pasBarre - lBarre) / 2, top: (hOnde - hb) / 2, width: lBarre, height: hb, borderRadius: lBarre / 2, background: jouee ? N4.orange : N4.sable }} />
                );
              })}
              {/* Tête de lecture : filet encre-douce + point orange (avance en continu). */}
              {enLecture ? (
                <div style={{ position: "absolute", left: tete * lOnde, top: -0.006 * W, bottom: -0.006 * W, width: filet + 1, marginLeft: -(filet + 1) / 2, background: N4.encreDouce }}>
                  <div style={{ position: "absolute", left: "50%", top: -0.009 * W, width: 0.018 * W, height: 0.018 * W, marginLeft: -0.009 * W, borderRadius: "50%", background: N4.orange, boxShadow: microOmbre(W, 0.18) }} />
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: POLICES.texte, fontSize: corps, lineHeight: 1.1, ...TABULAIRE }}>
              <span style={{ color: enLecture ? N4.orangeProfond : N4.sableProfond }}>{minSec(tete * p.dureeLecture)}</span>
              <span style={{ color: N4.sableProfond }}>{minSec(Math.round(p.dureeLecture))}</span>
            </div>
          </div>
        </div>

        {/* Transcription : le contenu principal. Mots sable (à venir) → encre (dits) ; mots forts surlignés. */}
        <div style={{ display: "flex", flexDirection: "column", gap: tailleT * 0.14, opacity: eTexte.o, transform: `translateY(${eTexte.d * dy}px)` }}>
          {lignes.map((ligne, i) => {
            // Éclat de ligne (N2) : quand un mot fort de la ligne est dit, toute la ligne passe 0,16 s sur l'orange.
            const eclatLigne = ligne.some((m) => m.fort && enEclat(t, m.a));
            return (
            <div key={i} style={{ position: "relative", display: "flex", alignItems: "baseline", gap: tailleT * 0.27, flexWrap: "nowrap" }}>
              {eclatLigne ? <div style={{ position: "absolute", left: -0.03 * W, right: -0.03 * W, top: -0.018 * W, bottom: -0.018 * W, borderRadius: 0.016 * W, background: DEGRADE_ORANGE }} /> : null}
              {ligne.map((m, k) => {
                const dit = t >= m.a;
                if (!m.fort) {
                  return (
                    <span key={k} style={{ position: "relative", fontFamily: POLICES.texte, fontSize: tailleT, lineHeight: 1.2, color: eclatLigne ? N4.ivoire : dit ? N4.encre : N4.sable, whiteSpace: "nowrap" }}>
                      {m.texte}
                    </span>
                  );
                }
                // Mot fort : surlignage qui se dessine de gauche à droite (glisse 0,16 s), après l'éclat de la ligne.
                const trace = glisse(t, m.a, 0.16);
                const flash = eclatLigne;
                const e = claque(t, m.a, 0.1);
                return (
                  <span key={k} style={{ position: "relative", display: "inline-block", padding: `0 ${tailleT * 0.16}px`, margin: `0 ${-tailleT * 0.06}px`, transform: dit ? `scale(${0.96 + 0.04 * e})` : undefined }}>
                    {dit ? (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "8%",
                          bottom: "2%",
                          width: `${100 * trace}%`,
                          borderRadius: tailleT * 0.14,
                          background: flash ? N4.orangeProfond : N4.orangeVoile,
                          boxShadow: flash ? `0 0 0 ${tailleT * 0.06}px ${encreA(0.06)}` : undefined,
                        }}
                      />
                    ) : null}
                    <span style={{ position: "relative", fontFamily: POLICES.texte, fontSize: tailleT, lineHeight: 1.2, color: !dit ? N4.sable : flash ? N4.ivoire : N4.encre, whiteSpace: "nowrap" }}>{m.texte}</span>
                  </span>
                );
              })}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Niveaux sonores RÉELS mesurés sur la prise de Will (`prise-large.mp4`, 17,6 → 22,4 s, RMS par tranche de 40 ms,
 * normalisé au maximum, exposant 0,7). Sert d'exemple : en production, mesurer la tranche de la prise couverte par la carte.
 */
export const EXEMPLE_NIVEAUX_PRISE = [
  0.46, 0.44, 0.35, 0.14, 0.12, 0.11, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.45, 0.79, 0.79, 0.52, 0.33, 0.28, 0.45, 0.42, 0.34, 0.18, 0.11, 0.11, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.11, 0.1, 0.1,
  0.1, 0.11, 0.12, 0.28, 0.55, 0.54, 0.35, 0.14, 0.11, 0.14, 0.59, 0.69, 0.64, 0.45, 0.48, 0.62, 0.64, 0.78, 0.83, 0.79, 0.46, 0.26, 0.16, 0.24, 0.48, 0.46, 0.21, 0.14, 0.12, 0.31, 0.78, 1.0, 0.76, 0.55, 0.65, 0.55, 0.53, 0.32, 0.25, 0.58,
  0.46, 0.21, 0.15, 0.45, 0.41, 0.19, 0.36, 0.6, 0.43, 0.34, 0.36, 0.36, 0.42, 0.44, 0.42, 0.37, 0.31, 0.16, 0.12, 0.1, 0.11, 0.3, 0.53, 0.55, 0.49, 0.56, 0.81, 0.57, 0.21, 0.31, 0.68, 0.59, 0.35, 0.16, 0.41, 0.82, 0.74, 0.57, 0.63, 0.54,
];

export const PHRASE_MESSAGE_VOCAL = "Beaucoup de dirigeants nous disent la même chose : ils finissent leurs devis le dimanche soir.";

export const EXEMPLE_MESSAGE_VOCAL_TYPE = {
  debut: 0,
  fin: 5.2,
  entete: "Situation fréquente",
  horodatage: "Message vocal · 21:47",
  lectureA: 0.3,
  dureeLecture: 4.4,
  niveaux: EXEMPLE_NIVEAUX_PRISE,
  pasNiveaux: 0.04,
  transcription: [
    [{ texte: "Ils", a: 2.3 }, { texte: "finissent", a: 2.42 }, { texte: "leurs", a: 2.72 }, { texte: "devis", a: 2.88, fort: true }],
    [{ texte: "le", a: 3.2 }, { texte: "dimanche soir.", a: 3.3, fort: true }],
  ],
} satisfies Omit<MessageVocalTypeProps, "t" | "largeurImage" | "hauteurImage">;

/** Alias au nom normalisé (`EXEMPLE_<ID>`, id `message-vocal`), avec la phrase dite. */
export const EXEMPLE_MESSAGE_VOCAL = { phrase: PHRASE_MESSAGE_VOCAL, ...EXEMPLE_MESSAGE_VOCAL_TYPE };

/** Instant le plus représentatif : onde aux 3/4, les deux mots forts surlignés, « dimanche soir » posé. */
export const INSTANT_FIXE_MESSAGE_VOCAL = 3.7;
/** Instant de construction : lecture lancée, transcription encore en attente. */
export const INSTANT_CONSTRUCTION_MESSAGE_VOCAL = 1.4;
