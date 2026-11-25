/**
 * Mise en page de la vidéo longue (QUALL-3) sur le story-board d'essai, toutes les 250 ms : rien dans la bande des
 * sous-titres, rien hors zone, tailles au moins égales aux planchers, textes dans leur carte, couleurs du contrat,
 * orange seulement sur noir, aucun recouvrement hors « dans », mouvement réel.
 */
import { describe, expect, it } from "vitest";
import { PROPRIETES_EXEMPLE_LONGUE } from "../../../studio-rendu/compositions/plan-scenes/longue/exemple";
import { chiffreCompte, formeChapitre, poserScene, poserSousTitre, sceneAvecBande } from "../../../src/moteurs/montage-video-longue/mise-en-page";
import { COULEURS_LONGUE, TAILLES_LONGUE, ZONES_LONGUE, type ElementPose, type FormeLongue, type Rect, type SceneLongue } from "../../../src/moteurs/montage-video-longue/storyboard-types";

const sb = PROPRIETES_EXEMPLE_LONGUE.storyboard;
const dedans = (r: Rect, z: Rect) => r.x >= z.x - 0.5 && r.y >= z.y - 0.5 && r.x + r.largeur <= z.x + z.largeur + 0.5 && r.y + r.hauteur <= z.y + z.hauteur + 0.5;
const recouvre = (a: Rect, b: Rect) => a.x < b.x + b.largeur - 1 && b.x < a.x + a.largeur - 1 && a.y < b.y + b.hauteur - 1 && b.y < a.y + a.hauteur - 1;
const zoneDe = (s: SceneLongue): Rect => (sceneAvecBande(s.type) ? ZONES_LONGUE.scene : ZONES_LONGUE.plein);

/** Chaîne des conteneurs d'un élément (un trait « dans » un texte « dans » une carte est aussi dans la carte). */
function ancetres(e: ElementPose, tous: ElementPose[]): Set<string> {
  const r = new Set<string>();
  let c: ElementPose | undefined = e;
  while (c?.dans && !r.has(c.dans)) {
    r.add(c.dans);
    c = tous.find((x) => x.id === c!.dans);
  }
  return r;
}

const echantillons: { s: SceneLongue; t: number; els: ElementPose[] }[] = [];
for (const s of sb.scenes) for (let t = s.debutMs; t < s.finMs; t += 250) echantillons.push({ s, t, els: poserScene(s, t) });

