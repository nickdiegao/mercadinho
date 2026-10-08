# -*- coding: utf-8 -*-
"""Manual de uso do sistema, para enviar ao cliente.

Uso:  python gerar_manual.py "../Manual de uso.pdf"
Precisa de reportlab e pillow. Os prints vem de ./shots, gerados por capturar.mjs.
"""

import os
from PIL import Image as PILImage

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image,
    Table, TableStyle, KeepTogether, HRFlowable, PageBreak, NextPageTemplate,
)

SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")

# ---------------------------------------------------------------- identidade
INK    = colors.HexColor("#0F141C")
INK2   = colors.HexColor("#39434F")
MUTED  = colors.HexColor("#69747F")
LINE   = colors.HexColor("#D5DCE5")
MARCA  = colors.HexColor("#1E3F8F")
ESCURA = colors.HexColor("#16233F")
CLARA  = colors.HexColor("#E3EAF8")
SURF   = colors.HexColor("#EDF0F5")
POS    = colors.HexColor("#0E6A4F")
POSC   = colors.HexColor("#DDEFE8")
ALERTA = colors.HexColor("#9E2B22")
ALERTC = colors.HexColor("#F8E4E1")
CASCO  = colors.HexColor("#A93A60")
CASCOC = colors.HexColor("#F9E6EC")

FONT, FONT_B, FONT_I = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"
try:
    F = r"C:\Windows\Fonts"
    pdfmetrics.registerFont(TTFont("Segoe", F + r"\segoeui.ttf"))
    pdfmetrics.registerFont(TTFont("Segoe-B", F + r"\segoeuib.ttf"))
    pdfmetrics.registerFont(TTFont("Segoe-I", F + r"\segoeuii.ttf"))
    pdfmetrics.registerFontFamily("Segoe", normal="Segoe", bold="Segoe-B", italic="Segoe-I")
    FONT, FONT_B, FONT_I = "Segoe", "Segoe-B", "Segoe-I"
except Exception:
    pass

PW, PH = A4
ML, MR, MT, MB = 18 * mm, 16 * mm, 18 * mm, 18 * mm
CW = PW - ML - MR

S = lambda **k: ParagraphStyle(**k)
st_capa_k  = S(name="ck", fontName=FONT_B, fontSize=9, leading=12, textColor=colors.white)
st_capa_t  = S(name="ct", fontName=FONT_B, fontSize=34, leading=37, textColor=colors.white)
st_capa_s  = S(name="cs", fontName=FONT, fontSize=12, leading=18, textColor=colors.Color(1, 1, 1, 0.78))
st_capa_p  = S(name="cp", fontName=FONT, fontSize=9.5, leading=14, textColor=colors.Color(1, 1, 1, 0.55))

st_sec_n   = S(name="sn", fontName=FONT_B, fontSize=11, leading=13, textColor=MARCA)
st_sec     = S(name="sc", fontName=FONT_B, fontSize=19, leading=22, textColor=INK)
st_sec_d   = S(name="sd", fontName=FONT, fontSize=10.5, leading=15, textColor=MUTED)
st_sub     = S(name="sb", fontName=FONT_B, fontSize=12.5, leading=16, textColor=INK, spaceBefore=4)
st_corpo   = S(name="p", fontName=FONT, fontSize=10.2, leading=15.5, textColor=INK2)
st_passo   = S(name="pa", fontName=FONT, fontSize=10.2, leading=15, textColor=INK2)
st_num     = S(name="nu", fontName=FONT_B, fontSize=10, leading=14, textColor=colors.white)
st_cap     = S(name="cap", fontName=FONT_I, fontSize=8.8, leading=12, textColor=MUTED)
st_box_t   = S(name="bt", fontName=FONT_B, fontSize=9.5, leading=13, textColor=INK)
st_box     = S(name="bx", fontName=FONT, fontSize=9.5, leading=14, textColor=INK2)
st_tab_h   = S(name="th", fontName=FONT_B, fontSize=8.5, leading=11, textColor=colors.white)
st_tab     = S(name="td", fontName=FONT, fontSize=9.2, leading=13, textColor=INK2)
st_tab_b   = S(name="tb", fontName=FONT_B, fontSize=9.2, leading=13, textColor=INK)
st_sumario = S(name="su", fontName=FONT, fontSize=10.5, leading=19, textColor=INK2)


# ---------------------------------------------------------------- elementos
def imagem(arquivo, legenda=None, larg=None, alt_max=118 * mm):
    """Screenshot escalado para caber na largura util (ou na altura maxima)."""
    caminho = os.path.join(SHOTS, arquivo)
    with PILImage.open(caminho) as im:
        w, h = im.size
    larg = larg or CW
    altura = larg * h / w
    if altura > alt_max:
        altura = alt_max
        larg = altura * w / h
    img = Image(caminho, width=larg, height=altura)
    img.hAlign = "CENTER"
    partes = [img]
    if legenda:
        partes += [Spacer(1, 4), Paragraph(legenda, st_cap)]
    caixa = Table([[p] for p in partes], colWidths=[CW])
    caixa.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("BOX", (0, 0), (0, 0), 0.6, LINE),
    ]))
    return KeepTogether([Spacer(1, 8), caixa, Spacer(1, 14)])


def secao(numero, titulo, descricao=None):
    n = Paragraph(f"{numero:02d}", st_sec_n)
    corpo = [Paragraph(titulo, st_sec)]
    if descricao:
        corpo.append(Paragraph(descricao, st_sec_d))
    t = Table([[n, corpo]], colWidths=[12 * mm, CW - 12 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (0, 0), 3),
    ]))
    bloco = KeepTogether([
        Spacer(1, 16),
        HRFlowable(width="100%", thickness=1.2, color=MARCA, spaceAfter=9),
        t,
        Spacer(1, 12),
    ])
    bloco.keepWithNext = 1  # titulo nunca fica sozinho no pe da pagina
    return bloco


def sub(texto):
    bloco = KeepTogether([Spacer(1, 10), Paragraph(texto, st_sub), Spacer(1, 6)])
    bloco.keepWithNext = 1
    return bloco


