/**
 * Modèle 10 — CHECK-LIST (lot F2) : le titre se construit, les cases arrivent vides (vite, l'une après l'autre),
 * puis chacune SE COCHE quand la voix dit son point : la case se remplit d'orange au ressort, la coche se trace, la
 * ligne s'allume ; le compteur et la barre de progression avancent. La liste complète brille une fois.
 */
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import type { DonneesCheckList } from "../../../../src/briques/motion/types-etendus";
import { avecOpacite, CarteMotion, COULEURS, deplacementObturateur, DUREES, echelleRessort, Filigrane, FlouMouvement, IconeTracee, progres, stylePanneau, TexteCinetique, useMotion } from "./noyau";
import { tailleTitreAjustee } from "./outils-etendus";
import { CheckListSpectaculaire } from "./spectaculaire/CheckListSpectaculaire";

/** Horaires d'une check-list : arrivée des cases (vides) puis instant où chacune se coche (au mot dit). */
export function horairesCheckList(d: DonneesCheckList, duree: number, debutCases: number) {
  const n = d.elements.length;
  const arrivees = d.elements.map((_, i) => debutCases + i * 0.09);
  const premier = debutCases + n * 0.09 + 0.25;
  const fin = Math.max(premier, duree - 1.6);
  let dernier = premier - 0.35;
  const coches = d.elements.map((e, i) => {
    const defaut = premier + ((fin - premier) * i) / Math.max(1, n - 1);
    dernier = Math.min(fin, Math.max(dernier + 0.35, e.aSec ?? defaut));
    return dernier;
  });
  return { arrivees, coches };
}

