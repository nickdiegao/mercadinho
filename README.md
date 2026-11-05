# Distribuidora — mockup de demonstração

Sistema de controle de estoque, vendas, caixa e lucro para uma distribuidora de
bebidas que vende no atacado e no varejo ao mesmo tempo.

O sistema roda de dois jeitos, com o mesmo código:

| Modo | Quando | Dados | Entrada |
|---|---|---|---|
| **Demonstração** | sem `BANCO_ARQUIVO` — é assim na Vercel | fictícios, no `localStorage` do navegador | escolhendo o perfil |
| **Banco local** | com `BANCO_ARQUIVO` no `.env.local` | SQLite, num arquivo do próprio computador | e-mail e senha |

Na demonstração, nada sai da máquina de quem está vendo.

O documento de arquitetura que originou este mockup está em
[`docs/`](docs), junto com o roteiro de perguntas para a reunião com o cliente.

---

## Rodar

```bash
npm install
```

```bash
npm run dev
```

Abre em <http://localhost:3000>. Sem `.env.local`, é a demonstração.

## Rodar com o banco local

```bash
cp .env.example .env.local
```

No `.env.local`, troque o `NEXTAUTH_SECRET` por um gerado (o comando está no
próprio arquivo) e aponte o `BANCO_ARQUIVO` para uma pasta **fora do OneDrive**.
Depois:

```bash
npm run banco:preparar
```

```bash
npm run dev
```

O `banco:preparar` cria o arquivo, as tabelas e carrega os dados da
demonstração. Os três usuários (`maria@`, `marcos@` e `jorge@distribuidora.com.br`)
entram com a `SENHA_INICIAL` do `.env.local`.

| Comando | O que faz |
|---|---|
| `npm run banco:migrar` | cria ou atualiza as tabelas |
| `npm run banco:semear` | **apaga tudo** e carrega a demonstração |
| `npm run banco:zerar` | **apaga tudo** e deixa só empresa, usuários, categorias e os produtos do catálogo com saldo 0 — pronto para os dados reais |
| `npm run banco:gerar` | depois de mudar `lib/servidor/schema.ts`, gera a migration |

Com um arquivo novo, sem usuários, o sistema abre na **primeira abertura**: cria
a empresa e a administração, carrega os produtos do catálogo com saldo 0 e mostra o código de recuperação, uma vez só. As
tabelas se atualizam sozinhas quando o servidor sobe (`instrumentation.ts`).

O arquivo do banco fica **fora da pasta do projeto** de propósito: o OneDrive
sincronizando um SQLite ligado corrompe o banco. Só o servidor abre o arquivo,
então o banco não aparece na rede. O sistema, sim: pelo IP do computador, o
celular na mesma rede Wi-Fi também entra.

### Como o banco funciona

```
tela ── ação ──> app/acoes.ts ── sessão ── permissão ── transação
                                                              │
                                     lib/operacoes.ts <───────┘
                                     (a regra de negócio,
                                      a mesma da demonstração)
                                              │ efeitos
                                              v
                                     lib/servidor/estado.ts ──> SQLite
```

- **Uma regra, dois modos.** Cada operação (venda, entrada, cancelamento,
  caixa, cadastros) é uma função pura em `lib/operacoes.ts` que lê o estado e
  devolve o que gravar. A demonstração aplica no `localStorage`, o servidor
  aplica no SQLite. Preço, gelado, embalagem, custo médio e casco não têm
  duas versões para discordar.
- **O servidor não confia no navegador.** Recalcula o preço da venda, ignora
  custo e saldo vindos de formulário, e mantém o preço quando quem salvou não é
  a administradora. A permissão (`lib/permissoes.ts`) é a mesma que esconde o
  botão na tela — mas aqui ela recusa.
- **Cada perfil recebe só o que pode ver.** O caixa não recebe custo nem lucro,
  nem as entradas de mercadoria (`lib/redigir.ts`). Esconder na tela não
  bastaria: o dado chegaria no navegador.
- **Tudo ou nada.** A venda grava venda, itens, baixa de estoque, casco, caixa
  e recibo numa transação. O driver do SQLite é síncrono, então as gravações
  saem uma de cada vez: duas vendas simultâneas nunca pegam o mesmo número
  nem perdem baixa de estoque. O duplo clique no "Finalizar" devolve a mesma
  venda (chave de idempotência).
- **O banco é a última defesa.** Constraints recusam preço negativo,
  quantidade zero e dois caixas abertos, e as tabelas `STRICT` recusam texto em
  coluna de número; gatilhos fazem o razão do estoque e a auditoria só aceitarem
  inserção.