def passos(lista):
    """Lista numerada com marcador redondo azul."""
    linhas = []
    for i, txt in enumerate(lista, start=1):
        marca = Table([[Paragraph(str(i), st_num)]], colWidths=[6.2 * mm], rowHeights=[6.2 * mm])
        marca.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), MARCA),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        linhas.append([marca, Paragraph(txt, st_passo)])
    t = Table(linhas, colWidths=[10 * mm, CW - 10 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def caixa(titulo, texto, tom="marca"):
    cores = {
        "marca": (CLARA, MARCA),
        "atencao": (ALERTC, ALERTA),
        "bom": (POSC, POS),
        "casco": (CASCOC, CASCO),
    }[tom]
    dentro = [Paragraph(titulo, st_box_t), Spacer(1, 3), Paragraph(texto, st_box)]
    t = Table([[dentro]], colWidths=[CW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), cores[0]),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, cores[1]),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return KeepTogether([Spacer(1, 6), t, Spacer(1, 12)])


def tabela(cabecalho, linhas, larguras):
    dados = [[Paragraph(c, st_tab_h) for c in cabecalho]]
    for ln in linhas:
        dados.append([
            Paragraph(c, st_tab_b if i == 0 else st_tab) for i, c in enumerate(ln)
        ])
    t = Table(dados, colWidths=larguras, repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), MARCA),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
    ]
    for i in range(1, len(dados)):
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F6F8FB")))
    t.setStyle(TableStyle(estilo))
    return KeepTogether([Spacer(1, 4), t, Spacer(1, 12)])


def p(texto):
    return Paragraph(texto, st_corpo)


# ---------------------------------------------------------------- conteudo

def aparar(arquivo, margem=36):
    """Corta o fundo vazio embaixo dos paineis laterais."""
    origem = os.path.join(SHOTS, arquivo)
    destino = os.path.join(SHOTS, arquivo.replace(".png", "-aparado.png"))
    with PILImage.open(origem) as im:
        im = im.convert("RGB")
        w, h = im.size
        fundo = im.getpixel((4, h - 4))
        px = im.load()
        ultima = h - 1
        for y in range(h - 1, 0, -1):
            if any(
                sum(abs(a - b) for a, b in zip(px[x, y], fundo)) > 18
                for x in range(0, w, 6)
            ):
                ultima = y
                break
        im.crop((0, 0, w, min(h, ultima + margem))).save(destino)
    return os.path.basename(destino)


