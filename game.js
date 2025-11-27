const FALLBACK_PROMO_CODES = [
    "НАПИТОК1",
    "НАПИТОК2",
    "НАПИТОК3",
    "НАПИТОК4",
    "НАПИТОК5"
];

class Game {
    constructor() {
        this.score = 0;
        this.timeLeft = 60;
        this.lives = 3;
        this.currentLane = 1;
        this.obstacles = [];
        this.coins = [];
        this.gameLoopId = null;
        this.timerInterval = null;
        this.isGameOver = false;
        this.isMuted = true;
        this.playerName = '';
        this.playerPhone = '';
        this.bestScore = 0;
        this.playerResults = [];
        this.allResults = [];
        this.pendingScore = null;
        this.isMobile = this.checkIsMobile();
        this.promoCodes = [];
        this.lastShownPromoCode = null;

        this.obstacleProbability = 0.02;
        this.coinProbability = 0.03;

        this.initializeSupabase();
        this.loadPromoCodes();
        this.initializeAudio();

        this.obstacleTypes = [
            { emoji: '🪨', name: 'камень' },
            { emoji: '🚗', name: 'машина' },
            { emoji: '🚌', name: 'автобус' }
        ];

        this.laneRatios = [1 / 6, 1 / 2, 5 / 6];

        this.initializeElements();
        this.setupAuthForm();
        this.setupLeaderboard();
    }

    initializeSupabase() {
        try {
            const supabaseUrl = 'https://otyhkskvkqmvzkvrtfpy.supabase.co';
            const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90eWhrc2t2a3FtdnprdnJ0ZnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2MDA4MzksImV4cCI6MjA2MTE3NjgzOX0.74tnApnQiDpRCElSgGDP54lMnKB-dp4n6dtp1CL6Yi4';
            this.supabase = supabase.createClient(supabaseUrl, supabaseKey);
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            this.supabase = null;
        }
    }

    async loadPromoCodes() {
        try {
            const response = await fetch(`promocodes.json?t=${new Date().getTime()}`);
            if (response.ok) {
                const data = await response.json();
                this.promoCodes = data.codes || [];
                console.log('Промокоды загружены:', this.promoCodes);
                if (this.promoCodes.length === 0) {
                    console.warn('Массив промокодов пуст, используем fallback');
                    this.promoCodes = [...FALLBACK_PROMO_CODES];
                }
            } else {
                console.error('Ошибка загрузки промокодов:', response.status, response.statusText);
                this.promoCodes = [...FALLBACK_PROMO_CODES];
            }
        } catch (error) {
            console.error('Ошибка загрузки промокодов (возможно, CORS или отсутствие файла):', error);
            this.promoCodes = [...FALLBACK_PROMO_CODES];
        }
    }

    getRandomPromoCodes(count) {
        if (this.promoCodes.length === 0) {
            this.promoCodes = [...FALLBACK_PROMO_CODES];
        }

        let availableCodes = this.promoCodes;
        if (this.promoCodes.length > 1 && this.lastShownPromoCode) {
            availableCodes = this.promoCodes.filter(code => code !== this.lastShownPromoCode);
            if (availableCodes.length === 0) availableCodes = this.promoCodes;
        }

        const shuffled = [...availableCodes].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    initializeAudio() {
        try {
            this.audio = {
                background: new Audio('audio/background.mp3')
            };

            if (this.audio.background) {
                this.audio.background.loop = true;
                this.audio.background.volume = 0;
            }
        } catch (error) {
            console.error('Error initializing audio:', error);
        }
    }

    copyToClipboard(text) {
        // Попытка 1: Современный Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text)
                .then(() => true)
                .catch(err => {
                    console.warn('Clipboard API failed, trying fallback...', err);
                    return this.fallbackCopyToClipboard(text);
                });
        }
        // Попытка 2: Fallback для iframe и старых браузеров
        return Promise.resolve(this.fallbackCopyToClipboard(text));
    }

    fallbackCopyToClipboard(text) {
        // Создаем временный textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        textarea.setAttribute('readonly', '');

        document.body.appendChild(textarea);

        try {
            // Выделяем текст
            textarea.select();
            textarea.setSelectionRange(0, text.length);

            // Копируем через execCommand (работает в iframe)
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (successful) {
                console.log('Text copied using fallback method');
                return true;
            } else {
                console.error('Fallback copy failed');
                return false;
            }
        } catch (err) {
            console.error('Fallback copy error:', err);
            document.body.removeChild(textarea);
            return false;
        }
    }

