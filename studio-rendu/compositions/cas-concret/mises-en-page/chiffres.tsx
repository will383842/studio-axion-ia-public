import React from "react";
/**
 * L6 · PREUVE, CHIFFRE, QUESTION, RÉSULTAT (maquettes CC-PRE-A/B/C, CC-CHI-A/B/C, CC-QUE-A/B, CC-RES-A/B de #308).
 * Chaque nombre montré est celui de l'écran (ou une part ÉCRITE dans ses textes) ; jauges et grilles en suivent la
 * valeur, jamais une autre. Départs calés sur la voix (`puce-n`, `unite`, `pastille-n`, `question`, `barre-maintenant`).
 */
import type { ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { FAMILLE_ANTON, FAMILLE_TITRE } from "../../commune/polices";
import type { dispoChiAplatOrange, dispoChiCompterObjets, dispoChiJaugeAnneau, dispoPreCasesCochees, dispoPreCompterObjets, dispoPreJaugeSeuil, dispoQueChampReponse, dispoQueGeante, dispoResCoupeDeux, dispoResMoisRempli } from "./dispositions";
import { a, C, couleurs, ecrireNombre, type TexteL6 } from "./geo";
import { arc, borne, Coche, doux, entree, Icone, img, Pilules, prog, pt, ressort, TexteL, useImage } from "./kit";

type P<T extends ProprietesEcran["type"]> = Extract<ProprietesEcran, { type: T }>;
const texte = (d: { textes: TexteL6[] }, nom: string) => d.textes.find((t) => t.nom === nom);
const departPuce = (p: P<"preuve">, i: number) => img(p, `puce-${i + 1}`, 0.5 + i * 0.35);

function EnTete({ p, d, image }: { p: P<"preuve" | "resultat">; d: { textes: TexteL6[] }; image: number }) {
  const k = couleurs(p.fond);
  const et = texte(d, "etiquette");
  return (
    <>
      {et ? <TexteL t={et} couleur={k.accent} accent={k.accent} style={{ opacity: prog(image, 0, 6) }} /> : null}
      <TexteL t={texte(d, "titre")!} couleur={k.texte} accent={k.accent} ligne={(i) => entree(ressort(image, img(p, "titre", 0.02) + i * 4), 50)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Preuve                                                                */
/* ------------------------------------------------------------------ */

export function PreJaugeSeuil({ p, d }: { p: P<"preuve">; d: ReturnType<typeof dispoPreJaugeSeuil> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const { cx, cy, r, ep } = d;
  // Anneau ouvert en bas (270°) ; il se remplit jusqu'à la part écrite.
  const DE = 225;
  const TOUR = 270;
  const part = d.part.total ? d.part.valeur / d.part.total : 0;
  const q = doux(image, 6, 22);
  const fin = DE + TOUR * part * q;
  const [sx, sy] = pt(cx, cy, r + ep / 2 + 26, DE + TOUR * part);
  const repere = ressort(image, 26, 220, 12);
  return (
    <>
      <EnTete p={p} d={d} image={image} />
      <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d={arc(cx, cy, r, DE, DE + TOUR)} fill="none" stroke={k.piste} strokeWidth={ep} strokeLinecap="round" />
        {q > 0.01 ? <path d={arc(cx, cy, r, DE, fin)} fill="none" stroke={k.accent} strokeWidth={ep} strokeLinecap="round" /> : null}
        <line x1={pt(cx, cy, r - ep / 2 - 10, DE + TOUR * part)[0]} y1={pt(cx, cy, r - ep / 2 - 10, DE + TOUR * part)[1]} x2={sx} y2={sy} stroke={k.trait} strokeWidth={10} strokeLinecap="round" opacity={borne(repere)} />
      </svg>
      <TexteL t={texte(d, "part")!} couleur={k.texte} accent={k.accent} style={{ transform: `scale(${0.7 + 0.3 * ressort(image, 6)})`, transformOrigin: `${cx}px ${cy}px` }} />
      <Pilules formes={d.formes} textes={d.textes} nom="puce" image={image} debut={(i) => departPuce(p, i)} fond={p.fond === "sombre" ? C.blanc : C.encre} couleurTexte={p.fond === "sombre" ? C.encre : C.ivoire} />
    </>
  );
}

export function PreCompterObjets({ p, d }: { p: P<"preuve">; d: ReturnType<typeof dispoPreCompterObjets> }) {
  const image = useImage();
  return (
    <>
      <EnTete p={p} d={d} image={image} />
      {d.formes.map((f, i) => {
        const nomme = f.nom.startsWith("puce-");
        const dep = nomme ? departPuce(p, i) : departPuce(p, p.puces.length - 1) + 4 + (i - p.puces.length) * 2;
        const q = ressort(image, dep, 230, 15);
        const coche = ressort(image, dep + 5, 240, 12);
        const b = f.boite;
        const t = texte(d, f.nom);
        return (
          <div key={f.nom} style={{ position: "absolute", left: 0, top: 0, opacity: borne(q * 3), transform: `scale(${0.9 + 0.1 * q})`, transformOrigin: `${b.x + b.largeur / 2}px ${b.y + b.hauteur / 2}px` }}>
            <div style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, borderRadius: 32, background: C.blanc, boxShadow: `0 12px 30px ${a(C.encre, 0.1)}` }} />
            {nomme && t ? <TexteL t={t} couleur={C.encre} accent={C.orange} /> : <div style={{ position: "absolute", left: b.x + b.largeur * 0.14, top: b.y + b.hauteur * 0.68, width: b.largeur * 0.45, height: 12, borderRadius: 6, background: a(C.gris, 0.4) }} />}
            <Coche x={nomme ? b.x + b.largeur - 70 : b.x + b.largeur * 0.68} y={nomme ? b.y + b.hauteur / 2 : b.y + b.hauteur * 0.32} r={nomme ? Math.min(44, b.hauteur * 0.36) : b.largeur * 0.2} echelle={coche} trace={coche} ombre={false} />
          </div>
        );
      })}
    </>
  );
}

export function PreCasesCochees({ p, d }: { p: P<"preuve">; d: ReturnType<typeof dispoPreCasesCochees> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  return (
    <>
      <EnTete p={p} d={d} image={image} />
      {d.formes.map((f, i) => {
        const q = ressort(image, departPuce(p, i), 210, 15);
        const b = f.boite;
        return (
          <div key={f.nom} style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - q) * 200}px)`, opacity: borne(q * 3) }}>
            <div style={{ position: "absolute", left: b.x, top: b.y, width: b.largeur, height: b.hauteur, boxSizing: "border-box", borderRadius: 40, background: C.blanc, border: `6px solid ${p.fond === "sombre" ? C.blanc : C.encre}` }} />
            <TexteL t={texte(d, f.nom)!} couleur={C.encre} accent={k.accent === C.orangeVif ? C.orange : k.accent} />
            <Coche x={b.x + b.largeur - b.hauteur * 0.5} y={b.y + b.hauteur / 2} r={b.hauteur * 0.24} echelle={ressort(image, departPuce(p, i) + 8, 240, 12)} />
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Chiffre                                                               */
/* ------------------------------------------------------------------ */

const departPastille = (p: P<"chiffre">, i: number) => img(p, `pastille-${i + 1}`, 1 + i * 0.2);

export function ChiAplatOrange({ p, d }: { p: P<"chiffre">; d: ReturnType<typeof dispoChiAplatOrange> }) {
  const image = useImage();
  const v = ressort(image, 3, 170, 12);
  const nb = texte(d, "nombre")!;
  const un = texte(d, "unite")!;
  const qu = ressort(image, Math.max(6, img(p, "unite", 0.3)), 190, 14);
  const cad = d.cadran;
  const quart = doux(image, 16, 24);
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${1.25 - 0.25 * v})`, transformOrigin: `${nb.boite.x}px ${nb.boite.y}px`, opacity: borne(v * 4) }}>
        <TexteL t={nb} couleur={C.encre} accent={C.ivoire} />
      </div>
      <TexteL t={un} couleur={C.encre} accent={C.ivoire} style={entree(qu, 50)} />
      {cad ? (
        <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
          {(() => {
            const r = cad.largeur / 2;
            const cx = cad.x + r;
            const cy = cad.y + r;
            return (
              <>
                <circle cx={cx} cy={cy} r={r} fill={C.encre} />
                {quart > 0.01 ? <path d={arc(cx, cy, (r - 18) / 2, 0, 360 * d.part * quart)} fill="none" stroke={C.orangeVif} strokeWidth={r - 18} /> : null}
                {Array.from({ length: 12 }, (_, i) => {
                  const [x0, y0] = pt(cx, cy, r - 14, i * 30);
                  const [x1, y1] = pt(cx, cy, r - (i % 3 ? 34 : 50), i * 30);
                  return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={C.ivoire} strokeWidth={i % 3 ? 4 : 8} strokeLinecap="round" />;
                })}
                <line x1={cx} y1={cy} x2={pt(cx, cy, r - 40, 360 * d.part * quart)[0]} y2={pt(cx, cy, r - 40, 360 * d.part * quart)[1]} stroke={C.ivoire} strokeWidth={12} strokeLinecap="round" />
                <circle cx={cx} cy={cy} r={16} fill={C.ivoire} />
              </>
            );
          })()}
        </svg>
      ) : null}
      <Pilules formes={d.formes} textes={d.textes} nom="pastille" image={image} debut={(i) => departPastille(p, i)} fond={C.encre} couleurTexte={C.ivoire} coche={false} />
    </>
  );
}

export function ChiJaugeAnneau({ p, d }: { p: P<"chiffre">; d: ReturnType<typeof dispoChiJaugeAnneau> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const { cx, cy, r, ep } = d;
  const q = doux(image, 4, 26);
  const fin = 360 * Math.min(1, d.part) * q;
  const centre = ressort(image, 10);
  const nb = texte(d, "nombre")!;
  // Le nombre compte jusqu'à la valeur de l'écran (entiers seulement ; sinon il arrive tel quel).
  const compte = Number.isInteger(p.nombre) ? { ...nb, lignes: [ecrireNombre(Math.round(p.nombre * q))] } : nb;
  return (
    <>
      <svg width={p.largeur} height={p.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={k.piste} strokeWidth={ep} />
        {fin > 0.5 ? <path d={arc(cx, cy, r, 0, fin)} fill="none" stroke={k.accent} strokeWidth={ep} strokeLinecap="round" /> : null}
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${0.7 + 0.3 * centre})`, transformOrigin: `${cx}px ${cy}px`, opacity: borne(centre * 3) }}>
        <TexteL t={compte} couleur={k.accent} accent={k.accent} />
        <TexteL t={texte(d, "unite")!} couleur={k.texte} accent={k.accent} style={{ opacity: prog(image, img(p, "unite", 0.3), 6) }} />
      </div>
      <Pilules formes={d.formes} textes={d.textes} nom="pastille" image={image} debut={(i) => departPastille(p, i)} fond={p.fond === "sombre" ? C.blanc : C.encre} couleurTexte={p.fond === "sombre" ? C.encre : C.ivoire} coche={false} />
    </>
  );
}

export function ChiCompterObjets({ p, d }: { p: P<"chiffre">; d: ReturnType<typeof dispoChiCompterObjets> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const n = Math.round(prog(image, 6, Math.min(50, 10 + d.n)) * d.n);
  const nb = texte(d, "nombre")!;
  const g = d.grille;
  return (
    <>
      <TexteL t={{ ...nb, lignes: [ecrireNombre(n)] }} couleur={k.accent} accent={k.accent} />
      <TexteL t={texte(d, "unite")!} couleur={k.texte} accent={k.accent} style={{ opacity: prog(image, img(p, "unite", 0.3), 6) }} />
      {Array.from({ length: d.n }, (_, i) => {
        const on = i < n;
        const rr = Math.floor(i / d.colonnes);
        const q = i % d.colonnes;
        return <div key={i} style={{ position: "absolute", left: g.x + q * (d.cote + d.ecart), top: g.y + rr * (d.cote + d.ecart), width: d.cote, height: d.cote, borderRadius: d.cote * 0.24, background: on ? k.accent : k.piste, transform: `scale(${on && n < d.n && i === n - 1 ? 1.15 : 1})` }} />;
      })}
      <Pilules formes={d.formes} textes={d.textes} nom="pastille" image={image} debut={(i) => departPastille(p, i)} fond={p.fond === "sombre" ? C.blanc : C.encre} couleurTexte={p.fond === "sombre" ? C.encre : C.ivoire} coche={false} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Question                                                              */
/* ------------------------------------------------------------------ */

const departLigneQ = (p: P<"question">, i: number) => img(p, `titre-${i + 1}`, i === 0 ? 0.02 : 0.35);

export function QueGeante({ p, d }: { p: P<"question">; d: ReturnType<typeof dispoQueGeante> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const g = d.geant;
  const q = ressort(image, 6, 140, 9);
  const bascule = Math.sin((image - 6) / 6) * 6 * Math.exp(-(image - 6) / 20) * borne(image - 6);
  return (
    <>
      <div style={{ position: "absolute", left: g.x, top: g.y, width: g.largeur, height: g.hauteur, fontFamily: FAMILLE_ANTON, fontSize: g.hauteur * 1.08, lineHeight: 0.8, color: k.accent, textAlign: "center", transform: `scale(${q}) rotate(${10 + bascule}deg)`, transformOrigin: "50% 90%", opacity: 0.95 }}>?</div>
      {d.textes
        .filter((t) => t.nom.startsWith("titre-"))
        .map((t, i) => (
          <TexteL key={t.nom} t={t} couleur={k.texte} accent={k.accent} style={{ transform: `translateX(${(1 - ressort(image, departLigneQ(p, i), 200, 17)) * -800}px)` }} />
        ))}
      <TexteL t={texte(d, "question")!} couleur={k.texte} accent={k.accent} style={entree(ressort(image, img(p, "question", 1)), 40)} />
    </>
  );
}

export function QueChampReponse({ p, d }: { p: P<"question">; d: ReturnType<typeof dispoQueChampReponse> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const ch = d.champ;
  const champ = ressort(image, Math.max(10, img(p, "question", 1)), 190, 14);
  const av = d.avatar;
  return (
    <>
      {d.textes
        .filter((t) => t.nom.startsWith("titre-"))
        .map((t, i) => {
          const dep = departLigneQ(p, i);
          const filet = doux(image, dep + 5, 14);
          const f = d.formes.find((x) => x.nom === `filet-${i + 1}`)!.boite;
          return (
            <React.Fragment key={t.nom}>
              <TexteL t={t} couleur={k.texte} accent={k.accent} style={{ transform: `translateX(${(1 - ressort(image, dep, 190, 17)) * -1100}px)` }} />
              <div style={{ position: "absolute", left: f.x, top: f.y, width: f.largeur * filet, height: f.hauteur, background: k.trait, borderRadius: 3 }} />
            </React.Fragment>
          );
        })}
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - champ) * 300}px)`, opacity: borne(champ * 3) }}>
        <div style={{ position: "absolute", left: ch.x, top: ch.y, width: ch.largeur, height: ch.hauteur, boxSizing: "border-box", borderRadius: 48, background: C.blanc, border: `6px solid ${C.encre}`, boxShadow: `0 24px 50px ${a(C.encre, 0.12)}` }} />
        <div style={{ position: "absolute", left: ch.x + 44, top: ch.y + (ch.hauteur - av) / 2, width: av, height: av, borderRadius: av / 2, background: C.encre }} />
        <TexteL t={texte(d, "question")!} couleur={a(C.encre, 0.55)} accent={C.orange} />
        <div style={{ position: "absolute", left: ch.x + ch.largeur - av * 0.8 - 44, top: ch.y + (ch.hauteur - av * 0.8) / 2, width: av * 0.8, height: av * 0.8, borderRadius: "50%", background: C.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom="envoyer" taille={av * 0.4} couleur={C.blanc} />
        </div>
        <div style={{ position: "absolute", left: ch.x + ch.largeur - av * 0.8 - 70, top: ch.y + ch.hauteur / 2 - 40, width: 8, height: 80, borderRadius: 4, background: C.orange, opacity: Math.floor(image / 7) % 2 ? 1 : 0 }} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Résultat                                                              */
/* ------------------------------------------------------------------ */

export function ResCoupeDeux({ p, d }: { p: P<"resultat">; d: ReturnType<typeof dispoResCoupeDeux> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const haut = couleurs(p.fond === "sombre" ? "ivoire" : "sombre");
  const dep = Math.max(10, img(p, "barre-maintenant", 0.6));
  const coupe = ressort(image, dep, 150, 15);
  // La coupure monte du haut de la bande des sous-titres jusque sous « avant » (un peu en biais, comme une feuille posée) :
  // la bande des sous-titres est TOUJOURS sur le fond de l'écran (les sous-titres en prennent la couleur).
  const depart = p.zone.y + p.zone.hauteur - 20;
  const y = depart - (depart - d.coupe) * coupe;
  const bas = ressort(image, dep + 10);
  const carte = d.formes[0]!.boite;
  const et = texte(d, "etiquette");
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: haut.fond }} />
      {et ? <TexteL t={et} couleur={haut.accent} accent={haut.accent} /> : null}
      <div style={{ position: "absolute", left: 0, top: 0, opacity: borne(ressort(image, 0) * 3) }}>
        <TexteL t={texte(d, "etiquette-avant")!} couleur={haut.secondaire} accent={haut.accent} />
        <div style={{ position: "absolute", left: carte.x, top: carte.y, width: carte.largeur, height: carte.hauteur, borderRadius: 20, background: C.blanc, boxShadow: `0 10px 30px ${a(C.nuit, 0.25)}` }}>
          <div style={{ margin: carte.largeur * 0.08, height: carte.hauteur * 0.4, borderRadius: 12, background: `linear-gradient(135deg, ${C.grisClair}, ${a(C.orange, 0.55)})` }} />
        </div>
        <TexteL t={texte(d, "avant")!} couleur={haut.texte} accent={haut.accent} />
      </div>
      <div style={{ position: "absolute", left: -120, top: y, width: p.largeur + 240, height: p.hauteur, background: k.fond, transform: "rotate(-3deg)", transformOrigin: "50% 0", boxShadow: `0 -30px 60px ${a(C.nuit, 0.35)}` }} />
      <div style={{ position: "absolute", left: 0, top: 0, opacity: borne(bas * 3), transform: `translateY(${(1 - bas) * 60}px)` }}>
        <TexteL t={texte(d, "etiquette-maintenant")!} couleur={k.accent} accent={k.accent} />
        <TexteL t={texte(d, "maintenant")!} couleur={k.accent} accent={k.accent} />
        <TexteL t={texte(d, "titre")!} couleur={k.texte} accent={k.accent} />
        <TexteL t={texte(d, "ligne")!} couleur={k.secondaire} accent={k.accent} style={{ opacity: prog(image, img(p, "ligne", 1.2), 8) }} />
      </div>
    </>
  );
}

export function ResMoisRempli({ p, d }: { p: P<"resultat">; d: ReturnType<typeof dispoResMoisRempli> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const g = d.grille;
  const c = d.cote;
  const e = d.ecart;
  const jours = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <>
      <EnTete p={p} d={d} image={image} />
      {jours.map((j, i) => (
        <div key={i} style={{ position: "absolute", left: g.x + i * (c + e), width: c, top: g.y - 46, textAlign: "center", fontFamily: FAMILLE_TITRE, fontWeight: 700, fontSize: 30, color: k.secondaire }}>{j}</div>
      ))}
      {Array.from({ length: 30 }, (_, i) => {
        const q = (i + 2) % 7;
        const rr = Math.floor((i + 2) / 7);
        const v = ressort(image, 8 + i * 1.4, 240, 14);
        const plein = v > 0.5;
        return (
          <div key={i} style={{ position: "absolute", left: g.x + q * (c + e), top: g.y + rr * (c + e), width: c, height: c, boxSizing: "border-box", borderRadius: c * 0.2, background: plein ? C.blanc : "transparent", border: `4px solid ${plein ? C.encre : a(k.trait, 0.15)}` }}>
            <div style={{ position: "absolute", left: c * 0.12, top: c * 0.06, fontFamily: FAMILLE_TITRE, fontWeight: 700, fontSize: c * 0.26, color: plein ? C.encre : k.secondaire }}>{i + 1}</div>
            <Coche x={c - c * 0.29} y={c - c * 0.29} r={c * 0.2} echelle={v} ombre={false} />
          </div>
        );
      })}
      <Pilules formes={d.formes} textes={d.textes} nom="valeur" image={image} debut={(i) => (i ? img(p, "barre-maintenant", 1) : 6)} fond={p.fond === "sombre" ? C.blanc : C.encre} couleurTexte={p.fond === "sombre" ? C.encre : C.ivoire} coche={false} />
      <TexteL t={texte(d, "ligne")!} couleur={k.secondaire} accent={k.accent} style={{ opacity: prog(image, img(p, "ligne", 1.2), 8) }} />
    </>
  );
}
