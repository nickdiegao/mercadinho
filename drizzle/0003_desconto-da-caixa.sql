ALTER TABLE `produtos` ADD `desconto_caixa` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `produtos` ADD `desconto_caixa_gelado` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `venda_itens` ADD `embalagem_preco` integer;--> statement-breakpoint
-- O atacado por unidade vira o desconto da caixa, sem mudar nenhum preco:
-- a caixa era atacado x unidades e passa a ser unidades - desconto.
-- Atacado zerado ou acima da unidade fica sem desconto (a caixa = as unidades).
UPDATE `produtos` SET `desconto_caixa` = MAX(0, (`preco_varejo` - `preco_atacado`) * `fator_conversao`)
  WHERE `fator_conversao` > 1 AND `preco_atacado` > 0;
--> statement-breakpoint
-- A caixa gelada era (atacado + acrescimo do gelado) x unidades, com o
-- acrescimo = gelado - unidade, nunca negativo.
UPDATE `produtos` SET `desconto_caixa_gelado` = MAX(0,
    (`preco_gelado` - `preco_atacado` - MAX(0, `preco_gelado` - `preco_varejo`)) * `fator_conversao`)
  WHERE `fator_conversao` > 1 AND `preco_atacado` > 0 AND `preco_gelado` IS NOT NULL;
