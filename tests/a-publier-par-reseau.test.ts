/**
 * Page « À publier » séparée par réseau : une ligne par vidéo ET par réseau, avec l'état de CE réseau ; une vidéo prévue
 * pour deux réseaux apparaît dans les deux listes. Compteurs, filtre d'état, réseau gardé dans l'adresse, tranches de 20 par réseau.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { LigneAPublier } from "@/services/a-publier";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/app/(studio)/mesures/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));

const pages = vi.hoisted(() => ({ lignes: [] as unknown[], allumee: true, sessionKo: false }));
vi.mock("@/services/auth", () => ({
  exigerSession: async () => {
    if (pages.sessionKo) throw new Error("SESSION_REFUSEE");
  },
}));
vi.mock("@/services/a-publier", () => ({ pageAPublierAllumee: async () => pages.allumee, vueAPublier: async () => ({ envoiSimule: false, modeBuffer: "brouillon", lignes: pages.lignes }) }));

const { ListeAPublier } = await import("@/components/publication/ListeAPublier");
const { LignesAPublier } = await import("@/components/publication/LignesAPublier");
const { default: PageAPublier } = await import("@/app/(studio)/a-publier/page");
const { default: PageDetailAPublier } = await import("@/app/(studio)/a-publier/[id]/page");
const R = await import("@/components/publication/liste-par-reseau");

const CASES = ["image", "son", "sousTitres", "mentionIA", "droits"] as const;
const AUCUNE = { image: false, son: false, sousTitres: false, mentionIA: false, droits: false };
type Etat = NonNullable<LigneAPublier["etat"]>;
const etat = (libelle: string, ton: Etat["ton"], x: Partial<Etat> = {}): Etat => ({ libelle, ton, envoye: libelle !== "Échec", comptesPris: [], sansCompte: false, ...x });
const NOMS = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", "youtube-shorts": "YouTube Shorts" } as const;

function ligne(videoId: string, reseau: keyof typeof NOMS, x: Partial<LigneAPublier> = {}): LigneAPublier {
  return {
    famille: "video", cle: `${videoId}:${reseau}`, videoId, titre: `Titre ${videoId}`, jaquette: null, lecture: `/v/${videoId}.mp4`, reseau, reseauNom: NOMS[reseau],
    texte: "Phrase", motsDiese: [], apercu: "Phrase", commentaireTransmissible: true, compte: { nom: "Axion", memorises: ["c1"] }, manquantes: [], casesRequises: [...CASES], coches: { ...AUCUNE }, creeLe: "2026-01-01T10:00:00.000Z", typeVideo: "Cas concret", ...x,
  } as LigneAPublier;
}
const liste = (lignes: LigneAPublier[], filtre: "a-envoyer" | "envoyees" | "publiees" | "problemes" | "toutes" = "a-envoyer", reseau?: string, affichees?: number) =>
  renderToStaticMarkup(createElement(ListeAPublier, { lignes, filtre, reseau, affichees }));
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");
const lignesLi = (h: string) => h.match(/<li[ >]/g)?.length ?? 0;

/** v-deux est sur deux réseaux (Brouillon sur Facebook, À envoyer sur LinkedIn) ; v-fb et v-li sont chacune sur un seul. */
const jeu = (): LigneAPublier[] => [
  ligne("v-deux", "facebook", { etat: etat("Brouillon dans Buffer", "neutre"), creeLe: "2026-03-02T10:00:00.000Z" }),
  ligne("v-deux", "linkedin", { creeLe: "2026-03-02T10:00:00.000Z" }),
  ligne("v-fb", "facebook", { creeLe: "2026-03-03T10:00:00.000Z", dimensions: { largeur: 1080, hauteur: 1350 } }),
  ligne("v-li", "linkedin", { creeLe: "2026-03-04T10:00:00.000Z", dimensions: { largeur: 1080, hauteur: 1920 } }),
];

