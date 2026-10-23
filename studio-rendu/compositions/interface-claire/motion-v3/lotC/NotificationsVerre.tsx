import React from "react";
/**
 * n° 12 `notifications-verre` (lot C, standard v3 § G) : jusqu'à 3 bulles de verre ivoire en bas (x 0,08-0,92, y 0,67-0,91)
 * qui MONTENT du bas en VERRE (rotateX 18° → 0 avec PIVOT, mise au point) en cascade ; les précédentes RECULENT en
 * profondeur (échelle 0,94 puis 0,88, opacité 0,85 puis 0,65) et sont décalées de 0,078 H vers le haut : leur titre reste
 * LISIBLE. Sortie : glissement à droite et un peu vers le haut en cascade (FOUET, flou directionnel) ; l'icône part avec sa bulle.
 * Chaque bulle porte une icône dans une pastille orange et un message DIT (60 px, aucune sous-ligne).
 * Visage : entier — la pile ne monte jamais au-dessus de 0,669 H et la sortie part sur le côté (jamais dans Z).
 */
import { Icone } from "../../elements";
import { courbe, Flou, lerp, NUANCES, Perspective, PropsElement, ReflePassant, ressort, SonElement, styleOrange, styleVerre, texte, vitesse } from "./commun-lotC";

export type Bulle = { message: string; icone: string; a: number };
export type PropsNotificationsVerre = PropsElement & { bulles?: Bulle[]; sortieA?: number };

const DEMO: Bulle[] = [
  { message: "Relance envoyée", icone: "mail", a: 0 },
  { message: "Devis signé", icone: "coche", a: 13 },
  { message: "Rendez-vous confirmé", icone: "calendrier", a: 26 },
];

export const SONS_NOTIFICATIONS: readonly SonElement[] = [
  [0, "vibreur", 0.5],
  [1, "ding-1", 0.6],
  [14, "ding-2", 0.6],
  [27, "ding-3", 0.6],
  [58, "whoosh-out", 0.55],
];

export function NotificationsVerre({ i, W = 1080, H = 1920, bulles = DEMO, sortieA = 58 }: PropsNotificationsVerre) {
  if (i < 0 || i > sortieA + 3 * bulles.length + 14) return null;
  const l = 0.84 * W;
  const x = 0.08 * W;
  const hb = 0.09 * H;
  const rayon = 0.035 * W;
  const centreFront = 0.865 * H;
  const pas = 0.078 * H;
  const n = bulles.length;
  let sx = 0;
  let sy = 0;
  bulles.forEach((b, k) => {
    sy = Math.max(sy, vitesse((j) => ressort("VERRE", j - b.a), i) * 0.07 * H * 0.22);
    sx = Math.max(sx, vitesse((j) => ressort("FOUET", j - (sortieA + 3 * k)), i) * 1.4 * W * 0.2);
  });
  return (
    <Flou sx={Math.min(0.02 * W, sx)} sy={Math.min(0.012 * W, sy)}>
      <Perspective W={W} origine="50% 100%">
        {bulles.map((b, k) => {
          const k0 = i - b.a;
          if (k0 < 0) return null;
          const out = ressort("FOUET", i - (sortieA + 3 * k));
          if (i > sortieA + 3 * k + 9) return null;
          // Rang de profondeur : 0 = devant ; chaque bulle qui arrive ensuite repousse celle-ci d'un cran (ressort VERRE).
          let rang = 0;
          for (let m = k + 1; m < n; m++) rang += ressort("VERRE", i - bulles[m].a);
          const echelle = rang <= 1 ? lerp(1, 0.94, rang) : lerp(0.94, 0.88, Math.min(1, rang - 1));
          const opacite = rang <= 1 ? lerp(1, 0.88, rang) : lerp(0.88, 0.66, Math.min(1, rang - 1));
          const entree = ressort("VERRE", k0);
          const pivot = ressort("PIVOT", k0);
          const calme = out === 0 && k0 > 14;
          const flot = calme ? Math.sin((2 * Math.PI * (i + k * 9)) / 60) * 0.003 * H : 0;
          const cy = centreFront - rang * pas + lerp(0.16 * H, 0, entree) + flot;
          const rx = lerp(18, 0, pivot);
          const mise1 = 0.006 * W * (1 - courbe(k0, 0, 4));
          const dxOut = 1.45 * W * out;
          const dyOut = -0.04 * H * out;
          const rzOut = 4 * out;
          const pastille = hb * 0.64;
          const tMsg = 0.056 * W;
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: x,
                top: cy - hb / 2,
                width: l,
                height: hb,
                transform: `translateX(${dxOut}px) translateY(${dyOut}px) rotateX(${rx}deg) rotateZ(${rzOut}deg) scale(${echelle})`,
                transformOrigin: "50% 100%",
                opacity: opacite * Math.min(1, k0 / 2 + 0.2),
                filter: mise1 > 0.3 ? `blur(${mise1}px)` : undefined,
                zIndex: k,
                ...styleVerre(W, rayon, { proche: 1 + 0.15 * (n - 1 - Math.min(rang, n - 1)) }),
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: hb * 0.24,
                padding: `0 ${hb * 0.22}px`,
              }}
            >
              <div style={{ width: pastille, height: pastille, flexShrink: 0, ...styleOrange(W, pastille * 0.3, 0.5), display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.5 + 0.5 * ressort("JAILLIR", k0 - 2)})` }}>
                <Icone nom={b.icone} taille={pastille * 0.56} couleur={NUANCES.ivoire} epaisseur={2.8} />
              </div>
              <span style={{ ...texte(tMsg, NUANCES.encre), whiteSpace: "nowrap", flex: 1 }}>{b.message}</span>
              <ReflePassant i={k0} i0={8} W={l} n={10} hauteur={hb} force={0.5} />
              <ReflePassant i={k0} i0={44} W={l} n={10} hauteur={hb} force={0.4} />
            </div>
          );
        })}
      </Perspective>
    </Flou>
  );
}
