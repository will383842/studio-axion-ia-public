/**
 * Modèle 11 — CAPTURE ANNOTÉE (lot F2) : la capture (Mes images ou B-roll) arrive dans un cadre en relief ; à chaque
 * annotation dite, la caméra glisse et zoome vers elle, un projecteur assombrit le reste, puis le cercle se trace à la
 * main, la flèche file vers sa cible, le surligneur balaie la ligne ou le cadre se dessine ; l'étiquette rebondit à
 * côté, toujours à taille lisible (jamais agrandie ni réduite par le zoom).
 */
import { useId } from "react";
import { mixer } from "../../../../src/briques/motion/courbes";
import { largeurMotMotion } from "../../../../src/briques/motion/mesure";
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import type { AnnotationCapture, DonneesCaptureAnnotee } from "../../../../src/briques/motion/types-etendus";
import { avecOpacite, CarteMotion, COULEURS, DUREES, echelleRessort, progres, TexteCinetique, useMotion, type Zone } from "./noyau";
import { ImageCapture, tailleTitreAjustee } from "./outils-etendus";
import { CaptureAnnoteeSpectaculaire } from "./spectaculaire/CaptureAnnoteeSpectaculaire";

/* ------------------------------------------------------------------ */
/* Géométrie commune aux deux styles                                     */
/* ------------------------------------------------------------------ */

/** Cadre de l'image : la capture entière, proportions gardées, centrée dans la place qui reste sous le titre. */
export function cadreCapture(d: DonneesCaptureAnnotee, place: Zone): Zone {
  const ratio = d.image.largeur && d.image.hauteur ? d.image.largeur / d.image.hauteur : 16 / 10;
  let largeur = place.largeur;
  let hauteur = largeur / ratio;
  if (hauteur > place.hauteur) {
    hauteur = place.hauteur;
    largeur = hauteur * ratio;
  }
  return { x: place.x + (place.largeur - largeur) / 2, y: place.y + (place.hauteur - hauteur) / 2, largeur, hauteur };
}

/** Instants des annotations : ceux de l'aligneur, sinon réparties ; croissants, 0,5 s d'écart au moins. */
export function heuresAnnotations(d: DonneesCaptureAnnotee, debut: number, fin: number): number[] {
  const n = d.annotations.length;
  let dernier = debut - 0.5;
  return d.annotations.map((a, i) => {
    dernier = Math.max(dernier + 0.5, a.aSec ?? debut + ((fin - debut) * i) / Math.max(1, n - 1));
    return dernier;
  });
}

/** La caméra part vers l'annotation un peu avant qu'elle soit dite (s). */
export const AVANCE_ZOOM = 0.25;

/**
 * Visibilité (0-1) de l'étiquette i : elle rebondit juste après le mot, reste posée (elle suit son annotation pendant
 * que la caméra se déplace) et s'efface quand l'annotation suivante est dite.
 */
export function visibiliteEtiquette(t: number, i: number, heures: number[]): number {
  const apparait = progres(t, heures[i] + 0.15, 0.12);
  const part = i < heures.length - 1 ? progres(t, heures[i + 1] + 0.05, 0.12) : 0;
  return apparait * (1 - part);
}

