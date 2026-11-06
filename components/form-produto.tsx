"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BadgePercent, Snowflake } from "lucide-react";
import { useEstado, usePerfil } from "@/lib/store";
import { rotuloEmbalagem } from "@/lib/embalagem";
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
  descontoCaixa: 0,
  descontoCaixaGelado: 0,
  vendeGelado: false,
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
          ? "Aqui você ajusta dados, preços e, se precisar, corrige o custo médio."
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
  const [gelado, setGelado] = useState(paraTexto(inicial.precoGelado ?? 0));
  // so o desconto fica guardado: a caixa e calculada a partir dele
  const [descontoCaixa, setDescontoCaixa] = useState(inicial.descontoCaixa ?? 0);
  const [descontoCaixaGelado, setDescontoCaixaGelado] = useState(inicial.descontoCaixaGelado ?? 0);
  const [minimo, setMinimo] = useState(String(inicial.estoqueMinimo || ""));
  // custo medio por embalagem de compra (R$), igual ao que se digita na entrada
  const custoDaEmbalagem = (c: number) =>
    c > 0 ? paraTexto(Math.round((c * Math.max(1, inicial.fatorConversao)) / 100)) : "";
  const [custoMedioTexto, setCustoMedioTexto] = useState(custoDaEmbalagem(inicial.custoMedio));
  // pergunta explicita: sem ela, digitar so o custo (para ver a margem)
  // travava o cadastro com um erro que a pessoa nao entendia
  const [temNoDeposito, setTemNoDeposito] = useState(false);
  const [qtdInicial, setQtdInicial] = useState("");
  const [custoInicial, setCustoInicial] = useState("");
  const [tentou, setTentou] = useState(false);
  // trava o botao enquanto grava: no modo banco a resposta vem do servidor
  const [gravando, setGravando] = useState(false);

  const muda = <K extends keyof Produto>(k: K, v: Produto[K]) =>
    setP((x) => ({ ...x, [k]: v }));

  const fator = p.unidadeCompra === "UN" ? 1 : Math.max(0, parseInt(fatorTexto, 10) || 0);
  const pv = paraCentavos(varejo);
  const pg = paraCentavos(gelado);
  const comEstoque = novo && !semEstoqueInicial && temNoDeposito;
  const qtdIni = comEstoque ? parseInt(qtdInicial, 10) || 0 : 0;
  const custoIni = comEstoque ? paraCentavos(custoInicial) : 0;

  // custo para a previa de margem: o medio (edicao) ou o de abertura (novo)
  const custoMedioCorrigido =
    !novo && podeDefinirPreco && custoMedioTexto !== custoDaEmbalagem(inicial.custoMedio) && fator > 0
      ? custoUnitBase(paraCentavos(custoMedioTexto), fator)
      : undefined;
  const custoRef = novo
    ? custoIni && fator
      ? custoUnitBase(custoIni, fator)
      : 0
    : (custoMedioCorrigido ?? p.custoMedio);

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
    varejo: podeDefinirPreco && pv <= 0 ? "Informe o preço da unidade." : "",
    gelado:
      podeDefinirPreco && p.vendeGelado && pg <= 0
        ? "Informe o preço gelado ou desmarque a opção."
        : "",
    caixa:
      podeDefinirPreco && fator > 1 && pv > 0 && descontoCaixa >= pv * fator
        ? "O desconto é maior que o preço da caixa."
        : "",
    caixaGelada:
      podeDefinirPreco && p.vendeGelado && fator > 1 && pg > 0 && descontoCaixaGelado >= pg * fator
        ? "O desconto é maior que o preço da caixa gelada."
        : "",
    codigo: codigoRepetido ? `Código já usado em ${codigoRepetido.nome}.` : "",
    inicial:
      comEstoque && (qtdIni <= 0 || custoIni <= 0)
        ? `Informe quantas ${p.unidadeCompra} tem e quanto pagou em cada uma — ou marque "Ainda não".`
        : "",
  };
  const valido = Object.values(erros).every((e) => !e);

  // preco fixo por decisao do cliente: o risco e o gelado ficar para tras
  // quando o varejo sobe. O aviso nao bloqueia, so chama atencao.
  const geladoAbaixo = p.vendeGelado && pg > 0 && pv > 0 && pg <= pv;

  async function salvar() {
    setTentou(true);
    if (!valido || gravando) return;
    const final: Produto = {
      ...p,
      nome: p.nome.trim(),
      codigoBarras: p.codigoBarras.trim(),
      fatorConversao: fator,
      ...(podeDefinirPreco
        ? {
            precoVarejo: pv,
            descontoCaixa: fator > 1 ? descontoCaixa : 0,
            precoGelado: p.vendeGelado ? pg : undefined,
            descontoCaixaGelado: p.vendeGelado && fator > 1 ? descontoCaixaGelado : 0,
          }
        : {}),
      estoqueMinimo: parseInt(minimo, 10) || 0,
      ...(custoMedioCorrigido !== undefined ? { custoMedio: custoMedioCorrigido } : {}),
    };

    setGravando(true);
    try {
      const gravado = novo
        ? await cadastrarProduto(
            final,
            comEstoque ? { qtdCompra: qtdIni, custoUnitCompra: custoIni } : undefined,
          )
        : await salvarProduto(final);
      onSalvo?.(gravado);
      onFechar();
    } catch {
      // o motivo ja apareceu no aviso; o formulario continua aberto
      setGravando(false);
    }
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
        <PrecoComCaixa
          titulo="Preço natural"
          rotuloUnidade="Unidade (R$)"
          unidadeTexto={varejo}
          onUnidade={setVarejo}
          desconto={descontoCaixa}
          onDesconto={setDescontoCaixa}
          fator={fator}
          embalagem={rotuloEmbalagem(p.unidadeCompra)}
          margemTexto={margemTexto}
          editavel={podeDefinirPreco}
        />
        {tentou && erros.varejo && <Erro>{erros.varejo}</Erro>}
        {erros.caixa && <Erro>{erros.caixa}</Erro>}

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
            <div className="mt-3 flex flex-col gap-3">
              <PrecoComCaixa
                rotuloUnidade="Unidade gelada (R$)"
                unidadeTexto={gelado}
                onUnidade={setGelado}
                desconto={descontoCaixaGelado}
                onDesconto={setDescontoCaixaGelado}
                fator={fator}
                embalagem={`${rotuloEmbalagem(p.unidadeCompra)} ${p.unidadeCompra === "CX" ? "gelada" : "gelado"}`}
                margemTexto={margemTexto}
                editavel={podeDefinirPreco}
                dica="Cobre o custo de energia da geladeira."
              />
              {tentou && erros.gelado && <Erro>{erros.gelado}</Erro>}
              {erros.caixaGelada && <Erro>{erros.caixaGelada}</Erro>}
              {geladoAbaixo && (
                <p className="flex items-start gap-1.5 rounded-md bg-alerta-claro px-2.5 py-2 text-[12px] leading-snug text-alerta">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  O gelado está igual ou mais barato que o natural. Acontece
                  quando a unidade sobe e o gelado não acompanha — confira antes
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
            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-md border border-borda bg-superficie p-1">
              {([false, true] as const).map((tem) => (
                <button
                  key={String(tem)}
                  type="button"
                  aria-pressed={temNoDeposito === tem}
                  onClick={() => setTemNoDeposito(tem)}
                  className={`transicao rounded px-3 py-1.5 text-[13px] font-semibold ${
                    temNoDeposito === tem
                      ? "bg-marca text-white"
                      : "text-tinta2 hover:bg-superficie2"
                  }`}
                >
                  {tem ? "Sim, já tenho" : "Ainda não"}
                </button>
              ))}
            </div>
            {!temNoDeposito ? (
              <p className="mt-2.5 text-[12px] leading-relaxed text-tinta2">
                Tudo certo. O produto fica cadastrado com saldo zero, marcado como{" "}
                <b>aguarda 1ª entrada</b>. Quando a mercadoria chegar, lance em
                Entradas → Nova entrada: é ela que dá o saldo e o custo.
              </p>
            ) : (
              <>
                <p className="mt-2.5 text-[12px] leading-relaxed text-tinta2">
                  Informe quanto tem e quanto pagou. É o que dá o custo do produto —
                  sem ele, o lucro das vendas sai errado.
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
              </>
            )}
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
              {podeDefinirPreco ? (
                <>
                  <div className="mt-2 max-w-[220px]">
                    <Campo rotulo={`Corrigir custo por ${p.unidadeCompra} (R$)`}>
                      <Entrada
                        inputMode="decimal"
                        value={custoMedioTexto}
                        onChange={(e) => setCustoMedioTexto(e.target.value)}
                        placeholder="0,00"
                      />
                    </Campo>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-suave">
                    Use para acertar um custo errado ou ainda sem valor. Só vale daqui para
                    frente: as vendas já feitas não mudam. Quando entrar mercadoria, o
                    custo médio é recalculado a partir deste valor.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[12px] leading-relaxed text-suave">
                  O custo médio só muda quando entra mercadoria nova.
                </p>
              )}
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
        <Botao type="button" variante="primario" onClick={salvar} disabled={gravando}>
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

/**
 * O preco da unidade e, embaixo, o da embalagem fechada. A caixa e calculada
 * (unidades menos o desconto) e pode ser editada: editar a caixa e digitar o
 * desconto sao o mesmo ajuste, um calcula o outro. So o desconto fica guardado,
 * e por isso a caixa acompanha quando a unidade muda.
 */
function PrecoComCaixa({
  titulo,
  rotuloUnidade,
  unidadeTexto,
  onUnidade,
  desconto,
  onDesconto,
  fator,
  embalagem,
  margemTexto,
  editavel,
  dica,
}: {
  titulo?: string;
  rotuloUnidade: string;
  unidadeTexto: string;
  onUnidade: (t: string) => void;
  desconto: number;
  onDesconto: (centavos: number) => void;
  fator: number;
  /** "Caixa", "Fardo gelado"... */
  embalagem: string;
  margemTexto: (preco: number) => string | undefined;
  editavel: boolean;
  dica?: string;
}) {
  const unidade = paraCentavos(unidadeTexto);
  const cheia = unidade * fator;
  const caixa = Math.max(0, cheia - desconto);
  // enquanto a pessoa digita, o campo mostra o que ela digitou, nao o calculado
  const [caixaDigitada, setCaixaDigitada] = useState<string | null>(null);
  const [descontoDigitado, setDescontoDigitado] = useState<string | null>(null);
  const [verDesconto, setVerDesconto] = useState(desconto > 0);
  const passou = caixaDigitada !== null && paraCentavos(caixaDigitada) > cheia;

  return (
    <div className="flex flex-col gap-3">
      {titulo && <p className="text-[13px] font-semibold text-tinta">{titulo}</p>}
      <Campo rotulo={rotuloUnidade} dica={margemTexto(unidade) ?? dica}>
        <Entrada
          inputMode="decimal"
          value={unidadeTexto}
          onChange={(e) => onUnidade(e.target.value)}
          disabled={!editavel}
          placeholder="0,00"
        />
      </Campo>

      {fator > 1 && (
        <div className="rounded-md bg-superficie2/70 px-3 py-2.5">
          <div className="flex items-end gap-2">
            <Campo rotulo={`${embalagem} com ${fator} (R$)`} className="min-w-0 flex-1">
              <Entrada
                inputMode="decimal"
                aria-label={`Preço: ${embalagem}`}
                value={caixaDigitada ?? paraTexto(caixa)}
                onFocus={() => setCaixaDigitada(paraTexto(caixa))}
                onBlur={() => setCaixaDigitada(null)}
                onChange={(e) => {
                  setCaixaDigitada(e.target.value);
                  onDesconto(Math.max(0, cheia - paraCentavos(e.target.value)));
                }}
                disabled={!editavel || unidade <= 0}
                placeholder="0,00"
              />
            </Campo>
            {editavel && (
              <Botao
                type="button"
                onClick={() => setVerDesconto((v) => !v)}
                aria-pressed={verDesconto}
                className="shrink-0"
              >
                <BadgePercent size={15} /> Desconto
              </Botao>
            )}
          </div>
          {verDesconto && (
            <div className="mt-2 max-w-[220px]">
              <Campo rotulo="Desconto (R$)">
                <Entrada
                  inputMode="decimal"
                  aria-label={`Desconto: ${embalagem}`}
                  value={descontoDigitado ?? paraTexto(desconto)}
                  onFocus={() => setDescontoDigitado(paraTexto(desconto))}
                  onBlur={() => setDescontoDigitado(null)}
                  onChange={(e) => {
                    setDescontoDigitado(e.target.value);
                    onDesconto(paraCentavos(e.target.value));
                  }}
                  disabled={!editavel || unidade <= 0}
                  placeholder="0,00"
                />
              </Campo>
            </div>
          )}
          {unidade > 0 && (
            <p className={`mt-2 text-[12px] leading-snug ${passou ? "text-alerta" : "text-tinta2"}`}>
              {passou
                ? `${embalagem} não pode passar das ${fator} unidades soltas (${moeda(cheia)}).`
                : desconto > 0 && caixa > 0
                  ? `${fator} × ${moeda(unidade)} = ${moeda(cheia)}, menos ${moeda(desconto)} de desconto. ` +
                    `Sai a ${moeda(caixa / fator)} a unidade${margemTexto(caixa / fator) ? `, ${margemTexto(caixa / fator)}` : ""}.`
                  : `${fator} × ${moeda(unidade)}, sem desconto. Se a unidade mudar, este preço acompanha.`}
            </p>
          )}
        </div>
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
