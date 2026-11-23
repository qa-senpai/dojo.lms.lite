import { cookies } from "next/headers";
import { z } from "zod";
import {
  login,
  register,
  logout,
  sessionUser,
  SESSION_SECONDS,
  requireAdmin,
} from "@/modules/accounts/server";
import {
  adminCourses,
  adminCourse,
  adminChapter,
  saveCourse,
  deleteCourse,
  saveChapter,
  deleteChapter,
  saveExercise,
  deleteExercise,
  reorder,
} from "@/modules/course-authoring/server";
import { listCourses, courseDetail } from "@/modules/course-catalog/server";
import { enroll, changeEnrollment } from "@/modules/course-roster/server";
import { player, markRead, submitExercise } from "@/modules/learning/server";
import { submitHomework, reviewHomework } from "@/modules/homework/server";
import {
  uploadAttachment,
  deleteAttachment,
  attachment,
} from "@/modules/course-files/server";
import {
  appOrigin,
  checkOrigin,
  boundedBody,
  jsonBody,
  errorResponse,
} from "@/platform/http";
import { AppError, demand } from "@/platform/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function dispatch(request: Request, context: Context) {
  try {
    const { path: p } = await context.params;
    const method = request.method;
    const cookieStore = await cookies();
    const token = cookieStore.get("dojo_session")?.value;
    const user = sessionUser(token);
    if (method !== "GET") checkOrigin(request);
    if (p[0] === "health" && p.length === 1 && method === "GET")
      return Response.json({ status: "ok" });
    if (p[0] === "auth" && p.length === 2 && method === "POST") {
      if (p[1] === "sign-out") {
        logout(token);
        cookieStore.delete("dojo_session");
        return Response.json({ ok: true });
      }
      if (p[1] === "sign-in" || p[1] === "sign-up") {
        const result = await (p[1] === "sign-in" ? login : register)(
          await jsonBody(request),
        );
        cookieStore.set("dojo_session", result.token, {
          httpOnly: true,
          sameSite: "lax",
          secure: appOrigin().startsWith("https:"),
          path: "/",
          maxAge: SESSION_SECONDS,
        });
        return Response.json(
          { user: result.user },
          { status: p[1] === "sign-up" ? 201 : 200 },
        );
      }
    }
    if (p[0] === "admin" && p[1] === "courses" && method === "GET") {
      requireAdmin(user);
      if (p.length === 2) return Response.json(adminCourses(user));
      if (p.length === 3) return Response.json(adminCourse(user, p[2]));
      if (p.length === 5 && p[3] === "chapters")
        return Response.json(adminChapter(user, p[2], p[4]));
    }
    if (p[0] === "courses") {
      const courseId = p[1],
        chapterId = p[3];
      if (p.length === 1) {
        if (method === "GET")
          return Response.json(
            listCourses(new URL(request.url).searchParams.get("q") || ""),
          );
        if (method === "POST") {
          requireAdmin(user);
          return Response.json(
            saveCourse(user, null, await jsonBody(request)),
            { status: 201 },
          );
        }
      }
      if (p.length === 2) {
        if (method === "GET")
          return Response.json(courseDetail(user, courseId));
        requireAdmin(user);
        if (method === "PATCH")
          return Response.json(
            saveCourse(user, courseId, await jsonBody(request)),
          );
        if (method === "DELETE") {
          deleteCourse(user, courseId);
          return Response.json({ ok: true });
        }
      }
      if (p[2] === "enroll" && p.length === 3 && method === "POST") {
        enroll(user, courseId);
        return Response.json({ ok: true });
      }
      if (
        p[2] === "students" &&
        p.length === 3 &&
        ["POST", "DELETE"].includes(method)
      ) {
        requireAdmin(user);
        const data = z
          .object({ email: z.email() })
          .parse(await jsonBody(request));
        changeEnrollment(user, courseId, data.email, method === "DELETE");
        return Response.json({ ok: true });
      }
      if (p[2] === "reviews" && p.length === 4 && method === "PATCH") {
        requireAdmin(user);
        reviewHomework(user, courseId, p[3], await jsonBody(request));
        return Response.json({ ok: true });
      }
      if (p[2] === "attachments") {
        if (p.length === 4 && method === "GET") {
          const file = attachment(user, courseId, p[3]);
          return new Response(new Uint8Array(file.bytes), {
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Disposition":
                "attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
              "Cache-Control": "private, no-store",
            },
          });
        }
        requireAdmin(user);
        if (p.length === 3 && method === "POST") {
          const raw = await boundedBody(request, 5 * 1024 * 1024 + 8192);
          const data = await new Request(request.url, {
            method: "POST",
            headers: request.headers,
            body: new Uint8Array(raw),
          }).formData();
          const file = data.get("file");
          demand(file instanceof File, 400, "Оберіть файл");
          return Response.json(await uploadAttachment(user, courseId, file), {
            status: 201,
          });
        }
        if (p.length === 4 && method === "DELETE") {
          deleteAttachment(user, courseId, p[3]);
          return Response.json({ ok: true });
        }
      }
      if (p[2] === "chapters") {
        if (p.length === 4 && chapterId === "reorder" && method === "POST") {
          requireAdmin(user);
          reorder(
            user,
            courseId,
            z
              .object({ ids: z.array(z.string()) })
              .parse(await jsonBody(request)).ids,
          );
          return Response.json({ ok: true });
        }
        if (p.length === 3 && method === "POST") {
          requireAdmin(user);
          return Response.json(
            saveChapter(user, courseId, null, await jsonBody(request)),
            { status: 201 },
          );
        }
        if (p.length === 4) {
          if (method === "GET")
            return Response.json(player(user, courseId, chapterId));
          requireAdmin(user);
          if (method === "PATCH")
            return Response.json(
              saveChapter(user, courseId, chapterId, await jsonBody(request)),
            );
          if (method === "DELETE") {
            deleteChapter(user, courseId, chapterId);
            return Response.json({ ok: true });
          }
        }
        if (p[4] === "progress" && p.length === 5 && method === "POST") {
          markRead(
            user,
            courseId,
            chapterId,
            z.object({ done: z.boolean() }).parse(await jsonBody(request)).done,
          );
          return Response.json({ ok: true });
        }
        if (p[4] === "homework" && p.length === 5 && method === "POST") {
          submitHomework(user, courseId, chapterId, await jsonBody(request));
          return Response.json({ ok: true });
        }
        if (p[4] === "exercises") {
          if (p.length === 7 && p[6] === "attempt" && method === "POST")
            return Response.json(
              submitExercise(
                user,
                courseId,
                chapterId,
                p[5],
                z
                  .object({
                    answer: z.unknown().optional(),
                    code: z.unknown().optional(),
                    passed: z.unknown().optional(),
                  })
                  .parse(await jsonBody(request)),
              ),
            );
          requireAdmin(user);
          if (p.length === 6 && p[5] === "reorder" && method === "POST") {
            reorder(
              user,
              courseId,
              z
                .object({ ids: z.array(z.string()) })
                .parse(await jsonBody(request)).ids,
              chapterId,
            );
            return Response.json({ ok: true });
          }
          if (p.length === 5 && method === "POST")
            return Response.json(
              saveExercise(
                user,
                courseId,
                chapterId,
                null,
                await jsonBody(request),
              ),
              { status: 201 },
            );
          if (p.length === 6 && method === "PATCH")
            return Response.json(
              saveExercise(
                user,
                courseId,
                chapterId,
                p[5],
                await jsonBody(request),
              ),
            );
          if (p.length === 6 && method === "DELETE") {
            deleteExercise(user, courseId, chapterId, p[5]);
            return Response.json({ ok: true });
          }
        }
      }
    }
    throw new AppError(404, "Маршрут не знайдено");
  } catch (error) {
    return errorResponse(error);
  }
}
async function handle(request: Request, context: Context) {
  const response = await dispatch(request, context);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
