/**
 * CALQUES IMAGE de la brique commune « composition » (née au lot M4 ; plan B.7, calques 1 à 5, AVANT la LUT) :
 *   1 décor (image neutre Axion ou photo floutée, ou teinte) · 2 double (piste CONTINUE : jamais relancée à une coupe)
 *   · 3 accessoire (posé dans le cadre source, avant le recadrage) · 4 recadrage (coupes franches, poitrine sur les
 *   mots forts, zoom lent) · 5 illustration plein écran.
 * La géométrie vient de `src/briques/composition/scene.ts` (pure, testée) ; ce fichier ne fait que la dessiner. Aucun
 * format n'est connu ici : la recette du format arrive dans les propriétés (`reductionLarge`…).
 */
import type { CSSProperties } from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { boiteAccessoire, entreeEcranPartage, geometrieEcranPartage, margeFlou, planAuTemps, SOURCE_DOUBLE, transformation, type ProprietesImageComposition, type SourceDouble } from "../../../src/briques/composition/scene";
import { ContenuAccessoire } from "./Accessoire";
import { Silhouette } from "./Silhouette";

function Double({ source, t, contour, echelle }: { source: SourceDouble; t: number; contour?: ProprietesImageComposition["contour"]; echelle: number }) {
  // Liseré de lumière de contour, 1-2 px, du côté opposé à la lumière principale (B.3).
  const filtre = contour ? `drop-shadow(${(contour.cote === "droite" ? 2 : -2) * echelle}px 0 0 ${contour.couleur})` : undefined;
  const style = { width: "100%", height: "100%", objectFit: "contain" as const, filter: filtre };
  if (source.type === "video") return <OffthreadVideo src={source.url} transparent={source.transparent} muted style={style} />;
  // Lot R7d : second angle rendu par passages, chacun posé à son moment (repli navigateur).
  if (source.type === "tranches") return <Tranches source={source} style={style} />;
  if (source.type === "image") return <Img src={source.url} style={style} />;
  return (
    <AbsoluteFill style={{ filter: filtre }}>
      <Silhouette tenue={source.tenue} peau={source.peau} t={t} />
    </AbsoluteFill>
  );
}

