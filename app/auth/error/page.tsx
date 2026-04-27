import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AuthErrorPage() {
  const t = await getTranslations("auth");

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-8">
      <div className="text-center max-w-[400px]">
        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={28} color="#ef4444" />
        </div>
        <h1 className="font-display font-extrabold text-[1.75rem] mb-3">
          {t("errorTitle")}
        </h1>
        <p className="text-[var(--text-secondary)] mb-8">
          {t("errorMessage")}
        </p>
        <Link href="/auth/signin" className="btn-primary no-underline inline-block">
          {t("backToSignIn")}
        </Link>
      </div>
    </div>
  );
}