function Contenu({ d }: { d: DonneesCheckList }) {
  const { t, u, zone, taille, chute, duree, moitie, mesurer } = useMotion();
  const n = d.elements.length;
  const tTitre = d.aSecTitre ?? 0.12;
  const { arrivees, coches } = horairesCheckList(d, duree, d.titre ? 0.5 : 0.15);
  const fait = coches.filter((c) => t >= c).length;
  const tTout = coches[n - 1] + 0.45;
  // Moitié haute : textes à la taille de légende (≥ 3 %), cases et marges resserrées, titre ajusté.
  const tailleTexte = moitie ? taille("legende") : taille("corps");
  const tTitre2 = d.titre ? (moitie ? tailleTitreAjustee([taille("titre"), taille("corps"), taille("legende")], (ta) => mesurer(d.titre!, "titre", zone.largeur, 800, ta), zone.hauteur * 0.14) : taille("titre")) : 0;
  const pad = moitie ? 0.6 : 1;
  const caseTaille = Math.round(tailleTexte * (moitie ? 1.3 : 1.45));
  const ecart = Math.round((moitie ? 10 : 24) * u);
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const progression = coches.reduce((a, c) => a + progres(t, c, 0.45, "glisse"), 0) / n;
  const brille = progres(t, tTout, 0.3) * (1 - progres(t, tTout + 0.5, 0.6));
  return (
    <>
      <Filigrane texte={String(n)} x={zone.x + zone.largeur * 0.5} y={zone.y + zone.hauteur * 0.7} taille={zone.hauteur * 0.45} debut={0.2} />
      <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.largeur, height: zone.hauteur, display: "flex", flexDirection: "column", justifyContent: "safe center", gap: ecart }}>
        <div style={{ marginBottom: ecart * 0.5 }}>
          {d.titre && <TexteCinetique texte={d.titre} niveau="titre" taillePx={tTitre2} debut={tTitre} largeurMax={zone.largeur} />}
          {/* Barre de progression et compteur. */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 * u, marginTop: 22 * u, opacity: progres(t, tTitre + 0.2, 0.3) * (1 - s) }}>
            <div style={{ position: "relative", flex: "1 1 auto", height: Math.max(8, 12 * u), borderRadius: 12 * u, background: COULEURS.surfaceHaute, boxShadow: `inset 0 0 0 ${1.5 * u}px ${COULEURS.filet}`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(progression * 100).toFixed(2)}%`, borderRadius: 12 * u, background: `linear-gradient(90deg, ${COULEURS.orangeProfond}, ${COULEURS.orangeVif})`, boxShadow: `0 0 ${(18 + 30 * brille) * u}px ${avecOpacite(COULEURS.orangeVif, 0.5 + 0.4 * brille)}` }} />
            </div>
            <div style={{ flex: "none", fontSize: taille("legende"), fontWeight: 800, fontVariantNumeric: "tabular-nums", color: fait === n ? COULEURS.orangeVif : COULEURS.cremeAttenuee, transform: `scale(${(1 + 0.12 * coches.reduce((a, c) => a + Math.max(0, 1 - Math.abs(t - c - 0.1) / 0.15), 0)).toFixed(4)})` }}>
              {fait}/{n}
            </div>
          </div>
        </div>
        {d.elements.map((e, i) => {
          const a = arrivees[i];
          const c = coches[i];
          const sortie = chute + (n - 1 - i) * 0.04;
          const x = (tt: number) => (1 - progres(tt, a, DUREES.entree, "signature")) * 70 * u - progres(tt, sortie, DUREES.sortie, "sortie") * 60 * u;
          const ouverture = progres(t, a, DUREES.entree * 0.6, "douce") * (1 - progres(t, sortie, DUREES.sortie, "sortie"));
          const coche = progres(t, c, 0.25);
          const actif = coche * (1 - 0.65 * progres(t, c + 0.5, 0.6)) + 0.35 * brille;
          const remplissage = echelleRessort(t, c, sortie);
          return (
            <FlouMouvement key={i} dx={deplacementObturateur(x, t)} style={{ opacity: ouverture, transform: `translateX(${x(t).toFixed(2)}px)` }}>
              <div style={{ ...stylePanneau(u, actif), display: "flex", alignItems: "center", gap: 28 * u, padding: `${20 * u * pad}px ${28 * u}px ${20 * u * pad}px ${22 * u}px`, transform: `scale(${(1 + 0.025 * coche * (1 - progres(t, c + 0.3, 0.4))).toFixed(4)})`, transformOrigin: "0% 50%" }}>
                <div style={{ position: "relative", flex: "none", width: caseTaille, height: caseTaille, borderRadius: caseTaille * 0.26, boxShadow: `inset 0 0 0 ${Math.max(3, 4 * u)}px ${coche > 0 ? COULEURS.orangeVif : COULEURS.cremeAttenuee}` }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: caseTaille * 0.26, background: `radial-gradient(circle at 35% 30%, ${COULEURS.orangeVif}, ${COULEURS.orange} 60%, ${COULEURS.orangeProfond})`, transform: `scale(${remplissage.toFixed(4)})`, boxShadow: `0 0 ${36 * u * coche}px ${avecOpacite(COULEURS.orangeVif, 0.55 * coche)}` }} />
                  {t >= c && (
                    <div style={{ position: "absolute", left: caseTaille * 0.16, top: caseTaille * 0.16 }}>
                      <IconeTracee nom="coche" taille={caseTaille * 0.68} debut={c + 0.08} couleur={COULEURS.creme} epaisseur={3.4} duree={0.32} chute={sortie} />
                    </div>
                  )}
                </div>
                <TexteCinetique texte={e.texte} niveau="corps" taillePx={tailleTexte} debut={a + 0.05} couleur={coche > 0 ? COULEURS.creme : COULEURS.cremeAttenuee} chute={sortie} style={{ flex: "1 1 auto", minWidth: 0 }} />
              </div>
            </FlouMouvement>
          );
        })}
      </div>
    </>
  );
}

export function MotionCheckList(p: MiseEnPageCarte & { donnees: DonneesCheckList }) {
  if (p.style === "spectaculaire") return <CheckListSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
