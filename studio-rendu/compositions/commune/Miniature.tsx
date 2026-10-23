/**
 * MINIATURE (lot R4, 03/10) — une image fixe : la plus belle image de la vidéo, le titre de couverture posé dans la
 * zone sûre, aux couleurs d'Axion. Trois mises en page (« bas », « étiquettes », « bandeau »), sous le visage ; la géométrie est PURE
 * (`miniature-mise-en-page.ts`, testée), ce fichier ne fait que la dessiner.
 * Police : Montserrat Black (SIL OFL 1.1), chargée EN LOCAL, mesurée par le navigateur une fois chargée : le titre
 * est coupé et dimensionné sur sa vraie largeur, il ne déborde jamais.
 */
import { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, Img } from "remotion";
import montserratBlack from "../../../src/briques/sous-titres/polices/Montserrat-Black.ttf";
import {
  COULEURS_MINIATURE as C,
  contraintesTitre,
  estMotCle,
  formatMiniature,
  hauteurBlocTitre,
  mettreEnPageTitre,
  placementTitre,
  TRAIT_BAS_PX,
  unitesCouverture,
  type MiseEnPageTitre,
  type ProprietesMiniature,
} from "./miniature-mise-en-page";

const FAMILLE = "Axion Miniature Montserrat Black";

/** Charge la police une fois, puis renvoie une mesure de largeur faite avec elle. */
let police: Promise<(texte: string, taille: number) => number> | null = null;
function mesureAvecPolice(): Promise<(texte: string, taille: number) => number> {
  if (!police) {
    police = new FontFace(FAMILLE, `url(${montserratBlack})`).load().then((face) => {
      document.fonts.add(face);
      const ctx = document.createElement("canvas").getContext("2d")!;
      return (texte: string, taille: number) => {
        ctx.font = `${taille}px "${FAMILLE}"`;
        return ctx.measureText(texte).width;
      };
    });
    police.catch(() => {
      police = null; // un échec ne reste pas en cache
    });
  }
  return police;
}

/**
 * Une ligne du titre. `surligne` (bandeau) : le mot mis en valeur est posé sur une pastille crème (ombre portée
 * étendue, sans changer la largeur mesurée : la mise en page reste exacte).
 */
function Ligne({ unites, motCle, couleurTexte, couleurMotCle, surligne }: { unites: string[]; motCle?: string; couleurTexte: string; couleurMotCle: string; surligne?: { fond: string; marge: number } }) {
  // Unités voisines de même nature regroupées : un mot mis en valeur de plusieurs unités (« 45 JOURS ») = UNE pastille.
  const groupes: { mis: boolean; texte: string }[] = [];
  for (const u of unites) {
    const mis = estMotCle(u, motCle);
    const dernier = groupes.at(-1);
    if (dernier && dernier.mis === mis) dernier.texte += ` ${u}`;
    else groupes.push({ mis, texte: u });
  }
  return (
    <>
      {groupes.map((g, i) => (
        <span key={i}>
          {i ? " " : ""}
          <span style={{ color: g.mis ? couleurMotCle : couleurTexte, ...(g.mis && surligne ? { background: surligne.fond, boxShadow: `0 0 0 ${surligne.marge}px ${surligne.fond}`, borderRadius: surligne.marge } : {}) }}>{g.texte}</span>
        </span>
      ))}
    </>
  );
}

