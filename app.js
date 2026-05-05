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
const voiceToggle = document.getElementById('voiceToggle');

const progressCircle = document.getElementById('progressCircle');

// Állapot
let totalSeconds = 0;
let remainingSeconds = 0;
let timerInterval = null;
let tickSoundInterval = null;
let isRunning = false;
let isPaused = false;
let voiceControlEnabled = false;

// Hang vezérlés
let audioContext = null;
let analyser = null;
let microphone = null;
let javascriptNode = null;
let lastClapTime = 0;
const clapThreshold = 0.8;
const clapTimeout = 500;

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
    let momentumAnimation = null;
    
    const updatePickerItems = () => {
        const scrollTop = picker.scrollTop;
        const centerIndex = scrollTop / itemHeight;
        
        items.forEach((item, index) => {
            const distance = Math.abs(index - centerIndex);
            
            if (distance < 0.1) {
                item.classList.add('active');
                item.classList.remove('near');
            } else if (distance < 1.5) {
                item.classList.remove('active');
                item.classList.add('near');
            } else {
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
    
    // Momentum animáció leállítása
    const stopMomentum = () => {
        if (momentumAnimation) {
            cancelAnimationFrame(momentumAnimation);
            momentumAnimation = null;
        }
    };
    
    picker.addEventListener('scroll', () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        animationFrame = requestAnimationFrame(updatePickerItems);
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(snapToNearest, 150);
    }, { passive: true });
    
    // Touch feedback
    let touchStartY = 0;
    let lastTouchY = 0;
    let lastTouchTime = 0;
    let touchVelocity = 0;
    let isTouching = false;
    
    picker.addEventListener('touchstart', (e) => {
        isTouching = true;
        stopMomentum();
        touchStartY = e.touches[0].clientY;
        lastTouchY = touchStartY;
        lastTouchTime = Date.now();
        touchVelocity = 0;
    }, { passive: true });
    
    picker.addEventListener('touchmove', (e) => {
        const currentY = e.touches[0].clientY;
        const currentTime = Date.now();
        const deltaY = currentY - lastTouchY;
        const deltaTime = currentTime - lastTouchTime;
        
        touchVelocity = deltaY / (deltaTime || 1);
        lastTouchY = currentY;
        lastTouchTime = currentTime;
    }, { passive: true });
    
    picker.addEventListener('touchend', () => {
        isTouching = false;
        
        // Momentum scrolling
        if (Math.abs(touchVelocity) > 0.5) {
            let currentVelocity = touchVelocity * 300;
            const friction = 0.95;
            
            const animate = () => {
                if (Math.abs(currentVelocity) < 0.5) {
                    stopMomentum();
                    snapToNearest();
                    return;
                }
                
                picker.scrollTop -= currentVelocity / 60;
                currentVelocity *= friction;
                
                momentumAnimation = requestAnimationFrame(animate);
            };
            
            animate();
        }
    }, { passive: true });
    
    // EGÉR HÚZÁS TÁMOGATÁS - ULTRA FLUID
    let isDragging = false;
    let dragStartY = 0;
    let dragLastY = 0;
    let dragLastTime = 0;
    let dragVelocity = 0;
    let dragStartScrollTop = 0;
    let velocityHistory = [];
    
    picker.addEventListener('mousedown', (e) => {
        isDragging = true;
        stopMomentum();
        dragStartY = e.clientY;
        dragLastY = e.clientY;
        dragLastTime = Date.now();
        dragVelocity = 0;
        dragStartScrollTop = picker.scrollTop;
        velocityHistory = [];
        picker.style.cursor = 'grabbing';
        picker.style.userSelect = 'none';
        e.preventDefault();
    });
    
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        
        const currentY = e.clientY;
        const currentTime = Date.now();
        const deltaY = currentY - dragLastY;
        const deltaTime = currentTime - dragLastTime;
        
        // Folyamatos scrollozás húzás közben
        const newScrollTop = dragStartScrollTop + (dragStartY - currentY);
        picker.scrollTop = newScrollTop;
        
        // Velocity tracking több pontból
        if (deltaTime > 0) {
            const instantVelocity = deltaY / deltaTime;
            velocityHistory.push(instantVelocity);
            if (velocityHistory.length > 5) {
                velocityHistory.shift();
            }
        }
        
        dragLastY = currentY;
        dragLastTime = currentTime;
        
        e.preventDefault();
    };
    
    const handleMouseUp = (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        picker.style.cursor = 'grab';
        picker.style.userSelect = 'none';
        
        // Átlagos velocity számítás
        const avgVelocity = velocityHistory.length > 0
            ? velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length
            : 0;
        
        // Momentum scrolling - pörgetés
        if (Math.abs(avgVelocity) > 0.3) {
            let currentVelocity = avgVelocity * 400;
            const friction = 0.95;
            const minVelocity = 0.5;
            
            const animate = () => {
                if (Math.abs(currentVelocity) < minVelocity) {
                    stopMomentum();
                    snapToNearest();
                    return;
                }
                
                picker.scrollTop -= currentVelocity / 60;
                currentVelocity *= friction;
                
                momentumAnimation = requestAnimationFrame(animate);
            };
            
            animate();
        } else {
            snapToNearest();
        }
    };
    
    // Megfogás közben megállítás
    picker.addEventListener('mousedown', () => {
        stopMomentum();
    });
    
    picker.addEventListener('touchstart', () => {
        stopMomentum();
    }, { passive: true });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // SCROLL WHEEL TÁMOGATÁS - egyet ugrik
    picker.addEventListener('wheel', (e) => {
        e.preventDefault();
        stopMomentum();
        
        const currentIndex = Math.round(picker.scrollTop / itemHeight);
        let newIndex = currentIndex;
        
        if (e.deltaY > 0) {
            newIndex = Math.min(items.length - 1, currentIndex + 1);
        } else if (e.deltaY < 0) {
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
    picker.style.userSelect = 'none';
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
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Több beep egymás után
        for (let i = 0; i < 3; i++) {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.value = 880;
            oscillator.type = 'sine';
            
            const startTime = ctx.currentTime + (i * 0.3);
            gainNode.gain.setValueAtTime(0.3, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.2);
        }
    } catch (err) {
        console.log('Audio hiba:', err);
    }
};

// Tick hang (csorogás)
const playTickSound = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.05);
    } catch (err) {
        console.log('Tick hang hiba:', err);
    }
};

