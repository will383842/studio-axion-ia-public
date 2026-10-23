/**
 * RENDU DU STYLE « blocs/2 » (vidéo modèle « Formation ») : une scène du tableau animé, faite d'un ou deux ÉCRANS
 * (fond plein, très gros titres, mots forts en blocs, gabarit du corps), l'en-tête fixe (étiquette de section,
 * axion-ia.com), la barre des étapes, les sous-titres mot à mot dans leur pastille (si les mots dits sont donnés), le
 * crayon qui souligne, coche et barre, puis se range. Tout se calcule depuis le numéro d'image (aucun hasard).
 *
 * Les positions viennent de la mise en page (`src/briques/tableau-scene/v2/disposition.ts`), les instants du plan
 * d'animation (`animation.ts`) : ce composant ne décide de rien, il dessine.
 */
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { STYLE_ECRITURE_EXACTE } from "../../../../src/briques/stylo/mesure-ecriture";
import { REGLAGES_ANIMATION_V2, avancementSegments, partFilV2, planifierEcranV2, poseCrayonV2, type ApparitionV2, type PlanEcranV2 } from "../../../../src/briques/tableau-scene/v2/animation";
import { CONTOUR_SUR, COULEURS_V2, FIN_V2, POLICES_V2 } from "../../../../src/briques/tableau-scene/v2/charte";
import { groupesSousTitres, sousTitreA } from "../../../../src/briques/tableau-scene/v2/sous-titres";
import type { EcranPlace, FormeV2, GeometrieV2, TexteV2, TraitV2 } from "../../../../src/briques/tableau-scene/v2/types";
import { GRILLE_DESSIN, TRACES_DESSINS } from "../../../../src/briques/dessins/traces";
import { Stylo } from "../../commune/stylo/Stylo";
import type { ProprietesTableauScene, ProprietesV2 } from "../types";

const borne = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Rebond (sortie avec dépassement), comme la vidéo modèle. */
const rebond = (p: number, s = 1.7) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
const doux = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** Opacité d'un texte annoncé (pas encore dit) sur le premier écran. */
const OPACITE_ANNONCE = 0.42;
/** Durée du tracé d'un pictogramme (ms). */
const TRACE_DESSIN_MS = 900;

/** Police dessinée (Inter n'est chargée qu'en une graisse : jamais de gras synthétique, la mesure resterait fausse). */
const police = (p: "titre" | "texte"): CSSProperties => (p === "titre" ? { fontFamily: POLICES_V2.titre.famille, fontWeight: 800 } : { fontFamily: POLICES_V2.texte.famille, fontWeight: 400 });

interface Etat {
  visible: boolean;
  opacite: number;
  transform: string;
  /** Avant son heure : contour, estompé, pointillé. */
  avant?: "contour" | "estompe" | "pointille";
  /** Avancement (0 à 1) : frappe d'un mot, barre qui s'allonge. */
  u: number;
}

/** Glissé d'une entrée par la gauche (px de référence) : court, en fondu, sans volet qui couperait le texte. */
export const ENTREE_GAUCHE_PX = 70;

