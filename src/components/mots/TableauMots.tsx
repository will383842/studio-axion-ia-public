"use client";

// MG-4 — tableau des mots : une ligne par mot. Présentation pure : données et gestes arrivent en propriétés,
// aucun service serveur, aucun appel réseau. Changer la cible passe toujours par une confirmation.
import { useEffect, useRef, useState, type RefObject } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { EtatVide } from "@/components/ui/EtatVide";
import { Pastille } from "@/components/ui/Pastille";
import type {
  ElementCatalogue,
  Fenetres,
  LigneTableauMot,
  VueTableauMots,
} from "@/domaine/guide-reseau/cibles-contrat";
import type { EtatMotVue } from "@/domaine/guide-reseau/vue-mots-cibles";
import { ChoixCibleMot } from "./ChoixCibleMot";
import { LIBELLES_MOTS as L } from "./tableau-mots-libelles";

export interface ProprietesTableauMots {
  vue: VueTableauMots;
  /** Catalogue des cibles, pour proposer un autre choix. */
  catalogue: readonly ElementCatalogue[];
  /** Appelée seulement après la confirmation de l'opérateur. */
  onChangerCible: (mot: string, codeCible: string) => void;
  /** État de chaque mot (pastille Actif / En pause / Brouillon) ; sans lui, la ligne dit Actif ou En pause. */
  etats?: Record<string, EtatMotVue>;
  /** Ouvre la fiche du mot (bouton « Ouvrir »). */
  onOuvrirMot?: (mot: string) => void;
  /** Boutons « Ouvrir » par mot : l'écran y remet le focus quand il ferme la fiche. */
  refsOuvrir?: RefObject<Record<string, HTMLButtonElement | null>>;
}

interface GroupeMot {
  mot: string;
  principale: LigneTableauMot;
  reseaux: string[];
  /** Vrai si les réseaux du mot n'ont pas tous la même cible. */
  differe: boolean;
  probleme: boolean;
}

/** Une ligne par mot : les réseaux d'un même mot sont regroupés, la cible est la même pour tous. */
function grouperParMot(lignes: readonly LigneTableauMot[]): GroupeMot[] {
  const groupes = new Map<string, GroupeMot>();
  for (const l of lignes) {
    const g = groupes.get(l.mot) ?? {
      mot: l.mot,
      principale: l,
      reseaux: [],
      differe: false,
      probleme: false,
    };
    if (!g.reseaux.includes(L.reseau[l.reseau]))
      g.reseaux.push(L.reseau[l.reseau]);
    const enAlerte = l.cibleIntrouvable || l.divergent;
    // Une ligne en alerte l'emporte pour que le problème reste visible.
    if (
      !groupes.has(l.mot) ||
      (enAlerte && !(g.principale.cibleIntrouvable || g.principale.divergent))
    )
      g.principale = l;
    if ((l.cible?.code ?? null) !== (g.principale.cible?.code ?? null))
      g.differe = true;
    if (enAlerte) g.probleme = true;
    groupes.set(l.mot, g);
  }
  // Seconde passe : la cible « principale » peut avoir changé après coup.
  for (const g of groupes.values()) {
    const code = g.principale.cible?.code ?? null;
    g.differe = lignes.some(
      (l) => l.mot === g.mot && (l.cible?.code ?? null) !== code,
    );
    if (g.differe) g.probleme = true;
  }
  return [...groupes.values()];
}

function Chiffres({ f, auMoins }: { f: Fenetres; auMoins?: boolean }) {
  const v = (n: number) => (auMoins && n > 0 ? L.auMoins(n) : String(n));
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-texte-doux">
      <dt>{L.fenetres.j7}</dt>
      <dd className="m-0 font-semibold text-texte">{v(f.j7)}</dd>
      <dt>{L.fenetres.j30}</dt>
      <dd className="m-0 font-semibold text-texte">{v(f.j30)}</dd>
      <dt>{L.fenetres.total}</dt>
      <dd className="m-0 font-semibold text-texte">{v(f.total)}</dd>
    </dl>
  );
}