    initializeElements() {
        this.player = document.getElementById('player');
        this.gameArea = document.querySelector('.game-area');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.gameOverScreen = document.getElementById('game-over');
        this.finalScoreElement = document.getElementById('final-score');
        this.resultMessageElement = document.querySelector('.result-message');
        this.bestScoreElement = document.getElementById('best-score');
        this.gameContainer = document.getElementById('game-container');
        this.authScreen = document.getElementById('auth-screen');
        this.livesElement = document.getElementById('lives');
        this.livesCountElement = this.livesElement ? this.livesElement.querySelector('.lives-count') : null;

        if (!this.player) console.error("Player element not found!");
        if (!this.gameArea) console.error("Game area element not found!");
        if (!this.scoreElement) console.error("Score element not found!");
        if (!this.timerElement) console.error("Timer element not found!");
        if (!this.gameOverScreen) console.error("Game Over screen not found!");

        if (this.gameOverScreen) this.gameOverScreen.classList.add('hidden');

        this.initializeSoundButton();
        this.createLivesDisplay();
        this.createLeaderboardButton();
        this.setupEventListeners();
        this.updatePlayerPosition();
    }

    initializeSoundButton() {
        try {
            const soundButton = document.createElement('button');
            soundButton.id = 'sound-toggle';
            soundButton.innerHTML = '🔇';
            soundButton.className = 'sound-button';

            const controlsRight = document.querySelector('.controls-right');
            if (controlsRight) {
                controlsRight.appendChild(soundButton);
                soundButton.addEventListener('click', () => {
                    this.toggleSound();
                    soundButton.innerHTML = this.isMuted ? '🔇' : '🔊';
                });
            }
        } catch (error) {
            console.error('Error initializing sound button:', error);
        }
    }

