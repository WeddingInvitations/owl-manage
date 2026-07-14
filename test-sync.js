// Script de prueba para la sincronización Excel-WodBuster
// Ejecuta este código en la consola del navegador (F12) para verificar que el módulo está cargado

console.log('🧪 Iniciando pruebas del módulo de sincronización...');

// Verificar que los elementos UI existen
const checks = {
  'Botón de sincronización': document.getElementById('wodBusterSyncExcelBtn'),
  'Input de archivo': document.getElementById('excelFileInput'),
  'Modal de sincronización': document.getElementById('syncExcelModal'),
  'Botón de descarga': document.getElementById('syncDownloadReportBtn'),
  'Sección de progreso': document.getElementById('syncProgressSection'),
  'Sección de resultados': document.getElementById('syncResultSection')
};

console.log('\n📋 Verificando elementos de la interfaz:');
let allGood = true;

Object.entries(checks).forEach(([name, element]) => {
  if (element) {
    console.log(`✅ ${name} - OK`);
  } else {
    console.error(`❌ ${name} - NO ENCONTRADO`);
    allGood = false;
  }
});

if (allGood) {
  console.log('\n✅ Todos los elementos de la interfaz están presentes');
} else {
  console.error('\n❌ Algunos elementos faltan. Verifica el HTML.');
}

// Verificar que la librería SheetJS está disponible
console.log('\n📚 Verificando librería SheetJS:');
try {
  // Intentar importar para verificar
  import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs')
    .then(() => {
      console.log('✅ SheetJS se puede cargar correctamente');
    })
    .catch((error) => {
      console.error('❌ Error al cargar SheetJS:', error);
    });
} catch (error) {
  console.error('❌ Error al verificar SheetJS:', error);
}

// Instrucciones para el usuario
console.log('\n📝 Instrucciones para probar la sincronización:');
console.log('1. Navega a la vista "Usuarios WodBuster"');
console.log('2. Haz clic en "🔄 Actualizar" para cargar usuarios');
console.log('3. Haz clic en "📊 Sincronizar con Excel"');
console.log('4. Selecciona tu archivo BBDD_OWL.xlsx');
console.log('5. Revisa los resultados en el modal');
console.log('6. Descarga el informe con "📥 Descargar Informe Excel"');

console.log('\n✨ Pruebas completadas');
