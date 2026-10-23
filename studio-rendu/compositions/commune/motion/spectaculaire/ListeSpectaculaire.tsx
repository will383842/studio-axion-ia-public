/**
 * Modèle 1 — LISTE, style « Spectaculaire » : le titre s'écrase en mots géants (mot clé orange, halo, balayage), puis
 * chaque point arrive comme une carte 3D qui pivote sur sa charnière depuis la profondeur (flou de mouvement marqué),
 * sa pastille s'allume dans une gerbe d'étincelles. Le point dit avance vers la caméra ; les précédents reculent.
 */
import { horairesParDefaut } from "../../../../../src/briques/motion/calage";
import type { DonneesListe, MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import { avecOpacite, Balayage, borne, COULEURS, courbe, Eclats, FiligraneSpec, FlouFort, IconeSpec, MotsGeants, progres, rebondImpact, SceneSpectaculaire, stylePanneauSpec, useSpec } from "./noyau";

function Contenu({ d }: { d: DonneesListe }) {
  const { t, u, zone, taille, duree, entree } = useSpec();
  const n = d.elements.length;
  const defaut = horairesParDefaut(n, duree, !!d.titre);
  const heures = d.elements.map((e, i) => Math.max(entree + 0.35 + i * 0.3, e.aSec ?? defaut[i]));
  const numerotee = d.numerotee ?? !d.elements.some((e) => e.icone);
  const actif = heures.reduce((a, h, i) => (t >= h ? i : a), -1);
  const tTitre = Math.max(entree - 0.1, d.aSecTitre ?? 0.15);
  const tailleTexte = taille("corps");
  const pastille = Math.round(tailleTexte * 1.7);
  const ecart = Math.round(30 * u);
  const vol = 0.55;
  return (
    <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.largeur, height: zone.hauteur, display: "flex", flexDirection: "column", justifyContent: "center", gap: ecart }}>
      {d.titre && (
        <div style={{ marginBottom: ecart * 0.8 }}>
          <MotsGeants texte={d.titre} debut={tTitre} taille={Math.round(taille("titre") * 1.18)} graisse={900} largeurMax={zone.largeur} effet="ecrase" />
        </div>
      )}
      {d.elements.map((e, i) => {
        const h = heures[i];
        // Charnière à gauche : la carte pivote de −95° à 0° en venant de la profondeur, puis rebondit.
        const k = (tt: number) => courbe("signature")(borne((tt - h) / vol));
        const angle = (tt: number) => -95 * (1 - k(tt)) + 7 * rebondImpact(tt, h + vol * 0.7, 18, 7);
        const recul = (tt: number) => -520 * u * (1 - k(tt));
        const estActif = i === actif;
        const passe = i < actif;
        const kActif = estActif ? progres(t, h, 0.3) : passe ? 1 - progres(t, heures[i + 1], 0.35) : 0;
        const z = recul(t) + 40 * u * kActif - (passe ? 70 * u * (1 - kActif) : 0);
        const vitesseAngle = angle(t) - angle(t - 1 / 50);
        const visible = borne((t - h) / 0.1);
        return (
          <div key={i} style={{ perspective: `${(1300 * u).toFixed(0)}px`, perspectiveOrigin: "0% 50%", opacity: visible }}>
            <FlouFort dx={vitesseAngle * 6 * u} style={{ transform: `translateZ(${z.toFixed(2)}px) rotateY(${angle(t).toFixed(3)}deg)`, transformOrigin: "0% 50%" }}>
              <div style={{ ...stylePanneauSpec(u, kActif), position: "relative", display: "flex", alignItems: "center", gap: 28 * u, padding: `${24 * u}px ${30 * u}px ${24 * u}px ${24 * u}px`, opacity: passe ? 0.62 + 0.38 * kActif : 1 }}>
                <div
                  style={{
                    flex: "none",
                    width: pastille,
                    height: pastille,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    transform: `scale(${(1 + 0.18 * rebondImpact(t, h + 0.32, 20, 7)).toFixed(4)})`,
                    background: kActif > 0 || passe ? `radial-gradient(circle at 35% 30%, ${COULEURS.orangeVif}, ${COULEURS.orange} 60%, ${COULEURS.orangeProfond})` : COULEURS.surfaceHaute,
                    boxShadow: `0 0 0 ${2 * u}px ${avecOpacite(COULEURS.orangeVif, 0.6)}, 0 0 ${60 * u * kActif}px ${avecOpacite(COULEURS.orangeVif, 0.7 * kActif)}`,
                  }}
                >
                  {numerotee || !e.icone ? <span style={{ fontSize: pastille * 0.5, fontWeight: 900, lineHeight: 1 }}>{i + 1}</span> : <IconeSpec nom={e.icone} taille={pastille * 0.54} debut={h + 0.25} epaisseur={2.4} />}
                  <Eclats x={pastille / 2} y={pastille / 2} debut={h + 0.32} rayon={95 * u} nombre={10} graine={i + 5} flash={false} />
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0, fontSize: tailleTexte, fontWeight: 700, lineHeight: 1.16, letterSpacing: "-0.01em" }}>
                  <MotsGeants texte={e.texte} debut={h + 0.18} taille={tailleTexte} graisse={700} effet="etire" decalage={0.05} interligne={1.16} approche={-0.01} />
                </div>
                <Balayage debut={h + 0.55} />
              </div>
            </FlouFort>
          </div>
        );
      })}
    </div>
  );
}

function Decor({ d }: { d: DonneesListe }) {
  const { largeur, hauteur } = useSpec();
  return <FiligraneSpec texte={String(d.elements.length)} x={largeur * 0.62} y={hauteur * 0.55} taille={hauteur * 0.62} debut={0.3} />;
}

export function ListeSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesListe }) {
  return (
    <SceneSpectaculaire mp={p} decor={<Decor d={p.donnees} />}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