/** État d'une chose (texte ou forme) à l'instant `t`. */
function etat(a: ApparitionV2 | undefined, t: number, k: number, avant?: string, relance?: number): Etat {
  if (!a) return { visible: false, opacite: 0, transform: "", u: 0 };
  const R = REGLAGES_ANIMATION_V2;
  if (t < a.debutMs) {
    if (avant === "contour" || avant === "estompe" || avant === "pointille") return { visible: true, opacite: avant === "estompe" ? 0.38 : 1, transform: "", avant, u: 0 };
    return { visible: false, opacite: 0, transform: "", u: 0 };
  }
  let tr = "";
  let op = 1;
  const p = a.dureeMs ? (t - a.debutMs) / a.dureeMs : 1;
  const q = borne(p);
  switch (a.entree) {
    case "claque":
      tr = `scale(${lerp(1.6, 1, rebond(q, 2.2))})`;
      op = borne(p * 3);
      break;
    case "pop":
      tr = `scale(${lerp(0.15, 1, rebond(q, 2.6))})`;
      op = borne(p * 4);
      break;
    case "gauche":
      // Court glissé depuis la gauche, en fondu, sans volet : le texte n'est jamais montré coupé (relecture des quatre
      // vidéos du 12/10/2026 : « : phrase, une par » à moitié sortie d'un volet, au bord gauche).
      tr = `translateX(${lerp(-ENTREE_GAUCHE_PX * k, 0, rebond(q, 1.5))}px)`;
      op = borne(p * 2.5);
      break;
    case "monte":
      tr = `translateY(${lerp(900 * k, 0, rebond(q, 1.3))}px)`;
      break;
    case "tombe":
      tr = `scale(${lerp(2.6, 1, rebond(q, 1.8))}) rotate(${lerp(-20, 0, rebond(q))}deg)`;
      op = borne(p * 3);
      break;
    case "fondu":
      op = q;
      break;
    case "barre":
      tr = `scaleX(${1 - Math.pow(1 - q, 3)})`;
      break;
    default:
      break;
  }
  if (a.sortieMs !== undefined && t >= a.sortieMs) {
    const r = (t - a.sortieMs) / R.sortieMs;
    if (r >= 1) return { visible: false, opacite: 0, transform: "", u: 1 };
    // Sortie en fondu (plus de glissé derrière un volet : jamais un mot coupé).
    tr = `translateX(${-ENTREE_GAUCHE_PX * k * r}px) ${tr}`;
    op *= 1 - r;
  }
  if (relance !== undefined) {
    const r = (t - relance) / R.relanceMs;
    if (r >= 0 && r < 1) tr = `${tr} scale(${1 + 0.07 * Math.sin(Math.PI * r)})`;
  }
  return { visible: true, opacite: op, transform: tr.trim(), u: q };
}

function relanceDe(plan: PlanEcranV2, id: string, t: number): number | undefined {
  let r: number | undefined;
  for (const x of plan.relances) if (x.id === id && x.ms <= t) r = x.ms;
  return r;
}

function Texte({ x, a, t, k, plan }: { x: TexteV2; a: ApparitionV2 | undefined; t: number; k: number; plan: PlanEcranV2 }): ReactNode {
  const e = etat(a, t, k, x.avant, relanceDe(plan, x.id, t));
  if (!e.visible) return null;
  const contour = e.avant === "contour";
  const texte = a?.entree === "tape" && !e.avant ? x.texte.slice(0, Math.ceil(x.texte.length * e.u)) : x.texte;
  const origine = x.rotation && x.pivot ? `${x.pivot.x - x.x}px ${x.pivot.y - x.y}px` : "50% 50%";
  const style: CSSProperties = {
    position: "absolute",
    left: x.x,
    top: x.y,
    width: x.largeur + 4,
    height: x.hauteur,
    fontSize: x.taille,
    lineHeight: `${x.hauteur}px`,
    whiteSpace: "nowrap",
    // Texte annoncé (« contour ») : plein, couleur sable atténuée. Avant : lettres creuses au contour sable de 3 px,
    // qui paraissaient dédoublées et floues (relecture du 12/10/2026).
    color: contour ? COULEURS_V2.sable : x.couleur,
    opacity: contour ? OPACITE_ANNONCE : e.opacite,
    transform: `${e.transform}${x.rotation ? ` rotate(${x.rotation}deg)` : ""}`.trim() || undefined,
    transformOrigin: origine,
    fontSynthesis: "none",
    ...police(x.police),
    ...STYLE_ECRITURE_EXACTE,
  };
  const contenu = (
    <div style={style}>
      {texte}
      {a?.entree === "tape" && !e.avant && Math.floor(t / 400) % 2 === 0 ? <span style={{ display: "inline-block", width: Math.max(3, 5 * k), height: x.taille * 0.8, marginLeft: 6 * k, background: x.couleur, verticalAlign: "middle" }} /> : null}
    </div>
  );
  // Jamais de volet : un texte est toujours montré entier (il entre et sort en fondu).
  return contenu;
}

