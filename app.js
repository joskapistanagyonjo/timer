// Service Worker regisztráció
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('Service Worker regisztráció sikertelen:', err);
    });
}

// ===== NAVIGATION =====
const homeScreen = document.getElementById('homeScreen');
const timerApp = document.getElementById('timerApp');
const workoutApp = document.getElementById('workoutApp');

// Home time update
const updateHomeTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('homeTime').textContent = `${hours}:${minutes}`;
};

updateHomeTime();
setInterval(updateHomeTime, 1000);

// App navigation
document.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', () => {
        const app = card.dataset.app;
        homeScreen.style.display = 'none';
        
        if (app === 'timer') {
            timerApp.style.display = 'flex';
        } else if (app === 'workout') {
            workoutApp.style.display = 'flex';
            loadTodayWorkout();
        }
    });
});

document.getElementById('timerBack').addEventListener('click', () => {
    timerApp.style.display = 'none';
    homeScreen.style.display = 'flex';
    if (isRunning) {
        stopTimer();
        showPicker();
    }
});

document.getElementById('workoutBack').addEventListener('click', () => {
    workoutApp.style.display = 'none';
    homeScreen.style.display = 'flex';
});

// ===== TIMER APP =====
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
const cancelBtnRunning = document.getElementById('cancelBtnRunning');
const voiceToggle = document.getElementById('voiceToggle');

const progressCircle = document.getElementById('progressCircle');

let totalSeconds = 0;
let remainingSeconds = 0;
let timerInterval = null;
let isRunning = false;
let isPaused = false;
let voiceControlEnabled = false;

let selectedHours = 0;
let selectedMinutes = 5;
let selectedSeconds = 0;

let audioContext = null;
let analyser = null;
let microphone = null;
let javascriptNode = null;
const clapThreshold = 0.8;
const clapTimeout = 500;

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

