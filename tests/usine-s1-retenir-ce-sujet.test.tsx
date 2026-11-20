/**
 * PR S1 · « Retenir ce sujet » sur la carte d'une proposition de la semaine. Aucun réseau, aucun modèle, aucune dépense :
 * `fetch` et l'action sont des doublures. Le jeu du contrat (PR #50 de l'usine) est recopié avec son empreinte.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
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
const rendre = (retenir?: Parameters<typeof CarteProposition>[0]["retenir"], sujet: IdeeUsine | null = idee) => {
  curseur = 0;
  return CarteProposition({ entree, lienAValider: "/a-valider", ...(sujet ? { sujet } : {}), ...(retenir ? { retenir } : {}) }) as ReactElement;
};
const texte = (n: ReactNode): string => (Array.isArray(n) ? n.map(texte).join("") : typeof n === "string" || typeof n === "number" ? String(n) : n && typeof n === "object" && "props" in n ? texte((n as ReactElement<{ children?: ReactNode }>).props.children) : "");
const bouton = (arbre: ReactElement) => trouver(arbre, (e) => e.type === "button");

describe("bouton « Retenir ce sujet »", () => {
  beforeEach(() => { etats.length = 0; });

  it("une proposition sans sujet n'a pas de bouton", () => {
    expect(bouton(rendre(undefined, null))).toBeNull();
    expect(renderToStaticMarkup(<CarteProposition entree={entree} lienAValider="/a-valider" />)).not.toContain("<button");
  });

  it("avec sujet : bouton en français simple, appelle l'action avec le sujet, le jour et le réseau de la carte, puis « Retenu »", async () => {
    const retenir = vi.fn(async () => ({ ok: true as const, donnees: { id: "suj-1", rappelUsine: false } }));
    expect(texte(bouton(rendre(retenir))!)).toBe("Retenir ce sujet");
    await bouton(rendre(retenir))!.props.onClick!();
    expect(retenir).toHaveBeenCalledWith(idee, "2026-11-24", "instagram");
    const apres = rendre(retenir);
    expect(texte(bouton(apres)!)).toBe("Retenu");
    expect(bouton(apres)!.props.disabled).toBe(true);
  });

  it("le sujet est repris de l'entrée quand elle le porte (liste des propositions)", () => {
    curseur = 0;
    const arbre = CarteProposition({ entree: { ...entree, sujet: idee } as EntreeCarte, lienAValider: "/a-valider" }) as ReactElement;
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
