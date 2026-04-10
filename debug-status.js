// Script de depuración para badges de estado
// Pega este código en la consola del navegador (F12)

console.log('🔍 Iniciando diagnóstico de badges de estado...\n');

// Buscar todos los badges
const badges = document.querySelectorAll('[data-role="status"], [data-role="acro-status"], [data-role="halte-status"], [data-role="telas-status"], [data-role="singleclasses-status"]');

console.log(`📊 Encontrados ${badges.length} badges de estado\n`);

badges.forEach((badge, index) => {
  const computedStyle = window.getComputedStyle(badge);
  const isPaid = badge.classList.contains('athlete-status-paid');
  
  console.log(`Badge #${index + 1}:`);
  console.log(`  📝 Texto: "${badge.textContent}"`);
  console.log(`  🎨 Clases: ${badge.className}`);
  console.log(`  🎯 Data-role: ${badge.getAttribute('data-role')}`);
  console.log(`  💰 Estado: ${isPaid ? 'PAGADO' : 'NO PAGADO'}`);
  console.log(`  🔤 Font-size: ${computedStyle.fontSize}`);
  console.log(`  🎨 Color: ${computedStyle.color}`);
  console.log(`  📦 Background: ${computedStyle.backgroundColor}`);
  console.log(`  👁️ Visibility: ${computedStyle.visibility}`);
  console.log(`  🔍 Opacity: ${computedStyle.opacity}`);
  console.log(`  📐 Display: ${computedStyle.display}`);
  console.log(`  📏 Width x Height: ${computedStyle.width} x ${computedStyle.height}`);
  
  // Verificar si es visible
  const rect = badge.getBoundingClientRect();
  const isVisible = rect.width > 0 && rect.height > 0 && 
                    computedStyle.visibility !== 'hidden' && 
                    computedStyle.display !== 'none' &&
                    parseFloat(computedStyle.opacity) > 0;
  
  console.log(`  ✅ ¿Es visible?: ${isVisible ? 'SÍ' : 'NO ❌'}`);
  console.log('---');
});

// Verificar tema
const isLight = document.body.classList.contains('light');
console.log(`\n🎨 Tema actual: ${isLight ? 'CLARO' : 'OSCURO'}`);

// Probar si CSS se cargó correctamente
const testBadge = badges[0];
if (testBadge) {
  console.log('\n🧪 Probando aplicar estilos manualmente...');
  testBadge.style.color = '#86efac';
  testBadge.style.fontSize = '11px';
  testBadge.style.fontWeight = '600';
  console.log('✅ Si ahora ves el primer badge, el problema es de CSS');
}

console.log('\n✅ Diagnóstico completado');
