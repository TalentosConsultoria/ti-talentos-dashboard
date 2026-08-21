"""
Gera PDF da ficha de equipamento — identificação, histórico de usuários,
peças trocadas e custo total acumulado.

Uso:
  python gerar_relatorio.py --controle TAL0045
  python gerar_relatorio.py --controle TAL0045 --saida relatorio_TAL0045.pdf

Requer: pip install reportlab supabase
"""
import os
import sys
import argparse
from datetime import date, datetime
from pathlib import Path
from supabase import create_client

# Pasta de NF-es arquivadas (relativa a este script)
PASTA_NF = Path(__file__).parent / "NF-es"

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm, cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )
    from reportlab.platypus.flowables import KeepTogether
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
except ImportError:
    print("ERRO: instale o reportlab: pip install reportlab")
    sys.exit(1)

# ── Paleta ────────────────────────────────────────────────────────────────────
NAVY      = colors.HexColor("#0C1E35")
NAVY_MID  = colors.HexColor("#163354")
BLUE      = colors.HexColor("#2171B5")
BLUE_LIGHT= colors.HexColor("#6BAED6")
BG_PAGE   = colors.HexColor("#F4F7FB")
BG_CARD   = colors.HexColor("#FFFFFF")
BG_ROW    = colors.HexColor("#EEF3F9")
BORDER    = colors.HexColor("#D0DCE9")
TEXT      = colors.HexColor("#1A2B3C")
TEXT_MUT  = colors.HexColor("#566A7F")
RED       = colors.HexColor("#C0392B")
GREEN     = colors.HexColor("#1D7A4A")
AMBER     = colors.HexColor("#916200")
BG_GREEN  = colors.HexColor("#D1F5E6")
BG_AMBER  = colors.HexColor("#FEF3CC")
BG_RED    = colors.HexColor("#FCEAE8")

W, H = A4   # 595.27 x 841.89 pt

# ── Supabase ──────────────────────────────────────────────────────────────────
def get_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("ERRO: SUPABASE_URL ou SUPABASE_KEY não configurados.")
        sys.exit(1)
    return create_client(url, key)


def query_equipamento(sb, controle):
    r = sb.table("equipamentos").select("*").eq("controle", controle.upper()).execute()
    if not r.data:
        print(f"ERRO: equipamento {controle.upper()} não encontrado.")
        sys.exit(1)
    return r.data[0]


def query_historico_uso(sb, equip_id):
    r = sb.table("historico_uso").select("*") \
        .eq("equipamento_id", equip_id).order("data_transferencia").execute()
    return r.data


def query_pecas(sb, equip_id):
    try:
        r = sb.table("historico_pecas").select("*") \
            .eq("equipamento_id", equip_id).order("data").execute()
        return r.data
    except Exception:
        return []   # tabela pode não existir ainda


# ── Helpers ───────────────────────────────────────────────────────────────────
def fmt_date(val):
    if not val:
        return "—"
    try:
        d = date.fromisoformat(str(val)[:10])
        return d.strftime("%d/%m/%Y")
    except Exception:
        return str(val)


def fmt_brl(val):
    if val is None:
        return "—"
    try:
        return f"R$ {float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return str(val)


def dias_garantia(termino_str):
    if not termino_str:
        return None
    try:
        d = date.fromisoformat(str(termino_str)[:10])
        return (d - date.today()).days
    except Exception:
        return None


def garantia_label(termino_str):
    dias = dias_garantia(termino_str)
    if dias is None:
        return "—", None
    if dias < 0:
        return f"{fmt_date(termino_str)} (vencida há {abs(dias)} dias)", RED
    if dias <= 90:
        return f"{fmt_date(termino_str)} (vence em {dias} dias)", AMBER
    return f"{fmt_date(termino_str)} (vence em {dias} dias)", GREEN


def tempo_uso(data_compra_str, data_baixa_str=None):
    if not data_compra_str:
        return "—"
    try:
        inicio = date.fromisoformat(str(data_compra_str)[:10])
        if data_baixa_str:
            fim = date.fromisoformat(str(data_baixa_str)[:10])
            ref_label = f"até {fim.strftime('%d/%m/%Y')} — data de baixa"
        else:
            fim = date.today()
            ref_label = f"até {fim.strftime('%d/%m/%Y')} — data deste relatório"
        total_dias = (fim - inicio).days
        anos = total_dias // 365
        meses = (total_dias % 365) // 30
        partes = []
        if anos:
            partes.append(f"{anos} ano{'s' if anos > 1 else ''}")
        if meses:
            partes.append(f"{meses} mês" if meses == 1 else f"{meses} meses")
        duracao = " e ".join(partes) if partes else "menos de 1 mês"
        return f"{duracao} ({ref_label})"
    except Exception:
        return "—"


