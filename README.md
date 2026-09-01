# Distribuidora — mockup de demonstração

Sistema de controle de estoque, vendas, caixa e lucro para uma distribuidora de
bebidas que vende no atacado e no varejo ao mesmo tempo.

**Esta é a fase 1 do projeto: um mockup navegável.** Não tem banco de dados nem
servidor. Todos os dados são fictícios, gerados no navegador e guardados no
`localStorage` — nada sai da máquina de quem está vendo.

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

Abre em <http://localhost:3000>.

## Publicar na Vercel

O projeto é um Next.js padrão, sem variável de ambiente nenhuma. Importe o
repositório na Vercel e aceite os padrões — não precisa configurar nada.

```bash
npx vercel
```

---

## Como demonstrar

Entre como **Maria Conceição (admin)** para ver tudo. O roteiro que mostra o
sistema em cinco minutos:

1. **Painel** — vendas do dia, lucro, valor do estoque e cascos na rua.
2. **Nova venda** — busque `600ml`, adicione a cerveja em garrafa e clique em
   `1 ENG = 24 un`. O preço vira **atacado sozinho** e aparece o aviso de que
   saem 24 cascos junto.
3. **Finalizar** — cai no recibo, com CNPJ, descrição, valores e o total por
   extenso. O botão imprime ou salva em PDF.
4. **Estoque → um produto** — o extrato mostra cada movimento com o saldo
   depois. Saída por venda leva à venda com data e hora; entrada leva à carga,
   mostrando os produtos comprados.
5. **Entradas → Nova entrada** — lance uma compra e veja o **custo médio antes e
   depois** na coluna da direita.
6. **Relatórios** — atacado × varejo, curva ABC, e os três botões de exportação.
7. **Trocar de perfil → Marcos (caixa)** — repare que custo, margem, lucro e o
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
| Quantidade | número em unidade base, até 3 casas | `12 latas` → `12` |

---

## Estrutura

```
app/
  page.tsx              login por perfil
  (sistema)/            as 12 telas, atrás do login
lib/
  tipos.ts              o modelo de dados das 15 tabelas
  regras.ts             as cinco regras de negócio
  seed.ts               catálogo fictício + 60 dias de histórico
  store.tsx             estado + localStorage (vira Postgres na fase 2)
  consultas.ts          leituras derivadas (painel, relatórios)
  exportar.ts           PDF, Excel e CSV
components/ui.tsx       cartões, tabelas, botões, campos
docs/                   blueprint e roteiro de perguntas
```

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

## O que este mockup não é

- Não tem banco de dados, login real nem servidor
- Não emite nota fiscal — o recibo não tem valor fiscal
- Não trata multi-loja, validade/lote nem contas a receber

Tudo isso está previsto no blueprint, nas fases 2 a 4.

## Sobre os dados

Empresa, CNPJ, clientes e fornecedores são inventados. O catálogo usa descrição
genérica (`Cerveja Pilsen Lata 350ml`), com exceção da linha de cola, que leva a
marca real a pedido do cliente — distribuidora de bebidas revende o produto,
então listar a marca é o que ela faz na vida real. Para voltar ao genérico,
basta editar `CATALOGO` em [`lib/seed.ts`](lib/seed.ts).
