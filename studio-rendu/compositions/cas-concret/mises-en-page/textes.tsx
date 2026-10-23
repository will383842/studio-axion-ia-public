import React from "react";
/**
 * L6 · ACCROCHE et TITRE (maquettes CC-ACC-A/B/C, CC-TIT-A/B de #308), dessinés depuis leur disposition : les lignes
 * sont celles de l'écran, les cartes et pages sont muettes (aucun texte inventé). Départs calés sur la voix
 * (`titre-2`, `titre-3`…) comme la v4.
 */
import { AbsoluteFill } from "remotion";
import type { ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { FAMILLE_ANTON } from "../../commune/polices";
import type { dispoAccDetailRecul, dispoAccDuelTailles, dispoAccPageEcrite, dispoTitLignesMagazine, dispoTitMotObjet } from "./dispositions";
import { a, C, couleurs, type TexteL6 } from "./geo";
import { borne, CarteMuette, Coche, doux, entree, img, Lignes, prog, ressort, TexteL, useImage } from "./kit";

type P<T extends ProprietesEcran["type"]> = Extract<ProprietesEcran, { type: T }>;
const texte = (d: { textes: TexteL6[] }, nom: string) => d.textes.find((t) => t.nom === nom)!;

/** Départ (image) de la ligne i d'une accroche ou d'un titre : l'événement `titre-<i+1>` de la voix. */
const departLigne = (p: P<"accroche" | "titre" | "question">, i: number) => img(p, `titre-${i + 1}`, i === 0 ? 0.02 : 0.25 + 0.3 * i);

export function AccDetailRecul({ p, d }: { p: P<"accroche">; d: ReturnType<typeof dispoAccDetailRecul> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const cartes = d.formes.filter((f) => f.nom.startsWith("carte-"));
  // Carte de départ : 2ᵉ colonne, 2ᵉ rangée ; la caméra recule et découvre toutes les autres.
  const depart = cartes.find((f) => f.nom === "carte-1-1") ?? cartes[0]!;
  const cx = depart.boite.x + depart.boite.largeur / 2;
  const cy = depart.boite.y + depart.boite.hauteur / 2;
  const recul = doux(image, 12, 22);
  const s = 3.2 - 2.2 * recul;
  const lignes = texte(d, "lignes");
  const et = d.textes.find((t) => t.nom === "etiquette");
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${(p.largeur / 2 - cx) * (1 - recul)}px, ${(p.hauteur * 0.5 - cy) * (1 - recul)}px) scale(${s})`, transformOrigin: `${cx}px ${cy}px` }}>
        {cartes.map((f) => {
          const [r, q] = f.nom.slice(6).split("-").map(Number) as [number, number];
          const centre = f === depart;
          const dist = Math.hypot(q - 1, r - 1);
          const v = centre ? 1 : ressort(image, 18 + dist * 3, 200, 16);
          return <CarteMuette key={f.nom} x={f.boite.x} y={f.boite.y} l={f.boite.largeur} h={f.boite.hauteur} coche={centre ? ressort(image, 3, 220, 12) : ressort(image, 26 + dist * 3, 220, 14)} style={{ opacity: borne(v * 2), transform: `scale(${0.8 + 0.2 * v})` }} />;
        })}
      </div>
      {et ? <TexteL t={et} couleur={k.accent} accent={k.accent} style={{ opacity: prog(image, 0, 6) }} /> : null}
      <TexteL t={lignes} couleur={k.texte} accent={k.accent} ligne={(i) => entree(ressort(image, Math.max(departLigne(p, i), 8 + i * 4)), 80)} />
    </>
  );
}

export function AccPageEcrite({ p, d }: { p: P<"accroche">; d: ReturnType<typeof dispoAccPageEcrite> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const page = d.page;
  const montee = ressort(image, 4, 150, 14);
  const n = Math.max(4, Math.floor((page.hauteur - 260) / 42));
  const lignes = prog(image, 12, Math.max(30, n * 4)) * n;
  const fini = lignes >= n;
  const lt = texte(d, "lignes");
  const et = d.textes.find((t) => t.nom === "etiquette");
  const pad = Math.min(64, page.largeur * 0.08);
  return (
    <>
      {et ? <TexteL t={et} couleur={k.accent} accent={k.accent} style={{ opacity: prog(image, 0, 6) }} /> : null}
      <TexteL t={lt} couleur={k.texte} accent={k.accent} ligne={(i) => entree(ressort(image, departLigne(p, i)), 70)} />
      <div style={{ position: "absolute", left: page.x, top: page.y, width: page.largeur, height: page.hauteur, borderRadius: 48, background: C.blanc, padding: pad, boxSizing: "border-box", overflow: "hidden", transform: `translateY(${(1 - montee) * 220}px) rotate(${-3 + 3 * (1 - montee)}deg)`, boxShadow: `0 40px 90px ${a(C.nuit, p.fond === "sombre" ? 0.45 : 0.16)}` }}>
        <div style={{ width: "62%", height: 34, borderRadius: 17, background: C.encre }} />
        <div style={{ marginTop: 22, width: "44%", height: 34, borderRadius: 17, background: C.encre }} />
        <div style={{ marginTop: 48 }}>
          <Lignes n={n} largeur={page.largeur - 2 * pad} epaisseur={20} ecart={22} couleur={a(C.gris, 0.5)} visibles={lignes} />
        </div>
        {/* Curseur orange au bout de la ligne en cours. */}
        {!fini ? <div style={{ position: "absolute", left: pad + (page.largeur - 2 * pad) * 0.9 * borne(lignes % 1) - 4, top: pad + 34 + 22 + 34 + 48 + Math.floor(lignes) * 42 - 8, width: 8, height: 36, borderRadius: 4, background: C.orangeVif, opacity: Math.floor(image / 6) % 2 ? 1 : 0.35 }} /> : null}
      </div>
      {fini ? <Coche x={page.x + page.largeur - 40} y={page.y + page.hauteur - 40} r={60} echelle={ressort(image, 12 + Math.max(30, n * 4), 220, 12)} /> : null}
    </>
  );
}

export function AccDuelTailles({ p, d }: { p: P<"accroche">; d: ReturnType<typeof dispoAccDuelTailles> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const petit = ressort(image, 2);
  const grand = ressort(image, Math.max(14, img(p, "titre-2", 0.6)), 150, 13);
  const cadreP = d.formes.find((f) => f.nom === "cadre-petit")!.boite;
  const et = d.textes.find((t) => t.nom === "etiquette");
  const geant = texte(d, "geant");
  return (
    <>
      {et ? <TexteL t={et} couleur={k.accent} accent={k.accent} style={{ opacity: prog(image, 0, 6) }} /> : null}
      <div style={{ position: "absolute", left: 0, top: 0, ...entree(petit, 40) }}>
        <div style={{ position: "absolute", left: cadreP.x, top: cadreP.y, width: cadreP.largeur, height: cadreP.hauteur, boxSizing: "border-box", border: `5px solid ${k.trait}`, borderRadius: 24 }} />
        <TexteL t={texte(d, "petit")} couleur={k.texte} accent={k.accent} />
      </div>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${0.4 + 0.6 * grand})`, transformOrigin: `${p.largeur / 2}px ${geant.boite.y + geant.boite.hauteur * 0.6}px`, opacity: borne(grand * 4) }}>
        <TexteL t={texte(d, "ligne-du-nombre")} couleur={k.accent} accent={k.accent} />
        <TexteL t={geant} couleur={k.accent} accent={k.accent} style={{ letterSpacing: "-0.01em" }} />
      </div>
    </>
  );
}

