/**
 * Modèle 8 — ICÔNE + MOT, style « Spectaculaire » (lot F2) : l'icône se trace en néon, géante, au centre d'anneaux de
 * lumière qui pulsent ; au mot dit, elle recule en haut (flou marqué) et le mot S'ÉCRASE depuis la caméra, en orange,
 * avec son onde de choc ; un balayage de lumière passe sur les lettres, le sens rebondit dessous.
 */
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import type { DonneesIconeMot } from "../../../../../src/briques/motion/types-etendus";
import { geometrieIconeMot, motMarque } from "../MotionIconeMot";
import { avecOpacite, borne, COULEURS, courbe, Eclats, FiligraneSpec, FlouFort, IconeSpec, MotsGeants, SceneSpectaculaire, useSpec } from "./noyau";

function Contenu({ d }: { d: DonneesIconeMot }) {
  const { t, u, zoneCentree: z, taille, entree, mesurer, moitie } = useSpec();
  const tMot = Math.max(entree + 0.85, d.aSec ?? 0);
  const mot = motMarque(d.mot);
  // Position finale : la même géométrie que le style Sobre (côte à côte en moitié haute) ; l'icône y arrive en reculant.
  const g = geometrieIconeMot(d, z, moitie, u, { affiche: taille("affiche"), titre: taille("titre"), corps: Math.round(taille("corps") * 1.02), legende: taille("legende") }, (tx, ta, gr, l, n) => mesurer(tx, ta, gr, l, n) * 1.03);
  const tailleMot = g.tailleMot;
  const hMot = g.hMot;
  const petite = g.icone;
  const grande = Math.round(Math.min(z.largeur * 0.62, z.hauteur * (moitie ? 0.7 : 0.4)));
  const k = courbe("signature")(borne((t - (tMot - 0.35)) / 0.45));
  const kAvant = courbe("signature")(borne((t - 1 / 50 - (tMot - 0.35)) / 0.45));
  const tailleIcone = grande + (petite - grande) * k;
  const xGrande = z.x + z.largeur / 2;
  const yGrande = z.y + z.hauteur * (moitie ? 0.5 : 0.42);
  const cx = xGrande + (g.cx - xGrande) * k;
  const cy = yGrande + (g.cy - yGrande) * k;
  const cyAvant = yGrande + (g.cy - yGrande) * kAvant;
  const yMot = g.texte.y;
  const pulse = (i: number) => ((t * 0.7 + i / 3) % 1);
  return (
    <>
      {/* Anneaux de lumière qui partent de l'icône. */}
      {[0, 1, 2].map((i) => {
        const p = pulse(i);
        const r = tailleIcone * (0.6 + 0.9 * p);
        return <div key={i} style={{ position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `${(3 * u).toFixed(1)}px solid ${avecOpacite(COULEURS.orangeVif, 0.5 * (1 - p) * borne((t - entree) / 0.3))}`, boxShadow: `0 0 ${24 * u}px ${avecOpacite(COULEURS.orangeVif, 0.35 * (1 - p))}` }} />;
      })}
      <div style={{ position: "absolute", left: cx - tailleIcone * 0.9, top: cy - tailleIcone * 0.9, width: tailleIcone * 1.8, height: tailleIcone * 1.8, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.orange, 0.45)}, ${avecOpacite(COULEURS.orange, 0)} 65%)` }} />
      {d.surTitre && (
        <div style={{ position: "absolute", left: g.sur.x, width: g.sur.largeur, top: g.haut, display: "flex", justifyContent: g.texte.centre ? "center" : "flex-start", alignItems: "center", gap: 22 * u, opacity: borne((t - tMot + 0.1) / 0.2) }}>
          {g.texte.centre && <div style={{ height: Math.max(3, 4 * u), width: 90 * u * courbe("glisse")(borne((t - tMot) / 0.5)), background: COULEURS.orangeVif, boxShadow: `0 0 ${14 * u}px ${COULEURS.orangeVif}` }} />}
          <MotsGeants texte={d.surTitre.toUpperCase()} debut={tMot - 0.05} taille={taille("legende")} graisse={800} effet="etire" couleur={COULEURS.orangeVif} decalage={0.06} approche={0.16} />
          <div style={{ height: Math.max(3, 4 * u), width: 90 * u * courbe("glisse")(borne((t - tMot) / 0.5)), background: COULEURS.orangeVif, boxShadow: `0 0 ${14 * u}px ${COULEURS.orangeVif}` }} />
        </div>
      )}
      <FlouFort dy={(cy - cyAvant) * 1.2} style={{ position: "absolute", left: cx - tailleIcone / 2, top: cy - tailleIcone / 2, width: tailleIcone, height: tailleIcone }}>
        <IconeSpec nom={d.icone} taille={tailleIcone} debut={entree - 0.2} couleur={COULEURS.creme} epaisseur={1.7} duree={0.55} />
      </FlouFort>
      <div style={{ position: "absolute", left: g.texte.x, width: g.texte.largeur, top: yMot, display: "flex", flexDirection: "column", alignItems: g.texte.centre ? "center" : "flex-start", gap: 30 * u }}>
        <MotsGeants texte={mot} debut={tMot} taille={tailleMot} graisse={900} effet="ecrase" alignement={g.texte.centre ? "center" : "left"} largeurMax={g.texte.largeur} interligne={1} />
        {d.sousTitre && <MotsGeants texte={d.sousTitre} debut={tMot + 0.6} taille={Math.round(taille("corps") * 1.02)} graisse={700} effet="etire" alignement={g.texte.centre ? "center" : "left"} largeurMax={g.texte.largeur * (g.texte.centre ? 0.9 : 1)} couleur={COULEURS.creme} decalage={0.06} interligne={1.15} approche={-0.01} />}
      </div>
      <Eclats x={g.texte.x + g.texte.largeur / 2} y={yMot + hMot / 2} debut={tMot + 0.3} rayon={z.largeur * 0.42} nombre={30} graine={17} />
    </>
  );
}

function Decor({ d }: { d: DonneesIconeMot }) {
  const { largeur, hauteur } = useSpec();
  return <FiligraneSpec texte={d.mot.replace(/\*/g, "").trim().charAt(0).toUpperCase()} x={largeur * 0.5} y={hauteur * 0.5} taille={hauteur * 0.75} debut={0.3} />;
}

export function IconeMotSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesIconeMot }) {
  return (
    <SceneSpectaculaire mp={p} decor={<Decor d={p.donnees} />}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