def lado_a_lado(texto, arquivo, larg=62 * mm, legenda=None):
    """Texto a esquerda e o print alto (painel ou celular) a direita."""
    caminho = os.path.join(SHOTS, arquivo)
    with PILImage.open(caminho) as im:
        w, h = im.size
    img = Image(caminho, width=larg, height=larg * h / w)
    direita = [img]
    if legenda:
        direita += [Spacer(1, 4), Paragraph(legenda, st_cap)]
    quadro = Table([[d] for d in direita], colWidths=[larg])
    quadro.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("BOX", (0, 0), (0, 0), 0.6, LINE),
    ]))
    t = Table([[texto, quadro]], colWidths=[CW - larg - 8 * mm, larg + 8 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 10),
        ("LEFTPADDING", (1, 0), (1, 0), 8 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([Spacer(1, 6), t, Spacer(1, 14)])


def passos_estreitos(lista, largura):
    """Mesma lista numerada, para caber na coluna ao lado de um print."""
    linhas = []
    for i, txt in enumerate(lista, start=1):
        marca = Table([[Paragraph(str(i), st_num)]], colWidths=[6.2 * mm], rowHeights=[6.2 * mm])
        marca.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), MARCA),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        linhas.append([marca, Paragraph(txt, st_passo)])
    t = Table(linhas, colWidths=[10 * mm, largura - 10 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def caixa_estreita(titulo, texto, largura, tom="marca"):
    cores = {
        "marca": (CLARA, MARCA),
        "atencao": (ALERTC, ALERTA),
        "bom": (POSC, POS),
    }[tom]
    dentro = [Paragraph(titulo, st_box_t), Spacer(1, 3), Paragraph(texto, st_box)]
    t = Table([[dentro]], colWidths=[largura])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), cores[0]),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, cores[1]),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def montar():
    h = []
    COL = CW - 62 * mm - 8 * mm  # coluna de texto ao lado de um print alto

    # ============================================================ capa
    h.append(NextPageTemplate("miolo"))
    h.append(Spacer(1, 52 * mm))
    h.append(Paragraph("MANUAL DE USO", st_capa_k))
    h.append(Spacer(1, 10))
    h.append(Paragraph("Sistema de estoque,<br/>vendas e caixa", st_capa_t))
    h.append(Spacer(1, 14))
    h.append(Paragraph(
        "Um guia passo a passo para o dia a dia da distribuidora. "
        "Feito para quem nunca usou sistema nenhum — não precisa saber "
        "de computador, só ler e seguir.", st_capa_s))
    h.append(Spacer(1, 30))
    h.append(Paragraph(
        "Versão de demonstração · 3ª edição, outubro de 2026<br/>"
        "Os dados que aparecem nas telas deste manual são fictícios, "
        "criados só para mostrar o sistema funcionando.", st_capa_p))
    h.append(PageBreak())

    # ============================================================ sumario
    h.append(Paragraph("O que tem neste manual", st_sec))
    h.append(Spacer(1, 4))
    h.append(Paragraph(
        "Você não precisa ler tudo de uma vez. Procure aqui o que quer fazer "
        "e vá direto na página.", st_sec_d))
    h.append(Spacer(1, 12))

    itens_sumario = [
        ("01", "Antes de começar", "o que o sistema faz e como entrar"),
        ("02", "O dia a dia", "abrir o caixa, vender, mandar o recibo, fechar o caixa"),
        ("03", "Quando chega mercadoria", "lançar a carga e entender o custo"),
        ("04", "Cadastrar um produto novo", "inclusive o que ainda não tem no depósito"),
        ("05", "Conferir o estoque", "saldos, extrato, ajuste e vasilhame"),
        ("06", "Preços: varejo, atacado e gelado", "como o sistema decide sozinho"),
        ("07", "Clientes e fornecedores", "cadastro com busca na Receita"),
        ("08", "Cancelar uma venda", "o que volta para o estoque e para o caixa"),
        ("09", "Relatórios", "lucro, curva ABC, geladeira e os três formatos de arquivo"),
        ("10", "Quem vê o quê", "os três perfis de acesso"),
        ("11", "Começando do zero", "colocando seus dados pela primeira vez"),
        ("12", "Usando no celular", ""),
        ("13", "Perguntas frequentes", ""),
    ]
    linhas = []
    for n, tit, desc in itens_sumario:
        txt = f"<b>{tit}</b>"
        if desc:
            txt += f"<br/><font color='#69747F' size='9'>{desc}</font>"
        linhas.append([Paragraph(n, st_sec_n), Paragraph(txt, st_sumario)])
    t = Table(linhas, colWidths=[12 * mm, CW - 12 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
    ]))
    h.append(t)
    h.append(PageBreak())

    # ============================================================ 01
    h.append(secao(1, "Antes de começar",
                   "O que este sistema resolve, e como entrar nele."))

    h.append(p("Este sistema serve para você saber, a qualquer momento, "
               "<b>quanto tem de mercadoria</b>, <b>quanto entrou de dinheiro</b> "
               "e <b>quanto sobrou de lucro</b>. Tudo o que você registra nele "
               "alimenta essas três respostas."))
    h.append(Spacer(1, 6))
    h.append(p("Ele funciona no navegador — no computador da loja, no notebook "
               "ou no celular. Não precisa instalar nada."))

    h.append(caixa(
        "Uma coisa importante logo de saída",
        "O documento que o sistema imprime é um <b>recibo</b>, não uma nota "
        "fiscal. Ele serve para comprovar a venda entre você e o cliente, com "
        "CNPJ, descrição e valores — mas não substitui a Nota Fiscal "
        "Eletrônica. A emissão de NF-e é uma etapa seguinte do projeto.",
        tom="atencao"))

    h.append(sub("Entrando no sistema"))
    h.append(p("A primeira tela pede só que você escolha quem está usando. "
               "Cada pessoa enxerga uma parte diferente do sistema — isso está "
               "explicado na seção 10."))
    h.append(imagem("01-login.png",
                    "Tela de entrada. Toque no seu nome para começar."))

    h.append(sub("Os cadastros abrem ao lado"))
    h.append(p("Todo cadastro — produto, cliente, fornecedor — abre num painel "
               "que desliza pela direita, por cima da tela em que você está. "
               "Assim, cadastrar um cliente no meio de uma venda não joga a "
               "venda fora: você salva, o painel fecha e a venda continua de "
               "onde parou. Para fechar sem salvar, toque no <b>X</b> ou "
               "aperte <b>Esc</b>."))

    # ============================================================ 02
    h.append(secao(2, "O dia a dia",
                   "As quatro coisas que você faz todo dia, na ordem."))

    h.append(sub("Passo 1 — Abrir o caixa de manhã"))
    h.append(p("Antes da primeira venda, abra o caixa. Isso serve para o "
               "sistema saber quanto de dinheiro já estava na gaveta e "
               "conseguir conferir no fim do dia."))
    h.append(passos([
        "No menu da esquerda, toque em <b>Caixa</b>.",
        "Digite quanto tem de troco na gaveta e toque em <b>Abrir caixa</b>.",
    ]))

    h.append(sub("Passo 2 — Registrar uma venda"))
    h.append(p("É a tela que você mais vai usar. Ela foi feita para ser rápida."))
    h.append(passos([
        "Toque em <b>Nova venda</b> no menu.",
        "Digite o nome do produto na busca. Cada um aparece com dois botões, "
        "já com o preço: <b>+ 1 un</b> para a unidade avulsa e <b>+ 1 cx</b> "
        "(ou <b>fd</b>, <b>eng</b>) para a caixa fechada.",
        "Ajuste a quantidade nos botões <b>−</b> e <b>+</b>, ou digite direto. "
        "Ela conta no formato escolhido: em caixa, o <b>+</b> soma uma caixa "
        "inteira.",
        "Se o cliente quer a bebida gelada, toque em <b>gelado</b> embaixo do "
        "item. Vale para a lata avulsa e para a caixa fechada.",
        "Escolha o cliente, se for uma venda para empresa. Se for cliente de "
        "balcão, deixe em <b>Consumidor final</b>. Cliente novo? Toque em "
        "<b>Novo</b>, ao lado de Cliente — ele é cadastrado e já fica escolhido.",
        "Toque na forma de pagamento e depois em <b>Finalizar venda</b>.",
    ]))
    h.append(imagem("04-venda.png",
                    "Em cima, a busca com os dois botões de cada produto. Embaixo, "
                    "três jeitos numa venda só: um engradado de 24 garrafas, que sai "
                    "no atacado com 24 cascos junto; uma caixa de latas gelada; e "
                    "uma Coca avulsa gelada.",
                    alt_max=150 * mm))

    h.append(caixa(
        "Unidade ou caixa: quem escolhe é você",
        "Embaixo de cada item tem <b>Unidade | Caixa c/ 12</b> — ou Fardo, ou "
        "Engradado, conforme a embalagem do produto. Dá para trocar a qualquer "
        "momento. Ao lado aparece o estoque do jeito que se conta no depósito, "
        "como <b>83 cx + 4 un</b>. O botão da caixa só libera quando o estoque "
        "fecha pelo menos uma caixa inteira.",
        tom="bom"))

    h.append(caixa(
        "Caixa e fardo também saem gelados",
        "Na caixa fechada, o gelado soma ao preço de atacado o mesmo acréscimo "
        "por unidade que ele cobra na lata avulsa. Exemplo: a lata custa R$ 4,50 "
        "natural e R$ 5,20 gelada — o gelado cobra R$ 0,70 a mais. A caixa de 12, "
        "que no atacado sai a R$ 3,80 a lata, sai gelada a R$ 4,50 a lata: "
        "R$ 54,00 a caixa. O botão <b>gelado</b> só aparece nos produtos "
        "marcados como <b>Vende gelado</b> no cadastro."))

    h.append(sub("Passo 3 — Entregar o recibo"))
    h.append(p("Se você deixou marcado <b>Emitir recibo ao finalizar</b>, o "
               "sistema já abre o documento pronto. O que foi vendido em caixa "
               "sai como <b>2 CX c/ 12</b>, com o valor da caixa. No alto da tela "
               "tem três jeitos de entregar:"))
    h.append(tabela(
        ["Botão", "O que faz"],
        [
            ["Imprimir ou PDF", "Imprime na impressora da loja, ou salva o "
             "recibo como arquivo PDF."],
            ["WhatsApp", "Abre o WhatsApp com o recibo já escrito na "
             "mensagem. Se o cliente tem telefone no cadastro, abre direto na "
             "conversa dele; se não, você escolhe o contato."],
            ["Compartilhar", "Aparece no celular. Manda o recibo pelo "
             "aplicativo que você escolher."],
        ],
        [34 * mm, CW - 34 * mm]))
    h.append(imagem("05-recibo.png",
                    "Recibo com CNPJ da empresa e do cliente, descrição, "
                    "quantidade, valores e o total por extenso."))
    h.append(caixa(
        "O WhatsApp leva o texto, não o arquivo",
        "A mensagem vai com os itens, o total e a forma de pagamento — dá para "
        "o cliente conferir na hora. Se ele precisar do PDF, toque em "
        "<b>Imprimir ou PDF</b>, salve o arquivo e anexe na conversa."))

    h.append(sub("Passo 4 — Fechar o caixa no fim do dia"))
    h.append(passos([
        "Toque em <b>Caixa</b> no menu.",
        "Conte o dinheiro da gaveta <b>antes</b> de olhar a tela.",
        "Digite o valor contado e toque em <b>Fechar caixa</b>.",
        "O sistema mostra a diferença entre o que esperava e o que você contou.",
    ]))
    h.append(imagem("10-caixa.png",
                    "Tela do caixa: o esperado na gaveta, o que foi faturado, "
                    "sangrias e despesas do dia."))

    h.append(caixa(
        "Por que o faturado é maior que o esperado na gaveta",
        "PIX, cartão de débito e de crédito entram no faturamento, mas o "
        "dinheiro não cai na gaveta — vem pela maquininha ou pela conta. Só "
        "dinheiro vivo entra na conferência do fechamento. Venda fiada não "
        "entra em nenhum dos dois: ela vira lucro hoje e vira caixa só no dia "
        "em que o cliente pagar."))

    h.append(sub("Sangria e despesa"))
    h.append(p("<b>Sangria</b> é quando você tira dinheiro da gaveta e leva "
               "para o cofre. <b>Despesa</b> é quando paga alguma coisa com o "
               "dinheiro do caixa — combustível da entrega, almoço, frete. "
               "Registre as duas na hora, senão o caixa não fecha no fim do dia."))

    # ============================================================ 03
    h.append(secao(3, "Quando chega mercadoria",
                   "Lançar a carga do fornecedor e entender o que acontece com o custo."))

    h.append(p("Toda vez que chega mercadoria, lance a carga. É esse "
               "lançamento que faz o sistema saber quanto você pagou — e, "
               "portanto, quanto está ganhando em cada venda."))
    h.append(passos([
        "Toque em <b>Entradas</b> e depois em <b>Nova entrada</b>.",
        "Escolha o fornecedor e digite o número da nota que veio com a carga.",
        "Busque cada produto e toque em <b>+ cx</b> (ou <b>fd</b>, <b>eng</b>) "
        "se chegou em embalagem fechada, ou em <b>+ un</b> se chegou avulso.",
        "Digite <b>quantas</b> chegaram e <b>quanto custou cada uma</b> — "
        "caixa ou unidade, conforme o que você escolheu. Dá para trocar depois, "
        "no próprio item: o sistema converte a quantidade e o custo.",
        "Confira o total e toque em <b>Lançar entrada</b>.",
    ]))
    h.append(imagem("07-entrada.png",
                    "Uma carga com 10 fardos de Coca-Cola e 6 garrafas avulsas de "
                    "whisky. O sistema converte tudo para unidade e mostra o custo "
                    "médio antes e depois."))

    h.append(sub("Chegou um produto ou um fornecedor que não está cadastrado?"))
    h.append(p("Não precisa sair da tela. Digite o nome do produto na busca: "
               "quando o sistema não encontra, aparece o botão <b>Cadastrar "
               "produto novo</b>. O cadastro abre ao lado, e o produto já entra "
               "na carga que você está lançando. Fornecedor novo é igual: toque "
               "no <b>+</b> ao lado do campo do fornecedor."))
    h.append(p("Quando o produto é cadastrado por aqui, o formulário não "
               "pergunta quanto tem no depósito: a quantidade e o custo vêm da "
               "própria carga."))

    h.append(caixa(
        "Você digita em caixa ou em unidade, o sistema guarda em unidade",
        "Isso é o que permite vender uma lata avulsa no balcão e a caixa "
        "fechada no atacado sem o estoque se perder. Na coluna <b>Vira</b> "
        "você vê a conversão acontecendo: 10 fardos de 6 viram 60 unidades."))

    h.append(sub("O custo médio, explicado sem enrolação"))
    h.append(p("Imagine que você tinha 100 latas compradas a R$ 3,20 e chegam "
               "mais 60 latas, agora a R$ 3,50. Qual é o custo da lata que você "
               "vai vender amanhã? Não é nem um nem outro: é a <b>média</b> "
               "entre os dois, considerando as quantidades. Nesse exemplo, "
               "R$ 3,31."))
    h.append(Spacer(1, 4))
    h.append(p("O sistema faz essa conta sozinho, toda vez que entra "
               "mercadoria. Na tela de entrada, o quadro da direita mostra o "
               "custo <b>antes</b> e <b>depois</b> da carga que você está "
               "lançando — em vermelho quando subiu."))

    h.append(caixa(
        "Só a entrada de mercadoria muda o custo",
        "Venda, ajuste de contagem e devolução mexem na quantidade, nunca no "
        "custo. E o custo do dia da venda fica gravado dentro dela para "
        "sempre: se o fornecedor aumentar o preço no mês que vem, o lucro das "
        "vendas de hoje continua o mesmo. É isso que faz o relatório de lucro "
        "ser confiável.",
        tom="bom"))

    # ============================================================ 04
    h.append(secao(4, "Cadastrar um produto novo",
                   "Pelo Estoque ou por Produtos — os dois botões abrem o mesmo cadastro."))

    esquerda = [
        p("Em <b>Estoque</b> ou em <b>Produtos</b>, toque em <b>Novo "
          "produto</b>. O cadastro tem quatro partes:"),
        Spacer(1, 8),
        passos_estreitos([
            "<b>Identificação</b> — o nome, a categoria e, se tiver, o código "
            "de barras. Com o código, o leitor da loja adiciona o item na venda.",
            "<b>Como você compra</b> — a embalagem (caixa, fardo, engradado) e "
            "quantas unidades vêm nela. Se for garrafa de vidro que volta, "
            "escolha o casco.",
            "<b>Preços de venda</b> — varejo, atacado e a partir de quantas "
            "unidades vale o atacado. Se o produto vai para a geladeira, marque "
            "<b>Vende gelado</b> e digite o preço gelado: o sistema já mostra "
            "quanto sai a caixa gelada. A margem aparece embaixo de cada preço.",
            "<b>Estoque</b> — o mínimo, abaixo do qual o produto aparece "
            "para repor, e se você já tem esse produto no depósito.",
        ], COL),
        Spacer(1, 10),
        p("Toque em <b>Cadastrar produto</b>. Se faltar alguma coisa, o "
          "campo fica marcado em vermelho, com a explicação embaixo."),
        Spacer(1, 10),
        caixa_estreita(
            "Quem cadastra",
            "A dona e o estoquista. Mas <b>só a dona define preço</b>: quando o "
            "estoquista cadastra, o produto fica marcado <b>SEM PREÇO</b> e não "
            "aparece para vender até a dona preencher.", COL),
    ]
    h.append(lado_a_lado(esquerda, "16-novo-produto.png",
                         legenda="O cadastro completo de um produto."))

    h.append(sub("Produto que ainda não tem no depósito"))
    h.append(p("É comum cadastrar um produto antes de ele chegar — um item "
               "novo que você vai começar a vender, por exemplo. No fim do "
               "cadastro, o sistema pergunta <b>Já tem esse produto no "
               "depósito?</b>"))
    h.append(tabela(
        ["Resposta", "O que acontece"],
        [
            ["Ainda não", "O produto fica cadastrado com saldo zero e aparece com "
             "a etiqueta <b>AGUARDA 1ª ENTRADA</b>. Quando a mercadoria chegar, "
             "lance em Entradas → Nova entrada: é essa entrada que dá o saldo e "
             "o custo."],
            ["Sim, já tenho", "Informe quantas caixas tem e quanto pagou em cada "
             "uma. O sistema mostra quantas unidades entram e a que custo, e o "
             "produto já nasce com saldo."],
        ],
        [30 * mm, CW - 30 * mm]))
    h.append(caixa(
        "Por que não dá para informar só o custo",
        "O custo do produto nasce do que você realmente pagou por uma "
        "mercadoria que está no depósito. Sem a quantidade, não há o que "
        "custar — e um custo sem mercadoria acabaria virando chute. Por isso, "
        "se você marcar <b>Sim, já tenho</b>, o sistema pede as duas coisas "
        "juntas. Se ainda não tem, marque <b>Ainda não</b> e o custo vem na "
        "primeira carga.",
        tom="atencao"))

    h.append(sub("As etiquetas que aparecem no produto"))
    h.append(p("Nas listas de Estoque e de Produtos, algumas etiquetas avisam "
               "que falta alguma coisa. Nenhuma delas é erro do sistema — cada "
               "uma diz o que fazer:"))
    h.append(tabela(
        ["Etiqueta", "O que quer dizer", "O que fazer"],
        [
            ["AGUARDA 1ª ENTRADA", "Cadastrado, mas ainda não chegou "
             "mercadoria.", "Nada, por enquanto. Lance a entrada quando a "
             "carga chegar."],
            ["SEM PREÇO", "Ninguém definiu o preço de venda. O produto não "
             "aparece na venda.", "A dona define em Produtos → Editar produto "
             "e preços."],
            ["SEM CUSTO", "Tem saldo, mas não tem custo. O lucro das vendas "
             "dele aparece maior do que é.", "Lance uma entrada desse produto."],
            ["REPOR", "O saldo chegou no mínimo que você definiu.",
             "Hora de comprar. Produto com mínimo zero nunca pede reposição."],
        ],
        [36 * mm, (CW - 36 * mm) * 0.52, (CW - 36 * mm) * 0.48]))

    # ============================================================ 05
    h.append(secao(5, "Conferir o estoque",
                   "Quanto tem, o que está acabando e o que aconteceu com cada produto."))

    h.append(p("A tela de <b>Estoque</b> mostra tudo o que você tem, ordenado "
               "pelo que está mais perto de acabar. Os produtos marcados em "
               "vermelho com a etiqueta <b>REPOR</b> chegaram no mínimo que "
               "você definiu. No alto ficam os botões <b>Novo produto</b>, para "
               "um item que ainda não existe no sistema, e <b>Dar entrada</b>, "
               "para registrar a mercadoria que chegou."))
    h.append(imagem("08-estoque.png",
                    "Estoque: saldo em unidade e em caixa, o mínimo de cada produto, "
                    "e o valor total parado em mercadoria."))

    h.append(sub("Ver o que aconteceu com um produto"))
    h.append(p("Toque em qualquer produto para abrir o <b>extrato</b>. Ele "
               "mostra cada entrada e cada saída, com data, hora, quem fez e "
               "quanto sobrou depois. Nada é apagado: se um número parecer "
               "errado, o extrato mostra de onde ele veio."))
    h.append(Spacer(1, 4))
    h.append(p("Nas saídas, você vê a data e a hora da venda e pode tocar para "
               "abrir o recibo. Nas entradas, pode tocar para ver todos os "
               "produtos que vieram naquela carga."))

    h.append(sub("Ajustar depois de contar a prateleira"))
    h.append(passos([
        "Abra o produto pelo <b>Estoque</b>.",
        "Toque em <b>Ajustar saldo</b>.",
        "Digite quanto você contou de verdade e escreva o motivo.",
        "Toque em <b>Gravar</b>.",
    ]))
    h.append(p("O ajuste não apaga nada: grava um lançamento novo com a "
               "diferença, o motivo e o seu nome."))

    h.append(caixa(
        "Vasilhame: os cascos que estão na rua",
        "Quando você vende cerveja em garrafa retornável, o casco vai junto "
        "com o cliente. O sistema conta isso sozinho: no painel e no estoque "
        "aparece <b>quantos cascos estão na rua</b>. Quando o cliente devolve, "
        "o número baixa. É dinheiro seu que está fora — e agora dá para saber "
        "quanto.",
        tom="casco"))

    # ============================================================ 06
    h.append(secao(6, "Preços: varejo, atacado e gelado",
                   "Como o sistema escolhe o preço sem você precisar lembrar."))

    h.append(p("Cada produto tem até três preços de venda: <b>varejo</b>, para "
               "quem leva pouco; <b>atacado</b>, para quem leva caixa fechada; "
               "e <b>gelado</b>, para a bebida que sai da geladeira — ele cobre "
               "a energia que a geladeira gasta. O sistema decide qual usar "
               "seguindo estas regras, nesta ordem:"))
    h.append(tabela(
        ["", "Situação", "Preço que entra"],
        [
            ["1ª", "O cliente está cadastrado como cliente de atacado",
             "Atacado, em qualquer quantidade"],
            ["2ª", "A quantidade chegou no mínimo que você definiu para o produto "
             "— uma caixa fechada, por exemplo", "Atacado"],
            ["—", "Nenhuma das duas", "Varejo"],
        ],
        [12 * mm, CW - 12 * mm - 45 * mm, 45 * mm]))
    h.append(p("Se você tocou em <b>gelado</b> no item, o preço ganha o gelado — "
               "na lata avulsa e na caixa fechada:"))
    h.append(tabela(
        ["Venda gelada", "Como sai o preço", "Exemplo (lata 350 ml)"],
        [
            ["Varejo — avulsa", "O preço gelado do cadastro", "R$ 5,20 a lata"],
            ["Atacado — caixa ou fardo", "O atacado mais o acréscimo do gelado "
             "(gelado − varejo, por unidade)", "R$ 3,80 + R$ 0,70 = R$ 4,50 a lata, "
             "R$ 54,00 a caixa"],
        ],
        [40 * mm, CW - 40 * mm - 52 * mm, 52 * mm]))
    h.append(p("Na tela de venda, a etiqueta ao lado do produto mostra qual "
               "preço entrou e por quê — por exemplo, <i>a partir de 24 un</i> "
               "ou <i>gelado</i>."))

    h.append(sub("Mudar um preço"))
    h.append(passos([
        "Toque em <b>Produtos</b> no menu.",
        "Toque no produto para abrir os detalhes e depois em <b>Editar produto "
        "e preços</b>.",
        "Digite o preço novo. A margem aparece na hora, embaixo do campo.",
        "Toque em <b>Salvar</b>.",
    ]))
    h.append(imagem("09-produtos.png",
                    "Produtos: varejo, atacado e gelado lado a lado, e a margem. "
                    "Toque num produto para ver custo e markup."))

    h.append(caixa(
        "O preço gelado não sobe sozinho",
        "Ele é um preço fixo, que você digita. Então, quando aumentar o "
        "varejo, lembre de aumentar o gelado junto — a caixa gelada vem dele. "
        "Se o gelado ficar igual ou mais barato que o natural, o cadastro avisa "
        "na hora, e a lista de produtos mostra um alerta ao lado dele.",
        tom="atencao"))

    h.append(caixa(
        "Margem e markup não são a mesma coisa",
        "<b>Margem</b> é quanto do preço de venda é lucro. <b>Markup</b> é "
        "quanto você acrescentou por cima do custo. Um produto que custa R$ 10 "
        "e vende por R$ 20 tem margem de 50% e markup de 100%. O sistema "
        "mostra os dois para não haver dúvida."))

    # ============================================================ 07
    h.append(secao(7, "Clientes e fornecedores",
                   "Cadastro, busca na Receita e histórico de compras."))

    h.append(p("Cadastrar o cliente serve para três coisas: sair o CNPJ dele "
               "no recibo, o sistema já saber que ele compra no atacado, e "
               "você conseguir ver quanto cada um compra. Toque num cliente "
               "para abrir o cadastro completo e as últimas compras dele."))
    h.append(imagem("13-clientes.png",
                    "Clientes ordenados por quanto compraram. A coluna Fiado aberto "
                    "mostra quem ainda não pagou."))

    esquerda = [
        passos_estreitos([
            "Em <b>Clientes</b>, toque em <b>Novo cliente</b>.",
            "Escolha <b>Empresa (CNPJ)</b> ou <b>Pessoa física (CPF)</b>.",
            "Para empresa, digite o CNPJ e toque em <b>Buscar</b>: razão "
            "social, endereço e telefone vêm preenchidos da Receita.",
            "Confira, complete o que faltar e toque em <b>Salvar</b>.",
        ], COL),
        Spacer(1, 10),
        p("O sistema confere se o número foi digitado certo e avisa se o "
          "cliente já está cadastrado — assim ninguém fica duplicado."),
        Spacer(1, 6),
        p("<b>Tabela de preço</b> (varejo ou atacado) e <b>limite de "
          "fiado</b> só a dona define."),
        Spacer(1, 10),
        caixa_estreita(
            "E o CPF?",
            "CPF é dado pessoal: o sistema só confere se o número é válido e "
            "nunca consulta fora. A busca na Receita é só para CNPJ.", COL),
    ]
    h.append(lado_a_lado(esquerda, aparar("18-novo-cliente.png"),
                         legenda="Cadastro de cliente."))

    h.append(sub("Fornecedores"))
    h.append(p("Funciona do mesmo jeito: <b>Fornecedores → Novo fornecedor</b>, "
               "com a mesma busca pelo CNPJ, que é obrigatório. Toque num "
               "fornecedor para ver todas as cargas que vieram dele."))

    h.append(caixa(
        "Nada é apagado, só desativado",
        "Cliente que parou de comprar ou fornecedor que você não usa mais "
        "saem da lista com o botão <b>Desativar</b>, dentro do cadastro. As "
        "vendas e as cargas antigas continuam mostrando o nome certo, e "
        "<b>Reativar</b> traz de volta quando precisar."))

    # ============================================================ 08
    h.append(secao(8, "Cancelar uma venda",
                   "Para quando uma venda foi registrada errada ou o cliente desistiu."))

    esquerda = [
        p("Só a dona cancela venda."),
        Spacer(1, 8),
        passos_estreitos([
            "Em <b>Vendas</b>, toque na venda e depois em <b>Ver recibo</b>.",
            "Toque em <b>Cancelar venda</b>, no alto da tela.",
            "Leia o quadro <b>O que vai acontecer</b>: ele mostra quanto volta "
            "para o estoque e para o caixa.",
            "Escreva o motivo — é obrigatório — e toque em <b>Confirmar "
            "cancelamento</b>.",
        ], COL),
        Spacer(1, 10),
        p("A venda continua na lista, marcada como <b>CANCELADA</b>, com o "
          "motivo, o dia e quem cancelou."),
    ]
    h.append(lado_a_lado(esquerda, aparar("17-cancelar.png"),
                         legenda="O quadro mostra tudo antes de confirmar."))

    h.append(tabela(
        ["O que muda", "Como fica"],
        [
            ["Estoque", "As unidades voltam, pelo mesmo custo. Se saíram cascos, "
             "eles saem da conta dos cascos na rua."],
            ["Venda em dinheiro", "O valor sai do caixa aberto como estorno. "
             "Devolva o dinheiro ao cliente da gaveta."],
            ["PIX ou cartão", "O valor sai do faturamento. A devolução ao "
             "cliente é pela maquininha ou pelo banco."],
            ["Venda fiada", "A dívida do cliente some. Não mexe no caixa."],
            ["Relatórios", "A venda sai do faturamento, do lucro e dos "
             "relatórios."],
        ],
        [36 * mm, CW - 36 * mm]))
    h.append(caixa(
        "Precisa de caixa aberto",
        "O estorno sai do caixa do dia. Se o caixa estiver fechado, o sistema "
        "avisa antes de você confirmar — abra o caixa primeiro para a conta "
        "da gaveta fechar certo.",
        tom="atencao"))

    # ============================================================ 09
    h.append(secao(9, "Relatórios",
                   "Onde você descobre o que dá dinheiro e o que não dá."))

    h.append(p("Escolha o período no alto da tela — 7, 30 ou 60 dias. Todos os "
               "números se ajustam."))
    h.append(imagem("11-relatorios.png",
                    "Relatórios: receita, custo, lucro e ticket médio, mais a "
                    "divisão entre atacado e varejo."))

    h.append(sub("Atacado ou varejo: qual compensa"))
    h.append(p("O quadro <b>Atacado × Varejo</b> responde uma pergunta que "
               "quase ninguém consegue responder de cabeça. O atacado costuma "
               "girar muito mais volume, com margem menor. O varejo vende "
               "menos, mas cada venda rende mais. Ver os dois lado a lado "
               "mostra se vale a pena empurrar caixa fechada ou vender no balcão."))

    h.append(sub("A geladeira se paga?"))
    h.append(p("O quadro <b>Gelado</b> mostra quantas unidades saíram geladas — "
               "avulsas e em caixa ou fardo — e quanto o gelado rendeu <b>a "
               "mais</b> do que se tivessem saído pelo preço natural. Digite quanto veio de luz da geladeira no "
               "mesmo período e o sistema responde se ela se paga. Esse valor "
               "da luz não é gravado — serve só para comparar."))
    h.append(imagem("19-gelado.png",
                    "No período, o gelado rendeu R$ 1.065,60 a mais, somando as "
                    "latas avulsas e as caixas geladas. Com R$ 600 de luz, a "
                    "geladeira se paga e sobram R$ 465,60.",
                    alt_max=60 * mm))

    h.append(sub("Curva ABC"))
    h.append(p("Na lista de produtos, a coluna <b>ABC</b> separa o que "
               "realmente importa. Os produtos <b>A</b> são os que fazem 80% "
               "do seu faturamento — normalmente poucos itens. São eles que "
               "nunca podem faltar na prateleira. Os <b>C</b> são a cauda: "
               "vendem pouco e ocupam espaço."))

    h.append(sub("Os três formatos de arquivo"))
    h.append(tabela(
        ["Botão", "Serve para", "Como fica"],
        [
            ["PDF", "Mandar por WhatsApp, imprimir, anexar em e-mail",
             "Documento fechado, com seu CNPJ no cabeçalho. Ninguém edita."],
            ["Excel", "Você mexer, filtrar e somar do seu jeito",
             "Planilha formatada, com moeda em real e filtro pronto."],
            ["CSV", "Mandar para o contador ou para outro sistema ler",
             "Arquivo simples, sem formatação. É assim mesmo."],
        ],
        [20 * mm, 58 * mm, CW - 78 * mm]))

    # ============================================================ 10
    h.append(secao(10, "Quem vê o quê",
                   "Três perfis, para cada um enxergar só o que precisa."))

    h.append(tabela(
        ["Perfil", "Pode fazer", "Não vê / não faz"],
        [
            ["Dona<br/>(admin)", "Tudo: vender, comprar, cadastrar, definir "
             "preço, cancelar venda, ver relatórios.", "—"],
            ["Caixa", "Vender, abrir e fechar o caixa, cadastrar cliente.",
             "<b>Custo, margem e lucro</b> não aparecem em lugar nenhum. Não "
             "muda tabela de preço nem limite de fiado do cliente."],
            ["Estoque", "Lançar entrada de mercadoria, conferir e ajustar "
             "estoque, cadastrar produto e fornecedor, ver custo.",
             "Lucro e margem. Não vende e não define preço."],
        ],
        [24 * mm, (CW - 24 * mm) * 0.48, (CW - 24 * mm) * 0.52]))

    h.append(imagem("14-painel-caixa.png",
                    "O mesmo painel visto pelo operador de caixa: no lugar do lucro "
                    "aparece o faturamento, e o menu não tem Relatórios.",
                    alt_max=80 * mm))

    h.append(caixa(
        "Isso não é desconfiança, é organização",
        "Deixar o custo à vista de todo mundo costuma gerar conversa de "
        "corredor e propostas de desconto que não fecham a conta. Separar o "
        "que cada um precisa ver deixa o operador focado em vender e evita "
        "constrangimento."))

    # ============================================================ 11
    h.append(secao(11, "Começando do zero",
                   "Como colocar os seus dados no sistema pela primeira vez."))

    h.append(p("Um sistema de estoque vazio não serve para nada. Antes de "
               "registrar a primeira venda, é preciso cadastrar os produtos, "
               "contar o que existe no depósito e informar quanto cada coisa "
               "custou. São três passos, <b>e a ordem importa</b>."))

    h.append(sub("Passo 1 — Lançar as notas de compra"))
    h.append(p("Junte as notas dos fornecedores dos últimos 30 a 60 dias e "
               "lance cada uma como entrada normal (seção 3). Produto que ainda "
               "não existe no sistema, você cadastra ali mesmo, na hora de "
               "lançar a nota. Assim cada produto já nasce com o <b>custo "
               "verdadeiro</b>, vindo do que você realmente pagou."))

    h.append(sub("Passo 2 — Contar o depósito"))
    h.append(passos([
        "Toque em <b>Carga inicial</b> no menu.",
        "Toque em <b>Imprimir lista de contagem</b> e leve o papel para o depósito.",
        "Conte prateleira por prateleira e anote.",
        "Volte ao sistema e digite o que contou na coluna <b>Contado</b>.",
        "Confira as diferenças que aparecem e toque em <b>Gravar</b>.",
    ]))
    h.append(imagem("12-carga-inicial.png",
                    "Lista de contagem. Digite o que contou e o sistema mostra a "
                    "diferença antes de gravar qualquer coisa."))

    h.append(sub("Passo 3 — Definir os preços"))
    h.append(p("Com o custo certo na mão, ajuste os preços de varejo, atacado "
               "e gelado vendo a margem calcular na tela (seção 6). É a chance "
               "de descobrir se algum produto está sendo vendido no prejuízo."))

    h.append(caixa(
        "Por que não contar primeiro",
        "Parece mais fácil contar tudo e digitar os saldos. O problema é que "
        "aí o custo de cada produto vira chute — e chute no custo contamina "
        "todo relatório de lucro para sempre. Começando pelas notas, a "
        "contagem só precisa acertar a quantidade, que é a parte fácil de "
        "corrigir depois.",
        tom="atencao"))

    # ============================================================ 12
    titulo12 = secao(12, "Usando no celular",
                     "Todas as telas funcionam no telefone.")

    linha = Table(
        [[
            [p("O sistema se ajusta sozinho ao tamanho da tela. No celular, "
               "cada venda vira um cartão que você toca para abrir e ver os "
               "itens e as quantidades. Os cadastros ocupam a tela inteira."),
             Spacer(1, 8),
             p("Isso é especialmente útil em duas situações: <b>conferir o "
               "movimento</b> quando você não está na loja, e <b>contar o "
               "depósito</b> com o telefone na mão, digitando direto na tela "
               "de carga inicial em vez de anotar no papel e passar a limpo "
               "depois."),
             Spacer(1, 8),
             p("Para abrir o menu no celular, toque nas três linhas no canto "
               "superior direito.")],
            Image(os.path.join(SHOTS, "15-celular.png"),
                  width=52 * mm, height=52 * mm * 2532 / 1170),
        ]],
        colWidths=[CW - 60 * mm, 60 * mm])
    linha.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 10),
        ("LEFTPADDING", (1, 0), (1, 0), 0),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    h.append(KeepTogether([titulo12, linha]))

    # ============================================================ 13
    h.append(secao(13, "Perguntas frequentes"))

    faq = [
        ("Errei uma venda. Como corrijo?",
         "A dona cancela a venda (seção 8) e você registra de novo, do jeito "
         "certo. O estoque e o caixa voltam sozinhos. A venda errada não some: "
         "fica na lista marcada como cancelada, com o motivo — é isso que "
         "mantém o histórico confiável."),
        ("Dá para vender uma caixa ou um fardo gelado?",
         "Dá. Escolha <b>Caixa</b> no item (ou toque em <b>+ 1 cx</b> na busca) e "
         "toque em <b>gelado</b>. Sai pelo atacado mais o acréscimo do gelado em "
         "cada unidade (seção 6)."),
        ("Chegaram garrafas avulsas, não uma caixa fechada. Como lanço?",
         "Na entrada, toque em <b>+ un</b> na busca, ou troque o item para "
         "<b>Unidade</b>. Aí a quantidade e o custo são por garrafa."),
        ("Cadastrei um produto e ele aparece como “aguarda 1ª entrada”. Fiz algo errado?",
         "Não. Quer dizer só que o produto ainda não recebeu mercadoria. "
         "Quando a carga chegar, lance em Entradas → Nova entrada e a "
         "etiqueta some sozinha (seção 4)."),
        ("O sistema não deixa salvar o produto só com o custo. Por quê?",
         "Porque o custo vem de uma mercadoria que você tem. Se ainda não tem "
         "o produto, marque <b>Ainda não</b> em “Já tem esse produto no "
         "depósito?”. Se já tem, informe a quantidade junto com o custo."),
        ("O estoquista cadastrou um produto e ele não aparece na venda.",
         "Falta o preço, que só a dona define. Em <b>Produtos</b>, o item "
         "aparece com a etiqueta <b>SEM PREÇO</b>: toque nele e em <b>Editar "
         "produto e preços</b>."),
        ("Mandei o recibo pelo WhatsApp e foi só texto.",
         "É assim mesmo: o WhatsApp leva o recibo escrito na mensagem. Para "
         "mandar o arquivo, toque em <b>Imprimir ou PDF</b>, salve e anexe na "
         "conversa."),
        ("Vendi mais do que tinha no estoque. E agora?",
         "O saldo fica negativo e aparece em vermelho. Isso quase sempre "
         "significa que faltou lançar alguma carga. Confira as entradas do "
         "período e, se for o caso, faça um ajuste pelo estoque."),
        ("O caixa fechou com diferença. É problema?",
         "Diferença de alguns centavos é normal, de troco. Diferença grande "
         "costuma ser uma sangria ou despesa que ninguém registrou. O extrato "
         "da sessão mostra tudo o que passou pela gaveta naquele dia."),
        ("Posso usar em mais de um computador ao mesmo tempo?",
         "Nesta versão de demonstração, não: cada aparelho guarda os dados "
         "dele. Na versão definitiva, com banco de dados, todos veem a mesma "
         "informação ao mesmo tempo."),
        ("Vendi fiado. Onde vejo quem me deve?",
         "Na tela de <b>Clientes</b>, na coluna <b>Fiado aberto</b>. O "
         "controle completo de contas a receber, com baixa de pagamento, entra "
         "numa etapa seguinte."),
        ("O recibo serve como nota fiscal?",
         "Não. Ele comprova a venda entre você e o cliente, com CNPJ e "
         "valores, mas não é documento fiscal. A emissão de NF-e depende de "
         "certificado digital e é uma etapa própria do projeto."),
    ]
    for pergunta, resposta in faq:
        h.append(KeepTogether([
            Paragraph(pergunta, st_box_t),
            Spacer(1, 3),
            Paragraph(resposta, st_corpo),
            Spacer(1, 12),
        ]))

    # ============================================================ fim
    h.append(Spacer(1, 10))
    h.append(HRFlowable(width="100%", thickness=1.2, color=MARCA, spaceAfter=10))
    h.append(Paragraph("Sobre esta versão", st_sub))
    h.append(Spacer(1, 4))
    h.append(p("O que você viu neste manual é uma <b>demonstração</b>. Ela "
               "funciona de verdade — dá para vender, lançar carga, cadastrar, "
               "fechar caixa e emitir recibo — mas os dados ficam guardados só "
               "no navegador do aparelho onde você está usando, e a empresa, os "
               "clientes e os fornecedores das telas são inventados."))
    h.append(Spacer(1, 6))
    h.append(p("A versão definitiva tem banco de dados, senha por pessoa, "
               "backup automático e os mesmos dados em todos os aparelhos. "
               "O jeito de usar continua exatamente este."))

    return h


