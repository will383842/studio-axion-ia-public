import React from "react";
/**
 * Objets communs du groupe D1 (ouvertures, fins, matière, sous-titres) : VRAIS composants (Fond, Entete, témoin des
 * sous-titres, icônes du schéma) + quelques objets dessinés dans la charte (carte du schéma au style de `Noeud`,
 * horloge, téléphone, bulle). Pixels de l'écran de référence 1080 × 1920 (ou 1080 × 1350 en 4:5).
 */
import { AbsoluteFill, COULEURS_DUO, Entete, famille, Fond, graisse, TemoinSousTitres } from "../socle";
import { Icone } from "../../../../../../studio-rendu/compositions/interface-claire/elements";

export const C = COULEURS_DUO;
export type NomFond = "sombre" | "ivoire";
export const ANTON: React.CSSProperties = { fontFamily: famille("anton"), fontWeight: graisse("anton"), textTransform: "uppercase", lineHeight: 1 };
export const INTER: React.CSSProperties = { fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), lineHeight: 1.15 };
export const a = (couleur: string, o: number) => `${couleur}${Math.round(o * 255).toString(16).padStart(2, "0")}`;
export { Icone };

/** Fond de la charte + marque (vraie Entete, sans titre) ; la marque est posée au-dessus du contenu. */
export function Ecran({ fond, children, largeur = 1080, hauteur = 1920, titre }: { fond: NomFond; children?: React.ReactNode; largeur?: number; hauteur?: number; titre?: { etiquette: string; titre: string } }) {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={fond} largeur={largeur} hauteur={hauteur} />
      {children}
      {/* Marque toujours dessinée avec la hauteur 1920 : 36 px, même en 4:5 (le standard garde les tailles en pixels). */}
      <Entete entete={titre ? { debut: 0, fin: 99, ...titre } : null} ecoule={9} sortie={0} fond={fond} marque="axion-ia.com" largeur={1080} hauteur={1920} />
    </AbsoluteFill>
  );
}

/** Étiquette en capitales espacées, 28 px (seule exception de taille permise). */
export function Etiquette({ texte, x = 72, y, fond, centre }: { texte: string; x?: number; y: number; fond: NomFond; centre?: number }) {
  const couleur = fond === "sombre" ? C.grisClair : C.encre;
  const style: React.CSSProperties = { position: "absolute", top: y, ...INTER, fontSize: 28, letterSpacing: "0.32em", textTransform: "uppercase", color: couleur, whiteSpace: "nowrap" };
  if (centre !== undefined) return <div style={{ ...style, left: centre - 500, width: 1000, textAlign: "center" }}>{texte}</div>;
  return <div style={{ ...style, left: x }}>{texte}</div>;
}

/** Témoin des sous-titres (vrai composant), en coordonnées 1080 × 1920. */
export function SousTitre({ texte, fond }: { texte: string; fond: NomFond }) {
  return <TemoinSousTitres texte={texte} fond={fond} />;
}

