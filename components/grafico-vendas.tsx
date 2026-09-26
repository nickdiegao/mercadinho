"use client";

/**
 * Grafico de receita e lucro do painel.
 *
 * Fica num arquivo proprio para ser carregado sob demanda: a biblioteca de
 * graficos e o maior pedaco de codigo do sistema (~110 KB), e sem ela o resto
 * do painel aparece antes.
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { moeda, diaCurto } from "@/lib/formato";

export default function GraficoVendas({
  serie,
  comLucro,
}: {
  serie: { dia: string; receita: number; lucro: number }[];
  comLucro: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={serie} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3f8f" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#1e3f8f" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e6a4f" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#0e6a4f" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e6ecf3" vertical={false} />
        <XAxis
          dataKey="dia"
          tickFormatter={(d) => diaCurto(d)}
          tick={{ fontSize: 10.5, fill: "#6b7685" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 10.5, fill: "#6b7685" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip
          contentStyle={{
            border: "1px solid #dbe2ea",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 6px 20px -12px rgba(15,20,28,.4)",
          }}
          labelFormatter={(d) => diaCurto(String(d))}
          formatter={(v: number, nome: string) => [
            moeda(Math.round(v * 100)),
            nome === "receita" ? "Receita" : "Lucro",
          ]}
        />
        <Area type="monotone" dataKey="receita" stroke="#1e3f8f" strokeWidth={1.8} fill="url(#gR)" />
        {comLucro && (
          <Area type="monotone" dataKey="lucro" stroke="#0e6a4f" strokeWidth={1.8} fill="url(#gL)" />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
