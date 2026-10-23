/**
 * Page ouverte avant une mise en ligne (constat prod du 10/10) : « Failed to find Server Action "70f7…" ». Le message
 * au monteur ne doit plus jamais se perdre ni afficher une erreur brute.
 * Format simulé = celui de Next 16.3.8 : le serveur répond 404, `content-type: text/plain`, corps « Server action not
 * found. » et `x-nextjs-action-not-found: 1` (server/app-render/action-handler.js, handleUnrecognizedFetchAction) ;
 * le client lève alors `UnrecognizedActionError` (client/components/router-reducer/reducers/server-action-reducer.js).
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import {
  DELAI_ENTRE_RECHARGEMENTS_MS,
  DUREE_SAISIE_MS,
  MESSAGE_MISE_A_JOUR,
  envelopperFetch,
  estErreurActionIntrouvable,
  estReponseActionIntrouvable,
  inscrireChamp,
  marquerEnvoi,
  preparerRechargement,
  reprendreSaisie,
  type Stockage,
} from "@/lib/mise-a-jour-studio";

const ID = "70f77500ca889140d7933517cbef2f7f25cdabe6fd";

/** Réponse exacte de Next 16 pour une action inconnue. */
function reponseIntrouvable() {
  return new Response("Server action not found.", { status: 404, headers: { "x-nextjs-action-not-found": "1", "content-type": "text/plain" } });
}
/** En-têtes exacts posés par Next 16 sur l'appel d'une action (fetchServerAction). */
const initAction = (): RequestInit => ({ method: "POST", headers: { Accept: "text/x-component", "next-action": ID, "next-router-state-tree": "%5B%5D" }, body: "[]" });

function stockageMemoire(): Stockage & { donnees: Map<string, string> } {
  const donnees = new Map<string, string>();
  return { donnees, getItem: (k) => donnees.get(k) ?? null, setItem: (k, v) => void donnees.set(k, v), removeItem: (k) => void donnees.delete(k) };
}

describe("action introuvable : détection au format réel de Next 16", () => {
  it("reconnaît l'erreur levée par Next côté client", () => {
    const e = new UnrecognizedActionError(`Server Action "${ID}" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action`);
    expect(unstable_isUnrecognizedActionError(e)).toBe(true);
    expect(estErreurActionIntrouvable(e)).toBe(true);
    // Même message passé par une frontière (objet recopié, classe perdue).
    expect(estErreurActionIntrouvable({ message: e.message })).toBe(true);
    expect(estErreurActionIntrouvable(new Error("Failed to fetch"))).toBe(false);
    expect(estErreurActionIntrouvable(null)).toBe(false);
  });

  it("reconnaît la réponse du serveur, seulement pour un appel d'action", () => {
    expect(estReponseActionIntrouvable(initAction(), reponseIntrouvable())).toBe(true);
    expect(estReponseActionIntrouvable({ headers: new Headers({ "Next-Action": ID }) }, reponseIntrouvable())).toBe(true);
    // Un 404 ordinaire, ou une requête qui n'est pas une action : rien à faire.
    expect(estReponseActionIntrouvable(initAction(), new Response("", { status: 404 }))).toBe(false);
    expect(estReponseActionIntrouvable({ method: "GET" }, reponseIntrouvable())).toBe(false);
  });
});

describe("filet central sur fetch", () => {
  beforeEach(() => vi.useRealTimers());

  it("action introuvable : l'appel reste en attente (aucune erreur brute), la page se recharge", async () => {
    const recharge = vi.fn(() => true);
    const f = envelopperFetch(async () => reponseIntrouvable(), recharge);
    const issue = await Promise.race([f("/videos/v1", initAction()).then(() => "répondu"), new Promise((r) => setTimeout(() => r("en attente"), 30))]);
    expect(issue).toBe("en attente");
    expect(recharge).toHaveBeenCalledTimes(1);
  });

  it("rechargement refusé (déjà fait il y a moins d'une minute) : la réponse passe, pas de boucle", async () => {
    const f = envelopperFetch(async () => reponseIntrouvable(), () => false);
    const r = await f("/videos/v1", initAction());
    expect(r.status).toBe(404);
  });

  it("les autres réponses passent telles quelles, sans rechargement", async () => {
    const recharge = vi.fn(() => true);
    const f = envelopperFetch(async () => new Response("ok"), recharge);
    expect(await (await f("/x", initAction())).text()).toBe("ok");
    const g = envelopperFetch(async () => new Response("", { status: 404 }), recharge);
    expect((await g("/api/rien")).status).toBe(404);
    expect(recharge).not.toHaveBeenCalled();
  });
});

