function subirArchivo(fileName, archivoBase64, folderId) {
  try {
    const base64Limpio = archivoBase64.includes(',')
      ? archivoBase64.split(',')[1]
      : archivoBase64;

    const bytes = Utilities.base64Decode(base64Limpio);
    const blob = Utilities.newBlob(
      bytes,
      'application/octet-stream',
      fileName
    );

    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);

    Logger.log('Archivo subido exitosamente: ' + file.getUrl());
    return file.getUrl();

  } catch (error) {
    Logger.log('Error al subir archivo: ' + error.message);
    throw error;
  }
}


/**
 * Script para guardar datos en Google Sheets
 * ID de la hoja: 
 * Hoja: Registros
 */
const SPREADSHEET_ID = '1fnqmB9S_ltOMcHq2yjN1vhSrt32-o5S5amqwagcus54';
const SHEET_NAME = 'Respuestas';
const FOLDER_ID = '1MFRgfm46MhN9z-WaXcGkAklE0lTOpCHF';//ficha postulante
const FOLDER_ID_FICHA_DIS = '1_SbbF-U39od8tYw1Ng1Zmcf4qfbUtHl9';
const FOLDER_ID_ACTA_COMPROMISO = '1sx1tBO9I1C7xAnHmOKwQG8g2HrX6npId';

/**
 * Guarda el estado de un envío en el cache
 */
function guardarEstadoEnvio(idEnvio, estado, mensaje) {
  const cache = CacheService.getScriptCache();
  const datos = {
    status: estado,
    message: mensaje,
    timestamp: new Date().getTime()
  };
  // Guardar por 10 minutos (600 segundos)
  cache.put(idEnvio, JSON.stringify(datos), 600);
}

/**
 * Obtiene el estado de un envío desde el cache
 */
function obtenerEstadoEnvio(idEnvio) {
  const cache = CacheService.getScriptCache();
  const datos = cache.get(idEnvio);
  if (datos) {
    return JSON.parse(datos);
  }
  return null;
}

/**
 * Guarda los datos en la hoja de cálculo
 * @param {Object} datos - Objeto con los datos a guardar
 * @return {Object} Resultado de la operación
 */
function guardarDatos(datos) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      throw new Error('No se encontró la hoja "' + SHEET_NAME + '"');
    }
    
    const fecha = Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm:ss');

    // Subir archivo fichaPostulante solo si existe
    let fichaPostulanteUrl = '';
    if (datos.fichaPostulanteBase64 && datos.fichaPostulanteNombreArchivo) {
      fichaPostulanteUrl = subirArchivo(
        datos.fichaPostulanteNombreArchivo,
        datos.fichaPostulanteBase64,
        FOLDER_ID
      );
    }

    // Subir archivo fichaInvencion solo si existe
    let fichaInvencionUrl = '';
    if (datos.fichaInvencionBase64 && datos.fichaInvencionNombreArchivo) {
      fichaInvencionUrl = subirArchivo(
        datos.fichaInvencionNombreArchivo,
        datos.fichaInvencionBase64,
        FOLDER_ID_FICHA_DIS
      );
    }

    // Subir archivo actaCompromiso solo si existe
    let actaCompromisoUrl = '';
    if (datos.actaCompromisoBase64 && datos.actaCompromisoNombreArchivo) {
      actaCompromisoUrl = subirArchivo(
        datos.actaCompromisoNombreArchivo,
        datos.actaCompromisoBase64,
        FOLDER_ID_ACTA_COMPROMISO
      );
    }

    // Crear array con los datos
    const fila = [
      fecha,
      datos.tipoParticipante,
      datos.nombreInstitucionEmpresa,
      datos.titulo,
      datos.sectorTecnologico,
      datos.apellidosRepresentante,
      datos.nombreRepresentante,
      datos.dni,
      datos.telefono,
      datos.telefonoAlternativo,
      datos.correo,
      datos.correoAlternativo,
      datos.region,
      fichaPostulanteUrl,
      fichaInvencionUrl,
      actaCompromisoUrl
    ];
    
    // Agregar nueva fila al final
    sheet.appendRow(fila);
    
    Logger.log('Datos guardados exitosamente');
    return {
      success: true,
      message: 'Datos guardados correctamente',
      fecha: fecha,
      fila: sheet.getLastRow()
    };
    
  } catch (error) {
    Logger.log('Error al guardar datos: ' + error.message);
    throw error;
  }
}

/**
 * Configuración de seguridad
 */
const SECURITY_CONFIG = {
  MAX_REQUESTS_PER_IP: 10, // máximo 10 envíos por IP por hora
  MAX_REQUESTS_PER_EMAIL: 10, // máximo 10 envíos por email por día
  MIN_FORM_TIME: 30, // mínimo 30 segundos para completar el formulario
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB máximo por archivo
  ALLOWED_ORIGINS: ['https://www.patenta.pe'],
  TOKEN_VALIDITY: 1800000 // 30 minutos en millisegundos
};

/**
 * Genera un token único para cada sesión
 */
