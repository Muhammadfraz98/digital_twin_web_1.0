const termsCheckbox = document.getElementById('terms');
const exploreBtn = document.getElementById('explore');

termsCheckbox.addEventListener('change', () => {
    exploreBtn.disabled = !termsCheckbox.checked;
    exploreBtn.classList.toggle('enabled', termsCheckbox.checked);
});

exploreBtn.addEventListener('click', () => {
    document.getElementById('splash').style.display = 'none';
    import('./ar.js').then(module => module.startAR());
});