function Forme({ f, a, t, k, plan, partFil, g }: { f: FormeV2; a: ApparitionV2 | undefined; t: number; k: number; plan: PlanEcranV2; partFil: number; g: GeometrieV2 }): ReactNode {
  const e = etat(a, t, k, f.avant ?? (f.sorte === "bloc" && f.avant ? f.avant : undefined), relanceDe(plan, f.id, t));
  if (!e.visible) return null;
  if (f.deco) {
    return (
      <div style={{ position: "absolute", left: f.x, top: f.y, fontSize: f.deco.taille, lineHeight: 1, whiteSpace: "nowrap", color: "transparent", WebkitTextStroke: `${f.epaisseur}px ${f.contour}`, opacity: f.opacite ?? 0.3, transform: `rotate(${f.rotation ?? 0}deg)`, transformOrigin: "0 100%", ...police("titre"), ...STYLE_ECRITURE_EXACTE }}>
        {f.deco.texte}
      </div>
    );
  }
  // Fil de progression : avance avec la voix.
  const largeur = f.id === "fil" ? f.largeur * partFil : f.largeur;
  const avant = e.avant;
  const contourAvant = avant === "contour" || avant === "pointille";
  const style: CSSProperties = {
    position: "absolute",
    left: f.x,
    top: f.y,
    width: largeur,
    height: f.hauteur,
    borderRadius: f.rayon,
    boxSizing: "border-box",
    background: contourAvant ? "transparent" : (f.remplissage ?? "transparent"),
    border: contourAvant ? `${Math.max(2, 5 * k)}px dashed ${f.contour ?? CONTOUR_SUR.encre}` : f.contour && f.epaisseur ? `${f.epaisseur}px ${f.pointille ? "dashed" : "solid"} ${f.contour}` : undefined,
    boxShadow: f.ombre && !contourAvant ? `${Math.round(14 * k)}px ${Math.round(14 * k)}px 0 ${f.ombre}` : undefined,
    opacity: e.opacite * (f.opacite ?? 1),
    transform: `${e.transform}${f.rotation ? ` rotate(${f.rotation}deg)` : ""}`.trim() || undefined,
    transformOrigin: a?.entree === "barre" ? "0 50%" : "50% 50%",
  };
  if (f.sorte === "dessin" && f.dessin && Object.prototype.hasOwnProperty.call(TRACES_DESSINS, f.dessin)) {
    // Pictogramme de la banque : tracé trait par trait (≈ 0,9 s), à épaisseur fixe quelle que soit sa taille.
    const noeuds = TRACES_DESSINS[f.dessin as keyof typeof TRACES_DESSINS] as readonly (readonly [string, { d: string }])[];
    // Fini avant la fin de l'écran, même pour un dessin dit tard (jamais un pictogramme à moitié tracé au balayage).
    const duree = a ? Math.max(150, Math.min(TRACE_DESSIN_MS, plan.finMs - 300 - a.debutMs)) : TRACE_DESSIN_MS;
    const u = a ? borne((t - a.debutMs) / duree) * noeuds.length : 0;
    return (
      <svg viewBox={`0 0 ${GRILLE_DESSIN} ${GRILLE_DESSIN}`} style={{ position: "absolute", left: f.x, top: f.y, width: f.largeur, height: f.hauteur, overflow: "visible" }}>
        {noeuds.map(([, at], i) => {
          const q = borne(u - i);
          if (q <= 0) return null;
          return <path key={i} d={at.d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - q).toFixed(4)} fill="none" stroke={f.contour ?? COULEURS_V2.encre} strokeWidth={(f.epaisseur * GRILLE_DESSIN) / f.largeur} strokeLinecap="round" strokeLinejoin="round" />;
        })}
      </svg>
    );
  }
  if (f.sorte === "bouton") {
    // Bouton d'envoi : une flèche (tracée), remplacée par la coche du plan.
    const s = f.largeur;
    return (
      <div style={style}>
        <svg width={s} height={s} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={`M${s * 0.3} ${s * 0.5} L ${s * 0.7} ${s * 0.5} M ${s * 0.55} ${s * 0.34} L ${s * 0.72} ${s * 0.5} L ${s * 0.55} ${s * 0.66}`} fill="none" stroke={COULEURS_V2.ivoire} strokeWidth={8 * k} strokeLinecap="round" strokeLinejoin="round" opacity={plan.traits.some((x) => x.id.endsWith("#envoik") && t >= x.debutMs) ? 0 : 1} />
        </svg>
      </div>
    );
  }
  void g;
  // Comme un texte : jamais de volet, la forme est toujours montrée entière.
  return <div style={style} />;
}

