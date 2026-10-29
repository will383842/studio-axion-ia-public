/**
 * Page « À publier » en deux temps : une liste compacte (rien d'autre qu'une ligne par vidéo), puis le détail d'une vidéo au clic.
 * Filtres, tri (À envoyer d'abord, puis les plus récentes), tranches de 20, retour à la liste avec son filtre.
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
const L = await import("@/components/publication/liste-a-publier");
const { regrouperParVideo } = await import("@/components/publication/regrouper-a-publier");

const CASES = ["image", "son", "sousTitres", "mentionIA", "droits"] as const;
const AUCUNE = { image: false, son: false, sousTitres: false, mentionIA: false, droits: false };
type Etat = NonNullable<LigneAPublier["etat"]>;
const etat = (libelle: string, ton: Etat["ton"], x: Partial<Etat> = {}): Etat => ({ libelle, ton, envoye: libelle !== "Échec", comptesPris: [], sansCompte: false, ...x });

function ligne(videoId: string, reseau: "instagram" | "facebook" | "linkedin" | "tiktok", x: Partial<LigneAPublier> = {}): LigneAPublier {
  return {
    famille: "video", cle: `${videoId}:${reseau}`, videoId, titre: `Titre ${videoId}`, jaquette: null, lecture: `/v/${videoId}.mp4`, reseau, reseauNom: reseau[0].toUpperCase() + reseau.slice(1),
    texte: "Phrase", motsDiese: [], apercu: "Phrase", commentaireTransmissible: true, compte: { nom: "Axion", memorises: ["c1"] }, manquantes: [], casesRequises: [...CASES], coches: { ...AUCUNE }, creeLe: "2026-01-01T10:00:00.000Z", typeVideo: "Cas concret", ...x,
  } as LigneAPublier;
}
const vue = (lignes: LigneAPublier[]) => ({ envoiSimule: false, modeBuffer: "brouillon" as const, lignes });
const liste = (lignes: LigneAPublier[], filtre: Parameters<typeof ListeAPublier>[0]["filtre"] = "a-envoyer", affichees?: number, reseau?: string) => renderToStaticMarkup(createElement(ListeAPublier, { lignes, filtre, affichees, reseau }));
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

/** Une vidéo dans chaque état. */
const jeu = (): LigneAPublier[] => [
  ligne("v-envoyer", "instagram", { creeLe: "2026-03-01T10:00:00.000Z" }),
  ligne("v-brouillon", "instagram", { etat: etat("Brouillon dans Buffer", "neutre"), creeLe: "2026-03-02T10:00:00.000Z" }),
  ligne("v-prog", "instagram", { etat: etat("Programmée", "orange"), creeLe: "2026-03-03T10:00:00.000Z" }),
  ligne("v-pub", "instagram", { etat: etat("Publiée", "sauge", { lien: "https://x.test/p" }), creeLe: "2026-03-04T10:00:00.000Z" }),
  ligne("v-pb", "facebook", { blocage: "Aucun fichier au bon format pour Facebook.", etat: etat("Échec", "brique") }),
];

