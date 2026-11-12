/**
 * Menu (18/10) : carrousels, infographies et vidéos sont trois familles distinctes. « Carrousels » est une entrée de premier
 * niveau, après « Mes vidéos » (et ses sous-entrées, qui sont les formats), avant « Calendrier ».
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NAV_LATERALE, TUILES_PLUS, ONGLETS_BAS, estActif, navigationLaterale, tuilesPlusMobile } from "../../src/components/coquille/navigation";
import { FiltresContenus, compterContenus, lienContenus, lireFiltresContenus } from "../../src/components/contenus/FiltresContenus";
import { GrilleContenus, adresseContenu, calculerVueContenus } from "../../src/components/contenus/GrilleContenus";
import { MOTS_INTERDITS_ECRAN } from "../../src/domaine/libelles";
import type { ContenuBibliotheque } from "../../src/domaine/filtres-contenus";

describe("menu : entrée Carrousels", () => {
  const menu = navigationLaterale([], true);
  const libelles = menu.map((e) => e.libelle);

  it("existe en premier niveau, vers /carrousels", () => {
    const e = menu.find((x) => x.libelle === "Carrousels");
    expect(e?.href).toBe("/carrousels");
  });

  it("est placée juste après « Mes vidéos » (section « Contenus », 08/11)", () => {
    const i = libelles.indexOf("Carrousels");
    expect(libelles[i - 1]).toBe("Mes vidéos");
  });

  it("n'est pas rangée sous « Mes vidéos » : « Mes vidéos » ne s'allume pas sur /carrousels et inversement", () => {
    const videos = NAV_LATERALE.find((e) => e.libelle === "Mes vidéos")!;
    const carrousels = NAV_LATERALE.find((e) => e.libelle === "Carrousels")!;
    expect(videos.actifSur ?? []).not.toContain("/carrousels");
    expect(estActif("/carrousels", videos)).toBe(false);
    expect(estActif("/carrousels", carrousels)).toBe(true);
    expect(estActif("/carrousels/nouveau", carrousels)).toBe(true);
    expect(estActif("/carrousels/abc", carrousels)).toBe(true);
    expect(estActif("/reglages/carrousels", carrousels)).toBe(false);
    expect(estActif("/videos", carrousels)).toBe(false);
  });

  it("pas d'entrée Infographies (le générateur n'existe pas encore)", () => {
    expect(libelles.some((l) => /infographie/i.test(l))).toBe(false);
  });

  it("mobile : dans la feuille « Plus », jamais mélangée aux onglets Vidéos", () => {
    expect(tuilesPlusMobile(false).some((t) => t.href === "/carrousels")).toBe(true);
    expect(TUILES_PLUS.filter((t) => t.href === "/carrousels")).toHaveLength(1);
    const videos = ONGLETS_BAS.find((o) => o.href === "/videos")!;
    expect(videos.actifSur ?? []).not.toContain("/carrousels");
  });
});

/** L2-09 : écran /contenus (D3-05). Données inventées ; aucun appel réel. */
const T = (n: number) => new Date(Date.parse("2026-11-01T10:00:00.000Z") + n * 60_000).toISOString();
const contenu = (id: string, type: ContenuBibliotheque["type"], reseaux: ContenuBibliotheque["reseaux"], n: number, extra: Partial<ContenuBibliotheque> = {}): ContenuBibliotheque => ({
  id, type, titre: `Titre ${id}`, statut: "pret", reseaux, modifieLe: T(n), ...extra,
});
const JEU: ContenuBibliotheque[] = [
  contenu("v1", "video", ["instagram", "tiktok"], 1),
  contenu("v2", "video", ["linkedin"], 2),
  contenu("c1", "carrousel", ["instagram"], 3),
  contenu("c2", "carrousel", [], 4, { statut: "brouillon" }),
  contenu("i1", "image", ["facebook"], 5),
];
const ids = (l: readonly ContenuBibliotheque[]) => l.map((c) => c.id);

