/**
 * Modèle 2 — CHIFFRE, style « Spectaculaire » : un portail d'anneaux tourne au sol en perspective, le nombre défile en
 * grandissant (flou de défilement marqué), puis S'ÉCRASE à sa valeur et EXPLOSE EN ÉCLATS (onde de choc, éclair).
 * L'unité arrive étirée en orange avec son halo, le sens du chiffre rebondit dessous, un balayage de lumière passe.
 */
import type { DonneesChiffre, MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import { formaterNombre, valeurCompteur } from "../noyau";
import { avecOpacite, borne, COULEURS, courbe, Eclats, etatMot, FiligraneSpec, FlouFort, IconeSpec, MotCle, MotsGeants, progres, rebondImpact, SceneSpectaculaire, useSpec } from "./noyau";

const DUREE_COMPTE = 0.95;

function Portail({ cx, cy, R }: { cx: number; cy: number; R: number }) {
  const { t, u } = useSpec();
  const e = progres(t, 0.3, 0.8);
  return (
    <div style={{ position: "absolute", left: cx - R * 1.25, top: cy - R * 1.25, width: R * 2.5, height: R * 2.5, perspective: `${(1100 * u).toFixed(0)}px` }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(R * 0.62).toFixed(1)}px) rotateX(76deg) scale(${(0.6 + 0.4 * e).toFixed(3)})`, opacity: e }}>
        {[1, 0.78, 0.56, 0.36].map((r, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(50 - r * 50).toFixed(2)}%`,
              top: `${(50 - r * 50).toFixed(2)}%`,
              width: `${(r * 100).toFixed(2)}%`,
              height: `${(r * 100).toFixed(2)}%`,
              borderRadius: "50%",
              border: `${(i === 0 ? 6 : 3) * u}px ${i % 2 ? "dashed" : "solid"} ${avecOpacite(i === 0 ? COULEURS.orangeVif : COULEURS.orange, 0.75 - i * 0.12)}`,
              transform: `rotate(${((i % 2 ? -1 : 1) * t * (22 + i * 9)).toFixed(2)}deg)`,
              boxShadow: i === 0 ? `0 0 ${40 * u}px ${avecOpacite(COULEURS.orangeVif, 0.55)}, inset 0 0 ${40 * u}px ${avecOpacite(COULEURS.orangeVif, 0.4)}` : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Contenu({ d }: { d: DonneesChiffre }) {
  const { t, u, zoneCentree: z, taille, largeur, entree, hauteurVideo } = useSpec();
  const debut = Math.max(entree + 0.05, d.aSec ?? 0.35);
  const ti = debut + DUREE_COMPTE;
  const depuis = d.depuis ?? 0;
  const v = valeurCompteur(t, debut, depuis, d.valeur, DUREE_COMPTE);
  const vAvant = valeurCompteur(t - 1 / 50, debut, depuis, d.valeur, DUREE_COMPTE);
  const texte = formaterNombre(v, d.decimales ?? 0);
  const final = formaterNombre(d.valeur, d.decimales ?? 0);
  const caracteres = final.length + (d.unite ? d.unite.length * 0.45 : 0) + (d.prefixe ? 0.6 : 0);
  const grand = Math.round(Math.min(0.33 * hauteurVideo, (z.largeur * 0.92) / (caracteres * 0.64)));
  const cx = largeur / 2;
  const cy = z.y + z.hauteur * 0.44;
  const R = Math.min(z.largeur * 0.5, grand * 0.95);
  // Pendant le compte : le nombre grandit depuis la profondeur ; à l'arrivée, il s'écrase puis se détend.
  const k = courbe("signature")(borne((t - debut) / DUREE_COMPTE));
  const r = rebondImpact(t, ti, 19, 7.5);
  const echelle = (0.45 + 0.55 * k) * (t < ti ? 1 : 1 + 0.02 * Math.sin((t - ti) * 3));
  const flou = t < ti ? Math.min(40, (Math.abs(v - vAvant) / Math.max(1, Math.abs(d.valeur - depuis))) * 2200) * u : 0;
  const visible = borne((t - debut + 0.1) / 0.15);
  const unite = etatMot("etire", t, ti + 0.5, grand * 0.4, u);
  const tLibelle = ti + 0.85;
  return (
    <>
      <Portail cx={cx} cy={cy} R={R} />
      {d.surTitre && (
        <div style={{ position: "absolute", left: z.x, width: z.largeur, top: z.y, display: "flex", justifyContent: "center", alignItems: "center", gap: 22 * u }}>
          <div style={{ height: Math.max(3, 4 * u), width: 90 * u * progres(t, entree, 0.5, "glisse"), background: COULEURS.orangeVif, boxShadow: `0 0 ${14 * u}px ${COULEURS.orangeVif}` }} />
          <MotsGeants texte={d.surTitre.toUpperCase()} debut={entree - 0.05} taille={taille("legende")} graisse={800} effet="etire" couleur={COULEURS.orangeVif} decalage={0.06} approche={0.16} />
          <div style={{ height: Math.max(3, 4 * u), width: 90 * u * progres(t, entree, 0.5, "glisse"), background: COULEURS.orangeVif, boxShadow: `0 0 ${14 * u}px ${COULEURS.orangeVif}` }} />
        </div>
      )}
      {d.icone && (
        <div style={{ position: "absolute", left: cx - taille("titre") * 0.55, top: Math.max(z.y + taille("legende") * 1.5 + 24 * u, cy - grand * 0.55 - taille("titre") * 1.1 - 10 * u), opacity: visible }}>
          <IconeSpec nom={d.icone} taille={taille("titre") * 1.1} debut={debut} couleur={COULEURS.orangeVif} epaisseur={2.2} />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, width: largeur, top: cy - grand * 0.55, display: "flex", justifyContent: "center", alignItems: "baseline", opacity: visible }}>
        <div style={{ display: "flex", alignItems: "baseline", transform: `scale(${(echelle * (1 + 0.3 * r)).toFixed(4)}, ${(echelle * (1 - 0.3 * r)).toFixed(4)})`, transformOrigin: "50% 80%" }}>
          {d.prefixe && <span style={{ fontSize: grand * 0.5, fontWeight: 900, color: COULEURS.orangeVif, marginRight: 10 * u }}>{d.prefixe}</span>}
          <FlouFort dy={flou} style={{ display: "inline-block" }}>
            <span style={{ fontSize: grand, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: COULEURS.creme, textShadow: `0 ${10 * u}px ${50 * u}px ${avecOpacite(COULEURS.fondProfond, 0.8)}, 0 0 ${(80 * u * progres(t, ti, 0.2) * (1 - progres(t, ti + 0.3, 0.8))).toFixed(1)}px ${avecOpacite(COULEURS.orangeVif, 0.9)}` }}>{texte}</span>
          </FlouFort>
          {d.unite && (
            <FlouFort dx={unite.dx} style={{ display: "inline-block", marginLeft: 14 * u, opacity: unite.opacite, transform: `translateX(${unite.tx.toFixed(2)}px) scale(${unite.sx.toFixed(4)}, ${unite.sy.toFixed(4)})`, transformOrigin: "0% 100%", fontSize: grand * 0.4, fontWeight: 900 }}>
              <MotCle mot={d.unite} t={t} arrivee={ti + 0.75} balayage={ti + 1.6} u={u} />
            </FlouFort>
          )}
        </div>
      </div>
      <Eclats x={cx} y={cy} debut={ti} rayon={R * 1.15} nombre={36} graine={3} />
      <div style={{ position: "absolute", left: z.x, width: z.largeur, top: cy + R * 0.95 + 40 * u, display: "flex", justifyContent: "center" }}>
        <MotsGeants texte={d.libelle} debut={tLibelle} taille={Math.round(taille("corps") * 1.05)} graisse={700} effet="rebond" alignement="center" largeurMax={z.largeur} decalage={0.07} interligne={1.15} approche={-0.01} />
      </div>
    </>
  );
}

function Decor({ d }: { d: DonneesChiffre }) {
  const { largeur, hauteur } = useSpec();
  return <FiligraneSpec texte={formaterNombre(d.valeur, d.decimales ?? 0)} x={largeur * 0.5} y={hauteur * 0.46} taille={hauteur * 0.7} debut={0.2} />;
}

export function ChiffreSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesChiffre }) {
  return (
    <SceneSpectaculaire mp={p} decor={<Decor d={p.donnees} />}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
