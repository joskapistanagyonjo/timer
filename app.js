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
const cancelBtn = document.getElementById('cancelBtn');
const cancelBtnRunning = document.getElementById('cancelBtnRunning');

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
const radius = 145;
const circumference = 2 * Math.PI * radius;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

// Picker generálás
const generatePickerItems = (max, picker) => {
    for (let i = 0; i <= max; i++) {
        const item = document.createElement('div');
        item.className = 'picker-item';
        item.textContent = i;
        item.dataset.value = i;
        picker.appendChild(item);
    }
};

generatePickerItems(23, hoursPicker);
generatePickerItems(59, minutesPicker);
generatePickerItems(59, secondsPicker);

// Ultra smooth picker scroll kezelés
const setupPicker = (picker, initialValue, callback) => {
    const items = Array.from(picker.querySelectorAll('.picker-item'));
    const itemHeight = 46;
    
    // Kezdő pozíció beállítása
    picker.scrollTop = initialValue * itemHeight;
    
    let scrollTimeout;
    let animationFrame;
    
    const updatePickerItems = () => {
        const scrollTop = picker.scrollTop;
        const centerIndex = scrollTop / itemHeight;
        
        items.forEach((item, index) => {
            const distance = Math.abs(index - centerIndex);
            
            if (distance < 0.1) {
                // Aktív elem
                item.classList.add('active');
                item.classList.remove('near');
            } else if (distance < 1.5) {
                // Közeli elemek
                item.classList.remove('active');
                item.classList.add('near');
            } else {
                // Távoli elemek
                item.classList.remove('active', 'near');
            }
            
            // Smooth opacity és scale
            const opacity = Math.max(0.2, 1 - (distance * 0.4));
            const scale = Math.max(0.85, 1 - (distance * 0.08));
            
            item.style.opacity = opacity;
            item.style.transform = `scale(${scale})`;
        });
    };
    
    const snapToNearest = () => {
        const scrollTop = picker.scrollTop;
        const centerIndex = Math.round(scrollTop / itemHeight);
        const targetScroll = centerIndex * itemHeight;
        
        picker.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        });
        
        callback(centerIndex);
    };
    
    picker.addEventListener('scroll', () => {
        // Folyamatos frissítés scrollozás közben
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        animationFrame = requestAnimationFrame(updatePickerItems);
        
        // Snap amikor megáll
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(snapToNearest, 150);
    }, { passive: true });
    
    // Touch feedback
    let touchStartY = 0;
    let lastTouchY = 0;
    let velocity = 0;
    
    picker.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
        lastTouchY = touchStartY;
        velocity = 0;
    }, { passive: true });
    
    picker.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        velocity = currentY - lastTouchY;
        lastTouchY = currentY;
    }, { passive: true });
    
    picker.addEventListener('touchend', () => {
        // Momentum scrolling
        if (Math.abs(velocity) > 2) {
            const momentum = velocity * 8;
            picker.scrollBy({
                top: -momentum,
                behavior: 'smooth'
            });
        }
    }, { passive: true });
    
    // EGÉR HÚZÁS TÁMOGATÁS
    let isDragging = false;
    let mouseStartY = 0;
    let mouseLastY = 0;
    let mouseVelocity = 0;
    let startScrollTop = 0;
    
    picker.addEventListener('mousedown', (e) => {
        isDragging = true;
        mouseStartY = e.clientY;
        mouseLastY = e.clientY;
        mouseVelocity = 0;
        startScrollTop = picker.scrollTop;
        picker.style.cursor = 'grabbing';
        picker.style.scrollBehavior = 'auto';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaY = mouseLastY - e.clientY;
        mouseVelocity = deltaY;
        mouseLastY = e.clientY;
        
        picker.scrollTop += deltaY;
        e.preventDefault();
    });
    
    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        picker.style.cursor = 'grab';
        picker.style.scrollBehavior = 'smooth';
        
        // Momentum scrolling egérrel is
        if (Math.abs(mouseVelocity) > 2) {
            const momentum = mouseVelocity * 8;
            picker.scrollBy({
                top: momentum,
                behavior: 'smooth'
            });
        } else {
            snapToNearest();
        }
    });
    
    // SCROLL WHEEL TÁMOGATÁS - egyet ugrik
    picker.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const currentIndex = Math.round(picker.scrollTop / itemHeight);
        let newIndex = currentIndex;
        
        if (e.deltaY > 0) {
            // Lefelé
            newIndex = Math.min(items.length - 1, currentIndex + 1);
        } else if (e.deltaY < 0) {
            // Felfelé
            newIndex = Math.max(0, currentIndex - 1);
        }
        
        picker.scrollTo({
            top: newIndex * itemHeight,
            behavior: 'smooth'
        });
        
        callback(newIndex);
    }, { passive: false });
    
    // Kezdeti állapot
    picker.style.cursor = 'grab';
    updatePickerItems();
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
        
        hoursPicker.scrollTo({ top: hours * 46, behavior: 'smooth' });
        minutesPicker.scrollTo({ top: minutes * 46, behavior: 'smooth' });
        secondsPicker.scrollTo({ top: secs * 46, behavior: 'smooth' });
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
        navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
    }
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Több beep egymás után
        for (let i = 0; i < 3; i++) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 880;
            oscillator.type = 'sine';
            
            const startTime = audioContext.currentTime + (i * 0.3);
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.2);
        }
    } catch (err) {
        console.log('Audio hiba:', err);
    }
};

// Értesítés
const sendNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Időzítő lejárt! ⏰', {
            body: 'Az időzítő véget ért!',
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'timer-finished',
            requireInteraction: true
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
    document.querySelector('.header-btn').style.display = 'none';
};

const showPicker = () => {
    pickerContainer.style.display = 'flex';
    quickButtons.style.display = 'grid';
    controls.style.display = 'flex';
    timerRunning.style.display = 'none';
    runningControls.style.display = 'none';
    document.querySelector('.header-btn').style.display = 'block';
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
cancelBtn.addEventListener('click', cancelTimer);
cancelBtnRunning.addEventListener('click', cancelTimer);

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
