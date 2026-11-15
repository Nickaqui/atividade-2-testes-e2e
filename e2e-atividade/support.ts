import { test as base, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function execSql(sql: string) {
  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.atividade.e2e.yml",
      "-p",
      "aula4-atividade-e2e",
      "exec",
      "-T",
      "database",
      "psql",
      "-U",
      "postgres",
      "-d",
      "aula4_atividade_e2e",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      cwd: resolve(__dirname, ".."),
      encoding: "utf8",
      input: sql,
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `Falha ao executar SQL no banco E2E da atividade: ${result.error?.message ?? result.stderr}`,
    );
  }
}

export function resetAndSeedDatabase() {
  const seed = readFileSync(
    resolve(__dirname, "../database/seed.sql"),
    "utf8",
  );
  execSql(
    "TRUNCATE enrollments, courses, students RESTART IDENTITY CASCADE;\n" +
      seed,
  );
}

export function clearStudentsDatabase() {
  execSql("TRUNCATE enrollments, courses, students RESTART IDENTITY CASCADE;");
}

export const test = base.extend({
  page: async ({ page }, use) => {
    resetAndSeedDatabase();
    const initialListPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/students" &&
        response.request().method() === "GET",
    );
    await page.goto("/");
    const initialListResponse = await initialListPromise;
    expect(initialListResponse.status()).toBe(200);
    await expect(page.locator("#students")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.getByTestId("list-message")).toHaveAttribute(
      "data-state",
      "success",
    );
    await use(page);
  },
});

export { expect };
