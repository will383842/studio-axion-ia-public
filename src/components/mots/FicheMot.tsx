"use client";

// R4 — fiche d'un mot : ce qu'il envoie, ses textes réseau par réseau, ses comptes, ses chiffres.
// Présentation pure : tout arrive en propriétés. `services` = gestes DÉJÀ protégés par une confirmation
// (voir gestes-mots-cibles.ts) : aucun geste ne part sans un « oui ».
import type { ReactNode, Ref } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { Squelette } from "@/components/ui/Squelette";
import type {
  ElementCatalogue,
  Fenetres,
} from "@/domaine/guide-reseau/cibles-contrat";
import type {
  ApercuReseauVue,
  ApercuTextesVue,
  CompteDuMot,
  EtatValidationVue,
  ResumeMot,
} from "@/domaine/guide-reseau/vue-mots-cibles";
import { LIBELLES_FICHE as F, NOM_RESEAU } from "./fiche-mot-libelles";
import type { GestesMotsCibles } from "./gestes-mots-cibles";

export interface ProprietesFicheMot {
  resume: ResumeMot;
  catalogue: readonly ElementCatalogue[];
  /** `null` : les textes se chargent. */
  apercu: ApercuTextesVue | null;
  services: GestesMotsCibles;
  onFermer: () => void;
  /** Titre de la fiche : l'écran lui donne le focus à l'ouverture. */
  titreRef?: Ref<HTMLHeadingElement>;
}

type ApercuOk = Extract<ApercuReseauVue, { ok: true }>;

/** Le texte d'un message, sans jamais montrer le marqueur brut du lien personnel. */
export const texteSansMarqueur = (t: string): string =>
  t.replace(/\[LIEN\]/g, F.textes.lien);

const TON_VALIDATION: Record<EtatValidationVue, "sauge" | "ambre" | "neutre"> =
  {
    valide: "sauge",
    perimee: "ambre",
    absente: "neutre",
  };

function Titre({ children }: { children: ReactNode }) {
  return <h4 className="text-[15px] font-semibold text-texte">{children}</h4>;
}

function LigneChiffres({
  libelle,
  f,
  auMoins,
  aVerifier,
}: {
  libelle: string;
  f: Fenetres;
  auMoins?: boolean;
  aVerifier?: Fenetres;
}) {
  const cellule = (cle: keyof Fenetres) => (
    <td role="cell" className="px-2 py-1 align-top text-texte">
      <span className="font-semibold">
        {auMoins
          ? f[cle] === 0
            ? F.chiffres.aucuneVue
            : F.chiffres.auMoins(f[cle])
          : String(f[cle])}
      </span>
      {aVerifier && aVerifier[cle] > 0 && (
        <span className="block text-xs text-texte-doux">
          {F.chiffres.aVerifier(aVerifier[cle])}
        </span>
      )}
    </td>
  );
  return (
    <tr role="row">
      <th
        role="rowheader"
        scope="row"
        className="py-1 pr-2 text-left text-sm font-normal text-texte-doux"
      >
        {libelle}
      </th>
      {cellule("j7")}
      {cellule("j30")}
      {cellule("total")}
    </tr>
  );
}

function SectionEnvoie({
  apercu,
  resume,
}: {
  apercu: ApercuTextesVue | null;
  resume: ResumeMot;
}) {
  const E = F.envoie;
  if (apercu === null)
    return (
      <div role="status" className="flex flex-col gap-2">
        <Squelette className="h-4 w-48" />
        <p className="text-sm text-texte-doux">{E.chargement}</p>
      </div>
    );
  const ok = apercu.ok ? apercu.reseaux.filter((r): r is ApercuOk => r.ok) : [];
  if (ok.length === 0)
    return <p className="text-sm text-texte-doux">{E.sansCible}</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {ok.map((r) => (
          <li
            key={r.reseau}
            className="flex flex-wrap items-center gap-2 text-sm text-texte"
          >
            {resume.cibleDiffere && (
              <span className="text-texte-doux">{NOM_RESEAU[r.reseau]} :</span>
            )}
            <span className="font-semibold">{r.cible.titre}</span>
            <Pastille>
              {r.cible.type === "guide" ? E.guide : E.adresseType}
            </Pastille>
            {r.cible.test && <Pastille ton="ambre">{E.badgeTest}</Pastille>}
          </li>
        ))}
      </ul>
      {ok.some((r) => r.cible.type === "adresse") && (
        <p className="text-sm text-texte-doux">{E.adresse}</p>
      )}
      {ok.some((r) => r.cible.test) && (
        <p className="text-sm font-semibold text-ambre">{E.test}</p>
      )}
    </div>
  );
}

