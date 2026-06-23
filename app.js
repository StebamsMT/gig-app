const firebaseConfig = {
    apiKey: "AIzaSyDHVypKJbxgOPYOKvgCJQhRv--P0TBHumk",
    authDomain: "mi-app-gig.firebaseapp.com",
    projectId: "mi-app-gig",
    storageBucket: "mi-app-gig.firebasestorage.app",
    messagingSenderId: "599952455124",
    appId: "1:599952455124:web:1a05984365acc3bc6b9241"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const ADMIN_USER = "admin";       
const ADMIN_PASS = "12345";      
const TASA_CAMBIO_FIJA = 612.43;

const ESTADOS_VENEZUELA = [
    "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", 
    "Carabobo", "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", 
    "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", 
    "Sucre", "Táchira", "Trujillo", "La Guaira", "Yaracuy", "Zulia"
];

let usuarioIdActual = "";
let usuarioNombreActual = "";
let usuarioUsernameActual = "";
let usuarioRolActual = "";
let usuarioTelefonoActual = "";
let usuarioEstadoActual = "";

let itemSeleccionadoData = null;
let transaccionIdActivaChat = "";

let desvincularCatalogo = null;
let desvincularChat = null;
let desvincularListaChatsPerfil = null;

let historialVentanas = [];

document.addEventListener("DOMContentLoaded", () => {
    const selectores = document.querySelectorAll('.select-estados-ven');
    selectores.forEach(select => {
        select.innerHTML = `<option value="" disabled selected>Selecciona un Estado...</option>`;
        ESTADOS_VENEZUELA.forEach(estado => {
            const opt = document.createElement('option');
            opt.value = estado;
            opt.innerText = estado;
            select.appendChild(opt);
        });
    });
});

function mostrarNotificacionInApp(mensaje, esExito = false) {
    const banner = document.getElementById('banner-notificacion');
    banner.innerText = mensaje;
    banner.style.display = "block";
    banner.className = esExito ? "notificacion-sistema exito" : "notificacion-sistema";
    setTimeout(() => { banner.style.display = "none"; }, 4000);
}

function irAVentana(idVentana) {
    const ventanas = [
        'ventana-inicio', 'ventana-login-usuario', 'ventana-seleccion-rol', 
        'ventana-login-admin', 'ventana-panel-admin', 'ventana-form-cliente', 
        'ventana-form-vendedor', 'ventana-perfil', 'ventana-pago', 'ventana-chat-sala'
    ];
    
    let pantallaActual = "";
    ventanas.forEach(v => {
        const el = document.getElementById(v);
        if (el && !el.classList.contains('hidden')) pantallaActual = v;
    });

    if (pantallaActual && pantallaActual !== idVentana) {
        if (historialVentanas[historialVentanas.length - 1] !== pantallaActual) {
            historialVentanas.push(pantallaActual);
        }
    }

    ventanas.forEach(v => {
        const el = document.getElementById(v);
        if(el) el.classList.add('hidden');
    });
    
    const ventanaDestino = document.getElementById(idVentana);
    if(ventanaDestino) ventanaDestino.classList.remove('hidden');

    if (idVentana === 'ventana-panel-admin') escucharTransaccionesAdmin();
}

function navegarAtras() {
    if (historialVentanas.length > 0) {
        const ventanaAnterior = historialVentanas.pop();
        irAVentana(ventanaAnterior);
    } else {
        irAVentana('ventana-inicio');
    }
}

function eliminarTodaLaBaseDeDatos() {
    const colecciones = ["usuarios", "servicios_ofertados", "transacciones"];
    let completados = 0;
    colecciones.forEach(col => {
        db.collection(col).get().then(snapshot => {
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            batch.commit().then(() => {
                completados++;
                if(completados === colecciones.length) {
                    mostrarNotificacionInApp("🔥 Base de datos limpia.", true);
                    irAVentana('ventana-inicio');
                }
            });
        });
    });
}

function autenticarUsuarioExistente(event) {
    event.preventDefault();
    const usernameIn = document.getElementById('log-username').value.trim().toLowerCase();

    db.collection("usuarios").where("username", "==", usernameIn).get()
    .then((snapshot) => {
        if (snapshot.empty) return mostrarNotificacionInApp("❌ Usuario no registrado.");
        snapshot.forEach((doc) => {
            const data = doc.data();
            usuarioIdActual = doc.id;
            usuarioNombreActual = data.nombre;
            usuarioUsernameActual = data.username;
            usuarioRolActual = data.rol;
            usuarioTelefonoActual = data.telefono || "04140000000";
            usuarioEstadoActual = data.estado || "Barinas";
            historialVentanas = [];
            cargarInterfazPerfil(data);
        });
    });
}

function guardarRegistro(event, rol) {
    event.preventDefault();
    const usernameIn = (rol === "Cliente") ? document.getElementById('cli-username').value : document.getElementById('ven-username').value;
    const usernameClean = usernameIn.trim().toLowerCase();

    db.collection("usuarios").where("username", "==", usernameClean).get()
    .then((snapshot) => {
        if (!snapshot.empty) return mostrarNotificacionInApp("❌ Nombre de usuario ocupado.");

        let nuevoUsuario = { username: usernameClean, rol: rol, fecha_registro: firebase.firestore.FieldValue.serverTimestamp() };

        if (rol === "Cliente") {
            nuevoUsuario.nombre = document.getElementById('cli-nombre').value;
            nuevoUsuario.edad = parseInt(document.getElementById('cli-edad').value);
            nuevoUsuario.genero = document.getElementById('cli-genero').value;
            nuevoUsuario.cedula = document.getElementById('cli-cedula').value;
            nuevoUsuario.telefono = document.getElementById('cli-telefono').value;
            nuevoUsuario.estado = document.getElementById('cli-estado').value;
        } else {
            nuevoUsuario.nombre = document.getElementById('ven-nombre').value;
            nuevoUsuario.emprendimiento = document.getElementById('ven-emprendimiento').value;
            nuevoUsuario.edad = parseInt(document.getElementById('ven-edad').value);
            nuevoUsuario.genero = document.getElementById('ven-genero').value;
            nuevoUsuario.cedula = document.getElementById('ven-cedula').value;
            nuevoUsuario.telefono = document.getElementById('ven-telefono').value;
            nuevoUsuario.estado = document.getElementById('ven-estado').value;
        }

        db.collection("usuarios").add(nuevoUsuario).then((docRef) => {
            usuarioIdActual = docRef.id;
            usuarioNombreActual = nuevoUsuario.nombre;
            usuarioUsernameActual = nuevoUsuario.username;
            usuarioRolActual = rol;
            usuarioTelefonoActual = nuevoUsuario.telefono;
            usuarioEstadoActual = nuevoUsuario.estado;
            historialVentanas = [];
            cargarInterfazPerfil(nuevoUsuario);
            mostrarNotificacionInApp("✨ Cuenta configurada.", true);
        });
    });
}

function cargarInterfazPerfil(data) {
    document.getElementById('prof-display-username').innerText = data.username;
    document.getElementById('prof-avatar-inicial').innerText = data.nombre.charAt(0);
    document.getElementById('prof-meta-telefono').innerText = data.telefono || usuarioTelefonoActual;
    document.getElementById('prof-display-badge').innerText = data.rol;
    document.getElementById('prof-meta-extra').innerHTML = `Estado: <span>${data.estado || usuarioEstadoActual}</span>`;

    if (data.rol === "Vendedor") {
        document.getElementById('prof-display-title').innerText = data.emprendimiento || data.nombre;
        document.getElementById('prof-meta-doc').innerHTML = `RIF/Cédula: <span>${data.cedula}</span>`;
        document.getElementById('lbl-ubicacion-dinamica-estado').innerText = `📍 Dirección Física Exacta en Estado ${data.estado || usuarioEstadoActual}:`;
        
        document.getElementById('area-vendedor-publicar').classList.remove('hidden');
        document.getElementById('area-servicios-cliente').classList.add('hidden');
        escucharListaDeChatsEnPerfil('id_vendedor');
    } else {
        document.getElementById('prof-display-title').innerText = data.nombre;
        document.getElementById('prof-meta-doc').innerHTML = `Cédula: <span>${data.cedula}</span>`;
        
        document.getElementById('area-vendedor-publicar').classList.add('hidden');
        document.getElementById('area-servicios-cliente').classList.remove('hidden');
        escucharCatalogoServiciosDinamico();
        escucharListaDeChatsEnPerfil('id_cliente');
    }
    irAVentana('ventana-perfil');
}

function publicarServicioVendedor(event) {
    event.preventDefault();
    db.collection("servicios_ofertados").add({
        id_vendedor: usuarioIdActual,
        username_vendedor: usuarioUsernameActual,
        nombre_vendedor: usuarioNombreActual,
        telefono_vendedor: usuarioTelefonoActual,
        estado_vendedor: usuarioEstadoActual,
        titulo: document.getElementById('srv-titulo').value,
        descripcion: document.getElementById('srv-desc').value,
        precio_usd: parseFloat(document.getElementById('srv-precio').value),
        direccion_exacta: document.getElementById('srv-direccion-exacta').value,
        fecha_publicacion: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        mostrarNotificacionInApp("✅ Publicado con éxito.", true);
        document.getElementById('srv-titulo').value = "";
        document.getElementById('srv-desc').value = "";
        document.getElementById('srv-precio').value = "";
        document.getElementById('srv-direccion-exacta').value = "";
    });
}

function escucharCatalogoServiciosDinamico() {
    if (desvincularCatalogo) desvincularCatalogo();
    const contenedor = document.getElementById('catalogo-dinamico-servicios');

    desvincularCatalogo = db.collection("servicios_ofertados").orderBy("fecha_publicacion", "desc")
    .onSnapshot((snapshot) => {
        contenedor.innerHTML = "";
        if (snapshot.empty) {
            document.getElementById('txt-catalogo-status').innerText = "🚫 Esperando ofertas técnicas.";
            return;
        }
        document.getElementById('txt-catalogo-status').innerText = "Opciones disponibles:";
        snapshot.forEach((doc) => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = "servicio-card";
            card.innerHTML = `
                <h4>🛠️ ${data.titulo}</h4>
                <p style="font-size:12px; color:#65676b; margin:4px 0;">${data.descripcion}</p>
                <span class="servicio-ubicacion">📍 ${data.estado_vendedor || 'Venezuela'} - ${data.direccion_exacta}</span><br>
                <p class="servicio-precio">Precio: $${data.precio_usd.toFixed(2)}</p>
                <button class="btn-contratar-action">💬 Enviar mensaje al vendedor (Contratar)</button>
            `;
            card.onclick = () => abrirPasarelaPago(data);
            contenedor.appendChild(card);
        });
    });
}

