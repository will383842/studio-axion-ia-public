"use client";

import { toast, Toaster } from "sonner";

/** À placer une fois (layout racine). */
export function Toasts() {
  return (
    <Toaster
      position="top-center"
      offset={16}
      mobileOffset={{ top: 12, left: 16, right: 16 }}
      toastOptions={{
        classNames: {
          toast: "!rounded-carte !border !border-toast !bg-toast !text-toast-texte !shadow-carte !font-texte [&_:focus-visible]:!outline-toast-accent",
          description: "!text-toast-texte/80",
          actionButton: "!border !border-toast-accent !bg-transparent !text-toast-accent !rounded-champ !font-semibold",
          success: "[&_[data-icon]]:!text-toast-ok",
          error: "[&_[data-icon]]:!text-toast-erreur",
          warning: "[&_[data-icon]]:!text-toast-alerte",
        },
      }}
    />
  );
}

/** Messages courts, vouvoiement. `essai` : action d'un fournisseur simulé (AV2.4-4). */
export const notifier = {
  succes: (message: string, description?: string) => toast.success(message, { description }),
  erreur: (message: string, description?: string) => toast.error(message, { description }),
  info: (message: string, description?: string) => toast(message, { description }),
  /** Ex. notifier.essai("rien n'a été envoyé à Buffer") → « Essai : rien n'a été envoyé à Buffer ». */
  essai: (message: string) => toast.warning(`Essai : ${message}`),
};