- **Login** com e-mail e senha (next-auth, hash bcrypt de custo 12, cookie
  `httpOnly`). Cinco senhas erradas travam a conta por 15 minutos. Toda
  entrada e toda falha vão para a auditoria.
- **Contas** (`lib/servidor/contas.ts`). Nenhuma senha vem pronta: a primeira
  abertura cria a administração e só funciona enquanto não existe usuário. Como
  um sistema local não tem "esqueci a senha" por e-mail, a administração recebe
  um código de recuperação, guardado só em hash; ao usar, ele morre e sai outro.
  Quem não é da administração pede uma senha nova para ela. O sistema nunca fica
  sem uma administração ativa, e ninguém desativa o próprio acesso.

## Instalador para a cliente

```bash
npm run instalador
```

Gera `Distribuidora-Setup-<versão>.exe` em
`%LOCALAPPDATA%\Mercadinho\empacotar\saida`. As ferramentas (Electron e cia) são
instaladas nessa mesma pasta, fora do OneDrive, e o script para se encontrar
algum valor do `.env.local` dentro do pacote.

| O quê | Onde fica no computador dela |
|---|---|
| Programa | `%LOCALAPPDATA%\Programs\Distribuidora` |
| Banco, segredo da sessão e log | `%LOCALAPPDATA%\Mercadinho\dados` — desinstalar ou atualizar não toca aqui |
| Backups | `Documentos\Mercadinho Backups` |

- **Como roda:** `electron/main.cjs` sobe o mesmo servidor Next num processo
  separado, só em `127.0.0.1`, e abre a janela nele.
- **Recibo:** sai direto na impressora escolhida em Configurações ou, sem
  escolha, na que tiver `i9` ou `Elgin` no nome. Sem nenhuma, abre a janela de
  impressão.
- **Backup:** um por dia, os últimos 30, cada um conferido antes de valer
  (`lib/servidor/backup.ts`). Versão nova que muda as tabelas faz uma cópia antes
  de mexer. Configurações tem "Fazer backup agora" e "Restaurar um backup", que
  guarda os dados de antes em `dados\antes-de-restaurar-*.db`.
- **Atualização:** ao abrir, o programa procura versão nova nos Releases do
  GitHub, baixa e instala ao fechar. Com o repositório privado ele não enxerga o
  Release e segue na versão atual, sem avisar nada.

### Publicar uma versão

Suba `version` no `package.json`, rode `npm run instalador` e, na pasta `saida`:

```bash
gh release create v0.1.0 Distribuidora-Setup-0.1.0.exe Distribuidora-Setup-0.1.0.exe.blockmap latest.yml --repo nickdiegao/mercadinho --title "v0.1.0"
```

O `latest.yml` é o que o programa consulta: sem ele, não há atualização.

O instalador não é assinado (o certificado é pago), então o Windows mostra o
aviso do SmartScreen. Para instalar: **Mais informações → Executar assim mesmo**.

## Publicar na Vercel

O projeto é um Next.js padrão. Sem variável de ambiente, a Vercel publica a
demonstração — não precisa configurar nada.

```bash
npx vercel
```

---

## Como demonstrar

Entre como **Maria Conceição (admin)** para ver tudo. O roteiro que mostra o
sistema em cinco minutos:

1. **Painel** — vendas do dia, lucro, valor do estoque e cascos na rua.
2. **Nova venda** — busque `600ml` e toque em **+ 1 eng** na cerveja em
   garrafa. Sai um engradado de 24, o preço vira **atacado sozinho** e aparece o
   aviso de que saem 24 cascos junto. Cada item troca entre **Unidade** e a
   embalagem dele (caixa, fardo, engradado) a qualquer momento.
3. **Gelado** — adicione uma lata avulsa e toque em **gelado**: o preço passa
   para o gelado. Troque para **Caixa c/ 12**: ela vira atacado e continua
   gelada, pelo atacado mais o acréscimo do gelado.
4. **Finalizar** — cai no recibo, com CNPJ, descrição, valores e o total por
   extenso. Dali sai para imprimir, salvar em PDF ou mandar no **WhatsApp**.
5. **Cancelar venda** (admin, no recibo) — as unidades voltam ao estoque, o
   dinheiro sai do caixa como estorno e fica tudo no histórico, com o motivo.
6. **Estoque → um produto** — o extrato mostra cada movimento com o saldo
   depois. Saída por venda leva à venda com data e hora; entrada leva à carga,
   mostrando os produtos comprados.
7. **Entradas → Nova entrada** — lance uma compra e veja o **custo médio antes e
   depois** na coluna da direita. Produto ou fornecedor que ainda não existe se
   cadastra ali mesmo, sem sair da tela.
