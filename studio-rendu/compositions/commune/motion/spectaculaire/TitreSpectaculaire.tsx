/**
 * Modèle 6 — TITRE OU GÉNÉRIQUE, style « Spectaculaire » : le sur-titre arrive étiré entre deux traits de lumière, puis
 * le titre tombe LETTRE À LETTRE depuis la caméra et s'écrase sur la page (chaque lettre rebondit) ; le mot clé
 * s'allume en orange avec son halo, un éclat de lumière (reflet d'objectif) traverse l'image et un balayage passe sur
 * les lettres. Le sous-titre rebondit dessous. Générique : le titre puis 2 à 5 lignes qui jaillissent l'une après
 * l'autre. Jamais choisi tout seul (B.21).
 */
import type { DonneesTitre, MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import { titreMarque } from "../MotionTitre";
import { avecOpacite, borne, COULEURS, courbe, decouper, etatMot, FlouFort, MotCle, MotsGeants, progres, SceneSpectaculaire, useSpec } from "./noyau";
import { tailleQuiTient } from "../../../../../src/briques/motion/mesure";

const DECALAGE_LETTRE = 0.045;

/** Reflet d'objectif : une traînée horizontale et un éclat qui traversent l'image une fois. */
function Reflet({ debut }: { debut: number }) {
  const { t, largeur: L, hauteur: H, u } = useSpec();
  const k = borne((t - debut) / 0.9);
  if (k <= 0 || k >= 1) return null;
  const x = -0.3 * L + courbe("glisse")(k) * 1.6 * L;
  const y = H * 0.44;
  const a = Math.sin(k * Math.PI);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: L, height: H, mixBlendMode: "screen", pointerEvents: "none", opacity: a }}>
      <div style={{ position: "absolute", left: x - L * 0.6, top: y - 3 * u, width: L * 1.2, height: 6 * u, background: `linear-gradient(90deg, ${avecOpacite(COULEURS.orangeVif, 0)}, ${avecOpacite(COULEURS.creme, 0.8)} 50%, ${avecOpacite(COULEURS.orangeVif, 0)})`, filter: `blur(${2 * u}px)` }} />
      <div style={{ position: "absolute", left: x - 140 * u, top: y - 140 * u, width: 280 * u, height: 280 * u, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.creme, 0.75)}, ${avecOpacite(COULEURS.orangeVif, 0.35)} 25%, ${avecOpacite(COULEURS.orange, 0)} 65%)` }} />
    </div>
  );
}

function TitreLettres({ texte, debut, taille }: { texte: string; debut: number; taille: number }) {
  const { t, u } = useSpec();
  const { mots, cles } = decouper(texte);
  let rang = 0;
  const finCles = debut + (texte.replace(/\s|\*/g, "").length + 2) * DECALAGE_LETTRE + 0.35;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.24em", fontSize: taille, fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.035em" }}>
      {mots.map((mot, i) => (
        <span key={i} style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
          {cles.has(i) ? (
            // Le mot clé arrive d'un bloc (écrasé), puis s'allume.
            (() => {
              const d = debut + rang * DECALAGE_LETTRE;
              rang += mot.length;
              const e = etatMot("ecrase", t, d, taille, u);
              return (
                <FlouFort dy={e.dy} style={{ display: "inline-block", opacity: e.opacite, transform: `scale(${e.sx.toFixed(4)}, ${e.sy.toFixed(4)}) rotate(${e.rot.toFixed(2)}deg)` }}>
                  <MotCle mot={mot} t={t} arrivee={d + 0.3} balayage={finCles} u={u} />
                </FlouFort>
              );
            })()
          ) : (
            Array.from(mot).map((lettre, j) => {
              const d = debut + rang++ * DECALAGE_LETTRE;
              const e = etatMot("rebond", t, d, taille, u, taille * 0.8);
              return (
                <FlouFort key={j} dy={e.dy} style={{ display: "inline-block", opacity: e.opacite, transform: `translateY(${e.ty.toFixed(2)}px) scale(${e.sx.toFixed(4)}, ${e.sy.toFixed(4)})`, transformOrigin: "50% 100%" }}>
                  <span style={{ textShadow: `0 ${10 * u}px ${40 * u}px ${avecOpacite(COULEURS.fondProfond, 0.85)}` }}>{lettre}</span>
                </FlouFort>
              );
            })
          )}
        </span>
      ))}
    </div>
  );
}

function Contenu({ d }: { d: DonneesTitre }) {
  const { t, u, zoneCentree: z, taille, entree } = useSpec();
  const generique = d.variante === "generique";
  const tSur = entree - 0.1;
  const tTitre = d.surTitre ? entree + 0.5 : entree;
  const texte = titreMarque(d.titre, d.motCle);
  const nb = d.titre.replace(/\s/g, "").length;
  const base = Math.round(taille(generique ? "titre" : "affiche") * (generique ? 1.1 : 1.35));
  const tailleT = tailleQuiTient(texte, base, 900, z.largeur * 0.98, Math.round(taille("titre")), -0.035);
  const finTitre = tTitre + nb * DECALAGE_LETTRE + 0.45;
  const largeurTrait = (debut: number) => 110 * u * progres(t, debut, 0.5, "glisse");
  return (
    <>
      <Reflet debut={finTitre - 0.1} />
      <div style={{ position: "absolute", left: z.x, width: z.largeur, top: z.y, height: z.hauteur, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: generique ? "flex-start" : "center", paddingTop: generique ? z.hauteur * 0.1 : 0, gap: 30 * u }}>
        {d.surTitre && (
          <div style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
            <div style={{ height: Math.max(3, 5 * u), width: largeurTrait(tSur), background: COULEURS.orangeVif, boxShadow: `0 0 ${16 * u}px ${COULEURS.orangeVif}` }} />
            <MotsGeants texte={d.surTitre.toUpperCase()} debut={tSur} taille={taille("legende")} graisse={800} effet="etire" couleur={COULEURS.orangeVif} approche={0.2} decalage={0.08} />
            <div style={{ height: Math.max(3, 5 * u), width: largeurTrait(tSur), background: COULEURS.orangeVif, boxShadow: `0 0 ${16 * u}px ${COULEURS.orangeVif}` }} />
          </div>
        )}
        <TitreLettres texte={texte} debut={tTitre} taille={tailleT} />
        {!generique && <div style={{ height: Math.max(6, 9 * u), borderRadius: 9 * u, width: z.largeur * 0.32 * progres(t, finTitre - 0.15, 0.45, "glisse"), background: `linear-gradient(90deg, ${COULEURS.orangeProfond}, ${COULEURS.orangeVif}, ${COULEURS.creme})`, boxShadow: `0 0 ${24 * u}px ${COULEURS.orangeVif}` }} />}
        {d.sousTitre && <MotsGeants texte={d.sousTitre} debut={finTitre + 0.2} taille={Math.round(taille("corps") * 1.02)} graisse={700} effet="etire" alignement="center" largeurMax={z.largeur} couleur={COULEURS.creme} decalage={0.08} interligne={1.15} approche={-0.01} />}
        {generique &&
          (d.lignes ?? []).map((l, i) => (
            <MotsGeants key={i} texte={l} debut={finTitre + 0.15 + i * 0.3} taille={taille("legende")} graisse={i === 0 ? 800 : 600} effet="etire" alignement="center" largeurMax={z.largeur} couleur={i === 0 ? COULEURS.creme : COULEURS.cremeAttenuee} decalage={0.05} />
          ))}
      </div>
    </>
  );
}

export function TitreSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesTitre }) {
  return (
    <SceneSpectaculaire mp={p}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