function abrirPasarelaPago(dataServicio) {
    itemSeleccionadoData = dataServicio;
    const totalBs = (dataServicio.precio_usd * TASA_CAMBIO_FIJA).toFixed(2);
    document.getElementById('monto-bolivares').innerHTML = `
        <p style="font-size:12px; font-weight:normal; margin-bottom:4px;">${dataServicio.titulo}</p>
        <strong>Monto: Bs. ${totalBs}</strong>
    `;
    irAVentana('ventana-pago');
}

function procesarPagoMovel(event) {
    event.preventDefault();
    const ref = document.getElementById('referencia').value;
    const totalBs = (itemSeleccionadoData.precio_usd * TASA_CAMBIO_FIJA).toFixed(2);

    const nuevaTransaccion = {
        id_cliente: usuarioIdActual,
        nombre_cliente: usuarioNombreActual,
        telefono_cliente: usuarioTelefonoActual,
        id_vendedor: itemSeleccionadoData.id_vendedor,
        nombre_vendedor: itemSeleccionadoData.nombre_vendedor,
        telefono_vendedor: itemSeleccionadoData.telefono_vendedor || "04125555555",
        servicio_contratado: itemSeleccionadoData.titulo,
        direccion_exacta_servicio: itemSeleccionadoData.direccion_exacta,
        estado_servicio: itemSeleccionadoData.estado_vendedor || "Barinas",
        monto_usd: itemSeleccionadoData.precio_usd,
        monto_bs: parseFloat(totalBs),
        referencia_bancaria: ref,
        status: "activo",
        fecha_pago: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("transacciones").add(nuevaTransaccion).then((docRef) => {
        document.getElementById('referencia').value = "";
        mostrarNotificacionInApp("🚀 ¡Pago verificado! Entrando al chat estilo Messenger.", true);
        
        // REDIRECCIÓN DIRECTA AUTOMÁTICA AL CHAT ACCESIBLE EN VIVO
        abrirSalaDeChatExclusiva(docRef.id, nuevaTransaccion);
    });
}

function escucharListaDeChatsEnPerfil(campoFiltro) {
    if(desvincularListaChatsPerfil) desvincularListaChatsPerfil();
    const contenedor = document.getElementById('contenedor-lista-chats');

    desvincularListaChatsPerfil = db.collection("transacciones")
    .where(campoFiltro, "==", usuarioIdActual)
    .onSnapshot(snapshot => {
        contenedor.innerHTML = snapshot.empty ? `<p style="font-size:12px; color:#94a3b8;">No hay conversaciones de Messenger activas.</p>` : "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const itemChat = document.createElement('div');
            itemChat.className = "item-chat-link";
            const contraparte = (usuarioRolActual === "Cliente") ? `Vendedor: ${data.nombre_vendedor}` : `Cliente: ${data.nombre_cliente}`;
            
            itemChat.innerHTML = `
                <div>
                    <strong>⚡ Chat Messenger: ${data.servicio_contratado}</strong><br>
                    <span style="font-size:11px; color:#65676b;">${contraparte}</span>
                </div>
                <span class="badge-chat-status" style="background:#e7f3ff; color:#1877f2;">ABRIR CHAT</span>
            `;
            itemChat.onclick = () => abrirSalaDeChatExclusiva(doc.id, data);
            contenedor.appendChild(itemChat);
        });
    });
}