8. **Clientes → Novo cliente** — digite um CNPJ e clique em **Buscar**: razão
   social e endereço vêm da Receita.
9. **Relatórios** — atacado × varejo, curva ABC, o cartão "a geladeira se
   paga?" e os três botões de exportação.
10. **Trocar de perfil → Marcos (caixa)** — repare que custo, margem, lucro e o
    menu de relatórios **somem**.

O botão **Recarregar demo**, no rodapé da lateral, devolve os dados fictícios ao
estado original a qualquer momento.

---

## As cinco regras que sustentam o sistema

Estão implementadas em [`lib/regras.ts`](lib/regras.ts) e comentadas no código.

| # | Regra | Onde vive |
|---|---|---|
| 1 | Tudo converte para a **unidade base** — compra-se em caixa, vende-se em unidade | `paraBase`, `custoUnitBase` |
| 2 | **Custo médio ponderado**, recalculado só na entrada de mercadoria | `novoCustoMedio` |
| 3 | O custo é **congelado** dentro do item da venda, para o lucro histórico nunca mudar | `venda_item.custoUnit` |
| 4 | **Caixa e lucro são regimes diferentes** — fiado é lucro hoje, caixa só quando pagam | `entraNoCaixa` |
| 5 | O **vasilhame** é um produto espelhado que sai junto com a garrafa | `produto.vasilhameId` |

### Convenção de unidades

Dinheiro nunca em `float` — `0.1 + 0.2` não dá `0.3`, e depois de mil vendas o
caixa não fecha por centavos.

| O quê | Como é guardado | Exemplo |
|---|---|---|
| Dinheiro | inteiro em **centavos** | `R$ 3,20` → `320` |
| Custo médio | inteiro em **1/10000 de real** (4 casas) | `R$ 3,3125` → `33125` |
| Quantidade | número em unidade base, até 3 casas (milésimos no banco) | `12 latas` → `12` |

### Unidade ou embalagem

O estoque mora sempre em unidade (regra 1). Na venda e na entrada, cada
produto se escolhe por **unidade** ou pela **embalagem dele** — caixa, fardo,
engradado —, com o estoque mostrado do jeito que se conta no depósito
(`74 cx + 7 un`). A embalagem só fica disponível na venda quando o saldo fecha
pelo menos uma. O item guarda como foi vendido (`venda_item.embalagem`), para o
recibo sair com `2 CX c/ 12` e o valor da caixa, em vez de `24 UN`. Na entrada,
a mercadoria avulsa (6 garrafas) entra com quantidade e custo por unidade.
As regras ficam em [`lib/embalagem.ts`](lib/embalagem.ts).

### Preço gelado

Terceiro preço fixo do produto, ao lado do varejo e do atacado — cobre a energia
de manter a bebida na geladeira. Na lata avulsa vale o preço gelado do cadastro.
Na **caixa ou fardo gelado** (venda no atacado), vale o atacado mais o mesmo
acréscimo por unidade (gelado − varejo): a geladeira gasta o mesmo por lata.
Com varejo 4,50, atacado 3,80 e gelado 5,20, a caixa gelada sai a 4,50 por
unidade. Quanto o gelado rendeu a mais fica congelado no item
(`venda_item.adicionalGelado`, sobre o natural do mesmo canal), e é isso que o
relatório compara com a conta de luz.

Por ser um preço fixo, ele não acompanha o varejo sozinho: se o varejo subir e
o gelado não, o cadastro avisa e a lista de produtos marca o item.

### Quem cadastra o quê

| Cadastro | Quem pode | Observação |
|---|---|---|
| Produto | admin e estoque | Só a admin define preço; sem preço, o caixa não consegue vender |
| Fornecedor | admin e estoque | CNPJ obrigatório, com consulta à Receita |
| Cliente | admin e caixa | Tabela de preço e limite de fiado, só a admin |

Produto pode ser cadastrado antes de chegar: o formulário pergunta se já tem no
depósito. Com **Ainda não**, ele nasce com saldo zero e a etiqueta **aguarda 1ª
entrada** — não é pendência, o custo vem na primeira carga. **Sem custo** só
acusa quando há saldo sem custo, e **repor** só quando existe um mínimo definido.

Nada é apagado: cadastro sai de uso com **Desativar** e volta com **Reativar**,
para o histórico nunca perder a referência. CPF e CNPJ são conferidos pelo
dígito verificador. A consulta à Receita (BrasilAPI) envia só o CNPJ — CPF é
dado pessoal e nunca sai do navegador.

---

## Estrutura

