/**
 * Modèle 3 — AVANT / APRÈS : la barre d'avant monte (ressort) en comptant ; au mot qui dit « après », la seconde
 * barre part de la hauteur d'avant et se réduit (ou grandit) jusqu'à sa valeur en orange, une flèche se trace de l'une
 * à l'autre et la pastille de l'écart rebondit.
 */
import { AvantApresSpectaculaire } from "./spectaculaire/AvantApresSpectaculaire";
import type { DonneesAvantApres, MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { avecOpacite, CarteMotion, COULEURS, deplacementObturateur, DUREES, echelleRessort, FlouMouvement, formaterNombre, IconeTracee, mixer, progres, ressort, TexteCinetique, useMotion, valeurCompteur } from "./noyau";

/** Écart affiché : « −75 % » (baisse) ou « ×3 » (hausse d'au moins 2 fois), sinon « +40 % ». */
export function ecartAvantApres(avant: number, apres: number): string {
  if (avant === 0) return "";
  if (apres > avant && apres / avant >= 2) return `×${formaterNombre(apres / avant, apres / avant >= 10 ? 0 : 1).replace(/,0$/, "")}`;
  const p = Math.round(((apres - avant) / avant) * 100);
  return `${p < 0 ? "−" : "+"}${Math.abs(p)} %`;
}

function Contenu({ d }: { d: DonneesAvantApres }) {
  const { t, u, zoneCentree: z, taille, chute, largeur, hauteur, mesurer } = useMotion();
  const tAvant = 0.3;
  const tApres = d.aSecApres ?? 1.7;
  const max = Math.max(d.avant.valeur, d.apres.valeur, 1e-6);
  // Mise en page verticale MESURÉE : titre, pastille de l'écart, valeurs, barres, étiquettes.
  const basTitre = z.y + (d.titre ? mesurer(d.titre, "titre", z.largeur) + 36 * u : 0);
  const hPastille = taille("corps") * 1.9;
  const yPastille = basTitre + hPastille / 2;
  const hValeur = taille("titre") * 1.32 * 1.15;
  const hautBarres = basTitre + hPastille + 40 * u + hValeur;
  const base = z.y + z.hauteur - taille("legende") * 2.7 - 22 * u;
  const Hmax = Math.max(120 * u, base - hautBarres);
  const lb = Math.min(z.largeur * 0.3, 280 * u);
  const ecartCols = z.largeur * 0.16;
  const xAvant = largeur / 2 - ecartCols / 2 - lb;
  const xApres = largeur / 2 + ecartCols / 2;
  const s = progres(t, chute, DUREES.sortie, "sortie");

  const hAvant = (tt: number) => (tt <= tAvant ? 0 : ressort(tt - tAvant, "souple")) * (d.avant.valeur / max) * Hmax;
  // Après : part de la hauteur d'avant puis glisse vers sa valeur (glisse + petit ressort à l'arrivée).
  const hApres = (tt: number) => {
    if (tt < tApres) return 0;
    const apparition = progres(tt, tApres, 0.22, "signature");
    const k = tt <= tApres + 0.18 ? 0 : ressort(tt - tApres - 0.18, "chute");
    return apparition * mixer(d.avant.valeur / max, d.apres.valeur / max, k) * Hmax;
  };
  const vAvant = valeurCompteur(t, tAvant, 0, d.avant.valeur, 0.9);
  const vApres = t < tApres ? d.avant.valeur : valeurCompteur(t, tApres + 0.18, d.avant.valeur, d.apres.valeur, 1.0);
  const ecart = d.ecart ?? ecartAvantApres(d.avant.valeur, d.apres.valeur);
  const tEcart = tApres + 0.85;
  const baisse = d.apres.valeur < d.avant.valeur;
  const rayon = Math.round(22 * u);

  const colonne = (cote: "avant" | "apres", x: number, h: number, dh: number, valeur: number, debut: number) => {
    const val = cote === "avant" ? d.avant : d.apres;
    const orange = cote === "apres";
    const visible = progres(t, debut, 0.2) * (1 - s);
    return (
      <div key={cote} style={{ position: "absolute", left: x, width: lb, top: 0, height: base, opacity: visible }}>
        {/* Valeur au-dessus de la barre. */}
        <div style={{ position: "absolute", left: -lb * 0.25, width: lb * 1.5, top: base - h - hValeur, textAlign: "center", fontWeight: 900, fontSize: taille("titre") * 1.32, letterSpacing: "-0.03em", lineHeight: 1, color: orange ? COULEURS.orangeVif : COULEURS.creme, fontVariantNumeric: "tabular-nums" }}>
          {formaterNombre(valeur, Number.isInteger(val.valeur) ? 0 : 1)}
          <span style={{ fontSize: "0.55em", fontWeight: 800, marginLeft: "0.12em", color: orange ? COULEURS.orangeVif : COULEURS.cremeAttenuee }}>{val.unite}</span>
        </div>
        {/* Barre (flou de mouvement vertical). */}
        <FlouMouvement dy={dh} style={{ position: "absolute", left: 0, width: lb, top: base - h, height: h }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: `${rayon}px ${rayon}px ${rayon * 0.4}px ${rayon * 0.4}px`,
              background: orange
                ? `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange} 45%, ${COULEURS.orangeProfond})`
                : `repeating-linear-gradient(135deg, ${avecOpacite(COULEURS.creme, 0.07)} 0 ${10 * u}px, transparent ${10 * u}px ${22 * u}px), linear-gradient(180deg, ${COULEURS.surfaceHaute}, ${COULEURS.surface})`,
              boxShadow: orange
                ? `0 0 ${60 * u}px ${avecOpacite(COULEURS.orangeVif, 0.45)}, inset 0 ${2 * u}px 0 ${avecOpacite(COULEURS.creme, 0.35)}`
                : `inset 0 0 0 ${2 * u}px ${COULEURS.filet}, inset 0 ${2 * u}px 0 ${avecOpacite(COULEURS.creme, 0.12)}`,
            }}
          />
        </FlouMouvement>
        {/* Étiquette sous la ligne de base. */}
        <div style={{ position: "absolute", left: -lb * 0.3, width: lb * 1.6, top: base + 22 * u, textAlign: "center" }}>
          <TexteCinetique texte={(cote === "avant" ? (d.etiquetteAvant ?? "Avant") : (d.etiquetteApres ?? "Après")).toUpperCase()} niveau="legende" debut={debut + 0.05} graisse={700} couleur={orange ? COULEURS.orangeVif : COULEURS.cremeAttenuee} alignement="center" style={{ letterSpacing: "0.12em" }} />
          {val.libelle && <TexteCinetique texte={val.libelle} niveau="legende" debut={debut + 0.15} graisse={500} alignement="center" opacite={0.9} />}
        </div>
      </div>
    );
  };

  // Flèche courbe du haut de la barre d'avant vers le haut de celle d'après.
  const ha = hAvant(t);
  const hp = hApres(t);
  const x1 = xAvant + lb * 0.5;
  const y1 = base - ha - hValeur - 14 * u;
  const x2 = xApres + lb * 0.5;
  const y2 = base - (d.apres.valeur / max) * Hmax - hValeur - 14 * u;
  const kFleche = progres(t, tApres + 0.3, 0.6, "glisse");
  const yc = Math.max(yPastille + hPastille * 0.7, Math.min(y1, y2) - 60 * u);
  const pastille = echelleRessort(t, tEcart, chute);
  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: z.y }}>
          <TexteCinetique texte={d.titre} niveau="titre" debut={0.1} alignement="center" />
        </div>
      )}
      {/* Ligne de base. */}
      <div style={{ position: "absolute", left: largeur / 2 - (lb + ecartCols / 2) * 1.25 * progres(t, 0.15, 0.6, "glisse"), width: (lb + ecartCols / 2) * 2.5 * progres(t, 0.15, 0.6, "glisse"), top: base, height: Math.max(2, 3 * u), background: COULEURS.filet, opacity: 1 - s }} />
      {colonne("avant", xAvant, ha, deplacementObturateur(hAvant, t), vAvant, tAvant)}
      {colonne("apres", xApres, hp, deplacementObturateur(hApres, t), vApres, tApres)}
      <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - s }}>
        <defs>
          <marker id="pointe-avant-apres" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 1 1 L 7 5 L 1 9" fill="none" stroke={COULEURS.cremeAttenuee} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        <path d={`M ${x1 + 30 * u} ${y1} Q ${(x1 + x2) / 2} ${yc} ${x2 - 30 * u} ${y2 - 6 * u}`} fill="none" stroke={COULEURS.cremeAttenuee} strokeWidth={Math.max(3, 4 * u)} strokeLinecap="round" strokeDasharray={`${(kFleche * 1).toFixed(4)} 1`} pathLength={1} markerEnd={kFleche > 0.97 ? "url(#pointe-avant-apres)" : undefined} />
      </svg>
      {ecart && (
        <div style={{ position: "absolute", left: largeur / 2, top: yPastille, transform: `translate(-50%, -50%) scale(${pastille.toFixed(4)}) rotate(${((1 - Math.min(1, pastille)) * -8).toFixed(2)}deg)`, display: "flex", alignItems: "center", gap: 10 * u, padding: `${14 * u}px ${28 * u}px`, borderRadius: 999, background: `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange})`, boxShadow: `0 ${14 * u}px ${40 * u}px ${avecOpacite(COULEURS.fondProfond, 0.6)}, 0 0 ${50 * u}px ${avecOpacite(COULEURS.orangeVif, 0.5)}` }}>
          <IconeTracee nom={baisse ? "baisse" : "hausse"} taille={taille("corps") * 0.95} debut={tEcart + 0.1} couleur={COULEURS.creme} epaisseur={2.6} />
          <span style={{ fontSize: taille("corps") * 1.05, fontWeight: 800, color: COULEURS.creme, letterSpacing: "-0.01em" }}>{ecart}</span>
        </div>
      )}
    </>
  );
}

export function MotionAvantApres(p: MiseEnPageCarte & { donnees: DonneesAvantApres }) {
  if (p.style === "spectaculaire") return <AvantApresSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