describe("À publier par réseau — la liste d'un réseau", () => {
  it("n'affiche que les vidéos de CE réseau", () => {
    const h = liste(jeu(), "toutes", "facebook");
    expect(lignesLi(h)).toBe(2);
    expect(h).toContain("Titre v-fb");
    expect(h).toContain("Titre v-deux");
    expect(h).not.toContain("Titre v-li");
  });

  it("une vidéo prévue pour deux réseaux apparaît dans les deux listes, avec la pastille de chaque réseau", () => {
    const fb = texte(liste(jeu(), "toutes", "facebook"));
    const li = texte(liste(jeu(), "toutes", "linkedin"));
    expect(fb).toContain("Titre v-deux");
    expect(li).toContain("Titre v-deux");
    expect(fb).toContain("Brouillon dans Buffer");
    expect(li).not.toContain("Brouillon dans Buffer");
    expect(R.lignesParReseau(jeu()).filter((l) => l.ligne.videoId === "v-deux").map((l) => `${l.ligne.reseau}:${l.etat.libelle}`).sort()).toEqual(["facebook:Brouillon dans Buffer", "linkedin:À envoyer"]);
  });

  it("montre le format de CE réseau (4:5, 9:16) et, quand la vidéo n'est pas prête, la raison courte", () => {
    const h = texte(liste([...jeu(), ligne("v-x", "facebook", { blocage: "Aucun fichier au bon format pour Facebook." })], "toutes", "facebook"));
    expect(h).toContain("4:5");
    expect(texte(liste(jeu(), "toutes", "linkedin"))).toContain("9:16");
    expect(h).toContain("Pas prêt");
    expect(h).toContain("Aucun fichier au bon format pour Facebook.");
    expect(R.formatDe({ largeur: 1080, hauteur: 1080 })).toBe("1:1");
    expect(R.formatDe(undefined)).toBeNull();
  });

  it("une vidéo d'essai ou d'exemple a sa propre catégorie (pastille Essai ou Exemple), sans être un problème ni « Pas prêt »", () => {
    const l = [ligne("v-e", "facebook", { blocage: "Vidéo d'essai : elle ne part pas.", blocageVideo: true }), ligne("v-x", "linkedin", { blocage: "Vidéo d'exemple : elle ne part pas.", blocageVideo: true }), ligne("v-p", "linkedin", { blocage: "Pas de fichier." })];
    const r = R.lignesParReseau(l);
    expect(r.map((x) => `${x.etat.categorie}:${x.etat.libelle}`)).toEqual(["pas-pret:Pas prêt", "essai:Essai", "essai:Exemple"]);
    expect(r.find((x) => x.etat.libelle === "Essai")!.etat.raison).toContain("essai");
    expect(R.compterReseau(r)).toMatchObject({ essais: 2, problemes: 0 });
    expect(R.filtrerReseau(r, "problemes")).toHaveLength(0);
  });

  it("le filtre Problèmes liste les problèmes, et « N problèmes » est un lien vers lui", () => {
    const l = [ligne("v-pb", "facebook", { blocage: "Pas de fichier.", etat: etat("Échec", "brique") }), ligne("v-pb2", "facebook", { etat: etat("À vérifier", "brique") }), ligne("v-ok", "facebook")];
    expect(R.filtrerReseau(R.lignesParReseau(l), "problemes").map((x) => x.ligne.videoId).sort()).toEqual(["v-pb", "v-pb2"]);
    const h = liste(l, "a-envoyer", "facebook");
    expect(h).toMatch(/href="\/a-publier\?reseau=facebook&amp;filtre=problemes"[^>]*>2 problèmes</);
    expect(lignesLi(liste(l, "problemes", "facebook"))).toBe(2);
    expect(texte(h)).toMatch(/Problèmes 2/);
  });

  it("un réseau pas prêt garde son état réel (Publiée, Problème)", () => {
    const l = R.lignesParReseau([ligne("a", "tiktok", { blocage: "x", etat: etat("Publiée", "sauge") }), ligne("b", "tiktok", { blocage: "x", etat: etat("Échec", "brique") })]);
    expect(l.map((x) => x.etat.libelle).sort()).toEqual(["Problème", "Publiée"]);
  });
});