function generarToken() {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}_${random}`;
}

/**
 * Valida el token y el tiempo transcurrido
 */
function validarToken(token, tiempoFormulario) {
  // Si no hay token o es del cliente, solo validar tiempo
  if (!token || typeof token !== 'string' || token.startsWith('client_')) {
    // Verificar tiempo mínimo del formulario
    if (tiempoFormulario && tiempoFormulario < SECURITY_CONFIG.MIN_FORM_TIME * 1000) {
      return { valido: false, error: 'Formulario completado muy rápido' };
    }
    return { valido: true }; // Permitir tokens de cliente
  }
  
  const partes = token.split('_');
  if (partes.length !== 2) {
    return { valido: false, error: 'Token malformado' };
  }
  
  const timestamp = parseInt(partes[0]);
  if (isNaN(timestamp)) {
    return { valido: false, error: 'Timestamp inválido' };
  }
  
  const ahora = new Date().getTime();
  const tiempoTranscurrido = ahora - timestamp;
  
  // Verificar que el token no sea muy antiguo (30 minutos)
  if (tiempoTranscurrido > SECURITY_CONFIG.TOKEN_VALIDITY) {
    return { valido: false, error: 'Token expirado' };
  }
  
  // Verificar tiempo mínimo del formulario
  if (tiempoFormulario && tiempoFormulario < SECURITY_CONFIG.MIN_FORM_TIME * 1000) {
    return { valido: false, error: 'Formulario completado muy rápido' };
  }
  
  return { valido: true };
}

/**
 * Rate limiting usando PropertiesService
 */
function verificarRateLimit(ip, email) {
  const propiedades = PropertiesService.getScriptProperties();
  const ahora = new Date().getTime();
  const unaHora = 60 * 60 * 1000;
  const unDia = 24 * unaHora;
  
  // Verificar límite por IP
  const claveIP = `ip_${ip}`;
  const datosIP = propiedades.getProperty(claveIP);
  if (datosIP) {
    const { count, timestamp } = JSON.parse(datosIP);
    if (ahora - timestamp < unaHora) {
      if (count >= SECURITY_CONFIG.MAX_REQUESTS_PER_IP) {
        return { permitido: false, error: 'Demasiadas solicitudes desde esta IP' };
      }
      propiedades.setProperty(claveIP, JSON.stringify({ count: count + 1, timestamp }));
    } else {
      propiedades.setProperty(claveIP, JSON.stringify({ count: 1, timestamp: ahora }));
    }
  } else {
    propiedades.setProperty(claveIP, JSON.stringify({ count: 1, timestamp: ahora }));
  }
  
  // Verificar límite por email
  const claveEmail = `email_${email}`;
  const datosEmail = propiedades.getProperty(claveEmail);
  if (datosEmail) {
    const { count, timestamp } = JSON.parse(datosEmail);
    if (ahora - timestamp < unDia) {
      if (count >= SECURITY_CONFIG.MAX_REQUESTS_PER_EMAIL) {
        return { permitido: false, error: 'Demasiadas solicitudes para este email' };
      }
      propiedades.setProperty(claveEmail, JSON.stringify({ count: count + 1, timestamp }));
    } else {
      propiedades.setProperty(claveEmail, JSON.stringify({ count: 1, timestamp: ahora }));
    }
  } else {
    propiedades.setProperty(claveEmail, JSON.stringify({ count: 1, timestamp: ahora }));
  }
  
  return { permitido: true };
}

/**
 * Valida el origen de la petición
 */
function validarOrigen(headers) {
  const origen = headers['origin'] || headers['referer'] || '';
  const origenPermitido = SECURITY_CONFIG.ALLOWED_ORIGINS.some(allowed => 
    origen.includes(allowed) || allowed === '*'
  );
  
  if (!origenPermitido && origen !== '') {
    return { valido: false, error: 'Origen no autorizado' };
  }
  
  return { valido: true };
}

/**
 * Valida los datos del formulario
 */
function validarDatos(datos) {
  const camposRequeridos = [
    'tipoParticipante', 'titulo', 'sectorTecnologico', 
    'apellidosRepresentante', 'nombreRepresentante', 'dni', 
    'telefono', 'telefonoAlternativo', 'correo', 'correoAlternativo', 'region'
  ];
  
  // Verificar campos requeridos
  for (const campo of camposRequeridos) {
    if (!datos[campo] || datos[campo].trim() === '') {
      return { valido: false, error: `Campo requerido faltante: ${campo}` };
    }
  }
  
  // Validar DNI
  if (!/^[0-9]{8}$/.test(datos.dni)) {
    return { valido: false, error: 'DNI inválido' };
  }
  
  // Validar emails
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(datos.correo) || !emailRegex.test(datos.correoAlternativo)) {
    return { valido: false, error: 'Email inválido' };
  }
  
  // Validar teléfonos
  const telefonoRegex = /^[0-9+\-]{7,15}$/;
  if (!telefonoRegex.test(datos.telefono) || !telefonoRegex.test(datos.telefonoAlternativo)) {
    return { valido: false, error: 'Teléfono inválido' };
  }
  
  // Verificar honeypot
  if (datos.honeypot && datos.honeypot !== '') {
    return { valido: false, error: 'Envío de bot detectado' };
  }
  
  // Validar tamaño de archivos
  if (datos.fichaPostulanteBase64 && datos.fichaPostulanteBase64.length > SECURITY_CONFIG.MAX_FILE_SIZE * 1.4) {
    return { valido: false, error: 'Archivo de ficha postulante muy grande' };
  }
  
  if (datos.fichaInvencionBase64 && datos.fichaInvencionBase64.length > SECURITY_CONFIG.MAX_FILE_SIZE * 1.4) {
    return { valido: false, error: 'Archivo de ficha invención muy grande' };
  }
  
  if (datos.actaCompromisoBase64 && datos.actaCompromisoBase64.length > SECURITY_CONFIG.MAX_FILE_SIZE * 1.4) {
    return { valido: false, error: 'Archivo de acta compromiso muy grande' };
  }
  
  return { valido: true };
}

/**
 * Maneja peticiones POST con seguridad mejorada
 */
function doPost(e) {
  let idEnvio = null;
  
  try {
    const params = JSON.parse(e.postData.contents);
    idEnvio = params.idEnvio;
    
    // Marcar como pendiente inmediatamente
    if (idEnvio) {
      guardarEstadoEnvio(idEnvio, 'pending', 'Procesando...');
    }
    
    // Validar origen
    const validacionOrigen = validarOrigen(e.parameter);
    if (!validacionOrigen.valido) {
      if (idEnvio) {
        guardarEstadoEnvio(idEnvio, 'error', 'Acceso denegado: ' + validacionOrigen.error);
      }
      return createResponseWithCORS({
        success: false,
        message: 'Acceso denegado: ' + validacionOrigen.error
      });
    }
    
    // Validar datos
    const validacionDatos = validarDatos(params);
    if (!validacionDatos.valido) {
      if (idEnvio) {
        guardarEstadoEnvio(idEnvio, 'error', validacionDatos.error);
      }
      return createResponseWithCORS({
        success: false,
        message: validacionDatos.error
      });
    }
    
    // Validar token
    const validacionToken = validarToken(params.token, params.tiempoFormulario);
    if (!validacionToken.valido) {
      if (idEnvio) {
        guardarEstadoEnvio(idEnvio, 'error', 'Token inválido: ' + validacionToken.error);
      }
      return createResponseWithCORS({
        success: false,
        message: 'Token inválido: ' + validacionToken.error
      });
    }
    
    // Obtener IP del usuario (aproximada)
    const ip = e.parameter['user_ip'] || 'unknown';
    
    // Verificar rate limiting
    const verificacionRate = verificarRateLimit(ip, params.correo);
    if (!verificacionRate.permitido) {
      if (idEnvio) {
        guardarEstadoEnvio(idEnvio, 'error', verificacionRate.error);
      }
      return createResponseWithCORS({
        success: false,
        message: verificacionRate.error
      });
    }
    
    // Procesar datos si todas las validaciones pasan
    const resultado = guardarDatos(params);
    
    // Guardar resultado exitoso en cache
    if (idEnvio) {
      guardarEstadoEnvio(idEnvio, 'success', 'Formulario enviado exitosamente');
    }
    
    return createResponseWithCORS(resultado);
    
  } catch (error) {
    Logger.log('Error en doPost: ' + error.message);
    if (idEnvio) {
      guardarEstadoEnvio(idEnvio, 'error', 'Error interno del servidor: ' + error.message);
    }
    return createResponseWithCORS({
      success: false,
      message: 'Error interno del servidor'
    });
  }
}

/**
 * Maneja peticiones GET para generar tokens y verificar estados
 */
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getToken') {
    return createResponseWithCORS({
      success: true,
      token: generarToken(),
      timestamp: new Date().getTime()
    });
  }
  
  if (action === 'checkStatus') {
    const idEnvio = e.parameter.id;
    if (!idEnvio) {
      return createResponseWithCORS({
        status: 'error',
        message: 'ID de envío no proporcionado'
      });
    }
    
    const estado = obtenerEstadoEnvio(idEnvio);
    if (estado) {
      return createResponseWithCORS(estado);
    } else {
      return createResponseWithCORS({
        status: 'notfound',
        message: 'Estado no encontrado'
      });
    }
  }
  
  return createResponseWithCORS({
    success: true,
    message: 'API funcionando correctamente'
  });
}

/**
 * Crea una respuesta JSON con headers CORS y seguridad apropiados
 */
function createResponseWithCORS(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  // Nota: Apps Script maneja CORS automáticamente cuando el proyecto está publicado como Web App
  // con acceso "Cualquier persona" o "Cualquier persona, incluso anónimos"
  
  return output;
}

/**
 * Crea una respuesta JSON con headers apropiados (mantiene compatibilidad)
 * @param {Object} data - Datos a retornar
 * @return {TextOutput} Respuesta formateada
 */
function createResponse(data) {
  return createResponseWithCORS(data);
}
