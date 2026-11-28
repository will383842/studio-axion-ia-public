/**
 * Pinterest, PR 8 : harmonie avec les autres réseaux. Données fictives (exemple.fr). Aucun appel réseau, aucun envoi.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PretAPartir } from "@/components/calendrier/PretAPartir";
import { cartesDepuisEntrees, typeAffiche } from "@/components/calendrier/CarteEntreeCalendrier";
import { bornesMotsDiese, PROFIL_DESCRIPTION } from "./aides-pr8";
import { lireLotEpingles } from "@/domaine/epingles/format-lot";
import { construireLienSuivi } from "@/domaine/mesures";
import { JOURS_ATTENDUS_DEPART } from "@/domaine/calendrier/manques";
import { classerCarrousels, carrouselCommeVideoMesuree, estReseauClasse, estReseauMesureVisuel } from "@/domaine/mesures-visuels";
import { etatComptePinterest } from "@/domaine/chaine-pinterest";
import { etatInterrupteurPinterest, phraseComptePinterest, resumeCartePinterest } from "@/components/reglages/pinterest-logique";
import { DESCRIPTION_EPINGLE_MAX } from "@/fournisseurs/publication/epingle-limites";
import { definitionAffichage, nomDuReseau } from "@/reseaux/hors-video";
import { controlerPretAPartir } from "@/services/pret-a-partir";

const epingleJson = (sur: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 1, epingles: [{ titre: "Un titre", description: "Une description", url: "https://exemple.fr/blog/article", tableau: "IA", texteAlternatif: "Un carnet ouvert", contenuIA: false, image: "a.png", ...sur }] });

describe("n°3/n°17 · lien d'une épingle contenant un mot interdit", () => {
  it("l'import refuse ce que l'envoi refusera (lien : mot interdit)", () => {
    const r = lireLotEpingles(epingleJson({ url: "https://exemple.fr/blog/devenir-formateur-ia-certifie" }), "exemple.fr");
    expect(r.ok && r.lignes[0].epingle).toBeUndefined();
    expect(r.ok && r.lignes[0].erreurs).toContain("lien : mot interdit");
  });
  it("un lien propre passe", () => {
    const r = lireLotEpingles(epingleJson(), "exemple.fr");
    expect(r.ok && r.lignes[0].epingle).toBeTruthy();
  });
});

describe("n°6 · description Pinterest : 500 signes partout", () => {
  it("une seule valeur dans tout le code", () => {
    expect(DESCRIPTION_EPINGLE_MAX).toBe(500);
    expect(definitionAffichage("pinterest").legende.longueurMax).toBe(500);
    expect(PROFIL_DESCRIPTION()).toBe(500);
  });
  it("l'import refuse 501 signes et accepte 500", () => {
    const ko = lireLotEpingles(epingleJson({ description: "x".repeat(501) }), "exemple.fr");
    expect(ko.ok && ko.lignes[0].erreurs.join(" ")).toContain("500 signes au plus");
    const ok = lireLotEpingles(epingleJson({ description: "x".repeat(500) }), "exemple.fr");
    expect(ok.ok && ok.lignes[0].epingle).toBeTruthy();
  });
});

describe("n°8 · une épingle s'affiche « Épingle » avec sa vignette", () => {
  it("le type de carte est « image » et le mot affiché « Épingle » sur Pinterest seulement", () => {
    const cartes = cartesDepuisEntrees([{ cle: "creneau:c1", jour: "2026-12-11", famille: "epingle", origine: "creneau", titre: "T", vignette: "cle/epingle.png", lien: null, reseaux: ["pinterest"], mediaId: "vis_1", statut: "valide" }]);
    expect(cartes[0]?.type).toBe("image");
    expect(typeAffiche("pinterest", "image").libelle).toBe("Épingle");
    expect(typeAffiche("linkedin", "image").libelle).toBe("Image");
  });
});

describe("n°9 · noms et premier commentaire", () => {
  it("Pinterest s'écrit avec une majuscule partout", () => {
    expect(nomDuReseau("pinterest")).toBe("Pinterest");
    const h = renderToStaticMarkup(<PretAPartir publications={[{ reseau: "pinterest", texte: "", typeContenu: "image" } as never]} />);
    expect(h).toContain("Pinterest");
    expect(h).not.toContain(">pinterest<");
  });
  it("« Prêt à partir ? » sur une épingle : pas de premier commentaire, pas de hashtags, nom correct", () => {
    const lignes = controlerPretAPartir({ reseau: "pinterest", texte: "Une description", hashtags: [], typeContenu: "image", instant: "2026-12-11T08:30", media: undefined });
    expect(lignes.map((l) => l.code)).not.toContain("premier-commentaire");
    expect(lignes.map((l) => l.code)).not.toContain("hashtags");
    expect(lignes.every((l) => !/pinterest/.test(l.message))).toBe(true);
  });
  it("la liste « à vérifier » ne réclame pas le premier commentaire d'une épingle, mais le réclame ailleurs", () => {
    const pin = renderToStaticMarkup(<PretAPartir publications={[{ reseau: "pinterest", texte: "ok", typeContenu: "image", instant: "2026-12-11T08:30" } as never]} averifier={["premier-commentaire"]} />);
    expect(pin).not.toContain("premier commentaire");
    const lin = renderToStaticMarkup(<PretAPartir publications={[{ reseau: "linkedin", texte: "ok", hashtags: ["#a"], premierCommentaire: "x", typeContenu: "image", instant: "2026-12-11T08:30" } as never]} averifier={["premier-commentaire"]} />);
    expect(lin).toContain("premier commentaire");
  });
});

describe("n°11 · mots-dièse Pinterest : 0 conseillé, on n'en met pas", () => {
  it("une seule règle : 0 conseillé et 0 au plus, aucun avertissement « il en manque »", () => {
    const d = definitionAffichage("pinterest").legende;
    expect([d.motsDieseConseilles, d.motsDieseMax]).toEqual([0, 0]);
    expect(bornesMotsDiese("pinterest")).toEqual({ message: undefined });
  });
  it("des mots-dièse mis quand même sont gardés, avec un message qui dit qu'on n'en met pas", () => {
    expect(bornesMotsDiese("pinterest", ["#ia"]).message).toMatch(/on n'en met pas/);
  });
});

describe("n°12 · carte Pinterest dans Réglages", () => {
  const compte = (canaux: unknown) => etatComptePinterest({ canaux });
  it("l'état du compte se lit dans les canaux enregistrés, sans identifiant", () => {
    expect(etatComptePinterest(null)).toEqual({ etat: "inconnu" });
    expect(compte([{ service: "linkedin", deconnecte: false }])).toEqual({ etat: "absent" });
    expect(compte([{ service: "pinterest", deconnecte: true }])).toEqual({ etat: "deconnecte" });
    expect(compte([{ service: "pinterest", deconnecte: false }, { service: "pinterest", deconnecte: false }])).toEqual({ etat: "relie", tableaux: 2 });
    expect(phraseComptePinterest({ etat: "relie", tableaux: 1 })).toBe("Compte relié : 1 tableau public.");
  });
  it("fermé par défaut : on ne peut ouvrir qu'avec un compte relié et un domaine ; on peut toujours fermer", () => {
    const relie = { etat: "relie", tableaux: 1 } as const;
    expect(etatInterrupteurPinterest({ enCours: false, actif: false, compte: { etat: "absent" }, domaine: "exemple.fr" }).desactive).toBe(true);
    expect(etatInterrupteurPinterest({ enCours: false, actif: false, compte: relie, domaine: "" }).desactive).toBe(true);
    expect(etatInterrupteurPinterest({ enCours: false, actif: false, compte: relie, domaine: "exemple.fr" }).desactive).toBe(false);
    expect(etatInterrupteurPinterest({ enCours: false, actif: true, compte: { etat: "absent" }, domaine: "" }).desactive).toBe(false);
    expect(resumeCartePinterest(false)).toMatch(/^Fermé/);
  });
  it("la page Réglages porte la carte, et la clé est celle de la porte du fournisseur", () => {
    const page = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");
    expect(page).toContain('titre="Pinterest"');
    expect(page).toContain("<CartePinterest");
    const svc = readFileSync("src/services/pinterest-zernio.ts", "utf8");
    expect(svc).toContain("CLE_PINTEREST_ACTIF");
    expect(svc).toContain("lireParametre<unknown>(CLE_PINTEREST_ACTIF, false)");
  });
});

describe("n°13 · jours attendus, liens suivis, mesures", () => {
  it("Pinterest a des jours attendus (4 épingles par jour : tous les jours)", () => {
    expect(JOURS_ATTENDUS_DEPART.pinterest).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("lien suivi : Pinterest accepté pour un post, jamais pour un message privé", () => {
    const base = { typeLien: "post", reseau: "pinterest", code: "0042-VS-PI", activite: "clients", page: "/fr/diagnostic" };
    expect(construireLienSuivi(base)).toContain("utm_source=pinterest");
    expect(() => construireLienSuivi({ ...base, typeLien: "message", code: "mot-guide" })).toThrow();
  });
  it("mesures des visuels : Pinterest est classé ; la republication ne l'accepte toujours pas", () => {
    expect(estReseauMesureVisuel("pinterest")).toBe(true);
    expect(estReseauClasse("pinterest")).toBe(false);
    const mesure = (i: number) => carrouselCommeVideoMesuree({ publicationId: `p${i}`, visuelId: `v${i}`, famille: "epingle", titre: `E${i}`, reseau: "pinterest", date: "2026-12-01T08:30:00Z", stats: { vues: 100 * i } as never });
    const c = classerCarrousels([mesure(1), mesure(2), mesure(3)]);
    expect(c.reseaux.map((r) => r.reseau)).toEqual(["pinterest"]);
  });
});

describe("n°15 · promotion : post relu sans platforms", () => {
  it("la garde Array.isArray est partagée (plus d'appel direct à avant.platforms.some)", () => {
    const src = readFileSync("src/fournisseurs/publication/zernio-client.ts", "utf8");
    expect(src).not.toContain("avant.platforms.some(");
    expect(src).toContain("if (epingle) {");
  });
});
void vi;

describe("n°8 · le calendrier lit une épingle comme une épingle", () => {
  it("listerEntrees : famille « epingle », titre et vignette de l'image déposée (jamais « Carrousel » sans image)", async () => {
    const { listerEntrees } = await import("@/services/calendrier");
    const visuel = { id: "vis_ep", famille: "epingle", titre: "Mon épingle", epingle: { image: { cle: "epingle/a.png" } } };
    const creneau = { id: "cre_ep", jourVise: "2026-12-11", statut: "valide", visuelId: "vis_ep", heuresParReseau: { pinterest: "2026-12-11T07:30:00.000Z" } };
    const d = {
      publications: { lister: async () => [] },
      creneaux: { lister: async (f: (c: unknown) => boolean) => [creneau].filter(f) },
      visuels: { obtenir: async (id: string) => (id === "vis_ep" ? visuel : undefined) },
      videos: { obtenir: async () => undefined },
    };
    const [e] = await listerEntrees(d as never, "2026-12-01", "2026-12-31");
    expect(e).toMatchObject({ famille: "epingle", titre: "Mon épingle", vignette: "epingle/a.png", reseaux: ["pinterest"] });
  });
});
