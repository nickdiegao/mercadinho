-- O livro-razao do estoque e a trilha de auditoria so aceitam insercao.
-- Corrigir um movimento errado e lancar outro movimento (ajuste, devolucao),
-- nunca editar o antigo: e isso que deixa o saldo de qualquer dia
-- reconstituivel e a auditoria confiavel.

CREATE TRIGGER movimentos_estoque_nao_altera BEFORE UPDATE ON movimentos_estoque
BEGIN
  SELECT RAISE(ABORT, 'A tabela movimentos_estoque so aceita insercao: corrija com um lancamento novo.');
END;
--> statement-breakpoint
CREATE TRIGGER movimentos_estoque_nao_apaga BEFORE DELETE ON movimentos_estoque
BEGIN
  SELECT RAISE(ABORT, 'A tabela movimentos_estoque so aceita insercao: corrija com um lancamento novo.');
END;
--> statement-breakpoint
CREATE TRIGGER log_auditoria_nao_altera BEFORE UPDATE ON log_auditoria
BEGIN
  SELECT RAISE(ABORT, 'A tabela log_auditoria so aceita insercao: corrija com um lancamento novo.');
END;
--> statement-breakpoint
CREATE TRIGGER log_auditoria_nao_apaga BEFORE DELETE ON log_auditoria
BEGIN
  SELECT RAISE(ABORT, 'A tabela log_auditoria so aceita insercao: corrija com um lancamento novo.');
END;