describe("message au monteur : gardé, remis, renvoyé UNE fois", () => {
  it("un envoi en route est gardé avec « renvoyer », repris une seule fois après le rechargement", () => {
    const s = stockageMemoire();
    const fin = marquerEnvoi("monteur:v1", "plus chaud, et un générique", { dicte: false, garder: true });
    expect(preparerRechargement(s, 1_000_000)).toBe(true);
    fin();
    const repris = reprendreSaisie(s, "monteur:v1", 1_000_500);
    expect(repris).toMatchObject({ texte: "plus chaud, et un générique", renvoyer: true, options: { garder: true } });
    // Deuxième montage (StrictMode, autre onglet, rechargement) : rien à renvoyer, donc aucun doublon.
    expect(reprendreSaisie(s, "monteur:v1", 1_000_600)).toBeNull();
  });

  it("une minute ne s'est pas écoulée : pas de rechargement, le texte reste gardé mais n'est PAS renvoyé tout seul", () => {
    const s = stockageMemoire();
    expect(preparerRechargement(s, 1_000_000)).toBe(true);
    reprendreSaisie(s, "monteur:v1", 1_000_000);
    const fin = marquerEnvoi("monteur:v1", "rajoute un générique");
    expect(preparerRechargement(s, 1_000_000 + DELAI_ENTRE_RECHARGEMENTS_MS - 1)).toBe(false);
    fin();
    expect(reprendreSaisie(s, "monteur:v1", 1_000_100)).toEqual({ texte: "rajoute un générique", le: 1_000_000 + DELAI_ENTRE_RECHARGEMENTS_MS - 1 });
    // Une minute plus tard, le rechargement redevient permis.
    expect(preparerRechargement(s, 1_000_000 + DELAI_ENTRE_RECHARGEMENTS_MS)).toBe(true);
  });

  it("les champs ouverts (consignes, retouches, script…) gardent leur texte, sans renvoi ; les champs vides sont ignorés", () => {
    const s = stockageMemoire();
    const a = inscrireChamp("/videos/v1|Votre retouche", () => "coupe la fin");
    const b = inscrireChamp("/videos/v1|Vide", () => "  ");
    preparerRechargement(s, 5_000_000);
    a();
    b();
    expect(reprendreSaisie(s, "/videos/v1|Votre retouche", 5_000_001)).toEqual({ texte: "coupe la fin", le: 5_000_000 });
    expect(reprendreSaisie(s, "/videos/v1|Vide", 5_000_001)).toBeNull();
  });

  it("une saisie trop ancienne n'est plus remise", () => {
    const s = stockageMemoire();
    const a = inscrireChamp("cle", () => "vieux texte");
    preparerRechargement(s, 0 + 1);
    a();
    expect(reprendreSaisie(s, "cle", 1 + DUREE_SAISIE_MS)).toBeNull();
  });
});

describe("branchements", () => {
  const lire = (f: string) => readFileSync(f, "utf8");
  it("le filet est posé une fois, dans le layout racine", () => {
    expect(lire("src/app/layout.tsx")).toMatch(/<RepriseMiseAJour \/>/);
    expect(lire("src/components/coquille/RepriseMiseAJour.tsx")).toMatch(/envelopperFetch\(/);
  });
  it("le fil du monteur marque son envoi et renvoie le message repris", () => {
    const fil = lire("src/components/facecam/FilMonteur.tsx");
    expect(fil).toMatch(/marquerEnvoi\(/);
    expect(fil).toMatch(/useSaisieGardee\(\s*`monteur:/);
  });
  it("les champs de texte s'inscrivent (ZoneTexte, fiche script)", () => {
    expect(lire("src/components/ui/ZoneTexte.tsx")).toMatch(/useSaisieGardee\(/);
    expect(lire("src/components/ecrire/FicheScript.tsx")).toMatch(/useSaisieGardee\(/);
  });
  it("les zones de texte brutes du générateur s'inscrivent aussi (idée, phrase à vous, matière d'un sujet)", () => {
    const ecran = lire("src/components/generateur/EcranSujet.tsx");
    expect(ecran).toMatch(/useSaisieGardee\(\s*"generateur:idee"/);
    expect(ecran).toMatch(/useSaisieGardee\(\s*"generateur:phrase"/);
    expect(lire("src/components/generateur/SaisieMatiereSujet.tsx")).toMatch(/useSaisieGardee\(\s*`matiere-sujet:\$\{id\}`/);
  });
  it("les pages d'erreur reconnaissent l'action introuvable et affichent la phrase simple", () => {
    for (const f of ["src/app/(studio)/error.tsx", "src/app/global-error.tsx"]) expect(lire(f)).toMatch(/estErreurActionIntrouvable\(/);
    expect(MESSAGE_MISE_A_JOUR).toBe("Le studio vient d'être mis à jour : la page se recharge, votre message est gardé.");
  });
});
