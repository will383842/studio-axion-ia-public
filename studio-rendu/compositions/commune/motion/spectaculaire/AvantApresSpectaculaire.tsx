/**
 * Modèle 3 — AVANT / APRÈS, style « Spectaculaire » : deux colonnes en VRAIS VOLUMES 3D (faces avant, côté, dessus)
 * sur un sol lumineux, vues en perspective par une caméra qui tourne doucement. La colonne d'avant monte en comptant ;
 * au mot « après », la seconde naît à la même hauteur puis S'ÉCRASE jusqu'à sa valeur : le temps perdu part en
 * éclats. La pastille de l'écart s'écrase ensuite sur la scène, avec halo et balayage de lumière.
 */
import type { DonneesAvantApres, MiseEnPageCarte, ValeurAvantApres } from "../../../../../src/briques/motion/types";
import { ecartAvantApres } from "../MotionAvantApres";
import { formaterNombre, valeurCompteur } from "../noyau";
import { avecOpacite, Balayage, borne, COULEURS, courbe, Eclats, FlouFort, MotCle, MotsGeants, progres, rebondImpact, ressort, SceneSpectaculaire, useSpec } from "./noyau";

interface Colonne {
  x: number;
  h: number;
  dh: number;
  valeur: number;
  val: ValeurAvantApres;
  orange: boolean;
  visible: number;
  etiquette: string;
  debut: number;
}

function Volume({ c, lb, D, base, tailleValeur, tailleLegende }: { c: Colonne; lb: number; D: number; base: number; tailleValeur: number; tailleLegende: number }) {
  const { u, t } = useSpec();
  const face = c.orange ? `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange} 50%, ${COULEURS.orangeProfond})` : `repeating-linear-gradient(135deg, ${avecOpacite(COULEURS.creme, 0.08)} 0 ${10 * u}px, transparent ${10 * u}px ${22 * u}px), linear-gradient(180deg, ${COULEURS.surfaceHaute}, ${COULEURS.surface})`;
  const cote = c.orange ? `linear-gradient(180deg, ${COULEURS.orange}, ${COULEURS.orangeProfond})` : `linear-gradient(180deg, ${COULEURS.surface}, ${COULEURS.fond})`;
  const dessus = c.orange ? COULEURS.orangeVif : COULEURS.filet;
  return (
    <div style={{ position: "absolute", left: c.x, top: 0, width: lb, height: base, transformStyle: "preserve-3d", opacity: c.visible }}>
      <FlouFort dy={c.dh} style={{ position: "absolute", left: 0, top: 0, width: lb, height: base, transformStyle: "preserve-3d" }}>
        <div style={{ position: "absolute", left: 0, top: base - c.h, width: lb, height: c.h, background: face, transform: `translateZ(${(D / 2).toFixed(1)}px)`, boxShadow: c.orange ? `0 0 ${70 * u}px ${avecOpacite(COULEURS.orangeVif, 0.55)}` : `inset 0 0 0 ${2 * u}px ${COULEURS.filet}`, overflow: "hidden" }}>
          {c.orange && <Balayage debut={c.debut + 1.15} opacite={0.4} />}
        </div>
        <div style={{ position: "absolute", left: lb - D / 2, top: base - c.h, width: D, height: c.h, background: cote, transform: "rotateY(90deg)", filter: "brightness(0.72)" }} />
        <div style={{ position: "absolute", left: -D / 2, top: base - c.h, width: D, height: c.h, background: cote, transform: "rotateY(-90deg)", filter: "brightness(0.6)" }} />
        <div style={{ position: "absolute", left: 0, top: base - c.h - D / 2, width: lb, height: D, background: dessus, transform: "rotateX(90deg)", filter: "brightness(1.15)" }} />
      </FlouFort>
      {/* Valeur au-dessus de la colonne, dans le plan de la face avant. */}
      <div style={{ position: "absolute", left: -lb * 0.4, width: lb * 1.8, top: base - c.h - tailleValeur * 1.22, textAlign: "center", transform: `translateZ(${(D / 2).toFixed(1)}px)`, fontWeight: 900, fontSize: tailleValeur, letterSpacing: "-0.04em", lineHeight: 1, color: c.orange ? COULEURS.orangeVif : COULEURS.creme, fontVariantNumeric: "tabular-nums", textShadow: `0 ${8 * u}px ${30 * u}px ${avecOpacite(COULEURS.fondProfond, 0.8)}` }}>
        {formaterNombre(c.valeur, Number.isInteger(c.val.valeur) ? 0 : 1)}
        <span style={{ fontSize: "0.5em", marginLeft: "0.1em", color: c.orange ? COULEURS.orangeVif : COULEURS.cremeAttenuee }}>{c.val.unite}</span>
      </div>
      {/* Étiquette au sol, devant la colonne. */}
      <div style={{ position: "absolute", left: -lb * 0.45, width: lb * 1.9, top: base + 26 * u, textAlign: "center", transform: `translateZ(${(D / 2).toFixed(1)}px)`, opacity: progres(t, c.debut + 0.1, 0.3) }}>
        <div style={{ fontSize: tailleLegende, fontWeight: 800, letterSpacing: "0.12em", color: c.orange ? COULEURS.orangeVif : COULEURS.cremeAttenuee }}>{c.etiquette.toUpperCase()}</div>
        {c.val.libelle && <div style={{ fontSize: tailleLegende, fontWeight: 600, color: COULEURS.creme }}>{c.val.libelle}</div>}
      </div>
    </div>
  );
}