function SectionTextes({
  apercu,
  resume,
  services,
}: {
  apercu: ApercuTextesVue | null;
  resume: ResumeMot;
  services: GestesMotsCibles;
}) {
  const T = F.textes;
  const estGuide = resume.mot === "GUIDE";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texte-doux">{T.aide}</p>
      {apercu === null ? (
        <div role="status" className="flex flex-col gap-2">
          <Squelette className="h-20 w-full" />
          <p className="text-sm text-texte-doux">{T.chargement}</p>
        </div>
      ) : !apercu.ok ? (
        <p role="status" className="text-sm font-semibold text-brique">
          {apercu.phrase}
        </p>
      ) : (
        apercu.reseaux.map((r) => (
          <div
            key={r.reseau}
            className="flex flex-col gap-2 rounded-xl border border-trait p-3"
            data-reseau={r.reseau}
          >
            <div className="flex flex-wrap items-center gap-2">
              <LogoReseau reseau={r.reseau} taille="sm" />
              <span className="text-sm font-semibold text-texte">
                {NOM_RESEAU[r.reseau]}
              </span>
              {r.ok && (
                <Pastille ton={TON_VALIDATION[r.etat]}>
                  {F.etatValidation[r.etat]}
                </Pastille>
              )}
            </div>
            {!r.ok ? (
              <p role="status" className="text-sm text-texte-doux">
                {r.phrase}
              </p>
            ) : (
              <>
                {r.textes.map((t) => (
                  <div key={`${t.groupe}/${t.version}`} className="text-sm">
                    <p className="m-0 text-xs font-semibold text-texte-doux">
                      {t.groupe} · {t.version}
                    </p>
                    <p className="m-0 whitespace-pre-wrap text-texte">
                      {texteSansMarqueur(t.texte)}
                    </p>
                  </div>
                ))}
                {r.etat === "perimee" && (
                  <p role="status" className="text-sm font-semibold text-ambre">
                    {T.explicationRevalider}
                  </p>
                )}
                {r.etat !== "valide" &&
                  (estGuide ? (
                    <p className="text-sm text-texte-doux">{T.guide}</p>
                  ) : (
                    <div>
                      <Bouton
                        variante="secondaire"
                        onClick={() =>
                          lancer(services.valider(resume.mot, r.reseau, r))
                        }
                      >
                        {T.valider(NOM_RESEAU[r.reseau])}
                      </Bouton>
                    </div>
                  ))}
              </>
            )}
          </div>
        ))
      )}
      <p className="text-sm text-texte-doux">{T.aLaMain}</p>
    </div>
  );
}

/** Titre de la cible de CE réseau, jamais celui d'un autre réseau ; `null` tant qu'il n'est pas connu. */
export function titreCible(
  apercu: ApercuTextesVue | null,
  c: CompteDuMot,
): string | null {
  if (apercu === null || !apercu.ok || c.reseau === null) return null;
  const r = apercu.reseaux.find((x) => x.reseau === c.reseau);
  return r !== undefined && r.ok ? r.cible.titre : null;
}

/** Les gestes ne rejettent jamais ; ceci garde une promesse oubliée sans erreur non gérée. */
const lancer = (p: Promise<unknown>) => void p.catch(() => undefined);

