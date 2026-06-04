BASE = "/api/inspeccion-recepcion"


def test_guardar_repaso(client, auth_headers, inspeccion_db):
    payload = {
        "checklist": {"exterior": True, "interior": False},
        "notas": "Todo revisado",
        "marcar_listo": False,
    }
    resp = client.post(f"{BASE}/{inspeccion_db}/repaso", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["repaso_notas"] == "Todo revisado"
    assert data["repaso_completado"] is False


def test_marcar_repaso_completado(client, auth_headers, inspeccion_db):
    payload = {
        "checklist": {"exterior": True, "interior": True},
        "notas": "Repaso listo",
        "marcar_listo": True,
    }
    resp = client.post(f"{BASE}/{inspeccion_db}/repaso", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["repaso_completado"] is True
    assert data["repaso_completado_por_nombre"] is not None
