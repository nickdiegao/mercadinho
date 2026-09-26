"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Snowflake } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { custoUnitBase, margem } from "@/lib/regras";
import { custoCurto, moeda, numero } from "@/lib/formato";
import type { Produto, UnidadeCompra } from "@/lib/tipos";
import { Botao, Campo, Entrada, Selecao } from "./ui";
import { Modal } from "./modal";

const paraTexto = (c: number) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
const paraCentavos = (t: string) =>
  Math.round((parseFloat(t.replace(/\./g, "").replace(",", ".")) || 0) * 100);

const EMBALAGENS: { valor: UnidadeCompra; rotulo: string }[] = [
  { valor: "CX", rotulo: "Caixa" },
  { valor: "FD", rotulo: "Fardo" },
  { valor: "ENG", rotulo: "Engradado" },
  { valor: "BARRIL", rotulo: "Barril" },
  { valor: "UN", rotulo: "Unidade avulsa" },
];

const vazio = (): Produto => ({
  id: "",
  sku: "",
  codigoBarras: "",
  nome: "",
  categoriaId: "c_cerveja",
  tipo: "NORMAL",
  unidadeBase: "UN",
  unidadeCompra: "CX",
  fatorConversao: 12,
  custoMedio: 0,
  custoUltimaCompra: 0,
  precoVarejo: 0,
  precoAtacado: 0,
  vendeGelado: false,
  qtdMinimaAtacado: 12,
  estoqueMinimo: 0,
  saldoAtual: 0,
  ncm: "",
  ativo: true,
});

export function FormProduto({
  aberto,
  produto,
  nomeInicial,
  semEstoqueInicial = false,
  onFechar,
  onSalvo,
}: {
  aberto: boolean;
  /** Ausente = cadastro novo. */
  produto?: Produto | null;
  /** Nome ja digitado na busca que nao achou nada. */
  nomeInicial?: string;
  /**
   * Aberto de dentro da entrada de mercadoria: a propria entrada ja traz a
   * quantidade e o custo, entao perguntar de novo faria a carga entrar duas vezes.
   */
  semEstoqueInicial?: boolean;
  onFechar: () => void;
  onSalvo?: (p: Produto) => void;
}) {
  return (
    <Modal
      aberto={aberto}
      titulo={produto ? "Editar produto" : "Novo produto"}
      descricao={
        produto
          ? "O custo médio não se edita aqui: ele só muda quando entra mercadoria."
          : "Cadastre a embalagem em que você compra e os preços de venda."
      }
      onFechar={onFechar}
    >
      {aberto && (
        <Corpo
          key={produto?.id ?? "novo"}
          inicial={produto ?? { ...vazio(), nome: nomeInicial ?? "" }}
          novo={!produto}
          semEstoqueInicial={semEstoqueInicial}
          onFechar={onFechar}
          onSalvo={onSalvo}
        />
      )}
    </Modal>
  );
}