describe("À publier par réseau — onglets et compteurs", () => {
  it("n'offre que les réseaux qui ont au moins une vidéo, plus Tous, dans l'ordre du registre", () => {
    expect(R.reseauxPresents(jeu())).toEqual(["linkedin", "facebook"]);
    const h = texte(liste(jeu()));
    expect(h).toContain("Tous");
    expect(h).toContain("LinkedIn");
    expect(h).toContain("Facebook");
    expect(h).not.toMatch(/Instagram|TikTok|YouTube/);
  });

  it("compteurs justes par réseau (« Facebook 1 à envoyer », « LinkedIn 2 à envoyer »)", () => {
    const c = R.compteursParReseau(R.lignesParReseau(jeu()), R.reseauxPresents(jeu()));
    expect(c.facebook).toMatchObject({ aEnvoyer: 1, envoyees: 1, toutes: 2 });
    expect(c.linkedin).toMatchObject({ aEnvoyer: 2, toutes: 2 });
    expect(c.tous.toutes).toBe(4);
    const h = texte(liste(jeu()));
    expect(h).toMatch(/Facebook 1 à envoyer/);
    expect(h).toMatch(/LinkedIn 2 à envoyer/);
  });

  it("les onglets défilent horizontalement sur téléphone, avec le logo du réseau", () => {
    const h = liste(jeu());
    expect(h).toContain("overflow-x-auto");
    expect(h).toContain("shrink-0");
    expect(h).toContain("min-h-11");
    expect(h).toMatch(/aria-label="Choisir un réseau"/);
  });
});

describe("À publier par réseau — filtre d'état combiné et adresse", () => {
  it("le filtre d'état se combine avec le réseau", () => {
    expect(lignesLi(liste(jeu(), "a-envoyer", "facebook"))).toBe(1);
    expect(liste(jeu(), "a-envoyer", "facebook")).toContain("Titre v-fb");
    expect(liste(jeu(), "a-envoyer", "facebook")).not.toContain("Titre v-deux");
    expect(lignesLi(liste(jeu(), "envoyees", "facebook"))).toBe(1);
    expect(liste(jeu(), "envoyees", "facebook")).toContain("Titre v-deux");
    expect(lignesLi(liste(jeu(), "envoyees", "linkedin"))).toBe(0);
    expect(lignesLi(liste(jeu(), "a-envoyer", "linkedin"))).toBe(2);
  });

  it("le réseau est gardé dans l'adresse : onglets, filtres, « Voir 20 de plus », détail et retour", () => {
    expect(R.lienListeReseau("tous", "a-envoyer")).toBe("/a-publier");
    expect(R.lienListeReseau("facebook", "a-envoyer")).toBe("/a-publier?reseau=facebook");
    expect(R.lienListeReseau("facebook", "envoyees", 40)).toBe("/a-publier?reseau=facebook&filtre=envoyees&n=40");
    const h = liste(jeu(), "envoyees", "facebook");
    expect(h).toContain('href="/a-publier?reseau=facebook&amp;filtre=toutes"');
    expect(h).toContain('href="/a-publier?reseau=linkedin&amp;filtre=envoyees"');
    expect(h).toContain('href="/a-publier/v-deux?reseau=facebook&amp;filtre=envoyees"');
    const presents = R.reseauxPresents(jeu());
    expect(R.retourDetail({ reseau: "facebook", filtre: "envoyees" }, presents, "envoyees", 20)).toBe("/a-publier?reseau=facebook&filtre=envoyees");
    expect(R.retourDetail({ reseau: "facebook", liste: "tous" }, presents, "a-envoyer", 20)).toBe("/a-publier");
    expect(R.retourDetail({ reseau: "inconnu" }, presents, "a-envoyer", 20)).toBe("/a-publier");
    expect(R.reseauDepuis("tiktok", presents)).toBe("tous");
  });
});

