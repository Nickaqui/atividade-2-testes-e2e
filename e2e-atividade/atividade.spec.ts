import { clearStudentsDatabase, expect, test } from "./support";

const INITIAL_STUDENTS = [
  { ra: "258001", name: "Ana Clara Silva" },
  { ra: "258002", name: "Bruno Henrique Santos" },
  { ra: "258003", name: "Camila Oliveira Souza" },
];

test("listagem inicial exibe na tabela os alunos existentes no banco ao abrir a página", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Cadastro de alunos" }),
  ).toBeVisible();
  await expect(page.getByTestId("list-message")).toHaveAttribute(
    "data-state",
    "success",
  );
  await expect(page.getByTestId("list-message")).toHaveText("");

  const rows = page.getByTestId("student-row");
  await expect(rows).toHaveCount(INITIAL_STUDENTS.length);

  for (const [index, student] of INITIAL_STUDENTS.entries()) {
    const cells = rows.nth(index).locator("td");
    await expect(cells.nth(0)).toHaveText(student.ra);
    await expect(cells.nth(1)).toHaveText(student.name);
  }
});

test("cadastro válido exibe mensagem de sucesso, limpa o formulário e atualiza a tabela sem recarregar a página", async ({
  page,
}) => {
  const raInput = page.getByLabel("RA", { exact: true });
  const nameInput = page.getByLabel("Nome", { exact: true });
  const submitButton = page.getByRole("button", { name: "Cadastrar aluno" });

  let mainFrameNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      mainFrameNavigations += 1;
    }
  });

  await raInput.fill("258099");
  await nameInput.fill("Mariana Costa");

  const createResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "POST",
  );
  const refreshListPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "GET",
  );

  await submitButton.click();

  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  expect(await createResponse.json()).toEqual({
    ra: 258099,
    name: "Mariana Costa",
  });

  const refreshResponse = await refreshListPromise;
  expect(refreshResponse.status()).toBe(200);

  // Mensagem de sucesso exibida
  const formMessage = page.getByTestId("form-message");
  await expect(formMessage).toHaveAttribute("data-state", "success");
  await expect(formMessage).toHaveText("Aluno cadastrado com sucesso.");

  // Limpeza do formulário após o cadastro bem-sucedido
  await expect(raInput).toHaveValue("");
  await expect(nameInput).toHaveValue("");
  await expect(submitButton).toBeEnabled();

  // Atualização automática da tabela sem recarregar a página
  expect(mainFrameNavigations).toBe(0);
  await expect(page.locator("#students")).toHaveAttribute("aria-busy", "false");
  const rows = page.getByTestId("student-row");
  await expect(rows).toHaveCount(4);
  await expect(
    rows.filter({ hasText: "258099" }).filter({ hasText: "Mariana Costa" }),
  ).toHaveCount(1);
});

test("persistência mantém o aluno cadastrado na tabela após recarregar a página", async ({
  page,
}) => {
  await page.getByLabel("RA", { exact: true }).fill("258100");
  await page.getByLabel("Nome", { exact: true }).fill("Pedro Almeida");

  const createPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "POST",
  );
  const listUpdatePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "GET",
  );

  await page.getByRole("button", { name: "Cadastrar aluno" }).click();
  expect((await createPromise).status()).toBe(201);
  expect((await listUpdatePromise).status()).toBe(200);

  await expect(page.getByTestId("student-row")).toHaveCount(4);

  const reloadListPromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "GET",
  );
  await page.reload();
  expect((await reloadListPromise).status()).toBe(200);
  await expect(page.locator("#students")).toHaveAttribute("aria-busy", "false");

  const rows = page.getByTestId("student-row");
  await expect(rows).toHaveCount(4);
  await expect(
    rows.filter({ hasText: "258100" }).filter({ hasText: "Pedro Almeida" }),
  ).toHaveCount(1);
});

