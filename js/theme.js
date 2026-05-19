/**
 * Theme Toggle Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  
  // Verifica se há preferência salva
  const savedTheme = localStorage.getItem('theme');
  
  // Se não houver, checa a preferência do sistema
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Aplica o tema inicial
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    root.setAttribute('data-theme', 'dark');
    updateToggleIcon('dark');
  } else {
    root.removeAttribute('data-theme');
    updateToggleIcon('light');
  }
  
  // Toggle click
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      
      if (isDark) {
        root.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        updateToggleIcon('light');
      } else {
        root.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        updateToggleIcon('dark');
      }
      
      // Se houver gráficos, notifica para re-renderizar
      if (typeof updateChartsTheme === 'function') {
        updateChartsTheme();
      }
    });
  }
  
  function updateToggleIcon(theme) {
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('i');
    if (!icon) return;
    
    if (theme === 'dark') {
      icon.className = 'fas fa-sun';
      icon.style.color = 'var(--orange-400)'; // sol laranja
    } else {
      icon.className = 'fas fa-moon';
      icon.style.color = ''; // volta pra default
    }
  }
});