export function TableauMots({
  vue,
  catalogue,
  onChangerCible,
  etats,
  onOuvrirMot,
  refsOuvrir,
}: ProprietesTableauMots) {
  // Mot en cours de changement, puis (après un choix) la cible à confirmer.
  const [motEnEdition, setMotEnEdition] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const lignes = grouperParMot(vue.lignes);
  const nbProblemes = lignes.filter((g) => g.probleme).length;
  const titreRef = useRef<HTMLHeadingElement | null>(null);
  const boutonsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const actuelle =
    motEnEdition === null
      ? null
      : (lignes.find((g) => g.mot === motEnEdition)?.principale.cible?.code ??
        null);

  // Le panneau s'ouvre : le titre prend le focus pour que le lecteur d'écran l'annonce.
  useEffect(() => {
    if (motEnEdition !== null) titreRef.current?.focus();
  }, [motEnEdition]);
  const cibleChoisie =
    aConfirmer === null
      ? null
      : (catalogue.find((e) => e.code === aConfirmer) ?? null);

  const fermer = () => {
    const mot = motEnEdition;
    setMotEnEdition(null);
    setAConfirmer(null);
    // Le focus revient au bouton « Changer la cible » du mot.
    if (mot !== null) boutonsRef.current[mot]?.focus();
  };
  const confirmer = () => {
    if (motEnEdition === null || aConfirmer === null) return;
    onChangerCible(motEnEdition, aConfirmer);
    fermer();
  };

  return (
    <div className="flex flex-col gap-3" data-ecran="tableau-mots">
      <p className="text-sm text-texte-doux">{L.aide}</p>
      {vue.indisponible && (
        <p role="alert" className="text-sm font-semibold text-brique">
          {L.siteSilencieux}
        </p>
      )}
      {nbProblemes > 0 && (
        <p role="alert" className="text-sm font-semibold text-brique">
          {L.alerteSynthese(nbProblemes)}
        </p>
      )}
      {vue.ignores > 0 && (
        <p className="text-sm text-texte-doux">
          {L.lignesIgnorees(vue.ignores)}
        </p>
      )}

      {lignes.length === 0 ? (
        <EtatVide
          icone="bouclier"
          titre={L.aucunMot}
          phrase={L.aucunMotAide}
          compact
        />
      ) : (
        <div className="overflow-x-auto">
          <table
            role="table"
            aria-label={L.legendeTableau}
            className="w-full min-w-[880px] border-separate border-spacing-x-3 border-spacing-y-2 text-left"
          >
            <thead>
              <tr role="row" className="text-xs font-semibold text-texte-doux">
                <th role="columnheader" scope="col">
                  {L.colonnes.mot}
                </th>
                <th role="columnheader" scope="col">
                  {L.colonnes.cible}
                </th>
                <th role="columnheader" scope="col">
                  {L.colonnes.reseaux}
                </th>
                <th role="columnheader" scope="col">
                  {L.colonnes.ecrits}
                </th>
                <th role="columnheader" scope="col" title={L.aideEnvoyes}>
                  {L.colonnes.envoyes}
                </th>
                <th role="columnheader" scope="col" title={L.aideGagnees}>
                  {L.colonnes.gagnees}
                </th>
                <th role="columnheader" scope="col">
                  {L.colonnes.etat}
                </th>
                <th role="columnheader" scope="col">
                  {L.colonnes.action}
                </th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ mot, principale: l, reseaux, differe }) => {
                const etat: EtatMotVue =
                  etats?.[mot] ?? (l.actif ? "actif" : "pause");
                return (
                  <tr key={mot} role="row" data-mot={mot} className="align-top">
                    <th
                      role="rowheader"
                      scope="row"
                      className="text-left text-[15px] font-semibold text-texte"
                    >
                      {mot}
                    </th>
                    <td role="cell" className="min-w-0 text-sm text-texte">
                      <div className="flex flex-col gap-1">
                        {l.cible ? (
                          <>
                            <span className="font-semibold">
                              {l.cible.titre}
                            </span>
                            <span className="flex flex-wrap gap-1">
                              <Pastille>{L.typeElement[l.cible.type]}</Pastille>
                              {l.cible.test && (
                                <Pastille ton="ambre">{L.badgeTest}</Pastille>
                              )}
                            </span>
                          </>
                        ) : (
                          <span className="text-texte-doux">{L.sansCible}</span>
                        )}
                        {l.cibleIntrouvable && (
                          <p
                            role="status"
                            className="text-xs font-semibold text-brique"
                          >
                            {L.alerteIntrouvable}
                          </p>
                        )}
                        {l.divergent && (
                          <p
                            role="status"
                            className="text-xs font-semibold text-ambre"
                          >
                            {L.alerteDivergent}
                          </p>
                        )}
                        {differe && (
                          <p
                            role="status"
                            className="text-xs font-semibold text-ambre"
                          >
                            {L.cibleDiffere}
                          </p>
                        )}
                      </div>
                    </td>
                    <td role="cell" className="text-sm text-texte">
                      {reseaux.join(", ")}
                    </td>
                    {l.stats ? (
                      <>
                        <td role="cell">
                          <Chiffres f={l.stats.ecrits} />
                        </td>
                        <td role="cell">
                          <Chiffres f={l.stats.envoyes} />
                        </td>
                        <td role="cell">
                          <Chiffres f={l.stats.suivent} auMoins />
                        </td>
                      </>
                    ) : (
                      <td
                        role="cell"
                        colSpan={3}
                        aria-colspan={3}
                        className="text-sm text-texte-doux"
                      >
                        {L.pasDeChiffres}
                      </td>
                    )}
                    <td role="cell">
                      <Pastille
                        ton={
                          etat === "actif"
                            ? "sauge"
                            : etat === "pause"
                              ? "ambre"
                              : "neutre"
                        }
                      >
                        {etat === "actif"
                          ? L.etatActif
                          : etat === "pause"
                            ? L.etatPause
                            : L.etatBrouillon}
                      </Pastille>
                    </td>
                    <td role="cell">
                      <div className="flex flex-wrap gap-2">
                        <Bouton
                          variante="secondaire"
                          aria-label={L.changerCibleDuMot(mot)}
                          ref={(b) => {
                            boutonsRef.current[mot] = b;
                          }}
                          onClick={() => {
                            setMotEnEdition(mot);
                            setAConfirmer(null);
                          }}
                        >
                          {L.changerCible}
                        </Bouton>
                        {onOuvrirMot && (
                          <Bouton
                            variante="secondaire"
                            aria-label={L.ouvrirLaFiche(mot)}
                            ref={(b) => {
                              if (refsOuvrir) refsOuvrir.current[mot] = b;
                            }}
                            onClick={() => onOuvrirMot(mot)}
                          >
                            {L.ouvrir}
                          </Bouton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-texte-doux">{L.suivreLeCompte}</p>

      {motEnEdition !== null && (
        <Carte data-carte="changer-cible">
          <h3
            ref={titreRef}
            tabIndex={-1}
            className="text-base text-texte outline-none"
          >
            {L.changerCibleDuMot(motEnEdition)}
          </h3>
          <div className="mt-2">
            <ChoixCibleMot
              catalogue={catalogue}
              valeur={aConfirmer}
              actuelle={actuelle}
              onChoisir={setAConfirmer}
            />
          </div>
          <div aria-live="polite">
            {aConfirmer !== null && (
              <div
                role="group"
                aria-label={L.confirmation.groupe}
                className="mt-3 flex flex-col gap-2"
                data-confirmation
              >
                <p className="text-sm font-semibold text-texte">
                  {L.confirmation.titre(
                    motEnEdition,
                    cibleChoisie?.titre ?? aConfirmer,
                  )}
                </p>
                <p className="text-sm text-texte-doux">
                  {L.confirmation.rassurance}
                </p>
                <p className="text-sm text-texte-doux">
                  {L.confirmation.rassuranceTextes}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Bouton onClick={confirmer}>
                    {L.confirmation.confirmer}
                  </Bouton>
                  <Bouton variante="fantome" onClick={fermer}>
                    {L.confirmation.annuler}
                  </Bouton>
                </div>
              </div>
            )}
          </div>
          {aConfirmer === null && (
            <Bouton className="mt-3" variante="fantome" onClick={fermer}>
              {L.confirmation.annuler}
            </Bouton>
          )}
        </Carte>
      )}
    </div>
  );
}