// Hang vezérlés indítása
const startVoiceControl = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
        
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 1024;
        
        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);
        
        let clapCount = 0;
        let lastClapDetected = 0;
        
        javascriptNode.onaudioprocess = () => {
            if (!voiceControlEnabled) return;
            
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            
            // Átlagos hangerő
            const average = array.reduce((a, b) => a + b) / array.length;
            const normalized = average / 255;
            
            const now = Date.now();
            
            // Taps detektálás
            if (normalized > clapThreshold) {
                if (now - lastClapDetected > 100) {
                    clapCount++;
                    lastClapDetected = now;
                    
                    if (clapCount === 1) {
                        setTimeout(() => {
                            if (clapCount === 2) {
                                // Dupla taps!
                                handleDoubleClapAction();
                            }
                            clapCount = 0;
                        }, clapTimeout);
                    }
                }
            }
        };
        
        voiceControlEnabled = true;
        voiceToggle.classList.add('active');
        voiceToggle.querySelector('i').className = 'bi bi-mic-fill';
        
    } catch (err) {
        console.log('Mikrofon hozzáférés hiba:', err);
        alert('Mikrofon hozzáférés szükséges a hang vezérléshez!');
    }
};

// Hang vezérlés leállítása
const stopVoiceControl = () => {
    if (javascriptNode) {
        javascriptNode.disconnect();
        javascriptNode = null;
    }
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    if (analyser) {
        analyser.disconnect();
        analyser = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    voiceControlEnabled = false;
    voiceToggle.classList.remove('active');
    voiceToggle.querySelector('i').className = 'bi bi-mic-mute';
};

// Dupla taps akció
const handleDoubleClapAction = () => {
    if (!isRunning) {
        // Indítás
        startTimer();
    } else {
        // Leállítás
        stopTimer();
        showPicker();
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
    
    // Tick hang lejátszása
    playTickSound();
    
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
        pauseBtn.querySelector('.btn-icon').innerHTML = '<i class="bi bi-pause-fill"></i>';
    } else {
        // Szünet
        clearInterval(timerInterval);
        isPaused = true;
        pauseBtn.querySelector('.btn-label').textContent = 'Folytatás';
        pauseBtn.querySelector('.btn-icon').innerHTML = '<i class="bi bi-play-fill"></i>';
    }
};

// Timer leállítás
const stopTimer = () => {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;
    releaseWakeLock();
    
    pauseBtn.querySelector('.btn-label').textContent = 'Szünet';
    pauseBtn.querySelector('.btn-icon').innerHTML = '<i class="bi bi-pause-fill"></i>';
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

// Voice toggle
voiceToggle.addEventListener('click', () => {
    if (voiceControlEnabled) {
        stopVoiceControl();
    } else {
        startVoiceControl();
    }
});

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
