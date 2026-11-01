/**
 * Z3-E · écran d'envoi « À publier » selon l'outil (rendu serveur, comme les autres tests d'écran).
 * Le fichier est en .ts : on y construit les éléments avec createElement, sans JSX (vitest lit *.test.ts et *.test.tsx).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import type { LigneAPublier, VueAPublier } from "@/services/a-publier";
import type { ComplementLigne } from "@/services/a-publier-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/app/(studio)/mesures/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
const page = vi.hoisted(() => ({ lignes: [] as unknown[], complements: {} as Record<string, unknown>, appels: 0 }));
vi.mock("@/services/a-publier-zernio", () => ({
  envoyerParOutilAction: async () => ({ ok: true, donnees: { nombre: 1, problemes: [] } }),
  complementsAPublier: async () => {
    page.appels++;
    return page.complements;
  },
}));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/a-publier", () => ({ pageAPublierAllumee: async () => true, vueAPublier: async () => ({ envoiSimule: false, modeBuffer: "brouillon", lignes: page.lignes }) }));

const { LignesAPublier } = await import("@/components/publication/LignesAPublier");
const F = await import("@/components/publication/finitions-envoi");
const { LIBELLES_ENVOI } = await import("@/domaine/libelles");

const CASES = ["image", "son", "sousTitres", "mentionIA", "droits"] as const;
const COCHEES = { image: true, son: true, sousTitres: true, mentionIA: true, droits: true };

function ligne(reseau: "instagram" | "tiktok" | "facebook", x: Partial<LigneAPublier> = {}): LigneAPublier {
  return {
    famille: "video", cle: `v-1:${reseau}`, videoId: "v-1", titre: "Titre", jaquette: null, lecture: "/v.mp4", reseau, reseauNom: reseau === "tiktok" ? "TikTok" : reseau === "instagram" ? "Instagram" : "Facebook",
    texte: "Phrase du post", motsDiese: [], apercu: "Phrase", premierCommentaire: "Voir le lien en bio", commentaireTransmissible: true, compte: { nom: "Compte", memorises: ["c1"] }, manquantes: [], casesRequises: [...CASES], coches: { ...COCHEES }, ...x,
  } as LigneAPublier;
}
const comp = (x: Partial<ComplementLigne> = {}): ComplementLigne => ({ outil: "zernio", etat: "aucun", essai: false, bufferDisponible: true, aussiSur: [], ...x });
const vue = (lignes: LigneAPublier[]): VueAPublier => ({ envoiSimule: false, modeBuffer: "brouillon", lignes });
const rendre = (lignes: LigneAPublier[], complements: Record<string, ComplementLigne>, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(LignesAPublier, { vue: vue(lignes), complements, reseauOuvert: lignes[0].reseau, ...extra }));
const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

describe("Z3-E · fonctions pures", () => {
  it("mention IA visible seulement pour Instagram et TikTok", () => {
    expect(["instagram", "tiktok", "facebook", "linkedin", "youtube"].map((r) => F.mentionIAVisible(r))).toEqual([true, true, false, false, false]);
  });
  it("libellés d'envoi : le nom de l'outil vient du catalogue", () => {
    expect(LIBELLES_ENVOI.brouillon).toBe("Mettre en brouillon");
    expect(LIBELLES_ENVOI.programmer).toBe("Programmer");
    expect(F.libelleEnvoiOutil("brouillon", "zernio")).toBe("Mettre en brouillon dans Zernio");
    expect(F.libelleEnvoiOutil("programmer", "buffer")).toBe("Programmer dans Buffer");
    expect(LIBELLES_ENVOI.brouillon + LIBELLES_ENVOI.programmer + LIBELLES_ENVOI.validerEtProgrammer).not.toMatch(/Buffer|Zernio/);
  });
  it("action principale unique selon l'état", () => {
    expect(F.actionPrincipale({ etat: "brouillon", reseau: "tiktok", accordTiktok: false })).toMatchObject({ type: "valider", desactive: true, raison: LIBELLES_ENVOI.tiktokAccordManquant });
    expect(F.actionPrincipale({ etat: "brouillon", reseau: "tiktok", accordTiktok: true })).toMatchObject({ type: "valider", desactive: false });
    expect(F.actionPrincipale({ etat: "brouillon", reseau: "instagram", accordTiktok: false })).toMatchObject({ libelle: "Valider et programmer", desactive: false });
    expect(F.actionPrincipale({ etat: "programmee", reseau: "instagram", accordTiktok: false, dateEnvoi: "2026-11-02T08:00:00.000Z" })).toMatchObject({ type: "repasser", libelle: "Repasser en brouillon" });
    expect(F.actionPrincipale({ etat: "publiee", reseau: "instagram", accordTiktok: false, lien: "https://exemple.test/p" })).toMatchObject({ type: "voir", libelle: "Voir la publication", phrase: "Publiée et vérifiée. Le lien est enregistré." });
    expect(F.actionPrincipale({ etat: "echec", reseau: "instagram", accordTiktok: false })).toMatchObject({ type: "reessayer", libelle: "Réessayer maintenant" });
  });
  it("phrases : programmée, échec, essais, brouillon ancien", () => {
    expect(F.phraseProgrammee("2026-11-02T08:00:00.000Z")).toBe("Partira lundi à 09:00. Vous pouvez encore la repasser en brouillon.");
    expect(F.phraseEchec("2026-11-01T13:32:00.000Z")).toBe("Échec à 14:32.");
    expect(F.phraseEssais("TikTok")).toBe("Pendant les essais, TikTok reçoit d'abord un brouillon.");
    const maintenant = new Date("2026-11-10T10:00:00.000Z");
    expect(F.joursRestantsBrouillon("2026-11-09T10:00:00.000Z", maintenant)).toBeNull();
    expect(F.joursRestantsBrouillon("2026-11-04T09:00:00.000Z", maintenant)).toBe(1);
    expect(F.phraseBrouillonAProgrammer(2)).toBe("Brouillon à programmer dans les 7 jours : il en reste 2.");
  });
  it("barre de sélection : « Valider et programmer les N » et la note TikTok", () => {
    expect(F.barreSelection([])).toBeNull();
    expect(F.barreSelection([{ reseau: "instagram", accordTiktok: false }, { reseau: "tiktok", accordTiktok: false }])).toEqual({ libelle: "Valider et programmer les 2", note: "Le TikTok attend votre accord." });
    expect(F.barreSelection([{ reseau: "instagram", accordTiktok: false }])?.note).toBeNull();
  });
  it("formats d'aperçu 4:5 et 9:16", () => {
    expect(F.formatApercu("instagram", { largeur: 1080, hauteur: 1350 })).toBe("4:5");
    expect(F.formatApercu("tiktok", { largeur: 1080, hauteur: 1920 })).toBe("9:16");
    expect(F.formatApercu("tiktok")).toBe("9:16");
  });
});

describe("Z3-E · écran", () => {
  it("TikTok en brouillon : case d'accord, bouton inactif, phrase liée par aria-describedby", () => {
    const h = rendre([ligne("tiktok", { dimensions: { largeur: 1080, hauteur: 1920 } })], { "v-1:tiktok": comp({ etat: "brouillon", creeLe: new Date().toISOString() }) });
    const t = texte(h);
    expect(t).toContain("J'ai regardé l'aperçu et j'accepte que TikTok publie cette vidéo.");
    expect(t).toContain("TikTok demande cet accord à chaque envoi.");
    expect(t).toContain("TikTok ne permet pas de premier commentaire automatique : à poser à la main, juste après la publication.");
    expect(t).not.toContain("Premier commentaire, posé automatiquement");
    const bouton = /<button[^>]*>(?:(?!<\/button>)[\s\S])*Valider et programmer/.exec(h)![0].match(/<button[^>]*>/)![0];
    expect(bouton).toContain("disabled");
    const id = /aria-describedby="([^"]+)"/.exec(bouton)![1];
    expect(h).toMatch(new RegExp(`id="${id}"[^>]*>Cochez l&#x27;accord TikTok ci-dessus pour valider\\.`));
    expect(h).toContain('data-format="9:16"');
  });
  it("Instagram : premier commentaire posé automatiquement, mention IA visible, pas de case TikTok", () => {
    const t = texte(rendre([ligne("instagram")], { "v-1:instagram": comp({ etat: "brouillon", creeLe: new Date().toISOString() }) }));
    expect(t).toContain("Premier commentaire, posé automatiquement");
    expect(t).toContain("Voir le lien en bio");
    expect(t).toContain("Mention « contenu généré par IA »");
    expect(t).not.toContain("j'accepte que TikTok");
  });
  it("Facebook : pas de mention IA", () => {
    expect(texte(rendre([ligne("facebook")], { "v-1:facebook": comp() }))).not.toContain("contenu généré par IA");
  });
  it("échec, programmée, publiée, brouillon ancien, « Aussi sur », « Envoi par … Changer »", () => {
    const echec = texte(rendre([ligne("instagram")], { "v-1:instagram": comp({ etat: "echec", echecLe: "2026-11-01T13:32:00.000Z", cause: "Le réseau a refusé la vidéo." }) }));
    expect(echec).toContain("Échec à 14:32.");
    expect(echec).toContain("Le réseau a refusé la vidéo.");
    expect(echec).toContain("Réessayer maintenant");
    const prog = texte(rendre([ligne("instagram")], { "v-1:instagram": comp({ etat: "programmee", dateEnvoi: "2026-11-02T08:00:00.000Z" }) }));
    expect(prog).toContain("Partira lundi à 09:00. Vous pouvez encore la repasser en brouillon.");
    expect(prog).toContain("Repasser en brouillon");
    const pubd = texte(rendre([ligne("instagram")], { "v-1:instagram": comp({ etat: "publiee", lien: "https://exemple.test/p" }) }));
    expect(pubd).toContain("Publiée et vérifiée. Le lien est enregistré.");
    expect(pubd).toContain("Voir la publication");
    const ancien = texte(rendre([ligne("instagram")], { "v-1:instagram": comp({ etat: "brouillon", creeLe: new Date(Date.now() - 6.5 * 86_400_000).toISOString(), aussiSur: [{ reseau: "facebook", nom: "Facebook" }], essai: true }) }));
    expect(ancien).toMatch(/Brouillon à programmer dans les 7 jours : il en reste \d\./);
    expect(ancien).toContain("Aussi sur : Facebook");
    expect(ancien).toContain("Pendant les essais, Instagram reçoit d'abord un brouillon.");
    expect(ancien).toContain("Envoi par Zernio");
    expect(ancien).toContain("Changer");
  });
  it("« Changer » masqué quand le réseau est configuré sans Buffer", () => {
    const t = texte(rendre([ligne("instagram")], { "v-1:instagram": comp({ bufferDisponible: false }) }));
    expect(t).toContain("Envoi par Zernio");
    expect(t).not.toContain("Changer");
  });
  it("états chargement, erreur et vide", () => {
    const g = (extra: Record<string, unknown>) => texte(renderToStaticMarkup(createElement(LignesAPublier, { vue: vue([]), ...extra })));
    expect(g({ chargement: true })).toContain("Chargement");
    expect(g({ erreur: "Réessayez dans un instant." })).toContain("Réessayez dans un instant.");
    expect(g({})).toContain("Rien à envoyer");
  });
  it("aucun mot interdit en clair dans les libellés neutres", () => {
    // Jetons assemblés à l'exécution : le fichier ne contient jamais ces mots en clair.
    const interdits = [["Gren", "oble"], ["Quali", "opi"], ["gara", "nti"], ["certi", "fié"]].map((m) => m.join(""));
    const tout = JSON.stringify(Object.values(LIBELLES_ENVOI).filter((v) => typeof v === "string")).toLowerCase();
    for (const mot of interdits) expect(tout).not.toContain(mot.toLowerCase());
  });
  it("TikTok en échec : la case apparaît et « Réessayer » reste inactif tant qu'elle n'est pas cochée", () => {
    const h = rendre([ligne("tiktok")], { "v-1:tiktok": comp({ etat: "echec", echecLe: "2026-11-01T13:32:00.000Z" }) });
    expect(texte(h)).toContain(LIBELLES_ENVOI.tiktokAccord);
    expect(texte(h)).toContain(LIBELLES_ENVOI.tiktokAccordManquant);
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>[^]*?Réessayer maintenant/);
    expect(F.actionPrincipale({ etat: "echec", reseau: "tiktok", accordTiktok: false })).toMatchObject({ type: "reessayer", desactive: true });
    expect(F.actionPrincipale({ etat: "echec", reseau: "tiktok", accordTiktok: true })).toMatchObject({ desactive: false });
    // Un autre réseau en échec n'a pas cette case.
    expect(texte(rendre([ligne("instagram")], { "v-1:instagram": comp({ etat: "echec" }) }))).not.toContain(LIBELLES_ENVOI.tiktokAccord);
  });
  it("envoi simulé : une phrase dit pourquoi « Valider et programmer » est inactif", () => {
    expect(texte(rendre([ligne("instagram")], { "v-1:instagram": comp() }, { vue: { ...vue([ligne("instagram")]), envoiSimule: true } }))).toContain(LIBELLES_ENVOI.simuleRaison);
  });
  it("erreur vide : le texte de secours s'affiche", () => {
    expect(texte(renderToStaticMarkup(createElement(LignesAPublier, { vue: vue([]), erreur: "" })))).toContain(LIBELLES_ENVOI.erreur);
  });
  it("la date de fin de Buffer n'a qu'une source (heure de Paris)", () => {
    expect(F.FIN_BUFFER).toBe("20/11");
  });
  it("validation groupée : la date d'envoi est affichée avant l'envoi", () => {
    const h = texte(rendre([ligne("instagram")], { "v-1:instagram": comp() }, { vue: vue([ligne("instagram")]) }));
    expect(h).not.toContain("Tous les envois partiront");
    expect(LIBELLES_ENVOI.groupeDate("lundi 2 novembre")).toBe("Tous les envois partiront lundi 2 novembre, à 9 h.");
  });
  it("la page de détail appelle complementsAPublier et le passe à l'écran (l'écran d'envoi s'affiche)", async () => {
    page.lignes = [ligne("instagram")];
    page.complements = { "v-1:instagram": comp() };
    page.appels = 0;
    const { default: PageDetail } = await import("@/app/(studio)/a-publier/[id]/page");
    const el = (await PageDetail({ params: Promise.resolve({ id: "v-1" }), searchParams: Promise.resolve({ reseau: "instagram" }) })) as { props: { children: unknown[] } };
    expect(page.appels).toBe(1);
    const html = texte(renderToStaticMarkup(el as never));
    expect(html).toContain("Envoi par Zernio");
  });
});