function Traits({ ecran, plan, t, g, sorties }: { ecran: EcranPlace; plan: PlanEcranV2; t: number; g: GeometrieV2; sorties: Map<number, number> }): ReactNode {
  return (
    <svg width={g.largeur} height={g.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {ecran.traits.map((tr: TraitV2) => {
        const ta = plan.traits.find((x) => x.id === tr.id);
        if (!ta || t < ta.debutMs) return null;
        if (tr.groupe !== undefined && sorties.has(tr.groupe) && t >= sorties.get(tr.groupe)!) return null;
        const u = doux(borne((t - ta.debutMs) / Math.max(1, ta.dureeMs)));
        const faits = avancementSegments(tr.segments, u);
        return tr.segments.map((seg, i) => {
          if (faits[i] <= 0) return null;
          const d = seg.map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          const L = seg.slice(1).reduce((s, p, j) => s + Math.hypot(p.x - seg[j].x, p.y - seg[j].y), 0);
          return <path key={`${tr.id}-${i}`} d={d} fill="none" stroke={tr.couleur} strokeWidth={tr.epaisseur} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${L} ${L + 20}`} strokeDashoffset={L - faits[i]} />;
        });
      })}
    </svg>
  );
}

/** Un écran entier à l'instant `t`. */
function Ecran({ ecran, plan, t, v }: { ecran: EcranPlace; plan: PlanEcranV2; t: number; v: ProprietesV2 }): ReactNode {
  const g = v.geometrie;
  const k = g.k;
  // Sortie de chaque groupe de titres (pour cacher ses traits avec lui).
  const sorties = new Map<number, number>();
  for (const x of ecran.textes) if (x.groupe !== undefined && plan.apparitions[x.id]?.sortieMs !== undefined) sorties.set(x.groupe, Math.min(sorties.get(x.groupe) ?? Infinity, plan.apparitions[x.id].sortieMs!));
  const decor = ecran.formes.filter((f) => f.horsZone);
  const formes = ecran.formes.filter((f) => !f.horsZone);
  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS_V2[ecran.fond], overflow: "hidden" }}>
      {decor.map((f) => (
        <Forme key={f.id} f={f} a={plan.apparitions[f.id]} t={t} k={k} plan={plan} partFil={partFilV2(t, v.finVoixMs, v.filDepart)} g={g} />
      ))}
      {formes.map((f) => (
        <Forme key={f.id} f={f} a={plan.apparitions[f.id]} t={t} k={k} plan={plan} partFil={partFilV2(t, v.finVoixMs, v.filDepart)} g={g} />
      ))}
      <Traits ecran={ecran} plan={plan} t={t} g={g} sorties={sorties} />
      {ecran.textes.map((x) => (
        <Texte key={x.id} x={x} a={plan.apparitions[x.id]} t={t} k={k} plan={plan} />
      ))}
    </AbsoluteFill>
  );
}

function SousTitres({ v, t }: { v: ProprietesV2; t: number }): ReactNode {
  const groupes = useMemo(() => (v.mots ? groupesSousTitres(v.mots) : []), [v.mots]);
  if (!v.mots?.length) return null;
  const s = sousTitreA(v.mots, v.geometrie, t, v.finVoixMs, groupes);
  if (!s) return null;
  const k = v.geometrie.k;
  const fin = v.finVoixMs + 150;
  const op = t > fin ? borne(1 - (t - fin) / 200) : 1;
  const r = (t - s.debutMs) / 133;
  const echelle = r >= 0 && r < 1 ? lerp(0.88, 1, rebond(r, 2)) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: s.boite.x,
        top: s.boite.y,
        width: s.boite.largeur,
        height: s.boite.hauteur,
        boxSizing: "border-box",
        borderRadius: 22 * k,
        background: COULEURS_V2.ivoire,
        border: `${5 * k}px solid ${COULEURS_V2.encre}`,
        color: COULEURS_V2.encre,
        fontSize: s.taille,
        lineHeight: `${s.taille * 1.12}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap",
        opacity: op,
        transform: `scale(${echelle})`,
        fontSynthesis: "none",
        ...police("texte"),
        ...STYLE_ECRITURE_EXACTE,
      }}
    >
      {s.mots.map((m, i) => (
        <span key={i} style={{ display: "inline-block", padding: `0 ${6 * k}px`, marginRight: i < s.mots.length - 1 ? s.taille * 0.12 : 0, boxShadow: i === s.actif ? `inset 0 -${Math.round(12 * k)}px 0 ${COULEURS_V2.orange}` : undefined }}>
          {m}
        </span>
      ))}
    </div>
  );
}

/** Une scène du style « blocs/2 ». */
export function TableauV2({ p }: { p: ProprietesTableauScene }): ReactNode {
  const v = p.v2!;
  const image = useCurrentFrame();
  const t = p.scene.debutMs + (image * 1000) / p.fps;
  const plans = useMemo(
    () => v.ecrans.map((e) => planifierEcranV2({ ecran: e, geometrie: v.geometrie, debutMs: v.temps[e.id].debutMs, finMs: v.temps[e.id].finMs, heures: v.heures, finVoixMs: v.finVoixMs, ...(v.mots ? { mots: v.mots } : {}), stylo: p.stylo })),
    [v, p.stylo],
  );
  let i = 0;
  v.ecrans.forEach((e, j) => {
    if (v.temps[e.id].debutMs <= t + 0.5) i = j;
  });
  const cour = v.ecrans[i];
  const plan = plans[i];
  const prec = i > 0 ? v.ecrans[i - 1] : null;
  const q = (t - v.temps[cour.id].debutMs) / REGLAGES_ANIMATION_V2.balayageMs;
  const balaye = !!prec && q < 1;
  const g = v.geometrie;
  const W = g.largeur;
  const H = g.hauteur;
  // Balayage en biais de bas en haut : une lame de couleur précède le nouveau fond.
  const e = doux(borne(q));
  const Y = lerp(H + 280 * g.k, -280 * g.k, e);
  const poly = (y: number) => `polygon(0px ${y + 150 * g.k}px, ${W}px ${y - 150 * g.k}px, ${W}px ${H + 400}px, 0px ${H + 400}px)`;
  const lame = cour.fond === "orange" || prec?.fond === "orange" ? (cour.fond === "encre" || prec?.fond === "encre" ? COULEURS_V2.ivoire : COULEURS_V2.sable) : COULEURS_V2.orange;
  const crayon = balaye ? null : poseCrayonV2(plan, cour, g, t);
  const fondu = borne((t - (v.finVideoMs - FIN_V2.fonduImageMs)) / FIN_V2.fonduImageMs);
  return (
    <AbsoluteFill style={{ backgroundColor: COULEURS_V2[cour.fond], overflow: "hidden" }}>
      {balaye && prec ? <Ecran ecran={prec} plan={plans[i - 1]} t={t} v={v} /> : null}
      {balaye ? <AbsoluteFill style={{ backgroundColor: lame, clipPath: poly(Y - 110 * g.k) }} /> : null}
      <AbsoluteFill style={balaye ? { clipPath: poly(Y) } : undefined}>
        <Ecran ecran={cour} plan={plan} t={t} v={v} />
      </AbsoluteFill>
      <SousTitres v={v} t={t} />
      {crayon && crayon.opacite > 0.01 ? <Stylo id={p.stylo} x={crayon.x} y={crayon.y} hauteur={g.hauteurCrayon} angle={crayon.angle} opacite={crayon.opacite} /> : null}
      {fondu > 0 ? <AbsoluteFill style={{ backgroundColor: "#000000", opacity: fondu }} /> : null}
    </AbsoluteFill>
  );
}
