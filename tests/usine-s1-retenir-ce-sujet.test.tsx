/**
 * PR S1 · « Retenir ce sujet » sur la carte d'une proposition de la semaine. Aucun réseau, aucun modèle, aucune dépense :
 * `fetch` et l'action sont des doublures. Le jeu du contrat (PR #50 de l'usine) est recopié avec son empreinte.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Crochets de React remplacés par un état simple, pour piloter le bouton sans navigateur.
const etats: unknown[] = [];
let curseur = 0;
vi.mock("react", async (orig) => {
  const reel = await orig<typeof import("react")>();
  return {
    ...reel,
    useState: (init: unknown) => {
      const i = curseur++;
      if (!(i in etats)) etats[i] = init;
      return [etats[i], (v: unknown) => { etats[i] = v; }];
    },
    useRef: (init: unknown) => {
      const i = curseur++;
      if (!(i in etats)) etats[i] = { current: init };
      return etats[i];
    },
  };
});
vi.mock("server-only", () => ({}));

const { CarteProposition, PHRASE_RETENU_SANS_USINE } = await import("@/components/calendrier/CarteProposition");
const porte = await import("@/services/usine-porte");
const { lireIdeesUsine } = await import("@/domaine/usine");
import type { IdeeUsine } from "@/domaine/usine";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";

const DOSSIER = new URL("./fixtures/usine-porte-contrat/", import.meta.url);
const lire = <T,>(nom: string): T => JSON.parse(readFileSync(new URL(nom, DOSSIER), "utf8")) as T;
const ENV = { USINE_URL: "https://usine.test/", USINE_PORTE_SECRET: "x".repeat(40) };
const F = (f: unknown) => f as unknown as typeof fetch;
const reponse = (statut: number, corps: unknown) => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });

describe("contrat recopié · jeu et empreinte", () => {
  it("l'empreinte du jeu recopié est celle de l'usine (PR #50)", () => {
    const h = createHash("sha256");
    for (const nom of readdirSync(DOSSIER).filter((n) => n.endsWith(".json")).sort()) h.update(`${nom}\n${readFileSync(new URL(nom, DOSSIER), "utf8").replaceAll("\r\n", "\n")}\n`, "utf8");
    const calculee = h.digest("hex");
    expect(calculee).toBe(readFileSync(new URL("EMPREINTE.sha256", DOSSIER), "utf8").trim());
    expect(calculee).toBe("f2eb03e9f281978bc1c69ef53b06fe90179db2e544aff7c87b6eea351a2cc926");
  });

  // Dérive : comparaison à la SOURCE (dépôt de l'Usine) quand elle est là, sans réseau. En local : USINE_CONTRAT_DIR=<usine>/tests/contrat/fixtures
  // (ou le dépôt de l'Usine posé à côté). En CI, si l'étape de CI récupère l'Usine et fixe USINE_CONTRAT_DIR, le test compare ; sinon il est
  // signalé « ignoré » (jamais vert par défaut sans le dire). USINE_CONTRAT_EXIGE=1 le rend obligatoire (échec si la source manque).
  const SOURCE = [process.env.USINE_CONTRAT_DIR, resolve(process.cwd(), "../usine-axion-ia-public/tests/contrat/fixtures"), resolve(process.cwd(), "../will383842/usine-axion-ia-public/tests/contrat/fixtures")].find((d) => !!d && existsSync(d));
  const sansSource = !SOURCE && process.env.USINE_CONTRAT_EXIGE !== "1";
  it.skipIf(sansSource)("dérive : le jeu recopié est identique, fichier par fichier, à la source de l'Usine, et l'empreinte est celle de son contrat", () => {
    expect(SOURCE, "source du contrat introuvable : fixer USINE_CONTRAT_DIR").toBeTruthy();
    const noms = (d: string | URL) => readdirSync(d).filter((n) => n.endsWith(".json")).sort();
    expect(noms(DOSSIER)).toEqual(noms(SOURCE!));
    for (const nom of noms(SOURCE!)) expect(readFileSync(new URL(nom, DOSSIER), "utf8").replaceAll("\r\n", "\n"), nom).toBe(readFileSync(resolve(SOURCE!, nom), "utf8").replaceAll("\r\n", "\n"));
    const doc = resolve(SOURCE!, "../../../docs/CONTRAT-PORTE.md");
    if (existsSync(doc)) expect(readFileSync(doc, "utf8")).toContain(readFileSync(new URL("EMPREINTE.sha256", DOSSIER), "utf8").trim());
  });

  it("le jeu d'erreurs contient les sept codes de la semaine", () => {
    const { codes } = lire<{ codes: string[] }>("erreurs.json");
    for (const c of ["arrete", "aucun_compte", "aucun_sujet", "aucun_format", "rythme_zero", "semaine_pleine", "semaine_passee"]) expect(codes).toContain(c);
  });

  it("chaque code d'erreur 409 de l'Usine est rendu avec sa phrase, telle quelle", async () => {
    const { codes } = lire<{ codes: string[] }>("erreurs.json");
    for (const code of codes) {
      const phrase = `Phrase de l'Usine pour ${code}.`;
      const f = vi.fn(async () => reponse(409, { erreur: phrase, code }));
      await expect(porte.proposerSemaineUsine({ debut: "2026-11-23" }, { env: ENV, fetchImpl: F(f) })).rejects.toMatchObject({ code: `USINE_${code.toUpperCase()}`, message: phrase });
    }
  });

  it("la fixture de retenir reste acceptée telle quelle, jour et réseau facultatifs", () => {
    const base = lire<Record<string, unknown>>("retenir-sujet.json");
    expect(Object.keys(base)).not.toContain("jour");
  });
});

const ligneSujet = {
  signature: "plombier|tpe|devis|d12|c01||tableau-anime|scène vécue",
  parts: { metier: "plombier", taille: "TPE", douleur: "d12", cas_usage: "c01", actualite: null, format: "tableau-anime", structure: "scène vécue" },
  metier: { code: "plombier", libelle: "Plombier" },
  taille: { code: "TPE", libelle: "TPE" },
  douleur: { code: "d12", dite: "Les devis traînent trois jours." },
  cas_usage: { code: "c01", titre: "Un devis envoyé dans l'heure." },
  format: { code: "tableau-anime", libelle: "Tableau animé" },
};

describe("lecture du champ sujet de la proposition", () => {
  const base = { cle: "a".repeat(64), jour: "2026-11-24", reseau: "instagram", type: "video", heure: "12:30" };
  it("une proposition avec sujet le rend lisible ; sans sujet, rien", () => {
    const [avec, sans, casse] = porte.lireSemaineUsine({ propositions: [{ ...base, sujet: ligneSujet }, { ...base, cle: "b" }, { ...base, cle: "c", sujet: { signature: "" } }] });
    expect(avec.sujet?.signature).toBe(ligneSujet.signature);
    expect(avec.sujet?.parts).toEqual(ligneSujet.parts);
    expect(sans.sujet).toBeUndefined();
    expect(casse.sujet).toBeUndefined();
  });
});

describe("réponse partielle : le message de l'Usine est lu", () => {
  it("lireMessageSemaineUsine rend la phrase telle quelle, bornée ; rien sans message", () => {
    expect(porte.lireMessageSemaineUsine({ propositions: [], message: "TikTok n'est pas proposé : aucun compte actif." })).toBe("TikTok n'est pas proposé : aucun compte actif.");
    expect(porte.lireMessageSemaineUsine({ propositions: [] })).toBeUndefined();
    expect(porte.lireMessageSemaineUsine({ message: 5 })).toBeUndefined();
    expect(porte.lireMessageSemaineUsine(null)).toBeUndefined();
  });
  it("proposerSemaineUsineAvecMessage rend lignes et message ; proposerSemaineUsine reste un tableau", async () => {
    const f = vi.fn(async () => reponse(200, { propositions: [{ cle: "a", jour: "2026-11-24", reseau: "instagram", type: "video" }], message: "TikTok n'est pas proposé : aucun compte actif." }));
    const r = await porte.proposerSemaineUsineAvecMessage({ debut: "2026-11-23" }, { env: ENV, fetchImpl: F(f) });
    expect(r.message).toBe("TikTok n'est pas proposé : aucun compte actif.");
    expect(r.lignes).toHaveLength(1);
    expect(await porte.proposerSemaineUsine({ debut: "2026-11-23" }, { env: ENV, fetchImpl: F(f) })).toHaveLength(1);
  });
});

describe("retenir : jour et réseau transmis à la porte", () => {
  const origine = { signature: "s", parts: { metier: "m" }, typeContenu: "video" as const };
  const corps = (f: ReturnType<typeof vi.fn>) => JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body) as Record<string, unknown>;
  it("dans avecViseeUsine : jour et reseau partent avec la retenue", async () => {
    const f = vi.fn(async () => reponse(200, { signature: "s", deja: false }));
    const ok = await porte.avecViseeUsine({ jour: "2026-11-24", reseau: "instagram" }, () => porte.retenirSujetUsine(origine, "sujet-1", { env: ENV, fetchImpl: F(f) }));
    expect(ok).toBe(true);
    expect(corps(f)).toMatchObject({ jour: "2026-11-24", reseau: "instagram", reference_studio: "sujet-1", type_contenu: "video" });
  });
  it("hors de la carte : le corps ne change pas (ni jour ni reseau)", async () => {
    const f = vi.fn(async () => reponse(200, { signature: "s", deja: false }));
    await porte.retenirSujetUsine(origine, "sujet-1", { env: ENV, fetchImpl: F(f) });
    expect(Object.keys(corps(f)).sort()).toEqual(["parts", "reference_studio", "signature", "type_contenu"]);
  });
});

const idee: IdeeUsine = lireIdeesUsine({ lignes: [ligneSujet] })[0];
const entree: EntreeCarte = { cle: "p1", jour: "2026-11-24", reseau: "instagram", type: "video", etat: "propose", heure: "12:30" };

function trouver(n: ReactNode, quoi: (e: ReactElement<{ children?: ReactNode }>) => boolean): ReactElement<{ children?: ReactNode; onClick?: () => void; disabled?: boolean }> | null {
  if (Array.isArray(n)) return n.map((x) => trouver(x, quoi)).find(Boolean) ?? null;
  if (!n || typeof n !== "object" || !("props" in n)) return null;
  const e = n as ReactElement<{ children?: ReactNode }>;
  return (quoi(e) ? e : trouver(e.props.children, quoi)) as never;
}
const rendre = (retenir?: Parameters<typeof CarteProposition>[0]["retenir"], sujet: IdeeUsine | null = idee, debut: string | null = "2026-11-23") => {
  curseur = 0;
  return CarteProposition({ entree, ...(debut ? { debut } : {}), ...(sujet ? { sujet } : {}), ...(retenir ? { retenir } : {}) }) as ReactElement;
};
const texte = (n: ReactNode): string => (Array.isArray(n) ? n.map(texte).join("") : typeof n === "string" || typeof n === "number" ? String(n) : n && typeof n === "object" && "props" in n ? texte((n as ReactElement<{ children?: ReactNode }>).props.children) : "");
const bouton = (arbre: ReactElement) => trouver(arbre, (e) => e.type === "button");

describe("bouton « Retenir ce sujet »", () => {
  beforeEach(() => { etats.length = 0; });

  it("une proposition sans sujet n'a pas de bouton", () => {
    expect(bouton(rendre(undefined, null))).toBeNull();
    expect(renderToStaticMarkup(<CarteProposition entree={entree} />)).not.toContain("<button");
  });

  it("avec sujet : bouton en français simple, n'envoie à l'action que le lundi et la clé de la carte (ni sujet, ni jour, ni réseau), puis « Retenu »", async () => {
    const retenir = vi.fn(async () => ({ ok: true as const, donnees: { id: "suj-1", rappelUsine: false } }));
    expect(texte(bouton(rendre(retenir))!)).toBe("Retenir ce sujet");
    await bouton(rendre(retenir))!.props.onClick!();
    expect(retenir).toHaveBeenCalledWith("2026-11-23", "p1");
    const apres = rendre(retenir);
    expect(texte(bouton(apres)!)).toBe("Retenu");
    expect(bouton(apres)!.props.disabled).toBe(true);
  });

  it("le lien « Voir dans « Écrire » » est absent avant la retenue, présent (vers /ecrire) après", async () => {
    const retenir = vi.fn(async () => ({ ok: true as const, donnees: { id: "suj-1", rappelUsine: false } }));
    const lien = (arbre: ReactElement) => trouver(arbre, (e) => (e.props as { href?: string }).href !== undefined);
    const avant = rendre(retenir);
    expect(lien(avant)).toBeNull();
    expect(texte(avant)).not.toContain("Voir dans");
    await bouton(rendre(retenir))!.props.onClick!();
    const apres = rendre(retenir);
    expect((lien(apres)!.props as { href?: string }).href).toBe("/ecrire");
    expect(texte(lien(apres)!)).toBe("Voir dans « Écrire »");
    expect(texte(apres)).not.toContain("À valider");
  });

  it("sans lundi connu : pas de bouton (rien ne pourrait être retrouvé côté serveur)", () => {
    expect(bouton(rendre(undefined, idee, null))).toBeNull();
  });

  it("le sujet est repris de l'entrée quand elle le porte (liste des propositions)", () => {
    curseur = 0;
    const arbre = CarteProposition({ entree: { ...entree, sujet: idee } as EntreeCarte, debut: "2026-11-23" }) as ReactElement;
    expect(bouton(arbre)).not.toBeNull();
  });

  it("la phrase d'erreur de l'Usine est affichée telle quelle, le bouton reste utilisable", async () => {
    const phrase = "Tout est arrêté dans l'Usine : aucune semaine n'est proposée. Rallumez depuis « Tout arrêter » dans l'Usine.";
    const retenir = vi.fn(async () => ({ ok: false as const, message: phrase, code: "USINE_ARRETE" }));
    await bouton(rendre(retenir))!.props.onClick!();
    const apres = rendre(retenir);
    expect(texte(apres)).toContain(phrase);
    expect(texte(bouton(apres)!)).toBe("Retenir ce sujet");
    expect(bouton(apres)!.props.disabled).toBe(false);
  });

  it("Usine non prévenue après l'écriture : « Retenu » avec une phrase claire", async () => {
    const retenir = vi.fn(async () => ({ ok: true as const, donnees: { id: "s", rappelUsine: true } }));
    await bouton(rendre(retenir))!.props.onClick!();
    const apres = rendre(retenir);
    expect(texte(bouton(apres)!)).toBe("Retenu");
    expect(texte(apres)).toContain(PHRASE_RETENU_SANS_USINE);
  });

  it("double clic : un seul appel", async () => {
    let fin!: () => void;
    const retenir = vi.fn(() => new Promise<{ ok: true; donnees: { id: string; rappelUsine: boolean } }>((r) => { fin = () => r({ ok: true, donnees: { id: "s", rappelUsine: false } }); }));
    const clic = bouton(rendre(retenir))!.props.onClick!;
    const p1 = clic();
    const p2 = clic();
    fin();
    await Promise.all([p1, p2]);
    expect(retenir).toHaveBeenCalledTimes(1);
    // Déjà retenu : un nouveau clic sur la carte rendue ne fait rien non plus.
    await bouton(rendre(retenir))!.props.onClick!();
    expect(retenir).toHaveBeenCalledTimes(1);
  });
});