describe("À publier par réseau — vue Tous et tranches de 20", () => {
  it("dans Tous, un titre de section par réseau, sans mélanger", () => {
    const h = liste(jeu(), "toutes");
    expect(h.match(/<h2/g)?.length).toBe(2);
    const sections = h.split("<section").slice(1);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toContain("LinkedIn");
    expect(sections[0]).not.toContain("Titre v-fb");
    expect(sections[1]).toContain("Titre v-fb");
    expect(sections[1]).not.toContain("Titre v-li");
    expect(liste(jeu(), "toutes", "facebook")).not.toContain("<h2");
    expect(liste(jeu(), "toutes")).toContain('href="/a-publier/v-fb?reseau=facebook&amp;liste=tous&amp;filtre=toutes"');
  });

  it("la pagination par 20 se fait par réseau", () => {
    const l = [
      ...Array.from({ length: 50 }, (_, i) => ligne(`f-${String(i).padStart(2, "0")}`, "facebook")),
      ...Array.from({ length: 5 }, (_, i) => ligne(`l-${i}`, "linkedin")),
    ];
    const fb = liste(l, "a-envoyer", "facebook");
    expect(lignesLi(fb)).toBe(20);
    expect(texte(fb)).toContain("20 vidéos sur 50");
    expect(fb).toContain('href="/a-publier?reseau=facebook&amp;n=40"');
    expect(lignesLi(liste(l, "a-envoyer", "facebook", 40))).toBe(40);
    expect(lignesLi(liste(l, "a-envoyer", "linkedin"))).toBe(5);
    expect(liste(l, "a-envoyer", "linkedin")).not.toContain("Voir 20 de plus");
    // Vue Tous : 20 au plus PAR section, LinkedIn n'est pas écrasé par Facebook.
    const tous = liste(l);
    expect(lignesLi(tous)).toBe(25);
    // Le lien de la section Facebook ouvre l'onglet Facebook (40 vidéos) et n'agrandit pas LinkedIn.
    expect(tous).toContain('href="/a-publier?reseau=facebook&amp;n=40"');
    expect(tous).not.toContain("reseau=linkedin&amp;n=");
    expect(tous.split("<section").slice(1).map(lignesLi)).toEqual([5, 20]);
  });
});

describe("À publier par réseau — le détail", () => {
  const vue = (lignes: LigneAPublier[]) => ({ envoiSimule: false, modeBuffer: "brouillon" as const, lignes });
  const deux = () => [ligne("v-1", "facebook"), ligne("v-1", "linkedin")];

  it("ouvre d'office le réseau choisi et garde l'autre accessible", () => {
    const h = renderToStaticMarkup(createElement(LignesAPublier, { vue: vue(deux()), reseauOuvert: "linkedin" }));
    expect(h).toMatch(/aria-expanded="true"[^>]*aria-controls="reseau-v-1-linkedin"/);
    expect(h).toMatch(/aria-expanded="false"[^>]*aria-controls="reseau-v-1-facebook"/);
    expect(h).toMatch(/<div id="reseau-v-1-linkedin"[^>]*class/);
    expect(h).not.toMatch(/<div id="reseau-v-1-linkedin" hidden/);
    expect(h).toMatch(/<div id="reseau-v-1-facebook" hidden/);
  });

  it("sans réseau choisi (ou réseau inconnu), rien n'est ouvert", () => {
    for (const r of [undefined, "tiktok"]) expect(renderToStaticMarkup(createElement(LignesAPublier, { vue: vue(deux()), reseauOuvert: r }))).not.toContain('aria-expanded="true"');
  });

  it("les pages lisent le réseau dans l'adresse", async () => {
    pages.sessionKo = false;
    pages.allumee = true;
    pages.lignes = deux();
    const l = renderToStaticMarkup(await PageAPublier({ searchParams: Promise.resolve({ reseau: "linkedin", filtre: "toutes" }) }));
    expect(lignesLi(l)).toBe(1);
    expect(l).toMatch(/aria-current="page"[^>]*>.*LinkedIn/);
    const d = renderToStaticMarkup(await PageDetailAPublier({ params: Promise.resolve({ id: "v-1" }), searchParams: Promise.resolve({ reseau: "linkedin", filtre: "toutes" }) }));
    expect(d).toMatch(/aria-expanded="true"[^>]*aria-controls="reseau-v-1-linkedin"/);
    expect(d).toMatch(/aria-expanded="false"[^>]*aria-controls="reseau-v-1-facebook"/);
    expect(d).toContain('href="/a-publier?reseau=linkedin&amp;filtre=toutes"');
  });
});

describe("À publier par réseau — rien d'autre ne change", () => {
  it("la liste par réseau n'envoie rien et n'importe ni le service d'envoi ni Buffer", () => {
    for (const f of ["src/components/publication/liste-par-reseau.ts", "src/components/publication/ListeAPublier.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/services\/publications|fournisseurs|buffer|envoyerVersBuffer/i);
      expect(src).not.toContain('"use client"');
    }
  });

  it("vouvoiement", () => {
    expect(texte(liste(jeu(), "toutes"))).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
  });
});