export function TitLignesMagazine({ p, d }: { p: P<"titre">; d: ReturnType<typeof dispoTitLignesMagazine> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const lignes = d.textes;
  const cartes = d.formes.filter((f) => f.nom.startsWith("carte-"));
  const finTitre = departLigne(p, lignes.length - 1) + 10;
  return (
    <>
      {lignes.map((t, i) => {
        const dep = departLigne(p, i);
        const q = ressort(image, dep, 190, 17);
        const filet = doux(image, dep + 6, 14);
        const f = d.formes.find((x) => x.nom === `filet-${i + 1}`)!.boite;
        return (
          <React.Fragment key={t.nom}>
            <TexteL t={t} couleur={k.texte} accent={k.accent} style={{ transform: `translateX(${(1 - q) * -1100}px)` }} />
            <div style={{ position: "absolute", left: f.x, top: f.y, width: f.largeur * filet, height: f.hauteur, background: k.trait, borderRadius: 4 }} />
            {i === lignes.length - 1 ? <div style={{ position: "absolute", left: f.x + f.largeur * filet - 12, top: f.y - 9, width: 24, height: 24, borderRadius: 12, background: k.trait, opacity: filet > 0.98 ? 1 : 0 }} /> : null}
          </React.Fragment>
        );
      })}
      {cartes.map((f, i) => {
        const q = ressort(image, finTitre + i * 5, 200, 15);
        return <CarteMuette key={f.nom} x={f.boite.x} y={f.boite.y} l={f.boite.largeur} h={f.boite.hauteur} coche={i === cartes.length - 1 ? ressort(image, finTitre + 16, 220, 12) : undefined} style={{ transform: `translateY(${(1 - q) * 300}px) rotate(${(i - 1) * 5}deg)`, opacity: borne(q * 3) }} />;
      })}
    </>
  );
}

export function TitMotObjet({ p, d }: { p: P<"titre">; d: ReturnType<typeof dispoTitMotObjet> }) {
  const image = useImage();
  const k = couleurs(p.fond);
  const page = d.page;
  const tampon = d.tampon;
  const montee = ressort(image, 0, 160, 16);
  const dep = Math.max(14, departLigne(p, p.lignes.length - 1));
  const frappe = ressort(image, dep, 260, 13);
  const ondes = doux(image, dep + 4, 12);
  const haut = p.lignes.length > 1 ? texte(d, "titre-1") : null;
  const mot = texte(d, p.lignes.length > 1 ? "titre-2" : "titre-1");
  return (
    <>
      {haut ? <TexteL t={haut} couleur={k.texte} accent={k.accent} ligne={(i) => entree(ressort(image, 2 + i * 5), 50)} /> : null}
      <div style={{ position: "absolute", left: page.x, top: page.y, width: page.largeur, height: page.hauteur, borderRadius: 44, background: C.blanc, padding: 64, boxSizing: "border-box", overflow: "hidden", transform: `translateY(${(1 - montee) * 200}px) rotate(2deg) scale(${1 - 0.015 * Math.sin(Math.PI * borne(frappe))})`, boxShadow: `0 40px 100px ${a(C.nuit, p.fond === "sombre" ? 0.5 : 0.16)}` }}>
        <div style={{ width: "100%", height: page.hauteur * 0.3, borderRadius: 26, background: `linear-gradient(135deg, ${C.grisClair}, ${a(C.orange, 0.55)})` }} />
        <div style={{ marginTop: 40, width: "66%", height: 36, borderRadius: 18, background: C.encre }} />
        <div style={{ marginTop: 40 }}>
          <Lignes n={Math.max(3, Math.floor((page.hauteur * 0.55 - 140) / 42))} largeur={page.largeur - 128} epaisseur={20} ecart={22} couleur={a(C.gris, 0.45)} />
        </div>
      </div>
      {/* Onde de choc du tampon : deux anneaux qui s'écartent, une seule fois. */}
      {[0, 1].map((q) => (
        <div key={q} style={{ position: "absolute", left: tampon.x, top: tampon.y, width: tampon.largeur, height: tampon.hauteur, borderRadius: 40, border: `6px solid ${C.orangeVif}`, opacity: ondes > 0 && ondes < 1 ? (1 - ondes) * 0.6 : 0, transform: `rotate(-8deg) scale(${1 + ondes * (0.25 + q * 0.2)})` }} />
      ))}
      <div style={{ position: "absolute", left: 0, top: 0, width: p.largeur, height: p.hauteur, transform: `rotate(-8deg) scale(${2.2 - 1.2 * frappe})`, transformOrigin: `${tampon.x + tampon.largeur / 2}px ${tampon.y + tampon.hauteur / 2}px`, opacity: borne(frappe * 5) }}>
        <div style={{ position: "absolute", left: tampon.x, top: tampon.y, width: tampon.largeur, height: tampon.hauteur, boxSizing: "border-box", borderRadius: 40, border: `16px solid ${C.orangeVif}`, background: a(C.nuit, 0.92), boxShadow: `0 30px 60px ${a(C.nuit, 0.35)}` }} />
        <TexteL t={mot} couleur={C.orangeVif} accent={C.orangeVif} style={{ fontFamily: FAMILLE_ANTON }} />
      </div>
    </>
  );
}

export { AbsoluteFill };
