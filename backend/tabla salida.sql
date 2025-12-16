CREATE TABLE salida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    producto_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    precio_total REAL NOT NULL,
    observaciones TEXT,
    FOREIGN KEY (producto_id) REFERENCES producto(id),
    FOREIGN KEY (usuario_id) REFERENCES user(id)
);
