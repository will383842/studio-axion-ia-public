/**
 * Modèle 12 — TITRE PLEIN ÉCRAN (lot F2, JAMAIS automatique : seulement à la demande). Gros titre éditorial façon
 * « un créateur de référence » : les mots, aussi grands que l'image le permet, sortent ligne à ligne de derrière un masque (flou de
 * mouvement vertical), le mot clé en orange ; le numéro de chapitre dérive en filigrane géant, une barre orange
 * souligne, le sous-titre suit. Différent du modèle 6 (titre lettre à lettre) : ici, l'image EST le titre.
 */
import { couperLignes, tailleQuiTient } from "../../../../src/briques/motion/mesure";
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import type { DonneesTitrePleinEcran } from "../../../../src/briques/motion/types-etendus";
import { titreMarque } from "./MotionTitre";
import { avecOpacite, CarteMotion, COULEURS, deplacementObturateur, DUREES, Filigrane, FlouMouvement, lireBalises, progres, TexteCinetique, Trait, useMotion } from "./noyau";
import { TitrePleinEcranSpectaculaire } from "./spectaculaire/TitrePleinEcranSpectaculaire";

const APPROCHE = -0.04;
const INTERLIGNE_GEANT = 0.96;

/**
 * Lignes et taille du titre géant : la plus grande taille (jusqu'à 17 % de la hauteur) qui tient en largeur et dans
 * `hauteurMax`, 5 lignes au plus. Les mots restent entiers ; le marquage `*mot*` suit chaque mot.
 */
export function composerTitreGeant(texteMarque: string, largeur: number, hauteurMax: number, hauteurVideo: number, plancher: number) {
  const { mots, marques } = lireBalises(texteMarque);
  const brut = mots.join(" ");
  for (let taille = Math.round(hauteurVideo * 0.17); taille >= plancher; taille -= 4) {
    const t = tailleQuiTient(brut, taille, 900, largeur, plancher, APPROCHE);
    if (t < taille) continue;
    const lignes = couperLignes(brut, taille, 900, largeur, APPROCHE);
    if (lignes.length <= 5 && lignes.length * taille * INTERLIGNE_GEANT <= hauteurMax) {
      let i = 0;
      return { taille, lignes: lignes.map((l) => l.map((m) => ({ mot: m, cle: marques.has(i++) }))) };
    }
  }
  let i = 0;
  return { taille: plancher, lignes: couperLignes(brut, plancher, 900, largeur, APPROCHE).map((l) => l.map((m) => ({ mot: m, cle: marques.has(i++) }))) };
}

function Contenu({ d }: { d: DonneesTitrePleinEcran }) {
  const { t, u, zone, taille, chute, hauteurVideo, mesurer } = useMotion();
  const hSur = d.surTitre ? taille("legende") * 1.4 + 30 * u : 0;
  const hSous = d.sousTitre ? mesurer(d.sousTitre, "corps", zone.largeur) + 40 * u : 0;
  const { taille: tg, lignes } = composerTitreGeant(titreMarque(d.titre, d.motCle), zone.largeur, (zone.hauteur - hSur - hSous - 60 * u) * 0.98, hauteurVideo, taille("titre"));
  const hLigne = tg * INTERLIGNE_GEANT;
  const hTitre = lignes.length * hLigne;
  const haut = zone.y + (zone.hauteur - (hSur + hTitre + 50 * u + hSous)) / 2;
  const tTitre = d.surTitre ? 0.4 : 0.2;
  const fin = tTitre + (lignes.length - 1) * 0.14 + 0.55;
  const s = progres(t, chute, DUREES.sortie, "sortie");
  return (
    <>
      {d.numero && <Filigrane texte={d.numero} x={zone.x + zone.largeur * 0.3} y={zone.y + zone.hauteur * 0.08} taille={zone.hauteur * 0.62} debut={0.05} />}
      {d.surTitre && (
        <div style={{ position: "absolute", left: zone.x, top: haut, display: "flex", alignItems: "center", gap: 22 * u, opacity: 1 - s }}>
          <Trait debut={0.08} largeur={80 * u} epaisseur={Math.max(4, 6 * u)} />
          <TexteCinetique texte={d.surTitre.toUpperCase()} niveau="legende" debut={0.14} couleur={COULEURS.orangeVif} graisse={700} style={{ letterSpacing: "0.2em" }} />
        </div>
      )}
      {lignes.map((ligne, i) => {
        const debut = tTitre + i * 0.14;
        const sortie = chute + i * 0.05;
        // La ligne sort de derrière son masque (bas → haut), puis retombe derrière à la chute.
        const y = (tt: number) => (1 - progres(tt, debut, DUREES.entreeLongue + 0.1, "signature")) * hLigne * 1.05 - progres(tt, sortie, DUREES.sortie, "sortie") * hLigne * 1.05;
        return (
          <div key={i} style={{ position: "absolute", left: zone.x - 10 * u, top: haut + hSur + i * hLigne, width: zone.largeur + 40 * u, height: hLigne + tg * 0.12, overflow: "hidden" }}>
            <FlouMouvement dy={deplacementObturateur(y, t)} style={{ transform: `translateY(${y(t).toFixed(2)}px)`, paddingLeft: 10 * u }}>
              <div style={{ fontSize: tg, fontWeight: 900, lineHeight: INTERLIGNE_GEANT, letterSpacing: `${APPROCHE}em`, whiteSpace: "nowrap", textShadow: `0 ${10 * u}px ${50 * u}px ${avecOpacite(COULEURS.fondProfond, 0.7)}` }}>
                {ligne.map((m, j) => (
                  <span key={j} style={{ color: m.cle ? COULEURS.orangeVif : COULEURS.creme, marginRight: j < ligne.length - 1 ? "0.24em" : 0 }}>
                    {m.mot}
                  </span>
                ))}
              </div>
            </FlouMouvement>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: zone.x, top: haut + hSur + hTitre + 26 * u }}>
        <Trait debut={fin - 0.1} largeur={zone.largeur * 0.4} epaisseur={Math.max(8, 12 * u)} />
      </div>
      {d.sousTitre && (
        <div style={{ position: "absolute", left: zone.x, width: zone.largeur, top: haut + hSur + hTitre + 64 * u }}>
          <TexteCinetique texte={d.sousTitre} niveau="corps" debut={fin + 0.05} couleur={COULEURS.cremeAttenuee} graisse={600} largeurMax={zone.largeur} />
        </div>
      )}
    </>
  );
}

export function MotionTitrePleinEcran(p: MiseEnPageCarte & { donnees: DonneesTitrePleinEcran }) {
  if (p.style === "spectaculaire") return <TitrePleinEcranSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p} intensiteLumiere={1.3}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