```
app/
  page.tsx              entrada: perfil (demo) ou e-mail e senha (banco)
  (sistema)/            as 12 telas, atrás do login
  acoes.ts              as ações do servidor: única porta para o banco
  acoes-contas.ts       as ações de conta, que só existem com banco
  api/auth/             login (next-auth)
lib/
  tipos.ts              o modelo de dados das 15 tabelas
  regras.ts             as cinco regras de negócio
  operacoes.ts          cada operação como função pura que devolve o que gravar
  permissoes.ts         quem pode o quê — a tela e o servidor usam a mesma
  redigir.ts            o que cada perfil recebe do servidor
  seed.ts               catálogo fictício + 60 dias de histórico
  store.tsx             estado das telas, nos dois modos
  servidor/
    schema.ts           as 15 tabelas no SQLite (Drizzle)
    estado.ts           leitura, gravação e carga do banco
    auth.ts             login, bloqueio e sessão
    contas.ts           primeira abertura, usuários, senhas e recuperação
    backup.ts           cópia diária, conferência e limpeza
drizzle/                migrations (inclui o gatilho de só-inserção)
scripts/banco.ts        migrar, semear e zerar
scripts/empacotar.mjs   gera o instalador
electron/               o programa instalado (janela, impressora, atualização)
  consultas.ts          leituras derivadas (painel, relatórios)
  exportar.ts           PDF, Excel e CSV
  documentos.ts         CPF, CNPJ, telefone e consulta à Receita
components/
  ui.tsx                cartões, botões, campos
  lista.tsx             lista que vira tabela no desktop e cartão no celular
  modal.tsx             painel lateral onde abrem os cadastros
  form-*.tsx            cadastro de produto, cliente e fornecedor
docs/                   blueprint, roteiro de perguntas e manual de uso
  fonte-manual/         prints e gerador do manual em PDF
```

## Desempenho

Os dados moram no navegador, então a lentidão vinha de desenhar tela demais, não
de buscar dado. O que foi feito:

- A lista desenha **só o formato visível** (tabela ou cartão) e mostra 50 linhas
  por vez, com "Mostrar mais". Ao imprimir, sai tudo em tabela.
- A busca responde na hora e o filtro roda logo atrás (`useDeferredValue`).
- O gráfico do painel carrega sob demanda — é a maior biblioteca do sistema.
- Enquanto os dados carregam, aparece o esqueleto da tela, não um branco.

Medido no build de produção: a tela de vendas caiu de 11.386 para cerca de 1.300
elementos, limpar a busca de ~140 ms para ~10 ms, e o painel de 224 KB para
123 KB de JavaScript.

## Exportação

Três formatos, porque são três necessidades diferentes:

- **PDF** — para enviar e imprimir. Na fase 1 sai pelo diálogo de impressão do
  navegador sobre a folha A4 que já está na tela. Na fase 2 vira
  `@react-pdf/renderer` no servidor, para aguentar relatório grande.
- **Excel** — o arquivo formatado, para o dono mexer. Moeda em R$, painel
  congelado, filtro automático e total com `SUBTOTAL`, que acompanha o filtro.
- **CSV** — cru de propósito, para outro sistema ler. Sai com **BOM**, separador
  `;` e decimal com vírgula: é o que faz o Excel brasileiro abrir o arquivo com
  acento correto e em colunas separadas.

## O que ainda não é

- A demonstração não tem banco nem login: o banco local roda só no computador
  onde está o arquivo
- O programa instalado atende um computador só: ele não abre para a rede, e o
  backup automático só existe nele
- Saldo negativo ainda é permitido (como na demonstração); o blueprint quer
  bloquear, com liberação pela administradora
- O estado inteiro vai para a tela de uma vez: serve a uma loja com alguns
  milhares de vendas, e vai precisar de paginação quando o histórico crescer
- Não emite nota fiscal — o recibo não tem valor fiscal
- O WhatsApp leva o recibo em texto, não o PDF anexado — anexar arquivo exige a
  API oficial do WhatsApp, que é paga
- Não trata multi-loja, validade/lote nem contas a receber

Tudo isso está previsto no blueprint, nas fases 2 a 4.

## Sobre os dados

Empresa, CNPJ, clientes e fornecedores são inventados. O catálogo usa descrição
genérica (`Cerveja Pilsen Lata 350ml`), com exceção da linha de cola, que leva a
marca real a pedido do cliente — distribuidora de bebidas revende o produto,
então listar a marca é o que ela faz na vida real. Para voltar ao genérico,
basta editar `CATALOGO` em [`lib/seed.ts`](lib/seed.ts).