describe("/contenus : lecture de l'adresse", () => {
  it("valeur inconnue, vide ou mal formée : ignorée ; les trois types et le réseau « non précisé » sont connus", () => {
    expect(lireFiltresContenus({})).toEqual({ page: 1 });
    expect(lireFiltresContenus({ type: "infographie", reseau: "myspace", statut: "zzz", page: "x" })).toEqual({ page: 1 });
    expect(lireFiltresContenus({ type: "", reseau: "", statut: "" })).toEqual({ page: 1 });
    expect(lireFiltresContenus({ type: "video" }).type).toBe("video");
    expect(lireFiltresContenus({ type: "image" }).type).toBe("image");
    expect(lireFiltresContenus({ type: "carrousel" }).type).toBe("carrousel");
    expect(lireFiltresContenus({ reseau: "instagram" }).reseau).toBe("instagram");
    expect(lireFiltresContenus({ reseau: "non-precise" }).reseau).toBe("non-precise");
    expect(lireFiltresContenus({ statut: "a-valider" }).statut).toBe("a-valider");
  });
  it("valeur répétée : la première compte ; casse différente : refusée", () => {
    expect(lireFiltresContenus({ reseau: ["tiktok", "instagram"] }).reseau).toBe("tiktok");
    expect(lireFiltresContenus({ reseau: "Instagram" }).reseau).toBeUndefined();
  });
  it("page : entier ≥ 1 ; 0, négatif, décimal illisible ou énorme sont ramenés dans les bornes", () => {
    expect(lireFiltresContenus({ page: "3" }).page).toBe(3);
    expect(lireFiltresContenus({ page: "0" }).page).toBe(1);
    expect(lireFiltresContenus({ page: "-2" }).page).toBe(1);
    expect(lireFiltresContenus({ page: "2.7" }).page).toBe(2);
    expect(lireFiltresContenus({ page: "abc" }).page).toBe(1);
    expect(lireFiltresContenus({ page: "99999999999999999999" }).page).toBeLessThanOrEqual(1_000_000);
  });
  it("les liens gardent les autres filtres, « Tous » retire le paramètre, un changement de filtre revient à la page 1", () => {
    expect(lienContenus({ type: "video", reseau: "instagram", page: "4" }, { type: "carrousel" })).toBe("/contenus?reseau=instagram&type=carrousel");
    expect(lienContenus({ type: "video", reseau: "instagram" }, { reseau: undefined })).toBe("/contenus?type=video");
    expect(lienContenus({ type: "video" }, { type: undefined })).toBe("/contenus");
    expect(lienContenus({ reseau: "instagram" }, { page: "2" })).toBe("/contenus?reseau=instagram&page=2");
  });
});

describe("/contenus : classement par réseau et type", () => {
  it("sans filtre : tout, du plus récent au plus ancien", () => {
    const v = calculerVueContenus(JEU, {});
    expect(ids(v.elements)).toEqual(["i1", "c2", "c1", "v2", "v1"]);
    expect(v.total).toBe(5);
  });
  it("?reseau=instagram : seulement ce réseau (une vidéo sur deux réseaux y figure) ; combiné au type", () => {
    expect(ids(calculerVueContenus(JEU, { reseau: "instagram" }).elements)).toEqual(["c1", "v1"]);
    expect(ids(calculerVueContenus(JEU, { reseau: "instagram", type: "video" }).elements)).toEqual(["v1"]);
    expect(ids(calculerVueContenus(JEU, { reseau: "non-precise" }).elements)).toEqual(["c2"]);
    expect(calculerVueContenus(JEU, { reseau: "youtube" }).total).toBe(0);
  });
  it("pagination : page trop grande ramenée à la dernière, jamais de page vide quand il y a des contenus", () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => contenu(`x${String(i).padStart(2, "0")}`, "video", ["tiktok"], i));
    expect(calculerVueContenus(beaucoup, { page: 1 }).elements).toHaveLength(24);
    const derniere = calculerVueContenus(beaucoup, { page: 9 });
    expect(derniere.page).toBe(2);
    expect(derniere.elements).toHaveLength(6);
    expect(calculerVueContenus([], { page: 5 })).toMatchObject({ total: 0, page: 1, pages: 1 });
  });
  it("compteurs : les trois types toujours présents, réseaux seulement ceux qui ont un contenu, « non précisé » compté", () => {
    const c = compterContenus(JEU);
    expect(c.types).toEqual({ video: 2, image: 1, carrousel: 2 });
    expect(Object.fromEntries(c.reseaux.map((r) => [r.cle, r.nombre]))).toEqual({ instagram: 2, linkedin: 1, facebook: 1, tiktok: 1, "non-precise": 1 });
    expect(compterContenus([]).types).toEqual({ video: 0, image: 0, carrousel: 0 });
    expect(compterContenus([]).reseaux).toEqual([]);
  });
});

