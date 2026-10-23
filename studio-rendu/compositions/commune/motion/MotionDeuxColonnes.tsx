/**
 * Modèle 5 — COMPARAISON DEUX COLONNES AVEC LA ZONE COMMUNE : deux cercles se tracent et glissent l'un vers l'autre
 * jusqu'à se croiser ; chacun porte son titre et ses points ; au mot qui le dit, l'intersection s'allume en orange et
 * les points communs rebondissent au centre.
 */
import { DeuxColonnesSpectaculaire } from "./spectaculaire/DeuxColonnesSpectaculaire";
import type { DonneesDeuxColonnes, MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { avecOpacite, CarteMotion, COULEURS, deplacementObturateur, DUREES, echelleRessort, FlouMouvement, IconeTracee, progres, TexteCinetique, useMotion } from "./noyau";

function Contenu({ d }: { d: DonneesDeuxColonnes }) {
  const { t, u, zoneCentree: z, taille, chute, largeur, mesurer } = useMotion();
  const tGauche = 0.3;
  const tDroite = d.aSecDroite ?? 1.4;
  const tCommun = d.aSecCommun ?? 2.6;
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const hTitre = d.titre ? mesurer(d.titre, "titre", z.largeur) + 40 * u : 0;
  const R = Math.min(z.largeur * 0.3, 250 * u);
  const cy = z.y + hTitre + R + Math.max(3, 5 * u);
  const largeurCol = largeur / 2 - z.x - 12 * u;
  const hauteurPoints = (pts: string[]) => pts.reduce((h, p) => h + mesurer(p, "legende", largeurCol - 28 * u, 600) + 14 * u, 0);
  const yPoints = cy + R + 40 * u;
  const yCommun = yPoints + Math.max(hauteurPoints(d.gauche.points), hauteurPoints(d.droite.points)) + 30 * u;
  const ecartFinal = R * 0.62; // demi-distance des centres : intersection franche
  // Les cercles arrivent écartés puis glissent l'un vers l'autre (signature).
  const demi = (tt: number, debut: number) => ecartFinal + (1 - progres(tt, debut, 0.7, "signature")) * R * 0.5;
  const cxG = (tt: number) => largeur / 2 - demi(tt, tGauche);
  const cxD = (tt: number) => largeur / 2 + demi(tt, tDroite);
  const kG = progres(t, tGauche, 0.75, "glisse");
  const kD = progres(t, tDroite, 0.75, "glisse");
  const kC = progres(t, tCommun, 0.45, "signature");
  const pulse = 1 + 0.03 * Math.sin((t - tCommun) * 4) * progres(t, tCommun + 0.4, 0.4);
  const xg = cxG(t);
  const xd = cxD(t);
  const trait = Math.max(3, 5 * u);
  const rot = t * 10;

  const colonnePoints = (cote: "gauche" | "droite", debut: number) => {
    const c = cote === "gauche" ? d.gauche : d.droite;
    const x = cote === "gauche" ? z.x : largeur / 2 + 12 * u;
    return (
      <div style={{ position: "absolute", left: x, width: largeurCol, top: yPoints, display: "flex", flexDirection: "column", gap: 14 * u, alignItems: "center" }}>
        {c.points.map((p, i) => {
          const h = debut + 0.45 + i * 0.22;
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 * u, opacity: progres(t, h, 0.2) * (1 - s) }}>
              <div style={{ flex: "none", width: 14 * u, height: 14 * u, marginTop: taille("legende") * 0.45, borderRadius: "50%", background: COULEURS.cremeAttenuee, transform: `scale(${echelleRessort(t, h, chute + 9).toFixed(3)})` }} />
              <TexteCinetique texte={p} niveau="legende" debut={h} graisse={600} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: z.y }}>
          <TexteCinetique texte={d.titre} niveau="titre" debut={0.1} alignement="center" />
        </div>
      )}
      <FlouMouvement dx={deplacementObturateur(cxG, t) + deplacementObturateur(cxD, t)} style={{ position: "absolute", left: 0, top: 0, width: largeur, height: cy + R * 1.3, opacity: 1 - s }}>
        <svg width={largeur} height={cy + R * 1.3} style={{ overflow: "visible" }}>
          <defs>
            <clipPath id="venn-gauche">
              <circle cx={xg} cy={cy} r={R} />
            </clipPath>
            <radialGradient id="venn-commun" cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor={COULEURS.orangeVif} />
              <stop offset="1" stopColor={COULEURS.orangeProfond} />
            </radialGradient>
          </defs>
          <circle cx={xg} cy={cy} r={R} fill={avecOpacite(COULEURS.creme, 0.045 * kG)} />
          <circle cx={xd} cy={cy} r={R} fill={avecOpacite(COULEURS.creme, 0.045 * kD)} />
          {/* Intersection. */}
          <circle cx={xd} cy={cy} r={R} clipPath="url(#venn-gauche)" fill="url(#venn-commun)" opacity={0.92 * kC} style={{ filter: `drop-shadow(0 0 ${30 * u}px ${avecOpacite(COULEURS.orangeVif, 0.6)})` }} transform={`translate(${largeur / 2} ${cy}) scale(${pulse.toFixed(4)}) translate(${-largeur / 2} ${-cy})`} />
          <circle cx={xg} cy={cy} r={R} fill="none" stroke={COULEURS.creme} strokeOpacity={0.75} strokeWidth={trait} pathLength={1} strokeDasharray={`${kG.toFixed(4)} 1`} strokeLinecap="round" transform={`rotate(${(-120 + rot).toFixed(2)} ${xg} ${cy})`} />
          <circle cx={xd} cy={cy} r={R} fill="none" stroke={COULEURS.creme} strokeOpacity={0.75} strokeWidth={trait} pathLength={1} strokeDasharray={`${kD.toFixed(4)} 1`} strokeLinecap="round" transform={`rotate(${(-60 - rot).toFixed(2)} ${xd} ${cy})`} />
        </svg>
      </FlouMouvement>
      {/* Titres et icônes au cœur de chaque cercle (hors intersection). */}
      {(["gauche", "droite"] as const).map((cote) => {
        const c = d[cote];
        const debut = cote === "gauche" ? tGauche : tDroite;
        const cx = cote === "gauche" ? xg - R * 0.32 : xd + R * 0.32;
        const largeurTexte = R * 1.05;
        return (
          <div key={cote} style={{ position: "absolute", left: cx - largeurTexte / 2, width: largeurTexte, top: cy - R * 0.42, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 * u, opacity: 1 - s }}>
            {c.icone && <IconeTracee nom={c.icone} taille={taille("titre") * 0.9} debut={debut + 0.15} couleur={COULEURS.creme} epaisseur={2.2} />}
            <TexteCinetique texte={c.titre} niveau="corps" debut={debut + 0.2} alignement="center" graisse={800} largeurMax={largeurTexte} />
          </div>
        );
      })}
      {colonnePoints("gauche", tGauche)}
      {colonnePoints("droite", tDroite)}
      {/* Zone commune : étiquette et points communs, au centre. */}
      <div style={{ position: "absolute", left: z.x, width: z.largeur, top: yCommun, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 * u, opacity: 1 - s }}>
        {d.commun.titre && <TexteCinetique texte={d.commun.titre.toUpperCase()} niveau="legende" debut={tCommun + 0.1} couleur={COULEURS.orangeVif} graisse={700} alignement="center" style={{ letterSpacing: "0.14em" }} />}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 * u }}>
          {d.commun.points.map((p, i) => {
            const h = tCommun + 0.25 + i * DUREES.decalage * 2;
            return (
              <div key={i} style={{ transform: `scale(${echelleRessort(t, h, chute + i * 0.03).toFixed(4)})`, padding: `${12 * u}px ${26 * u}px`, borderRadius: 999, background: `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange})`, boxShadow: `0 ${10 * u}px ${30 * u}px ${avecOpacite(COULEURS.fondProfond, 0.55)}`, fontSize: taille("legende"), fontWeight: 700, color: COULEURS.creme, whiteSpace: "nowrap" }}>
                {p}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function MotionDeuxColonnes(p: MiseEnPageCarte & { donnees: DonneesDeuxColonnes }) {
  if (p.style === "spectaculaire") return <DeuxColonnesSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
