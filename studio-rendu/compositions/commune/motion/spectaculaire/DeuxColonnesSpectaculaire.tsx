/**
 * Modèle 5 — COMPARAISON, style « Spectaculaire » : deux disques arrivent du fond de la scène en se retournant (vraie
 * rotation 3D), chacun avec son icône, son titre et ses points. Au mot qui le dit, ils se percutent : éclair et éclats
 * au point de contact, l'intersection s'allume en orange, et les points communs s'écrasent au centre.
 */
import type { DonneesDeuxColonnes, MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import { avecOpacite, borne, COULEURS, courbe, Eclats, etatMot, FlouFort, IconeSpec, MotCle, MotsGeants, progres, rebondImpact, SceneSpectaculaire, useSpec } from "./noyau";

function Contenu({ d }: { d: DonneesDeuxColonnes }) {
  const { t, u, zoneCentree: z, taille, largeur, entree, mesurer } = useSpec();
  const tGauche = entree + 0.05;
  const tDroite = Math.max(tGauche + 0.5, d.aSecDroite ?? 1.4);
  const tCommun = Math.max(tDroite + 0.9, d.aSecCommun ?? 2.6);
  const tailleTitre = Math.round(taille("titre") * 1.08);
  const tailleLegende = taille("legende");
  const hTitre = d.titre ? mesurer(d.titre.replace(/\*/g, ""), tailleTitre, 900, z.largeur, "titre") + 50 * u : 0;
  const R = Math.min(z.largeur * 0.31, 280 * u);
  const largeurCol = largeur / 2 - z.x - 12 * u;
  const hPoints = (pts: string[]) => pts.reduce((h, p) => h + mesurer(p, tailleLegende, 700, largeurCol, "legende") + 14 * u, 0);
  const hTotal = hTitre + 2 * R + 50 * u + Math.max(hPoints(d.gauche.points), hPoints(d.droite.points)) + 40 * u + tailleLegende * 1.4 + tailleLegende * 2.2 + 20 * u;
  const y0 = z.y + Math.max(0, (z.hauteur - hTotal) / 2);
  const cy = y0 + hTitre + R;
  const yPoints = cy + R + 50 * u;
  const yCommun = yPoints + Math.max(hPoints(d.gauche.points), hPoints(d.droite.points)) + 40 * u;
  const demiFinal = R * 0.6;
  // Les disques viennent du fond (profondeur −900 px), écartés et retournés ; au contact, petit recul (rebond).
  const arrivee = (tt: number, debut: number) => courbe("signature")(borne((tt - debut) / 0.7));
  const demi = (tt: number, debut: number) => demiFinal + (1 - arrivee(tt, debut)) * R * 1.1 + (tt >= tCommun ? 26 * u * rebondImpact(tt, tCommun, 15, 6) : 0) + (tt < tCommun ? R * 0.12 * progres(tt, debut + 0.6, 0.3) * (1 - progres(tt, tCommun - 0.25, 0.25, "sortie")) : 0);
  const kC = progres(t, tCommun, 0.4, "signature");
  const disque = (cote: "gauche" | "droite") => {
    const c = d[cote];
    const debut = cote === "gauche" ? tGauche : tDroite;
    const signe = cote === "gauche" ? -1 : 1;
    const k = arrivee(t, debut);
    const cx = largeur / 2 + signe * demi(t, debut);
    const dx = cx - (largeur / 2 + signe * demi(t - 1 / 50, debut));
    const rot = signe * -180 * (1 - k);
    const zz = -900 * u * (1 - k);
    const xTexte = signe * R * 0.3;
    return (
      <div key={cote} style={{ position: "absolute", left: 0, top: 0, width: largeur, height: cy + R * 1.2, perspective: `${(1400 * u).toFixed(0)}px`, perspectiveOrigin: `50% ${cy.toFixed(0)}px`, opacity: borne((t - debut) / 0.12) }}>
        <FlouFort dx={dx} style={{ position: "absolute", left: cx - R, top: cy - R, width: R * 2, height: R * 2, transform: `translateZ(${zz.toFixed(1)}px) rotateY(${rot.toFixed(2)}deg)` }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle at 40% 35%, ${avecOpacite(COULEURS.creme, 0.1)}, ${avecOpacite(COULEURS.creme, 0.03)} 70%)`, boxShadow: `inset 0 0 0 ${Math.max(4, 5 * u)}px ${avecOpacite(COULEURS.creme, 0.8)}, 0 0 ${40 * u}px ${avecOpacite(COULEURS.creme, 0.15)}, 0 ${30 * u}px ${70 * u}px ${avecOpacite(COULEURS.fondProfond, 0.6)}`, backfaceVisibility: "hidden" }} />
          <div style={{ position: "absolute", left: R + xTexte - R * 0.55, width: R * 1.1, top: R * 0.52, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * u, textAlign: "center" }}>
            {c.icone && <IconeSpec nom={c.icone} taille={taille("titre") * 0.95} debut={debut + 0.35} />}
            <div style={{ fontSize: Math.round(taille("corps") * 0.98), fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{c.titre}</div>
          </div>
        </FlouFort>
      </div>
    );
  };
  const xg = largeur / 2 - demi(t, tGauche);
  const xd = largeur / 2 + demi(t, tDroite);
  const colonnePoints = (cote: "gauche" | "droite", debut: number) => {
    const c = d[cote];
    const x = cote === "gauche" ? z.x : largeur / 2 + 12 * u;
    return (
      <div style={{ position: "absolute", left: x, width: largeurCol, top: yPoints, display: "flex", flexDirection: "column", gap: 14 * u, alignItems: "center" }}>
        {c.points.map((p, i) => {
          const e = etatMot("etire", t, debut + 0.55 + i * 0.18, tailleLegende, u);
          return (
            <FlouFort key={i} dx={e.dx} style={{ display: "flex", alignItems: "center", gap: 14 * u, opacity: e.opacite, transform: `translateX(${e.tx.toFixed(2)}px) scale(${e.sx.toFixed(4)}, ${e.sy.toFixed(4)})`, transformOrigin: "0% 50%" }}>
              <div style={{ flex: "none", width: 16 * u, height: 16 * u, borderRadius: "50%", background: COULEURS.orangeVif, boxShadow: `0 0 ${12 * u}px ${COULEURS.orangeVif}` }} />
              <span style={{ fontSize: tailleLegende, fontWeight: 700, whiteSpace: "nowrap" }}>{p}</span>
            </FlouFort>
          );
        })}
      </div>
    );
  };
  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: y0 }}>
          <MotsGeants texte={d.titre} debut={entree - 0.1} taille={tailleTitre} graisse={900} alignement="center" largeurMax={z.largeur} effet="ecrase" />
        </div>
      )}
      {disque("gauche")}
      {disque("droite")}
      {/* Intersection, en 2D par-dessus (les disques sont posés) : s'allume au choc. */}
      {kC > 0 && (
        <svg width={largeur} height={cy + R * 1.3} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: kC, mixBlendMode: "screen" }}>
          <defs>
            <clipPath id="venn-spec">
              <circle cx={xg} cy={cy} r={R - 3 * u} />
            </clipPath>
            <radialGradient id="venn-spec-commun" cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor={COULEURS.orangeVif} />
              <stop offset="1" stopColor={COULEURS.orangeProfond} />
            </radialGradient>
          </defs>
          <circle cx={xd} cy={cy} r={R - 3 * u} clipPath="url(#venn-spec)" fill="url(#venn-spec-commun)" opacity={0.85 + 0.15 * Math.sin((t - tCommun) * 4)} />
        </svg>
      )}
      <Eclats x={largeur / 2} y={cy} debut={tCommun} rayon={R * 1.3} nombre={30} graine={11} />
      {colonnePoints("gauche", tGauche)}
      {colonnePoints("droite", tDroite)}
      <div style={{ position: "absolute", left: z.x, width: z.largeur, top: yCommun, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * u }}>
        {d.commun.titre && t >= tCommun + 0.25 && (
          <div style={{ fontSize: tailleLegende, fontWeight: 900, letterSpacing: "0.16em" }}>
            <MotCle mot={d.commun.titre.toUpperCase()} t={t} arrivee={tCommun + 0.3} balayage={tCommun + 0.7} u={u} />
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 * u }}>
          {d.commun.points.map((p, i) => {
            const e = etatMot("ecrase", t, tCommun + 0.45 + i * 0.12, tailleLegende, u);
            return (
              <FlouFort key={i} dy={e.dy} style={{ opacity: e.opacite, transform: `scale(${e.sx.toFixed(4)}, ${e.sy.toFixed(4)}) rotate(${e.rot.toFixed(2)}deg)` }}>
                <div style={{ padding: `${12 * u}px ${28 * u}px`, borderRadius: 999, background: `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange})`, boxShadow: `0 ${10 * u}px ${30 * u}px ${avecOpacite(COULEURS.fondProfond, 0.6)}, 0 0 ${40 * u}px ${avecOpacite(COULEURS.orangeVif, 0.45)}`, fontSize: tailleLegende, fontWeight: 800, whiteSpace: "nowrap" }}>{p}</div>
              </FlouFort>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function DeuxColonnesSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesDeuxColonnes }) {
  return (
    <SceneSpectaculaire mp={p}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