describe("/contenus : rendu", () => {
  const params = { reseau: "instagram" };
  const filtres = lireFiltresContenus(params);
  const barre = renderToStaticMarkup(createElement(FiltresContenus, { params, filtres, comptes: compterContenus(JEU) }));
  const grille = renderToStaticMarkup(createElement(GrilleContenus, { vue: calculerVueContenus(JEU, filtres), params, filtres }));

  it("les 3 familles sont affichées dans les filtres, avec leur nombre ; l'URL garde le filtre réseau", () => {
    for (const mot of ["Vidéos", "Images", "Carrousels"]) expect(barre).toContain(mot);
    expect(barre).toContain('href="/contenus?reseau=instagram&amp;type=video"');
    expect(barre).toContain('href="/contenus?reseau=instagram&amp;type=image"');
    expect(barre).toContain('href="/contenus?reseau=instagram&amp;type=carrousel"');
    expect(barre).toContain('href="/contenus"'); // « Tous » les réseaux retire le paramètre
  });
  it("le réseau choisi est marqué actif, « Tous » du type non", () => {
    expect(barre).toMatch(/aria-current="true"[^>]*>[^<]*Instagram/);
  });
  it("la grille montre les contenus filtrés, chacun vers sa fiche", () => {
    expect(grille).toContain("Titre c1");
    expect(grille).toContain("Titre v1");
    expect(grille).not.toContain("Titre v2");
    expect(grille).toContain('href="/carrousels/c1"');
    expect(grille).toContain('href="/videos/v1"');
  });
  it("adresse de la fiche : vidéo, carrousel, image ; identifiant protégé", () => {
    expect(adresseContenu(JEU[0])).toBe("/videos/v1");
    expect(adresseContenu(JEU[2])).toBe("/carrousels/c1");
    expect(adresseContenu(JEU[4])).toBe("/carrousels/i1");
    expect(adresseContenu(contenu("a/b ?", "video", [], 0))).toBe("/videos/a%2Fb%20%3F");
  });
  it("aucun contenu : état vide qui dit quoi faire ; filtre sans résultat : lien pour tout afficher", () => {
    const vide = renderToStaticMarkup(createElement(GrilleContenus, { vue: calculerVueContenus([], {}), params: {}, filtres: {} }));
    expect(vide).toContain("Aucun contenu");
    const f = lireFiltresContenus({ reseau: "youtube" });
    const sans = renderToStaticMarkup(createElement(GrilleContenus, { vue: calculerVueContenus(JEU, f), params: { reseau: "youtube" }, filtres: f }));
    expect(sans).toContain("Aucun contenu");
    expect(sans).toContain('href="/contenus"');
  });
  it("pagination : liens qui gardent les filtres", () => {
    const beaucoup = Array.from({ length: 30 }, (_, i) => contenu(`x${String(i).padStart(2, "0")}`, "video", ["tiktok"], i));
    const f = lireFiltresContenus({ reseau: "tiktok" });
    const html = renderToStaticMarkup(createElement(GrilleContenus, { vue: calculerVueContenus(beaucoup, f), params: { reseau: "tiktok" }, filtres: f }));
    expect(html).toContain('href="/contenus?reseau=tiktok&amp;page=2"');
  });
  it("une adresse de vignette dangereuse n'est jamais rendue ; un titre piégé est échappé", () => {
    const piege = [contenu("p1", "video", [], 1, { titre: "<script>x</script>", vignetteUrl: "javascript:alert(1)" })];
    const html = renderToStaticMarkup(createElement(GrilleContenus, { vue: calculerVueContenus(piege, {}), params: {}, filtres: {} }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });
  it("aucun libellé interdit à l'écran", () => {
    const texte = `${barre} ${grille}`.replace(/<[^>]*>/g, " ").toLowerCase();
    for (const m of MOTS_INTERDITS_ECRAN) expect(new RegExp(`(^|[^\\p{L}])${m}s?([^\\p{L}]|$)`, "u").test(texte), m).toBe(false);
  });
});
