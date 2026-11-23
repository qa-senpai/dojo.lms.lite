import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "./_auth";
import { RemoteForm } from "@/components/ui/remote-form";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Dojo LMS Lite", template: "%s · Dojo LMS Lite" },
  description: "Навчальний простір",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <html lang="uk">
      <body>
        <a className="skip-link" href="#main">
          До вмісту
        </a>
        <header>
          <nav aria-label="Головна навігація">
            <Link href="/courses" className="brand">
              dojo<span>.lms</span>
              <small>lite</small>
            </Link>
            <div className="nav-links">
              <Link href="/courses">Курси</Link>
              {user ? (
                <>
                  <Link href="/dashboard">Моє навчання</Link>
                  {user.role === "ADMIN" ? (
                    <Link href="/admin/courses">Керування курсами</Link>
                  ) : null}
                  <span className="muted username">{user.name}</span>
                  <RemoteForm
                    url="/api/auth/sign-out"
                    label="Вийти"
                    redirect="/sign-in"
                    className="inline"
                  />
                </>
              ) : (
                <>
                  <Link href="/sign-in">Увійти</Link>
                  <Link href="/sign-up" className="button">
                    Зареєструватися
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span className="mono">{"// dojo.lms.lite"}</span>
          <span>Навчайся. Практикуйся. Перевіряй.</span>
        </footer>
      </body>
    </html>
  );
}