describe("À publier — la liste", () => {
  it("n'a ni lecteur, ni champ, ni case, ni bouton d'envoi", () => {
    const h = liste(jeu(), "toutes");
    for (const balise of ["<video", "<input", "<textarea", "<button", "<details", "<select"]) expect(h).not.toContain(balise);
    expect(texte(h)).not.toMatch(/J'ai regardé|Mettre en brouillon|Programmer dans Buffer|Phrase du post/);
  });

  it("une ligne par vidéo ET par réseau, avec titre, type et pastille d'état de ce réseau", () => {
    const h = liste([ligne("v-1", "instagram"), ligne("v-1", "facebook"), ligne("v-1", "tiktok", { blocage: "Pas de fichier." })]);
    expect(h.match(/<li[ >]/g)?.length).toBe(2);
    const t = texte(h);
    expect(t).toContain("Titre v-1");
    expect(t).toContain("Cas concret");
    expect(t).toContain("À envoyer");
  });

  it("un clic = le détail : chaque ligne est un lien vers /a-publier/[id], qui garde le filtre", () => {
    const h = liste(jeu(), "publiees");
    expect(h).toContain('href="/a-publier/v-pub?reseau=instagram&amp;liste=tous&amp;filtre=publiees"');
    expect(liste(jeu(), "a-envoyer", undefined, "instagram")).toContain('href="/a-publier/v-envoyer?reseau=instagram"');
    expect(L.lienDetail("v-1", "envoyees")).toBe("/a-publier/v-1?filtre=envoyees");
  });

  it("les pastilles d'état : À envoyer, Brouillon dans Buffer, Programmée, Publiée, Problème", () => {
    const t = texte(liste(jeu(), "toutes"));
    for (const m of ["À envoyer", "Brouillon dans Buffer", "Programmée", "Publiée", "Problème"]) expect(t).toContain(m);
  });

  it("tri par défaut : À envoyer d'abord, puis les plus récentes", () => {
    const l = L.trierListe(regrouperParVideo([...jeu(), ligne("v-envoyer2", "instagram", { creeLe: "2026-03-09T10:00:00.000Z" })]));
    expect(l.map((x) => x.carte.videoId)).toEqual(["v-envoyer2", "v-envoyer", "v-pb", "v-prog", "v-brouillon", "v-pub"]);
  });

  it("filtres : À envoyer / Envoyées (brouillon ou programmées) / Publiées / Toutes", () => {
    const ids = (f: Parameters<typeof L.filtrerListe>[1]) => L.filtrerListe(L.trierListe(regrouperParVideo(jeu())), f).map((x) => x.carte.videoId);
    expect(ids("a-envoyer")).toEqual(["v-envoyer"]);
    expect(ids("envoyees").sort()).toEqual(["v-brouillon", "v-prog"]);
    expect(ids("publiees")).toEqual(["v-pub"]);
    expect(ids("toutes")).toHaveLength(5);
    expect(L.filtreDepuis("n'importe quoi")).toBe("a-envoyer");
    expect(L.filtreDepuis(undefined)).toBe("a-envoyer");
    expect(L.filtreDepuis("publiees")).toBe("publiees");
  });

  it("compteur du type « 12 à envoyer »", () => {
    const douze = Array.from({ length: 12 }, (_, i) => ligne(`v-${i}`, "instagram"));
    expect(texte(liste(douze))).toContain("12 à envoyer");
  });

  it("tranches de 20 : jamais toute la liste d'un coup, « Voir 20 de plus » garde le filtre", () => {
    const cinquante = Array.from({ length: 50 }, (_, i) => ligne(`v-${String(i).padStart(2, "0")}`, "instagram"));
    const h = liste(cinquante);
    expect(h.match(/<li[ >]/g)?.length).toBe(20);
    expect(texte(h)).toContain("50 à envoyer");
    expect(h).toContain('href="/a-publier?n=40"');
    expect(liste(cinquante, "a-envoyer", 40).match(/<li[ >]/g)?.length).toBe(40);
    expect(liste(cinquante, "a-envoyer", 60)).not.toContain("Voir 20 de plus");
    expect(L.lienListe("envoyees", 40)).toBe("/a-publier?filtre=envoyees&n=40");
    expect(L.nombreAffichees(undefined)).toBe(20);
    expect(L.nombreAffichees("35")).toBe(40);
    expect(L.nombreAffichees("-5")).toBe(20);
  });

  it("lisible sur téléphone : lignes d'au moins 44 px, titre tronqué, filtres qui passent à la ligne", () => {
    const h = liste(jeu(), "toutes");
    expect(h).toContain("min-h-16");
    expect(h).toContain("truncate");
    expect(h).toContain("flex-wrap");
  });

  it("vouvoiement", () => {
    expect(texte(liste(jeu(), "toutes"))).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
  });
});

describe("À publier — le détail et le retour à la liste", () => {
  it("le détail reprend la carte : lecteur entier, case unique, un bouton par réseau prêt, détail replié", () => {
    const h = renderToStaticMarkup(createElement(LignesAPublier, { vue: vue([ligne("v-1", "instagram"), ligne("v-1", "facebook")]), retour: "/a-publier?filtre=envoyees" }));
    expect(h).toContain("<video");
    expect(texte(h)).toContain("J'ai regardé la vidéo, tout est en règle");
    expect(texte(h).match(/Mettre en brouillon dans Buffer/g)?.length).toBe(2);
    expect(h).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("après un envoi réussi on revient à la liste (même filtre)", () => {
    const src = readFileSync("src/components/publication/LignesAPublier.tsx", "utf8");
    expect(src).toMatch(/if \(n && retour\) router\.push\(retour\)/);
    expect(src).toMatch(/if \(programmees\.length && retour\) router\.push\(retour\)/);
  });

  it("une vidéo inconnue ouvre la page « introuvable »", async () => {
    pages.sessionKo = false;
    pages.allumee = true;
    pages.lignes = [ligne("v-1", "instagram")];
    await expect(PageDetailAPublier({ params: Promise.resolve({ id: "inconnu" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
    const ok = await PageDetailAPublier({ params: Promise.resolve({ id: "v-1" }), searchParams: Promise.resolve({ reseau: "instagram", filtre: "envoyees" }) });
    const h = renderToStaticMarkup(ok);
    expect(h).toContain("Titre v-1");
    expect(h).toContain('href="/a-publier?reseau=instagram&amp;filtre=envoyees"');
  });

  it("une session refusée fait échouer la page détail ET la page liste, sans rien lire", async () => {
    pages.sessionKo = true;
    pages.lignes = [ligne("v-1", "instagram")];
    await expect(PageDetailAPublier({ params: Promise.resolve({ id: "v-1" }), searchParams: Promise.resolve({}) })).rejects.toThrow("SESSION_REFUSEE");
    await expect(PageAPublier({ searchParams: Promise.resolve({}) })).rejects.toThrow("SESSION_REFUSEE");
    pages.sessionKo = false;
  });

  it("réglage éteint : la liste et le détail sont introuvables", async () => {
    pages.allumee = false;
    pages.lignes = [ligne("v-1", "instagram")];
    await expect(PageAPublier({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
    await expect(PageDetailAPublier({ params: Promise.resolve({ id: "v-1" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
    pages.allumee = true;
  });
});