# ── Estilos ───────────────────────────────────────────────────────────────────
def make_styles():
    s = {
        "label": ParagraphStyle("label",
            fontName="Helvetica-Bold", fontSize=7, textColor=TEXT_MUT,
            leading=9, spaceAfter=1),
        "value": ParagraphStyle("value",
            fontName="Helvetica", fontSize=10, textColor=TEXT,
            leading=13, spaceAfter=0),
        "value_bold": ParagraphStyle("value_bold",
            fontName="Helvetica-Bold", fontSize=10, textColor=TEXT,
            leading=13, spaceAfter=0),
        "mono": ParagraphStyle("mono",
            fontName="Courier", fontSize=10, textColor=TEXT,
            leading=13, spaceAfter=0),
        "th": ParagraphStyle("th",
            fontName="Helvetica-Bold", fontSize=7.5, textColor=TEXT_MUT,
            leading=9),
        "td": ParagraphStyle("td",
            fontName="Helvetica", fontSize=9, textColor=TEXT,
            leading=11),
        "td_muted": ParagraphStyle("td_muted",
            fontName="Helvetica-Oblique", fontSize=9, textColor=TEXT_MUT,
            leading=11),
        "td_r": ParagraphStyle("td_r",
            fontName="Helvetica", fontSize=9, textColor=TEXT,
            leading=11, alignment=TA_RIGHT),
        "section_title": ParagraphStyle("section_title",
            fontName="Helvetica-Bold", fontSize=8, textColor=BLUE,
            leading=10, spaceBefore=4, spaceAfter=6),
        "footer": ParagraphStyle("footer",
            fontName="Helvetica", fontSize=8, textColor=TEXT_MUT,
            leading=10, alignment=TA_CENTER),
        "cost_label": ParagraphStyle("cost_label",
            fontName="Helvetica-Bold", fontSize=7, textColor=TEXT_MUT,
            leading=9, spaceAfter=2),
        "cost_value": ParagraphStyle("cost_value",
            fontName="Helvetica-Bold", fontSize=14, textColor=TEXT,
            leading=16),
        "cost_blue": ParagraphStyle("cost_blue",
            fontName="Helvetica-Bold", fontSize=14, textColor=BLUE,
            leading=16),
        "cost_amber": ParagraphStyle("cost_amber",
            fontName="Helvetica-Bold", fontSize=14, textColor=AMBER,
            leading=16),
    }
    return s


# ── Construtores de seção ──────────────────────────────────────────────────────
def section_header(title, styles):
    return [
        Paragraph(title.upper(), styles["section_title"]),
        HRFlowable(width="100%", thickness=1.5, color=BLUE, spaceAfter=6),
    ]


def field_grid(fields, styles, cols=3):
    """fields = [(label, value, is_mono), ...]"""
    rows_per_col = -(-len(fields) // cols)  # ceil
    grid_data = []
    for i in range(rows_per_col):
        row = []
        for c in range(cols):
            idx = i + c * rows_per_col
            if idx < len(fields):
                lbl, val, mono = fields[idx]
                cell = [
                    Paragraph(lbl, styles["label"]),
                    Paragraph(str(val) if val else "—",
                              styles["mono"] if mono else styles["value"]),
                ]
            else:
                cell = [Paragraph("", styles["label"])]
            row.append(cell)
        grid_data.append(row)

    col_w = (W - 2*cm - 4*cm/cols) / cols  # roughly equal width
    full_w = W - 2*cm
    col_widths = [full_w / cols] * cols

    t = Table(grid_data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    return [t]


def hist_table(headers, rows, col_widths, styles, right_cols=None):
    right_cols = right_cols or []
    head_row = [Paragraph(h, styles["th"]) for h in headers]
    data = [head_row]
    for row in rows:
        data.append([
            Paragraph(str(c) if c else "—",
                      styles["td_r"] if i in right_cols else styles["td"])
            for i, c in enumerate(row)
        ])

    t = Table(data, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    style = [
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        # header
        ("BACKGROUND",   (0, 0), (-1, 0), BG_ROW),
        ("LINEBELOW",    (0, 0), (-1, 0), 0.5, BORDER),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 7.5),
        ("TEXTCOLOR",    (0, 0), (-1, 0), TEXT_MUT),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), BG_ROW))
        style.append(("LINEBELOW", (0, i), (-1, i), 0.3, BORDER))
    t.setStyle(TableStyle(style))
    return t


