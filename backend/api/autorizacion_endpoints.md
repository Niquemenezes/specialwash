# Endpoints de Autorización para Inspecciones
# Agregar estos a inspeccion_routes.py en la sección de permisos

# ============ OTORGAR PERMISOS A EMPLEADO (SOLO ADMIN) ============
# POST /api/autorizacion-inspeccion
# {
#   "empleado_id": 5,
#   "ver_datos_cliente": true,
#   "descargar_media": true,
#   "dias_validos": 30
# }
@inspeccion_bp.route("/autorizacion-inspeccion", methods=["POST"])
@role_required("administrador")
def otorgar_autorizacion():
    admin_id = get_jwt_identity()
    data = request.get_json()
    
    empleado_id = data.get("empleado_id")
    empleado = User.query.get(empleado_id)
    
    if not empleado or empleado.rol != "empleado":
        return jsonify({"msg": "Empleado no encontrado"}), 404
    
    try:
        # Verificar si ya existe autorización
        autoriza = AutorizacionInspeccion.query.filter(
            AutorizacionInspeccion.empleado_id == empleado_id,
            AutorizacionInspeccion.admin_id == admin_id
        ).first()
        
        if autoriza:
            # Actualizar
            autoriza.ver_datos_cliente = data.get("ver_datos_cliente", False)
            autoriza.descargar_media = data.get("descargar_media", False)
            dias = data.get("dias_validos", 30)
            autoriza.fecha_expiracion = datetime.utcnow() + timedelta(days=dias)
        else:
            # Crear nueva
            dias = data.get("dias_validos", 30)
            autoriza = AutorizacionInspeccion(
                empleado_id=empleado_id,
                admin_id=admin_id,
                ver_datos_cliente=data.get("ver_datos_cliente", False),
                descargar_media=data.get("descargar_media", False),
                fecha_expiracion=datetime.utcnow() + timedelta(days=dias)
            )
            db.session.add(autoriza)
        
        db.session.commit()
        return jsonify(autoriza.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500


# ============ REVOCAR PERMISOS (SOLO ADMIN) ============
# DELETE /api/autorizacion-inspeccion/<id>
@inspeccion_bp.route("/autorizacion-inspeccion/<int:auth_id>", methods=["DELETE"])
@role_required("administrador")
def revocar_autorizacion(auth_id):
    autoriza = AutorizacionInspeccion.query.get(auth_id)
    
    if not autoriza:
        return jsonify({"msg": "Autorización no encontrada"}), 404
    
    try:
        db.session.delete(autoriza)
        db.session.commit()
        return jsonify({"msg": "Permisos revocados"}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500


# ============ VER AUTORIZACIONES DE UN EMPLEADO (SOLO ADMIN) ============
# GET /api/autorizacion-inspeccion?empleado_id=5
@inspeccion_bp.route("/autorizacion-inspeccion", methods=["GET"])
@role_required("administrador")
def listar_autorizaciones():
    empleado_id = request.args.get("empleado_id")
    
    query = AutorizacionInspeccion.query
    
    if empleado_id:
        query = query.filter(AutorizacionInspeccion.empleado_id == int(empleado_id))
    
    autorizaciones = query.all()
    
    return jsonify([a.to_dict() for a in autorizaciones]), 200


# ============ VER MIS PERMISOS (EMPLEADO) ============
# GET /api/mis-autorizaciones
@inspeccion_bp.route("/mis-autorizaciones", methods=["GET"])
@jwt_required()
def mis_autorizaciones():
    empleado_id = get_jwt_identity()
    
    autorizaciones = AutorizacionInspeccion.query.filter(
        AutorizacionInspeccion.empleado_id == empleado_id,
        AutorizacionInspeccion.fecha_expiracion > datetime.utcnow()
    ).all()
    
    return jsonify([a.to_dict() for a in autorizaciones]), 200
