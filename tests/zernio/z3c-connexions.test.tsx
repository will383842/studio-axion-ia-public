import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CompteVue, EtatConnexionsZernio, ServicesZernio } from "@/app/(studio)/reglages/actions-zernio";
import { BandeauChargement, BandeauErreur, BandeauVide, formaterJour, gestesCompte, ligneMeta, prochaineEtape } from "@/components/reglages/BlocZernio";
import { VueConnexionsZernio, vueDepuisReponse, type VueZernio } from "@/components/reglages/Connexions";
import { creerGestesArret } from "@/components/reglages/ToutArreter";
import { J, MOT_INTERDIT, NOM_LABEL } from "./aides/faux-zernio";

const compte = (reseau: CompteVue["reseau"], i: number, sur: Partial<CompteVue> = {}): CompteVue => ({
  code: `${reseau}-${i}`,
  cle: `${reseau}:exemple${i}`,
  reseau,
  nom: `Compte exemple ${reseau} ${i}`,
  relie: true,
  outil: "zernio",
  mode: "brouillon",
  existeChezBuffer: true,
  basculeLe: "2026-11-03T08:00:00Z",
  dernierTest: "2026-11-04T08:00:00Z",
  ...sur,
});
const SIX: CompteVue[] = [compte("instagram", 1), compte("facebook", 2), compte("facebook", 3), compte("linkedin", 4), compte("linkedin", 5), compte("tiktok", 6)];
const etat = (sur: Partial<EtatConnexionsZernio> = {}): EtatConnexionsZernio => ({ cleAbsente: false, arretActif: false, comptes: SIX, budget: { zernio: 10, buffer: 20, finBuffer: "20/11" }, ...sur });

function fauxServices(donnees: EtatConnexionsZernio = etat()): ServicesZernio & { appels: Record<string, unknown[][]> } {
  const appels: Record<string, unknown[][]> = {};
  const noter = <T,>(nom: string, retour: T) => (...a: unknown[]) => ((appels[nom] ??= []).push(a), Promise.resolve(retour));
  return {
    appels,
    lire: noter("lire", { ok: true as const, donnees }),
    tester: noter("tester", { ok: true as const, donnees: { message: "Zernio répond." } }),
    changerRoutage: noter("changerRoutage", { ok: true as const, donnees: undefined }),
    changerMode: noter("changerMode", { ok: true as const, donnees: undefined }),
    arreter: noter("arreter", { ok: true as const, donnees: undefined }),
    reprendre: noter("reprendre", { ok: true as const, donnees: undefined }),
  };
}

const rendre = (vue: VueZernio, services = fauxServices(), arretActif = false) => renderToStaticMarkup(<VueConnexionsZernio vue={vue} services={services} arretActif={arretActif} />);
const VUES: Record<string, VueZernio> = {
  normal: { etat: "normal", donnees: etat() },
  vide: { etat: "vide", donnees: etat({ comptes: [] }) },
  chargement: { etat: "chargement" },
  erreur: { etat: "erreur" },
};

describe("z3c · cartes de compte", () => {
  it("6 cartes lues depuis le service, dans l'ordre", async () => {
    const services = fauxServices();
    const vue = vueDepuisReponse(await services.lire());
    expect(vue.etat).toBe("normal");
    const html = rendre(vue, services);
    expect([...html.matchAll(/data-compte="([a-z]+)-\d"/g)].map((m) => m[1])).toEqual(["instagram", "facebook", "facebook", "linkedin", "linkedin", "tiktok"]);
    expect(html).toContain("Compte exemple tiktok 6");
    expect(html).toContain("Relié");
    expect(html).toContain("Publie par");
    expect(html).toContain("Ce qui part");
    expect(html).toContain("Brouillon d’abord");
  });

  it("compte à reconnecter : pastille « À reconnecter bientôt » ; Buffer désactivé s'il n'y a pas de compte chez Buffer", () => {
    const html = rendre({ etat: "normal", donnees: etat({ comptes: [compte("tiktok", 1, { relie: false, existeChezBuffer: false })] }) });
    expect(html).toContain("À reconnecter bientôt");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Buffer/);
  });

  it("le changement de routage appelle le bon service avec le bon réseau", async () => {
    const services = fauxServices();
    const apres = vi.fn();
    const g = gestesCompte(services, apres, vi.fn());
    await g.publiePar("linkedin:exemple4", "zernio");
    await g.ceQuiPart("tiktok:exemple6", "programmer");
    expect(services.appels.changerRoutage).toEqual([["linkedin:exemple4", "zernio"]]);
    expect(services.appels.changerMode).toEqual([["tiktok:exemple6", "programmer"]]);
    expect(apres).toHaveBeenCalledTimes(2);
  });

  it("un refus du service est annoncé en phrase simple, sans rafraîchir", async () => {
    const services = { ...fauxServices(), changerRoutage: vi.fn().mockResolvedValue({ ok: false, message: "Zernio n'est pas relié." }) };
    const apres = vi.fn();
    const alerte = vi.fn();
    await gestesCompte(services, apres, alerte).publiePar("instagram:exemple1", "zernio");
    expect(alerte).toHaveBeenCalledWith("Zernio n'est pas relié.");
    expect(apres).not.toHaveBeenCalled();
  });

  it("méta et dates en jour/mois", () => {
    expect(formaterJour("2026-11-03T08:00:00Z")).toBe("03/11");
    expect(formaterJour(null)).toBe("—");
    expect(ligneMeta(SIX[0])).toBe("Bascule le 03/11 · testé le 04/11");
    expect(ligneMeta({ basculeLe: null, dernierTest: null })).toBe("Pas encore basculé · pas encore testé");
  });
});

