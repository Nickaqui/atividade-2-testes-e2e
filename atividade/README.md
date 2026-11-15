# Atividade: testes E2E do cadastro de alunos

Frontend em HTML, CSS e JavaScript, sem dependências, localizado em `atividade/`. Utiliza a API Express em `server/` e o banco PostgreSQL em `database/`.

## Executar os testes E2E da atividade

Requisitos:

- Node.js 24 e npm
- Docker em execução com suporte a `docker compose up --wait`
- Porta local `18081` disponível

Na **raiz do projeto**, instale as dependências e o navegador Chromium:

```powershell
npm ci
npx playwright install chromium
```

Execute a suíte E2E da atividade:

```powershell
npm run test:atividade
```

(ou simplesmente `npm test`)

O script `e2e-atividade/run.cjs`:

1. Remove contêineres remanescentes do projeto isolado `aula4-atividade-e2e`.
2. Constrói e inicia o banco exclusivo (`aula4_atividade_e2e` em `tmpfs`), a API (`server`) e o frontend (`atividade` em `http://127.0.0.1:18081`) usando `compose.atividade.e2e.yml`.
3. Aguarda os healthchecks do banco, da API e do Nginx.
4. Antes de cada teste, restaura o banco executando `TRUNCATE` com `RESTART IDENTITY CASCADE` e reaplica `database/seed.sql` (garantindo independência total entre os cenários e preservando intacto o banco da demonstração manual).
5. Executa os 15 testes da suíte (`e2e-atividade/atividade.spec.ts`) em sequência no Chromium (`playwright.atividade.config.ts`).
6. Salva os logs em `e2e-artifacts/compose-atividade.log` e encerra os contêineres.

### Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm test` / `npm run test:atividade` | Inicia o ambiente Docker isolado, executa a suíte da atividade e encerra os contêineres. |
| `npm run test:atividade -- --headed` | Executa os testes da atividade com o navegador visível. |
| `npm run test:atividade:list` | Lista os cenários da atividade sem iniciar o Docker. |
| `npm run test:atividade:typecheck` | Verifica os tipos TypeScript dos testes e da configuração da atividade. |
| `npm run test:atividade:report` | Abre o relatório HTML da última execução do Playwright. |

## Cenários cobertos (`e2e-atividade/atividade.spec.ts`)

| Cenário | Verificação |
| --- | --- |
| **Listagem inicial** | Verifica que os 3 alunos do seed (`258001`, `258002`, `258003`) aparecem na tabela ao abrir a página. |
| **Cadastro válido** | Preenche RA e Nome válidos, envia o formulário e verifica `201 Created` e a mensagem `"Aluno cadastrado com sucesso."`. |
| **Atualização da lista** | Confirma que o aluno recém-cadastrado aparece na tabela automaticamente sem recarregar a página. |
| **Limpeza do formulário** | Confirma que os campos `RA` e `Nome` ficam vazios após o cadastro bem-sucedido. |
| **Persistência** | Recarrega a página após um cadastro válido e verifica que o aluno permanece listado na tabela. |
| **Campos obrigatórios** | Verifica que o formulário impede o envio quando `RA` e/ou `Nome` estão vazios (sem disparar `POST /api/students`). |
| **RA inválido** | Verifica a rejeição de valores negativos (`-1`), zero (`0`), decimais (`1.5`) e maiores que `2147483647` (`2147483648`). |
| **Nome inválido** | Verifica a rejeição de nomes com menos de 3 caracteres úteis, desconsiderando espaços nas extremidades (`"Ab"`, `"  ab  "`, `"   "`). |
| **RA duplicado** | Verifica que o cadastro com RA existente retorna `409`, exibe a mensagem de erro na tela e mantém `RA` e `Nome` preenchidos. |
| **Lista vazia** | Limpa os registros no banco isolado de testes, recarrega a página e verifica a exibição de `"Nenhum aluno cadastrado."`. |

## Executar manualmente a interface da atividade

Na raiz do projeto:

```powershell
docker compose up --build -d atividade
```

Acesse http://localhost:8081 (conforme `ATIVIDADE_PORT_HOST` no `.env`).
