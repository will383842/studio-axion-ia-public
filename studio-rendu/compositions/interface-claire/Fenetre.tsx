/**
 * Fenêtre d'illustration : ENTRE par la droite, inclinée, se redresse avec un léger rebond ; SORT par la gauche.
 * Une photo reste FIXE et une MINI-VIDÉO joue (muette, depuis `depuisSec`, en boucle si elle est plus courte que la
 * fenêtre) : AUCUN ZOOM dans la fenêtre (décision de Will du 15/10 : « il faut supprimer le zoom car ça bouge trop » ;
 * l'ancien zoom lent de 1 à 1,05 sur les photos est retiré). Une GRANDE étiquette peut se poser dessus.
 */
import React, { useEffect, useState } from "react";
import { continueRender, delayRender, Img, Loop, OffthreadVideo, Sequence, useVideoConfig } from "remotion";
import { animationFenetre, largeurEtiquetteFenetre, tailleEtiquetteFenetre } from "./cadrage";
import type { Rect } from "./cadrage";
import { COULEURS, GEOMETRIE, POLICES, TEMPS } from "./charte";
import { styleBoite } from "./elements";
import { progression, rebond } from "./mouvement";

export type FenetreProps = {
  t: number;
  debut: number;
  fin: number;
  src: string;
  largeurImage: number;
  hauteurImage: number;
  etiquette?: { texte: string; a: number };
  /** Passage en noir et blanc (le « passé », « il y a quelques années… ») : l'image perd ses couleurs en 0,25 s. */
  noirEtBlancA?: number;
  /** Une MINI-VIDÉO qui joue dans la fenêtre (au lieu d'une photo), depuis `depuisSec` de la source. */
  video?: { depuisSec?: number };
  /** Capture d'écran (barre de navigateur en haut, l'image défile lentement vers le haut). */
  capture?: boolean;
  /** Manière d'entrer (variété d'une vidéo à l'autre, même marque). Par défaut « droite ». */
  entree?: "droite" | "bas" | "zoom";
  /**
   * Emprise posée (fractions de l'image), calculée par la mise en page (`cadrage.ts`) : « sur-le-visage » (couvre TOUT le
   * visage) ou « au-dessus » (paysage en haut, la prise descend dessous). Absente : sur le côté (galerie, planche).
   */
  rect?: Rect;
};

/** Mini-vidéo muette, cadrée en « cover », qui BOUCLE si la source est plus courte que la fenêtre (jamais d'image noire). */
function MiniVideo({ src, depuisSec, debut, filtre }: { src: string; depuisSec: number; debut: number; filtre?: string }) {
  const { fps } = useVideoConfig();
  const [duree, setDuree] = useState<number | null>(null);
  const [attente] = useState(() => delayRender(`Durée de la mini-vidéo ${src}`));
  useEffect(() => {
    if (typeof document === "undefined") {
      setDuree(Number.POSITIVE_INFINITY);
      continueRender(attente);
      return;
    }
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    let fait = false;
    const fini = (d: number) => {
      if (fait) return;
      fait = true;
      clearTimeout(minuteur);
      setDuree(d);
      continueRender(attente);
    };
    // Filet : le rendu du SON seul (codec wav) ne charge parfois jamais les métadonnées (délai de 28 s dépassé, rendu
    // interrompu) ; au bout de 5 s on continue sans boucle (les fenêtres durent au plus 3 s, les sources 3 s et plus).
    const minuteur = setTimeout(() => fini(Number.POSITIVE_INFINITY), 5000);
    v.onloadedmetadata = () => fini(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : Number.POSITIVE_INFINITY);
    v.onerror = () => fini(Number.POSITIVE_INFINITY);
    v.src = src;
  }, [src, attente]);
  if (duree === null) return null;
  const debutSource = Math.round(depuisSec * fps);
  // Dernière image sûre : une image avant la fin de la source (au-delà, l'extracteur peut rendre du noir).
  const boucle = Number.isFinite(duree) ? Math.max(1, Math.floor((duree - depuisSec) * fps) - 1) : 0;
  const lecteur = <OffthreadVideo src={src} muted startFrom={debutSource} style={{ width: "100%", height: "100%", objectFit: "cover", filter: filtre }} />;
  return (
    <Sequence from={Math.round(debut * fps)} layout="none">
      {boucle > 0 ? (
        <Loop durationInFrames={boucle} layout="none">
          {lecteur}
        </Loop>
      ) : (
        lecteur
      )}
    </Sequence>
  );
}

