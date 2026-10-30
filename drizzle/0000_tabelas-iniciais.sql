CREATE TABLE `caixa_movimentos` (
	`ordem` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`caixa_sessao_id` text NOT NULL,
	`data` text NOT NULL,
	`tipo` text NOT NULL,
	`forma_pagamento` text,
	`valor` integer NOT NULL,
	`venda_id` text,
	`descricao` text NOT NULL,
	FOREIGN KEY (`caixa_sessao_id`) REFERENCES `caixa_sessoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "caixa_movimentos_tipo_valido" CHECK("caixa_movimentos"."tipo" in ('VENDA', 'SANGRIA', 'SUPRIMENTO', 'DESPESA', 'RECEBIMENTO', 'ESTORNO')),
	CONSTRAINT "caixa_movimentos_forma_valida" CHECK("caixa_movimentos"."forma_pagamento" in ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `caixa_movimentos_id_unique` ON `caixa_movimentos` (`id`);--> statement-breakpoint
CREATE INDEX `caixa_movimentos_sessao` ON `caixa_movimentos` (`caixa_sessao_id`);--> statement-breakpoint
CREATE TABLE `caixa_sessoes` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`aberta_em` text NOT NULL,
	`fundo_troco` integer NOT NULL,
	`fechada_em` text,
	`valor_contado` integer,
	`status` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "caixa_fundo_positivo" CHECK("caixa_sessoes"."fundo_troco" >= 0),
	CONSTRAINT "caixa_status_valido" CHECK("caixa_sessoes"."status" in ('ABERTA', 'FECHADA'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `caixa_um_aberto` ON `caixa_sessoes` (`status`) WHERE "caixa_sessoes"."status" = 'ABERTA';--> statement-breakpoint
CREATE TABLE `categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`categoria_pai_id` text,
	FOREIGN KEY (`categoria_pai_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`nome_razao` text NOT NULL,
	`cpf_cnpj` text DEFAULT '' NOT NULL,
	`inscricao_estadual` text,
	`telefone` text DEFAULT '' NOT NULL,
	`email` text,
	`endereco` text DEFAULT '' NOT NULL,
	`tipo_preco` text DEFAULT 'VAREJO' NOT NULL,
	`limite_credito` integer DEFAULT 0 NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	CONSTRAINT "clientes_limite_positivo" CHECK("clientes"."limite_credito" >= 0),
	CONSTRAINT "clientes_tipo_valido" CHECK("clientes"."tipo" in ('PF', 'PJ')),
	CONSTRAINT "clientes_tipo_preco_valido" CHECK("clientes"."tipo_preco" in ('VAREJO', 'ATACADO'))
) STRICT;
--> statement-breakpoint
CREATE TABLE `documentos` (
	`id` text PRIMARY KEY NOT NULL,
	`venda_id` text NOT NULL,
	`tipo` text NOT NULL,
	`numero` integer NOT NULL,
	`emitido_em` text NOT NULL,
	`emitente_snapshot` text NOT NULL,
	`destinatario_snapshot` text,
	`serie` text,
	`chave_acesso` text,
	`protocolo` text,
	`status_sefaz` text,
	`xml_url` text,
	`pdf_url` text,
	FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "documentos_tipo_valido" CHECK("documentos"."tipo" in ('RECIBO', 'PEDIDO', 'NFE', 'NFCE'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `documentos_numero_unique` ON `documentos` (`numero`);--> statement-breakpoint
CREATE TABLE `empresa` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`razao_social` text NOT NULL,
	`nome_fantasia` text NOT NULL,
	`cnpj` text NOT NULL,
	`inscricao_estadual` text DEFAULT '' NOT NULL,
	`regime_tributario` text DEFAULT '' NOT NULL,
	`endereco` text DEFAULT '' NOT NULL,
	`telefone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	CONSTRAINT "empresa_uma_so" CHECK("empresa"."id" = 1)
) STRICT;
--> statement-breakpoint
CREATE TABLE `entrada_itens` (
	`id` text PRIMARY KEY NOT NULL,
	`entrada_id` text NOT NULL,
	`posicao` integer NOT NULL,
	`produto_id` text NOT NULL,
	`qtd_compra` integer NOT NULL,
	`unidade_compra` text NOT NULL,
	`fator_conversao` integer NOT NULL,
	`qtd_base` integer NOT NULL,
	`custo_unit_compra` integer NOT NULL,
	`custo_unit_base` integer NOT NULL,
	`valor_total` integer NOT NULL,
	FOREIGN KEY (`entrada_id`) REFERENCES `entradas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entrada_itens_qtd_positiva" CHECK("entrada_itens"."qtd_compra" > 0),
	CONSTRAINT "entrada_itens_custo_positivo" CHECK("entrada_itens"."custo_unit_compra" > 0),
	CONSTRAINT "entrada_itens_unidade_valida" CHECK("entrada_itens"."unidade_compra" in ('UN', 'CX', 'FD', 'ENG', 'BARRIL'))
) STRICT;
--> statement-breakpoint
CREATE INDEX `entrada_itens_entrada` ON `entrada_itens` (`entrada_id`);--> statement-breakpoint
CREATE TABLE `entradas` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`fornecedor_id` text NOT NULL,
	`data` text NOT NULL,
	`documento_fornecedor` text NOT NULL,
	`valor_total` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`observacao` text,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `entradas_numero_unique` ON `entradas` (`numero`);--> statement-breakpoint
CREATE TABLE `fornecedores` (
	`id` text PRIMARY KEY NOT NULL,
	`razao_social` text NOT NULL,
	`cnpj` text NOT NULL,
	`telefone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`endereco` text DEFAULT '' NOT NULL,
	`ativo` integer DEFAULT true NOT NULL
) STRICT;
--> statement-breakpoint
CREATE TABLE `log_auditoria` (
	`ordem` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`ocorrido_em` text NOT NULL,
	`usuario_id` text,
	`acao` text NOT NULL,
	`entidade` text NOT NULL,
	`entidade_id` text DEFAULT '' NOT NULL,
	`detalhe` text DEFAULT '' NOT NULL,
	`ip` text,
	`user_agent` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `log_auditoria_id_unique` ON `log_auditoria` (`id`);--> statement-breakpoint
CREATE INDEX `log_auditoria_ocorrido` ON `log_auditoria` (`ocorrido_em`);--> statement-breakpoint
CREATE TABLE `movimentos_estoque` (
	`ordem` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`produto_id` text NOT NULL,
	`data` text NOT NULL,
	`tipo` text NOT NULL,
	`qtd` integer NOT NULL,
	`saldo_apos` integer NOT NULL,
	`custo_unit_no_momento` integer NOT NULL,
	`origem_tipo` text NOT NULL,
	`origem_id` text,
	`usuario_id` text NOT NULL,
	`motivo` text,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movimentos_qtd_nao_zero" CHECK("movimentos_estoque"."qtd" <> 0),
	CONSTRAINT "movimentos_tipo_valido" CHECK("movimentos_estoque"."tipo" in ('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA', 'DEVOLUCAO', 'INVENTARIO_INICIAL')),
	CONSTRAINT "movimentos_origem_valida" CHECK("movimentos_estoque"."origem_tipo" in ('ENTRADA', 'VENDA', 'AJUSTE', 'CARGA_INICIAL'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `movimentos_estoque_id_unique` ON `movimentos_estoque` (`id`);--> statement-breakpoint
CREATE INDEX `movimentos_produto` ON `movimentos_estoque` (`produto_id`);--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`codigo_barras` text DEFAULT '' NOT NULL,
	`nome` text NOT NULL,
	`categoria_id` text NOT NULL,
	`tipo` text DEFAULT 'NORMAL' NOT NULL,
	`vasilhame_id` text,
	`unidade_base` text DEFAULT 'UN' NOT NULL,
	`unidade_compra` text NOT NULL,
	`fator_conversao` integer NOT NULL,
	`custo_medio` integer DEFAULT 0 NOT NULL,
	`custo_ultima_compra` integer DEFAULT 0 NOT NULL,
	`preco_varejo` integer DEFAULT 0 NOT NULL,
	`preco_atacado` integer DEFAULT 0 NOT NULL,
	`preco_gelado` integer,
	`vende_gelado` integer,
	`qtd_minima_atacado` integer NOT NULL,
	`estoque_minimo` integer DEFAULT 0 NOT NULL,
	`saldo_atual` integer DEFAULT 0 NOT NULL,
	`ncm` text DEFAULT '' NOT NULL,
	`cest` text,
	`cfop` text,
	`origem` text,
	`ativo` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vasilhame_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "produtos_precos_positivos" CHECK("produtos"."preco_varejo" >= 0 and "produtos"."preco_atacado" >= 0),
	CONSTRAINT "produtos_gelado_positivo" CHECK("produtos"."preco_gelado" is null or "produtos"."preco_gelado" > 0),
	CONSTRAINT "produtos_fator_minimo" CHECK("produtos"."fator_conversao" >= 1),
	CONSTRAINT "produtos_custo_positivo" CHECK("produtos"."custo_medio" >= 0 and "produtos"."custo_ultima_compra" >= 0),
	CONSTRAINT "produtos_tipo_valido" CHECK("produtos"."tipo" in ('NORMAL', 'VASILHAME')),
	CONSTRAINT "produtos_unidade_base_valida" CHECK("produtos"."unidade_base" in ('UN', 'L')),
	CONSTRAINT "produtos_unidade_compra_valida" CHECK("produtos"."unidade_compra" in ('UN', 'CX', 'FD', 'ENG', 'BARRIL'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `produtos_sku_unique` ON `produtos` (`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `produtos_codigo_barras_unico` ON `produtos` (`codigo_barras`) WHERE "produtos"."codigo_barras" <> '';--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`perfil` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`tentativas_falhas` integer DEFAULT 0 NOT NULL,
	`bloqueado_ate` text,
	CONSTRAINT "usuarios_perfil_valido" CHECK("usuarios"."perfil" in ('ADMIN', 'CAIXA', 'ESTOQUE'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unico` ON `usuarios` (lower("email"));--> statement-breakpoint
CREATE TABLE `venda_itens` (
	`id` text PRIMARY KEY NOT NULL,
	`venda_id` text NOT NULL,
	`posicao` integer NOT NULL,
	`produto_id` text NOT NULL,
	`descricao` text NOT NULL,
	`qtd` integer NOT NULL,
	`preco_unit` integer NOT NULL,
	`custo_unit` integer NOT NULL,
	`tipo_preco_aplicado` text NOT NULL,
	`embalagem_unidade` text,
	`embalagem_fator` integer,
	`gelado` integer DEFAULT false NOT NULL,
	`adicional_gelado` integer,
	`total` integer NOT NULL,
	FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "venda_itens_qtd_positiva" CHECK("venda_itens"."qtd" > 0),
	CONSTRAINT "venda_itens_preco_positivo" CHECK("venda_itens"."preco_unit" > 0),
	CONSTRAINT "venda_itens_tipo_preco_valido" CHECK("venda_itens"."tipo_preco_aplicado" in ('VAREJO', 'ATACADO')),
	CONSTRAINT "venda_itens_embalagem_valida" CHECK("venda_itens"."embalagem_unidade" in ('UN', 'CX', 'FD', 'ENG', 'BARRIL'))
) STRICT;
--> statement-breakpoint
CREATE INDEX `venda_itens_venda` ON `venda_itens` (`venda_id`);--> statement-breakpoint
CREATE TABLE `vendas` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`cliente_id` text,
	`data` text NOT NULL,
	`usuario_id` text NOT NULL,
	`caixa_sessao_id` text,
	`tipo_preco` text NOT NULL,
	`subtotal` integer NOT NULL,
	`desconto` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`custo_total` integer NOT NULL,
	`forma_pagamento` text NOT NULL,
	`status` text NOT NULL,
	`cancelada_em` text,
	`cancelada_por` text,
	`motivo_cancelamento` text,
	`chave_idempotencia` text,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`caixa_sessao_id`) REFERENCES `caixa_sessoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelada_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "vendas_valores_positivos" CHECK("vendas"."desconto" >= 0 and "vendas"."total" >= 0),
	CONSTRAINT "vendas_tipo_preco_valido" CHECK("vendas"."tipo_preco" in ('VAREJO', 'ATACADO')),
	CONSTRAINT "vendas_forma_valida" CHECK("vendas"."forma_pagamento" in ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO')),
	CONSTRAINT "vendas_status_valido" CHECK("vendas"."status" in ('FECHADA', 'CANCELADA'))
) STRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX `vendas_numero_unique` ON `vendas` (`numero`);--> statement-breakpoint
CREATE UNIQUE INDEX `vendas_chave_idempotencia_unique` ON `vendas` (`chave_idempotencia`);--> statement-breakpoint
CREATE INDEX `vendas_data` ON `vendas` (`data`);