/** État de la caméra dans le cadre (échelle et centre visé, en px du cadre) à l'instant t. */
export function etatZoom(t: number, d: DonneesCaptureAnnotee, heures: number[], W: number, H: number, zoomMax: number, duree = 0.75) {
  const repos = { s: 1, cx: W / 2, cy: H / 2 };
  const vise = (a: AnnotationCapture) => {
    if (d.zoom === false) return repos;
    const s = Math.max(1, Math.min(zoomMax, 0.62 / Math.max(a.largeur, 0.05), 0.5 / Math.max(a.hauteur, 0.05)));
    return { s, cx: (a.x + a.largeur / 2) * W, cy: (a.y + a.hauteur / 2) * H };
  };
  let courant = repos;
  for (let i = 0; i < heures.length; i++) {
    if (t < heures[i] - AVANCE_ZOOM) break;
    const cible = vise(d.annotations[i]);
    const k = progres(t, heures[i] - AVANCE_ZOOM, duree, "glisse");
    courant = { s: mixer(courant.s, cible.s, k), cx: mixer(courant.cx, cible.cx, k), cy: mixer(courant.cy, cible.cy, k) };
  }
  // Translation bornée : les bords de la capture ne rentrent jamais dans le cadre.
  const tx = Math.min(0, Math.max(W - W * courant.s, W / 2 - courant.cx * courant.s));
  const ty = Math.min(0, Math.max(H - H * courant.s, H / 2 - courant.cy * courant.s));
  return { s: courant.s, tx, ty };
}

/** Boîte (px du cadre) d'une annotation sous le zoom courant. */
export function boiteVue(a: AnnotationCapture, W: number, H: number, z: { s: number; tx: number; ty: number }) {
  return { x: a.x * W * z.s + z.tx, y: a.y * H * z.s + z.ty, largeur: a.largeur * W * z.s, hauteur: a.hauteur * H * z.s };
}

/** Cercle tracé à la main : un peu plus large que la cible, qui dépasse son point de départ (≈ 380°). */
export function pointCercle(x: number, y: number, l: number, h: number, graine: number, k: number): { x: number; y: number } {
  const rx = (l / 2) * 1.12 + 6;
  const ry = (h / 2) * 1.22 + 6;
  const a = ((-110 + k * 385) * Math.PI) / 180;
  const f = 1 + 0.035 * Math.sin(k * 64 * 0.45 + graine) + k * 0.05;
  return { x: x + l / 2 + Math.cos(a) * rx * f, y: y + h / 2 + Math.sin(a) * ry * f };
}

export function cheminCercle(x: number, y: number, l: number, h: number, graine = 0): string {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const p = pointCercle(x, y, l, h, graine, i / 64);
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}

/** Flèche courbe vers la cible : elle vient d'en dessous (ou d'au-dessus si la cible est basse), et s'arrête au bord. */
export function cheminFleche(x: number, y: number, l: number, h: number, W: number, H: number) {
  const cx = x + l / 2;
  const basse = y + h / 2 > H * 0.6;
  const fin = { x: cx + l * 0.18, y: basse ? y - 10 : y + h + 10 };
  const debut = { x: Math.min(W - 30, Math.max(30, fin.x + W * 0.22)), y: basse ? Math.max(20, y - H * 0.22) : Math.min(H - 20, y + h + H * 0.22) };
  const controle = { x: debut.x + (fin.x - debut.x) * 0.1, y: fin.y + (debut.y - fin.y) * 0.15 };
  const angle = Math.atan2(fin.y - controle.y, fin.x - controle.x);
  return { d: `M ${debut.x.toFixed(1)} ${debut.y.toFixed(1)} Q ${controle.x.toFixed(1)} ${controle.y.toFixed(1)} ${fin.x.toFixed(1)} ${fin.y.toFixed(1)}`, fin, angle, debut };
}

/** Position de l'étiquette (px du cadre) : au-dessus de la boîte, sinon dessous ; jamais hors du cadre. */
export function positionEtiquette(b: { x: number; y: number; largeur: number; hauteur: number }, largeurEtiquette: number, hauteurEtiquette: number, W: number, H: number) {
  const dessus = b.y - hauteurEtiquette - 18 >= 0;
  const y = dessus ? b.y - hauteurEtiquette - 18 : Math.min(H - hauteurEtiquette - 8, b.y + b.hauteur + 18);
  const x = Math.min(W - largeurEtiquette - 12, Math.max(12, b.x + b.largeur / 2 - largeurEtiquette / 2));
  return { x, y };
}

/* ------------------------------------------------------------------ */
/* Style Sobre                                                           */
/* ------------------------------------------------------------------ */

