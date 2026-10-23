import React from "react";
/**
 * L6 · LISTE « AVANT », ÉTAPE et OBJET (maquettes CC-AVA-A/B/C, CC-ETA-A/B/C, CC-OBJ-A/B de #308). Tâches, titres,
 * lignes, puces et numéros d'étape viennent de l'écran ; l'objet est celui de la banque (même composant que la v4).
 * Chaque tâche arrive sur son mot (`tache-n`), chaque puce sur le sien (`puce-n`), le total sur `total`.
 */
import type { BoitePx, ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { FAMILLE_ANTON } from "../../commune/polices";
import { OBJETS } from "../objets/registre";
import { contexteVisuel, objetDuVisuel } from "../plans/Objet";
import type { dispoAvaBarreFeutre, dispoAvaCadran, dispoAvaCartesTombent, dispoEtaEntrerDedans, dispoEtaFantome, dispoEtaSchemaFeutre, dispoObjEtiquettePend, dispoObjPleinCadre } from "./dispositions";
import { a, C, couleurs, largeurPosee as largeurTexte, type TexteL6 } from "./geo";
import { arc, borne, Coche, doux, entree, Icone, img, Pilules, prog, pt, ressort, Rond, TexteL, useImage } from "./kit";

type P<T extends ProprietesEcran["type"]> = Extract<ProprietesEcran, { type: T }>;
const texte = (d: { textes: TexteL6[] }, nom: string) => d.textes.find((t) => t.nom === nom);
const FPS = 25;

/** L'objet du visuel, dessiné dans sa boîte par le composant de la banque (le même que la v4). */
export function Visuel({ p, b, image, style }: { p: P<"etape" | "objet">; b: BoitePx; image: number; style?: React.CSSProperties }) {
  const Objet = OBJETS[objetDuVisuel(p.visuel)];
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, ...style }}>
      <Objet {...contexteVisuel(p, b, image / FPS)} />
    </div>
  );
}

/** Départ (image) de la tâche i : son mot dans la voix. */
const departTache = (p: P<"liste-avant">, i: number) => img(p, `tache-${i + 1}`, 0.3 + i * 0.35);

/* ------------------------------------------------------------------ */
/* Liste « avant »                                                        */
/* ------------------------------------------------------------------ */

function Entete({ p, d, image }: { p: P<"liste-avant">; d: { textes: TexteL6[] }; image: number }) {
  const k = couleurs(p.fond);
  const et = texte(d, "etiquette");
  return (
    <>
      {et ? <TexteL t={et} couleur={k.accent} accent={k.accent} style={{ opacity: prog(image, 0, 6) }} /> : null}
      <TexteL t={texte(d, "titre")!} couleur={k.texte} accent={k.accent} ligne={(i) => entree(ressort(image, img(p, "titre", 0.02) + i * 4), 50)} />
    </>
  );
}

