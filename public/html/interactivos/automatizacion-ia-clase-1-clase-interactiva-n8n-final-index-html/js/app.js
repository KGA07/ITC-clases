function marcarPaso(paso, btn) {
    if (btn.classList.contains('done')) return;
    btn.classList.add('done');
    btn.innerHTML = '<i class="fa-solid fa-check-double"></i> ¡Paso ' + paso + ' Completado!';
}

function finalizarEntrega() {
    const fileInput = document.getElementById('json-file');
    if(fileInput.files.length === 0) {
        alert("⚠️ Por favor, adjunta tu archivo JSON exportado de N8N antes de entregar.");
        return;
    }
    
    alert("✅ ¡Excelente trabajo! Tu workflow y reflexión han sido registrados con éxito. Has completado el Laboratorio de N8N.");
    document.querySelector('.btn-send').style.backgroundColor = 'var(--success)';
    document.querySelector('.btn-send').innerHTML = '<i class="fa-solid fa-check-double"></i> Actividad Entregada';
}
