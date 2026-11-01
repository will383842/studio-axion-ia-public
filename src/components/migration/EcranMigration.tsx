"use client";
import Link from "next/link";
import { useState } from "react";
import { AReprogrammer } from "./AReprogrammer";
import { Criteres } from "./Criteres";
import { FenetreLot } from "./FenetreLot";
import { Frise, jalonsPour } from "./Frise";
import { DateLimite, Heros } from "./Heros";
import { Lots } from "./Lots";
import { compter, critereResiliation, lotDe, resumerLots, type CodeLot, type DonneesMigration } from "./logique";
import { serviceNonBranche, type ComparaisonPost, type ServiceImport } from "./services";

export type VueMigration =
  | { etat: "chargement" }
  | { etat: "erreur"; message: string }
  | { etat: "vide" }
  | { etat: "normal"; donnees: DonneesMigration };

const Coquille = ({ children }: { children: React.ReactNode }) => <div className="mx-auto grid w-full max-w-xl gap-4">{children}</div>;

function Entete({ total }: { total?: number }) {
  return (
    <header>
      <h1 className="text-2xl text-texte">Migration</h1>
      <p className="mt-1 text-texte-doux">Les {total ?? "—"} posts de Buffer passent chez Zernio, sans rien perdre ni publier deux fois.</p>
      <p className="mt-2 text-sm font-semibold text-texte">Rien n’est retiré de Buffer sans votre ordre.</p>
      <p className="text-sm text-texte-doux">Chaque post est d’abord recréé en brouillon, puis vérifié.</p>
    </header>
  );
}

/** Écran Migration : les 4 états (normal, vide, chargement, erreur). Aucun appel réseau ici : tout passe par `service`. */
export function EcranMigration({ vue, maintenant, service = serviceNonBranche, comparaisons = [], simulation = false }: {
  vue: VueMigration;
  maintenant: Date;
  service?: ServiceImport;
  comparaisons?: ComparaisonPost[];
  simulation?: boolean;
}) {
  const [lotOuvert, setLotOuvert] = useState<CodeLot | null>(null);

  if (vue.etat === "chargement") {
    return (
      <Coquille>
        <Entete />
        <p role="status" aria-busy="true" className="rounded-carte border border-trait bg-surface-1 p-4 text-texte-doux">Chargement…</p>
      </Coquille>
    );
  }
  if (vue.etat === "erreur") {
    return (
      <Coquille>
        <Entete />
        <p role="alert" className="rounded-carte bg-brique-doux p-4 font-semibold text-brique">{vue.message}</p>
      </Coquille>
    );
  }
  if (vue.etat === "vide") {
    return (
      <Coquille>
        <Entete />
        <section className="rounded-carte border border-trait bg-surface-1 p-5 text-center">
          <h2 className="text-lg text-texte">La bascule n’a pas commencé</h2>
          <p className="mt-2 text-texte-doux">Elle démarre dès que les 6 comptes sont reliés dans Zernio. Date limite pour résilier Buffer : mercredi 18 novembre.</p>
          <Link href="/reglages" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-orange px-5 font-semibold text-sur-orange">Voir les connexions</Link>
        </section>
        {simulation && <p className="text-sm text-texte-doux">Mode simulation : la clé Zernio n’est pas renseignée.</p>}
      </Coquille>
    );
  }

  const { posts, comptes } = vue.donnees;
  const c = compter(posts);
  const lots = resumerLots(posts);
  const remplis = comptes.filter((x) => critereResiliation(x).rempli).length;
  const aReprogrammer = posts.filter((p) => Date.parse(p.datePrevue) < maintenant.getTime() && (p.etat === "a-verifier" || p.etat === "restant"));
  const lotAVerifier = lots.find((l) => l.code !== "C" && posts.some((p) => lotDe(p) === l.code && p.etat === "a-verifier"));
  const nbAVerifier = lotAVerifier ? posts.filter((p) => lotDe(p) === lotAVerifier.code && p.etat === "a-verifier").length : 0;
  const enLot = (code: CodeLot) => posts.filter((p) => lotDe(p) === code);
  const avant14 = maintenant.toISOString().slice(0, 10) < "2026-11-14";

  return (
    <Coquille>
      <Entete total={c.total} />
      <Heros posts={posts} />
      <DateLimite maintenant={maintenant} remplis={remplis} comptes={comptes.length} />
      <section aria-labelledby="mig-suite" className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte">
        <h2 id="mig-suite" className="text-sm font-semibold text-texte-doux">Prochaine étape · vous</h2>
        {lotAVerifier ? (
          <button type="button" onClick={() => setLotOuvert(lotAVerifier.code)} className="mt-2 min-h-12 w-full rounded-full bg-orange px-5 font-semibold text-sur-orange">
            Vérifier le lot {lotAVerifier.code} · {nbAVerifier} post{nbAVerifier > 1 ? "s" : ""}
          </button>
        ) : (
          <button type="button" disabled className="mt-2 min-h-12 w-full rounded-full bg-surface-3 px-5 font-semibold text-texte-doux">
            {avant14 && c.restants > 0 ? "Disponible le 14/11" : "Rien à faire pour l’instant"}
          </button>
        )}
      </section>
      <Frise jalons={jalonsPour(maintenant)} />
      <Lots lots={lots} onOuvrir={setLotOuvert} />
      <Criteres comptes={comptes} />
      <AReprogrammer posts={aReprogrammer} />
      {simulation && <p className="text-sm text-texte-doux">Mode simulation : la clé Zernio n’est pas renseignée.</p>}
      {lotOuvert && (
        <FenetreLot
          titre={`Lot ${lotOuvert}`}
          posts={enLot(lotOuvert).filter((p) => p.etat === "a-verifier")}
          comparaisons={comparaisons}
          service={service}
          maintenant={maintenant}
          onFermer={() => setLotOuvert(null)}
        />
      )}
    </Coquille>
  );
}
