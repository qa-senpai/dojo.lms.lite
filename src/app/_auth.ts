import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { sessionUser } from "@/modules/accounts/server";
import { AppError } from "@/platform/errors";
export async function currentUser() {
  return sessionUser((await cookies()).get("dojo_session")?.value);
}
export async function signedIn(admin = false) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (admin && user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
export function pageData<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    if (error instanceof AppError && error.status === 403) redirect("/courses");
    throw error;
  }
}