function abrirSalaDeChatExclusiva(idTransaccion, dataTransaccion) {
    transaccionIdActivaChat = idTransaccion;
    document.getElementById('sala-chat-titulo').innerText = dataTransaccion.servicio_contratado;
    
    const contraparteNombre = (usuarioRolActual === "Cliente") ? dataTransaccion.nombre_vendedor : dataTransaccion.nombre_cliente;
    document.getElementById('sala-chat-subtitulo').innerText = `Platicando con: ${contraparteNombre}`;

    const direccionCodificada = encodeURIComponent(`${dataTransaccion.direccion_exacta_servicio}, ${dataTransaccion.estado_servicio}, Venezuela`);
    const linkGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${direccionCodificada}`;
    
    const telDestino = (usuarioRolActual === "Cliente") ? dataTransaccion.telefono_vendedor : dataTransaccion.telefono_cliente;

    document.getElementById('contenedor-acciones-chat-dinamicas').innerHTML = `
        <a href="${linkGoogleMaps}" target="_blank" class="btn-maps-action">🗺️ Abrir Dirección en Google Maps</a>
        <a href="tel:${telDestino}" class="btn-telefono">📞 Llamar por Teléfono</a>
    `;

    irAVentana('ventana-chat-sala');
    escucharChatTiempoReal(idTransaccion);
}

function escucharChatTiempoReal(idTransaccion) {
    if (desvincularChat) desvincularChat();
    const box = document.getElementById('box-mensajes');

    desvincularChat = db.collection("transacciones").doc(idTransaccion).collection("chat_coordinacion")
    .orderBy("timestamp", "asc")
    .onSnapshot((snapshot) => {
        box.innerHTML = "";
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const esMio = msg.remitente_id === usuarioIdActual;
            
            const row = document.createElement('div');
            row.className = esMio ? "bubble-row bubble-mio" : "bubble-row bubble-otro";
            
            row.innerHTML = `
                <div class="messenger-bubble">
                    <span class="messenger-meta-name">${msg.remitente_nombre}</span>
                    ${msg.texto}
                </div>
            `;
            box.appendChild(row);
        });
        box.scrollTop = box.scrollHeight;
    });
}

function enviarMensajeChat(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input-texto');
    const textoMsg = input.value.trim();
    if (!textoMsg || !transaccionIdActivaChat) return;

    db.collection("transacciones").doc(transaccionIdActivaChat).collection("chat_coordinacion").add({
        remitente_id: usuarioIdActual,
        remitente_nombre: usuarioNombreActual,
        texto: textoMsg,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => { input.value = ""; });
}

function verificarLoginAdmin(event) {
    event.preventDefault();
    if (document.getElementById('adm-user').value === ADMIN_USER && document.getElementById('adm-pass').value === ADMIN_PASS) {
        irAVentana('ventana-panel-admin');
    } else { mostrarNotificacionInApp("❌ Acceso Denegado."); }
}

function escucharTransaccionesAdmin() {
    const contenedor = document.getElementById('lista-ordenes-admin');
    db.collection("transacciones").orderBy("fecha_pago", "desc").onSnapshot((snapshot) => {
        contenedor.innerHTML = snapshot.empty ? `<p style="font-size:13px; color:#64748b; padding:15px;">No hay transacciones.</p>` : "";
        snapshot.forEach((doc) => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = "item-transaccion";
            card.innerHTML = `
                <button class="btn-eliminar-admin" onclick="db.collection('transacciones').doc('${doc.id}').delete()">🗑️ Eliminar</button>
                <p><strong>Servicio:</strong> ${data.servicio_contratado}</p>
                <p><strong>Cliente:</strong> ${data.nombre_cliente} | <strong>Vendedor:</strong> ${data.nombre_vendedor}</p>
                <p><strong>Monto:</strong> Bs. ${data.monto_bs} (Ref: ${data.referencia_bancaria})</p>
            `;
            contenedor.appendChild(card);
        });
    });
}