export function Miniature(p: ProprietesMiniature) {
  const f = formatMiniature(p.ratio);
  const variante = p.variante;
  const horizontal = f.ratio === "16:9";
  const [attente] = useState(() => delayRender("Mise en page de la miniature"));
  const [mise, setMise] = useState<MiseEnPageTitre | null>(null);

  useEffect(() => {
    let vivant = true;
    mesureAvecPolice()
      .then((mesurer) => {
        if (vivant) setMise(mettreEnPageTitre(unitesCouverture(p.couverture), mesurer, contraintesTitre(f, variante)));
        continueRender(attente);
      })
      // Police illisible : le rendu échoue (jamais une miniature « titre écrit » sans son titre).
      .catch((e: unknown) => cancelRender(e instanceof Error ? e : new Error("Police de la miniature illisible")));
    return () => {
      vivant = false;
    };
    // Une image fixe : les propriétés ne changent pas pendant le rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = contraintesTitre(f, variante);
  const taille = mise?.taillePx ?? c.tailleMax;
  const nbLignes = mise?.lignes.length ?? 0;
  const hauteurBloc = hauteurBlocTitre(nbLignes, taille, c);
  const { haut } = placementTitre(f, variante, hauteurBloc);
  const k = f.largeur / 1080;
  const centre = !horizontal;
  const trait = <div style={{ width: 112 * k, height: 14 * k, borderRadius: 7 * k, background: C.orangeVif, boxShadow: `0 ${4 * k}px ${14 * k}px rgba(0,0,0,0.35)` }} />;

  // Voile de lisibilité : là où se pose le titre, jamais sur toute l'image (le visage reste clair).
  const voile = !nbLignes
    ? "none"
    : horizontal
      ? "linear-gradient(90deg, rgba(16,12,9,0.88) 0%, rgba(16,12,9,0.7) 36%, rgba(16,12,9,0.16) 62%, rgba(16,12,9,0) 74%)"
      : variante === "bas"
        ? "linear-gradient(0deg, rgba(16,12,9,0.94) 0%, rgba(16,12,9,0.82) 24%, rgba(16,12,9,0.4) 44%, rgba(16,12,9,0) 58%)"
        : "linear-gradient(0deg, rgba(16,12,9,0.45) 0%, rgba(16,12,9,0.15) 30%, rgba(16,12,9,0) 50%)";

  const ombre = `0 ${4 * k}px ${18 * k}px rgba(0,0,0,0.55), 0 ${1 * k}px ${3 * k}px rgba(0,0,0,0.5)`;
  const lignes = mise?.lignes ?? [];

  return (
    <AbsoluteFill style={{ background: C.fond }}>
      <Img src={p.image} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.06)" }} />
      {/* Vignette douce : l'œil va au centre, les bords ne crient pas. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 70% at 50% 42%, rgba(0,0,0,0) 58%, rgba(10,8,6,0.4) 100%)" }} />
      <AbsoluteFill style={{ background: voile }} />
      {variante === "bandeau" && nbLignes > 0 && (
        // Bande orange d'un bord à l'autre (en 16:9 : du bord gauche jusqu'après le titre).
        <div
          style={{
            position: "absolute",
            left: 0,
            width: horizontal ? f.zoneTitre.x + f.zoneTitre.largeur + 64 * k : f.largeur,
            top: haut,
            height: hauteurBloc,
            background: `linear-gradient(90deg, ${C.orange} 0%, #C65A2E 55%, ${C.orange} 100%)`,
            boxShadow: `0 ${12 * k}px ${36 * k}px rgba(0,0,0,0.4)`,
          }}
        />
      )}
      {nbLignes > 0 && (
        <div
          style={{
            position: "absolute",
            left: f.zoneTitre.x,
            width: f.zoneTitre.largeur,
            top: haut + (c.margeVerticale ?? 0) * taille,
            display: "flex",
            flexDirection: "column",
            alignItems: centre ? "center" : "flex-start",
            fontFamily: `"${FAMILLE}"`,
            fontSize: taille,
            lineHeight: variante === "etiquettes" ? 1.08 : c.interligne,
            textAlign: centre ? "center" : "left",
          }}
        >
          {lignes.map((l, i) =>
            variante === "etiquettes" ? (
              <div
                key={i}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 0.16 * taille,
                  padding: `${0.06 * taille}px ${c.margeLigne! / 2}px ${0.02 * taille}px`,
                  marginBottom: (c.interligne - 1.08) * taille,
                  whiteSpace: "nowrap",
                  boxShadow: `0 ${10 * k}px ${30 * k}px rgba(0,0,0,0.35)`,
                }}
              >
                <Ligne unites={l} motCle={p.motCle} couleurTexte={C.fond} couleurMotCle={C.orange} />
              </div>
            ) : variante === "bandeau" ? (
              <div key={i} style={{ whiteSpace: "nowrap" }}>
                <Ligne unites={l} motCle={p.motCle} couleurTexte={C.surOrange} couleurMotCle={C.fond} surligne={{ fond: C.creme, marge: 0.05 * taille }} />
              </div>
            ) : (
              <div key={i} style={{ whiteSpace: "nowrap", textShadow: ombre }}>
                <Ligne unites={l} motCle={p.motCle} couleurTexte={C.texte} couleurMotCle={C.orangeVif} />
              </div>
            ),
          )}
        </div>
      )}
      {variante === "bas" && nbLignes > 0 && (
        // Trait orange SOUS le titre, dans la place réservée (sur le dégradé sombre : il ne touche ni l'image ni le titre).
        <div style={{ position: "absolute", top: haut + hauteurBloc + (TRAIT_BAS_PX - 14) * k * 0.6, left: centre ? (f.largeur - 112 * k) / 2 : f.zoneTitre.x }}>{trait}</div>
      )}
    </AbsoluteFill>
  );
}
