/**
 * VIGNETTE AXION V2 (lot 1) — une image fixe. DESSIN SEULEMENT : les règles sont dans `socle.ts`, `mises.ts`, `titre.ts`
 * (purs, testés). Référence visuelle : `docs/vignettes/v2/gabarit/socle.css`.
 * Calques (z) : fond d'ambiance → image pleine (repli) ou sujet détouré → voile → titre → signature, liseré, carré → grain.
 * Police : Montserrat ExtraBold, chargée en local, attendue avant la mesure du titre.
 */
import { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Img } from "remotion";
import montserratExtraBold from "../polices/Montserrat-ExtraBold.ttf";
import { FAMILLE_MONTSERRAT } from "../polices";
import { boiteTitre, INTERLIGNE_TITRE, MISE_INSTAGRAM, MISES, placerSujet, type MiseDef, type PositionSujet } from "./mises";
import { AMBIANCES, dimensionsVignette, IVOIRE_CARRE, ORANGE_VIF, proprietesVignette, type EntreeVignette } from "./socle";
import { mettreTitreVignette, type TitreVignette } from "./titre";

export type ProprietesVignetteAxion = EntreeVignette;

type Mesure = (texte: string, taillePx: number) => number;

let police: Promise<Mesure> | null = null;
/** Charge Montserrat ExtraBold une fois, puis renvoie une mesure de largeur faite avec elle (interlettrage compris). */
function mesureAvecPolice(): Promise<Mesure> {
  if (!police) {
    police = new FontFace(FAMILLE_MONTSERRAT, `url(${montserratExtraBold})`, { weight: "800" }).load().then((face) => {
      document.fonts.add(face);
      const ctx = document.createElement("canvas").getContext("2d")!;
      return (texte: string, taille: number) => {
        ctx.font = `800 ${taille}px "${FAMILLE_MONTSERRAT}"`;
        ctx.letterSpacing = `${-0.035 * taille}px`;
        return ctx.measureText(texte).width;
      };
    });
    police.catch(() => {
      police = null;
    });
  }
  return police;
}