# ---------------------------------------------------------------- pagina
def fundo_capa(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(ESCURA)
    canvas.rect(0, 0, PW, PH, stroke=0, fill=1)
    canvas.setStrokeColor(colors.Color(1, 1, 1, 0.14))
    canvas.setLineWidth(0.8)
    canvas.line(ML, PH - 46 * mm, PW - MR, PH - 46 * mm)
    canvas.restoreState()


def rodape(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(ML, MB - 6, PW - MR, MB - 6)
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(ML, MB - 15, "Manual de uso · Sistema de estoque, vendas e caixa")
    canvas.drawRightString(PW - MR, MB - 15, "Página %d" % (doc.page - 1))
    canvas.restoreState()


def main(saida):
    doc = BaseDocTemplate(
        saida, pagesize=A4,
        leftMargin=ML, rightMargin=MR, topMargin=MT, bottomMargin=MB,
        title="Manual de uso — sistema de estoque, vendas e caixa",
        author="Distribuidora", subject="Guia passo a passo do sistema",
    )
    quadro = Frame(ML, MB, CW, PH - MT - MB, id="corpo",
                   leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="capa", frames=[quadro], onPage=fundo_capa),
        PageTemplate(id="miolo", frames=[quadro], onPage=rodape),
    ])
    doc.build(montar())
    print("PDF gerado:", saida)


if __name__ == "__main__":
    import sys
    main(sys.argv[1])
