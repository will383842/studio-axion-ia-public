"use client";

import { useTransition } from "react";
import type { BudgetInfo, CompteVue, ServicesZernio } from "@/app/(studio)/reglages/actions-zernio";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { OutilPublication } from "@/domaine/outil-publication";
import type { IdReseau, ModeEnvoiPublication } from "@/domaine/types";

/** « 03/11 » : jour et mois, en UTC pour ne dépendre d'aucun fuseau. */
export function formaterJour(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Ligne de méta d'une carte : « <date de bascule> · <dernier test> ». */
export function ligneMeta(c: Pick<CompteVue, "basculeLe" | "dernierTest">): string {
  const bascule = c.basculeLe ? `Bascule le ${formaterJour(c.basculeLe)}` : "Pas encore basculé";
  const test = c.dernierTest ? `testé le ${formaterJour(c.dernierTest)}` : "pas encore testé";
  return `${bascule} · ${test}`;
}

/** Le compte restant chez Buffer (le premier, dans l'ordre de l'écran), et combien d'autres sont déjà chez Zernio. */
export function prochaineEtape(comptes: CompteVue[]): { restant: CompteVue | null; autres: number } {
  const restant = comptes.find((c) => c.outil === "buffer") ?? null;
  return { restant, autres: comptes.filter((c) => c !== restant && c.outil === "zernio").length };
}

/** Gestes d'un compte, séparés de l'affichage : chaque geste appelle le bon service avec le bon réseau. */
export function gestesCompte(services: Pick<ServicesZernio, "changerRoutage" | "changerMode">, apres: () => void, alerte: (message: string) => void) {
  const suite = async (p: ReturnType<ServicesZernio["changerRoutage"]>) => {
    const r = await p;
    if (!r.ok) return void alerte(r.message);
    apres();
  };
  return {
    publiePar: (cle: string, outil: OutilPublication) => suite(services.changerRoutage(cle, outil)),
    ceQuiPart: (cle: string, mode: ModeEnvoiPublication) => suite(services.changerMode(cle, mode)),
  };
}

type ServicesCompte = Pick<ServicesZernio, "changerRoutage" | "changerMode">;

export function CarteCompte({ compte, services, onChange }: { compte: CompteVue; services: ServicesCompte; onChange?: () => void }) {
  const [enCours, demarrer] = useTransition();
  const gestes = gestesCompte(services, () => onChange?.(), (m) => notifier.erreur(m));
  const etat = compte.relie ? ({ ton: "sauge", icone: "coche", libelle: "Relié" } as const) : ({ ton: "ambre", icone: "horloge", libelle: "À reconnecter bientôt" } as const);
  return (
    <li data-compte={compte.code} className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte" aria-busy={enCours}>
      <div className="flex items-center gap-3">
        <LogoReseau reseau={compte.reseau} />
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-texte">{compte.nom}</h3>
        <Pastille ton={etat.ton} icone={etat.icone}>
          {etat.libelle}
        </Pastille>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <SelecteurPastilles
          libelle="Publie par"
          valeur={compte.outil}
          onChange={(o) => demarrer(async () => void (await gestes.publiePar(compte.cle, o)))}
          options={[
            { valeur: "buffer", libelle: "Ancien outil", desactive: !compte.existeChezBuffer, raison: "Ce compte n’existe pas dans l’ancien outil." },
            { valeur: "zernio", libelle: "Nouvel outil" },
          ]}
        />
        <SelecteurPastilles
          libelle="Ce qui part"
          valeur={compte.mode}
          onChange={(m) => demarrer(async () => void (await gestes.ceQuiPart(compte.cle, m)))}
          options={[
            { valeur: "brouillon", libelle: "Brouillon d’abord" },
            { valeur: "programmer", libelle: "Programmer" },
          ]}
        />
      </div>
      <p className="mt-3 text-xs text-texte-faible">{ligneMeta(compte)}</p>
    </li>
  );
}

export function CarteBascule({ comptes, services, onChange }: { comptes: CompteVue[]; services: Pick<ServicesZernio, "changerRoutage">; onChange?: () => void }) {
  const [enCours, demarrer] = useTransition();
  const { restant, autres } = prochaineEtape(comptes);
  return (
    <section aria-labelledby="bascule-titre" data-carte="bascule" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte sm:p-5">
      <h2 id="bascule-titre" className="text-lg text-texte">
        Prochaine étape de la bascule
      </h2>
      {restant ? (
        <>
          <p className="mt-1 text-[15px] font-semibold text-texte">{restant.nom} publie encore par l’ancien outil</p>
          <p className="mt-1 text-sm text-texte-doux">
            {autres === 1 ? "Le 1 autre compte passe déjà par le nouvel outil." : `Les ${autres} autres comptes passent déjà par le nouvel outil.`} Vous pourrez revenir à l’ancien outil en un geste jusqu’au 20/11.
          </p>
          <div className="mt-3">
            <Bouton
              taille="lg"
              pleineLargeur
              icone="envoyer"
              chargement={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await services.changerRoutage(restant.cle, "zernio");
                  if (!r.ok) return void notifier.erreur(r.message);
                  onChange?.();
                })
              }
            >
              Passer {restant.nom} sur le nouvel outil
            </Bouton>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[15px] font-semibold text-texte">Les 6 comptes publient par le nouvel outil</p>
          <a href="/reglages#migration" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-vif underline">
            Voir la migration
          </a>
        </>
      )}
    </section>
  );
}

