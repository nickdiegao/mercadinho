CREATE TYPE "public"."forma_pagamento" AS ENUM('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO');--> statement-breakpoint
CREATE TYPE "public"."origem_movimento" AS ENUM('ENTRADA', 'VENDA', 'AJUSTE', 'CARGA_INICIAL');--> statement-breakpoint
CREATE TYPE "public"."perfil" AS ENUM('ADMIN', 'CAIXA', 'ESTOQUE');--> statement-breakpoint
CREATE TYPE "public"."status_caixa" AS ENUM('ABERTA', 'FECHADA');--> statement-breakpoint
CREATE TYPE "public"."status_venda" AS ENUM('FECHADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_caixa_mov" AS ENUM('VENDA', 'SANGRIA', 'SUPRIMENTO', 'DESPESA', 'RECEBIMENTO', 'ESTORNO');--> statement-breakpoint
CREATE TYPE "public"."tipo_cliente" AS ENUM('PF', 'PJ');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('RECIBO', 'PEDIDO', 'NFE', 'NFCE');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimento" AS ENUM('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA', 'DEVOLUCAO', 'INVENTARIO_INICIAL');--> statement-breakpoint
CREATE TYPE "public"."tipo_preco" AS ENUM('VAREJO', 'ATACADO');--> statement-breakpoint
CREATE TYPE "public"."tipo_produto" AS ENUM('NORMAL', 'VASILHAME');--> statement-breakpoint
CREATE TYPE "public"."unidade_base" AS ENUM('UN', 'L');--> statement-breakpoint
CREATE TYPE "public"."unidade_compra" AS ENUM('UN', 'CX', 'FD', 'ENG', 'BARRIL');--> statement-breakpoint
CREATE TABLE "caixa_movimentos" (
	"id" text PRIMARY KEY NOT NULL,
	"ordem" bigint GENERATED ALWAYS AS IDENTITY (sequence name "caixa_movimentos_ordem_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"caixa_sessao_id" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"tipo" "tipo_caixa_mov" NOT NULL,
	"forma_pagamento" "forma_pagamento",
	"valor" integer NOT NULL,
	"venda_id" text,
	"descricao" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caixa_sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"aberta_em" timestamp with time zone NOT NULL,
	"fundo_troco" integer NOT NULL,
	"fechada_em" timestamp with time zone,
	"valor_contado" integer,
	"status" "status_caixa" NOT NULL,
	CONSTRAINT "caixa_fundo_positivo" CHECK ("caixa_sessoes"."fundo_troco" >= 0)
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria_pai_id" text
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" "tipo_cliente" NOT NULL,
	"nome_razao" text NOT NULL,
	"cpf_cnpj" text DEFAULT '' NOT NULL,
	"inscricao_estadual" text,
	"telefone" text DEFAULT '' NOT NULL,
	"email" text,
	"endereco" text DEFAULT '' NOT NULL,
	"tipo_preco" "tipo_preco" DEFAULT 'VAREJO' NOT NULL,
	"limite_credito" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "clientes_limite_positivo" CHECK ("clientes"."limite_credito" >= 0)
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" text PRIMARY KEY NOT NULL,
	"venda_id" text NOT NULL,
	"tipo" "tipo_documento" NOT NULL,
	"numero" integer NOT NULL,
	"emitido_em" timestamp with time zone NOT NULL,
	"emitente_snapshot" jsonb NOT NULL,
	"destinatario_snapshot" jsonb,
	"serie" text,
	"chave_acesso" text,
	"protocolo" text,
	"status_sefaz" text,
	"xml_url" text,
	"pdf_url" text,
	CONSTRAINT "documentos_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "empresa" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"razao_social" text NOT NULL,
	"nome_fantasia" text NOT NULL,
	"cnpj" text NOT NULL,
	"inscricao_estadual" text DEFAULT '' NOT NULL,
	"regime_tributario" text DEFAULT '' NOT NULL,
	"endereco" text DEFAULT '' NOT NULL,
	"telefone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	CONSTRAINT "empresa_uma_so" CHECK ("empresa"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "entrada_itens" (
	"id" text PRIMARY KEY NOT NULL,
	"entrada_id" text NOT NULL,
	"posicao" integer NOT NULL,
	"produto_id" text NOT NULL,
	"qtd_compra" numeric(12, 3) NOT NULL,
	"unidade_compra" "unidade_compra" NOT NULL,
	"fator_conversao" integer NOT NULL,
	"qtd_base" numeric(12, 3) NOT NULL,
	"custo_unit_compra" integer NOT NULL,
	"custo_unit_base" integer NOT NULL,
	"valor_total" integer NOT NULL,
	CONSTRAINT "entrada_itens_qtd_positiva" CHECK ("entrada_itens"."qtd_compra" > 0),
	CONSTRAINT "entrada_itens_custo_positivo" CHECK ("entrada_itens"."custo_unit_compra" > 0)
);
--> statement-breakpoint
CREATE TABLE "entradas" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" integer NOT NULL,
	"fornecedor_id" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"documento_fornecedor" text NOT NULL,
	"valor_total" integer NOT NULL,
	"usuario_id" text NOT NULL,
	"observacao" text,
	CONSTRAINT "entradas_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" text PRIMARY KEY NOT NULL,
	"razao_social" text NOT NULL,
	"cnpj" text NOT NULL,
	"telefone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"endereco" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_auditoria" (
	"id" text PRIMARY KEY NOT NULL,
	"ordem" bigint GENERATED ALWAYS AS IDENTITY (sequence name "log_auditoria_ordem_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ocorrido_em" timestamp with time zone NOT NULL,
	"usuario_id" text,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text DEFAULT '' NOT NULL,
	"detalhe" text DEFAULT '' NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "movimentos_estoque" (
	"id" text PRIMARY KEY NOT NULL,
	"ordem" bigint GENERATED ALWAYS AS IDENTITY (sequence name "movimentos_estoque_ordem_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"produto_id" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"tipo" "tipo_movimento" NOT NULL,
	"qtd" numeric(12, 3) NOT NULL,
	"saldo_apos" numeric(12, 3) NOT NULL,
	"custo_unit_no_momento" integer NOT NULL,
	"origem_tipo" "origem_movimento" NOT NULL,
	"origem_id" text,
	"usuario_id" text NOT NULL,
	"motivo" text,
	CONSTRAINT "movimentos_qtd_nao_zero" CHECK ("movimentos_estoque"."qtd" <> 0)
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"codigo_barras" text DEFAULT '' NOT NULL,
	"nome" text NOT NULL,
	"categoria_id" text NOT NULL,
	"tipo" "tipo_produto" DEFAULT 'NORMAL' NOT NULL,
	"vasilhame_id" text,
	"unidade_base" "unidade_base" DEFAULT 'UN' NOT NULL,
	"unidade_compra" "unidade_compra" NOT NULL,
	"fator_conversao" integer NOT NULL,
	"custo_medio" integer DEFAULT 0 NOT NULL,
	"custo_ultima_compra" integer DEFAULT 0 NOT NULL,
	"preco_varejo" integer DEFAULT 0 NOT NULL,
	"preco_atacado" integer DEFAULT 0 NOT NULL,
	"preco_gelado" integer,
	"vende_gelado" boolean,
	"qtd_minima_atacado" numeric(12, 3) NOT NULL,
	"estoque_minimo" numeric(12, 3) DEFAULT 0 NOT NULL,
	"saldo_atual" numeric(12, 3) DEFAULT 0 NOT NULL,
	"ncm" text DEFAULT '' NOT NULL,
	"cest" text,
	"cfop" text,
	"origem" text,
	"ativo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "produtos_sku_unique" UNIQUE("sku"),
	CONSTRAINT "produtos_precos_positivos" CHECK ("produtos"."preco_varejo" >= 0 and "produtos"."preco_atacado" >= 0),
	CONSTRAINT "produtos_gelado_positivo" CHECK ("produtos"."preco_gelado" is null or "produtos"."preco_gelado" > 0),
	CONSTRAINT "produtos_fator_minimo" CHECK ("produtos"."fator_conversao" >= 1),
	CONSTRAINT "produtos_custo_positivo" CHECK ("produtos"."custo_medio" >= 0 and "produtos"."custo_ultima_compra" >= 0)
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"perfil" "perfil" NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"tentativas_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "venda_itens" (
	"id" text PRIMARY KEY NOT NULL,
	"venda_id" text NOT NULL,
	"posicao" integer NOT NULL,
	"produto_id" text NOT NULL,
	"descricao" text NOT NULL,
	"qtd" numeric(12, 3) NOT NULL,
	"preco_unit" integer NOT NULL,
	"custo_unit" integer NOT NULL,
	"tipo_preco_aplicado" "tipo_preco" NOT NULL,
	"embalagem_unidade" "unidade_compra",
	"embalagem_fator" integer,
	"gelado" boolean DEFAULT false NOT NULL,
	"adicional_gelado" integer,
	"total" integer NOT NULL,
	CONSTRAINT "venda_itens_qtd_positiva" CHECK ("venda_itens"."qtd" > 0),
	CONSTRAINT "venda_itens_preco_positivo" CHECK ("venda_itens"."preco_unit" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendas" (
	"id" text PRIMARY KEY NOT NULL,
	"numero" integer NOT NULL,
	"cliente_id" text,
	"data" timestamp with time zone NOT NULL,
	"usuario_id" text NOT NULL,
	"caixa_sessao_id" text,
	"tipo_preco" "tipo_preco" NOT NULL,
	"subtotal" integer NOT NULL,
	"desconto" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"custo_total" integer NOT NULL,
	"forma_pagamento" "forma_pagamento" NOT NULL,
	"status" "status_venda" NOT NULL,
	"cancelada_em" timestamp with time zone,
	"cancelada_por" text,
	"motivo_cancelamento" text,
	"chave_idempotencia" text,
	CONSTRAINT "vendas_numero_unique" UNIQUE("numero"),
	CONSTRAINT "vendas_chave_idempotencia_unique" UNIQUE("chave_idempotencia"),
	CONSTRAINT "vendas_valores_positivos" CHECK ("vendas"."desconto" >= 0 and "vendas"."total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "caixa_movimentos" ADD CONSTRAINT "caixa_movimentos_caixa_sessao_id_caixa_sessoes_id_fk" FOREIGN KEY ("caixa_sessao_id") REFERENCES "public"."caixa_sessoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caixa_movimentos" ADD CONSTRAINT "caixa_movimentos_venda_id_vendas_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caixa_sessoes" ADD CONSTRAINT "caixa_sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_categoria_pai_id_categorias_id_fk" FOREIGN KEY ("categoria_pai_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_venda_id_vendas_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada_itens" ADD CONSTRAINT "entrada_itens_entrada_id_entradas_id_fk" FOREIGN KEY ("entrada_id") REFERENCES "public"."entradas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrada_itens" ADD CONSTRAINT "entrada_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_vasilhame_id_produtos_id_fk" FOREIGN KEY ("vasilhame_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_venda_id_vendas_id_fk" FOREIGN KEY ("venda_id") REFERENCES "public"."vendas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venda_itens" ADD CONSTRAINT "venda_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_caixa_sessao_id_caixa_sessoes_id_fk" FOREIGN KEY ("caixa_sessao_id") REFERENCES "public"."caixa_sessoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_cancelada_por_usuarios_id_fk" FOREIGN KEY ("cancelada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "caixa_movimentos_sessao" ON "caixa_movimentos" USING btree ("caixa_sessao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "caixa_um_aberto" ON "caixa_sessoes" USING btree ("status") WHERE "caixa_sessoes"."status" = 'ABERTA';--> statement-breakpoint
CREATE INDEX "entrada_itens_entrada" ON "entrada_itens" USING btree ("entrada_id");--> statement-breakpoint
CREATE INDEX "log_auditoria_ocorrido" ON "log_auditoria" USING btree ("ocorrido_em");--> statement-breakpoint
CREATE INDEX "movimentos_produto" ON "movimentos_estoque" USING btree ("produto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_codigo_barras_unico" ON "produtos" USING btree ("codigo_barras") WHERE "produtos"."codigo_barras" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_unico" ON "usuarios" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "venda_itens_venda" ON "venda_itens" USING btree ("venda_id");--> statement-breakpoint
CREATE INDEX "vendas_data" ON "vendas" USING btree ("data");