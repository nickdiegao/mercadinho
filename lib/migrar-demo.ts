/**
 * Dados salvos por versoes antigas da demonstracao (localStorage) continuam
 * valendo, para nao perder nada do que ja foi lancado nela:
 *   1 -> 2  os produtos ganham o gelado padrao sobre o preco de hoje
 *   2 -> 3  o atacado por unidade vira o desconto da caixa, com a mesma conta
 *           do banco (drizzle/0003), e o cliente perde a tabela de preco
 */

import { DOCUMENTOS_V1, geladoPadrao } from "./seed";
import type { Cliente, Estado, Produto } from "./tipos";

export function migrarDemo(salvo: Estado | null): Estado | null {
  if (!salvo || typeof salvo !== "object") return null;
  let e = salvo;
  if (e.versao === 1) e = migrarV1(e);
  if (e.versao === 2) e = migrarV2(e);
  return e.versao === 3 ? e : null;
}

function migrarV2(salvo: Estado): Estado {
  type Antigo = Produto & { precoAtacado?: number; qtdMinimaAtacado?: number };
  return {
    ...salvo,
    versao: 3,
    clientes: salvo.clientes.map((c) => {
      const { tipoPreco: _t, ...resto } = c as Cliente & { tipoPreco?: string };
      return resto;
    }),
    produtos: (salvo.produtos as Antigo[]).map(({ precoAtacado = 0, qtdMinimaAtacado: _q, ...p }) => {
      const f = p.fatorConversao;
      const converte = f > 1 && precoAtacado > 0;
      const g = p.precoGelado ?? 0;
      return {
        ...p,
        descontoCaixa: converte ? Math.max(0, (p.precoVarejo - precoAtacado) * f) : 0,
        descontoCaixaGelado:
          converte && g > 0 ? Math.max(0, (g - precoAtacado - Math.max(0, g - p.precoVarejo)) * f) : 0,
      };
    }),
  };
}

function migrarV1(salvo: Estado): Estado {
  // documentos da versao 1 tinham digito verificador errado; num sistema real
  // documento emitido nunca muda, mas aqui sao todos ficticios da demonstracao
  const doc = (d: string) => DOCUMENTOS_V1[d] ?? d;
  return {
    ...salvo,
    versao: 2,
    empresa: { ...salvo.empresa, cnpj: doc(salvo.empresa.cnpj) },
    clientes: salvo.clientes.map((c) => ({ ...c, cpfCnpj: doc(c.cpfCnpj) })),
    fornecedores: salvo.fornecedores.map((f) => ({ ...f, cnpj: doc(f.cnpj) })),
    documentos: salvo.documentos.map((d) => ({
      ...d,
      emitenteSnapshot: {
        ...d.emitenteSnapshot,
        cnpj: doc(d.emitenteSnapshot.cnpj),
      },
      destinatarioSnapshot: d.destinatarioSnapshot
        ? { ...d.destinatarioSnapshot, cpfCnpj: doc(d.destinatarioSnapshot.cpfCnpj) }
        : null,
    })),
    produtos: salvo.produtos.map((p) => {
      if (p.vendeGelado !== undefined || p.tipo !== "NORMAL") return p;
      const g = geladoPadrao(p.nome, p.categoriaId, p.precoVarejo);
      return g ? { ...p, vendeGelado: true, precoGelado: g } : { ...p, vendeGelado: false };
    }),
  };
}
