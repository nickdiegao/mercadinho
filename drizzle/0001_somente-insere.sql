-- O livro-razao do estoque e a trilha de auditoria so aceitam insercao.
-- Corrigir um movimento errado e lancar outro movimento (ajuste, devolucao),
-- nunca editar o antigo: e isso que deixa o saldo de qualquer dia
-- reconstituivel e a auditoria confiavel.
--
-- O gatilho vale para UPDATE e DELETE de linha. TRUNCATE continua possivel,
-- e so o "npm run banco:zerar" usa, para recomecar o banco de teste.

CREATE OR REPLACE FUNCTION recusa_alteracao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % so aceita insercao: corrija com um lancamento novo.', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER movimentos_estoque_somente_insere
  BEFORE UPDATE OR DELETE ON movimentos_estoque
  FOR EACH ROW EXECUTE FUNCTION recusa_alteracao();
--> statement-breakpoint
CREATE TRIGGER log_auditoria_somente_insere
  BEFORE UPDATE OR DELETE ON log_auditoria
  FOR EACH ROW EXECUTE FUNCTION recusa_alteracao();
