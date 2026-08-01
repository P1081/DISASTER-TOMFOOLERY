const bgContainer = document.getElementById('bg-container');
const gradientOverlay = document.getElementById('gradient-overlay');
const flashOverlay = document.getElementById('flash-overlay');
const btnPlay = document.getElementById('btn-play');
const btnAlmanac = document.getElementById('btn-almanac');
const gameLogo = document.getElementById('game-logo');
const memeContainer = document.getElementById('meme-flash-container');
const thunderSound = document.getElementById('thunder-sound');

// NEW RAW AUDIO IMPLEMENTATION (Exactly like your working script)
const bgMusic = new Audio('sounds/ALPHATERRAIN.mp3');
bgMusic.loop = true;

// UNIVERSAL INITIALIZATION: Fires immediately on script execution load
bgMusic.play().catch(() => {
    console.log("Chrome auto-play security held this stream. Sound plays on your first menu action.");
});

// Screen component nodes
const almanacScreen = document.getElementById('almanac-screen');
const almanacCloseBtn = document.getElementById('almanac-close-btn');
const menuContainer = document.querySelector('.menu-container');
const loadingScreen = document.getElementById('loading-screen');
const progressFill = document.getElementById('progress-fill');

const almanacGifs = [
    'Images/Flooded.gif',
    'Images/AshFall.gif',
    'Images/Earthquake.gif'
];

let slideshowInterval = null;
let currentGifIndex = 0;
let memeTimeout = null;

// UNIVERSAL RECOVERY BRIDGE: Instantly kicks the music on if Chrome deferred it
window.addEventListener('click', () => {
    bgMusic.play().catch(err => console.log("Playback error:", err));
}, { once: true });


// 1. VHS STYLE MOUSE PANNING MECHANIC (Scale: 1.20)
window.addEventListener('mousemove', (e) => {
    if (!bgContainer) return;
    const moveX = ((e.clientX / window.innerWidth) - 0.5) * 30; 
    const moveY = ((e.clientY / window.innerHeight) - 0.5) * 30;
    bgContainer.style.transform = `scale(1.20) translate(${moveX}px, ${moveY}px)`;
});

// 2. RETRO THUNDER FLASH OVERLAY FUNCTION
function triggerThunderFlash() {
    if (!flashOverlay) return;
    flashOverlay.classList.remove('thunder-flash');
    void flashOverlay.offsetWidth; 
    flashOverlay.classList.add('thunder-flash');
}

// 3. LOGO CLICK FUNCTION: INSTANT TOM MEME SHOW + SLOW FADE OUT
if (gameLogo) {
    gameLogo.addEventListener('click', () => {
        if (!memeContainer) return;
        clearTimeout(memeTimeout);
        memeContainer.innerHTML = `<img src="Images/Tom.PNG" alt="Meme Flash">`;
        
        if (thunderSound) {
            thunderSound.currentTime = 0;
            thunderSound.play().catch(err => console.log("Audio blocked."));
        }
        
        memeContainer.classList.add('flash-active');
        memeTimeout = setTimeout(() => {
            memeContainer.classList.remove('flash-active');
        }, 400);
    });
}

// 4. PLAY BUTTON CLICK: STAGE TIMEOUT LOADING ENGINE
if (btnPlay) {
    btnPlay.addEventListener('click', () => {
        bgMusic.play().catch(() => {}); // Safety trigger
        
        if (gameLogo) gameLogo.style.display = 'none';
        if (menuContainer) menuContainer.style.display = 'none';
        if (gradientOverlay) gradientOverlay.style.display = 'none';
        if (loadingScreen) loadingScreen.style.display = 'flex';
        
        let progressPercent = 0;
        const loadingInterval = setInterval(() => {
            progressPercent += 5;
            if (progressFill) progressFill.style.width = `${progressPercent}%`;
            
            if (progressPercent >= 100) {
                clearInterval(loadingInterval);
                window.location.href = '../Game-Play/game.html';
            }
        }, 150); 
    });

    btnPlay.addEventListener('mouseenter', () => {
        if (bgContainer) bgContainer.style.backgroundImage = "url('Images/City.gif')";
        if (gradientOverlay) gradientOverlay.style.background = "linear-gradient(to right, rgba(0, 80, 40, 0.8) 0%, rgba(0,0,0,0) 100%)";
    });

    btnPlay.addEventListener('mouseleave', () => {
        if (gradientOverlay) gradientOverlay.style.background = "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)";
    });
}

// 5. ALMANAC BUTTON HOVER
if (btnAlmanac) {
    btnAlmanac.addEventListener('mouseenter', () => {
        bgMusic.play().catch(() => {}); // Safety trigger
        if (gradientOverlay) gradientOverlay.style.background = "linear-gradient(to right, rgba(100, 10, 10, 0.85) 0%, rgba(0,0,0,0) 100%)";
        
        currentGifIndex = 0;
        if (bgContainer) bgContainer.style.backgroundImage = `url('${almanacGifs[currentGifIndex]}')`;
        triggerThunderFlash();

        clearInterval(slideshowInterval);
        slideshowInterval = setInterval(() => {
            currentGifIndex = (currentGifIndex + 1) % almanacGifs.length;
            if (bgContainer) bgContainer.style.backgroundImage = `url('${almanacGifs[currentGifIndex]}')`;
            triggerThunderFlash();
        }, 1000);
    });

    btnAlmanac.addEventListener('mouseleave', () => {
        if (almanacScreen && almanacScreen.style.display !== 'flex') {
            clearInterval(slideshowInterval);
            if (bgContainer) bgContainer.style.backgroundImage = "url('Images/City.gif')";
            if (gradientOverlay) gradientOverlay.style.background = "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)";
        }
    });

    // 6. OPENING THE ALMANAC WINDOW INTERFACE
    btnAlmanac.addEventListener('click', () => {
        clearInterval(slideshowInterval);
        if (gameLogo) gameLogo.style.display = 'none';
        if (menuContainer) menuContainer.style.display = 'none';
        if (gradientOverlay) gradientOverlay.style.display = 'none';
        if (almanacScreen) almanacScreen.style.display = 'flex';
    });
}

// 7. CLOSING THE ALMANAC WINDOW INTERFACE
if (almanacCloseBtn) {
    almanacCloseBtn.addEventListener('click', () => {
        if (almanacScreen) almanacScreen.style.display = 'none';
        if (gameLogo) gameLogo.style.display = 'block';
        if (menuContainer) menuContainer.style.display = 'flex';
        if (gradientOverlay) gradientOverlay.style.display = 'block';

        clearInterval(slideshowInterval);
        if (bgContainer) bgContainer.style.backgroundImage = "url('Images/City.gif')";
        if (gradientOverlay) gradientOverlay.style.background = "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)";
    });
}

// 8. PVZ PREVIEW BOX CONTROLLER POPULATION FUNCTION
function showAlmanacDetail(title, imageSrc, description) {
    const titleEl = document.getElementById('almanac-display-title');
    const descEl = document.getElementById('almanac-display-desc');
    const imgEl = document.getElementById('almanac-display-img');
    
    if (titleEl) titleEl.innerText = title.toUpperCase();
    if (descEl) descEl.innerText = description;
    if (imgEl) imgEl.src = imageSrc;
}