describe("z3c · prochaine étape de la bascule", () => {
  it("un compte encore chez Buffer : phrase, compte des autres, un seul bouton principal", () => {
    const comptes = [...SIX.slice(0, 5), compte("tiktok", 6, { outil: "buffer" })];
    expect(prochaineEtape(comptes).autres).toBe(5);
    const html = rendre({ etat: "normal", donnees: etat({ comptes }) });
    expect(html).toContain("Compte exemple tiktok 6 publie encore par Buffer");
    expect(html).toContain("Les 5 autres comptes passent déjà par Zernio.");
    expect(html).toContain("jusqu’au 20/11");
    expect(html).toContain("Passer Compte exemple tiktok 6 sur Zernio");
  });

  it("tous chez Zernio : « Les 6 comptes publient par Zernio » + lien", () => {
    const html = rendre(VUES.normal);
    expect(html).toContain("Les 6 comptes publient par Zernio");
    expect(html).toContain("Voir la migration");
  });
});

describe("z3c · arrêt d'urgence", () => {
  it.each(Object.keys(VUES))("« Tout arrêter » est rendu dans l'état %s", (nom) => {
    const html = rendre(VUES[nom]);
    expect(html).toContain("Arrêt d’urgence");
    expect(html).toContain("Tout arrêter");
    expect(html).toContain("Bloque seulement les envois vers Zernio : créer un brouillon, programmer, promouvoir. Ce qui est déjà programmé chez Zernio y reste. Buffer n’est pas touché et rien n’est supprimé. Tout se reprend en un geste.");
  });

  it("sous erreur : « Toujours disponible, même quand Zernio ne répond pas. »", () => {
    expect(rendre(VUES.erreur)).toContain("Toujours disponible, même quand Zernio ne répond pas.");
    expect(rendre(VUES.normal)).not.toContain("Toujours disponible");
  });

  it("demander ouvre la confirmation sans rien arrêter ; confirmer coupe ; reprendre rétablit", async () => {
    const services = fauxServices();
    const appui = { ouvrir: vi.fn(), fermer: vi.fn(), apres: vi.fn(), erreur: vi.fn(), succes: vi.fn() };
    const g = creerGestesArret(services, appui);
    g.demander();
    expect(appui.ouvrir).toHaveBeenCalledTimes(1);
    expect(services.appels.arreter).toBeUndefined();
    await expect(g.confirmer()).resolves.toBe(true);
    expect(services.appels.arreter).toHaveLength(1);
    expect(appui.fermer).toHaveBeenCalled();
    await expect(g.reprendre()).resolves.toBe(true);
    expect(services.appels.reprendre).toHaveLength(1);
    expect(services.appels.lire).toBeUndefined();
  });

  it("à l'arrêt : « Tout reprendre » remplace « Tout arrêter »", () => {
    const html = rendre({ etat: "normal", donnees: etat({ arretActif: true }) });
    expect(html).toContain("Tout reprendre");
    expect(html).not.toContain("Tout arrêter");
  });

  it("un échec de l'arrêt est annoncé et ne se déclare pas réussi", async () => {
    const services = { ...fauxServices(), arreter: vi.fn().mockResolvedValue({ ok: false, message: "Un souci est survenu." }) };
    const appui = { ouvrir: vi.fn(), fermer: vi.fn(), apres: vi.fn(), erreur: vi.fn(), succes: vi.fn() };
    await expect(creerGestesArret(services, appui).confirmer()).resolves.toBe(false);
    expect(appui.erreur).toHaveBeenCalledWith("Un souci est survenu.");
    expect(appui.succes).not.toHaveBeenCalled();
  });
});

