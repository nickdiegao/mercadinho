"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Printer, Save } from "lucide-react";
import { useEstado } from "@/lib/store";
import { moeda, numero, custoCurto } from "@/lib/formato";
import { Lista, type ColunaLista } from "@/components/lista";
import type { Produto } from "@/lib/tipos";
import {
  Aviso,
  Botao,
  Cabecalho,
  Cartao,
  Entrada,
  Etiqueta,
  Selecao,
  TituloCartao,
} from "@/components/ui";

export default function CargaInicial() {
  const { estado, registrarContagem } = useEstado();
  const [categoria, setCategoria] = useState("");
  const [contagem, setContagem] = useState<Record<string, string>>({});

  const produtos = useMemo(
    () =>
      estado.produtos
        .filter((p) => p.tipo === "NORMAL" && p.ativo)
        .filter((p) => (categoria ? p.categoriaId === categoria : true))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [estado.produtos, categoria],
  );

  const divergentes = produtos
    .map((p) => {
      const txt = contagem[p.id];
      if (txt == null || txt === "") return null;
      const contado = parseFloat(txt.replace(",", "."));
      if (Number.isNaN(contado)) return null;
      const diferenca = contado - p.saldoAtual;
      return { produto: p, contado, diferenca };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.diferenca !== 0);

  const impactoCusto = divergentes.reduce(
    (a, d) => a + Math.round((d.diferenca * d.produto.custoMedio) / 100),
    0,
  );

  async function confirmar() {
    // a contagem inteira numa gravacao so: ou entra tudo, ou nada
    try {
      await registrarContagem(
        divergentes.map((d) => ({
          produtoId: d.produto.id,
          novaQtd: d.contado,
          tipo: "INVENTARIO_INICIAL" as const,
          motivo: "Contagem do inventário de abertura",
        })),
      );
      setContagem({});
    } catch {
      /* o motivo ja apareceu no aviso; a contagem digitada continua */
    }
  }

  const diferencaDe = (p: Produto) => {
    const txt = contagem[p.id] ?? "";
    if (txt === "") return null;
    const contado = parseFloat(txt.replace(",", "."));
    return Number.isNaN(contado) ? null : contado - p.saldoAtual;
  };

  const colunas: ColunaLista<Produto>[] = [
    {
      chave: "produto",
      titulo: "Produto",
      papel: "titulo",
      render: (p) => (
        <span className="block max-w-[300px] truncate">{p.nome}</span>
      ),
    },
    {
      chave: "sku",
      titulo: "Embalagem",
      papel: "apoio",
      render: (p) => (
        <>
          <span className="mono">{p.sku}</span> · {p.unidadeCompra} c/{" "}
          {p.fatorConversao}
        </>
      ),
    },
    {
      chave: "sistema",
      titulo: "Saldo no sistema",
      alinha: "right",
      render: (p) => <>{numero(p.saldoAtual)} un</>,
    },
    {
      chave: "contado",
      titulo: "Contado",
      alinha: "right",
      render: (p) => (
        <input
          value={contagem[p.id] ?? ""}
          onChange={(e) =>
            setContagem((c) => ({ ...c, [p.id]: e.target.value }))
          }
          inputMode="decimal"
          placeholder="—"
          aria-label={`Quantidade contada de ${p.nome}`}
          className="tabular w-full max-w-[110px] rounded border border-borda px-2 py-1.5 text-right text-sm focus:border-marca focus:outline-none print:border-0 print:border-b print:border-tinta2"
        />
      ),
    },
    {
      chave: "diferenca",
      titulo: "Diferença",
      alinha: "right",
      papel: "destaque",
      render: (p) => {
        const dif = diferencaDe(p);
        return (
          <span
            className={
              dif == null || dif === 0
                ? "text-suave"
                : dif > 0
                  ? "font-semibold text-positivo"
                  : "font-semibold text-alerta"
            }
          >
            {dif == null ? "—" : `${dif > 0 ? "+" : ""}${numero(dif)}`}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <Cabecalho
        titulo="Carga inicial"
        descricao="A tela que só é usada uma vez, e sem a qual o sistema não serve para nada."
        acoes={
          <Botao onClick={() => window.print()}>
            <Printer size={15} /> Imprimir lista de contagem
          </Botao>
        }
      />

      <div className="nao-imprime mb-5 grid gap-3 lg:grid-cols-3">
        <Cartao>
          <Etiqueta tom="marca">Passo 1</Etiqueta>
          <h3 className="mt-2 text-[15px] font-bold text-tinta">
            Lançar as notas de compra
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tinta2">
            Junte as notas dos últimos 60 dias e lance cada uma como entrada
            normal. O produto nasce cadastrado e o custo médio nasce{" "}
            <b>verdadeiro</b>, vindo do que foi realmente pago.
          </p>
        </Cartao>
        <Cartao className="border-marca/40">
          <Etiqueta tom="marca">Passo 2 — esta tela</Etiqueta>
          <h3 className="mt-2 text-[15px] font-bold text-tinta">
            Contar o depósito
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tinta2">
            Imprima a lista, conte prateleira por prateleira e digite o que
            achou. O sistema mostra a diferença antes de gravar qualquer coisa.
          </p>
        </Cartao>
        <Cartao>
          <Etiqueta>Passo 3</Etiqueta>
          <h3 className="mt-2 text-[15px] font-bold text-tinta">Definir preços</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-tinta2">
            Com o custo certo na mão, ajuste a unidade e a caixa vendo a margem
            calcular na tela. Preço consciente em vez de &ldquo;no olho&rdquo;.
          </p>
        </Cartao>
      </div>

      <div className="nao-imprime mb-4">
        <Aviso titulo="A ordem dos passos 1 e 2 não é arbitrária">
          O caminho intuitivo seria contar tudo primeiro e digitar os saldos — mas
          aí o custo de cada produto vira chute, e chute no custo contamina todo
          relatório de lucro para sempre. Começando pelas notas, a contagem só
          precisa acertar a quantidade, que é a parte fácil de corrigir.
        </Aviso>
      </div>

      <div className="nao-imprime mb-4 flex flex-wrap items-center gap-2">
        <Selecao
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="w-[240px]"
        >
          <option value="">Todas as categorias</option>
          {estado.categorias
            .filter((c) => c.id !== "c_vasilhame")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </Selecao>
        <span className="text-[13px] text-suave">
          {produtos.length} produtos na lista
        </span>
      </div>

      <div className="so-imprime mb-5">
        <p className="text-lg font-bold">{estado.empresa.nomeFantasia}</p>
        <p className="text-[13px] font-bold">Lista de contagem — inventário de abertura</p>
        <p className="text-[12px]">
          Data ____ / ____ / ________ · Responsável ______________________________
        </p>
      </div>

      <Lista
        colunas={colunas}
        linhas={produtos}
        chave={(p) => p.id}
        vazio="Nenhum produto nesta categoria."
      />

      {divergentes.length > 0 && (
        <Cartao className="nao-imprime mt-4 border-marca/40">
          <TituloCartao>Confira antes de gravar</TituloCartao>
          <p className="mb-3 text-[13px] text-tinta2">
            {divergentes.length} produto{divergentes.length === 1 ? "" : "s"} com
            diferença entre o sistema e a contagem. Impacto no valor do estoque:{" "}
            <b className={impactoCusto >= 0 ? "text-positivo" : "text-alerta"}>
              {impactoCusto > 0 ? "+" : ""}
              {moeda(impactoCusto)}
            </b>
            .
          </p>
          <ul className="mb-4 max-h-52 space-y-1.5 overflow-y-auto">
            {divergentes.map((d) => (
              <li
                key={d.produto.id}
                className="flex items-baseline justify-between gap-3 text-[13px]"
              >
                <span className="truncate text-tinta2">{d.produto.nome}</span>
                <span className="tabular shrink-0">
                  <span className="text-suave">
                    {numero(d.produto.saldoAtual)} → {numero(d.contado)}
                  </span>
                  <span
                    className={`ml-3 font-semibold ${d.diferenca > 0 ? "text-positivo" : "text-alerta"}`}
                  >
                    {d.diferenca > 0 ? "+" : ""}
                    {numero(d.diferenca)}
                  </span>
                  <span className="ml-3 text-suave">
                    {custoCurto(d.produto.custoMedio)}/un
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Botao variante="primario" onClick={confirmar}>
              <Save size={15} /> Gravar inventário de abertura
            </Botao>
            <Botao onClick={() => setContagem({})}>Limpar contagem</Botao>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-suave">
            Cada diferença vira um movimento do tipo{" "}
            <code className="mono text-[12px]">INVENTARIO_INICIAL</code>, com
            motivo e responsável. O custo médio não muda — só a quantidade.
          </p>
        </Cartao>
      )}

      {divergentes.length === 0 && (
        <div className="nao-imprime mt-4">
          <Cartao>
            <p className="flex items-center gap-2 text-[13px] text-suave">
              <ClipboardList size={15} />
              Digite as quantidades contadas na coluna <b>Contado</b> para o
              sistema calcular as diferenças.
            </p>
          </Cartao>
        </div>
      )}
    </>
  );
}