    setupAuthForm() {
        const authForm = document.getElementById('auth-form');
        const playerPhoneInput = document.getElementById('player-phone');

        if (playerPhoneInput) {
            if (!playerPhoneInput.value) {
                playerPhoneInput.value = '+7';
            }

            playerPhoneInput.addEventListener('input', (e) => {
                let value = e.target.value;
                const cleanedValue = value.replace(/[^\d+]/g, '');

                if (cleanedValue.length <= 1) {
                    e.target.value = '+7';
                    return;
                }

                if (!cleanedValue.startsWith('+')) {
                    if (cleanedValue.startsWith('7')) {
                        e.target.value = '+' + cleanedValue;
                    } else if (cleanedValue.startsWith('8')) {
                        e.target.value = '+7' + cleanedValue.substring(1);
                    } else {
                        e.target.value = '+7' + cleanedValue;
                    }
                } else if (!cleanedValue.startsWith('+7')) {
                    e.target.value = '+7' + cleanedValue.substring(1);
                } else {
                    e.target.value = cleanedValue;
                }

                if (e.target.value.length > 12) {
                    e.target.value = e.target.value.substring(0, 12);
                }
            });

            playerPhoneInput.addEventListener('keydown', (e) => {
                const value = e.target.value;

                if (
                    (e.key === 'Backspace' || e.key === 'Delete') &&
                    (value.length <= 2 ||
                        (e.target.selectionStart <= 2 && e.target.selectionEnd <= 2))
                ) {
                    e.preventDefault();
                }
            });
        }

        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const phoneInputGroup = playerPhoneInput.closest('.form-group');
                const isPhoneVisible = phoneInputGroup && !phoneInputGroup.classList.contains('form-group-hidden');

                if (!isPhoneVisible) {
                    this.trackEvent('game_play_without_auth', {
                        device_type: this.isMobile ? 'mobile' : 'desktop'
                    });
                    this.authScreen.classList.add('hidden');
                    this.gameContainer.classList.remove('hidden');
                    this.startGame();
                    return;
                }

                this.playerName = "Player";
                let phoneNumber = playerPhoneInput.value.trim();
                phoneNumber = phoneNumber.replace(/[^\d+]/g, '');

                if (!phoneNumber.startsWith('+')) {
                    if (phoneNumber.startsWith('8')) {
                        phoneNumber = '+7' + phoneNumber.substring(1);
                    } else if (phoneNumber.startsWith('7')) {
                        phoneNumber = '+' + phoneNumber;
                    } else {
                        phoneNumber = '+7' + phoneNumber;
                    }
                }

                this.playerPhone = phoneNumber;

                this.trackEvent('user_auth', {
                    device_type: this.isMobile ? 'mobile' : 'desktop',
                    auth_source: this.pendingScore !== null ? 'after_game' : 'before_game'
                });

                this.loadPlayerResults();

                if (this.pendingScore !== null) {
                    console.log(`Сохраняем отложенный результат: ${this.pendingScore}`);
                    const pendingScoreValue = this.pendingScore;
                    this.score = pendingScoreValue;
                    this.saveResult();
                    this.pendingScore = null;
                    this.score = 0;
                }

                if (playerPhoneInput) {
                    playerPhoneInput.required = false;
                    playerPhoneInput.hidden = true;
                    playerPhoneInput.disabled = true;
                    if (phoneInputGroup) {
                        phoneInputGroup.classList.add('form-group-hidden');
                    }
                }
                const startButton = document.getElementById('start-game-btn');
                if (startButton) {
                    startButton.textContent = 'Начать игру';
                }

                console.log('Auth form submit. Before calling startGame. isGameOver:', this.isGameOver, 'gameLoopId:', this.gameLoopId);
                this.authScreen.classList.add('hidden');
                this.gameContainer.classList.remove('hidden');
                this.startGame();
            });
        }
    }

    setupLeaderboard() {
        const leaderboard = document.getElementById('leaderboard');
        const closeLeaderboardBtn = document.getElementById('close-leaderboard');

        if (closeLeaderboardBtn && leaderboard) {
            closeLeaderboardBtn.addEventListener('click', () => {
                leaderboard.classList.add('hidden');
            });
        }
    }

    updateLeaderboard() {
        const leaderboardList = document.getElementById('leaderboard-list');
        if (!leaderboardList) return;

        leaderboardList.innerHTML = '';

        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'leaderboard-loading';
        loadingMessage.textContent = 'Загрузка результатов...';
        leaderboardList.appendChild(loadingMessage);

        if (this.supabase) {
            this.supabase
                .from('vlavashe_results')
                .select('*')
                .order('score', { ascending: false })
                .limit(10)
                .then(({ data, error }) => {
                    leaderboardList.innerHTML = '';

                    if (error) {
                        console.error('Error loading leaderboard from Supabase:', error);
                        const errorMessage = document.createElement('div');
                        errorMessage.className = 'leaderboard-error';
                        errorMessage.textContent = 'Ошибка загрузки результатов';
                        leaderboardList.appendChild(errorMessage);
                        return;
                    }

                    if (!data || data.length === 0) {
                        const noDataMessage = document.createElement('div');
                        noDataMessage.className = 'leaderboard-no-data';
                        noDataMessage.textContent = 'Пока нет результатов';
                        leaderboardList.appendChild(noDataMessage);
                        return;
                    }

                    const playersMap = new Map();

                    data.forEach(result => {
                        const key = `${result.name}-${result.phone}`;
                        if (!playersMap.has(key) || playersMap.get(key).score < result.score) {
                            playersMap.set(key, {
                                name: result.name,
                                phone: result.phone,
                                score: result.score
                            });
                        }
                    });

                    const uniquePlayers = Array.from(playersMap.values());
                    uniquePlayers.sort((a, b) => b.score - a.score);

                    const topPlayers = uniquePlayers.slice(0, 3);
                    const positions = ['1е место', '2е место', '3е место'];

                    topPlayers.forEach((player, index) => {
                        const item = document.createElement('div');
                        item.className = 'leaderboard-item';

                        const rank = document.createElement('div');
                        rank.className = 'leaderboard-rank';
                        rank.textContent = positions[index];

                        const phone = document.createElement('div');
                        phone.className = 'leaderboard-name';
                        const maskedPhone = player.phone.substring(0, 4) + '***' + player.phone.substring(player.phone.length - 2);
                        phone.textContent = maskedPhone;

                        const score = document.createElement('div');
                        score.className = 'leaderboard-score';
                        score.textContent = player.score;

                        item.appendChild(rank);
                        item.appendChild(phone);
                        item.appendChild(score);

                        leaderboardList.appendChild(item);
                    });

                    for (let i = topPlayers.length; i < 3; i++) {
                        const item = document.createElement('div');
                        item.className = 'leaderboard-item empty-slot';

                        const rank = document.createElement('div');
                        rank.className = 'leaderboard-rank';
                        rank.textContent = positions[i];

                        const emptyName = document.createElement('div');
                        emptyName.className = 'leaderboard-name';
                        emptyName.textContent = '—';

                        const emptyScore = document.createElement('div');
                        emptyScore.className = 'leaderboard-score';
                        emptyScore.textContent = '—';

                        item.appendChild(rank);
                        item.appendChild(emptyName);
                        item.appendChild(emptyScore);

                        leaderboardList.appendChild(item);
                    }
                });
        } else {
            this.loadAllResults();
            leaderboardList.innerHTML = '';

            const topPlayers = this.getTopPlayers(3);
            const positions = ['1е место', '2е место', '3е место'];

            topPlayers.forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';

                const rank = document.createElement('div');
                rank.className = 'leaderboard-rank';
                rank.textContent = positions[index];

                const phone = document.createElement('div');
                phone.className = 'leaderboard-name';
                const maskedPhone = player.phone.substring(0, 4) + '***' + player.phone.substring(player.phone.length - 2);
                phone.textContent = maskedPhone;

                const score = document.createElement('div');
                score.className = 'leaderboard-score';
                score.textContent = player.score;

                item.appendChild(rank);
                item.appendChild(phone);
                item.appendChild(score);

                leaderboardList.appendChild(item);
            });

            for (let i = topPlayers.length; i < 3; i++) {
                const item = document.createElement('div');
                item.className = 'leaderboard-item empty-slot';

                const rank = document.createElement('div');
                rank.className = 'leaderboard-rank';
                rank.textContent = positions[i];

                const emptyName = document.createElement('div');
                emptyName.className = 'leaderboard-name';
                emptyName.textContent = '—';

                const emptyScore = document.createElement('div');
                emptyScore.className = 'leaderboard-score';
                emptyScore.textContent = '—';

                item.appendChild(rank);
                item.appendChild(emptyName);
                item.appendChild(emptyScore);

                leaderboardList.appendChild(item);
            }
        }
    }

    getTopPlayers(count) {
        const playersMap = new Map();

        this.allResults.forEach(result => {
            const key = `${result.name}-${result.phone}`;
            if (!playersMap.has(key) || playersMap.get(key).score < result.score) {
                playersMap.set(key, {
                    name: result.name,
                    phone: result.phone,
                    score: result.score
                });
            }
        });

        const uniquePlayers = Array.from(playersMap.values());
        uniquePlayers.sort((a, b) => b.score - a.score);

        return uniquePlayers.slice(0, count);
    }

    loadPlayerResults() {
        if (this.supabase) {
            this.supabase
                .from('vlavashe_results')
                .select('*')
                .eq('phone', this.playerPhone)
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error loading player results from Supabase:', error);
                        this.playerResults = [];
                        this.bestScore = 0;
                    } else if (data) {
                        this.playerResults = data;
                        this.bestScore = 0;
                        this.playerResults.forEach(result => {
                            if (result.score > this.bestScore) {
                                this.bestScore = result.score;
                            }
                        });
                        if (this.bestScoreElement) {
                            this.bestScoreElement.textContent = this.bestScore;
                        }
                    }
                });
        }
    }

    loadAllResults() {
        if (this.supabase) {
            this.supabase
                .from('vlavashe_results')
                .select('*')
                .order('score', { ascending: false })
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error loading all results from Supabase:', error);
                        this.allResults = [];
                    } else if (data) {
                        this.allResults = data;
                    }
                });
        }
    }

    saveResult() {
        if (!this.playerPhone || this.playerPhone.length < 10) {
            console.warn('Cannot save result: player is not authenticated');
            return;
        }
        console.log(`Сохраняем результат ${this.score} для игрока с телефоном ${this.playerPhone}`);
        const result = {
            name: this.playerName,
            phone: this.playerPhone,
            score: this.score,
            date: new Date().toISOString().split('T')[0]
        };
        this.playerResults.push(result);
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            if (this.bestScoreElement) {
                this.bestScoreElement.textContent = this.bestScore;
            }
        }
        if (this.resultMessageElement) {
            if (this.score > this.bestScore && this.playerResults.length > 1) {
                this.resultMessageElement.textContent = 'Новый рекорд!';
            } else if (this.playerResults.length > 1) {
                this.resultMessageElement.textContent =
                    `Ваш лучший результат: ${this.bestScore}. Попробуй ещё!`;
            }
        }
        if (this.score < 0 || this.score > 2000) {
            console.error('Invalid score value detected');
            return;
        }
        if (this.supabase) {
            console.log(`Отправляем в Supabase результат: ${this.score} очков для номера ${this.playerPhone}`);
            this.supabase
                .from('vlavashe_results')
                .insert([{
                    name: this.playerName,
                    phone: this.playerPhone,
                    score: this.score,
                    date: new Date().toISOString().split('T')[0]
                }])
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error saving result to Supabase:', error);
                    } else {
                        console.log('Result saved to Supabase successfully', data);
                    }
                });
        }
    }

    clearGame() {
        console.log('clearGame called. Current gameLoopId before clearing:', this.gameLoopId, 'TimerInterval:', this.timerInterval);
        if (this.gameOverScreen) this.gameOverScreen.classList.add('hidden');

        const existingObstacles = document.querySelectorAll('.obstacle');
        const existingCoins = document.querySelectorAll('.coin');
        existingObstacles.forEach(obstacle => obstacle.remove());
        existingCoins.forEach(coin => coin.remove());

        this.obstacles = [];
        this.coins = [];
        this.isGameOver = false;
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
            console.log('clearGame: gameLoopId cancelled and set to null.');
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            console.log('clearGame: timerInterval cleared.');
        }
        console.log('clearGame finished. gameLoopId after clearing:', this.gameLoopId, 'TimerInterval after:', this.timerInterval);
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

        let touchStartX = 0;
        let touchStartY = 0;

        if (this.gameArea) {
            this.gameArea.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                e.preventDefault();
            }, { passive: false });

            this.gameArea.addEventListener('touchmove', (e) => {
                if (this.isGameOver || e.touches.length === 0) return;

                const touchEndX = e.touches[0].clientX;
                const touchEndY = e.touches[0].clientY;
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;

                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    const swipeThreshold = 50;
                    if (deltaX > swipeThreshold) {
                        this.moveRight();
                        touchStartX = touchEndX;
                        touchStartY = touchEndY;
                    } else if (deltaX < -swipeThreshold) {
                        this.moveLeft();
                        touchStartX = touchEndX;
                        touchStartY = touchEndY;
                    }
                }
                e.preventDefault();
            }, { passive: false });
        }

        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');

        if (btnLeft) {
            btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); if (!this.isGameOver) this.moveLeft(); });
            btnLeft.addEventListener('click', () => { if (!this.isGameOver) this.moveLeft(); });
        }
        if (btnRight) {
            btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); if (!this.isGameOver) this.moveRight(); });
            btnRight.addEventListener('click', () => { if (!this.isGameOver) this.moveRight(); });
        }

        const restartButtons = [
            document.getElementById('restart'),
            document.getElementById('play-again')
        ];

        restartButtons.forEach(button => {
            if (button) {
                button.addEventListener('click', () => {
                    console.log('Restart button clicked');
                    this.restartGame();
                });
            }
        });

        const showLeaderboardBtn = document.getElementById('show-leaderboard-from-gameover');
        if (showLeaderboardBtn) {
            showLeaderboardBtn.addEventListener('click', () => {
                this.updateLeaderboard();
                const leaderboard = document.getElementById('leaderboard');
                if (leaderboard) {
                    leaderboard.classList.remove('hidden');
                }
            });
        }
    }

    handleKeyPress(e) {
        if (this.isGameOver) return;
        switch (e.key) {
            case 'ArrowLeft': this.moveLeft(); break;
            case 'ArrowRight': this.moveRight(); break;
            case 'm':
            case 'M':
            case 'ь':
                this.toggleSound();
                const soundButton = document.getElementById('sound-toggle');
                if (soundButton) {
                    soundButton.innerHTML = this.isMuted ? '🔇' : '🔊';
                }
                break;
        }
    }

    moveLeft() {
        if (this.currentLane > 0) {
            this.currentLane--;
            this.updatePlayerPosition();
        }
    }

    moveRight() {
        if (this.currentLane < this.laneRatios.length - 1) {
            this.currentLane++;
            this.updatePlayerPosition();
        }
    }

    updatePlayerPosition() {
        if (!this.player || !this.gameArea) return;

        const gameAreaWidth = this.gameArea.offsetWidth;
        const laneCenterPx = gameAreaWidth * this.laneRatios[this.currentLane];
        const transformValue = `translateX(${laneCenterPx}px) translateX(-50%)`;
        this.player.style.transform = transformValue;
    }

    createObstacle() {
        const obstacleElement = document.createElement('div');
        obstacleElement.className = 'obstacle';
        const randomType = this.obstacleTypes[Math.floor(Math.random() * this.obstacleTypes.length)];
        obstacleElement.innerHTML = randomType.emoji;
        obstacleElement.title = randomType.name;
        const lane = Math.floor(Math.random() * this.laneRatios.length);
        obstacleElement.style.left = `${this.laneRatios[lane] * 100}%`;
        const initialY = 0;
        obstacleElement.style.transform = `translateY(${initialY}px)`;

        if (this.gameArea) {
            this.gameArea.appendChild(obstacleElement);
            this.obstacles.push({
                element: obstacleElement,
                lane: lane,
                type: randomType.name,
                y: initialY
            });
        }
    }

    createCoin() {
        const coinElement = document.createElement('div');
        coinElement.className = 'coin';
        coinElement.innerHTML = '🌯';
        const lane = Math.floor(Math.random() * this.laneRatios.length);
        coinElement.style.left = `${this.laneRatios[lane] * 100}%`;
        const initialY = 0;
        coinElement.style.transform = `translateY(${initialY}px)`;

        if (this.gameArea) {
            this.gameArea.appendChild(coinElement);
            this.coins.push({
                element: coinElement,
                lane: lane,
                y: initialY
            });
        }
    }

    moveObstacles() {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacleObj = this.obstacles[i];
            const obstacleElement = obstacleObj.element;

            if (!obstacleElement) {
                this.obstacles.splice(i, 1);
                continue;
            }

            obstacleObj.y += 4;
            obstacleElement.style.transform = `translateY(${obstacleObj.y}px)`;

            if (obstacleObj.y > this.gameArea.offsetHeight) {
                obstacleElement.remove();
                this.obstacles.splice(i, 1);
            } else if (this.checkCollision(obstacleObj)) {
                this.handleCollision(obstacleObj, i);
            }
        }
    }

    moveCoins() {
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coinObj = this.coins[i];
            const coinElement = coinObj.element;

            if (!coinElement) {
                this.coins.splice(i, 1);
                continue;
            }

            coinObj.y += 3;
            coinElement.style.transform = `translateY(${coinObj.y}px)`;

            if (coinObj.y > this.gameArea.offsetHeight) {
                coinElement.remove();
                this.coins.splice(i, 1);
            } else if (this.checkCoinCollision(coinObj)) {
                this.handleCoinCollection(coinObj, i);
            }
        }
    }

    checkCollision(obstacle) {
        if (!this.player) return false;
        const playerRect = this.player.getBoundingClientRect();
        const obstacleRect = obstacle.element.getBoundingClientRect();
        return obstacle.lane === this.currentLane &&
            obstacleRect.bottom > playerRect.top &&
            obstacleRect.top < playerRect.bottom;
    }

    checkCoinCollision(coin) {
        if (!this.player) return false;
        const playerRect = this.player.getBoundingClientRect();
        const coinRect = coin.element.getBoundingClientRect();
        return coin.lane === this.currentLane &&
            coinRect.bottom > playerRect.top &&
            coinRect.top < playerRect.bottom;
    }

    handleCollision(obstacle, index) {
        this.lives--;
        this.updateLivesDisplay();

        this.trackEvent('obstacle_collision', {
            obstacle_type: obstacle.type,
            lives_left: this.lives,
            score: this.score
        });

        obstacle.element.remove();
        this.obstacles.splice(index, 1);

        if (this.lives <= 0) {
            this.endGame();
        }
    }

    handleCoinCollection(coin, index) {
        this.score += 10;
        if (this.scoreElement) {
            this.scoreElement.textContent = this.score;
        }

        this.trackEvent('coin_collected', {
            current_score: this.score,
            coins_collected: this.score / 10
        });

        coin.element.remove();
        this.coins.splice(index, 1);
    }

    updateTimer() {
        this.timeLeft--;
        if (this.timerElement) {
            this.timerElement.textContent = this.timeLeft;
        }

        if (this.timeLeft <= 0) {
            this.endGame();
        }
    }

    endGame() {
        console.log('endGame called. Current gameLoopId:', this.gameLoopId, 'isGameOver:', this.isGameOver);
        if (this.isGameOver) {
            console.log('endGame: Game is already over, exiting to prevent multiple calls.');
        }
        this.isGameOver = true;

        this.trackEvent('game_end', {
            score: this.score,
            time_played: 60 - this.timeLeft,
            device_type: this.isMobile ? 'mobile' : 'desktop',
            is_authorized: !!this.playerPhone
        });

        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
            console.log('endGame: gameLoopId cancelled and set to null.');
        } else {
            console.log('endGame: gameLoopId was already null or not active.');
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            console.log('endGame: timerInterval cleared.');
        }
        this.stopSound();

        if (this.finalScoreElement) this.finalScoreElement.textContent = this.score;

        let authToSaveButton = document.getElementById('auth-to-save');
        const gameOverContent = document.querySelector('.game-over-content');

        if (!this.playerPhone || this.playerPhone.length < 10) {
            this.pendingScore = this.score;

            const leaderboardBtn = document.getElementById('show-leaderboard-from-gameover');
            if (leaderboardBtn) {
                leaderboardBtn.style.display = 'none';
            }

            if (!authToSaveButton && gameOverContent) {
                authToSaveButton = document.createElement('button');
                authToSaveButton.id = 'auth-to-save';
                authToSaveButton.className = 'game-btn';
                const showLeaderboardBtn = document.getElementById('show-leaderboard-from-gameover');
                if (showLeaderboardBtn && showLeaderboardBtn.parentNode === gameOverContent) {
                    showLeaderboardBtn.insertAdjacentElement('afterend', authToSaveButton);
                } else {
                    gameOverContent.appendChild(authToSaveButton);
                }
            }

            if (authToSaveButton) {
                authToSaveButton.textContent = 'Сохранить результат';
                authToSaveButton.style.display = 'block';

                const newButton = authToSaveButton.cloneNode(true);
                authToSaveButton.parentNode.replaceChild(newButton, authToSaveButton);
                authToSaveButton = newButton;

                authToSaveButton.addEventListener('click', () => {
                    if (this.gameOverScreen) this.gameOverScreen.classList.add('hidden');
                    if (this.authScreen) this.authScreen.classList.remove('hidden');

                    const phoneInput = document.getElementById('player-phone');
                    if (phoneInput) {
                        phoneInput.required = true;
                        phoneInput.hidden = false;
                        phoneInput.disabled = false;
                        const formGroup = phoneInput.closest('.form-group');
                        if (formGroup) formGroup.classList.remove('form-group-hidden');
                    }

                    const startGameBtnOnAuth = document.getElementById('start-game-btn');
                    if (startGameBtnOnAuth) startGameBtnOnAuth.textContent = 'Сохранить и продолжить';

                    const gameRulesBlock = document.querySelector('.auth-content .game-rules');
                    const pendingScoreAuthMsg = document.getElementById('pending-score-auth-message');

                    if (gameRulesBlock) gameRulesBlock.classList.add('hidden');
                    if (pendingScoreAuthMsg) {
                        pendingScoreAuthMsg.classList.remove('hidden');
                        pendingScoreAuthMsg.innerHTML = `<strong>Вы набрали: ${this.pendingScore} очков!</strong><br>Введите номер телефона, чтобы сохранить результат.`;
                    }
                });
            }

            if (this.resultMessageElement) this.resultMessageElement.textContent = "";
            if (this.bestScoreElement) this.bestScoreElement.textContent = "-";

        } else {
            if (authToSaveButton) {
                authToSaveButton.style.display = 'none';
            }

            const leaderboardBtn = document.getElementById('show-leaderboard-from-gameover');
            if (leaderboardBtn) {
                leaderboardBtn.style.display = 'block';
            }

            this.saveResult();
            if (this.bestScoreElement) this.bestScoreElement.textContent = this.bestScore;
            if (this.resultMessageElement) this.resultMessageElement.textContent = "";
        }

        this.displayPromoCodes();

        if (this.gameOverScreen) this.gameOverScreen.classList.remove('hidden');
    }

    async displayPromoCodes() {
        const promoListContainer = document.getElementById('game-over-promo-list');
        const gameOverPromoCopied = document.getElementById('game-over-promo-copied');

        if (!promoListContainer) return;

        if (this.promoCodes.length === 0) {
            await this.loadPromoCodes();
        }

        console.log('Доступные промокоды:', this.promoCodes);
        const promoCodes = this.getRandomPromoCodes(1);
        const promoCode = promoCodes[0] || 'GAME2';
        this.lastShownPromoCode = promoCode;
        console.log('Выбранный промокод:', promoCode);

        promoListContainer.innerHTML = '';

        const promoElement = document.createElement('div');
        promoElement.className = 'promo-code-value';
        promoElement.textContent = promoCode;
        promoElement.title = 'Нажмите, чтобы скопировать';

        promoElement.onclick = () => {
            this.copyToClipboard(promoCode).then(success => {
                if (success) {
                    this.trackEvent('promo_code_copied', {
                        promo_code: promoCode,
                        score: this.score,
                        device_type: this.isMobile ? 'mobile' : 'desktop',
                        is_authorized: !!this.playerPhone
                    });

                    if (gameOverPromoCopied) {
                        gameOverPromoCopied.textContent = 'Промокод скопирован!';
                        gameOverPromoCopied.style.color = '#4dff4d';
                        gameOverPromoCopied.classList.remove('hidden');
                        setTimeout(() => {
                            gameOverPromoCopied.classList.add('hidden');
                        }, 2000);
                    }
                } else {
                    this.trackEvent('promo_code_copy_error', {
                        device_type: this.isMobile ? 'mobile' : 'desktop',
                        error: 'Copy failed'
                    });

                    if (gameOverPromoCopied) {
                        gameOverPromoCopied.textContent = 'Ошибка копирования';
                        gameOverPromoCopied.style.color = 'red';
                        gameOverPromoCopied.classList.remove('hidden');
                        setTimeout(() => {
                            gameOverPromoCopied.classList.add('hidden');
                            gameOverPromoCopied.textContent = 'Промокод скопирован!';
                            gameOverPromoCopied.style.color = '#4dff4d';
                        }, 2000);
                    }
                }
            });
        };

        promoListContainer.appendChild(promoElement);
    }

    startGame() {
        console.log('startGame called. Initial state: isGameOver:', this.isGameOver, 'gameLoopId:', this.gameLoopId);

        this.trackEvent('game_start', {
            device_type: this.isMobile ? 'mobile' : 'desktop',
            is_authorized: !!this.playerPhone
        });

        if (this.gameLoopId) {
            console.log('startGame: отменяем активную анимацию, gameLoopId:', this.gameLoopId);
            cancelAnimationFrame(this.gameLoopId);
            this.gameLoopId = null;
        }

        this.clearGame();
        this.isGameOver = false;
        this.score = 0;
        this.timeLeft = 60;
        this.lives = 3;
        this.obstacles = [];
        this.coins = [];
        this.currentLane = 1;

        if (this.scoreElement) this.scoreElement.textContent = this.score;
        if (this.timerElement) this.timerElement.textContent = this.timeLeft;
        this.updateLivesDisplay();
        this.updatePlayerPosition();
        console.log('startGame: State reset. isGameOver:', this.isGameOver);

        console.log('startGame: Requesting animation frame.');
        this.gameLoopId = requestAnimationFrame(this.gameLoop.bind(this));

        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    restartGame() {
        try {
            console.log('Restarting game...');

            if (this.gameLoopId) {
                cancelAnimationFrame(this.gameLoopId);
                this.gameLoopId = null;
            }
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            this.clearGame();

            if (this.gameOverScreen) {
                this.gameOverScreen.classList.add('hidden');
            }

            this.updatePlayerPosition();

            this.stopSound();
            if (this.audio.background) {
                this.audio.background.currentTime = 0;
            }

            this.startGame();
        } catch (error) {
            console.error('Error in restartGame:', error);
        }
    }

    toggleSound() {
        try {
            this.isMuted = !this.isMuted;

            this.trackEvent('sound_toggle', {
                sound_state: this.isMuted ? 'off' : 'on',
                device_type: this.isMobile ? 'mobile' : 'desktop'
            });

            if (this.isMuted) {
                if (this.audio.background) {
                    this.audio.background.volume = 0;
                    this.audio.background.pause();
                }
            } else {
                if (this.audio.background) {
                    this.audio.background.volume = 0.3;
                    this.audio.background.play().catch(e => console.warn('Error playing background sound:', e));
                }
            }
        } catch (error) {
            console.error('Error toggling sound:', error);
        }
    }

    playSound() {
        if (!this.isMuted && this.audio.background && this.audio.background.paused) {
            this.audio.background.play().catch(e => console.warn(`Error playing background sound:`, e));
        }
    }

    stopSound() {
        if (this.audio.background) {
            this.audio.background.pause();
        }
    }

    createLivesDisplay() {
        if (!this.livesElement) {
            this.livesElement = document.createElement('div');
            this.livesElement.id = 'lives';
            this.livesElement.className = 'lives-display';

            const livesLabel = document.createElement('span');
            livesLabel.textContent = 'Жизни: ';
            this.livesElement.appendChild(livesLabel);

            this.livesCountElement = document.createElement('span');
            this.livesCountElement.className = 'lives-count';
            this.livesElement.appendChild(this.livesCountElement);

            const gameInfo = document.querySelector('.game-info');
            if (gameInfo) {
                gameInfo.appendChild(this.livesElement);
            } else if (this.gameArea) {
                this.gameArea.parentNode.insertBefore(this.livesElement, this.gameArea);
            }
        } else {
            this.livesCountElement = this.livesElement.querySelector('.lives-count');
            if (!this.livesCountElement) {
                this.livesCountElement = document.createElement('span');
                this.livesCountElement.className = 'lives-count';
                this.livesElement.appendChild(this.livesCountElement);
            }
        }

        this.updateLivesDisplay();
    }

    updateLivesDisplay() {
        if (!this.livesCountElement) {
            this.livesCountElement = document.querySelector('.lives-count');
        }

        if (this.livesCountElement) {
            let heartsHTML = '';
            for (let i = 0; i < this.lives; i++) {
                heartsHTML += '❤️';
            }
            for (let i = this.lives; i < 3; i++) {
                heartsHTML += '🖤';
            }
            this.livesCountElement.innerHTML = heartsHTML;
        } else {
            console.error('Не удалось найти элемент для отображения жизней');
        }
    }

    createLeaderboardButton() {
        let leaderboardBtn = document.getElementById('leaderboard-btn');

        if (!leaderboardBtn) {
            leaderboardBtn = document.createElement('button');
            leaderboardBtn.id = 'leaderboard-btn';
            leaderboardBtn.className = 'trophy-button';
            leaderboardBtn.innerHTML = '🏆';
            leaderboardBtn.title = 'Таблица рекордов';

            const controlsRight = document.querySelector('.controls-right');
            if (controlsRight) {
                controlsRight.appendChild(leaderboardBtn);
            }
        }

        leaderboardBtn.addEventListener('click', () => {
            this.updateLeaderboard();
            const leaderboard = document.getElementById('leaderboard');
            if (leaderboard) {
                leaderboard.classList.remove('hidden');
            }
        });
    }

    gameLoop() {
        if (this.isGameOver) return;

        if (Math.random() < this.obstacleProbability) {
            this.createObstacle();
        }
        if (Math.random() < this.coinProbability) {
            this.createCoin();
        }

        this.moveObstacles();
        this.moveCoins();

        this.gameLoopId = requestAnimationFrame(this.gameLoop.bind(this));
    }

    checkIsMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    trackEvent(eventName, params = {}) {
        try {
            if (typeof ym !== 'undefined') {
                console.log(`Отправка события: ${eventName}`, params);
                ym(105524141, 'reachGoal', eventName, params);
            }
        } catch (error) {
            console.error('Ошибка при отправке события в метрику:', error);
        }
    }
}

window.addEventListener('load', () => {
    const game = new Game();

    if (game.authScreen) game.authScreen.classList.remove('hidden');
    if (game.gameContainer) game.gameContainer.classList.add('hidden');

    const gameRulesBlock = document.querySelector('#auth-screen .game-rules');
    const pendingScoreAuthMsg = document.getElementById('pending-score-auth-message');

    if (gameRulesBlock) gameRulesBlock.classList.remove('hidden');
    if (pendingScoreAuthMsg) pendingScoreAuthMsg.classList.add('hidden');

    const authForm = document.getElementById('auth-form');
    if (authForm) {
        const phoneInput = document.getElementById('player-phone');
        if (phoneInput) {
            phoneInput.required = false;
            phoneInput.hidden = true;
            phoneInput.disabled = true;
            const formGroup = phoneInput.closest('.form-group');
            if (formGroup) {
                formGroup.classList.add('form-group-hidden');
            }
        }

        const startButton = document.getElementById('start-game-btn');
        if (startButton) {
            startButton.textContent = 'Начать игру';
        }
    }
});