describe("z3c · les 3 autres états", () => {
  it("vide", () => {
    const html = rendre(VUES.vide);
    expect(html).toContain("Aucun compte relié à Zernio");
    expect(html).toContain("Tant qu’aucun compte n’est relié, Buffer continue de tout publier.");
    expect(html).toContain("Ouvrir Zernio");
    expect(html).toContain("J’ai relié mes comptes");
  });
  it("chargement : squelettes", () => {
    const html = rendre(VUES.chargement);
    expect(html).toContain("Interrogation des 6 comptes…");
    expect(html.match(/data-squelette/g)).toHaveLength(6);
  });
  it("erreur", () => {
    const html = rendre(VUES.erreur);
    expect(html).toContain("Zernio ne répond pas");
    expect(html).toContain("Nous réessayons seuls toutes les 2 minutes.");
    expect(html).toContain("Réessayer maintenant");
  });
  it("réponse en échec → état erreur ; aucun compte → état vide", () => {
    expect(vueDepuisReponse({ ok: false, message: "x" }).etat).toBe("erreur");
    expect(vueDepuisReponse({ ok: true, donnees: etat({ comptes: [] }) }).etat).toBe("vide");
  });
  it("en-tête : titre, chapo, bouton de test", () => {
    const html = rendre(VUES.normal);
    // Titre renommé le 08/11 (Williams) : plus de nom de service dans un titre ; la carte de la page porte « Vos comptes de publication ».
    expect(html).toContain("Vos comptes");
    expect(html).toContain("Vos 6 comptes, l’outil qui publie et le mode d’envoi, réseau par réseau.");
    expect(html).toContain("Tester les 6 comptes");
  });
});

describe("z3c · clé absente et aucun montant", () => {
  it("clé absente : message simple, aucune exception", () => {
    const html = rendre({ etat: "normal", donnees: etat({ cleAbsente: true }) });
    expect(html).toContain("Zernio n’est pas encore relié. L’écran fonctionne en essai.");
  });

  it("l'action « tester » sans clé répond par un message, sans exception ni appel à Zernio", async () => {
    vi.resetModules();
    const testerZernio = vi.fn();
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    vi.doMock("@/services/auth", () => ({ exigerSession: vi.fn().mockResolvedValue(undefined) }));
    vi.doMock("@/services/zernio", () => ({ cleZernioPresente: () => false, testerZernio, clientZernio: vi.fn(), comptesZernioEnregistres: vi.fn() }));
    const { testerComptesZernioAction } = await import("@/app/(studio)/reglages/actions-zernio");
    const r = await testerComptesZernioAction();
    expect(r).toMatchObject({ ok: true });
    expect(testerZernio).not.toHaveBeenCalled();
    vi.doUnmock("@/services/zernio");
  });

  it("aucun montant affiché ni bloquant : budget à zéro ou absent, tous les gestes restent actifs", () => {
    const comptes = [...SIX.slice(0, 5), compte("tiktok", 6, { outil: "buffer" })];
    for (const budget of [{ zernio: 0, buffer: 0, finBuffer: "20/11" }, { zernio: null, buffer: null, finBuffer: "20/11" }, { zernio: 999999, buffer: 999999, finBuffer: "20/11" }]) {
      const html = rendre({ etat: "normal", donnees: etat({ comptes, budget }) });
      expect(html).not.toMatch(/\$|Budget|à renseigner|jamais bloqué par ce montant/);
      expect(html).toMatch(/<button(?![^>]*\sdisabled="")[^>]*>(?:(?!<\/button>)[\s\S])*Passer Compte exemple tiktok 6 sur Zernio/);
    }
    expect(rendre(VUES.normal)).not.toMatch(/10 \$|Budget du mois/);
  });
});

describe("z3c · langue et mots interdits", () => {
  const TOUT = [...Object.values(VUES).map((v) => rendre(v)), renderToStaticMarkup(<BandeauVide onRelie={() => {}} />), renderToStaticMarkup(<BandeauErreur onReessayer={() => {}} />), renderToStaticMarkup(<BandeauChargement />)].join("\n");
  const texte = TOUT.replace(/<[^>]+>/g, " ");

  it("vouvoiement : jamais de tutoiement", () => {
    expect(texte).not.toMatch(/\b(tu|toi|ton|ta|tes|t')\b/i);
    expect(texte).toMatch(/Vos 6 comptes/);
  });
  it("mots interdits absents du rendu", () => {
    expect(TOUT).not.toContain(MOT_INTERDIT.slice(0, 6));
    expect(TOUT).not.toContain(NOM_LABEL);
    expect(TOUT).not.toMatch(new RegExp(`${J("Gre", "noble")}|${J("Aucun gain ", "garanti")}`, "i"));
  });
  it("aucun identifiant réel dans le rendu", () => {
    expect(TOUT).not.toMatch(/[0-9a-f]{24}|zernio_[a-z0-9]{8,}|sk_live|Bearer /);
  });
  it("chaque icône est décorative (masquée) : le libellé est dans le texte du bouton", () => {
    expect(TOUT).not.toMatch(/<svg(?![^>]*aria-hidden)/);
  });
});
