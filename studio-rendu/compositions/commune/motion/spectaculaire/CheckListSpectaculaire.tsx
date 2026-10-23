/**
 * Modèle 10 — CHECK-LIST, style « Spectaculaire » (lot F2) : le titre s'écrase en mots géants, les cases arrivent en
 * cartes 3D depuis la profondeur ; au mot dit, la case S'ABAT (écrasement puis rebond), la coche se trace en néon
 * dans une gerbe d'étincelles, la ligne avance vers la caméra et un balayage la traverse ; le compteur géant frappe à
 * chaque coche. Liste complète : la barre s'embrase.
 */
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import type { DonneesCheckList } from "../../../../../src/briques/motion/types-etendus";
import { horairesCheckList } from "../MotionCheckList";
import { tailleTitreAjustee } from "../outils-etendus";
import { avecOpacite, Balayage, borne, COULEURS, courbe, Eclats, FiligraneSpec, FlouFort, IconeSpec, MotsGeants, progres, rebondImpact, SceneSpectaculaire, stylePanneauSpec, useSpec } from "./noyau";

function Contenu({ d }: { d: DonneesCheckList }) {
  const { t, u, zone, taille, duree, entree, moitie, mesurer } = useSpec();
  const n = d.elements.length;
  const tTitre = Math.max(entree - 0.1, d.aSecTitre ?? 0.15);
  const { arrivees, coches } = horairesCheckList(d, duree, Math.max(entree + 0.3, d.titre ? 0.75 : 0.5));
  const fait = coches.filter((c) => t >= c).length;
  const tTout = coches[n - 1] + 0.45;
  const tailleTexte = moitie ? taille("legende") : taille("corps");
  const pad = moitie ? 0.6 : 1;
  const tTitre2 = d.titre ? (moitie ? tailleTitreAjustee([taille("titre"), taille("corps"), taille("legende")], (ta) => mesurer(d.titre!, ta, 900, zone.largeur * 0.74, "titre") * 1.04, zone.hauteur * 0.14) : Math.round(taille("titre") * 1.15)) : 0;
  const caseTaille = Math.round(tailleTexte * (moitie ? 1.3 : 1.5));
  const ecart = Math.round((moitie ? 10 : 26) * u);
  const progression = coches.reduce((a, c) => a + progres(t, c, 0.35, "glisse"), 0) / n;
  const embrase = borne((t - tTout) / 0.25);
  const derniere = coches.reduce((a, c) => (t >= c ? c : a), -9);
  const frappe = rebondImpact(t, derniere + 0.05, 20, 8);
  const tailleCompteur = Math.round((moitie ? taille("corps") : taille("titre")) * 0.95);
  return (
    <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.largeur, height: zone.hauteur, display: "flex", flexDirection: "column", justifyContent: "safe center", gap: ecart }}>
      <div style={{ marginBottom: ecart * 0.4 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 * u }}>
          {d.titre ? <MotsGeants texte={d.titre} debut={tTitre} taille={tTitre2} graisse={900} largeurMax={zone.largeur * 0.74} effet="ecrase" /> : <div />}
          <div style={{ flex: "none", fontSize: tailleCompteur, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", opacity: borne((t - entree) / 0.2), transform: `scale(${(1 + 0.3 * frappe).toFixed(4)}, ${(1 - 0.3 * frappe).toFixed(4)})`, transformOrigin: "100% 100%", color: fait === n ? COULEURS.orangeVif : COULEURS.creme, textShadow: fait === n ? `0 0 ${30 * u}px ${avecOpacite(COULEURS.orangeVif, 0.8)}` : undefined }}>
            {fait}
            <span style={{ fontSize: "0.5em", color: COULEURS.cremeAttenuee }}>/{n}</span>
          </div>
        </div>
        <div style={{ position: "relative", marginTop: 24 * u, height: Math.max(10, 14 * u), borderRadius: 14 * u, background: COULEURS.surfaceHaute, boxShadow: `inset 0 0 0 ${1.5 * u}px ${COULEURS.filet}`, opacity: borne((t - entree) / 0.3) }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(progression * 100).toFixed(2)}%`, borderRadius: 14 * u, background: `linear-gradient(90deg, ${COULEURS.orangeProfond}, ${COULEURS.orangeVif} 70%, ${COULEURS.creme})`, boxShadow: `0 0 ${(24 + 60 * embrase) * u}px ${avecOpacite(COULEURS.orangeVif, 0.6 + 0.4 * embrase)}` }} />
        </div>
      </div>
      {d.elements.map((e, i) => {
        const a = arrivees[i];
        const c = coches[i];
        // Arrivée : de la profondeur, en pivotant sur la charnière haute.
        const k = courbe("signature")(borne((t - a) / 0.45));
        const kAvant = courbe("signature")(borne((t - 1 / 50 - a) / 0.45));
        const coche = t >= c ? 1 : 0;
        const avance = 50 * u * borne((t - c) / 0.15) * (1 - courbe("glisse")(borne((t - c - 0.35) / 0.5)));
        const z = -600 * u * (1 - k) + avance;
        const rx = 70 * (1 - k);
        const r = rebondImpact(t, c + 0.12, 18, 7);
        const ecrase = t < c ? 0 : t < c + 0.12 ? 1 - (t - c) / 0.12 : 0;
        return (
          <div key={i} style={{ perspective: `${(1300 * u).toFixed(0)}px`, perspectiveOrigin: "50% 0%", opacity: borne((t - a) / 0.08) }}>
            <FlouFort dy={(k - kAvant) * 400 * u} style={{ transform: `translateZ(${z.toFixed(2)}px) rotateX(${rx.toFixed(3)}deg)`, transformOrigin: "50% 0%" }}>
              <div style={{ ...stylePanneauSpec(u, coche * (1 - 0.6 * progres(t, c + 0.5, 0.5)) + 0.4 * embrase), position: "relative", display: "flex", alignItems: "center", gap: 28 * u, padding: `${22 * u * pad}px ${30 * u}px ${22 * u * pad}px ${24 * u}px`, opacity: coche ? 1 : 0.78 }}>
                <div style={{ position: "relative", flex: "none", width: caseTaille, height: caseTaille }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: caseTaille * 0.26, boxShadow: `inset 0 0 0 ${Math.max(3, 4 * u)}px ${coche ? COULEURS.orangeVif : COULEURS.cremeAttenuee}` }} />
                  {coche > 0 && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: caseTaille * 0.26, background: `radial-gradient(circle at 35% 30%, ${COULEURS.orangeVif}, ${COULEURS.orange} 60%, ${COULEURS.orangeProfond})`, transform: `scale(${(1 + 0.6 * ecrase + 0.2 * r).toFixed(4)}, ${(1 + 0.6 * ecrase - 0.2 * r).toFixed(4)})`, boxShadow: `0 0 ${50 * u}px ${avecOpacite(COULEURS.orangeVif, 0.7)}` }} />
                  )}
                  {coche > 0 && (
                    <div style={{ position: "absolute", left: caseTaille * 0.15, top: caseTaille * 0.15 }}>
                      <IconeSpec nom="coche" taille={caseTaille * 0.7} debut={c + 0.06} couleur={COULEURS.creme} epaisseur={3.6} duree={0.24} />
                    </div>
                  )}
                  <Eclats x={caseTaille / 2} y={caseTaille / 2} debut={c + 0.1} rayon={110 * u} nombre={12} graine={31 + i} flash={false} />
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <MotsGeants texte={e.texte} debut={a + 0.1} taille={tailleTexte} graisse={700} effet="etire" decalage={0.04} interligne={1.16} approche={-0.01} couleur={coche ? COULEURS.creme : COULEURS.cremeAttenuee} />
                </div>
                <Balayage debut={c + 0.15} opacite={0.3} />
                {embrase > 0 && <Balayage debut={tTout + i * 0.06} opacite={0.25} />}
              </div>
            </FlouFort>
          </div>
        );
      })}
    </div>
  );
}

function Decor({ d }: { d: DonneesCheckList }) {
  const { largeur, hauteur } = useSpec();
  return <FiligraneSpec texte={String(d.elements.length)} x={largeur * 0.6} y={hauteur * 0.56} taille={hauteur * 0.62} debut={0.3} />;
}

export function CheckListSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesCheckList }) {
  return (
    <SceneSpectaculaire mp={p} decor={<Decor d={p.donnees} />}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
