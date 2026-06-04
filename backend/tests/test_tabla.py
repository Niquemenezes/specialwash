from datetime import datetime

BASE = "/api/tabla-registros"


def test_get_tabla_mes_actual(client, auth_headers):
    resp = client.get(BASE, headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)


def test_patch_tabla_precio(client, auth_headers, inspeccion_db):
    payload = {"precio": 75.0}
    resp = client.patch(f"{BASE}/{inspeccion_db}", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["precio"] == 75.0


def test_patch_tabla_estado(client, auth_headers, inspeccion_db):
    payload = {"estado": "En proceso"}
    resp = client.patch(f"{BASE}/{inspeccion_db}", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["estado"] == "En proceso"
