"""Utilitários para NF-e: download via SEFAZ (certificado A1) ou consultadanfe.com."""
import os
import sys
import base64
import gzip
import tempfile
from pathlib import Path
import streamlit as st

PASTA_NF = Path(__file__).parent.parent.parent / "scripts" / "NF-es"
API_PDF  = "https://consultadanfe.com/api/v1/danfe"
API_CONS = "https://consultadanfe.com/api/v1/consulta"


def pasta_nf() -> Path:
    PASTA_NF.mkdir(exist_ok=True)
    return PASTA_NF


def pdf_local(controle: str) -> Path | None:
    p = pasta_nf() / f"{controle.upper()}.pdf"
    return p if p.exists() else None


def xml_local(controle: str) -> Path | None:
    p = pasta_nf() / f"{controle.upper()}.xml"
    return p if p.exists() else None


def parse_chave(chave: str) -> dict:
    ch = chave.replace(" ", "").replace(".", "")
    if len(ch) != 44 or not ch.isdigit():
        return {}
    meses = ["","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
    uf_map = {
        11:"RO",12:"AC",13:"AM",14:"RR",15:"PA",16:"AP",17:"TO",
        21:"MA",22:"PI",23:"CE",24:"RN",25:"PB",26:"PE",27:"AL",28:"SE",29:"BA",
        31:"MG",32:"ES",33:"RJ",35:"SP",41:"PR",42:"SC",43:"RS",
        50:"MS",51:"MT",52:"GO",53:"DF",
    }
    uf_code  = int(ch[:2])
    mes_num  = int(ch[4:6])
    cnpj_raw = ch[6:20]
    cnpj_fmt = f"{cnpj_raw[:2]}.{cnpj_raw[2:5]}.{cnpj_raw[5:8]}/{cnpj_raw[8:12]}-{cnpj_raw[12:]}"
    numero   = int(ch[25:34])
    modelo   = ch[20:22]
    return {
        "uf":      uf_map.get(uf_code, f"?{uf_code}"),
        "emissao": f"{meses[mes_num]}/20{ch[2:4]}",
        "cnpj":    cnpj_fmt,
        "modelo":  "NF-e" if modelo == "55" else "NFC-e" if modelo == "65" else f"mod{modelo}",
        "serie":   ch[22:25],
        "numero":  f"{int(ch[25:34]):,}".replace(",", "."),
    }


def _xml_para_pdf(xml_bytes: bytes, destino: Path) -> bool:
    try:
        import requests
        with tempfile.NamedTemporaryFile(suffix=".xml", delete=False) as tmp:
            tmp.write(xml_bytes)
            tmp_path = tmp.name
        with open(tmp_path, "rb") as f:
            r = requests.post(API_PDF, files={"xml": ("nfe.xml", f, "text/xml")}, timeout=30)
        os.unlink(tmp_path)
        if not r.ok:
            return False
        pdf_b64 = r.json().get("pdf_base64", "")
        if not pdf_b64:
            return False
        destino.write_bytes(base64.b64decode(pdf_b64))
        return True
    except Exception as ex:
        st.warning(f"Falha ao gerar PDF: {ex}")
        return False


def baixar_via_api_livre(chave: str, controle: str) -> tuple[bool, str]:
    """
    Tenta baixar via consultadanfe.com (sem certificado).
    Funciona apenas para NF-es do mês atual / mês anterior.
    Retorna (sucesso, mensagem).
    """
    try:
        import requests
        r = requests.post(API_CONS, json={"chave": chave},
                          headers={"Content-Type": "application/json"}, timeout=30)
        if r.status_code == 400:
            data = r.json()
            if data.get("error") == "data_fora_da_janela":
                return False, (
                    f"NF de {data.get('data_emissao','?')} está fora da janela gratuita "
                    f"({data.get('janela_atual','mês atual')}). "
                    "Use o certificado A1 para baixar."
                )
            return False, f"Erro da API: {data}"
        if not r.ok:
            return False, f"HTTP {r.status_code}: {r.text[:200]}"

        data    = r.json()
        ctrl    = controle.upper()
        pasta   = pasta_nf()

        xml_b64 = data.get("xml_base64", "")
        if xml_b64:
            (pasta / f"{ctrl}.xml").write_bytes(base64.b64decode(xml_b64))

        pdf_b64 = data.get("pdf_base64", "")
        if pdf_b64:
            (pasta / f"{ctrl}.pdf").write_bytes(base64.b64decode(pdf_b64))
            return True, f"PDF salvo em NF-es/{ctrl}.pdf"

        # Tem XML mas não PDF — gera PDF a partir do XML
        xml_bytes = base64.b64decode(xml_b64) if xml_b64 else None
        if xml_bytes:
            ok = _xml_para_pdf(xml_bytes, pasta / f"{ctrl}.pdf")
            return ok, ("PDF gerado a partir do XML." if ok else "XML salvo, falha ao gerar PDF.")

        return False, "Resposta sem PDF nem XML."
    except Exception as ex:
        return False, f"Erro: {ex}"


def baixar_via_certificado(chave: str, controle: str) -> tuple[bool, str]:
    """
    Baixa via SEFAZ com certificado A1.
    Chama baixar_nfe_sefaz.py como subprocesso.
    """
    import subprocess
    script = Path(__file__).parent.parent.parent / "scripts" / "baixar_nfe_sefaz.py"
    if not script.exists():
        return False, "Script baixar_nfe_sefaz.py não encontrado."

    resultado = subprocess.run(
        [sys.executable, str(script), "--chave", chave, "--arquivar", controle],
        capture_output=True, text=True, timeout=60,
    )
    saiu_ok = resultado.returncode == 0
    saida   = resultado.stdout + resultado.stderr
    return saiu_ok, saida.strip()
