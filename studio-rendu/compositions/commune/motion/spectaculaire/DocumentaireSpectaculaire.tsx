/**
 * Modèle 13 — DOCUMENTAIRE, style « Spectaculaire » (lot F2). Toujours une carte de reportage, avec plus d'impact :
 * une fuite de lumière traverse l'image, le repère de lieu TOMBE et frappe le sol (onde), le lieu se frappe lettre à
 * lettre — chaque lettre s'allume en orange puis refroidit en crème —, la date s'étire, et le chiffre clé compte puis
 * s'écrase en éclats, son unité en orange avec son halo. Le bloc flotte en perspective. Jamais de nom ni de bandeau.
 */
import type { MiseEnPageCarte } from "../../../../../src/briques/motion/types";
import type { DonneesDocumentaire } from "../../../../../src/briques/motion/types-etendus";
import { valeurCompteur } from "../noyau";
import { FRAPPE, horairesDocumentaire, Repere } from "../MotionDocumentaire";
import { texteValeur } from "../outils-etendus";
import { avecOpacite, borne, COULEURS, courbe, Eclats, FlouFort, MotCle, MotsGeants, rebondImpact, SceneSpectaculaire, useSpec } from "./noyau";

/** Lieu frappé : chaque lettre arrive chaude (orange, halo) puis refroidit en crème ; curseur orange. */
function LieuFrappe({ texte, debut, taille }: { texte: string; debut: number; taille: number }) {
  const { t, u } = useSpec();
  const fin = debut + texte.length * FRAPPE;
  const curseur = t >= debut - 0.2 && t < fin + 0.7 && (t < fin || Math.floor((t - fin) / 0.25) % 2 === 0);
  return (
    <div style={{ fontSize: taille, fontWeight: 900, letterSpacing: "0.03em", lineHeight: 1.06, textTransform: "uppercase", whiteSpace: "pre-wrap" }}>
      {/* Un groupe insécable par mot : la ligne ne se coupe jamais au milieu d'un mot. */}
      {texte.split(" ").map((mot, m, mots) => {
        const avant = mots.slice(0, m).join(" ").length + (m > 0 ? 1 : 0);
        return (
          <span key={m} style={{ display: "inline-block", whiteSpace: "nowrap", marginRight: m < mots.length - 1 ? "0.28em" : 0 }}>
            {Array.from(mot).map((c, j) => {
              const ti = debut + (avant + j) * FRAPPE;
              const chaud = 1 - borne((t - ti) / 0.35);
              const visible = t >= ti;
              return (
                <span key={j} style={{ visibility: visible ? "visible" : "hidden", color: chaud > 0.02 && visible ? COULEURS.orangeVif : COULEURS.creme, textShadow: visible && chaud > 0.02 ? `0 0 ${(24 * chaud * u).toFixed(1)}px ${avecOpacite(COULEURS.orangeVif, 0.9 * chaud)}` : undefined, display: "inline-block", transform: `translateY(${(visible ? -10 * u * chaud : 0).toFixed(2)}px) scale(${(1 + 0.18 * chaud).toFixed(3)})` }}>
                  {c}
                </span>
              );
            })}
          </span>
        );
      })}
      {curseur && <span style={{ display: "inline-block", width: taille * 0.1, height: taille * 0.9, marginLeft: taille * 0.05, verticalAlign: "-0.08em", background: COULEURS.orangeVif, boxShadow: `0 0 ${taille * 0.3}px ${COULEURS.orangeVif}` }} />}
    </div>
  );
}

/** Fuite de lumière : une nappe orange et crème qui traverse l'image en diagonale, une fois. */
function FuiteLumiere({ debut }: { debut: number }) {
  const { t, largeur: L, hauteur: H } = useSpec();
  const k = borne((t - debut) / 1.4);
  if (k <= 0 || k >= 1) return null;
  const x = -0.8 * L + courbe("glisse")(k) * 2.2 * L;
  return <div style={{ position: "absolute", left: x - L * 0.5, top: -H * 0.2, width: L, height: H * 1.4, transform: "rotate(14deg)", mixBlendMode: "screen", opacity: Math.sin(k * Math.PI) * 0.8, background: `linear-gradient(90deg, ${avecOpacite(COULEURS.orange, 0)}, ${avecOpacite(COULEURS.orangeVif, 0.35)} 40%, ${avecOpacite(COULEURS.creme, 0.3)} 50%, ${avecOpacite(COULEURS.orangeVif, 0.3)} 60%, ${avecOpacite(COULEURS.orange, 0)})`, filter: "blur(30px)" }} />;
}

