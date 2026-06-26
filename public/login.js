document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');
    
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    
    if (response.ok) {
        messageDiv.textContent = '✅ Connexion réussie ! Redirection...';
        messageDiv.className = 'success';
        setTimeout(() => {
            window.location.href = '/admin';
        }, 1000);
    } else {
        const err = await response.json();
        messageDiv.textContent = `❌ ${err.error}`;
        messageDiv.className = 'error';
    }
});