/** Dimensions réelles d'une image (le sujet détouré n'a pas de taille imposée). */
function dimensionsImage(url: string): Promise<{ l: number; h: number }> {
  return new Promise((ok, ko) => {
    const i = new window.Image();
    i.onload = () => ok({ l: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => ko(new Error("Sujet de la vignette illisible"));
    i.src = url;
  });
}

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function VignetteAxion(entree: ProprietesVignetteAxion) {
  const p = proprietesVignette(entree);
  const { largeur, hauteur } = dimensionsVignette(p.ratio);
  const vertical = p.ratio === "9:16";
  const amb = AMBIANCES[p.ambiance];
  const encre = p.ambiance === "encre";
  const def: MiseDef = p.instagram ? MISE_INSTAGRAM : MISES[p.ratio][p.mise];
  const T = def.titre;

  const [attente] = useState(() => delayRender("Mise en page de la vignette"));
  const [titre, setTitre] = useState<TitreVignette | null>(null);
  const [position, setPosition] = useState<PositionSujet | null>(null);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const mesurer = await mesureAvecPolice();
      if (p.sujet && !p.instagram) {
        const dims = await dimensionsImage(p.sujet);
        if (vivant) setPosition(placerSujet(dims, p.boiteVisage, p.mise, p.ratio));
      }
      if (vivant) setTitre(mettreTitreVignette({ couverture: p.couverture ?? "", motCle: p.motCle, ratio: p.ratio, mise: p.mise, taille: T.taille, largeur: T.largeur, mesurer }));
      continueRender(attente);
    })().catch((e: unknown) => cancelRender(e instanceof Error ? e : new Error("Vignette illisible")));
    return () => {
      vivant = false;
    };
    // Une image fixe : les propriétés ne changent pas pendant le rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lignes = titre?.lignes ?? [];
  const taille = titre?.taillePx ?? T.taille;
  const boite = boiteTitre(T, lignes.length, taille);
  const halo = `${def.halo.hx}% ${def.halo.hy}%`;
  const fond = encre
    ? `radial-gradient(60% 75% at ${halo}, rgba(224,112,64,.72) 0%, rgba(180,79,41,.36) 38%, rgba(17,10,5,0) 72%), radial-gradient(120% 100% at 50% 50%, ${amb.centre} 0%, ${amb.fond} 70%)`
    : `radial-gradient(55% 70% at ${halo}, rgba(224,112,64,.55) 0%, rgba(224,112,64,.18) 40%, rgba(233,220,200,0) 70%), linear-gradient(160deg, ${amb.degrade!.haut} 0%, ${amb.degrade!.milieu} 55%, ${amb.degrade!.bas} 100%)`;
  const teinte = (a: number) => `rgba(${amb.voile},${a})`;

  // Repli sans détourage : l'image pleine, fondue vers l'ambiance du côté du titre.
  const sensFondu = vertical ? (T.ancre === "haut" ? "180deg" : "0deg") : "90deg";
  const filtreSujet = encre
    ? "contrast(1.08) saturate(1.08) drop-shadow(0 0 1.5px rgba(255,214,180,.95)) drop-shadow(0 0 14px rgba(224,112,64,.85)) drop-shadow(0 30px 40px rgba(0,0,0,.55))"
    : `contrast(1.06) saturate(1.06) drop-shadow(0 0 0 #fff) drop-shadow(14px 12px 0 ${ORANGE_VIF}) drop-shadow(0 26px 34px rgba(17,10,5,.35))`;

  const contour = encre
    ? { textShadow: `0 3px 0 ${amb.contour}, 0 0 18px rgba(10,6,4,.92), 0 0 44px rgba(10,6,4,.7)` }
    : { WebkitTextStroke: `16px ${amb.contour}`, paintOrder: "stroke fill" as const };
  const r = p.reperes;
  const voileH = (T.ancre === "haut" ? T.y : hauteur - T.y) + (vertical ? 520 : 300);

  return (
    <AbsoluteFill style={{ background: amb.fond, overflow: "hidden", isolation: "isolate" }}>
      <div style={{ position: "absolute", inset: 0, background: fond }} />
      {p.image && !p.instagram && !p.sujet && (
        <>
          <Img src={p.image} style={{ position: "absolute", inset: 0, width: largeur, height: hauteur, objectFit: "cover", filter: "contrast(1.04) saturate(1.06)" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${sensFondu}, ${teinte(0.96)} 0%, ${teinte(0.7)} 38%, ${teinte(0)} 74%)` }} />
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 70% at ${halo}, rgba(224,112,64,${encre ? 0.35 : 0.22}) 0%, rgba(224,112,64,0) 70%)`, mixBlendMode: "screen" }} />
        </>
      )}
      {p.sujet && !p.instagram && position && (
        <Img
          src={p.sujet}
          style={{
            position: "absolute", maxWidth: "none", left: position.gauche, top: position.haut, width: position.largeur, height: position.hauteur, zIndex: 3, filter: filtreSujet,
            WebkitMaskImage: "linear-gradient(to bottom, #000 62%, transparent 96%)", maskImage: "linear-gradient(to bottom, #000 62%, transparent 96%)",
          }}
        />
      )}
      {lignes.length > 0 && (
        <div
          style={{
            position: "absolute", left: 0, right: 0, zIndex: 5, pointerEvents: "none", height: voileH,
            ...(T.ancre === "haut" ? { top: 0 } : { bottom: 0 }),
            background: `linear-gradient(${T.ancre === "haut" ? "to bottom" : "to top"}, ${teinte(0.92)} 0%, ${teinte(0.78)} 45%, ${teinte(0)} 100%)`,
            opacity: encre ? (vertical ? 1 : 0.75) : 0.8,
          }}
        />
      )}
      {lignes.length > 0 && (
        <div
          style={{
            position: "absolute", zIndex: 7, left: boite.x, top: boite.y, width: boite.largeur, fontFamily: `"${FAMILLE_MONTSERRAT}"`, fontWeight: 800, fontSize: taille,
            lineHeight: INTERLIGNE_TITRE, letterSpacing: "-0.035em", textTransform: "uppercase", color: amb.texte, textAlign: T.align === "centre" ? "center" : "left", ...contour,
          }}
        >
          {lignes.map((l, i) => (
            <div key={i} style={{ whiteSpace: "nowrap" }}>
              {l.map((u, j) =>
                u.pave ? (
                  <span
                    key={j}
                    style={{ background: amb.pave, color: amb.paveTexte, padding: ".02em .14em 0", margin: "0 .02em", display: "inline-block", lineHeight: 1, textShadow: "none", WebkitTextStroke: 0, transform: "rotate(-1.5deg)", boxShadow: "0 10px 26px rgba(17,10,5,.35)" }}
                  >
                    {u.texte}
                  </span>
                ) : (
                  <span key={j}>{u.texte}</span>
                ),
              ).reduce<React.ReactNode[]>((acc, el, j) => (j ? [...acc, " ", el] : [el]), [])}
            </div>
          ))}
        </div>
      )}
      {r.signature && (
        <div
          style={{
            position: "absolute", zIndex: 9, left: r.signature.x, top: r.signature.y, fontFamily: `"${FAMILLE_MONTSERRAT}"`, fontWeight: 800, fontSize: 30, lineHeight: 1, letterSpacing: ".04em",
            color: encre ? IVOIRE_CARRE : amb.texte, ...(encre ? { textShadow: "0 2px 0 #120B07, 0 0 14px rgba(10,6,4,.9)" } : { WebkitTextStroke: `8px ${amb.contour}`, paintOrder: "stroke fill" as const }),
          }}
        >
          axion-ia.com
        </div>
      )}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: r.lisere, background: amb.lisere, zIndex: 9 }} />
      <div
        style={{
          position: "absolute", zIndex: 9, left: r.carre.x, top: r.carre.y, width: r.carre.taille, height: r.carre.taille, background: ORANGE_VIF, display: "grid", placeItems: "center",
          fontFamily: `"${FAMILLE_MONTSERRAT}"`, fontWeight: 800, fontSize: vertical ? 56 : 40, lineHeight: 1, letterSpacing: -1, color: IVOIRE_CARRE, boxShadow: "0 6px 18px rgba(17,10,5,.35)",
        }}
      >
        A
      </div>
      <div style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none", opacity: 0.16, mixBlendMode: "overlay", backgroundImage: GRAIN }} />
    </AbsoluteFill>
  );
}
