// Service Worker regisztráció
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker regisztráció sikertelen:', err);
    });
}

// Elemek
const timerDisplay = document.getElementById('timerDisplay');
const minutesInput = document.getElementById('minutes');
const secondsInput = document.getElementById('seconds');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const timeInputs = document.getElementById('timeInputs');
const presetBtns = document.querySelectorAll('.preset-btn');

// Állapot
let totalSeconds = 0;
let remainingSeconds = 0;
let timerInterval = null;
let isRunning = false;
let isPaused = false;

// Hang lejátszás
const playSound = () => {
    // Vibráció ha támogatott
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
    }
    
    // Beep hang generálás
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
};

// Értesítés küldés
const sendNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Időzítő lejárt! ⏰', {
            body: 'Az időzítő véget ért!',
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'timer-finished'
        });
    }
};

// Értesítés engedély kérés
const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
};

// Idő formázás
const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Kijelző frissítés
const updateDisplay = () => {
    timerDisplay.textContent = formatTime(remainingSeconds);
};

// Timer tick
const tick = () => {
    remainingSeconds--;
    updateDisplay();
    
    if (remainingSeconds <= 0) {
        stopTimer();
        timerDisplay.classList.add('finished');
        playSound();
        sendNotification();
        
        setTimeout(() => {
            timerDisplay.classList.remove('finished');
        }, 3000);
    }
};

// Timer indítás
const startTimer = () => {
    if (!isRunning) {
        const mins = parseInt(minutesInput.value) || 0;
        const secs = parseInt(secondsInput.value) || 0;
        totalSeconds = mins * 60 + secs;
        
        if (totalSeconds <= 0) {
            alert('Adj meg egy időt!');
            return;
        }
        
        remainingSeconds = totalSeconds;
        requestNotificationPermission();
    }
    
    isRunning = true;
    isPaused = false;
    
    timerInterval = setInterval(tick, 1000);
    
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'block';
    resetBtn.style.display = 'block';
    timeInputs.style.display = 'none';
    
    updateDisplay();
};

// Timer szüneteltetés
const pauseTimer = () => {
    clearInterval(timerInterval);
    isPaused = true;
    
    pauseBtn.textContent = 'Folytatás';
    pauseBtn.onclick = resumeTimer;
};

// Timer folytatás
const resumeTimer = () => {
    timerInterval = setInterval(tick, 1000);
    isPaused = false;
    
    pauseBtn.textContent = 'Szünet';
    pauseBtn.onclick = pauseTimer;
};

// Timer leállítás
const stopTimer = () => {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;
    
    startBtn.style.display = 'block';
    pauseBtn.style.display = 'none';
    resetBtn.style.display = 'none';
    timeInputs.style.display = 'flex';
    
    pauseBtn.textContent = 'Szünet';
    pauseBtn.onclick = pauseTimer;
};

// Timer reset
const resetTimer = () => {
    stopTimer();
    remainingSeconds = 0;
    updateDisplay();
};

// Preset gombok
presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const seconds = parseInt(btn.dataset.time);
        minutesInput.value = Math.floor(seconds / 60);
        secondsInput.value = seconds % 60;
    });
});

// Event listenerek
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Input validáció
minutesInput.addEventListener('input', (e) => {
    if (e.target.value > 99) e.target.value = 99;
    if (e.target.value < 0) e.target.value = 0;
});

secondsInput.addEventListener('input', (e) => {
    if (e.target.value > 59) e.target.value = 59;
    if (e.target.value < 0) e.target.value = 0;
});

// Wake Lock API - képernyő ébren tartása
let wakeLock = null;

const requestWakeLock = async () => {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.log('Wake Lock hiba:', err);
    }
};

const releaseWakeLock = () => {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
};

// Wake Lock kezelés timer indításkor/leállításkor
const originalStartTimer = startTimer;
startTimer = () => {
    originalStartTimer();
    requestWakeLock();
};

const originalStopTimer = stopTimer;
stopTimer = () => {
    originalStopTimer();
    releaseWakeLock();
};

// Kezdeti kijelző
updateDisplay();
