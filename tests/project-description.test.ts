import { expect, it } from "vitest";
import {
  createApiClient,
  v2ProjectsCreateWithJson,
  v2ProjectsUpdateWithJson,
} from "../src/index";

it("can omit description at creation and send an empty description on update", async () => {
  const bodies: unknown[] = [];
  const client = createApiClient({
    baseUrl: "https://example.invalid",
    transport: async (request) => {
      bodies.push(JSON.parse(String(request.body)));
      return { status: 400, data: {}, headers: new Headers() };
    },
  });
  const project = { name: "Survey", country: "US", type: "COMPASS" } as const;
  await v2ProjectsCreateWithJson(project, undefined, { client });
  await v2ProjectsUpdateWithJson(
    "project",
    { ...project, description: "" },
    undefined,
    { client },
  );
  expect(bodies).toEqual([project, { ...project, description: "" }]);
});
