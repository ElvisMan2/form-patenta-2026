/**
 * Script para subir archivos a Google Drive
 * ID de la carpeta de destino: 1ic_7E0sAraZWdJ0vYyPz8dXpBV-ZhIo6
 */

const FOLDER_ID = '1ic_7E0sAraZWdJ0vYyPz8dXpBV-ZhIo6';

/**
 * Sube un archivo a la carpeta de Drive especificada
 * @param {Blob} fileBlob - El archivo como blob
 * @param {string} fileName - Nombre del archivo
 * @return {File} El archivo creado
 */
function subirArchivo(fileBlob, fileName) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(fileBlob);
    file.setName(fileName);
    
    Logger.log('Archivo subido exitosamente: ' + file.getUrl());
    return file;
  } catch (error) {
    Logger.log('Error al subir archivo: ' + error.message);
    throw error;
  }
}

/**
 * Sube un archivo de texto a Drive
 * @param {string} contenido - Contenido del archivo
 * @param {string} nombreArchivo - Nombre del archivo
 * @return {File} El archivo creado
 */
function subirArchivoTexto(contenido, nombreArchivo) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(nombreArchivo, contenido);
    
    Logger.log('Archivo de texto subido: ' + file.getUrl());
    return file;
  } catch (error) {
    Logger.log('Error: ' + error.message);
    throw error;
  }
}

/**
 * Sube un archivo desde una URL
 * @param {string} url - URL del archivo a descargar
 * @param {string} nombreArchivo - Nombre para el archivo
 * @return {File} El archivo creado
 */
function subirDesdeURL(url, nombreArchivo) {
  try {
    const response = UrlFetchApp.fetch(url);
    const blob = response.getBlob();
    
    return subirArchivo(blob, nombreArchivo);
  } catch (error) {
    Logger.log('Error al descargar/subir archivo: ' + error.message);
    throw error;
  }
}

/**
 * Ejemplo de uso: función de prueba
 */
function ejemploUso() {
  // Ejemplo 1: Subir archivo de texto
  subirArchivoTexto('Hola Mundo!', 'ejemplo.txt');
  
  // Ejemplo 2: Subir desde URL
  // subirDesdeURL('https://ejemplo.com/archivo.pdf', 'documento.pdf');
}

/**
 * Maneja peticiones POST desde Postman o cualquier cliente HTTP
 * @param {Object} e - Objeto del evento con los parámetros de la petición
 * @return {TextOutput} Respuesta JSON
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    
    // Validar parámetros
    if (!params.nombreArchivo) {
      return createResponse({
        success: false,
        message: 'El parámetro nombreArchivo es requerido'
      });
    }
    
    let file;
    
    // Opción 1: Archivo en base64
    if (params.archivoBase64) {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(params.archivoBase64),
        params.mimeType || 'application/octet-stream',
        params.nombreArchivo
      );
      file = subirArchivo(blob, params.nombreArchivo);
    }
    // Opción 2: Solo contenido de texto
    else if (params.contenido) {
      file = subirArchivoTexto(params.contenido, params.nombreArchivo);
    }
    // Opción 3: Descargar desde URL
    else if (params.url) {
      file = subirDesdeURL(params.url, params.nombreArchivo);
    }
    else {
      return createResponse({
        success: false,
        message: 'Debe proporcionar: archivoBase64, contenido o url'
      });
    }
    
    return createResponse({
      success: true,
      message: 'Archivo subido exitosamente',
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: file.getName()
    });
    
  } catch (error) {
    return createResponse({
      success: false,
      message: 'Error: ' + error.message
    });
  }
}

/**
 * Maneja peticiones GET para verificar que el servicio está activo
 */
function doGet(e) {
  const callback = e.parameter.callback;
  const response = {
    success: true,
    message: 'Servicio activo. Use POST para subir archivos.',
    opciones: {
      opcion1: { archivoBase64: 'string', nombreArchivo: 'string', mimeType: 'string (opcional)' },
      opcion2: { contenido: 'string', nombreArchivo: 'string' },
      opcion3: { url: 'string', nombreArchivo: 'string' }
    }
  };
  
  // Soporte JSONP para navegadores
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(response) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  return createResponse(response);
}

/**
 * Crea una respuesta JSON con headers apropiados
 * @param {Object} data - Datos a retornar
 * @return {TextOutput} Respuesta formateada
 */
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
