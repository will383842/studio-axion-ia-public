/**
 * RC-36 : aperçu de la publication sur place (panneau latéral du calendrier).
 * Sans DOM (crochets factices, le dépôt n'a pas jsdom) : on lit l'arbre rendu et on appelle nous-mêmes les gestes.
 * Données fictives, aucun appel réel : le décalage (action L4-06) est une doublure.
 */
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("./aides/crochets-factices")).crochets }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
const listerCalendrier = vi.fn(async () => [] as unknown[]);
vi.mock("@/services/publications", () => ({ listerCalendrier: () => listerCalendrier(), listerAProgrammer: async () => [] }));

const { attendre, monter, trouver, texteDe } = await import("./aides/crochets-factices");
const outils = await import("@/components/calendrier/apercu-reseau");
const { ApercuPublication, SemaineAvecApercu } = await import("@/components/calendrier/ApercuPublication");
const { GrilleSemaine } = await import("@/components/calendrier/GrilleSemaine");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;
type Props = import("@/components/calendrier/ApercuPublication").ProprietesApercuPublication;

const AUJOURDHUI = "2026-11-11"; // mercredi
const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const lisible = (html: string) =>
  [html.replace(/<[^>]*>/g, " "), ...[...html.matchAll(/(?:aria-label|title|alt)="([^"]*)"/g)].map((m) => m[1])].join(" ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

function entree(sur: Partial<Entree> = {}): Entree {
  return {
    cle: "creneau:c1|linkedin",
    jour: "2026-11-12",
    reseau: "linkedin",
    type: "video",
    etat: "a_valider",
    heure: "09:00",
    titre: "Le devis qui part tout seul",
    texte: "Trois e-mails sur quatre se trient sans vous. #IA #Productivité",
    premierCommentaire: "Combien de temps pour répondre à un devis chez vous ?",
    media: { genre: "video", url: "https://exemple.fr/video.mp4" },
    ...sur,
  };
}
const trois = (): Entree[] => [
  entree({ cle: "creneau:c1|linkedin", jour: "2026-11-12", heure: "09:00" }),
  entree({ cle: "creneau:c2|instagram", reseau: "instagram", jour: "2026-11-12", heure: "18:30", type: "image", media: { genre: "image", url: "https://exemple.fr/a.png" } }),
  entree({ cle: "creneau:c3|tiktok", reseau: "tiktok", jour: "2026-11-13", heure: "12:00", premierCommentaire: undefined }),
];

/* ------------------------------------------------------------------ */
describe("mots-dièse", () => {
  it("extrait sans doublon (casse ignorée), dans l'ordre, sans « # » seul ni fragment collé à un mot", () => {
    expect(outils.extraireHashtags("Bonjour #IA et #Formation_IA, puis #ia #2026 # titre C#sharp a#b")).toEqual(["#IA", "#Formation_IA", "#2026"]);
  });
  it("vide, illisible ou sans mot-dièse : liste vide", () => {
    expect(outils.extraireHashtags("")).toEqual([]);
    expect(outils.extraireHashtags(undefined as unknown as string)).toEqual([]);
    expect(outils.extraireHashtags("Pas de mot-clé ici.")).toEqual([]);
  });
});

describe("aperçu façon réseau", () => {
  it("chaque réseau a sa disposition : texte au-dessus (LinkedIn, Facebook), visuel d'abord (Instagram), légende sur le visuel (TikTok)", () => {
    const d = (reseau: string) => outils.apercuReseau(entree({ reseau: reseau as Entree["reseau"] }), AUJOURDHUI).disposition;
    expect(d("linkedin")).toBe("texte-dessus");
    expect(d("facebook")).toBe("texte-dessus");
    expect(d("instagram")).toBe("media-dessus");
    expect(d("tiktok")).toBe("legende-sur-media");
  });
  it("porte le nom du réseau, le format, le texte, les mots-dièse, le premier commentaire, la campagne", () => {
    const a = outils.apercuReseau(entree({ campagne: "Rentrée 2026" }), AUJOURDHUI);
    expect(a.nomReseau).toBe("LinkedIn");
    expect(a.formatLibelle).toMatch(/^Vidéo · \d+:\d+$/);
    expect(a.texte).toContain("Trois e-mails");
    expect(a.hashtags).toEqual(["#IA", "#Productivité"]);
    expect(a.premierCommentaire).toBe("Combien de temps pour répondre à un devis chez vous ?");
    expect(a.campagne).toBe("Rentrée 2026");
  });
  it("sans premier commentaire : il est dit ; sur TikTok il n'existe pas ; sans campagne : aucune ligne", () => {
    expect(outils.apercuReseau(entree({ premierCommentaire: undefined }), AUJOURDHUI).phrasePremierCommentaire).toBe("Aucun premier commentaire prévu.");
    expect(outils.apercuReseau(entree({ premierCommentaire: "   " }), AUJOURDHUI).premierCommentaire).toBeNull();
    const tt = outils.apercuReseau(entree({ reseau: "tiktok", premierCommentaire: "ignoré" }), AUJOURDHUI);
    expect(tt.premierCommentaire).toBeNull();
    expect(tt.phrasePremierCommentaire).toBe("Pas de premier commentaire sur TikTok.");
    expect(outils.apercuReseau(entree(), AUJOURDHUI).campagne).toBeNull();
    expect(outils.apercuReseau(entree({ campagne: "  " }), AUJOURDHUI).campagne).toBeNull();
  });
  it("la date se dit en français, à l'heure de Paris ; heure ou jour illisibles : jamais « undefined »", () => {
    expect(outils.apercuReseau(entree({ jour: "2026-12-03", heure: "09:00" }), AUJOURDHUI).dateDite).toBe("jeudi 3 décembre 2026 à 09:00, heure de Paris");
    expect(outils.apercuReseau(entree({ jour: "2026-12-03", heure: "25:99" }), AUJOURDHUI).dateDite).toBe("jeudi 3 décembre 2026");
    expect(outils.apercuReseau(entree({ jour: "2026-02-30" }), AUJOURDHUI).dateDite).toBe("Date illisible");
    expect(outils.apercuReseau(entree({ jour: "" }), AUJOURDHUI).dateDite).toBe("Date illisible");
  });
  it("la date n'est modifiable qu'à partir d'aujourd'hui ; publiée, passée, confiée au diffuseur, illisible : verrouillée avec sa phrase", () => {
    const v = (e: Partial<Entree>) => outils.apercuReseau(entree(e), AUJOURDHUI);
    expect(v({ jour: AUJOURDHUI }).verrou).toBeNull(); // limite exacte : aujourd'hui reste modifiable
    expect(v({ jour: "2026-11-10" }).verrou).toBe("passee"); // veille : verrouillée
    expect(v({ etat: "publie" }).verrou).toBe("publiee");
    expect(v({ etat: "programme" }).verrou).toBe("confiee");
    expect(v({ confiee: true }).verrou).toBe("confiee");
    expect(v({ jour: "n'importe quoi" }).verrou).toBe("illisible");
    expect(v({ etat: "publie" }).phraseVerrou).toBe("Déjà publiée. Elle n'est plus modifiable.");
    expect(v({}).phraseVerrou).toBeNull();
  });
  it("le visuel est une vidéo lisible sur place ou une image ; sans adresse : « Visuel à venir »", () => {
    expect(outils.apercuReseau(entree(), AUJOURDHUI).media).toEqual({ genre: "video", url: "https://exemple.fr/video.mp4", poster: null, ratio: expect.any(String) });
    expect(outils.apercuReseau(entree({ media: undefined }), AUJOURDHUI).media).toEqual({ genre: "absent", url: null, poster: null, ratio: expect.any(String) });
    expect(outils.apercuReseau(entree({ media: { genre: "video", url: "" } }), AUJOURDHUI).media.url).toBeNull();
    expect(outils.apercuReseau(entree({ media: { genre: "image", url: "https://exemple.fr/a.png", ratio: "4:5" } }), AUJOURDHUI).media.ratio).toBe("4:5");
  });
});

describe("passer à la suivante", () => {
  it("suit l'ordre de la grille (jour, heure), revient au début après la dernière, et inversement", () => {
    const liste = [trois()[2], trois()[0], trois()[1]]; // désordre volontaire
    expect(outils.entreeVoisine(liste, "creneau:c1|linkedin", 1)?.cle).toBe("creneau:c2|instagram");
    expect(outils.entreeVoisine(liste, "creneau:c2|instagram", 1)?.cle).toBe("creneau:c3|tiktok");
    expect(outils.entreeVoisine(liste, "creneau:c3|tiktok", 1)?.cle).toBe("creneau:c1|linkedin");
    expect(outils.entreeVoisine(liste, "creneau:c1|linkedin", -1)?.cle).toBe("creneau:c3|tiktok");
  });
  it("liste vide, clé inconnue ou illisible : aucune entrée ; une seule entrée : elle-même ; la liste n'est pas modifiée", () => {
    expect(outils.entreeVoisine([], "x", 1)).toBeNull();
    expect(outils.entreeVoisine(trois(), "creneau:inconnue|linkedin", 1)).toBeNull();
    expect(outils.entreeVoisine(trois(), undefined as unknown as string, 1)).toBeNull();
    expect(outils.entreeVoisine([entree()], "creneau:c1|linkedin", 1)?.cle).toBe("creneau:c1|linkedin");
    const liste = [trois()[2], trois()[0]];
    const avant = liste.map((e) => e.cle);
    outils.entreeVoisine(liste, "creneau:c1|linkedin", 1);
    expect(liste.map((e) => e.cle)).toEqual(avant);
  });
});

describe("déplacer une entrée dans la liste", () => {
  it("ne change que le jour de l'entrée visée, sans modifier la liste reçue ; clé inconnue ou jour illisible : liste identique", () => {
    const liste = trois();
    const apres = outils.deplacerEntree(liste, "creneau:c1|linkedin", "2026-11-14");
    expect(apres.find((e) => e.cle === "creneau:c1|linkedin")?.jour).toBe("2026-11-14");
    expect(apres.filter((e) => e.cle !== "creneau:c1|linkedin")).toEqual(liste.filter((e) => e.cle !== "creneau:c1|linkedin"));
    expect(liste[0].jour).toBe("2026-11-12");
    expect(outils.deplacerEntree(liste, "creneau:zzz|linkedin", "2026-11-14")).toBe(liste);
    expect(outils.deplacerEntree(liste, "creneau:c1|linkedin", "2026-13-40")).toBe(liste);
  });
});

describe("depuis une publication du calendrier", () => {
  const pub = (sur: Record<string, unknown> = {}) => ({
    id: "pub1",
    reseau: "instagram" as const,
    statut: "programmee" as const,
    via: "buffer" as const,
    date: "2026-11-12T08:30:00.000Z", // 09:30 à Paris
    texte: "Un texte #IA",
    videoId: "v1",
    canalNom: "Compte exemple",
    video: { titre: "Titre exemple", vignette: "https://exemple.fr/v.png", video: "https://exemple.fr/v.mp4" },
    ...sur,
  });
  it("clé « publication:<id>|<réseau> », jour et heure de Paris, vidéo lisible, état en mots", () => {
    const e = outils.entreeDepuisPublication(pub());
    expect(e).toMatchObject({ cle: "publication:pub1|instagram", jour: "2026-11-12", heure: "09:30", reseau: "instagram", etat: "programme", type: "video", titre: "Titre exemple", texte: "Un texte #IA", lienSource: "/videos/v1" });
    expect(e.media).toMatchObject({ genre: "video", url: "https://exemple.fr/v.mp4" });
  });
  it("un essai est un état à part (« Essai »), jamais « Programmé » ; une source visuelle donne une image ; aucun mot interne ne passe", () => {
    expect(outils.entreeDepuisPublication(pub({ via: "simulation" })).etat).toBe("essai");
    expect(outils.LIBELLES_ESSAI.essai.libelle).toBe("Essai");
    expect(outils.apercuReseau(outils.entreeDepuisPublication(pub({ via: "simulation" })), AUJOURDHUI).phraseEtat).toBe("Essai : rien n'est parti vers le réseau.");
    const v = outils.entreeDepuisPublication(pub({ videoId: undefined, visuelId: "vis1", video: null }));
    expect(v.type).toBe("image");
    expect(v.lienSource).toBeUndefined();
    expect(outils.entreeDepuisPublication(pub({ statut: "echec" })).etat).toBe("a_corriger");
    expect(outils.entreeDepuisPublication(pub({ statut: "inconnu" })).etat).toBe("inconnu");
  });
});

/* ------------------------------------------------------------------ */
describe("ApercuPublication (le panneau)", () => {
  const base = (sur: Partial<Props> = {}): Props => ({ entree: entree(), aujourdhui: AUJOURDHUI, onPrecedente: vi.fn(), onSuivante: vi.fn(), onFermer: vi.fn(), onChangerDate: vi.fn(), ...sur });
  const html = (sur: Partial<Props> = {}) => rendre(<ApercuPublication {...base(sur)} />);

  it("montre le rendu du réseau : texte, mots-dièse, premier commentaire, format, date, statut, vidéo lisible", () => {
    const h = html({ entree: entree({ campagne: "Rentrée 2026" }) });
    const t = lisible(h);
    expect(h).toContain('role="dialog"');
    expect(h).toMatch(/aria-label="Aperçu de la publication/);
    expect(t).toContain("LinkedIn");
    expect(t).toContain("Trois e-mails sur quatre se trient sans vous.");
    expect(t).toContain("#Productivité");
    expect(t).toContain("Premier commentaire");
    expect(t).toContain("Combien de temps pour répondre à un devis chez vous ?");
    expect(t).toContain("jeudi 12 novembre 2026 à 09:00, heure de Paris");
    expect(t).toContain("Rentrée 2026");
    expect(t).toContain("À valider");
    expect(t).toContain("Ne partira pas tant que vous n'avez pas validé.");
    expect(h).toMatch(/<video[^>]*controls/);
    expect(h).toContain('src="https://exemple.fr/video.mp4"');
    expect(h).not.toMatch(/<video[^>]*autoplay/i);
  });
  it("une image s'affiche en image, jamais dans un lecteur ; sans visuel : « Visuel à venir »", () => {
    expect(html({ entree: entree({ media: { genre: "image", url: "https://exemple.fr/a.png" } }) })).not.toContain("<video");
    expect(html({ entree: entree({ media: { genre: "image", url: "https://exemple.fr/a.png" } }) })).toContain("exemple.fr");
    const t = lisible(html({ entree: entree({ media: undefined }) }));
    expect(t).toContain("Visuel à venir");
  });
  it("TikTok : la légende est sur le visuel et il n'y a pas de premier commentaire", () => {
    const h = html({ entree: entree({ reseau: "tiktok", premierCommentaire: "ignoré" }) });
    expect(h).toContain('data-disposition="legende-sur-media"');
    expect(lisible(h)).toContain("Pas de premier commentaire sur TikTok.");
    expect(lisible(h)).not.toContain("ignoré");
  });
  it("la date est un champ « Déplacer au » ; verrouillée (publiée, passée) : champ éteint avec la raison", () => {
    const ouvert = html();
    expect(ouvert).toMatch(/<input[^>]*type="date"[^>]*value="2026-11-12"/);
    expect(ouvert).toContain(`min="${AUJOURDHUI}"`);
    expect(ouvert).not.toMatch(/<input[^>]*type="date"[^>]*\sdisabled=""/);
    for (const [e, phrase] of [
      [entree({ etat: "publie" }), "Déjà publiée. Elle n'est plus modifiable."],
      [entree({ jour: "2026-11-10" }), "Ce jour est passé : cette publication n'est plus modifiable."],
    ] as const) {
      const h = html({ entree: e });
      expect(h).toMatch(/<input[^>]*type="date"[^>]*\sdisabled=""/);
      expect(lisible(h)).toContain(phrase);
    }
  });
  it("les trois gestes sont nommés : Précédente, Suivante, Fermer ; chacun appelle son geste", () => {
    const p = base();
    const arbre = ApercuPublication(p) as ReactNode;
    const bouton = (mot: string) => trouver(arbre, (e) => e.type === "button" && texteDe(e).includes(mot))[0];
    (bouton("Précédente").props.onClick as () => void)();
    (bouton("Suivante").props.onClick as () => void)();
    (bouton("Fermer").props.onClick as () => void)();
    expect(p.onPrecedente).toHaveBeenCalledTimes(1);
    expect(p.onSuivante).toHaveBeenCalledTimes(1);
    expect(p.onFermer).toHaveBeenCalledTimes(1);
  });
  it("Échap ferme ; les flèches du clavier passent à la précédente / la suivante, sauf dans un champ de saisie", () => {
    const p = base();
    const aside = trouver(ApercuPublication(p) as ReactNode, (e) => e.type === "aside")[0];
    const touche = (key: string, cible = "ASIDE") => (aside.props.onKeyDown as (e: unknown) => void)({ key, target: { tagName: cible }, preventDefault: () => undefined });
    touche("Escape");
    touche("ArrowRight");
    touche("ArrowLeft");
    expect([p.onFermer, p.onSuivante, p.onPrecedente].map((f) => (f as ReturnType<typeof vi.fn>).mock.calls.length)).toEqual([1, 1, 1]);
    touche("ArrowRight", "INPUT");
    touche("ArrowLeft", "TEXTAREA");
    touche("ArrowRight", "SELECT");
    touche("a");
    expect([p.onSuivante, p.onPrecedente].map((f) => (f as ReturnType<typeof vi.fn>).mock.calls.length)).toEqual([1, 1]);
  });
  it("changer la date rend le nouveau jour au geste ; un champ vidé ne déclenche rien", () => {
    const p = base();
    const champ = trouver(ApercuPublication(p) as ReactNode, (e) => e.type === "input" && e.props.type === "date")[0];
    (champ.props.onChange as (e: unknown) => void)({ target: { value: "2026-11-20" } });
    (champ.props.onChange as (e: unknown) => void)({ target: { value: "" } });
    expect(p.onChangerDate).toHaveBeenCalledTimes(1);
    expect(p.onChangerDate).toHaveBeenCalledWith("2026-11-20");
  });
  it("le message d'un refus s'affiche (role=alert) ; le lien vers la vidéo est un lien, pas un envoi", () => {
    const h = html({ message: "Impossible : ce jour est passé.", entree: entree({ lienSource: "/videos/v1" }) });
    expect(h).toMatch(/role="alert"[^>]*>Impossible : ce jour est passé\./);
    expect(h).toContain('href="/videos/v1"');
  });
});

/* ------------------------------------------------------------------ */
describe("SemaineAvecApercu : un clic ouvre, les flèches passent, la date se voit dans la grille", () => {
  type Decaler = NonNullable<import("@/components/calendrier/ApercuPublication").ProprietesSemaineAvecApercu["decaler"]>;
  const ok: Decaler = vi.fn(async () => ({ ok: true as const, donnees: {} as never }));

  function ecran(entrees: Entree[] = trois(), decaler: Decaler = ok) {
    const m = monter(SemaineAvecApercu as (p: unknown) => ReactNode, { entrees, semaineDu: "2026-11-09", aujourdhui: AUJOURDHUI, decaler });
    const grille = () => trouver(m.rendre(), (e) => e.type === GrilleSemaine)[0];
    const panneau = () => trouver(m.rendre(), (e) => e.type === ApercuPublication)[0];
    const ouvrir = (cle: string) => (grille().props.onOuvrirEntree as (e: Entree) => void)(trois().find((x) => x.cle === cle)!);
    return { grille, panneau, ouvrir };
  }
  beforeEach(() => (ok as ReturnType<typeof vi.fn>).mockClear());

  it("fermé au départ ; un clic sur une carte ouvre le panneau sur CETTE entrée, sans quitter la page", () => {
    const e = ecran();
    expect(e.panneau()).toBeUndefined();
    e.ouvrir("creneau:c2|instagram");
    expect((e.panneau().props.entree as Entree).cle).toBe("creneau:c2|instagram");
    expect(e.grille()).toBeDefined(); // la grille reste là
  });
  it("Suivante / Précédente changent l'entrée ouverte (retour au début, fin de liste) ; Fermer referme", () => {
    const e = ecran();
    e.ouvrir("creneau:c3|tiktok");
    (e.panneau().props.onSuivante as () => void)();
    expect((e.panneau().props.entree as Entree).cle).toBe("creneau:c1|linkedin");
    (e.panneau().props.onPrecedente as () => void)();
    expect((e.panneau().props.entree as Entree).cle).toBe("creneau:c3|tiktok");
    (e.panneau().props.onFermer as () => void)();
    expect(e.panneau()).toBeUndefined();
  });
  it("la date changée dans le panneau est dans la grille AUSSITÔT (avant la réponse), via l'action de décalage", async () => {
    let finir!: (r: Awaited<ReturnType<Decaler>>) => void;
    const lent: Decaler = vi.fn(() => new Promise<Awaited<ReturnType<Decaler>>>((r) => (finir = r)));
    const e = ecran(trois(), lent);
    e.ouvrir("creneau:c1|linkedin");
    (e.panneau().props.onChangerDate as (j: string) => void)("2026-11-14");
    const entrees = e.grille().props.entrees as Entree[];
    expect(entrees.find((x) => x.cle === "creneau:c1|linkedin")?.jour).toBe("2026-11-14");
    expect(rendre(e.grille())).toMatch(/data-case="linkedin\|2026-11-14"[^>]*>(?:(?!data-case)[\s\S])*data-carte="creneau:c1\|linkedin"/);
    expect((e.panneau().props.entree as Entree).jour).toBe("2026-11-14");
    expect(lent).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", nouveauJour: "2026-11-14", cle: expect.stringMatching(/^[A-Za-z0-9_-]{1,64}$/) }));
    finir({ ok: true, donnees: {} as never });
    await attendre();
    expect((e.grille().props.entrees as Entree[]).find((x) => x.cle === "creneau:c1|linkedin")?.jour).toBe("2026-11-14");
  });
  it("si l'action refuse : la grille revient au jour d'avant et le motif s'affiche", async () => {
    const refuse: Decaler = vi.fn(async () => ({ ok: false as const, message: "Cette entrée est déjà confiée au diffuseur. Retirez-la d'abord, puis décalez-la." }));
    const e = ecran(trois(), refuse);
    e.ouvrir("creneau:c1|linkedin");
    (e.panneau().props.onChangerDate as (j: string) => void)("2026-11-14");
    await attendre();
    expect((e.grille().props.entrees as Entree[]).find((x) => x.cle === "creneau:c1|linkedin")?.jour).toBe("2026-11-12");
    expect(e.panneau().props.message).toContain("Retirez-la d'abord");
  });
  it("si l'action plante : retour au jour d'avant, phrase claire, jamais le texte brut de l'incident", async () => {
    const plante: Decaler = vi.fn(async () => {
      throw new Error("ECONNRESET interne");
    });
    const e = ecran(trois(), plante);
    e.ouvrir("creneau:c1|linkedin");
    (e.panneau().props.onChangerDate as (j: string) => void)("2026-11-14");
    await attendre();
    expect((e.grille().props.entrees as Entree[]).find((x) => x.cle === "creneau:c1|linkedin")?.jour).toBe("2026-11-12");
    expect(String(e.panneau().props.message)).not.toContain("ECONNRESET");
    expect(String(e.panneau().props.message)).toMatch(/pas pu|réessayez/i);
  });
  it("jour passé, même jour, jour illisible, entrée verrouillée : l'action n'est jamais appelée", async () => {
    const e = ecran(trois().map((x) => (x.cle === "creneau:c3|tiktok" ? { ...x, etat: "publie" as const } : x)));
    e.ouvrir("creneau:c1|linkedin");
    const changer = (j: string) => (e.panneau().props.onChangerDate as (j: string) => void)(j);
    changer("2026-11-10"); // passé
    expect(String(e.panneau().props.message)).toBe("Impossible : ce jour est passé.");
    changer("2026-11-12"); // même jour
    changer("2026-02-30"); // illisible
    changer("");
    (e.panneau().props.onSuivante as () => void)();
    (e.panneau().props.onSuivante as () => void)(); // c3, publiée
    changer("2026-11-20");
    await attendre();
    expect(ok).not.toHaveBeenCalled();
    expect((e.grille().props.entrees as Entree[]).map((x) => x.jour)).toEqual(trois().map((x) => x.jour));
  });
  it("limite exacte : aujourd'hui est accepté ; deux changements coup sur coup : un seul appel tant que le premier n'est pas fini", async () => {
    let finir!: (r: Awaited<ReturnType<Decaler>>) => void;
    const lent: Decaler = vi.fn(() => new Promise<Awaited<ReturnType<Decaler>>>((r) => (finir = r)));
    const e = ecran(trois(), lent);
    e.ouvrir("creneau:c1|linkedin");
    const changer = (j: string) => (e.panneau().props.onChangerDate as (j: string) => void)(j);
    changer(AUJOURDHUI);
    changer("2026-11-15");
    expect(lent).toHaveBeenCalledTimes(1);
    expect(lent).toHaveBeenCalledWith(expect.objectContaining({ nouveauJour: AUJOURDHUI }));
    finir({ ok: true, donnees: {} as never });
    await attendre();
    changer("2026-11-15");
    expect(lent).toHaveBeenCalledTimes(2);
  });
  it("une entrée qui ne vient pas du plan (publication) ne s'envoie jamais à l'action de décalage : phrase claire", async () => {
    const e = ecran([entree({ cle: "publication:p1|linkedin" })]);
    (e.grille().props.onOuvrirEntree as (x: Entree) => void)(entree({ cle: "publication:p1|linkedin" }));
    (e.panneau().props.onChangerDate as (j: string) => void)("2026-11-20");
    await attendre();
    expect(ok).not.toHaveBeenCalled();
    expect(String(e.panneau().props.message)).toContain("vidéo");
  });
  it("déplacée hors de la semaine affichée : le panneau le dit, l'entrée reste ouverte", async () => {
    const e = ecran();
    e.ouvrir("creneau:c1|linkedin");
    (e.panneau().props.onChangerDate as (j: string) => void)("2026-11-25");
    await attendre();
    expect((e.panneau().props.entree as Entree).jour).toBe("2026-11-25");
    expect(String(e.panneau().props.message)).toContain("autre semaine");
  });
  it("un essai porte la pastille « Essai » dans la grille, jamais « Programmé »", () => {
    const e = ecran([entree({ etat: "essai" })]);
    const h = lisible(rendre(e.grille()));
    expect(h).toContain("Essai");
    expect(h).not.toContain("Programmé");
  });
  it("liste vide : grille vide et aucun panneau, sans erreur", () => {
    const e = ecran([]);
    expect(e.panneau()).toBeUndefined();
    expect(rendre(e.grille())).toContain("Rien de prévu");
  });
});

/* ------------------------------------------------------------------ */
describe("page /calendrier : la semaine à l'écran large ouvre l'aperçu sur place", () => {
  it("la page monte la grille avec l'aperçu et chaque carte porte la clé de sa publication", async () => {
    monter(() => null, {}).rendre(); // remet les crochets factices à zéro
    const { cleJour } = await import("@/lib/dates");
    const aujourdhui = cleJour(new Date());
    listerCalendrier.mockResolvedValueOnce([
      { jour: aujourdhui, publications: [{ id: "pubA", reseau: "linkedin", statut: "programmee", via: "manuel", date: new Date().toISOString(), texte: "Un texte exemple", videoId: "vA", reseauNom: "LinkedIn", video: { titre: "Titre A", vignette: null, video: null } }] },
    ]);
    const { default: Page } = await import("../src/app/(studio)/calendrier/page");
    const h = rendre((await Page({ searchParams: Promise.resolve({}) })) as ReactElement);
    expect(h).toContain('data-carte="publication:pubA|linkedin"');
    expect(h).toContain('role="table"');
    expect(h).toContain("/videos/vA"); // la liste mobile garde son lien
  });
});

describe("aucun libellé interdit dans l'aperçu", () => {
  const INTERDITS = [
    /\b(propose|a_valider|a_corriger|valide|programmee|publiee|echec|archive|idee)\b/,
    /[ÉE]chec|Erreur|erreur/,
    /Buffer|diffuseur/i,
    /quota|jauge/i,
    /€|\beuros?\b|\bprix\b|\btarif/i,
    /Supprimer|supprim/i,
    /undefined|\bnull\b|NaN|Invalid Date|\[object/,
    /\bUTC\b|GMT/,
    /\b(tu|ton|tes|toi)\b/i,
    /Message automatique|envoyé par/i,
  ];
  it("pour chaque état, chaque réseau, chaque verrou et chaque type de visuel", () => {
    const etats = ["brouillon", "a_valider", "programme", "publie", "a_corriger", "idee", "inconnu"];
    const textes = etats.flatMap((etat) =>
      (["linkedin", "instagram", "facebook", "tiktok"] as const).flatMap((reseau) =>
        [entree({ etat, reseau }), entree({ etat, reseau, jour: "2026-11-01", media: undefined, premierCommentaire: undefined }), entree({ etat, reseau, media: { genre: "image", url: "https://exemple.fr/a.png" }, campagne: "Rentrée", lienSource: "/videos/v1", confiee: true })].map((e) =>
          lisible(rendre(<ApercuPublication entree={e} aujourdhui={AUJOURDHUI} onPrecedente={() => {}} onSuivante={() => {}} onFermer={() => {}} onChangerDate={() => {}} message="Impossible : ce jour est passé." />)),
        ),
      ),
    );
    const texte = textes.join("\n");
    expect(texte).toContain("Idée de l'IA");
    for (const motif of INTERDITS) expect(texte, String(motif)).not.toMatch(motif);
  });
});

it("sans entrée (fermée ou disparue), le panneau ne rend rien", () => {
  expect(ApercuPublication({ entree: undefined as unknown as Entree, aujourdhui: AUJOURDHUI, onPrecedente: vi.fn(), onSuivante: vi.fn(), onFermer: vi.fn(), onChangerDate: vi.fn() })).toBeNull();
});