for (const scenario of [
  {
    description: "RA vazio",
    ra: "",
    name: "Aluno Sem RA",
    invalidFieldLabel: "RA",
  },
  {
    description: "Nome vazio",
    ra: "258101",
    name: "",
    invalidFieldLabel: "Nome",
  },
  {
    description: "RA e Nome vazios",
    ra: "",
    name: "",
    invalidFieldLabel: "RA",
  },
]) {
  test(`campos obrigatórios impedem o cadastro quando ${scenario.description}`, async ({
    page,
  }) => {
    const postRequests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === "/api/students" &&
        request.method() === "POST"
      ) {
        postRequests.push(request.url());
      }
    });

    await page.getByLabel("RA", { exact: true }).fill(scenario.ra);
    await page.getByLabel("Nome", { exact: true }).fill(scenario.name);
    await page.getByRole("button", { name: "Cadastrar aluno" }).click();

    await expect(
      page.getByLabel(scenario.invalidFieldLabel, { exact: true }),
    ).toHaveJSProperty("validity.valueMissing", true);
    await expect(
      page.getByLabel(scenario.invalidFieldLabel, { exact: true }),
    ).toHaveJSProperty("validity.valid", false);
    expect(postRequests).toHaveLength(0);
    await expect(page.getByTestId("form-message")).toHaveText("");
    await expect(page.getByTestId("student-row")).toHaveCount(
      INITIAL_STUDENTS.length,
    );
  });
}

for (const invalidRa of ["-1", "0", "1.5", "2147483648"]) {
  test(`RA inválido rejeita o valor ${invalidRa}`, async ({ page }) => {
    const postRequests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === "/api/students" &&
        request.method() === "POST"
      ) {
        postRequests.push(request.url());
      }
    });

    const raInput = page.getByLabel("RA", { exact: true });
    await raInput.fill(invalidRa);
    await page.getByLabel("Nome", { exact: true }).fill("Aluno Teste");
    await page.getByRole("button", { name: "Cadastrar aluno" }).click();

    await expect(raInput).toHaveJSProperty("validity.valid", false);
    expect(postRequests).toHaveLength(0);
    await expect(page.getByTestId("form-message")).toHaveText("");
    await expect(page.getByTestId("student-row")).toHaveCount(
      INITIAL_STUDENTS.length,
    );
  });
}

for (const invalidName of ["Ab", "  ab  ", "   "]) {
  test(`nome inválido rejeita "${invalidName}" (menos de 3 caracteres úteis)`, async ({
    page,
  }) => {
    const postRequests: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === "/api/students" &&
        request.method() === "POST"
      ) {
        postRequests.push(request.url());
      }
    });

    const nameInput = page.getByLabel("Nome", { exact: true });
    await page.getByLabel("RA", { exact: true }).fill("258105");
    await nameInput.fill(invalidName);
    await page.getByRole("button", { name: "Cadastrar aluno" }).click();

    await expect(nameInput).toHaveJSProperty("validity.valid", false);
    expect(postRequests).toHaveLength(0);
    await expect(page.getByTestId("form-message")).toHaveText("");
    await expect(page.getByTestId("student-row")).toHaveCount(
      INITIAL_STUDENTS.length,
    );
  });
}

test("RA duplicado rejeita o cadastro, exibe mensagem de erro e mantém os campos preenchidos", async ({
  page,
}) => {
  const raInput = page.getByLabel("RA", { exact: true });
  const nameInput = page.getByLabel("Nome", { exact: true });

  await raInput.fill("258001");
  await nameInput.fill("Tentativa Duplicada");

  const duplicateResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Cadastrar aluno" }).click();

  const duplicateResponse = await duplicateResponsePromise;
  expect(duplicateResponse.status()).toBe(409);

  const formMessage = page.getByTestId("form-message");
  await expect(formMessage).toHaveAttribute("data-state", "error");
  await expect(formMessage).toHaveText(
    "Não foi possível cadastrar o aluno. Já existe um estudante com este RA.",
  );

  await expect(raInput).toHaveValue("258001");
  await expect(nameInput).toHaveValue("Tentativa Duplicada");

  const rows = page.getByTestId("student-row");
  await expect(rows).toHaveCount(INITIAL_STUDENTS.length);
  await expect(rows.filter({ hasText: "Tentativa Duplicada" })).toHaveCount(0);
});

test('lista vazia exibe a mensagem "Nenhum aluno cadastrado." quando não existem alunos', async ({
  page,
}) => {
  clearStudentsDatabase();

  const emptyListResponsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/students" &&
      response.request().method() === "GET",
  );

  await page.reload();

  const emptyListResponse = await emptyListResponsePromise;
  expect(emptyListResponse.status()).toBe(200);
  expect(await emptyListResponse.json()).toEqual([]);

  await expect(page.locator("#students")).toHaveAttribute("aria-busy", "false");
  const listMessage = page.getByTestId("list-message");
  await expect(listMessage).toHaveAttribute("data-state", "success");
  await expect(listMessage).toHaveText("Nenhum aluno cadastrado.");
  await expect(page.getByTestId("student-row")).toHaveCount(0);
});
