/**
 * « Mon script » (24/10/2026) : le lien sur la feuille « Votre vidéo » et dans « À valider » (trois libellés, jamais en porte B),
 * le formulaire (Vérifier puis Enregistrer, refus avec « Aller à la ligne N »), la page. Pas de DOM dans le dépôt : les crochets
 * de React sont remplacés par un mini banc d'essai (état gardé entre deux rendus), les clics appellent le `onClick` de l'arbre.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const banc = vi.hoisted(() => ({ cases: [] as unknown[], i: 0, transitions: [] as Promise<unknown>[], refs: [] as { current: unknown }[], r: 0 }));
vi.mock("react", async (importOriginal) => {
  const reel = await importOriginal<typeof import("react")>();
  const crochets = {
    useState: (init: unknown) => {
      const k = banc.i++;
      if (!(k in banc.cases)) banc.cases[k] = typeof init === "function" ? (init as () => unknown)() : init;
      return [banc.cases[k], (v: unknown) => void (banc.cases[k] = typeof v === "function" ? (v as (x: unknown) => unknown)(banc.cases[k]) : v)];
    },
    useTransition: () => [false, (f: () => Promise<unknown>) => void banc.transitions.push(Promise.resolve(f()))],
    useRef: () => {
      const k = banc.r++;
      return (banc.refs[k] ??= { current: null });
    },
    useEffect: () => undefined,
    useId: () => "id-test",
  };
  return { ...reel, ...crochets, default: { ...reel, ...crochets } };
});

const actions = vi.hoisted(() => ({
  controler: vi.fn(),
  enregistrer: vi.fn(async () => ({ ok: true as const, donnees: { numero: 1, modifie: true } })),
  revenir: vi.fn(async () => ({ ok: true as const, donnees: { modifie: true } })),
  push: vi.fn(),
  succes: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push, refresh: () => undefined }) }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({
  controlerScriptFourniAction: actions.controler,
  enregistrerScriptFourniAction: actions.enregistrer,
  revenirAuScriptDeLIAAction: actions.revenir,
}));
vi.mock("@/components/ui/Toast", () => ({ notifier: { succes: actions.succes, erreur: vi.fn() } }));

import { LienMonScript, libelleMonScript } from "@/components/formats/cas-concret/entree/LienMonScript";
import { CasAValider } from "@/components/formats/cas-concret/entree/CasAValider";
import { ContenuVotreVideo } from "@/components/formats/cas-concret/entree/FeuilleVotreVideo";
import { versVueCas } from "@/components/formats/cas-concret/entree/vue";
import { FormulaireScriptFourni, positionDeLaLigne } from "@/components/formats/cas-concret/script-fourni/FormulaireScriptFourni";
import { empreinteCas } from "@/formats/cas-concret/cas";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";

type Noeud = number | { type?: unknown; props?: { children?: unknown; onClick?: () => void; onChange?: (e: unknown) => void; disabled?: boolean; [k: string]: unknown } } | string | null | undefined | false | Noeud[];
const texteDe = (n: Noeud): string => (Array.isArray(n) ? n.map(texteDe).join("") : typeof n === "string" ? n : typeof n === "number" ? String(n) : n && typeof n === "object" ? texteDe(n.props?.children as Noeud) : "");
type Props = { children?: unknown; onClick?: () => void; onChange?: (e: unknown) => void; disabled?: boolean; [k: string]: unknown };
function cherche(n: Noeud, ok: (x: { type?: unknown; props: Props }) => boolean): { props: { onClick?: () => void; onChange?: (e: unknown) => void; disabled?: boolean } } | undefined {
  if (Array.isArray(n)) {
    for (const x of n) {
      const r = cherche(x, ok);
      if (r) return r;
    }
    return undefined;
  }
  if (n && typeof n === "object") {
    if (n.props && ok(n as never)) return n as never;
    return cherche(n.props?.children as Noeud, ok);
  }
  return undefined;
}
const bouton = (n: Noeud, libelle: string) => cherche(n, (x) => typeof x.props.onClick === "function" && texteDe(x as Noeud) === libelle);
const zone = (n: Noeud) => cherche(n, (x) => x.type === "textarea");
function rendre<P extends object>(c: (p: P) => Noeud, p: P): Noeud {
  banc.i = 0;
  banc.r = 0;
  return c(p);
}
async function cliquer<P extends object>(c: (p: P) => Noeud, p: P, libelle: string): Promise<Noeud> {
  const b = bouton(rendre(c, p), libelle);
  expect(b, `bouton « ${libelle} »`).toBeTruthy();
  b!.props.onClick!();
  await Promise.all(banc.transitions.splice(0));
  return rendre(c, p);
}

const [A] = CATALOGUE_TS as [(typeof CATALOGUE_TS)[number]];
const vue = versVueCas(A, empreinteCas(A), true);
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

beforeEach(() => {
  banc.cases = [];
  banc.transitions = [];
  banc.refs = [];
  for (const f of [actions.controler, actions.enregistrer, actions.revenir, actions.push, actions.succes]) f.mockClear();
});

describe("lien « Mon script »", () => {
  it("trois libellés : aucun script, script de l'IA, script de Will", () => {
    expect(libelleMonScript({})).toBe("Écrire ou coller mon script");
    expect(libelleMonScript({ script: [{ rang: 1 }] as never })).toBe("Remplacer par mon script");
    expect(libelleMonScript({ script: [{ rang: 1 }] as never, scriptFourni: true })).toBe("Modifier mon script");
    const html = renderToStaticMarkup(createElement(LienMonScript, { cas: vue }));
    expect(html).toContain(`href="/cas-concret/script/${A.id}"`);
    expect(html).toContain("min-h-11");
  });

  it("sur la feuille « Votre vidéo » (jamais en porte B) avec la pastille « Votre script » quand le script est celui de Will ; dans « À valider »", () => {
    const feuille = (cas: typeof vue) =>
      texte(renderToStaticMarkup(createElement(ContenuVotreVideo, { cas, essai: false, reseaux: ["facebook"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: true, onAvecMot: () => undefined, onValider: () => undefined } as never)));
    expect(feuille(vue)).toContain("Écrire ou coller mon script");
    const fourni = { ...vue, script: [{ rang: 1, type: "accroche", nom: "Accroche", texteDit: "Bonjour ici.", affiches: [] }] as never, scriptFourni: true };
    const t = feuille(fourni);
    expect(t).toContain("Modifier mon script");
    expect(t).toContain("Votre script");
    expect(feuille({ ...vue, porteB: { videoId: "v", aConfirmer: [] } } as never)).not.toContain("mon script");
    const aValider = texte(renderToStaticMarkup(createElement(CasAValider, { cas: [versVueCas(A, empreinteCas(A), false)], occupe: false, onValider: () => undefined, onEssai: () => undefined })));
    expect(aValider).toContain("Écrire ou coller mon script");
  });
});

describe("formulaire « Mon script »", () => {
  const props = { casId: "cas-test", titre: "Cas de test", texteDepart: "[accroche] Bonjour ici.\n[question] Et vous ?", origine: "gabarit" as const, perime: false, courantFourni: false };
  const apercuOk = { ok: true, apercu: [{ rang: 1, type: "accroche", nom: "Accroche", forme: "accroche", nomForme: "Accroche", texteDit: "Bonjour ici.", affiches: ["Bonjour ici"] }], dureeSec: { min: 44, max: 51 }, refus: [] };

  it("rendu initial : aide, compteur, textarea de 16 px, « Enregistrer » inactif tant que rien n'est vérifié", () => {
    const h = renderToStaticMarkup(createElement(FormulaireScriptFourni, props));
    const t = texte(h);
    expect(t).toContain("Une ligne = un écran.");
    expect(t).toContain("[accroche] [avant] [bascule]");
    expect(h).toContain("text-base");
    expect(h).toContain('aria-describedby="id-test"');
    expect(t).toContain("Annuler");
    expect(t).not.toContain("Revenir au script écrit par l'IA");
    const arbre = rendre(FormulaireScriptFourni as never, props as never);
    expect(bouton(arbre, "Enregistrer mon script")!.props.disabled).toBe(true);
    expect(actions.controler).not.toHaveBeenCalled();
  });

  it("Vérifier, puis Enregistrer : une seule action chacune ; toute frappe désactive Enregistrer ; le succès annonce et retourne à la liste", async () => {
    actions.controler.mockResolvedValue({ ok: true, donnees: apercuOk });
    const C = FormulaireScriptFourni as never;
    const apres = await cliquer(C, props as never, "Vérifier");
    expect(actions.controler).toHaveBeenCalledTimes(1);
    expect(actions.controler).toHaveBeenCalledWith("cas-test", props.texteDepart);
    expect(texteDe(apres)).toContain("Ligne 1 · Accroche");
    expect(texteDe(apres)).toContain("environ 44 à 51 s selon la fin");
    expect(bouton(apres, "Enregistrer mon script")!.props.disabled).toBe(false);
    // Une frappe : le texte affiché n'est plus celui qui a été vérifié.
    zone(apres)!.props.onChange!({ target: { value: `${props.texteDepart} !` } });
    const modifie = rendre(C, props as never);
    expect(bouton(modifie, "Enregistrer mon script")!.props.disabled).toBe(true);
    expect(texteDe(modifie)).toContain("Vous avez modifié le texte : vérifiez-le de nouveau avant d'enregistrer.");
    // Revérifié, puis enregistré.
    await cliquer(C, props as never, "Vérifier");
    await cliquer(C, props as never, "Enregistrer mon script");
    expect(actions.enregistrer).toHaveBeenCalledTimes(1);
    expect(actions.enregistrer).toHaveBeenCalledWith("cas-test", `${props.texteDepart} !`);
    expect(actions.succes).toHaveBeenCalledWith("Script enregistré", "Il sera dit mot pour mot, sans écriture par l'IA.");
    expect(actions.push).toHaveBeenCalledWith("/cas-concret");
  });

  it("un refus : les lignes en alerte avec « Aller à la ligne N » ; Enregistrer reste inactif", async () => {
    actions.controler.mockResolvedValue({ ok: true, donnees: { ok: false, apercu: [], refus: [{ ligne: 3, message: "Ligne 3 : phrase trop longue. Coupez cette phrase en deux lignes." }, { message: "Durée : ajoutez une phrase." }] } });
    const apres = await cliquer(FormulaireScriptFourni as never, props as never, "Vérifier");
    const t = texteDe(apres);
    expect(t).toContain("Ce script ne passe pas encore :");
    expect(t).toContain("Ligne 3 : phrase trop longue. Coupez cette phrase en deux lignes.");
    expect(t).toContain("Aller à la ligne 3");
    expect(t).toContain("Durée : ajoutez une phrase.");
    expect(bouton(apres, "Enregistrer mon script")!.props.disabled).toBe(true);
    expect(actions.enregistrer).not.toHaveBeenCalled();
  });

  it("script de Will périmé : la mention ; « Revenir au script écrit par l'IA » demande confirmation, une seule action", async () => {
    const p = { ...props, origine: "fourni" as const, perime: true, courantFourni: true };
    const t = texte(renderToStaticMarkup(createElement(FormulaireScriptFourni, p)));
    expect(t).toContain("écrit pour une version précédente du cas : vérifiez-le de nouveau");
    const C = FormulaireScriptFourni as never;
    const confirmation = await cliquer(C, p as never, "Revenir au script écrit par l'IA");
    expect(actions.revenir).not.toHaveBeenCalled();
    expect(texteDe(confirmation)).toContain("Votre script reste dans l'historique.");
    await cliquer(C, p as never, "Oui, revenir");
    expect(actions.revenir).toHaveBeenCalledTimes(1);
    expect(actions.revenir).toHaveBeenCalledWith("cas-test");
  });

  it("« Aller à la ligne N » : la position de la ligne dans le texte (les lignes vides ne comptent pas)", () => {
    const t = "Un.\n\nDeux deux.\nTrois.";
    expect(positionDeLaLigne(t, 1)).toEqual({ debut: 0, fin: 3 });
    expect(positionDeLaLigne(t, 2)).toEqual({ debut: 5, fin: 15 });
    expect(positionDeLaLigne(t, 3)).toEqual({ debut: 16, fin: 22 });
    expect(positionDeLaLigne(t, 4)).toBeNull();
  });
});
