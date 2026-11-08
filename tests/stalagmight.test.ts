import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";
import {
  createApiClient,
  v2ProjectsDownloadRetrieveByFormat,
  v2ProjectsDownloadRetrieveByFormatAtHash,
  v2ProjectsUpload,
} from "../src/index";

it("preserves Stalagmight paths, multipart metadata and download bytes", async () => {
  // This loopback witness checks transport; the backend owns SQLite validation.
  const bytes = new Uint8Array([0, 255, 128, 13, 10]);
  const received: {
    method: string;
    url: string;
    form?: FormData;
    body?: Buffer;
  }[] = [];
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method === "PUT") {
        const chunks: Buffer[] = [];
        for await (const chunk of request)
          chunks.push(Buffer.from(chunk as Uint8Array));
        const body = Buffer.concat(chunks);
        const form = await new Response(body, {
          headers: { "Content-Type": request.headers["content-type"]! },
        }).formData();
        received.push({
          method: request.method,
          url: request.url!,
          form,
          body,
        });
        response.writeHead(304).end();
      } else {
        received.push({ method: request.method!, url: request.url! });
        response.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition":
            'attachment; filename="survey__revision.stalx"',
        });
        response.end(bytes);
      }
    })().catch(() => response.writeHead(500).end());
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const client = createApiClient({
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    const upload = await v2ProjectsUpload(
      "project",
      "stalagmight",
      {
        artifact: [
          new File([bytes], "survey.stalx", {
            type: "application/vnd.sqlite3",
          }),
        ],
        message: "Stalagmight revision",
      },
      undefined,
      { client },
    );
    expect(upload.status).toBe(304);
    const form = received[0]!.form!;
    expect(form.get("message")).toBe("Stalagmight revision");
    expect(form.getAll("artifact")).toHaveLength(1);
    const artifact = form.get("artifact") as File;
    expect(artifact.name).toBe("survey.stalx");
    // Bun's multipart parser drops this MIME type; inspect the actual wire header.
    expect(received[0]!.body!.toString("latin1")).toContain(
      "Content-Type: application/vnd.sqlite3\r\n",
    );
    expect(new Uint8Array(await artifact.arrayBuffer())).toEqual(bytes);

    const latest = await v2ProjectsDownloadRetrieveByFormat(
      "project",
      "stalagmight",
      undefined,
      { client },
    );
    const historical = await v2ProjectsDownloadRetrieveByFormatAtHash(
      "project",
      "stalagmight",
      "abcdef01",
      undefined,
      { client },
    );
    for (const download of [latest, historical]) {
      expect(download.status).toBe(200);
      expect(download.data).toBeInstanceOf(Blob);
      expect(
        new Uint8Array(await (download.data as Blob).arrayBuffer()),
      ).toEqual(bytes);
      expect(download.headers.get("content-disposition")).toBe(
        'attachment; filename="survey__revision.stalx"',
      );
    }
    expect(received.map(({ method, url }) => [method, url])).toEqual([
      ["PUT", "/api/v2/projects/project/upload/stalagmight/"],
      ["GET", "/api/v2/projects/project/download/stalagmight/"],
      ["GET", "/api/v2/projects/project/download/stalagmight/abcdef01/"],
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  }
});
