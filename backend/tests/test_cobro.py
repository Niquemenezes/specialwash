BASE = "/api/inspeccion-recepcion"


def test_registrar_cobro_particular(client, auth_headers, inspeccion_db):
    payload = {
        "accion": "abono",
        "importe": 10.0,
        "metodo": "efectivo",
    }
    resp = client.post(f"{BASE}/{inspeccion_db}/cobro", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["cobro"]["importe_pagado"] == 10.0


def test_registrar_cobro_importe_invalido(client, auth_headers, inspeccion_db):
    payload = {
        "accion": "abono",
        "importe": -10.0,
        "metodo": "efectivo",
    }
    resp = client.post(f"{BASE}/{inspeccion_db}/cobro", json=payload, headers=auth_headers)
    assert resp.status_code == 400
    assert "negativo" in resp.get_json()["msg"].lower()