// Picker setup
const setupPicker = (picker, initialValue, callback) => {
    const items = Array.from(picker.querySelectorAll('.picker-item'));
    const itemHeight = 46;
    
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
    
    // Touch
    let touchStartY = 0;
    let lastTouchY = 0;
    let lastTouchTime = 0;
    let touchVelocity = 0;
    
    picker.addEventListener('touchstart', (e) => {
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
    
    // Mouse
    let isDragging = false;
    let dragStartY = 0;
    let dragLastY = 0;
    let dragLastTime = 0;
    let dragStartScrollTop = 0;
    let velocityHistory = [];
    
    picker.addEventListener('mousedown', (e) => {
        isDragging = true;
        stopMomentum();
        dragStartY = e.clientY;
        dragLastY = e.clientY;
        dragLastTime = Date.now();
        dragStartScrollTop = picker.scrollTop;
        velocityHistory = [];
        picker.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        
        const currentY = e.clientY;
        const currentTime = Date.now();
        const deltaY = currentY - dragLastY;
        const deltaTime = currentTime - dragLastTime;
        
        picker.scrollTop = dragStartScrollTop + (dragStartY - currentY);
        
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
    
    const handleMouseUp = () => {
        if (!isDragging) return;
        
        isDragging = false;
        picker.style.cursor = 'grab';
        
        const avgVelocity = velocityHistory.length > 0
            ? velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length
            : 0;
        
        if (Math.abs(avgVelocity) > 0.3) {
            let currentVelocity = avgVelocity * 400;
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
        } else {
            snapToNearest();
        }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Wheel
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

// Quick buttons
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

// Timer functions
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const updateProgress = () => {
    const progress = remainingSeconds / totalSeconds;
    const offset = circumference - (progress * circumference);
    progressCircle.style.strokeDashoffset = offset;
};

const updateDisplay = () => {
    timerDisplay.textContent = formatTime(remainingSeconds);
    updateProgress();
};

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
    } catch (err) {}
};

const playSound = () => {
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
    }
    
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        
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
    } catch (err) {}
};

const sendNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Időzítő lejárt! ⏰', {
            body: 'Az időzítő véget ért!',
            icon: 'icon-192.png',
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

const tick = () => {
    remainingSeconds--;
    updateDisplay();
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

const pauseTimer = () => {
    if (isPaused) {
        timerInterval = setInterval(tick, 1000);
        isPaused = false;
        pauseBtn.querySelector('.btn-label').textContent = 'Szünet';
        pauseBtn.querySelector('.btn-icon').innerHTML = '<i class="bi bi-pause-fill"></i>';
    } else {
        clearInterval(timerInterval);
        isPaused = true;
        pauseBtn.querySelector('.btn-label').textContent = 'Folytatás';
        pauseBtn.querySelector('.btn-icon').innerHTML = '<i class="bi bi-play-fill"></i>';
    }
};

const stopTimer = () => {
    clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;
    releaseWakeLock();
    
    pauseBtn.querySelector('.btn-label').textContent = 'Szünet';
    pauseBtn.querySelector('.btn-icon').innerHTML = '<i class="bi bi-pause-fill"></i>';
};

const cancelTimer = () => {
    if (isRunning) {
        stopTimer();
        showPicker();
    }
};

// Voice control
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
            
            const average = array.reduce((a, b) => a + b) / array.length;
            const normalized = average / 255;
            
            const now = Date.now();
            
            if (normalized > clapThreshold) {
                if (now - lastClapDetected > 100) {
                    clapCount++;
                    lastClapDetected = now;
                    
                    if (clapCount === 1) {
                        setTimeout(() => {
                            if (clapCount === 2) {
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
        alert('Mikrofon hozzáférés szükséges!');
    }
};

const stopVoiceControl = () => {
    if (javascriptNode) javascriptNode.disconnect();
    if (microphone) microphone.disconnect();
    if (analyser) analyser.disconnect();
    if (audioContext) audioContext.close();
    
    audioContext = null;
    analyser = null;
    microphone = null;
    javascriptNode = null;
    
    voiceControlEnabled = false;
    voiceToggle.classList.remove('active');
    voiceToggle.querySelector('i').className = 'bi bi-mic-mute';
};

const handleDoubleClapAction = () => {
    if (!isRunning) {
        startTimer();
    } else {
        stopTimer();
        showPicker();
    }
};

// Wake Lock
let wakeLock = null;

const requestWakeLock = async () => {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {}
};

const releaseWakeLock = () => {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
};

// Timer events
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
cancelBtnRunning.addEventListener('click', cancelTimer);

voiceToggle.addEventListener('click', () => {
    if (voiceControlEnabled) {
        stopVoiceControl();
    } else {
        startVoiceControl();
    }
});

updateDisplay();

// ===== WORKOUT APP =====
const exerciseName = document.getElementById('exerciseName');
const exerciseWeight = document.getElementById('exerciseWeight');
const exerciseReps = document.getElementById('exerciseReps');
const addSetBtn = document.getElementById('addSetBtn');
const workoutSets = document.getElementById('workoutSets');
const historyBtn = document.getElementById('historyBtn');
const historyModal = document.getElementById('historyModal');
const closeHistory = document.getElementById('closeHistory');
const historyList = document.getElementById('historyList');

let todayWorkout = [];

// LocalStorage
const saveWorkout = () => {
    const today = new Date().toISOString().split('T')[0];
    const workouts = JSON.parse(localStorage.getItem('workouts') || '{}');
    workouts[today] = todayWorkout;
    localStorage.setItem('workouts', JSON.stringify(workouts));
};

const loadTodayWorkout = () => {
    const today = new Date().toISOString().split('T')[0];
    const workouts = JSON.parse(localStorage.getItem('workouts') || '{}');
    todayWorkout = workouts[today] || [];
    renderWorkoutSets();
};

const renderWorkoutSets = () => {
    if (todayWorkout.length === 0) {
        workoutSets.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-clipboard-check"></i>
                <p>Még nincs rögzített sorozat</p>
            </div>
        `;
        return;
    }
    
    workoutSets.innerHTML = todayWorkout.map((set, index) => `
        <div class="set-item">
            <div class="set-info">
                <div class="set-exercise">${set.exercise}</div>
                <div class="set-details">${set.weight} kg × ${set.reps} ismétlés</div>
                <div class="set-time">${set.time}</div>
            </div>
            <button class="delete-set" data-index="${index}">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `).join('');
    
    // Delete buttons
    document.querySelectorAll('.delete-set').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            todayWorkout.splice(index, 1);
            saveWorkout();
            renderWorkoutSets();
        });
    });
};

addSetBtn.addEventListener('click', () => {
    const exercise = exerciseName.value.trim();
    const weight = parseFloat(exerciseWeight.value) || 0;
    const reps = parseInt(exerciseReps.value) || 0;
    
    if (!exercise || weight <= 0 || reps <= 0) {
        alert('Töltsd ki az összes mezőt!');
        return;
    }
    
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    todayWorkout.push({
        exercise,
        weight,
        reps,
        time,
        timestamp: now.getTime()
    });
    
    saveWorkout();
    renderWorkoutSets();
    
    // Clear form
    exerciseName.value = '';
    exerciseWeight.value = '';
    exerciseReps.value = '';
    exerciseName.focus();
});

historyBtn.addEventListener('click', () => {
    const workouts = JSON.parse(localStorage.getItem('workouts') || '{}');
    const dates = Object.keys(workouts).sort().reverse();
    
    if (dates.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-calendar-x"></i>
                <p>Még nincs edzés napló</p>
            </div>
        `;
    } else {
        historyList.innerHTML = dates.map(date => {
            const sets = workouts[date];
            const dateObj = new Date(date);
            const formattedDate = `${dateObj.getFullYear()}. ${String(dateObj.getMonth() + 1).padStart(2, '0')}. ${String(dateObj.getDate()).padStart(2, '0')}.`;
            
            return `
                <div class="history-group">
                    <div class="history-date">${formattedDate}</div>
                    <div class="workout-sets">
                        ${sets.map(set => `
                            <div class="set-item">
                                <div class="set-info">
                                    <div class="set-exercise">${set.exercise}</div>
                                    <div class="set-details">${set.weight} kg × ${set.reps} ismétlés</div>
                                    <div class="set-time">${set.time}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    historyModal.style.display = 'flex';
});

closeHistory.addEventListener('click', () => {
    historyModal.style.display = 'none';
});

historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        historyModal.style.display = 'none';
    }
});