export function AvaCartesTombent({ p, d }: { p: P<"liste-avant">; d: ReturnType<typeof dispoAvaCartesTombent> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const total = texte(d, "total");
  const ligneTotal = texte(d, "total-ligne");
  const qt = ressort(image, img(p, "total", 2), 180, 13);
  return (
    <>
      <Entete p={p} d={d} image={image} />
      {d.formes.map((f, i) => {
        const q = ressort(image, departTache(p, i), 210, 15);
        const t = texte(d, `tache-${i + 1}`)!;
        const h = f.boite.hauteur;
        return (
          <div key={f.nom} style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - q) * -700}px) rotate(${(i % 2 ? 1.6 : -1.6) * q}deg)`, transformOrigin: `${f.boite.x + f.boite.largeur / 2}px ${f.boite.y + h / 2}px`, opacity: borne(q * 4) }}>
            <div style={{ position: "absolute", left: f.boite.x, top: f.boite.y, width: f.boite.largeur, height: h, boxSizing: "border-box", borderRadius: h * 0.27, background: C.blanc, border: `5px solid ${C.encre}`, boxShadow: `0 12px 30px ${a(C.encre, 0.1)}` }} />
            <Rond x={f.boite.x + h * 0.52} y={f.boite.y + h / 2} d={h * 0.68} fondR={C.encre} couleur={C.blanc} numero={String(i + 1)} />
            <TexteL t={t} couleur={C.encre} accent={C.orange} />
          </div>
        );
      })}
      {total ? <TexteL t={total} couleur={k.texte} accent={k.accent} style={entree(qt, 80)} /> : null}
      {ligneTotal ? <TexteL t={ligneTotal} couleur={k.secondaire} accent={k.accent} style={{ opacity: borne(qt * 2) }} /> : null}
    </>
  );
}

export function AvaCadran({ p, d }: { p: P<"liste-avant">; d: ReturnType<typeof dispoAvaCadran> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const { cx, cy, r, ep, d: dp } = d;
  const n = p.taches.length;
  const tranche = 360 / n;
  const qt = ressort(image, img(p, "total", 2), 170, 14);
  return (
    <>
      <Entete p={p} d={d} image={image} />
      <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={k.piste} strokeWidth={ep} />
        {p.taches.map((_, i) => {
          const q = doux(image, departTache(p, i), 9);
          const de = i * tranche + 1.5;
          return <path key={i} d={arc(cx, cy, r, de, de + (tranche - 3) * q)} fill="none" stroke={k.accent} strokeWidth={ep} />;
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const [x0, y0] = pt(cx, cy, r - ep / 2 - 20, i * 30);
          const [x1, y1] = pt(cx, cy, r - ep / 2 - (i % 3 ? 36 : 56), i * 30);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={a(k.trait, 0.5)} strokeWidth={i % 3 ? 4 : 7} strokeLinecap="round" />;
        })}
      </svg>
      {p.taches.map((_, i) => {
        const f = d.formes.find((x) => x.nom === `tache-${i + 1}`)!.boite;
        const q = ressort(image, departTache(p, i), 240, 13);
        return <Rond key={i} x={f.x + dp / 2} y={f.y + dp / 2} d={dp} fondR={p.fond === "sombre" ? C.ivoire : C.encre} couleur={p.fond === "sombre" ? C.encre : C.blanc} numero={String(i + 1)} style={{ transform: `scale(${q})` }} />;
      })}
      <TexteL t={texte(d, "total")!} couleur={k.texte} accent={k.accent} style={entree(qt, 30)} />
      {texte(d, "total-ligne") ? <TexteL t={texte(d, "total-ligne")!} couleur={k.accent} accent={k.accent} style={{ opacity: borne(qt * 2) }} /> : null}
    </>
  );
}

export function AvaBarreFeutre({ p, d }: { p: P<"liste-avant">; d: ReturnType<typeof dispoAvaBarreFeutre> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const n = p.taches.length;
  // Le feutre raye les tâches une à une, après la dernière (ou sur le total, s'il est dit).
  const raye = Math.max(departTache(p, n - 1) + 10, img(p, "total", 0) || 0);
  return (
    <>
      <Entete p={p} d={d} image={image} />
      {p.taches.map((_, i) => {
        const t = texte(d, `tache-${i + 1}`)!;
        const q = ressort(image, departTache(p, i), 200, 17);
        const trait = doux(image, raye + i * 4, 8);
        const l = Math.min(t.boite.largeur, largeurTexte(t));
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, transform: `translateX(${(1 - q) * -900}px)` }}>
            <TexteL t={t} couleur={trait > 0.5 ? a(k.texte, 0.55) : k.texte} accent={k.accent} />
            <div style={{ position: "absolute", left: t.boite.x - 16, top: t.boite.y + t.taille * 0.42, width: (l + 32) * trait, height: Math.max(10, t.taille * 0.2), borderRadius: 13, background: C.orangeVif, opacity: 0.92, transform: `rotate(${i % 2 ? 1.2 : -1.2}deg)`, transformOrigin: "0 50%" }} />
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Étape                                                                 */
/* ------------------------------------------------------------------ */

const departPuce = (p: P<"etape" | "preuve">, i: number) => img(p, `puce-${i + 1}`, 0.6 + i * 0.3);

export function EtaSchemaFeutre({ p, d }: { p: P<"etape">; d: ReturnType<typeof dispoEtaSchemaFeutre> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const pts = d.noeuds;
  const chemin = pts.map((q, i) => (i ? `C ${pts[i - 1]!.x} ${(pts[i - 1]!.y + q.y) / 2}, ${q.x} ${(pts[i - 1]!.y + q.y) / 2}, ${q.x} ${q.y}` : `M${q.x} ${q.y}`)).join(" ");
  const trace = prog(image, 4, 30);
  const allume = ressort(image, img(p, "titre", 0.5) + 8, 200, 13);
  return (
    <>
      <TexteL t={texte(d, "etiquette")!} couleur={k.accent} accent={k.accent} style={{ opacity: prog(image, 0, 6) }} />
      <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d={chemin} fill="none" stroke={k.trait} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trace} />
      </svg>
      {pts.map((q, i) => {
        const v = ressort(image, 4 + i * 6, 230, 14);
        const on = i === d.actif;
        const dd = on ? d.dActif + 20 * allume : d.dPetit;
        return (
          <React.Fragment key={i}>
            <Rond x={q.x} y={q.y} d={dd} fondR={on && allume > 0.3 ? k.accent : p.fond === "sombre" ? C.ivoire : C.encre} couleur={on && allume > 0.3 ? C.blanc : p.fond === "sombre" ? C.encre : C.blanc} numero={String(i + 1)} style={{ transform: `scale(${v})`, boxShadow: on ? `0 0 0 ${16 * allume}px ${a(k.accent, 0.18)}` : undefined }} />
            {!on && texte(d, `numero-${i + 1}`) ? <TexteL t={texte(d, `numero-${i + 1}`)!} couleur={a(k.texte, 0.55)} accent={k.accent} style={{ opacity: borne(v * 2) }} /> : null}
          </React.Fragment>
        );
      })}
      {/* Halo du fond sous les textes : le trait du schéma ne les traverse jamais à l'œil. */}
      <TexteL t={texte(d, "titre")!} couleur={k.texte} accent={k.accent} style={{ ...entree(allume, 30), transformOrigin: d.actif % 2 ? "100% 50%" : "0 50%", textShadow: `0 0 14px ${k.fond}, 0 0 6px ${k.fond}` }} />
      <TexteL t={texte(d, "ligne")!} couleur={k.secondaire} accent={k.accent} style={{ opacity: prog(image, img(p, "ligne", 0.6), 8), textShadow: `0 0 10px ${k.fond}, 0 0 4px ${k.fond}, 0 0 2px ${k.fond}` }} />
      <Pilules formes={d.formes} textes={d.textes} nom="puce" image={image} debut={(i) => departPuce(p, i)} fond={C.blanc} couleurTexte={C.encre} />
    </>
  );
}

export function EtaEntrerDedans({ p, d }: { p: P<"etape">; d: ReturnType<typeof dispoEtaEntrerDedans> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const autre = couleurs(p.fond === "sombre" ? "ivoire" : "sombre");
  // La carte de l'étape, entre ses voisines (numéros de la fiche) ; la caméra plonge dedans : son intérieur EST l'écran.
  const z = doux(image, 4, 16);
  const c = d.carte;
  const lerp = (x: number, y: number) => x + (y - x) * z;
  const fen = { x: lerp(c.x, 0), y: lerp(c.y, 0), l: lerp(c.largeur, p.largeur), h: lerp(c.hauteur, p.hauteur) };
  const sc = lerp(c.largeur / p.largeur, 1);
  const cx = c.x + c.largeur / 2;
  const cy = c.y + c.hauteur / 2;
  const voisins = [p.numero - 1, p.numero + 1].filter((n) => n >= 1 && n <= p.nombreEtapes);
  return (
    <>
      {z < 0.999 ? (
        <div style={{ position: "absolute", inset: 0, background: autre.fond, transform: `scale(${1 + 3.6 * z})`, transformOrigin: `${cx}px ${cy}px` }}>
          {voisins.map((n) => {
            const g = n < p.numero ? -1 : 1;
            return (
              <div key={n} style={{ position: "absolute", left: c.x + g * (c.largeur + 60), top: c.y + 40, width: c.largeur, height: c.hauteur - 80, boxSizing: "border-box", borderRadius: 28, border: `5px solid ${a(autre.trait, 0.5)}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FAMILLE_ANTON, fontSize: c.largeur * 0.38, color: a(autre.trait, 0.6) }}>
                {String(n).padStart(2, "0")}
              </div>
            );
          })}
        </div>
      ) : null}
      <div style={{ position: "absolute", inset: 0, clipPath: z < 0.999 ? `inset(${fen.y}px ${p.largeur - fen.x - fen.l}px ${p.hauteur - fen.y - fen.h}px ${fen.x}px round ${28 * (1 - z)}px)` : undefined }}>
        <div style={{ position: "absolute", inset: 0, background: k.fond }} />
        <div style={{ position: "absolute", inset: 0, transform: z < 0.999 ? `translate(${(cx - p.largeur / 2) * (1 - z)}px, ${(cy - p.hauteur / 2) * (1 - z)}px) scale(${sc})` : undefined, transformOrigin: "50% 50%" }}>
          <TexteL t={texte(d, "etiquette")!} couleur={k.accent} accent={k.accent} />
          <TexteL t={texte(d, "titre")!} couleur={k.texte} accent={k.accent} ligne={(i) => entree(ressort(image, Math.max(12, img(p, "titre", 0)) + i * 4), 40)} />
          <TexteL t={texte(d, "ligne")!} couleur={k.secondaire} accent={k.accent} style={{ opacity: prog(image, Math.max(16, img(p, "ligne", 0.8)), 8) }} />
          <Visuel p={p} b={d.visuel} image={image} style={entree(ressort(image, 14, 170, 15), 80)} />
          <Pilules formes={d.formes} textes={d.textes} nom="puce" image={image} debut={(i) => Math.max(20, departPuce(p, i))} fond={p.fond === "sombre" ? C.blanc : C.encre} couleurTexte={p.fond === "sombre" ? C.encre : C.ivoire} />
        </div>
      </div>
      {z < 0.999 ? <div style={{ position: "absolute", left: fen.x, top: fen.y, width: fen.l, height: fen.h, boxSizing: "border-box", borderRadius: 28 * (1 - z), border: `${5 * (1 - z)}px solid ${C.orangeVif}`, boxShadow: `0 0 ${60 * (1 - z)}px ${a(C.orangeVif, 0.45)}` }} /> : null}
    </>
  );
}

