/**
 * Modèle 4 — LIGNE DE TEMPS, style « Spectaculaire » : les étapes sont posées sur un plan incliné en perspective que la
 * caméra longe (travelling vers l'étape dite). Un rail de lumière avance avec la parole, une comète à son bout ;
 * chaque étape dite s'allume dans une gerbe d'étincelles et sa carte jaillit étirée de la droite (flou marqué),
 * puis un balayage de lumière la traverse. Les étapes passées reculent et gardent une coche.
 */
import { horairesParDefaut } from "../../../../../src/briques/motion/calage";
import type { DonneesLigneDeTemps, MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import { avecOpacite, Balayage, borne, COULEURS, courbe, Eclats, etatMot, FiligraneSpec, FlouFort, IconeSpec, MotsGeants, progres, rebondImpact, SceneSpectaculaire, stylePanneauSpec, useSpec } from "./noyau";

function Contenu({ d }: { d: DonneesLigneDeTemps }) {
  const { t, u, zone, taille, duree, entree, mesurer, largeur } = useSpec();
  const n = d.etapes.length;
  const defaut = horairesParDefaut(n, duree, !!d.titre);
  const heures = d.etapes.map((e, i) => Math.max(entree + 0.3 + i * 0.3, e.aSec ?? defaut[i]));
  const actif = heures.reduce((a, h, i) => (t >= h ? i : a), -1);
  const feuille = d.variante === "feuille-de-route";
  const tailleTitre = Math.round(taille("titre") * 1.08);
  const hTitre = d.titre ? mesurer(d.titre.replace(/\*/g, ""), tailleTitre, 900, zone.largeur, "titre") + 50 * u : 0;
  const haut = zone.y + hTitre;
  const bas = zone.y + zone.hauteur;
  const pas = (bas - haut) / n;
  const noeud = Math.round(Math.min(pas * 0.5, taille("corps") * 1.75));
  const xRail = zone.x + noeud / 2;
  const yEtape = (i: number) => haut + pas * i + pas * 0.45;
  const avance = (tt: number) => {
    let y = yEtape(0) - pas * 0.35;
    heures.forEach((h, i) => {
      const k = progres(tt, h - 0.12, 0.45, "glisse");
      if (k > 0) y = y + (yEtape(i) - y) * k;
    });
    return y;
  };
  const yBout = avance(t);
  const dyBout = yBout - avance(t - 1 / 50);
  const epaisseur = Math.max(6, 9 * u);
  // Travelling : le plan glisse pour que l'étape dite remonte vers le centre ; le plan est incliné en 3D.
  const centre = (tt: number) => {
    let c = 0;
    heures.forEach((h, i) => {
      const k = progres(tt, h - 0.1, 0.6, "glisse");
      if (k > 0) c = c + (i - c) * k;
    });
    return c;
  };
  const travelling = -(centre(t) - (n - 1) / 2) * pas * 0.18;
  const xTexte = xRail + noeud / 2 + 34 * u;
  const largeurTexte = zone.x + zone.largeur - xTexte;
  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: zone.x, width: zone.largeur, top: zone.y }}>
          <MotsGeants texte={d.titre} debut={entree - 0.1} taille={tailleTitre} graisse={900} largeurMax={zone.largeur} effet="ecrase" />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, top: 0, width: largeur, height: bas + 200 * u, perspective: `${(1500 * u).toFixed(0)}px`, perspectiveOrigin: `30% ${((haut + bas) / 2).toFixed(0)}px` }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transformOrigin: `${xRail}px ${((haut + bas) / 2).toFixed(0)}px`, transform: `translateY(${travelling.toFixed(2)}px) rotateY(${(12 - 4 * borne(t / duree)).toFixed(3)}deg) rotateX(${(5).toFixed(2)}deg)` }}>
          {/* Rail : pointillé de fond puis lumière qui avance (flou de mouvement), comète au bout. */}
          <div style={{ position: "absolute", left: xRail - epaisseur / 2, top: yEtape(0), width: epaisseur, height: (yEtape(n - 1) - yEtape(0)) * progres(t, entree - 0.1, 0.7, "glisse"), backgroundImage: `linear-gradient(${COULEURS.filet} 55%, transparent 55%)`, backgroundSize: `${epaisseur}px ${20 * u}px` }} />
          <FlouFort dy={dyBout} style={{ position: "absolute", left: xRail - epaisseur / 2, top: yEtape(0) - pas * 0.35, width: epaisseur, height: Math.max(0, yBout - (yEtape(0) - pas * 0.35)), opacity: progres(t, heures[0] - 0.15, 0.2) }}>
            <div style={{ width: "100%", height: "100%", borderRadius: epaisseur, background: `linear-gradient(180deg, ${avecOpacite(COULEURS.orange, 0)}, ${COULEURS.orange} 25%, ${COULEURS.orangeVif})`, boxShadow: `0 0 ${26 * u}px ${avecOpacite(COULEURS.orangeVif, 0.8)}` }} />
          </FlouFort>
          <div style={{ position: "absolute", left: xRail - 60 * u, top: yBout - 60 * u, width: 120 * u, height: 120 * u, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.creme, 0.95)}, ${avecOpacite(COULEURS.orangeVif, 0.6)} 25%, ${avecOpacite(COULEURS.orange, 0)} 68%)`, opacity: progres(t, heures[0] - 0.15, 0.2) * (0.8 + 0.2 * Math.sin(t * 7)) }} />
          {d.etapes.map((e, i) => {
            const h = heures[i];
            const y = yEtape(i);
            const dite = t >= h;
            const passe = i < actif;
            const estActif = i === actif;
            const kActif = estActif ? progres(t, h, 0.3) : passe ? 1 - progres(t, heures[i + 1], 0.35) : 0;
            const apparition = courbe("signature")(borne((t - (entree + i * 0.08)) / 0.4));
            const pop = 1 + 0.3 * rebondImpact(t, h, 20, 7);
            const carte = etatMot("etire", t, h + 0.05, taille("corps"), u);
            const z = 70 * u * kActif - (passe ? 90 * u * (1 - kActif) : 0);
            return (
              <div key={i} style={{ position: "absolute", left: 0, top: 0, transformStyle: "preserve-3d" }}>
                <div
                  style={{
                    position: "absolute",
                    left: xRail - noeud / 2,
                    top: y - noeud / 2,
                    width: noeud,
                    height: noeud,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: apparition,
                    transform: `translateZ(${(z * 0.5).toFixed(1)}px) scale(${(apparition * pop).toFixed(4)})`,
                    background: dite ? `radial-gradient(circle at 35% 30%, ${COULEURS.orangeVif}, ${COULEURS.orange} 60%, ${COULEURS.orangeProfond})` : COULEURS.fond,
                    boxShadow: `0 0 0 ${Math.max(3, 4 * u)}px ${dite ? COULEURS.orangeVif : COULEURS.filet}, 0 0 ${70 * u * kActif}px ${avecOpacite(COULEURS.orangeVif, 0.75 * kActif)}`,
                  }}
                >
                  {!dite && <span style={{ fontSize: noeud * 0.42, fontWeight: 800, color: COULEURS.cremeAttenuee }}>{i + 1}</span>}
                  {dite && (passe ? <IconeSpec nom="coche" taille={noeud * 0.52} debut={heures[i + 1]} epaisseur={3} /> : e.icone ? <IconeSpec nom={e.icone} taille={noeud * 0.52} debut={h + 0.1} epaisseur={2.4} /> : <span style={{ fontSize: noeud * 0.42, fontWeight: 900 }}>{i + 1}</span>)}
                  <Eclats x={noeud / 2} y={noeud / 2} debut={h} rayon={noeud * 1.1} nombre={12} graine={20 + i} flash={false} />
                </div>
                {dite && (
                  <FlouFort
                    dx={carte.dx}
                    style={{ position: "absolute", left: xTexte, width: largeurTexte, top: y - pas * 0.44, height: pas * 0.88, display: "flex", flexDirection: "column", justifyContent: "center", opacity: carte.opacite, transform: `translateZ(${z.toFixed(1)}px) translateX(${carte.tx.toFixed(2)}px) scale(${carte.sx.toFixed(4)}, ${carte.sy.toFixed(4)})`, transformOrigin: "0% 50%" }}
                  >
                    <div style={{ ...stylePanneauSpec(u, kActif), position: "relative", padding: `${18 * u}px ${28 * u}px`, opacity: passe ? 0.6 + 0.4 * kActif : 1 }}>
                      {feuille && e.detail && <div style={{ fontSize: taille("legende"), fontWeight: 800, letterSpacing: "0.12em", color: COULEURS.orangeVif }}>{e.detail.toUpperCase()}</div>}
                      <div style={{ fontSize: taille("corps"), fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.015em" }}>{e.titre}</div>
                      {!feuille && e.detail && <div style={{ fontSize: taille("legende"), fontWeight: 600, color: COULEURS.cremeAttenuee, lineHeight: 1.2 }}>{e.detail}</div>}
                      <Balayage debut={h + 0.4} />
                    </div>
                  </FlouFort>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Decor({ d }: { d: DonneesLigneDeTemps }) {
  const { largeur, hauteur } = useSpec();
  return <FiligraneSpec texte={String(d.etapes.length)} x={largeur * 0.66} y={hauteur * 0.55} taille={hauteur * 0.62} debut={0.3} />;
}

export function LigneDeTempsSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesLigneDeTemps }) {
  return (
    <SceneSpectaculaire mp={p} decor={<Decor d={p.donnees} />}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
