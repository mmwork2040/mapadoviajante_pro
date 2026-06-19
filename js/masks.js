// Configuração do IMask.js
document.addEventListener('DOMContentLoaded', () => {
  // Configuração da Moeda (R$)
  const currencyElements = document.querySelectorAll('.mask-currency');
  currencyElements.forEach(el => {
    IMask(el, {
      mask: 'R$ num',
      blocks: {
        num: {
          mask: Number,
          thousandsSeparator: '.',
          radix: ',',
          scale: 2,
          normalizeZeros: true,
          padFractionalZeros: true,
          mapToRadix: ['.']
        }
      }
    });
  });

  // Configuração de Telefone / WhatsApp
  const phoneElements = document.querySelectorAll('.mask-phone');
  phoneElements.forEach(el => {
    IMask(el, {
      mask: [
        { mask: '(00) 0000-0000' },
        { mask: '(00) 00000-0000' }
      ]
    });
  });

  // Configuração de CPF/CNPJ dinâmico
  const docElements = document.querySelectorAll('.mask-doc');
  docElements.forEach(el => {
    IMask(el, {
      mask: [
        {
          mask: '000.000.000-00',
          maxLength: 11
        },
        {
          mask: '00.000.000/0000-00'
        }
      ]
    });
  });
});
