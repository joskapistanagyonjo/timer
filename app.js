// Service Worker regisztráció
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker regisztráció sikertelen:', err);
    });
}

// Elemek
const pickerContainer = document.getElementById('pickerContainer');
const timerRunning = document.getElementById('timerRunning');
const timerDisplay = document.getElementById('timerDisplay');
const quickButtons = document.getElementById('quickButtons');
const controls = document.querySelector('.controls');
const runningControls = document.getElementById('runningControls');

const hoursPicker = document.getElementById('hoursPicker');
const minutesPicker = document.getElementById('minutesPicker');
const secondsPicker = document.getElementById('secondsPicker');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const cancelBtn = document.getElementById('cancelBtn');

const progressCircle = document.getElementById('progressCircle');

// Állapot
let totalSeconds = 0;
let remainingSeconds = 0;
let timerInterval = null;
let isRunning = false;
let isPaused = false;

// Picker értékek
let selectedHours = 0;
let selectedMinutes = 5;
let selectedSeconds = 0;

// Progress ring setup
const radius = 130;
const circumference = 2 * Math.PI * radius;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

// Picker generálás
const generatePickerItems = (max, picker, type) => {
    for (let i = 0; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'picker-item';
        item.textContent = i;
        item.dataset.value = i;
        picker.appendChild(item);
    }
};

generatePickerItems(23, hoursPicker, 'hours');
generatePickerItems(59, minutesPicker, 'minutes');
generatePickerItems(59, secondsPicker, 'seconds');

// Picker scroll kezelés
const setupPicker = (picker, initialValue, callback) => {
    const items = picker.querySelectorAll('.picker-item');
    const itemHeight = 44;
    
    // Kezdő pozíció beállítása
    picker.scrollTop = initialValue * itemHeight;
    
    let isScrolling;
    
    picker.addEventListener('scroll', () => {
        clearTimeout(isScrolling);
        
        // Aktuális elem kiemelése
        const scrollTop = picker.scrollTop;
        const centerIndex = Math.round(scrollTop / itemHeight);
        
        items.forEach((item, index) => {
            if (index === centerIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Snap to position
        isScrolling = setTimeout(() => {
            const targetScroll = centerIndex * itemHeight;
            picker.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
            callback(centerIndex);
        }, 100);
    });
    
    // Kezdeti aktív elem
    items[initialValue]?.classList.add('active');
};

setupPicker(hoursPicker, selectedHours, (value) => {
    selectedHours = value;
});

setupPicker(minutesPicker, selectedMinutes, (value) => {
    selectedMinutes = value;
});

setupPicker(secondsPicker, selectedSeconds, (value) => {
    selectedSeconds = value;
});

// Gyors gombok
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const seconds = parseInt(btn.dataset.time);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        selectedHours = hours;
        selectedMinutes = minutes;
        selectedSeconds = secs;
        
        hoursPicker.scrollTo({ top: hours * 44, behavior: 'smooth' });
        minutesPicker.scrollTo({ top: minutes * 44, behavior: 'smooth' });
        secondsPicker.scrollTo({ top: secs * 44, behavior: 'smooth' });
    });
});

// Idő formázás
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// Progress ring frissítés
const updateProgress = () => {
    const progress = remainingSeconds / totalSeconds;
    const offset = circumference - (progress * circumference);
    progressCircle.style.strokeDashoffset = offset;
};

// Kijelző frissítés
const updateDisplay = () => {
    timerDisplay.textContent = formatTime(remainingSeconds);
    updateProgress();
};

// Hang lejátszás
const playSound = () => {
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200]);
    }
    
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

// Értesítés
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

const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
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
            showPicker();
        }, 3000);
    }
};

// Nézet váltás
const showTimer = () => {
    pickerContainer.style.display = 'none';
    quickButtons.style.display = 'none';
    controls.style.display = 'none';
    timerRunning.style.display = 'flex';
    runningControls.style.display = 'flex';
};

const showPicker = () => {
    pickerContainer.style.display = 'flex';
    quickButtons.style.display = 'grid';
    controls.style.display = 'flex';
    timerRunning.style.display = 'none';
    runningControls.style.display = 'none';
};

// Timer indítás
const startTimer = () => {
    totalSeconds = selectedHours * 3600 + selectedMinutes * 60 + selectedSeconds;
    
    if (totalSeconds <= 0) {
        return;
    }
    
    remainingSeconds = totalSeconds;
    isRunning = true;
    isPaused = false;
    
    requestNotificationPermission();
    requestWakeLock();
    
    showTimer();
    updateDisplay();
    
    timerInterval = setInterval(tick, 1000);
};

// Timer szüneteltetés
const pauseTimer = () => {
    if (isPaused) {
        // Folytatás
        timerInterval = setInterval(tick, 1000);
        isPaused = false;
        pauseBtn.querySelector('.btn-label').textContent = 'Szünet';
        pauseBtn.querySelector('.btn-icon').textContent = '⏸';
    } else {
        // Szünet
        clearInterval(timerInterval);
        isPaused = true;
        pauseBtn.querySelector('.btn-label').textContent = 'Folytatás';
        pauseBtn.querySelector('.btn-icon').textContent = '▶';
    }
};

// Timer leállítás
const stopTimer = () => {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;
    releaseWakeLock();
    
    pauseBtn.querySelector('.btn-label').textContent = 'Szünet';
    pauseBtn.querySelector('.btn-icon').textContent = '⏸';
};

// Cancel gomb
const cancelTimer = () => {
    if (isRunning) {
        stopTimer();
        showPicker();
    }
};

// Event listenerek
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
stopBtn.addEventListener('click', () => {
    stopTimer();
    showPicker();
});
cancelBtn.addEventListener('click', cancelTimer);

// Wake Lock
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

// Kezdeti állapot
updateDisplay();