function Annotation({ a, i, h, W, H, s, actif }: { a: AnnotationCapture; i: number; h: number; W: number; H: number; s: number; actif: number }) {
  const { t, u } = useMotion();
  const x = a.x * W;
  const y = a.y * H;
  const l = a.largeur * W;
  const ht = a.hauteur * H;
  const ep = (Math.max(5, 7 * u) / s).toFixed(2);
  const k = progres(t, h, a.type === "surligne" ? 0.45 : 0.6, "glisse");
  const lueur = { filter: `drop-shadow(0 0 ${(8 * u) / s}px ${avecOpacite(COULEURS.orangeVif, 0.7)})` };
  const opacite = 0.55 + 0.45 * actif;
  if (k <= 0) return null;
  switch (a.type) {
    case "cercle":
      return <path d={cheminCercle(x, y, l, ht, i)} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k).toFixed(4)} opacity={opacite} style={lueur} />;
    case "cadre":
      return <rect x={x - 8} y={y - 8} width={l + 16} height={ht + 16} rx={18 / s} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k).toFixed(4)} opacity={opacite} style={lueur} />;
    case "surligne":
      return (
        <g opacity={opacite}>
          <rect x={x} y={y} width={l * k} height={ht} rx={10 / s} fill={COULEURS.orangeVif} opacity={0.3} style={{ mixBlendMode: "multiply" }} />
          <rect x={x} y={y + ht - (6 * u) / s} width={l * k} height={(6 * u) / s} rx={3 / s} fill={COULEURS.orangeVif} />
        </g>
      );
    case "fleche": {
      const f = cheminFleche(x, y, l, ht, W, H);
      const pointe = progres(t, h + 0.45, 0.2);
      const taillePointe = (30 * u) / s;
      return (
        <g opacity={opacite} style={lueur}>
          <path d={f.d} fill="none" stroke={COULEURS.orangeVif} strokeWidth={ep} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k).toFixed(4)} />
          {pointe > 0 && (
            <path
              d={`M ${-taillePointe} ${-taillePointe * 0.7} L 0 0 L ${-taillePointe} ${taillePointe * 0.7}`}
              fill="none"
              stroke={COULEURS.orangeVif}
              strokeWidth={ep}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(${f.fin.x.toFixed(1)} ${f.fin.y.toFixed(1)}) rotate(${((f.angle * 180) / Math.PI).toFixed(2)}) scale(${pointe.toFixed(3)})`}
            />
          )}
        </g>
      );
    }
  }
}

function Contenu({ d }: { d: DonneesCaptureAnnotee }) {
  const { t, u, zoneCentree: zc, taille, chute, duree, mesurer, moitie } = useMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Le titre se resserre (moitié haute) pour laisser la place à la capture.
  const tTitre = d.titre ? tailleTitreAjustee([taille("titre"), taille("corps"), taille("legende")], (ta) => mesurer(d.titre!, "titre", zc.largeur, 800, ta), zc.hauteur * (moitie ? 0.14 : 0.25)) : 0;
  const hTitre = d.titre ? mesurer(d.titre, "titre", zc.largeur, 800, tTitre) + 44 * u : 0;
  const cadre = cadreCapture(d, { x: zc.x, y: zc.y + hTitre, largeur: zc.largeur, hauteur: zc.hauteur - hTitre });
  const W = cadre.largeur;
  const H = cadre.hauteur;
  const heures = heuresAnnotations(d, d.titre ? 1.0 : 0.7, duree - 1.7);
  const z = etatZoom(t, d, heures, W, H, 1.8);
  const actif = heures.reduce((a, h, i) => (t >= h - AVANCE_ZOOM ? i : a), -1);
  const entree = echelleRessort(t, 0.25, chute);
  const kEntree = progres(t, 0.25, 0.7, "signature");
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const rayon = 26 * u;
  const tLeg = taille("legende");
  const projecteur = actif >= 0 ? progres(t, heures[actif] - 0.2, 0.4) * 0.42 : 0;
  const boite = actif >= 0 ? boiteVue(d.annotations[actif], W, H, z) : null;
  return (
    <>
      {d.titre && (
        <div style={{ position: "absolute", left: zc.x, width: zc.largeur, top: zc.y }}>
          <TexteCinetique texte={d.titre} niveau="titre" taillePx={tTitre} debut={0.1} alignement="center" largeurMax={zc.largeur} />
        </div>
      )}
      <div style={{ position: "absolute", left: cadre.x, top: cadre.y, width: W, height: H, perspective: `${(2000 * u).toFixed(0)}px`, opacity: Math.min(1, entree * 1.5) * (1 - s) }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: rayon, overflow: "hidden", transform: `rotateX(${(10 * (1 - kEntree)).toFixed(3)}deg) translateY(${((1 - kEntree) * 90 * u - s * 50 * u).toFixed(2)}px) scale(${(0.92 + 0.08 * Math.min(1, entree)).toFixed(4)})`, boxShadow: `0 ${30 * u}px ${80 * u}px ${avecOpacite(COULEURS.fondProfond, 0.8)}, 0 0 0 ${2 * u}px ${COULEURS.filet}`, background: COULEURS.surface }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${z.tx.toFixed(2)}px, ${z.ty.toFixed(2)}px) scale(${z.s.toFixed(5)})` }}>
            <ImageCapture src={d.image.src} />
            <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
              {d.annotations.map((a, i) => (
                <Annotation key={i} a={a} i={i} h={heures[i]} W={W} H={H} s={z.s} actif={i === actif ? 1 : 0} />
              ))}
            </svg>
          </div>
          {/* Projecteur : le reste de la capture s'assombrit autour de l'annotation dite. */}
          {boite && projecteur > 0 && (
            <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
              <defs>
                <mask id={`trou${id}`}>
                  <rect x={0} y={0} width={W} height={H} fill="white" />
                  <rect x={boite.x - 24 * u} y={boite.y - 24 * u} width={boite.largeur + 48 * u} height={boite.hauteur + 48 * u} rx={28 * u} fill="black" style={{ filter: `blur(${14 * u}px)` }} />
                </mask>
              </defs>
              <rect x={0} y={0} width={W} height={H} fill={COULEURS.fondProfond} opacity={projecteur} mask={`url(#trou${id})`} />
            </svg>
          )}
          {/* Étiquettes : hors du zoom, toujours à taille lisible. */}
          {d.annotations.map((a, i) => {
            const vis = visibiliteEtiquette(t, i, heures);
            if (!a.texte || vis <= 0) return null;
            const b = boiteVue(a, W, H, z);
            const largeurEtiquette = Math.min(W - 24, largeurMotMotion(a.texte, tLeg, 800) + 56 * u);
            const hauteurEtiquette = tLeg * 1.6;
            const p = positionEtiquette(b, largeurEtiquette, hauteurEtiquette, W, H);
            const e = echelleRessort(t, heures[i] + 0.15, chute + 9);
            return (
              <div key={i} style={{ position: "absolute", left: p.x, top: p.y, height: hauteurEtiquette, padding: `0 ${28 * u}px`, display: "flex", alignItems: "center", borderRadius: 999, whiteSpace: "nowrap", background: `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orange})`, boxShadow: `0 ${10 * u}px ${30 * u}px ${avecOpacite(COULEURS.fondProfond, 0.55)}, 0 0 ${30 * u}px ${avecOpacite(COULEURS.orangeVif, 0.5)}`, transform: `scale(${e.toFixed(4)})`, transformOrigin: "50% 100%", opacity: vis, fontSize: tLeg, fontWeight: 800, color: COULEURS.creme }}>
                {a.texte}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function MotionCaptureAnnotee(p: MiseEnPageCarte & { donnees: DonneesCaptureAnnotee }) {
  if (p.style === "spectaculaire") return <CaptureAnnoteeSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p} intensiteLumiere={0.85}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
