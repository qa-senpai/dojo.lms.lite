import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../_auth";
import { RemoteForm } from "@/components/ui/remote-form";
export default async function Page() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <section className="narrow panel">
      <p className="eyebrow">{"// обліковий запис"}</p>
      <h1>Увійти до навчання</h1>
      <RemoteForm url="/api/auth/sign-in" label="Увійти" redirect="/dashboard">
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
      </RemoteForm>
      <p className="section">
        <Link href="/sign-up">Створити обліковий запис</Link>
      </p>
    </section>
  );
}
