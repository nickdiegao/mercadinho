/**
 * CPF, CNPJ e telefone: mascara, validacao do digito verificador e consulta.
 *
 * A validacao existe para o recibo nunca sair com documento invalido. Ela nao
 * garante que o documento exista — so que foi digitado sem erro.
 */

export const apenasDigitos = (s: string) => (s ?? "").replace(/\D/g, "");

function todosIguais(d: string) {
  return /^(\d)\1*$/.test(d);
}

// ---------------------------------------------------------------- CPF
export function digitosCPF(base9: string): string {
  const dv = (parcial: string) => {
    let soma = 0;
    for (let i = 0; i < parcial.length; i++) {
      soma += Number(parcial[i]) * (parcial.length + 1 - i);
    }
    const r = (soma * 10) % 11;
    return String(r === 10 ? 0 : r);
  };
  const d1 = dv(base9);
  return base9 + d1 + dv(base9 + d1);
}

export function validarCPF(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || todosIguais(d)) return false;
  return digitosCPF(d.slice(0, 9)) === d;
}

// ---------------------------------------------------------------- CNPJ
export function digitosCNPJ(base12: string): string {
  const dv = (parcial: string) => {
    const pesos =
      parcial.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((a, p, i) => a + p * Number(parcial[i]), 0);
    const r = soma % 11;
    return String(r < 2 ? 0 : 11 - r);
  };
  const d1 = dv(base12);
  return base12 + d1 + dv(base12 + d1);
}

export function validarCNPJ(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14 || todosIguais(d)) return false;
  return digitosCNPJ(d.slice(0, 12)) === d;
}

export function validarDocumento(tipo: "PF" | "PJ", valor: string) {
  return tipo === "PF" ? validarCPF(valor) : validarCNPJ(valor);
}

// ---------------------------------------------------------------- mascaras
/** Formata enquanto digita: aceita parcial e nunca passa do tamanho. */
export function mascaraCPF(v: string) {
  const d = apenasDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function mascaraCNPJ(v: string) {
  const d = apenasDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function mascaraDocumento(tipo: "PF" | "PJ", v: string) {
  return tipo === "PF" ? mascaraCPF(v) : mascaraCNPJ(v);
}

export function mascaraTelefone(v: string) {
  const d = apenasDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ---------------------------------------------------------------- consulta
export interface DadosCNPJ {
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  telefone: string;
  email: string;
  situacao: string;
}

/** Siglas que a Receita devolve e que nao podem virar "Sa", "Me", "Epp". */
const SIGLAS = new Set(["SA", "S/A", "S.A.", "ME", "EPP", "MEI", "CIA", "CEP", "BR"]);
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
const ROMANO = /^(?=[IVXL])L?X{0,3}(IX|IV|V?I{0,3})$/;

/**
 * A Receita devolve tudo em maiusculas. Passa para "Titulo", mas preserva
 * siglas (SA, ME, EPP) e algarismos romanos (Torre II, nao Torre Ii).
 */
export const titulo = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((palavra, i) => {
      const cima = palavra.toUpperCase();
      const limpa = cima.replace(/[.,;]+$/, "");
      if (SIGLAS.has(limpa) || ROMANO.test(limpa)) return cima;
      const baixa = palavra.toLowerCase();
      if (i > 0 && MINUSCULAS.has(baixa)) return baixa;
      return baixa.charAt(0).toUpperCase() + baixa.slice(1);
    })
    .join(" ");

/**
 * Busca razao social e endereco na base publica da Receita, via BrasilAPI.
 * Gratuita e sem chave. So CNPJ: CPF e dado pessoal e nunca sai do sistema.
 */
export async function consultarCNPJ(cnpj: string): Promise<DadosCNPJ> {
  const d = apenasDigitos(cnpj);
  if (!validarCNPJ(d)) throw new Error("CNPJ inválido — confira os números.");

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 8000);
  let resp: Response;
  try {
    resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, {
      signal: controle.signal,
    });
  } catch {
    throw new Error("Sem conexão com a consulta. Preencha os dados à mão.");
  } finally {
    clearTimeout(limite);
  }

  if (resp.status === 404) throw new Error("CNPJ não encontrado na Receita.");
  if (!resp.ok) throw new Error("A consulta não respondeu agora. Preencha à mão.");

  const j = await resp.json();
  const numero = j.numero && j.numero !== "SN" ? `, ${j.numero}` : "";
  const bairro = j.bairro ? ` — ${titulo(j.bairro)}` : "";
  const cidade = j.municipio ? `, ${titulo(j.municipio)}/${j.uf}` : "";
  const cep = j.cep ? ` — CEP ${String(j.cep).replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : "";

  return {
    razaoSocial: titulo(j.razao_social ?? ""),
    nomeFantasia: j.nome_fantasia ? titulo(j.nome_fantasia) : "",
    endereco: `${titulo(j.logradouro ?? "")}${numero}${bairro}${cidade}${cep}`.trim(),
    telefone: j.ddd_telefone_1 ? mascaraTelefone(j.ddd_telefone_1) : "",
    email: (j.email ?? "").toLowerCase(),
    situacao: j.descricao_situacao_cadastral ?? "",
  };
}