/** Sous-titre en pastille encre (lisible sur un écran partagé nuit / ivoire) : Inter Bold 58 px, mot orange vif. */
export function SousTitrePastille({ texte, y = 1180, centre = 540 }: { texte: string; y?: number; centre?: number }) {
  const mots = texte.split(/\s+/);
  return (
    <div style={{ position: "absolute", left: centre - 400, width: 800, top: y, display: "flex", justifyContent: "center" }}>
      <div style={{ ...INTER, fontSize: 58, color: C.ivoire, background: C.nuit, borderRadius: 999, padding: "18px 44px", whiteSpace: "nowrap", boxShadow: `0 16px 40px ${a(C.encre, 0.12)}` }}>
        {mots.map((m, i) => {
          const acc = /^\*.*\*[.,!?…:]*$/.test(m);
          return (
            <span key={i} style={{ color: acc ? C.orangeVif : undefined }}>
              {i ? " " : ""}
              {m.replace(/\*/g, "")}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Carte du schéma au style du vrai `Noeud` : carte blanche arrondie, pastille d'icône à cheval sur le bord gauche. */
export function Carte({
  x, y, l, h, libelle, detail, icone, contour = C.orangeVif, actif = true, coche = false, tailleLibelle = 76, tailleDetail = 58,
  couleurDetail = C.encre, pastille = C.encre, couleurIcone, ombre = 0.08, rayon = 34, epaisseurContour = 6, style, haut, padX = 40,
}: {
  x: number; y: number; l: number; h: number; libelle?: string; detail?: string; icone?: string; contour?: string; actif?: boolean; coche?: boolean;
  tailleLibelle?: number; tailleDetail?: number; couleurDetail?: string; pastille?: string; couleurIcone?: string; ombre?: number; rayon?: number; epaisseurContour?: number; style?: React.CSSProperties; haut?: number; padX?: number;
}) {
  const R = 46;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, ...style }}>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: rayon, background: C.blanc, border: actif ? `${epaisseurContour}px solid ${contour}` : "none", boxShadow: `0 22px 60px ${a(C.encre, ombre)}` }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: haut !== undefined ? "flex-start" : "center", gap: 10, textAlign: "center", padding: `${haut ?? 0}px ${padX}px 0` }}>
        {libelle ? <div style={{ ...ANTON, textTransform: "none", fontSize: tailleLibelle, lineHeight: 1.05, color: C.encre }}>{libelle}</div> : null}
        {detail ? <div style={{ ...INTER, fontSize: tailleDetail, color: couleurDetail }}>{detail}</div> : null}
      </div>
      {icone ? (
        <div style={{ position: "absolute", left: -2 * R + 30, top: h / 2 - R, width: 2 * R, height: 2 * R, borderRadius: "50%", background: pastille, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 10px 24px ${a(C.encre, 0.12)}` }}>
          <Icone nom={icone} taille={R * 1.15} couleur={couleurIcone ?? C.orangeVif} epaisseur={2.6} />
        </div>
      ) : null}
      {coche ? <Coche x={l - 18} y={18} /> : null}
    </div>
  );
}

export function Coche({ x, y, r = 46, echelle = 1 }: { x: number; y: number; r?: number; echelle?: number }) {
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.vert, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${echelle})`, boxShadow: `0 10px 24px ${a(C.vert, 0.3)}` }}>
      <svg width={r * 1.1} height={r * 1.1} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

/** Horloge à aiguilles (objet du schéma : 23h14). `trace` : arc de trajectoire derrière l'aiguille des minutes. */
export function Horloge({ cx, cy, r, h, m, fond = "sombre", trace = 0, traceHeure = 0 }: { cx: number; cy: number; r: number; h: number; m: number; fond?: NomFond; trace?: number; traceHeure?: number }) {
  const trait = fond === "sombre" ? C.ivoire : C.encre;
  const angM = (m / 60) * 360;
  const angH = (((h % 12) + m / 60) / 12) * 360;
  const pt = (ang: number, rr: number) => [cx + rr * Math.sin((ang * Math.PI) / 180), cy - rr * Math.cos((ang * Math.PI) / 180)];
  const arc = (a0: number, a1: number, rr: number) => {
    const [x0, y0] = pt(a0, rr);
    const [x1, y1] = pt(a1, rr);
    const grand = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sens = a1 > a0 ? 1 : 0;
    return `M${x0} ${y0} A${rr} ${rr} 0 ${grand} ${sens} ${x1} ${y1}`;
  };
  const [mx, my] = pt(angM, r * 0.8);
  const [hx, hy] = pt(angH, r * 0.52);
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <circle cx={cx} cy={cy} r={r} fill={fond === "sombre" ? a(C.nuitHaut, 0.85) : C.blanc} stroke={trait} strokeWidth={14} />
      {Array.from({ length: 12 }, (_, i) => {
        const [x0, y0] = pt(i * 30, r * (i % 3 === 0 ? 0.8 : 0.86));
        const [x1, y1] = pt(i * 30, r * 0.93);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={trait} strokeWidth={i % 3 === 0 ? 12 : 6} strokeLinecap="round" opacity={i % 3 === 0 ? 1 : 0.6} />;
      })}
      {trace > 0 ? <path d={arc(angM - trace, angM - 4, r * 0.8)} fill="none" stroke={C.orangeVif} strokeWidth={10} strokeLinecap="round" opacity={0.35} strokeDasharray="2 22" /> : null}
      {traceHeure > 0 ? <path d={arc(angH + 8, angH + traceHeure, r * 0.66)} fill="none" stroke={C.orangeVif} strokeWidth={8} strokeLinecap="round" opacity={0.5} strokeDasharray="2 20" /> : null}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={trait} strokeWidth={22} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={mx} y2={my} stroke={C.orangeVif} strokeWidth={14} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={20} fill={C.orangeVif} />
    </svg>
  );
}

/** Téléphone (écran verrouillé), comme celui de l'alerte réelle. */
export function Telephone({ x, y, l, h, children, inclinaison = 0, cadre = C.encre }: { x: number; y: number; l: number; h: number; children?: React.ReactNode; inclinaison?: number; cadre?: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `rotate(${inclinaison}deg)`, boxSizing: "border-box", borderRadius: 86, border: `14px solid ${cadre}`, background: `linear-gradient(180deg, ${C.nuitHaut}, ${C.nuit})`, boxShadow: `0 40px 90px ${a(C.nuit, 0.12)}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: 22, width: 170, height: 40, marginLeft: -85, borderRadius: 20, background: C.encre }} />
      {children}
    </div>
  );
}

/** Ondes de vibration (traces de mouvement d'un objet, jamais du texte). */
export function Vibration({ x, y, cote, couleur = C.orangeVif }: { x: number; y: number; cote: 1 | -1; couleur?: string }) {
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      {[0, 1].map((k) => (
        <path key={k} d={`M${x + cote * (16 + 26 * k)} ${y - 60 - 18 * k} Q${x + cote * (44 + 26 * k)} ${y} ${x + cote * (16 + 26 * k)} ${y + 60 + 18 * k}`} fill="none" stroke={couleur} strokeWidth={9} strokeLinecap="round" opacity={0.85 - 0.35 * k} />
      ))}
    </svg>
  );
}

/** Lueur orangée de la charte (#7A3418), douce. */
export function Lueur({ x, y, r, o = 0.6 }: { x: number; y: number; r: number; o?: number }) {
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: `radial-gradient(circle, ${a(C.nuitLueur, o)} 0%, ${a(C.nuitLueur, 0)} 70%)` }} />;
}

/** Texte absolu commode. */
export function T({ x, y, taille, couleur, police = "anton", children, style, largeur, align }: { x: number; y: number; taille: number; couleur: string; police?: "anton" | "inter"; children: React.ReactNode; style?: React.CSSProperties; largeur?: number; align?: "left" | "center" | "right" }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: largeur, textAlign: align, whiteSpace: "nowrap", ...(police === "anton" ? ANTON : INTER), fontSize: taille, color: couleur, ...style }}>
      {children}
    </div>
  );
}

/* ───────── Objets d'appoint (v2) : ils prolongent l'écran sous la bande des sous-titres (y 1300 → 1536) ───────── */

/** Bulle de message (forme du vrai schéma) : `queue` à gauche (client) ou à droite (réponse). Contenu libre. */
export function Bulle({ x, y, l, h, fond = C.blanc, contour, epaisseur = 5, queue = "gauche", opacite = 1, children, pointille }: { x: number; y: number; l: number; h: number; fond?: string; contour?: string; epaisseur?: number; queue?: "gauche" | "droite"; opacite?: number; children?: React.ReactNode; pointille?: boolean }) {
  const r = Math.min(46, h / 2);
  const rayon = queue === "gauche" ? `${r}px ${r}px ${r}px 10px` : `${r}px ${r}px 10px ${r}px`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: rayon, background: fond, border: contour ? `${epaisseur}px ${pointille ? "dashed" : "solid"} ${contour}` : "none", opacity: opacite, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
      {children}
    </div>
  );
}

/** Trois points d'attente (le message reste sans réponse). */
export function Points({ couleur = C.gris, taille = 26 }: { couleur?: string; taille?: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: taille, height: taille, borderRadius: "50%", background: couleur, opacity: 1 - i * 0.25 }} />
      ))}
    </>
  );
}

/** Carte du schéma réduite à son icône (nœud du vrai schéma de l'image C, sans libellé). */
export function CarteIcone({ cx, cy, l = 220, h = 104, icone, contour = C.encre, pastille = C.encre, couleurIcone = C.orangeVif, opacite = 1, rayon = 28, epaisseur = 5, ombre = 0.08, fond = C.blanc, pointille }: { cx: number; cy: number; l?: number; h?: number; icone: string; contour?: string; pastille?: string; couleurIcone?: string; opacite?: number; rayon?: number; epaisseur?: number; ombre?: number; fond?: string; pointille?: boolean }) {
  const R = h * 0.4;
  return (
    <div style={{ position: "absolute", left: cx - l / 2, top: cy - h / 2, width: l, height: h, opacity: opacite }}>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: rayon, background: fond, border: `${epaisseur}px ${pointille ? "dashed" : "solid"} ${contour}`, boxShadow: ombre ? `0 14px 36px ${a(C.encre, ombre)}` : "none" }} />
      <div style={{ position: "absolute", left: l / 2 - R, top: h / 2 - R, width: 2 * R, height: 2 * R, borderRadius: "50%", background: pastille, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icone === "coche" ? (
          <svg width={R * 1.1} height={R * 1.1} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        ) : (
          <Icone nom={icone} taille={R * 1.1} couleur={couleurIcone} epaisseur={2.6} />
        )}
      </div>
    </div>
  );
}

/** Téléphone posé à plat sur la table de nuit (vue de face, couché) : écran sombre, une notification. */
export function TelephoneCouche({ x, y, l, h, children }: { x: number; y: number; l: number; h: number; children?: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: 56, border: `12px solid ${C.encre}`, background: `linear-gradient(180deg, ${C.nuitHaut}, ${C.nuit})`, boxShadow: `0 0 0 3px ${a(C.grisClair, 0.35)}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 22, top: "50%", width: 26, height: 100, marginTop: -50, borderRadius: 13, background: C.encre }} />
      {children}
    </div>
  );
}

/** Dix barres : 8 pleines, 2 vides (80 % / 20 % en objets). */
export function DixBarres({ x, y, l, h, plein = C.ivoire, vide = C.grisClair, ecart = 20 }: { x: number; y: number; l: number; h: number; plein?: string; vide?: string; ecart?: number }) {
  const lb = (l - 9 * ecart) / 10;
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: x + i * (lb + ecart), top: y, width: lb, height: h, boxSizing: "border-box", borderRadius: 14, background: i < 8 ? plein : "transparent", border: i < 8 ? "none" : `5px solid ${vide}` }} />
      ))}
    </>
  );
}
