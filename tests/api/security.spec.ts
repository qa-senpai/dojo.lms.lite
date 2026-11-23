import {
  test,
  expect,
  apiLogin,
  createCourse,
  origin,
} from "../support/helpers";
test("authentication, CSRF, malformed JSON and removed integrations", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/courses", {
        headers: { Origin: origin },
        data: { title: "No auth" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/sign-in", {
        headers: { Origin: "http://evil.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth/sign-in", {
        headers: { Origin: origin, "Content-Type": "application/json" },
        data: "{",
      })
    ).status(),
  ).toBe(400);
  for (const path of [
    "/api/webhooks/monobank",
    "/api/auth/providers",
    "/api/posts",
    "/api/radio",
  ])
    expect((await request.get(path)).status()).toBe(404);
  await apiLogin(request, "student");
  expect(
    (
      await request.post("/api/courses", {
        headers: { Origin: origin },
        data: { title: "Forbidden" },
      })
    ).status(),
  ).toBe(403);
});
test("draft privacy, scoped chapter access, multipart attachments and deletion", async ({
  request,
  playwright,
}) => {
  await apiLogin(request);
  const courseId = await createCourse(request, { published: false });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  expect((await anonymous.get("/api/courses/" + courseId)).status()).toBe(404);
  const chapter = await request.post("/api/courses/" + courseId + "/chapters", {
    headers: { Origin: origin },
    data: { title: "Private lesson", published: true },
  });
  expect(chapter.status()).toBe(201);
  const chapterId = (await chapter.json()).id;
  await request.patch("/api/courses/" + courseId, {
    headers: { Origin: origin },
    data: { title: "Published", published: true },
  });
  const student = await playwright.request.newContext({ baseURL: origin });
  await apiLogin(student, "student");
  expect(
    (
      await student.get("/api/courses/" + courseId + "/chapters/" + chapterId)
    ).status(),
  ).toBe(403);
  expect(
    (
      await student.post("/api/courses/" + courseId + "/enroll", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await student.get("/api/courses/" + courseId + "/chapters/" + chapterId)
    ).status(),
  ).toBe(200);
  const other = await createCourse(request);
  expect(
    (
      await request.patch("/api/courses/" + other + "/chapters/" + chapterId, {
        headers: { Origin: origin },
        data: { title: "Wrong owner" },
      })
    ).status(),
  ).toBe(404);
  const uploaded = await request.post(
    "/api/courses/" + courseId + "/attachments",
    {
      headers: { Origin: origin },
      multipart: {
        file: {
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Course attachment"),
        },
      },
    },
  );
  expect(uploaded.status()).toBe(201);
  const fileId = (await uploaded.json()).id;
  const download = await student.get(
    "/api/courses/" + courseId + "/attachments/" + fileId,
  );
  expect(await download.text()).toBe("Course attachment");
  expect(download.headers()["content-disposition"]).toContain("attachment;");
  await request.delete("/api/courses/" + courseId + "/students", {
    headers: { Origin: origin },
    data: { email: "student@dojo.test" },
  });
  expect(
    (
      await student.get("/api/courses/" + courseId + "/attachments/" + fileId)
    ).status(),
  ).toBe(403);
  await request.delete("/api/courses/" + courseId, {
    headers: { Origin: origin },
    data: {},
  });
  expect((await request.get("/api/admin/courses/" + courseId)).status()).toBe(
    404,
  );
  await request.delete("/api/courses/" + other, {
    headers: { Origin: origin },
    data: {},
  });
  await student.dispose();
  await anonymous.dispose();
});
