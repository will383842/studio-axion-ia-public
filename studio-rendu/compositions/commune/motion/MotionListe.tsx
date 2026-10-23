/**
 * Modèle 1 — LISTE : un titre souligné, puis 2 à 5 points qui arrivent au mot près (glissent, se précisent, leur
 * pastille rebondit et leur icône se dessine). Le point dit est mis en avant ; les précédents s'effacent un peu.
 * Finitions du 10/10 : boîtes calculées AVANT le rendu (`disposerListe`) — tailles et espacements resserrés, ou deux
 * colonnes, pour que tous les points tiennent dans la zone sûre (avant : bloc centré à taille fixe, le 4e point sortait
 * du panneau de l'écran partagé).
 */
import { horairesParDefaut } from "../../../../src/briques/motion/calage";
import { disposerListe } from "../../../../src/briques/motion/disposition-liste";
import type { DonneesListe, MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { ListeSpectaculaire } from "./spectaculaire/ListeSpectaculaire";
import { avecOpacite, CarteMotion, COULEURS, deplacementObturateur, DUREES, echelleRessort, Filigrane, FlouMouvement, IconeTracee, progres, stylePanneau, TexteCinetique, Trait, useMotion } from "./noyau";

function Contenu({ d, mp }: { d: DonneesListe; mp: MiseEnPageCarte }) {
  const { t, u, zone, chute, duree } = useMotion();
  const n = d.elements.length;
  const defaut = horairesParDefaut(n, duree, !!d.titre);
  const heures = d.elements.map((e, i) => e.aSec ?? defaut[i]);
  const numerotee = d.numerotee ?? !d.elements.some((e) => e.icone);
  const actif = heures.reduce((a, h, i) => (t >= h ? i : a), -1);
  const tTitre = d.aSecTitre ?? 0.12;
  const disp = disposerListe({ titre: d.titre, textes: d.elements.map((e) => e.texte), mp });
  const { pastille, marge } = disp;
  return (
    <>
    <Filigrane texte={String(n)} x={zone.x + zone.largeur * 0.62} y={zone.y + zone.hauteur * 0.86} taille={zone.hauteur * 0.5} debut={0.2} />
    {d.titre && disp.boiteTitre && (
      <div style={{ position: "absolute", left: zone.x, top: zone.y + disp.boiteTitre.y, width: zone.largeur }}>
        <TexteCinetique texte={d.titre} niveau="titre" debut={tTitre} taillePx={disp.tailleTitre} />
        <Trait debut={tTitre + 0.25} largeur={zone.largeur * 0.22} epaisseur={Math.max(4, 7 * u)} style={{ marginTop: 18 * u }} />
      </div>
    )}
    {d.elements.map((e, i) => {
      const b = disp.boites[i];
      const h = heures[i];
      const x = (tt: number) => (1 - progres(tt, h, DUREES.entree, "signature")) * 90 * u - progres(tt, chute + (n - 1 - i) * 0.04, DUREES.sortie, "sortie") * 70 * u;
      const ouverture = progres(t, h, DUREES.entree * 0.6, "douce") * (1 - progres(t, chute + (n - 1 - i) * 0.04, DUREES.sortie, "sortie"));
      const estActif = i === actif;
      const passe = i < actif;
      const k = estActif ? progres(t, h, 0.3) : passe ? 1 - progres(t, heures[i + 1], 0.35) : 0;
      const dx = deplacementObturateur(x, t);
      const echelle = echelleRessort(t, h, chute + (n - 1 - i) * 0.04);
      return (
        <FlouMouvement key={i} dx={dx} style={{ position: "absolute", left: zone.x + b.x, top: zone.y + b.y, width: b.largeur, height: b.hauteur, opacity: ouverture, transform: `translateX(${x(t).toFixed(2)}px)` }}>
          <div style={{ ...stylePanneau(u, k), boxSizing: "border-box", height: "100%", display: "flex", alignItems: "center", gap: marge.interne, padding: `${marge.v}px ${marge.droite}px ${marge.v}px ${marge.gauche}px`, transform: `scale(${(1 + 0.025 * k).toFixed(4)})`, transformOrigin: "0% 50%" }}>
            <div
              style={{
                flex: "none",
                width: pastille,
                height: pastille,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${echelle.toFixed(4)})`,
                background: k > 0 ? `radial-gradient(circle at 35% 30%, ${COULEURS.orangeVif}, ${COULEURS.orange} 60%, ${COULEURS.orangeProfond})` : COULEURS.surfaceHaute,
                boxShadow: `0 0 0 ${2 * u}px ${avecOpacite(COULEURS.orange, 0.5 + 0.5 * k)}, 0 0 ${40 * u * k}px ${avecOpacite(COULEURS.orangeVif, 0.55 * k)}`,
              }}
            >
              {numerotee ? (
                <span style={{ fontSize: pastille * 0.5, fontWeight: 800, color: COULEURS.creme, lineHeight: 1 }}>{i + 1}</span>
              ) : e.icone ? (
                <IconeTracee nom={e.icone} taille={pastille * 0.52} debut={h + 0.12} epaisseur={2.3} />
              ) : (
                // Liste non numérotée dont seuls certains points ont une icône (Vérif V2, 10/10) : un point, jamais
                // un numéro isolé (« icône, 2, 3 » : on cherchait le 1).
                <span style={{ width: pastille * 0.2, height: pastille * 0.2, borderRadius: "50%", background: COULEURS.creme }} />
              )}
            </div>
            <TexteCinetique texte={e.texte} niveau="corps" debut={h + 0.08} taillePx={disp.tailleTexte} largeurMax={disp.largeurTexte} opacite={passe ? 0.62 + 0.38 * k : 1} chute={chute + (n - 1 - i) * 0.04} style={{ flex: "1 1 auto", minWidth: 0 }} />
          </div>
        </FlouMouvement>
      );
    })}
    </>
  );
}

export function MotionListe(p: MiseEnPageCarte & { donnees: DonneesListe }) {
  if (p.style === "spectaculaire") return <ListeSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} mp={p} />
    </CarteMotion>
  );
}