function Contenu({ d }: { d: DonneesDocumentaire }) {
  const { t, u, zone, taille, entree, moitie } = useSpec();
  const h = horairesDocumentaire(d, Math.max(entree + 0.25, Math.min(1.2, d.aSec ?? 0.4)));
  const tTitre = moitie ? Math.round(taille("corps") * 1.2) : Math.round(taille("titre") * 1.08);
  const grand = Math.round(moitie ? taille("titre") * 1.5 : taille("affiche") * 1.25);
  const tSecond = moitie ? taille("legende") : taille("corps");
  const contexte = moitie ? undefined : d.contexte;
  const tImpact = h.tChiffre + 0.75;
  const v = d.chiffre ? valeurCompteur(t, h.tChiffre, 0, d.chiffre.valeur, 0.75) : 0;
  const r = rebondImpact(t, tImpact, 19, 7.5);
  // Repère : tombe d'en haut et frappe, puis l'onde s'étend.
  const tRep = h.tLieu - 0.35;
  const kRep = courbe("sortie")(borne((t - tRep) / 0.3));
  const rebondRep = rebondImpact(t, tRep + 0.3, 18, 7);
  const onde = borne((t - tRep - 0.3) / 0.6);
  const tailleRep = tTitre * 0.9;
  const ry = -9 + 4 * courbe("glisse")(borne(t / 4.5));
  return (
    <>
      <FuiteLumiere debut={0.05} />
      <div style={{ position: "absolute", left: zone.x, top: zone.y, width: zone.largeur, height: zone.hauteur, display: "flex", flexDirection: "column", justifyContent: "safe center", perspective: `${(1500 * u).toFixed(0)}px` }}>
        <div style={{ position: "relative", paddingLeft: 46 * u, display: "flex", flexDirection: "column", gap: (moitie ? 14 : 34) * u, transform: `rotateY(${ry.toFixed(3)}deg)`, transformOrigin: "0% 50%" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: Math.max(6, 8 * u), height: `${(courbe("glisse")(borne((t - entree) / 2.2)) * 100).toFixed(2)}%`, borderRadius: 8 * u, background: `linear-gradient(180deg, ${COULEURS.creme}, ${COULEURS.orangeVif} 30%, ${COULEURS.orangeProfond})`, boxShadow: `0 0 ${26 * u}px ${COULEURS.orangeVif}` }} />
          {d.lieu && (
            <div style={{ display: "flex", alignItems: "center", gap: 18 * u }}>
              <div style={{ position: "relative", flex: "none", width: tailleRep, height: tailleRep, opacity: borne((t - tRep) / 0.08), transform: `translateY(${(-(1 - kRep) * 260 * u).toFixed(2)}px) scale(${(1 + 0.25 * rebondRep).toFixed(3)}, ${(1 - 0.25 * rebondRep).toFixed(3)})`, transformOrigin: "50% 100%" }}>
                {onde > 0 && onde < 1 && <div style={{ position: "absolute", left: tailleRep / 2 - 60 * u, top: tailleRep - 18 * u, width: 120 * u, height: 36 * u, borderRadius: "50%", border: `${(4 * (1 - onde) * u).toFixed(2)}px solid ${COULEURS.orangeVif}`, transform: `scale(${(0.3 + 1.6 * courbe("signature")(onde)).toFixed(3)})`, opacity: 1 - onde }} />}
                <Repere taille={tailleRep} debut={tRep - 0.05} t={t} couleur={COULEURS.orangeVif} epaisseur={2.6} />
              </div>
              <LieuFrappe texte={d.lieu} debut={h.tLieu} taille={tTitre} />
            </div>
          )}
          {d.date && (
            <div style={{ display: "flex", alignItems: "center", gap: 20 * u }}>
              <div style={{ width: 60 * u * courbe("glisse")(borne((t - h.tDate + 0.1) / 0.4)), height: Math.max(4, 5 * u), background: COULEURS.orangeVif, boxShadow: `0 0 ${12 * u}px ${COULEURS.orangeVif}` }} />
              <MotsGeants texte={d.date.toUpperCase()} debut={h.tDate} taille={tSecond} graisse={700} effet="etire" couleur={COULEURS.cremeAttenuee} decalage={0.06} approche={0.08} />
            </div>
          )}
          {d.chiffre && (
            <div style={{ position: "relative", marginTop: 18 * u, opacity: borne((t - h.tChiffre) / 0.1) }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 18 * u, flexWrap: "wrap", transform: `scale(${(1 + 0.28 * r).toFixed(4)}, ${(1 - 0.28 * r).toFixed(4)})`, transformOrigin: "0% 80%" }}>
                <FlouFort dy={t < tImpact ? Math.min(30, Math.abs(v - valeurCompteur(t - 1 / 50, h.tChiffre, 0, d.chiffre.valeur, 0.75)) * 40) * u : 0} style={{ display: "inline-block" }}>
                  <span style={{ fontSize: grand, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.045em", fontVariantNumeric: "tabular-nums", color: COULEURS.creme, textShadow: `0 ${10 * u}px ${44 * u}px ${avecOpacite(COULEURS.fondProfond, 0.85)}` }}>{texteValeur(v, undefined, d.chiffre.decimales)}</span>
                </FlouFort>
                {d.chiffre.unite && (
                  <span style={{ fontSize: tTitre * 0.85, fontWeight: 900, opacity: borne((t - tImpact) / 0.12) }}>
                    <MotCle mot={d.chiffre.unite} t={t} arrivee={tImpact + 0.05} balayage={tImpact + 0.6} u={u} />
                  </span>
                )}
              </div>
              <Eclats x={grand * 0.9} y={grand * 0.5} debut={tImpact} rayon={grand * 1.4} nombre={26} graine={53} />
              <div style={{ marginTop: 14 * u }}>
                <MotsGeants texte={d.chiffre.libelle} debut={tImpact + 0.15} taille={tSecond} graisse={700} effet="etire" couleur={COULEURS.creme} largeurMax={zone.largeur - 60 * u} decalage={0.05} interligne={1.15} approche={-0.01} />
              </div>
            </div>
          )}
          {contexte && (
            <MotsGeants texte={contexte} debut={d.chiffre ? tImpact + 0.4 : h.tContexte} taille={taille("legende")} graisse={600} effet="etire" couleur={COULEURS.cremeAttenuee} largeurMax={zone.largeur - 60 * u} decalage={0.04} approche={0} />
          )}
        </div>
      </div>
    </>
  );
}

export function DocumentaireSpectaculaire(p: MiseEnPageCarte & { donnees: DonneesDocumentaire }) {
  return (
    <SceneSpectaculaire mp={p}>
      <Contenu d={p.donnees} />
    </SceneSpectaculaire>
  );
}
