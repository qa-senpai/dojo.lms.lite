import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../_auth";
import { RemoteForm } from "@/components/ui/remote-form";
export default async function Page() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <section className="narrow panel">
      <p className="eyebrow">{"// обліковий запис"}</p>
      <h1>Створити обліковий запис</h1>
      <RemoteForm
        url="/api/auth/sign-up"
        label="Зареєструватися"
        redirect="/dashboard"
      >
        <label>
          Ім’я
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
          />
        </label>
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
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
      </RemoteForm>
      <p className="section">
        <Link href="/sign-in">Уже маєте обліковий запис? Увійти</Link>
      </p>
    </section>
  );
}