function Tranches({ source, style }: { source: Extract<SourceDouble, { type: "tranches" }>; style: CSSProperties }) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {source.morceaux.map((m) => (
        <Sequence key={m.url} from={Math.round(m.debutSec * fps)} durationInFrames={Math.max(1, Math.round((m.finSec - m.debutSec) * fps))} layout="none">
          <OffthreadVideo src={m.url} transparent={source.transparent} muted style={style} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Accessoire posé dans le cadre source (boîte `boiteAccessoire`, en % de la boîte du double), pied prolongé sous le cadre. */
function AccessoireDansLeCadre({ p, echelleBoite, k }: { p: ProprietesImageComposition; echelleBoite: number; k: number }) {
  const a = p.accessoire!;
  const b = boiteAccessoire(a);
  const prolongement = margeFlou(a.flouPx);
  return (
    <div
      style={{
        position: "absolute",
        left: `${(b.gauche / SOURCE_DOUBLE.largeur) * 100}%`,
        top: `${(b.haut / SOURCE_DOUBLE.hauteur) * 100}%`,
        width: `${(b.largeur / SOURCE_DOUBLE.largeur) * 100}%`,
        height: (b.hauteur + prolongement) * echelleBoite,
      }}
    >
      <ContenuAccessoire accessoire={a} flouPx={a.flouPx * k} lumiere={p.contour?.couleur} prolongementBasPx={prolongement} />
    </div>
  );
}

export function ImageComposee(p: ProprietesImageComposition) {
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = image / fps;
  const plan = planAuTemps(p.plans, t);
  const planDouble = plan && plan.type === "double" ? plan : (p.plans.find((x) => x.type === "double") ?? null);
  const tr = planDouble ? transformation(p.ratio, planDouble, t, p.reductionLarge, !!p.sourcePreCadree) : { conteneur: { echelle: 1, x: 0, y: 0 }, double: { gauche: 0, haut: 0, largeur: p.largeur, hauteur: p.hauteur } };
  const k = p.largeur / 1080;
  // Mission H : un morceau qui porte `camera` montre l'angle fabriqué (s'il existe) ; sinon la piste d'avant.
  const camera = planDouble?.camera && p.cameras?.[planDouble.camera] ? planDouble.camera : undefined;
  const second = !camera && planDouble?.angle === "second" && p.doubles.second;
  const boite = tr.double;
  const decor = p.decor;
  const decorImage = decor.image ? (
    <Img src={decor.image} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: decor.flouPx > 0 ? `blur(${decor.flouPx * k}px)` : undefined, transform: decor.flouPx > 0 ? "scale(1.04)" : undefined }} />
  ) : null;
  // Facecam lot C : écran partagé par passages (carte en haut, la personne glisse en bas). Absent : rien ne change.
  const ep = plan?.type === "double" ? plan.ecranPartage : undefined;
  const geo = ep ? geometrieEcranPartage(ep, entreeEcranPartage(image - Math.round(plan!.debutSec * fps), ep.entreeImages)) : null;
  const scene = (
    <AbsoluteFill style={{ backgroundColor: decor.teinte, overflow: "hidden" }}>
      {/* 4:5 et 1:1 : le décor reste fixe et s'étend sur les côtés ; seul le double change de taille. */}
      {p.ratio !== "9:16" && decorImage}
      <div style={{ position: "absolute", left: 0, top: 0, width: p.largeur, height: p.hauteur, transformOrigin: "0 0", transform: `translate(${tr.conteneur.x}px, ${tr.conteneur.y}px) scale(${tr.conteneur.echelle})` }}>
        {p.ratio === "9:16" && decorImage}
        <div style={{ position: "absolute", left: boite.gauche, top: boite.haut, width: boite.largeur, height: boite.hauteur }}>
          {/* Les deux angles restent montés (pistes continues) ; un seul est visible. */}
          <AbsoluteFill style={{ opacity: second || camera ? 0 : 1 }}>
            <Double source={p.doubles.principal} t={t} contour={p.contour} echelle={k} />
          </AbsoluteFill>
          {p.doubles.second && (
            <AbsoluteFill style={{ opacity: second ? 1 : 0 }}>
              <Double source={p.doubles.second} t={t} contour={p.contour} echelle={k} />
            </AbsoluteFill>
          )}
          {(["cote", "contre-plongee"] as const).map((a) =>
            p.cameras?.[a] ? (
              <AbsoluteFill key={a} style={{ opacity: camera === a ? 1 : 0 }}>
                <Double source={p.cameras[a]!} t={t} contour={p.contour} echelle={k} />
              </AbsoluteFill>
            ) : null,
          )}
          {p.accessoire && <AccessoireDansLeCadre p={p} echelleBoite={boite.largeur / SOURCE_DOUBLE.largeur} k={k} />}
        </div>
      </div>
      {/* 5. Illustrations plein écran : chacune démarre au début de son plan (coupe franche, aucune transition). */}
      {p.plans.map((pl, i) =>
        pl.type === "illustration" && pl.illustration ? (
          <Sequence key={i} from={Math.round(pl.debutSec * fps)} durationInFrames={Math.max(1, Math.round((pl.finSec - pl.debutSec) * fps))} layout="none">
            <AbsoluteFill style={{ backgroundColor: "#000" }}>
              {pl.illustration.video ? (
                <OffthreadVideo src={pl.illustration.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Img src={pl.illustration.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </AbsoluteFill>
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
  if (!ep || !geo) return scene;
  // Facecam F1 (ajout pur) : côte à côte (16:9), carte à gauche, la personne glisse vers la droite.
  if (ep.cote === "gauche" && ep.largeurCarte && geo.gaucheCarte !== undefined)
    return (
      <AbsoluteFill style={{ backgroundColor: "#16120F", overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: `translateX(${(geo.decalagePersonneX ?? 0).toFixed(2)}px)` }}>{scene}</AbsoluteFill>
        <div style={{ position: "absolute", left: geo.gaucheCarte, top: 0, width: ep.largeurCarte, height: p.hauteur }}>
          <Sequence from={Math.round(plan!.debutSec * fps)} layout="none">
            <OffthreadVideo src={ep.carte} muted startFrom={Math.round(ep.carteDebutSec * fps)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </Sequence>
        </div>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ backgroundColor: "#16120F", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateY(${geo.decalagePersonne.toFixed(2)}px)` }}>{scene}</AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: geo.hautCarte, width: p.largeur, height: ep.hauteurHaut }}>
        <Sequence from={Math.round(plan!.debutSec * fps)} layout="none">
          <OffthreadVideo src={ep.carte} muted startFrom={Math.round(ep.carteDebutSec * fps)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
      </div>
    </AbsoluteFill>
  );
}