export function EtaFantome({ p, d }: { p: P<"etape">; d: ReturnType<typeof dispoEtaFantome> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const allume = ressort(image, Math.max(8, img(p, "titre", 0.4)), 200, 13);
  const rangs = d.formes.filter((f) => f.nom.startsWith("rang-"));
  return (
    <>
      {rangs.map((f, i) => {
        const on = i === d.actif;
        const q = ressort(image, 2 + i * 3, 220, 16);
        const plein = on ? allume : 0;
        const b = f.boite;
        const num = texte(d, `numero-${i + 1}`)!;
        const encreSurPlein = p.fond === "sombre" ? C.encre : C.ivoire;
        return (
          <div key={f.nom} style={{ position: "absolute", left: 0, top: 0, transform: `translateX(${(1 - q) * 300}px)`, opacity: borne(q * 3) }}>
            <div style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, boxSizing: "border-box", borderRadius: 40, border: `6px solid ${on ? k.accent : a(k.secondaire, 0.35)}`, background: on ? a(p.fond === "sombre" ? C.blanc : C.encre, plein) : "transparent", boxShadow: on ? `0 0 ${70 * plein}px ${a(k.accent, 0.35)}` : undefined, transform: `scale(${1 + 0.03 * plein})` }} />
            <TexteL t={num} couleur={on ? k.accent : a(k.secondaire, 0.4)} accent={k.accent} />
            {on ? (
              <>
                <TexteL t={texte(d, "titre")!} couleur={plein > 0.5 ? encreSurPlein : k.texte} accent={k.accent} />
                <TexteL t={texte(d, "ligne")!} couleur={k.accent} accent={k.accent} style={{ opacity: plein }} />
                {p.puces.length ? <Coche x={b.x + b.largeur - 70} y={b.y + b.hauteur / 2} r={Math.min(50, b.hauteur * 0.22)} echelle={ressort(image, departPuce(p, 0), 240, 12)} trace={prog(image, departPuce(p, 0) + 2, 8)} /> : null}
              </>
            ) : null}
          </div>
        );
      })}
      <Pilules formes={d.formes} textes={d.textes} nom="puce" image={image} debut={(i) => departPuce(p, i)} fond={C.blanc} couleurTexte={C.encre} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Objet                                                                 */
/* ------------------------------------------------------------------ */

export function ObjEtiquettePend({ p, d }: { p: P<"objet">; d: ReturnType<typeof dispoObjEtiquettePend> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const titre = ressort(image, 0);
  const photo = ressort(image, 4, 150, 13);
  const dep = Math.max(16, img(p, "ligne", 0.9));
  const etiq = ressort(image, dep, 120, 6);
  const balance = Math.sin((image - dep) / 5) * 9 * Math.exp(-(image - dep) / 28) * borne(image - dep);
  const cb = d.cadre;
  const tag = d.tag;
  const at = d.attache;
  return (
    <>
      <TexteL t={texte(d, "titre")!} couleur={k.texte} accent={k.accent} style={{ transform: `translateX(${(1 - titre) * -600}px)` }} />
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - photo) * -900}px) rotate(${-3 * photo}deg)`, transformOrigin: `${cb.x + cb.largeur / 2}px ${cb.y + cb.hauteur / 2}px` }}>
        <div style={{ position: "absolute", left: cb.x, top: cb.y, width: cb.largeur, height: cb.hauteur, background: C.blanc, borderRadius: 30, boxShadow: `0 40px 80px ${a(C.encre, 0.18)}` }} />
        <Visuel p={p} b={d.visuel} image={image} />
      </div>
      {/* Le fil et l'étiquette : la ligne de l'écran devient un objet qui se balance. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: p.largeur, height: p.hauteur, transformOrigin: `${at.x}px ${at.y}px`, transform: `rotate(${balance + 4 * etiq}deg) scale(${etiq})` }}>
        <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={`M${at.x} ${at.y} L${tag.x + tag.largeur / 2} ${tag.y + 12}`} stroke={k.trait} strokeWidth={5} />
        </svg>
        <div style={{ position: "absolute", left: tag.x, top: tag.y, width: tag.largeur, height: tag.hauteur, borderRadius: 26, background: C.orange, boxShadow: `0 20px 40px ${a(C.orange, 0.3)}` }}>
          <div style={{ position: "absolute", left: tag.largeur / 2 - 12, top: 12, width: 24, height: 24, borderRadius: 12, background: C.ivoire }} />
        </div>
        <TexteL t={texte(d, "ligne")!} couleur={C.blanc} accent={C.encre} />
      </div>
    </>
  );
}

export function ObjPleinCadre({ p, d }: { p: P<"objet">; d: ReturnType<typeof dispoObjPleinCadre> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const fenetre = ressort(image, 0, 150, 16);
  const cam = 1 + 0.06 * doux(image, 10, 70);
  const signal = ressort(image, Math.max(14, img(p, "ligne", 1.2)), 220, 12);
  const v = d.visuel;
  const pil = d.pilule;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${cam})`, transformOrigin: `${p.largeur / 2}px ${v.y + v.hauteur * 0.3}px` }}>
        <Visuel p={p} b={v} image={image} style={{ transform: `translateY(${(1 - fenetre) * 400}px)`, opacity: borne(fenetre * 3) }} />
      </div>
      <TexteL t={texte(d, "titre")!} couleur={k.texte} accent={k.accent} ligne={(i) => entree(ressort(image, 2 + i * 4), 50)} />
      {pil ? (
        <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${signal}) rotate(${-2 * signal}deg)`, transformOrigin: `${pil.x + pil.largeur * 0.2}px ${pil.y + pil.hauteur}px` }}>
          <div style={{ position: "absolute", left: pil.x, top: pil.y, width: pil.largeur, height: pil.hauteur, borderRadius: pil.hauteur / 2, background: p.fond === "sombre" ? C.ivoire : C.encre, boxShadow: `0 24px 50px ${a(C.nuit, 0.3)}` }} />
          <div style={{ position: "absolute", left: pil.x + pil.hauteur * 0.15, top: pil.y + pil.hauteur * 0.15, width: pil.hauteur * 0.7, height: pil.hauteur * 0.7, borderRadius: "50%", background: C.orangeVif, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="envoyer" taille={pil.hauteur * 0.36} couleur={C.blanc} />
          </div>
          <TexteL t={texte(d, "ligne")!} couleur={p.fond === "sombre" ? C.encre : C.ivoire} accent={C.orangeVif} />
        </div>
      ) : null}
    </>
  );
}