describe("mise en page de la vidéo longue", () => {
  it("l'essai contient les huit formes et tous les types de scène", () => {
    const formes = new Set<FormeLongue>();
    for (const s of sb.scenes) if (s.type === "phrase-cle") formes.add(s.forme);
    expect(formes.size).toBe(8);
    expect(new Set(sb.scenes.map((s) => s.type)).size).toBe(8);
  });

  it("rien dans la bande des sous-titres et tout dans la zone de la scène", () => {
    for (const { s, t, els } of echantillons) {
      for (const e of els) {
        expect(dedans(e.rect, zoneDe(s)), `${e.id} à ${t} ms : ${JSON.stringify(e.rect)}`).toBe(true);
        if (sceneAvecBande(s.type)) expect(e.rect.y + e.rect.hauteur, `${e.id} à ${t} ms`).toBeLessThanOrEqual(ZONES_LONGUE.bandeSousTitres.y);
      }
    }
  });

  it("tailles au moins égales aux planchers", () => {
    for (const { t, els } of echantillons) {
      for (const e of els) {
        if (e.nature !== "texte") continue;
        const min = e.role === "etiquette" ? TAILLES_LONGUE.etiquetteMinPx : TAILLES_LONGUE.texteMinPx;
        expect(e.taillePx, `${e.id} à ${t} ms`).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it("deux éléments ne se recouvrent que si l'un est dans l'autre", () => {
    for (const { t, els } of echantillons) {
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const a = els[i];
          const b = els[j];
          if (a.opacite <= 0 || b.opacite <= 0) continue;
          // Le halo est un filet qui pulse DANS sa carte : il recouvre exprès ce que la carte contient.
          if (/:(halo|orbite|curseur|reflet)$/.test(a.id) || /:(halo|orbite|curseur|reflet)$/.test(b.id)) continue;
          if (ancetres(a, els).has(b.id) || ancetres(b, els).has(a.id)) continue;
          expect(recouvre(a.rect, b.rect), `${a.id} / ${b.id} à ${t} ms`).toBe(false);
        }
      }
    }
  });

  it("un élément « dans » reste dans son conteneur", () => {
    for (const { t, els } of echantillons) {
      for (const e of els) {
        if (!e.dans) continue;
        const parent = els.find((x) => x.id === e.dans);
        if (!parent || e.id.endsWith(":onde") || e.id.endsWith(":orbite") || e.id.endsWith(":curseur") || e.id.endsWith(":reflet") || e.nature === "trait") continue;
        expect(dedans(e.rect, parent.rect), `${e.id} dans ${parent.id} à ${t} ms`).toBe(true);
      }
    }
  });

  it("couleurs du contrat, orange et gris sur noir seulement, texte jamais terracotta sur noir", () => {
    const permises = Object.keys(COULEURS_LONGUE);
    for (const { s, els } of echantillons) {
      for (const e of els) {
        for (const c of [e.couleur, e.couleurAccent, e.fond, e.bordure]) {
          if (!c) continue;
          expect(permises).toContain(c);
          if (s.fond === "ivoire") expect(["orange", "grisSurNoir"]).not.toContain(c);
        }
        if (s.fond === "noir" && e.nature === "texte") expect(e.couleur).not.toBe("terracotta");
      }
    }
  });

  it("chaque scène a du contenu visible à chaque échantillon après la transition", () => {
    for (const { s, t, els } of echantillons) {
      if (t - s.debutMs < 700) continue;
      expect(els.some((e) => e.role === "contenu" && e.opacite >= 0.5), `${s.id} à ${t} ms`).toBe(true);
    }
  });

  it("il y a du mouvement continu dans la scène", () => {
    for (const s of sb.scenes) {
      if (s.finMs - s.debutMs < 4000 || s.type === "carton-titre") continue;
      const a = JSON.stringify(poserScene(s, s.finMs - 1500));
      const b = JSON.stringify(poserScene(s, s.finMs - 900));
      expect(a, s.id).not.toBe(b);
    }
  });

  it("deux images à 300 ms d'écart ne sont jamais identiques, dans aucune scène", () => {
    for (const s of sb.scenes) {
      for (let t = s.debutMs; t + 300 < s.finMs; t += 100) {
        expect(JSON.stringify(poserScene(s, t)), `${s.id} à ${t} ms`).not.toBe(JSON.stringify(poserScene(s, t + 300)));
      }
    }
  });

  it("aucune case fantôme : une carte n'est posée qu'une fois son texte apparu", () => {
    for (const { s, t, els } of echantillons) {
      if (s.type !== "liste" && s.type !== "etapes") continue;
      for (const e of els) {
        const m = /^(.*):(?:carte|tuile)(\d+)$/.exec(e.id);
        if (!m) continue;
        const texte = els.find((x) => x.id === `${m[1]}:texte${m[2]}`);
        expect(texte, `${e.id} à ${t} ms : carte sans texte`).toBeDefined();
        expect(texte!.opacite, `${e.id} à ${t} ms`).toBeGreaterThan(0);
      }
    }
  });

  it("liste avec compte : trois tuiles côte à côte avec icône et libellé, sans chiffre inventé", () => {
    const l = sb.scenes.find((s) => s.type === "liste")!;
    const els = poserScene(l, l.finMs - 100);
    const tuiles = els.filter((e) => /:tuile\d$/.test(e.id));
    expect(tuiles).toHaveLength(3);
    expect(Math.max(...tuiles.map((e) => e.rect.y)) - Math.min(...tuiles.map((e) => e.rect.y))).toBeLessThanOrEqual(14);
    expect(els.filter((e) => /:icone\d$/.test(e.id))).toHaveLength(3);
    expect(new Set(els.filter((e) => /:icone\d$/.test(e.id)).map((e) => e.forme)).size).toBe(3);
    const nombres = els.filter((e) => e.nature === "texte").flatMap((e) => (e.lignes ?? []).flat().map((m) => m.texte)).filter((x) => /\d/.test(x));
    expect(nombres).toEqual(["3"]);
  });

  it("chiffre : le compteur part à +300 ms et atteint la valeur en 900 ms ; blocs exacts pour un entier de 2 à 24", () => {
    const c = sb.scenes.find((s) => s.type === "chiffre" && s.chiffres.length === 1 && s.chiffres[0].valeur === 12)!;
    if (c.type !== "chiffre") throw new Error("type");
    const val = (t: number) => poserScene(c, t).find((e) => e.id.endsWith(":nombre"))!.lignes![0][0].texte;
    expect(Number(val(c.debutMs + 700))).toBeGreaterThan(0);
    expect(val(c.debutMs + 1200)).toBe("12");
    const blocs = (t: number) => poserScene(c, t).filter((e) => /:bloc\d+-plein$/.test(e.id)).length;
    expect(poserScene(c, c.finMs - 500).filter((e) => /:bloc\d+$/.test(e.id))).toHaveLength(12);
    expect(blocs(c.finMs - 500)).toBe(12);
    expect(blocs(c.debutMs + 500)).toBeLessThan(12);
  });

  it("cartons de chapitre : une icône différente par chapitre", () => {
    const formes = sb.scenes.filter((s) => s.type === "carton-chapitre").map((s) => (s.type === "carton-chapitre" ? formeChapitre(s.titre, s.rang) : ""));
    expect(new Set(formes).size).toBe(formes.length);
    expect(formeChapitre("Un titre sans mot repère", 2)).not.toBe(formeChapitre("Un titre sans mot repère", 3));
  });

  it("avant/après : texte « avant » noir sur carte claire", () => {
    const a = sb.scenes.find((s) => s.type === "avant-apres")!;
    const els = poserScene(a, a.finMs - 200);
    expect(els.find((e) => e.id.endsWith(":texteA"))!.couleur).toBe("noir");
    expect(els.find((e) => e.id.endsWith(":avant"))!.fond).toBe("gris");
  });

  it("fin : le bouton est visible dès +600 ms et le reste, tout dans la zone", () => {
    const f = sb.scenes.find((s) => s.type === "fin")!;
    for (let tl = 600; tl < f.finMs - f.debutMs; tl += 100) {
      const els = poserScene(f, f.debutMs + tl);
      expect(els.find((e) => e.id.endsWith(":bouton"))!.opacite, `bouton à +${tl} ms`).toBe(1);
      for (const e of els) expect(dedans(e.rect, ZONES_LONGUE.plein), e.id).toBe(true);
    }
  });

  it("listes, étapes, tuiles : tout le monde est entré avant +1,5 s (cascade), aucune case vide, grille fixe, tout dans la zone", () => {
    for (const s of sb.scenes) {
      if (s.type !== "etapes" && s.type !== "liste") continue;
      const n = s.elements.length;
      const tot = poserScene(s, s.debutMs + 1500);
      const fin = poserScene(s, s.finMs - 100);
      const cartes = tot.filter((e) => /:(carte|tuile)\d$/.test(e.id));
      expect(cartes, s.id).toHaveLength(n);
      expect(tot.filter((e) => /:texte\d$/.test(e.id) && e.opacite > 0.5), s.id).toHaveLength(n);
      for (const e of tot) expect(dedans(e.rect, zoneDe(s)), `${e.id} à +1,5 s`).toBe(true);
      for (const c of cartes) {
        const f = fin.find((e) => e.id === c.id)!;
        expect(Math.abs(f.rect.y - c.rect.y), `${c.id}`).toBeLessThanOrEqual(16);
      }
      expect(tot.some((e) => /:(fili|ghost)/.test(e.id)), "plus de numéro estompé").toBe(false);
    }
  });
  it("listes et étapes : l'élément lu a un bord terracotta, les autres sont calmes (texte ≤ 75 %)", () => {
    const e = sb.scenes.find((x) => x.type === "etapes")!;
    if (e.type !== "etapes") throw new Error("type");
    const t = e.elements[2].apparitionMs + 800;
    const els = poserScene(e, t);
    const cartes = els.filter((x) => /:carte\d$/.test(x.id));
    const actives = cartes.filter((x) => x.bordure === "terracotta");
    expect(actives).toHaveLength(1);
    expect(actives[0].id).toBe(`${e.id}:carte2`);
    for (const x of els.filter((y) => /:texte\d$/.test(y.id) && y.id !== `${e.id}:texte2`)) expect(x.opacite).toBeLessThanOrEqual(0.75);
  });

  it("est pure : mêmes entrées, mêmes éléments", () => {
    const s = sb.scenes[9];
    expect(poserScene(s, 45000)).toEqual(poserScene(s, 45000));
  });

  it("le texte des éléments vient du story-board (les accents sont dans leur texte)", () => {
    const liste = sb.scenes.find((s) => s.type === "liste")!;
    const els = poserScene(liste, liste.finMs - 100);
    const textes = els.filter((e) => e.nature === "texte").map((e) => (e.lignes ?? []).map((l) => l.map((m) => m.texte).join("")).join(" "));
    expect(textes.join(" ")).toContain("la valeur du stock");
    expect(els.some((e) => e.id.endsWith(":compte") && e.lignes?.[0][0].texte === "3")).toBe(true);
  });
});

describe("sous-titres", () => {
  it("posés dans la zone du texte, 46 px, deux lignes au plus", () => {
    for (const l of sb.sousTitres) {
      const e = poserSousTitre(l, (l.debutMs + l.finMs) / 2);
      expect(e).not.toBeNull();
      expect(dedans(e!.rect, ZONES_LONGUE.texteSousTitres)).toBe(true);
      expect(e!.taillePx).toBeGreaterThanOrEqual(TAILLES_LONGUE.texteMinPx);
      expect(e!.lignes!.length, l.texte).toBeLessThanOrEqual(TAILLES_LONGUE.sousTitreLignesMax);
    }
  });
  it("absents hors de leur durée", () => {
    const l = sb.sousTitres[0];
    expect(poserSousTitre(l, l.debutMs - 1)).toBeNull();
    expect(poserSousTitre(l, l.finMs)).toBeNull();
  });
});

describe("compteur", () => {
  it("garde séparateurs et décimales, et finit sur le texte exact", () => {
    expect(chiffreCompte("1 200", 1200, 0.5)).toBe("600");
    expect(chiffreCompte("12,5 %", 12.5, 0.4)).toBe("5,0 %");
    expect(chiffreCompte("12,5 %", 12.5, 1)).toBe("12,5 %");
    expect(chiffreCompte("12", 12, 0)).toBe("0");
  });
});