function SectionComptes({
  resume,
  apercu,
  services,
}: {
  resume: ResumeMot;
  apercu: ApercuTextesVue | null;
  services: GestesMotsCibles;
}) {
  const C = F.comptes;
  if (resume.comptes.length === 0)
    return <p className="text-sm text-texte-doux">{C.aucun}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {resume.comptes.map((c) => {
        const nom = c.nom ?? c.compte;
        const titre = titreCible(apercu, c);
        return (
          <li
            key={c.compte}
            className="flex flex-wrap items-center gap-2 text-sm text-texte"
            data-compte={c.compte}
          >
            {c.reseau !== null && <LogoReseau reseau={c.reseau} taille="sm" />}
            <span className="font-semibold">{nom}</span>
            {c.reseau !== null && (
              <span className="text-texte-doux">{NOM_RESEAU[c.reseau]}</span>
            )}
            <Pastille
              ton={
                c.etat === "actif"
                  ? "sauge"
                  : c.etat === "pause_auto"
                    ? "ambre"
                    : "neutre"
              }
            >
              {C.etat[c.etat]}
            </Pastille>
            {c.activable && titre !== null && (
              <Bouton
                variante="secondaire"
                aria-label={C.activerLe(resume.mot, nom)}
                onClick={() => lancer(services.activer(resume.mot, c, titre))}
              >
                {C.activer}
              </Bouton>
            )}
            {c.etat === "actif" && (
              <Bouton
                variante="secondaire"
                aria-label={C.pauseLe(resume.mot, nom)}
                onClick={() => lancer(services.mettreEnPause(resume.mot, c))}
              >
                {C.pause}
              </Bouton>
            )}
            {!c.activable && (c.raison !== null || c.etat !== "actif") && (
              <p className="m-0 w-full text-sm text-texte-doux">
                {(c.raison !== null ? C.raisons[c.raison] : undefined) ??
                  C.raisonInconnue}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SectionChiffres({ resume }: { resume: ResumeMot }) {
  const K = F.chiffres;
  const c = resume.chiffres;
  if (c === null) return <p className="text-sm text-texte-doux">{K.aucun}</p>;
  return (
    <div className="overflow-x-auto">
      <table role="table" aria-label={K.titre} className="w-full text-left">
        <thead>
          <tr role="row" className="text-xs font-semibold text-texte-doux">
            <th role="columnheader" scope="col" className="py-1 pr-2">
              {K.titre}
            </th>
            <th role="columnheader" scope="col" className="px-2 py-1">
              {K.fenetres.j7}
            </th>
            <th role="columnheader" scope="col" className="px-2 py-1">
              {K.fenetres.j30}
            </th>
            <th role="columnheader" scope="col" className="px-2 py-1">
              {K.fenetres.total}
            </th>
          </tr>
        </thead>
        <tbody>
          <LigneChiffres libelle={K.ecrits} f={c.ecrits} />
          <LigneChiffres
            libelle={K.envoyes}
            f={c.envoyes}
            aVerifier={c.incertains}
          />
          <LigneChiffres libelle={K.gagnees} f={c.suivent} auMoins />
          <LigneChiffres libelle={K.bloques} f={c.commentairesBloques} />
          <LigneChiffres libelle={K.refuses} f={c.envoisRefuses} />
        </tbody>
      </table>
    </div>
  );
}

export function FicheMot({
  resume,
  apercu,
  services,
  onFermer,
  titreRef,
}: ProprietesFicheMot) {
  return (
    <Carte data-carte="fiche-mot" as="section" aria-label={F.titre(resume.mot)}>
      <div className="flex flex-col gap-5">
        <h3
          ref={titreRef}
          tabIndex={-1}
          className="text-base text-texte outline-none"
        >
          {F.titre(resume.mot)}
        </h3>
        <section className="flex flex-col gap-2">
          <Titre>{F.envoie.titre}</Titre>
          <SectionEnvoie apercu={apercu} resume={resume} />
        </section>
        <section className="flex flex-col gap-2">
          <Titre>{F.textes.titre}</Titre>
          <SectionTextes apercu={apercu} resume={resume} services={services} />
        </section>
        <section className="flex flex-col gap-2">
          <Titre>{F.comptes.titre}</Titre>
          <SectionComptes resume={resume} apercu={apercu} services={services} />
        </section>
        <section className="flex flex-col gap-2">
          <Titre>{F.chiffres.titre}</Titre>
          <SectionChiffres resume={resume} />
        </section>
        <div>
          <Bouton variante="fantome" onClick={onFermer}>
            {F.fermer}
          </Bouton>
        </div>
      </div>
    </Carte>
  );
}
