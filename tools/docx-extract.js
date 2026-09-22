const mammoth = require('mammoth');
const fs = require('fs');
const docx = process.argv[2];
mammoth.extractRawText({ path: docx })
  .then((r) => {
    fs.writeFileSync('C:/Users/Gkempe/AppData/Local/Temp/opencode/asistente-temario.txt', r.value);
    console.log('OK, chars:', r.value.length);
  })
  .catch((e) => console.error('ERR', e.message));