function Contenu({ d }: { d: DonneesAvantApres }) {
  const { t, u, zoneCentree: z, taille, largeur, entree, mesurer } = useSpec();
  const tAvant = entree + 0.1;
  const tApres = Math.max(tAvant + 0.9, d.aSecApres ?? 1.7);
  const tCrash = tApres + 0.3;
  const max = Math.max(d.avant.valeur, d.apres.valeur, 1e-6);
  const tailleTitre = Math.round(taille("titre") * 1.08);
  const tailleValeur = Math.round(taille("titre") * 1.45);
  const tailleLegende = taille("legende");
  const hTitre = d.titre ? mesurer(d.titre.replace(/\*/g, ""), tailleTitre, 900, z.largeur, "titre") + 30 * u : 0;
  const hPastille = taille("corps") * 2.1;
  const yPastille = z.y + hTitre + hPastille / 2 + 10 * u;
  const hautBarres = yPastille + hPastille / 2 + 30 * u + tailleValeur * 1.3;
  const base = z.y + z.hauteur - tailleLegende * 2.6 - 40 * u;
  const Hmax = Math.max(160 * u, base - hautBarres);
  const lb = Math.min(z.largeur * 0.27, 250 * u);
  const D = lb * 0.55;
  const ecartCols = z.largeur * 0.2;
  const xAvant = largeur / 2 - ecartCols / 2 - lb;
  const xApres = largeur / 2 + ecartCols / 2;

  const hAvant = (tt: number) => (tt <= tAvant ? 0 : ressort(tt - tAvant, "souple")) * (d.avant.valeur / max) * Hmax;
  // Après : naît à la hauteur d'avant (0,3 s), puis s'écrase d'un coup jusqu'à sa valeur (ressort qui rebondit).
  const hApres = (tt: number) => {
    if (tt < tApres) return 0;
    const naissance = courbe("signature")(borne((tt - tApres) / 0.25));
    const crash = tt < tCrash ? 0 : ressort(tt - tCrash, "chute");
    return naissance * ((d.avant.valeur / max) * (1 - crash) + (d.apres.valeur / max) * crash) * Hmax;
  };
  const vAvant = valeurCompteur(t, tAvant, 0, d.avant.valeur, 0.9);
  const vApres = t < tCrash ? d.avant.valeur : valeurCompteur(t, tCrash, d.avant.valeur, d.apres.valeur, 0.5);
  const ecart = d.ecart ?? ecartAvantApres(d.avant.valeur, d.apres.valeur);
  const tEcart = tCrash + 0.95;
  const ha = hAvant(t);
  const hp = hApres(t);
  const ry = -24 + 10 * courbe("glisse")(borne(t / 5));
  const rApres = rebondImpact(t, tCrash + 0.2, 16, 6);
  const colonnes: Colonne[] = [
    { x: xAvant, h: ha, dh: ha - hAvant(t - 1 / 50), valeur: vAvant, val: d.avant, orange: false, visible: borne((t - tAvant) / 0.15), etiquette: d.etiquetteAvant ?? "Avant", debut: tAvant },
    { x: xApres, h: hp, dh: hp - hApres(t - 1 / 50), valeur: vApres, val: d.apres, orange: true, visible: borne((t - tApres) / 0.12), etiquette: d.etiquetteApres ?? "Après", debut: tApres },
  ];
  const yHautPerdu = base - (d.avant.valeur / max) * Hmax * 0.55 - (d.apres.valeur / max) * Hmax * 0.45;
  const pastille = courbe("signature")(borne((t - tEcart) / 0.3));
  const mP = 1500 / (1500 - 1000 * (1 - pastille));
  const rP = rebondImpact(t, tEcart + 0.3, 20, 8);
  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: z.y }}>
          <MotsGeants texte={d.titre} debut={entree - 0.1} taille={tailleTitre} graisse={900} alignement="center" largeurMax={z.largeur} effet="ecrase" />
        </div>
      )}
      {/* Scène 3D : sol lumineux et deux volumes. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: largeur, height: base + 400 * u, perspective: `${(1400 * u).toFixed(0)}px`, perspectiveOrigin: `50% ${(base - Hmax * 0.6).toFixed(0)}px` }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateX(-10deg) rotateY(${ry.toFixed(3)}deg) scaleY(${(1 + 0.03 * rApres).toFixed(4)})`, transformOrigin: `${largeur / 2}px ${base}px` }}>
          <div style={{ position: "absolute", left: largeur / 2 - z.largeur * 0.6, top: base - z.largeur * 0.6, width: z.largeur * 1.2, height: z.largeur * 1.2, transform: "rotateX(90deg)", borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.orange, 0.35 * progres(t, tAvant, 0.6))}, ${avecOpacite(COULEURS.orange, 0)} 65%)`, border: `${2 * u}px solid ${avecOpacite(COULEURS.orangeVif, 0.25 * progres(t, tAvant, 0.6))}` }} />
          {colonnes.map((c, i) => (
            <Volume key={i} c={c} lb={lb} D={D} base={base} tailleValeur={tailleValeur} tailleLegende={tailleLegende} />
          ))}
        </div>
      </div>
      {/* Le temps perdu part en éclats quand la colonne d'après s'écrase. */}
      <Eclats x={xApres + lb / 2} y={yHautPerdu} debut={tCrash + 0.05} rayon={lb * 1.5} nombre={30} graine={7} />
      {ecart && t >= tEcart && (
        <div style={{ position: "absolute", left: largeur / 2, top: yPastille, transform: `translate(-50%, -50%) scale(${(mP * (1 + 0.22 * rP)).toFixed(4)}, ${(mP * (1 - 0.22 * rP)).toFixed(4)}) rotate(${((1 - pastille) * -12).toFixed(2)}deg)`, opacity: borne((t - tEcart) / 0.1) }}>
          <FlouFort dy={(1 - pastille) * 30 * u}>
            <div style={{ position: "relative", padding: `${14 * u}px ${34 * u}px`, borderRadius: 999, background: `linear-gradient(180deg, ${COULEURS.surfaceHaute}, ${COULEURS.fond})`, boxShadow: `0 0 0 ${3 * u}px ${COULEURS.orangeVif}, 0 ${16 * u}px ${50 * u}px ${avecOpacite(COULEURS.fondProfond, 0.7)}, 0 0 ${60 * u}px ${avecOpacite(COULEURS.orangeVif, 0.5)}`, fontSize: taille("corps") * 1.2, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden" }}>
              <MotCle mot={ecart} t={t} arrivee={tEcart + 0.3} balayage={tEcart + 0.55} u={u} />
            </div>
          </FlouFort>
        </div>
      )}
    </>
  );
}

export function AvantApresSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesAvantApres }) {
  return (
    <SceneSpectaculaire mp={p}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
