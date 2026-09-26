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
3. **Gelado** — adicione uma lata avulsa e toque em **gelado**: o preço passa
   para o gelado. Suba a quantidade até o atacado e o botão trava em
   "atacado sai natural".
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
| Quantidade | número em unidade base, até 3 casas | `12 latas` → `12` |

### Preço gelado

Terceiro preço fixo do produto, ao lado do varejo e do atacado — cobre a energia
de manter a bebida na geladeira. Vale **só no varejo**: quando a venda cai no
atacado, pelo cliente ou pela quantidade, o item sai natural. Quanto o gelado
rendeu a mais fica congelado no item (`venda_item.adicionalGelado`), e é isso
que o relatório compara com a conta de luz.

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
  page.tsx              login por perfil
  (sistema)/            as 12 telas, atrás do login
lib/
  tipos.ts              o modelo de dados das 15 tabelas
  regras.ts             as cinco regras de negócio
  seed.ts               catálogo fictício + 60 dias de histórico
  store.tsx             estado + localStorage (vira Postgres na fase 2)
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

## O que este mockup não é

- Não tem banco de dados, login real nem servidor
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
