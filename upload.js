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
 * Maneja peticiones POST desde Postman o cualquier cliente HTTP
 * @param {Object} e - Objeto del evento con los parámetros de la petición
 * @return {TextOutput} Respuesta JSON
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    
    // Validar parámetros
    if (!params.nombreArchivo || !params.archivoBase64) {
      return createResponse({
        success: false,
        message: 'Los parámetros nombreArchivo y archivoBase64 son requeridos'
      });
    }
    
    const blob = Utilities.newBlob(
      Utilities.base64Decode(params.archivoBase64),
      params.mimeType || 'application/octet-stream',
      params.nombreArchivo
    );
    const file = subirArchivo(blob, params.nombreArchivo);
    
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
    parametros: {
      archivoBase64: 'string (requerido)',
      nombreArchivo: 'string (requerido)',
      mimeType: 'string (opcional)'
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
