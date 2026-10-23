/**
 * Modèle 12 — TITRE PLEIN ÉCRAN, style « Spectaculaire » (lot F2, JAMAIS automatique). Les lignes géantes jaillissent
 * en alternance de gauche et de droite, étirées, et se tassent à l'arrêt ; le mot clé s'écrase depuis la caméra en
 * orange avec son onde de choc ; le numéro de chapitre flotte au fond de la scène 3D ; un reflet d'objectif traverse
 * l'image quand le titre est posé.
 */
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import type { DonneesTitrePleinEcran } from "../../../../../src/briques/motion/types-etendus";
import { titreMarque } from "../MotionTitre";
import { composerTitreGeant } from "../MotionTitrePleinEcran";
import { avecOpacite, borne, COULEURS, courbe, Eclats, etatMot, FiligraneSpec, FlouFort, MotCle, MotsGeants, rebondImpact, SceneSpectaculaire, useSpec } from "./noyau";

function Reflet({ debut }: { debut: number }) {
  const { t, largeur: L, hauteur: H, u } = useSpec();
  const k = borne((t - debut) / 0.85);
  if (k <= 0 || k >= 1) return null;
  const x = -0.3 * L + courbe("glisse")(k) * 1.6 * L;
  const a = Math.sin(k * Math.PI);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: L, height: H, mixBlendMode: "screen", pointerEvents: "none", opacity: a }}>
      <div style={{ position: "absolute", left: x - L * 0.6, top: H * 0.5 - 3 * u, width: L * 1.2, height: 6 * u, background: `linear-gradient(90deg, ${avecOpacite(COULEURS.orangeVif, 0)}, ${avecOpacite(COULEURS.creme, 0.8)} 50%, ${avecOpacite(COULEURS.orangeVif, 0)})`, filter: `blur(${2 * u}px)` }} />
      <div style={{ position: "absolute", left: x - 150 * u, top: H * 0.5 - 150 * u, width: 300 * u, height: 300 * u, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.creme, 0.7)}, ${avecOpacite(COULEURS.orangeVif, 0.3)} 25%, ${avecOpacite(COULEURS.orange, 0)} 65%)` }} />
    </div>
  );
}

function Contenu({ d }: { d: DonneesTitrePleinEcran }) {
  const { t, u, zone, taille, entree, hauteurVideo, mesurer } = useSpec();
  const tSous = Math.round(taille("corps") * 1.02);
  const hSur = d.surTitre ? taille("legende") * 1.4 + 30 * u : 0;
  const hSous = d.sousTitre ? mesurer(d.sousTitre, tSous, 700, zone.largeur) + 40 * u : 0;
  const { taille: tg, lignes } = composerTitreGeant(titreMarque(d.titre, d.motCle), zone.largeur * 0.97, (zone.hauteur - hSur - hSous - 60 * u) * 0.98, hauteurVideo, taille("titre"));
  const hLigne = tg * 0.96;
  const hTitre = lignes.length * hLigne;
  const haut = zone.y + (zone.hauteur - (hSur + hTitre + 50 * u + hSous)) / 2;
  const tTitre = d.surTitre ? entree + 0.2 : entree;
  const fin = tTitre + lignes.length * 0.2 + 0.4;
  // Premier mot clé (éclats) : calculé avant le rendu, jamais réassigné pendant (react-hooks/immutability).
  const iCle = lignes.findIndex((ligne) => ligne.some((m) => m.cle));
  const jCle = iCle >= 0 ? lignes[iCle].findIndex((m) => m.cle) : -1;
  const tCle = iCle >= 0 ? tTitre + iCle * 0.2 + jCle * 0.05 + 0.3 : -1;
  const yCle = iCle >= 0 ? haut + hSur + iCle * hLigne + hLigne / 2 : 0;
  return (
    <>
      {d.surTitre && (
        <div style={{ position: "absolute", left: zone.x, top: haut, display: "flex", alignItems: "center", gap: 22 * u }}>
          <div style={{ height: Math.max(4, 6 * u), width: 90 * u * courbe("glisse")(borne((t - entree + 0.15) / 0.5)), background: COULEURS.orangeVif, boxShadow: `0 0 ${16 * u}px ${COULEURS.orangeVif}` }} />
          <MotsGeants texte={d.surTitre.toUpperCase()} debut={entree - 0.15} taille={taille("legende")} graisse={800} effet="etire" couleur={COULEURS.orangeVif} decalage={0.06} approche={0.2} />
        </div>
      )}
      {lignes.map((ligne, i) => {
        const debut = tTitre + i * 0.2;
        const cote = i % 2 === 0 ? 1 : -1;
        return (
          <div key={i} style={{ position: "absolute", left: zone.x, top: haut + hSur + i * hLigne, height: hLigne, display: "flex", whiteSpace: "nowrap", fontSize: tg, fontWeight: 900, lineHeight: 0.96, letterSpacing: "-0.04em" }}>
            {ligne.map((m, j) => {
              const dm = debut + j * 0.05;
              if (m.cle) {
                const e = etatMot("ecrase", t, dm, tg, u);
                return (
                  <FlouFort key={j} dy={e.dy} style={{ display: "inline-block", marginRight: j < ligne.length - 1 ? "0.24em" : 0, opacity: e.opacite, transform: `scale(${e.sx.toFixed(4)}, ${e.sy.toFixed(4)}) rotate(${e.rot.toFixed(2)}deg)`, transformOrigin: "50% 60%" }}>
                    <MotCle mot={m.mot} t={t} arrivee={dm + 0.3} balayage={fin + 0.1} u={u} />
                  </FlouFort>
                );
              }
              // Étiré depuis un côté (alternance des lignes), tassé à l'arrêt.
              const k = courbe("signature")(borne((t - dm) / 0.32));
              const kAvant = courbe("signature")(borne((t - 1 / 50 - dm) / 0.32));
              const r = rebondImpact(t, dm + 0.32);
              const x = cote * (1 - k) * 900 * u;
              return (
                <FlouFort key={j} dx={x - cote * (1 - kAvant) * 900 * u} style={{ display: "inline-block", marginRight: j < ligne.length - 1 ? "0.24em" : 0, opacity: borne((t - dm) / 0.06), transform: `translateX(${x.toFixed(2)}px) scale(${(1 + (1 - k) * 1.2 - 0.18 * r).toFixed(4)}, ${(1 - (1 - k) * 0.3 + 0.12 * r).toFixed(4)})`, transformOrigin: cote > 0 ? "0% 70%" : "100% 70%", color: COULEURS.creme, textShadow: `0 ${10 * u}px ${50 * u}px ${avecOpacite(COULEURS.fondProfond, 0.8)}` }}>
                  {m.mot}
                </FlouFort>
              );
            })}
          </div>
        );
      })}
      {tCle >= 0 && <Eclats x={zone.x + zone.largeur * 0.5} y={yCle} debut={tCle} rayon={zone.largeur * 0.5} nombre={30} graine={41} />}
      <div style={{ position: "absolute", left: zone.x, top: haut + hSur + hTitre + 26 * u, height: Math.max(8, 12 * u), borderRadius: 12 * u, width: zone.largeur * 0.42 * courbe("glisse")(borne((t - fin + 0.1) / 0.45)), background: `linear-gradient(90deg, ${COULEURS.orangeProfond}, ${COULEURS.orangeVif}, ${COULEURS.creme})`, boxShadow: `0 0 ${26 * u}px ${COULEURS.orangeVif}` }} />
      {d.sousTitre && (
        <div style={{ position: "absolute", left: zone.x, width: zone.largeur, top: haut + hSur + hTitre + 64 * u }}>
          <MotsGeants texte={d.sousTitre} debut={fin + 0.1} taille={tSous} graisse={700} effet="etire" couleur={COULEURS.creme} largeurMax={zone.largeur} decalage={0.06} interligne={1.15} approche={-0.01} />
        </div>
      )}
      <Reflet debut={fin + 0.35} />
    </>
  );
}

function Decor({ d }: { d: DonneesTitrePleinEcran }) {
  const { largeur, hauteur } = useSpec();
  if (!d.numero) return null;
  return <FiligraneSpec texte={d.numero} x={largeur * 0.52} y={hauteur * 0.42} taille={hauteur * 0.62} debut={0.1} />;
}

export function TitrePleinEcranSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesTitrePleinEcran }) {
  return (
    <SceneSpectaculaire mp={p} decor={<Decor d={p.donnees} />}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