def cost_cards(costs, styles):
    """costs = [(label, value_str, style_key), ...]"""
    cards = []
    for lbl, val, sk in costs:
        cards.append([
            Paragraph(lbl, styles["cost_label"]),
            Paragraph(val, styles[sk]),
        ])

    n = len(cards)
    full_w = W - 2*cm
    card_w = full_w / n - 4
    row = [[c] for c in cards]  # wrap each card

    t = Table([cards], colWidths=[card_w] * n, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("BACKGROUND",   (0, 0), (-1, -1), BG_ROW),
        ("LINEAFTER",    (0, 0), (-2, -1), 0.5, BORDER),
        ("BOX",          (0, 0), (-1, -1), 0.5, BORDER),
        ("ROUNDEDCORNERS", [4]),
    ]))
    return t


# ── Header e footer de página ─────────────────────────────────────────────────
def on_page(canvas, doc, e, styles):
    canvas.saveState()
    margin = 1*cm

    # Header navbar
    canvas.setFillColor(NAVY)
    canvas.roundRect(margin, H - margin - 52, W - 2*margin, 52, 6, fill=1, stroke=0)

    # Company name
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(BLUE_LIGHT)
    canvas.drawString(margin + 12, H - margin - 16, "TALENTOS CONSULTORIA — SETOR DE TI")

    # Report title
    canvas.setFont("Helvetica-Bold", 15)
    canvas.setFillColor(colors.white)
    canvas.drawString(margin + 12, H - margin - 36, "Ficha do Equipamento")

    # TAL badge
    tal = e.get("controle", "")
    badge_w = 90
    badge_x = W - margin - badge_w - 8
    badge_y = H - margin - 44
    canvas.setFillColor(BLUE)
    canvas.roundRect(badge_x, badge_y, badge_w, 28, 4, fill=1, stroke=0)
    canvas.setFont("Courier-Bold", 16)
    canvas.setFillColor(colors.white)
    canvas.drawCentredString(badge_x + badge_w / 2, badge_y + 8, tal)

    # Status strip
    strip_y = H - margin - 52 - 20
    canvas.setFillColor(NAVY_MID)
    canvas.rect(margin, strip_y, W - 2*margin, 20, fill=1, stroke=0)

    status = e.get("status") or "—"
    obs = e.get("obsoleto", False)
    strip_items = [f"Status: {status}"]

    _datas_gar = [e.get("termino_garantia"), e.get("garantia_fornecedor_ate"), e.get("garantia_extendida_ate")]
    _gar_ef = max((d for d in _datas_gar if d), default=None)
    dias = dias_garantia(_gar_ef)
    if dias is not None:
        if dias < 0:
            strip_items.append(f"Garantia: vencida há {abs(dias)} dias")
        elif dias <= 90:
            strip_items.append(f"Garantia: vence em {dias} dias")
        else:
            strip_items.append(f"Garantia: OK ({dias} dias)")
    if obs:
        strip_items.append("OBSOLETO — baixado do inventário")

    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(BLUE_LIGHT)
    x = margin + 10
    for item in strip_items:
        canvas.drawString(x, strip_y + 6, item)
        x += canvas.stringWidth(item, "Helvetica", 7.5) + 24

    # Footer
    canvas.setFillColor(BORDER)
    canvas.rect(margin, margin, W - 2*margin, 0.5, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(TEXT_MUT)
    now = datetime.now().strftime("%d/%m/%Y às %H:%M")
    canvas.drawString(margin, margin - 10,
                      f"Relatório gerado em {now} · Talentos Consultoria — TI")
    canvas.drawRightString(W - margin, margin - 10,
                           f"Página {doc.page}")

    canvas.restoreState()


# ── PDF principal ─────────────────────────────────────────────────────────────
def gerar_pdf(controle, saida):
    sb = get_client()
    e = query_equipamento(sb, controle)
    equip_id = e["id"]
    hist_uso  = query_historico_uso(sb, equip_id)
    hist_peca = query_pecas(sb, equip_id)

    styles = make_styles()
    full_w = W - 2*cm

    doc = SimpleDocTemplate(
        saida,
        pagesize=A4,
        leftMargin=1*cm, rightMargin=1*cm,
        topMargin=1*cm + 82, bottomMargin=1*cm + 16,
    )

    story = []

    # ── Identificação ──
    story += section_header("Identificação", styles)
    story += field_grid([
        ("Tipo",            e.get("tipo"),            False),
        ("Marca",           e.get("marca"),           False),
        ("Modelo",          e.get("modelo"),          False),
        ("Serial",          e.get("serial"),          True),
        ("Nome dispositivo",e.get("nome_dispositivo"),True),
        ("Status",          e.get("status"),          False),
    ], styles, cols=3)

    story.append(Spacer(1, 10))

    # ── Localização atual ──
    story += section_header("Localização atual", styles)
    story += field_grid([
        ("Local / Unidade", e.get("local"),   False),
        ("Setor",           e.get("setor"),   False),
        ("Usuário",         e.get("usuario"), False),
        ("Função",          e.get("funcao"),  False),
    ], styles, cols=4)

    story.append(Spacer(1, 10))

    # ── Especificações técnicas ──
    story += section_header("Especificações técnicas", styles)
    story += field_grid([
        ("Processador",     e.get("processador"),      False),
        ("Memória RAM",     e.get("memoria"),          False),
        ("Armazenamento",   e.get("disco"),            False),
        ("Sistema op.",     e.get("so"),               False),
        ("Office",          e.get("office"),           False),
        ("Lic. Windows",    e.get("tipo_lic_windows"), False),
        ("Lic. Office",     e.get("tipo_lic_office"),  False),
    ], styles, cols=4)

    story.append(Spacer(1, 10))

    # ── Compra e garantia ──
    story += section_header("Compra e garantia", styles)
    data_baixa = e.get("data_baixa")
    datas_garantia = [
        e.get("termino_garantia"),
        e.get("garantia_fornecedor_ate"),
        e.get("garantia_extendida_ate"),
    ]
    datas_validas = [d for d in datas_garantia if d]
    garantia_efetiva = max(datas_validas) if datas_validas else None

    def gar_row(label, campo):
        val = e.get(campo)
        if not val:
            return (label, None, False)
        lbl_text, color = garantia_label(val)
        eh_efetiva = (val == garantia_efetiva)
        sufixo = "  ← cobertura ativa" if eh_efetiva and len(datas_validas) > 1 else ""
        if color:
            r2, g2, b2 = int(color.red*255), int(color.green*255), int(color.blue*255)
            full_text = '<font color="#{:02X}{:02X}{:02X}">{}</font>{}'.format(r2, g2, b2, lbl_text, sufixo)
        else:
            full_text = lbl_text + sufixo
        return (label, full_text, False)

    story += field_grid([
        ("Data de compra",            fmt_date(e.get("data_compra")),  False),
        ("Fabricante original",        e.get("marca"),                  False),
        ("Fornecedor (emissor da NF)", e.get("fornecedor"),             False),
        ("N.º Nota Fiscal",            e.get("nf"),                     True),
        gar_row("Garantia original (fabricante)", "termino_garantia"),
        gar_row("Garantia do fornecedor",         "garantia_fornecedor_ate"),
        gar_row("Garantia estendida",             "garantia_extendida_ate"),
        ("Tempo de uso",       tempo_uso(e.get("data_compra"), data_baixa), False),
        ("Data de baixa",      fmt_date(data_baixa) if data_baixa else None, False),
        ("Motivo de baixa",    e.get("motivo_baixa"),                   False),
    ], styles, cols=3)

    # Chave de acesso NF-e (44 dígitos) — linha própria em largura total
    chave_nf = e.get("chave_nf")
    if chave_nf:
        label_style = ParagraphStyle("chave_label",
            fontName="Helvetica-Bold", fontSize=7, textColor=TEXT_MUT,
            leading=9, spaceBefore=6, spaceAfter=2)
        chave_style = ParagraphStyle("chave_nf",
            fontName="Courier", fontSize=7.5, textColor=TEXT_MUT,
            leading=10, spaceAfter=4)
        btn_style = ParagraphStyle("btn_nf",
            fontName="Helvetica-Bold", fontSize=9, textColor=BLUE,
            leading=12, spaceAfter=0)
        btn_warn_style = ParagraphStyle("btn_nf_warn",
            fontName="Helvetica", fontSize=8, textColor=TEXT_MUT,
            leading=10, spaceAfter=0)

        story.append(Paragraph("CHAVE DE ACESSO NF-e (44 DÍGITOS)", label_style))
        story.append(Paragraph(chave_nf, chave_style))

        # Verifica se o PDF da NF-e foi baixado localmente
        pdf_local = PASTA_NF / f"{controle}.pdf"
        xml_local = PASTA_NF / f"{controle}.xml"
        if pdf_local.exists():
            uri = pdf_local.absolute().as_uri()
            story.append(Paragraph(
                f'<a href="{uri}">▶  Exibir NF-e  ({pdf_local.name})</a>',
                btn_style
            ))
        else:
            # PDF não baixado — instrução para baixar
            cmd = f"python baixar_nfe_sefaz.py --chave {chave_nf} --arquivar {controle}"
            story.append(Paragraph(
                "NF-e não arquivada. Para baixar diretamente do SEFAZ com certificado A1:",
                btn_warn_style
            ))
            story.append(Paragraph(cmd, ParagraphStyle("cmd",
                fontName="Courier", fontSize=7, textColor=TEXT_MUT, leading=9))
            )

    story.append(Spacer(1, 14))

    # ── Histórico de usuários ──
    story += section_header("Histórico de usuários", styles)
    if hist_uso:
        col_w = [full_w * r for r in [0.12, 0.22, 0.22, 0.22, 0.22]]
        rows = [
            [
                fmt_date(h.get("data_transferencia")),
                h.get("usuario_anterior") or "—",
                h.get("usuario_novo") or "—",
                (h.get("local_novo") or "—"),
                h.get("motivo") or "—",
            ]
            for h in hist_uso
        ]
        story.append(hist_table(
            ["Data", "Usuário anterior", "Novo usuário", "Local", "Motivo"],
            rows, col_w, styles
        ))
    else:
        story.append(Paragraph("Nenhuma transferência registrada.", styles["td_muted"]))

    story.append(Spacer(1, 14))

    # ── Histórico de peças ──
    story += section_header("Histórico de peças trocadas", styles)
    total_pecas = 0.0
    if hist_peca:
        # Colunas: Data | Peça | Fabricante | Fornecedor | Técnico | Gar. até | Valor
        col_w = [full_w * r for r in [0.10, 0.16, 0.13, 0.16, 0.10, 0.11, 0.12]]
        # NF/Chave mostrada como sub-linha abaixo de cada peça
        rows = []
        for p in hist_peca:
            val = float(p.get("valor") or 0)
            total_pecas += val
            nf_raw = p.get("nf") or ""
            rows.append([
                fmt_date(p.get("data")),
                p.get("peca") or "—",
                p.get("fabricante") or "—",
                p.get("fornecedor") or "—",
                p.get("tecnico") or "—",
                fmt_date(p.get("garantia_peca_ate")) if p.get("garantia_peca_ate") else "—",
                fmt_brl(val),
            ])
            # Sub-linha de detalhe: descrição + NF
            det_parts = []
            if p.get("descricao"):
                det_parts.append(p["descricao"])
            if nf_raw:
                chave_display = f"NF/Chave: {nf_raw}" if len(nf_raw) <= 20 \
                    else f"Chave NF-e: {nf_raw[:22]}…{nf_raw[-6:]}"
                det_parts.append(chave_display)
            if det_parts:
                det_style = ParagraphStyle("det",
                    fontName="Courier", fontSize=7, textColor=TEXT_MUT, leading=9)
                det_cell = Paragraph("  └ " + "  ·  ".join(det_parts), det_style)
                rows.append([det_cell, "", "", "", "", "", ""])

        story.append(hist_table(
            ["Data", "Peça", "Fabricante", "Fornecedor", "Técnico", "Gar. até", "Valor"],
            rows, col_w, styles, right_cols=[6]
        ))
    else:
        story.append(Paragraph("Nenhuma peça registrada.", styles["td_muted"]))

    story.append(Spacer(1, 10))

    # Cards de custo
    costs = [
        ("Total investido em peças", fmt_brl(total_pecas),
         "cost_amber" if total_pecas > 0 else "cost_value"),
    ]
    if total_pecas > 0:
        costs = [
            ("Total em peças",        fmt_brl(total_pecas),  "cost_amber"),
            ("Custo acumulado total", "—",                    "cost_blue"),
        ]
    story.append(cost_cards(costs, styles))

    # Gera PDF
    doc.build(
        story,
        onFirstPage=lambda c, d: on_page(c, d, e, styles),
        onLaterPages=lambda c, d: on_page(c, d, e, styles),
    )
    print(f"\nPDF gerado: {saida}")


def main():
    parser = argparse.ArgumentParser(description="Gera ficha PDF de equipamento")
    parser.add_argument("--controle", required=True, help="Código TAL (ex: TAL0045)")
    parser.add_argument("--saida",    default=None,  help="Nome do arquivo de saída (padrão: ficha_TAL####.pdf)")
    args = parser.parse_args()

    controle = args.controle.upper()
    saida = args.saida or f"ficha_{controle}.pdf"
    gerar_pdf(controle, saida)


if __name__ == "__main__":
    main()
