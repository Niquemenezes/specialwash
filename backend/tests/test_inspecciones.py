import json


BASE = "/api/inspeccion-recepcion"

_PAYLOAD_BASE = {
    "cliente_nombre": "Test Cliente",
    "cliente_telefono": "666111222",
    "coche_descripcion": "Toyota Corolla",
    "matricula": "TSTCR1",
    "kilometros": 10000,
    "firma_cliente_recepcion": "data:image/png;base64,dGVzdA==",
    "consentimiento_datos_recepcion": True,
    "servicios_aplicados": [{"nombre": "Lavado exterior", "precio": 20, "tipo_tarea": "detailing"}],
}


def test_crear_inspeccion_exitoso(client, auth_headers):
    resp = client.post(BASE, json=_PAYLOAD_BASE, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["matricula"] == "TSTCR1"
    assert data["cliente_nombre"] == "Test Cliente"


def test_crear_inspeccion_sin_servicios(client, auth_headers):
    payload = {**_PAYLOAD_BASE, "matricula": "TSTNO1", "servicios_aplicados": []}
    resp = client.post(BASE, json=payload, headers=auth_headers)
    assert resp.status_code == 400
    assert "servicio" in resp.get_json()["msg"].lower()


def test_crear_inspeccion_sin_firma_particular(client, auth_headers):
    payload = {
        "cliente_nombre": "Sin Firma",
        "cliente_telefono": "666333444",
        "coche_descripcion": "Ford Focus",
        "matricula": "TSTF3",
        "kilometros": 8000,
        "es_concesionario": False,
        "consentimiento_datos_recepcion": True,
        "servicios_aplicados": [{"nombre": "Lavado", "precio": 15, "tipo_tarea": "detailing"}],
    }
    resp = client.post(BASE, json=payload, headers=auth_headers)
    assert resp.status_code == 400
    assert "firma" in resp.get_json()["msg"].lower()


def test_listar_inspecciones(client, auth_headers):
    resp = client.get(BASE, headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)


def test_obtener_inspeccion_por_id(client, auth_headers, inspeccion_api):
    resp = client.get(f"{BASE}/{inspeccion_api}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == inspeccion_api


def test_actualizar_inspeccion(client, auth_headers, inspeccion_api):
    payload = {"kilometros": 99999}
    resp = client.put(f"{BASE}/{inspeccion_api}", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["kilometros"] == 99999


def test_eliminar_inspeccion(client, auth_headers, inspeccion_api):
    resp = client.delete(f"{BASE}/{inspeccion_api}", headers=auth_headers)
    assert resp.status_code == 200
    # Verificar que ya no existe
    resp2 = client.get(f"{BASE}/{inspeccion_api}", headers=auth_headers)
    assert resp2.status_code == 404
