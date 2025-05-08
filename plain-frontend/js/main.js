// Theme Management
document.addEventListener('DOMContentLoaded', () => {
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme.matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    // Theme toggle event
    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
    
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('open');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (mobileMenu.classList.contains('open') && 
            !mobileMenuBtn.contains(e.target) && 
            !mobileMenu.contains(e.target)) {
            mobileMenu.classList.remove('open');
        }
    });
    
    // Initialize animated gradients
    initAnimatedGradients();
});

// Animated Gradient
function initAnimatedGradients() {
    const gradients = document.querySelectorAll('.animated-gradient');
    
    gradients.forEach(gradient => {
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        gradient.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        const isSmall = gradient.classList.contains('small');
        
        // Set canvas dimensions
        function setCanvasDimensions() {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        }
        
        setCanvasDimensions();
        window.addEventListener('resize', setCanvasDimensions);
        
        // Animation variables
        const particles = [];
        const particleCount = isSmall ? 15 : 30;
        const maxSize = isSmall ? 80 : 150;
        const minSize = isSmall ? 40 : 80;
        
        // Create particles
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: minSize + Math.random() * (maxSize - minSize),
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: 0.1 + Math.random() * 0.2,
            });
        }
        
        // Animation function
        function animate() {
            if (!canvas || !ctx) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Get primary color from computed styles
            const primaryColorString = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
            const rgb = hexToRgb(primaryColorString); // Use hexToRgb

            if (!rgb) { // Add a check for parsed color
                console.error("Failed to parse primary color for gradient: ", primaryColorString);
                return; 
            }
            
            // Update and draw particles
            particles.forEach(particle => {
                // Update position
                particle.x += particle.speedX;
                particle.y += particle.speedY;
                
                // Bounce off edges
                if (particle.x < 0 || particle.x > canvas.width) {
                    particle.speedX *= -1;
                }
                
                if (particle.y < 0 || particle.y > canvas.height) {
                    particle.speedY *= -1;
                }
                
                // Draw gradient circle
                const gradient = ctx.createRadialGradient(
                    particle.x, 
                    particle.y, 
                    0, 
                    particle.x, 
                    particle.y, 
                    particle.size
                );
                
                gradient.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${particle.opacity})`);
                gradient.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);
                
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            });
            
            requestAnimationFrame(animate);
        }
        
        animate();
    });
}

// Helper function to convert hex to RGB array
function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

// Toast Notification System
function showToast(title, message, type = 'default', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg;
    if (type === 'success') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
    
    toast.innerHTML = `
        ${iconSvg}
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-description">${message}</div>
        </div>
        <button class="toast-close">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Close button event
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('closing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto close
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('closing');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    }, duration);
    
    return toast;
}

// Format date
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(date);
}

// Format time
function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric'
    }).format(date);
}