export function Fenetre(p: FenetreProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const l = p.rect ? (p.rect.x1 - p.rect.x0) * W : GEOMETRIE.fenetreL * W;
  const h = p.rect ? (p.rect.y1 - p.rect.y0) * H : l * 1.25;
  const x = p.rect ? p.rect.x0 * W : W * 0.35;
  const y = p.rect ? p.rect.y0 * H : H * 0.08;
  const a = animationFenetre(p.t, p.debut, p.fin, p.entree ?? "droite");
  const nb = p.noirEtBlancA !== undefined ? progression(p.t, p.noirEtBlancA, 0.25) : 0;
  const filtre = nb > 0 ? `grayscale(${nb}) contrast(${1 + 0.15 * nb})` : undefined;
  const ee = p.etiquette ? rebond(p.t, p.etiquette.a, TEMPS.pop, 1.8) : 0;
  // Étiquette GRANDE (≈ 0,70-0,78 de la largeur de la fenêtre), centrée dans la moitié haute, inclinée de −3°.
  const taille = p.etiquette ? tailleEtiquetteFenetre(p.etiquette.texte, l, W) : 0;
  const largeurEtiquette = p.etiquette ? largeurEtiquetteFenetre(p.etiquette.texte, taille, W) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `translate(${a.dx * W}px, ${a.dy * H}px) rotate(${a.rotation}deg) scale(${a.echelle})`, ...styleBoite(W, COULEURS.encre), overflow: "hidden" }}>
      {p.capture ? (
        <div style={{ height: h * 0.07, background: COULEURS.ivoire, borderBottom: `3px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", gap: h * 0.015, padding: `0 ${h * 0.025}px` }}>
          {[COULEURS.orange, COULEURS.sable, COULEURS.sable].map((c, i) => (
            <div key={i} style={{ width: h * 0.022, height: h * 0.022, borderRadius: "50%", background: c, border: `2px solid ${COULEURS.encre}` }} />
          ))}
          <div style={{ flex: 1, height: h * 0.03, marginLeft: h * 0.02, borderRadius: h * 0.015, background: `${COULEURS.sable}66` }} />
        </div>
      ) : null}
      {p.video ? (
        <MiniVideo src={p.src} depuisSec={p.video.depuisSec ?? 0} debut={p.debut} filtre={filtre} />
      ) : (
        <Img
          src={p.src}
          style={{
            width: "100%",
            height: p.capture ? "135%" : "100%",
            objectFit: "cover",
            // Capture : la page défile lentement vers le haut ; photo : FIXE (aucun zoom, Will 15/10).
            transform: p.capture ? `translateY(${-progression(p.t, p.debut + 0.3, p.fin - p.debut) * h * 0.25}px)` : undefined,
            filter: filtre,
          }}
        />
      )}
      {p.etiquette && p.t >= p.etiquette.a ? (
        <div
          style={{
            position: "absolute",
            left: (l - largeurEtiquette) / 2,
            top: h * 0.25,
            width: largeurEtiquette,
            transform: `translateY(-50%) rotate(-3deg) scale(${0.2 + 0.8 * ee})`,
            ...styleBoite(W, COULEURS.orange, Math.round(taille * 0.3)),
            padding: `${taille * 0.18}px 0`,
            textAlign: "center",
            fontFamily: POLICES.titre,
            fontSize: taille,
            lineHeight: 1.05,
            color: COULEURS.ivoire,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {p.etiquette.texte}
        </div>
      ) : null}
    </div>
  );
}