/** Aucun montant dans l'interface : la carte n'affiche plus rien (l'appelant peut la retirer). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CarteBudget(_props: { budget: BudgetInfo; nombreComptes: number }): null {
  return null;
}

export function BandeauVide({ onRelie, enCours, lienZernio = "https://zernio.com" }: { onRelie: () => void; enCours?: boolean; lienZernio?: string }) {
  return (
    <section aria-labelledby="vide-titre" data-etat="vide" className="rounded-carte border border-trait bg-surface-1 p-5 text-center shadow-carte">
      <Icone nom="lien" size={28} className="mx-auto text-texte-faible" />
      <h2 id="vide-titre" className="mt-2 text-lg text-texte">
        Aucun compte relié au nouvel outil
      </h2>
      <p className="mt-1 text-sm text-texte-doux">
        Reliez vos comptes dans le nouvel outil (Facebook ×2, Instagram, LinkedIn page et profil, TikTok), puis revenez ici : ils apparaîtront seuls. Tant qu’aucun compte n’est relié, l’ancien outil continue de tout publier.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Bouton taille="lg" pleineLargeur chargement={enCours} onClick={onRelie}>
          J’ai relié mes comptes
        </Bouton>
        <Bouton variante="secondaire" pleineLargeur asChild>
          <a href={lienZernio} target="_blank" rel="noopener noreferrer">
            Ouvrir le nouvel outil
          </a>
        </Bouton>
      </div>
    </section>
  );
}

export function BandeauErreur({ onReessayer, enCours }: { onReessayer: () => void; enCours?: boolean }) {
  return (
    <section role="alert" aria-labelledby="erreur-titre" data-etat="erreur" className="rounded-carte border border-brique/30 bg-brique-doux/40 p-5 text-center">
      <Icone nom="alerte" size={28} className="mx-auto text-brique" />
      <h2 id="erreur-titre" className="mt-2 text-lg text-texte">
        Le nouvel outil ne répond pas
      </h2>
      <p className="mt-1 text-sm text-texte-doux">Ce qui est déjà programmé dans le nouvel outil y reste, avec ou sans arrêt d’urgence. Nous réessayons seuls toutes les 2 minutes.</p>
      <div className="mt-4">
        <Bouton taille="lg" pleineLargeur icone="reessayer" chargement={enCours} onClick={onReessayer}>
          Réessayer maintenant
        </Bouton>
      </div>
    </section>
  );
}

export function BandeauChargement() {
  return (
    <section aria-busy="true" aria-live="polite" data-etat="chargement" className="flex flex-col gap-3">
      <p className="text-sm text-texte-doux">Interrogation des 6 comptes…</p>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} data-squelette className="h-28 animate-pulse rounded-carte border border-trait bg-surface-2" />
      ))}
    </section>
  );
}

export function BandeauCleAbsente() {
  return (
    <p data-info="cle-absente" className="rounded-2xl border border-trait bg-surface-2 px-4 py-3 text-sm text-texte-doux">
      Le nouvel outil n’est pas encore relié. L’écran fonctionne en essai.
    </p>
  );
}
