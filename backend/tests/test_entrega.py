BASE = "/api/inspeccion-recepcion"


def test_completar_entrega_sin_repaso(client, auth_headers, inspeccion_db):
    payload = {
        "trabajos_realizados": "Lavado completo",
        "firma_cliente_entrega": "data:image/png;base64,dGVzdA==",
        "consentimiento_datos_entrega": True,
    }
    resp = client.post(f"{BASE}/{inspeccion_db}/entrega", json=payload, headers=auth_headers)
    assert resp.status_code == 400
    assert "repaso" in resp.get_json()["msg"].lower()


def test_completar_entrega_concesionario(client, auth_headers, inspeccion_concesionario_repasada):
    payload = {
        "trabajos_realizados": "Lavado completo concesionario",
    }
    resp = client.post(
        f"{BASE}/{inspeccion_concesionario_repasada}/entrega",
        json=payload,
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["entregado"] is True


def test_revertir_entrega(client, auth_headers, inspeccion_entregada):
    resp = client.post(
        f"{BASE}/{inspeccion_entregada}/revertir-entrega",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["entregado"] is False
    assert data["fecha_entrega"] is None
