/**
 * Modèle 6 — TITRE OU GÉNÉRIQUE. Titre : le sur-titre s'ouvre entre deux traits, le titre se construit lettre à
 * lettre (3D, flou de mouvement), son mot-clé passe en orange et se souligne, un faisceau de lumière balaie la
 * scène. Jamais choisi tout seul (B.21) ; jamais de nom ni de marque dans un titre d'accroche.
 * Générique : le titre puis 2 à 5 lignes qui montent l'une après l'autre.
 */
import { TitreSpectaculaire } from "./spectaculaire/TitreSpectaculaire";
import type { DonneesTitre, MiseEnPageCarte } from "../../../../src/briques/motion/types";
import { avecOpacite, CarteMotion, COULEURS, DUREES, progres, TexteCinetique, Trait, useMotion } from "./noyau";

/** Le titre avec son mot-clé marqué `*…*` pour la typographie cinétique (une seule fois). */
export function titreMarque(titre: string, motCle?: string): string {
  if (!motCle || titre.includes("*")) return titre;
  const i = titre.toLowerCase().indexOf(motCle.toLowerCase());
  if (i < 0) return titre;
  return `${titre.slice(0, i)}*${titre.slice(i, i + motCle.length)}*${titre.slice(i + motCle.length)}`;
}

function Faisceau() {
  const { t, largeur, hauteur, chute } = useMotion();
  const k = progres(t, 0.15, 2.4, "glisse");
  const x = -0.6 * largeur + k * 1.9 * largeur;
  const s = progres(t, chute, DUREES.sortie, "sortie");
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: -hauteur * 0.2,
        width: largeur * 0.5,
        height: hauteur * 1.4,
        transform: "rotate(18deg)",
        background: `linear-gradient(90deg, ${avecOpacite(COULEURS.creme, 0)}, ${avecOpacite(COULEURS.orangeVif, 0.1)} 45%, ${avecOpacite(COULEURS.creme, 0.12)} 50%, ${avecOpacite(COULEURS.orangeVif, 0.1)} 55%, ${avecOpacite(COULEURS.creme, 0)})`,
        filter: "blur(20px)",
        opacity: 1 - s,
        mixBlendMode: "screen",
      }}
    />
  );
}

function Contenu({ d }: { d: DonneesTitre }) {
  const { t, u, zoneCentree: z, taille, chute } = useMotion();
  const generique = d.variante === "generique";
  const tTitre = d.surTitre ? 0.45 : 0.2;
  const niveau = generique ? "titre" : "affiche";
  const nbLettres = d.titre.replace(/\s|\*/g, "").length;
  const finTitre = tTitre + nbLettres * DUREES.decalageLettre + DUREES.entreeLongue;
  const s = progres(t, chute, DUREES.sortie, "sortie");
  return (
    <>
      <Faisceau />
      <div style={{ position: "absolute", left: z.x, width: z.largeur, top: z.y, height: z.hauteur, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: generique ? "flex-start" : "center", paddingTop: generique ? z.hauteur * 0.12 : 0, gap: 26 * u }}>
        {d.surTitre && (
          <div style={{ display: "flex", alignItems: "center", gap: 22 * u }}>
            <Trait debut={0.1} largeur={80 * u} epaisseur={Math.max(3, 4 * u)} style={{ transform: "scaleX(-1)" }} />
            <TexteCinetique texte={d.surTitre.toUpperCase()} niveau="legende" debut={0.18} couleur={COULEURS.orangeVif} graisse={700} style={{ letterSpacing: "0.2em" }} />
            <Trait debut={0.1} largeur={80 * u} epaisseur={Math.max(3, 4 * u)} />
          </div>
        )}
        <div style={{ textShadow: `0 ${8 * u}px ${40 * u}px ${avecOpacite(COULEURS.fondProfond, 0.8)}` }}>
          <TexteCinetique texte={titreMarque(d.titre, d.motCle)} niveau={niveau} mode="lettres" debut={tTitre} alignement="center" largeurMax={z.largeur * 0.96} />
        </div>
        {!generique && <Trait debut={finTitre - 0.2} largeur={z.largeur * 0.28} epaisseur={Math.max(5, 8 * u)} />}
        {d.sousTitre && <TexteCinetique texte={d.sousTitre} niveau="corps" debut={finTitre} alignement="center" couleur={COULEURS.cremeAttenuee} graisse={600} />}
        {generique &&
          (d.lignes ?? []).map((l, i) => {
            const h = finTitre + 0.1 + i * 0.32;
            const y = (1 - progres(t, h, DUREES.entreeLongue)) * 60 * u;
            return (
              <div key={i} style={{ transform: `translateY(${y.toFixed(2)}px)`, opacity: progres(t, h, 0.3) * (1 - s), fontSize: taille("legende"), fontWeight: i === 0 ? 700 : 500, color: i === 0 ? COULEURS.creme : COULEURS.cremeAttenuee, textAlign: "center" }}>
                {l}
              </div>
            );
          })}
      </div>
    </>
  );
}

export function MotionTitre(p: MiseEnPageCarte & { donnees: DonneesTitre }) {
  if (p.style === "spectaculaire") return <TitreSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p} intensiteLumiere={1.25}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
