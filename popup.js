const _runtime = (typeof browser !== 'undefined' ? browser : chrome);

document.querySelectorAll('[data-i18n]').forEach(el => {
  const key = el.getAttribute('data-i18n');
  const translation = _runtime.i18n.getMessage(key);
  if (translation) {
    el.innerText = translation;
  }
});

document.getElementById('openDashboard').addEventListener('click', () => {
  _runtime.tabs.create({ url: _runtime.runtime.getURL('dashboard.html') });
});
