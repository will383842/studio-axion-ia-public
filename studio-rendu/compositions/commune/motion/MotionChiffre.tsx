/**
 * Modèle 2 — CHIFFRE QUI COMPTE : un anneau se dessine pendant que le nombre compte (sortie expo : vite puis se
 * pose), l'unité arrive en orange, le sens du chiffre se construit dessous. Graduations qui tournent lentement,
 * comète au bout de l'anneau, lueur qui respire une fois le chiffre posé.
 */
import { ChiffreSpectaculaire } from "./spectaculaire/ChiffreSpectaculaire";
import type { DonneesChiffre, MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { avecOpacite, CarteMotion, COULEURS, DUREES, echelleRessort, FlouMouvement, formaterNombre, IconeTracee, progres, TexteCinetique, Trait, useMotion, valeurCompteur } from "./noyau";

const DUREE_COMPTE = 1.35;

function Contenu({ d }: { d: DonneesChiffre }) {
  const { t, u, zoneCentree: z, taille, chute, largeur } = useMotion();
  const debut = d.aSec ?? 0.35;
  const depuis = d.depuis ?? 0;
  const v = valeurCompteur(t, debut, depuis, d.valeur, DUREE_COMPTE);
  const vAvant = valeurCompteur(t - DUREES.obturateur, debut, depuis, d.valeur, DUREE_COMPTE);
  const k = progres(t, debut, DUREE_COMPTE, "signature");
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const posé = progres(t, debut + DUREE_COMPTE * 0.8, 0.5, "douce");
  const R = Math.min(z.largeur * 0.46, z.hauteur * 0.3);
  const cx = largeur / 2;
  const cy = z.y + z.hauteur * 0.47;
  const grand = Math.round(taille("affiche") * 1.72);
  const texte = formaterNombre(v, d.decimales ?? 0);
  // Flou des chiffres pendant qu'ils défilent (vertical), proportionnel à la vitesse du compteur.
  const vitesse = Math.abs(v - vAvant) / Math.max(1, Math.abs(d.valeur - depuis));
  const flouChiffres = Math.min(14, vitesse * 260) * u;
  const anneau = echelleRessort(t, debut - 0.15, chute);
  const respire = 1 + 0.018 * Math.sin((t - debut) * 3.1) * posé;
  const angle = -90 + 360 * k;
  const comete = { x: cx + R * Math.cos((angle * Math.PI) / 180), y: cy + R * Math.sin((angle * Math.PI) / 180) };
  const epaisseur = Math.max(8, 14 * u);
  return (
    <>
      {/* Halo derrière le chiffre. */}
      <div style={{ position: "absolute", left: cx - R * 1.4, top: cy - R * 1.4, width: R * 2.8, height: R * 2.8, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.orange, 0.3 * (0.6 + 0.4 * posé))}, ${avecOpacite(COULEURS.orange, 0)} 62%)`, opacity: (1 - s) * progres(t, debut - 0.2, 0.6), transform: `scale(${(respire * (0.85 + 0.15 * k)).toFixed(4)})` }} />
      <svg width={largeur} height={cy + R * 1.6} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - s, transform: `scale(${(0.86 + 0.14 * anneau).toFixed(4)})`, transformOrigin: `${cx}px ${cy}px` }}>
        <defs>
          <linearGradient id="anneauChiffre" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={COULEURS.orangeVif} />
            <stop offset="1" stopColor={COULEURS.orangeProfond} />
          </linearGradient>
        </defs>
        {/* Graduations qui tournent lentement (mouvement secondaire). */}
        <g transform={`rotate(${(t * 6).toFixed(3)} ${cx} ${cy})`} opacity={0.5 * progres(t, 0.05, 0.8)}>
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i / 72) * Math.PI * 2;
            const r1 = R + epaisseur * 1.6;
            const r2 = r1 + (i % 6 === 0 ? 22 : 10) * u;
            return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} stroke={i % 6 === 0 ? COULEURS.cremeAttenuee : COULEURS.filet} strokeWidth={Math.max(1.5, 2.5 * u)} strokeLinecap="round" />;
          })}
        </g>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={COULEURS.surfaceHaute} strokeWidth={epaisseur} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="url(#anneauChiffre)" strokeWidth={epaisseur} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k).toFixed(4)} transform={`rotate(-90 ${cx} ${cy})`} />
        {k > 0.01 && k < 0.999 && <circle cx={comete.x} cy={comete.y} r={epaisseur * 0.9} fill={COULEURS.creme} style={{ filter: `drop-shadow(0 0 ${12 * u}px ${COULEURS.orangeVif})` }} />}
      </svg>
      {d.icone && (
        <div style={{ position: "absolute", left: cx - taille("titre") * 0.5, top: cy - R * 0.68, opacity: 1 - s }}>
          <IconeTracee nom={d.icone} taille={taille("titre")} debut={debut - 0.1} couleur={COULEURS.orangeVif} epaisseur={2.2} />
        </div>
      )}
      <div style={{ position: "absolute", left: cx - R, width: R * 2, top: cy - grand * 0.56, display: "flex", justifyContent: "center", alignItems: "baseline", opacity: (1 - s) * progres(t, debut - 0.05, 0.25), transform: `scale(${(respire * (0.9 + 0.1 * echelleRessort(t, debut - 0.05, chute + 9))).toFixed(4)}) translateY(${(-s * 60 * u).toFixed(2)}px)` }}>
        {d.prefixe && <span style={{ fontSize: grand * 0.55, fontWeight: 800, color: COULEURS.orangeVif, marginRight: 8 * u }}>{d.prefixe}</span>}
        <FlouMouvement dy={flouChiffres * 2} style={{ display: "inline-block" }}>
          <span style={{ fontSize: grand, fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: COULEURS.creme, textShadow: `0 ${6 * u}px ${30 * u}px ${avecOpacite(COULEURS.fondProfond, 0.7)}` }}>{texte}</span>
        </FlouMouvement>
        {d.unite && (
          <span style={{ fontSize: taille("titre") * 0.95, fontWeight: 800, color: COULEURS.orangeVif, marginLeft: 12 * u, opacity: progres(t, debut + 0.35, 0.3), transform: `translateX(${((1 - progres(t, debut + 0.35, DUREES.entree)) * 30 * u).toFixed(2)}px)`, display: "inline-block" }}>{d.unite}</span>
        )}
      </div>
      <div style={{ position: "absolute", left: z.x, width: z.largeur, top: cy + R + 70 * u, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * u }}>
        <TexteCinetique texte={d.libelle} niveau="corps" debut={debut + 0.55} alignement="center" largeurMax={z.largeur} />
      </div>
      {d.surTitre && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: cy - R - 150 * u, display: "flex", alignItems: "center", justifyContent: "center", gap: 22 * u, opacity: 1 - s }}>
          <Trait debut={0.05} largeur={70 * u} epaisseur={Math.max(3, 4 * u)} style={{ transform: "scaleX(-1)" }} />
          <TexteCinetique texte={d.surTitre.toUpperCase()} niveau="legende" debut={0.1} couleur={COULEURS.orangeVif} graisse={700} style={{ letterSpacing: "0.16em" }} />
          <Trait debut={0.05} largeur={70 * u} epaisseur={Math.max(3, 4 * u)} />
        </div>
      )}
    </>
  );
}

export function MotionChiffre(p: MiseEnPageCarte & { donnees: DonneesChiffre }) {
  if (p.style === "spectaculaire") return <ChiffreSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