function Corpo({
  inicial,
  novo,
  semEstoqueInicial,
  onFechar,
  onSalvo,
}: {
  inicial: Produto;
  novo: boolean;
  semEstoqueInicial: boolean;
  onFechar: () => void;
  onSalvo?: (p: Produto) => void;
}) {
  const { estado, salvarProduto, cadastrarProduto } = useEstado();
  const { podeDefinirPreco, podeVerCusto } = usePerfil();

  const [p, setP] = useState<Produto>(inicial);
  const [fatorTexto, setFatorTexto] = useState(String(inicial.fatorConversao));
  const [varejo, setVarejo] = useState(paraTexto(inicial.precoVarejo));
  const [atacado, setAtacado] = useState(paraTexto(inicial.precoAtacado));
  const [gelado, setGelado] = useState(paraTexto(inicial.precoGelado ?? 0));
  const [minAtacado, setMinAtacado] = useState(String(inicial.qtdMinimaAtacado));
  const [minimo, setMinimo] = useState(String(inicial.estoqueMinimo || ""));
  const [qtdInicial, setQtdInicial] = useState("");
  const [custoInicial, setCustoInicial] = useState("");
  const [tentou, setTentou] = useState(false);

  const muda = <K extends keyof Produto>(k: K, v: Produto[K]) =>
    setP((x) => ({ ...x, [k]: v }));

  const fator = p.unidadeCompra === "UN" ? 1 : Math.max(0, parseInt(fatorTexto, 10) || 0);
  const pv = paraCentavos(varejo);
  const pa = paraCentavos(atacado);
  const pg = paraCentavos(gelado);
  const qtdIni = parseInt(qtdInicial, 10) || 0;
  const custoIni = paraCentavos(custoInicial);

  // custo para a previa de margem: o medio (edicao) ou o de abertura (novo)
  const custoRef = novo
    ? custoIni && fator
      ? custoUnitBase(custoIni, fator)
      : 0
    : p.custoMedio;

  const cascos = useMemo(
    () => estado.produtos.filter((x) => x.tipo === "VASILHAME"),
    [estado.produtos],
  );
  const categorias = estado.categorias.filter((c) => c.id !== "c_vasilhame");
  const codigoRepetido = p.codigoBarras
    ? estado.produtos.find((x) => x.id !== p.id && x.codigoBarras === p.codigoBarras)
    : undefined;

  const erros = {
    nome: !p.nome.trim() ? "Informe o nome do produto." : "",
    fator: fator < 1 ? "Quantas unidades vêm em cada embalagem?" : "",
    varejo: podeDefinirPreco && pv <= 0 ? "Informe o preço de varejo." : "",
    gelado:
      podeDefinirPreco && p.vendeGelado && pg <= 0
        ? "Informe o preço gelado ou desmarque a opção."
        : "",
    codigo: codigoRepetido ? `Código já usado em ${codigoRepetido.nome}.` : "",
    inicial:
      novo && (qtdIni > 0) !== (custoIni > 0)
        ? "Preencha a quantidade e o custo, ou deixe os dois em branco."
        : "",
  };
  const valido = Object.values(erros).every((e) => !e);

  // preco fixo por decisao do cliente: o risco e o gelado ficar para tras
  // quando o varejo sobe. O aviso nao bloqueia, so chama atencao.
  const geladoAbaixo = p.vendeGelado && pg > 0 && pv > 0 && pg <= pv;

  function salvar() {
    setTentou(true);
    if (!valido) return;
    const final: Produto = {
      ...p,
      nome: p.nome.trim(),
      codigoBarras: p.codigoBarras.trim(),
      fatorConversao: fator,
      ...(podeDefinirPreco
        ? {
            precoVarejo: pv,
            // atacado em branco = mesmo preco do varejo
            precoAtacado: pa > 0 ? pa : pv,
            precoGelado: p.vendeGelado ? pg : undefined,
            qtdMinimaAtacado: parseInt(minAtacado, 10) || fator,
          }
        : {}),
      estoqueMinimo: parseInt(minimo, 10) || 0,
    };

    const gravado = novo
      ? cadastrarProduto(
          final,
          qtdIni > 0 && custoIni > 0
            ? { qtdCompra: qtdIni, custoUnitCompra: custoIni }
            : undefined,
        )
      : (salvarProduto(final), final);
    onSalvo?.(gravado);
    onFechar();
  }

  const margemTexto = (preco: number) =>
    podeVerCusto && custoRef > 0 && preco > 0
      ? `margem ${(margem(preco, custoRef) * 100).toFixed(1)}%`
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Secao titulo="Identificação">
        <Campo rotulo="Nome">
          <Entrada
            value={p.nome}
            onChange={(e) => muda("nome", e.target.value)}
            placeholder="Ex.: Cerveja Pilsen Lata 350ml"
          />
        </Campo>
        {tentou && erros.nome && <Erro>{erros.nome}</Erro>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Categoria">
            <Selecao
              value={p.categoriaId}
              onChange={(e) => muda("categoriaId", e.target.value)}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo
            rotulo="Código de barras"
            dica="Com ele, o leitor USB adiciona o item na venda."
          >
            <Entrada
              inputMode="numeric"
              value={p.codigoBarras}
              onChange={(e) => muda("codigoBarras", e.target.value.replace(/\D/g, ""))}
              placeholder="7891234567890"
            />
          </Campo>
        </div>
        {erros.codigo && <Erro>{erros.codigo}</Erro>}
      </Secao>

      <Secao titulo="Como você compra">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Embalagem de compra">
            <Selecao
              value={p.unidadeCompra}
              onChange={(e) => {
                const u = e.target.value as UnidadeCompra;
                muda("unidadeCompra", u);
                if (u === "UN") setFatorTexto("1");
              }}
            >
              {EMBALAGENS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.rotulo}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo
            rotulo="Unidades por embalagem"
            dica={
              fator > 1
                ? `1 ${p.unidadeCompra} = ${fator} un. Você compra em ${p.unidadeCompra}, vende em unidade.`
                : undefined
            }
          >
            <Entrada
              inputMode="numeric"
              value={p.unidadeCompra === "UN" ? "1" : fatorTexto}
              disabled={p.unidadeCompra === "UN"}
              onChange={(e) => setFatorTexto(e.target.value.replace(/\D/g, ""))}
            />
          </Campo>
        </div>
        {tentou && erros.fator && <Erro>{erros.fator}</Erro>}

        <Campo
          rotulo="Casco retornável"
          dica="Garrafa de vidro que volta: o casco sai junto com cada venda."
        >
          <Selecao
            value={p.vasilhameId ?? ""}
            onChange={(e) => muda("vasilhameId", e.target.value || undefined)}
          >
            <option value="">Não tem casco (lata, PET, destilado)</option>
            {cascos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </Campo>
      </Secao>

      <Secao
        titulo="Preços de venda"
        nota={
          podeDefinirPreco
            ? undefined
            : "Só a administradora define preço. O produto fica marcado como sem preço até ela preencher — e não pode ser vendido antes disso."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Varejo — por unidade (R$)" dica={margemTexto(pv)}>
            <Entrada
              inputMode="decimal"
              value={varejo}
              onChange={(e) => setVarejo(e.target.value)}
              disabled={!podeDefinirPreco}
              placeholder="0,00"
            />
          </Campo>
          <Campo
            rotulo="Atacado — por unidade (R$)"
            dica={margemTexto(pa) ?? "Em branco, fica igual ao varejo."}
          >
            <Entrada
              inputMode="decimal"
              value={atacado}
              onChange={(e) => setAtacado(e.target.value)}
              disabled={!podeDefinirPreco}
              placeholder="0,00"
            />
          </Campo>
        </div>
        {tentou && erros.varejo && <Erro>{erros.varejo}</Erro>}

        <Campo
          rotulo="Atacado a partir de (unidades)"
          dica={fator > 1 ? `Uma ${p.unidadeCompra} fechada são ${fator} un.` : undefined}
        >
          <Entrada
            inputMode="numeric"
            value={minAtacado}
            onChange={(e) => setMinAtacado(e.target.value.replace(/\D/g, ""))}
            disabled={!podeDefinirPreco}
          />
        </Campo>

        <div className="rounded-md border border-borda bg-superficie px-3.5 py-3">
          <label className="flex items-center gap-2 text-[13.5px] font-semibold text-tinta">
            <input
              type="checkbox"
              checked={Boolean(p.vendeGelado)}
              disabled={!podeDefinirPreco}
              onChange={(e) => muda("vendeGelado", e.target.checked)}
              className="h-4 w-4 accent-[#1e3f8f]"
            />
            <Snowflake size={15} className="text-marca" />
            Vende gelado
          </label>
          {p.vendeGelado && (
            <div className="mt-3">
              <Campo
                rotulo="Preço gelado — por unidade (R$)"
                dica={
                  margemTexto(pg) ??
                  "Cobre o custo de energia da geladeira. Vale só no varejo — atacado sai natural."
                }
              >
                <Entrada
                  inputMode="decimal"
                  value={gelado}
                  onChange={(e) => setGelado(e.target.value)}
                  disabled={!podeDefinirPreco}
                  placeholder="0,00"
                />
              </Campo>
              {tentou && erros.gelado && <Erro>{erros.gelado}</Erro>}
              {geladoAbaixo && (
                <p className="mt-2 flex items-start gap-1.5 rounded-md bg-alerta-claro px-2.5 py-2 text-[12px] leading-snug text-alerta">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  O gelado está igual ou mais barato que o natural. Acontece
                  quando o varejo sobe e o gelado não acompanha — confira antes
                  de salvar.
                </p>
              )}
            </div>
          )}
        </div>
      </Secao>

      <Secao titulo="Estoque">
        <Campo
          rotulo="Estoque mínimo (unidades)"
          dica="Abaixo disso o produto aparece como para repor."
        >
          <Entrada
            inputMode="numeric"
            value={minimo}
            onChange={(e) => setMinimo(e.target.value.replace(/\D/g, ""))}
            placeholder="0"
          />
        </Campo>

        {novo && semEstoqueInicial ? (
          <p className="rounded-md bg-superficie2 px-3 py-2 text-[12px] leading-relaxed text-tinta2">
            A quantidade e o custo vêm desta entrada: é ela que define o custo do
            produto.
          </p>
        ) : novo ? (
          <div className="rounded-md border border-marca/30 bg-marca-clara/40 px-3.5 py-3">
            <p className="text-[13px] font-semibold text-tinta">
              Já tem esse produto no depósito?
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-tinta2">
              Informe quanto tem e quanto pagou. É o que dá o custo do produto —
              sem ele, o lucro das vendas sai errado até a primeira entrada.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo rotulo={`Quantidade em ${p.unidadeCompra}`}>
                <Entrada
                  inputMode="numeric"
                  value={qtdInicial}
                  onChange={(e) => setQtdInicial(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                />
              </Campo>
              <Campo rotulo={`Custo por ${p.unidadeCompra} (R$)`}>
                <Entrada
                  inputMode="decimal"
                  value={custoInicial}
                  onChange={(e) => setCustoInicial(e.target.value)}
                  placeholder="0,00"
                />
              </Campo>
            </div>
            {qtdIni > 0 && custoIni > 0 && fator > 0 && (
              <p className="mt-2 text-[12px] text-marca">
                Entram {numero(qtdIni * fator)} un a{" "}
                {custoCurto(custoUnitBase(custoIni, fator))} cada —{" "}
                {moeda(qtdIni * custoIni)} em estoque.
              </p>
            )}
            {tentou && erros.inicial && <Erro>{erros.inicial}</Erro>}
          </div>
        ) : (
          podeVerCusto && (
            <div className="rounded-md border border-borda bg-superficie2/60 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-suave">
                Custo médio ponderado
              </p>
              <p className="tabular mt-1 text-lg font-semibold text-tinta">
                {p.custoMedio > 0 ? custoCurto(p.custoMedio) : "sem custo ainda"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-suave">
                Não é editável aqui de propósito: o custo médio só muda quando
                entra mercadoria nova.
              </p>
            </div>
          )
        )}

        <Campo rotulo="NCM (opcional)" dica="Classificação fiscal — usada quando vier a nota fiscal.">
          <Entrada
            inputMode="numeric"
            value={p.ncm}
            onChange={(e) => muda("ncm", e.target.value)}
            placeholder="2203.00.00"
          />
        </Campo>
      </Secao>

      <div className="flex flex-wrap justify-end gap-2 border-t border-borda pt-4">
        <Botao type="button" onClick={onFechar}>
          Cancelar
        </Botao>
        <Botao type="button" variante="primario" onClick={salvar}>
          {novo ? "Cadastrar produto" : "Salvar"}
        </Botao>
      </div>
      {tentou && !valido && (
        <p className="-mt-3 text-right text-[12px] text-alerta">
          Corrija os campos marcados acima.
        </p>
      )}
    </div>
  );
}

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-suave">
        {titulo}
      </h3>
      {nota && (
        <p className="rounded-md bg-superficie2 px-3 py-2 text-[12px] leading-relaxed text-tinta2">
          {nota}
        </p>
      )}
      {children}
    </section>
  );
}

function Erro({ children }: { children: React.ReactNode }) {
  return <p className="-mt-1.5 text-[12px] font-medium text-alerta">{children}</p>;
}
