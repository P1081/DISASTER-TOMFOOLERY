const MAP_SIZE = 100;
const TILE_PIXELS = 12;
const ISLAND_DIMENSION = MAP_SIZE * TILE_PIXELS;

const viewport = document.getElementById('viewport');
const cameraSpace = document.getElementById('camera-space');
const mapIsland = document.getElementById('map-island');
const cityModal = document.getElementById('city-modal-overlay');
const hotbarContainer = document.getElementById('inventory-hotbar');

const txtCash = document.getElementById('stat-cash');
const txtPeople = document.getElementById('stat-people');
const txtWave = document.getElementById('stat-wave');
const warningAlert = document.getElementById('warning-alert');
const toastNotification = document.getElementById('toast-notification');
const volcanoOverlay = document.getElementById('volcano-overlay');
const gameOverScreen = document.getElementById('game-over-screen');
const playAgainBtn = document.getElementById('play-again-btn');
const gameOverWaves = document.getElementById('game-over-waves');
const introOverlay = document.getElementById('intro-overlay');
const introImagePrimary = document.getElementById('intro-image-primary');
const introImageAlt = document.getElementById('intro-image-alt');
const introText = document.getElementById('intro-text');
const introActionBtn = document.getElementById('intro-action-btn');
const flashOverlay = document.getElementById('flash-overlay');
const statsPreviewImg = document.getElementById('stats-preview-img-frame');

const lblLeftHeader = document.getElementById('left-panel-header-title');
const lblRightHeader = document.getElementById('right-panel-header-title');
const txtModalTitle = document.getElementById('modal-title');
const txtModalLevel = document.getElementById('modal-level');
const txtModalStatus = document.getElementById('modal-status');
const btnModalUpgrade = document.getElementById('modal-upgrade-btn');
const groupTier2Shop = document.getElementById('shop-tier-2-group');
const txtTier2Banner = document.getElementById('tier-2-banner-title');

const wrapperShopView = document.getElementById('shop-view-wrapper');
const wrapperStatsView = document.getElementById('house-stats-view-wrapper');
const lblStatsPeople = document.getElementById('stats-people-label');
const lblStatsStatus = document.getElementById('stats-status-label');

let camX = (window.innerWidth / 2) - (ISLAND_DIMENSION / 2);
let camY = (window.innerHeight / 2) - (ISLAND_DIMENSION / 2);
let zoom = 1.0;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4.0;

const drums = new Audio('sounds/drum-sample.mp3');
const prepMusic = new Audio('sounds/lexycat - glitter instrumental (2024).mp3');
const waveMusic = new Audio('sounds/Kubbi - Up In My Jam  NO COPYRIGHT 8-bit Music.mp3');
const waveWarningSound = new Audio('sounds/Amber alert Sound Effect  Soundboard Link.mp3');
const explode = new Audio('sounds/roblox-explosion-sound.mp3');
const extraboom = new Audio('sounds/ddg-boom_KZ9NU4w.mp3');

drums.loop = true;
prepMusic.loop = true;
waveMusic.loop = true;

let isDragging = false;
let startX = 0, startY = 0;
let hasMovedSignificantly = false;
let initialPinchDistance = 0;
let initialZoom = 1.0;
let touchStartTime = 0;
let previewEl = null;

let currentCash = 100;
let peopleCount = 0;
let waveCount = 1;
let cityLevel = 1;

let currentModalContext = { type: 'CITY', targetObj: null };
let trashNodes = [];
let lastTrashSpawnAt = 0;

const FREE_TIME_MS = 60000;
const WARNING_DURATION_MS = 3000;
const WAVE_DURATION_MS = 60000;
const WARNING_PHASE_MS = 10000;
let waveRound = 1;
let waveEndsAt = Date.now() + FREE_TIME_MS;
let waveTimerInterval = null;
let earthquakeCooldownUntil = 0;
let earthquakeInterval = null;
let floodActiveTiles = [];
let floodExpansionInterval = null;
let floodExpansionStep = 0;
let volcanoDamageInterval = null;
let volcanoExpansionInterval = null;
let isWaveActive = false;
let activeEventNames = [];
let waveWarningScheduled = false;
let temporaryTrashTiles = [];
let trashSpawnerInterval = null;
let gameOverState = false;
let introPhase = 0;
let introActive = true;
const EVENT_TYPES = ['Flooding', 'Earthquake', 'Volcano', 'Corcs'];
let volcanoActiveTiles = [];
let floodPathQueue = [];

let cityEvacTimer = null;
let cityEvacWarningActive = false;

let inventoryStore = {
    Village: { count: 0, image: 'images/house.png', fallback: '🏡', label: 'Village', cost: 50 },
    Farm: { count: 0, image: 'images/farm.png', fallback: '🌾', label: 'Farm', cost: 10 },
    Forest: { count: 0, image: 'images/tree.png', fallback: '🌳', label: 'Forest', cost: 10 },
    Evacuation: { count: 0, image: 'images/evacuation.png', fallback: '🏕️', label: 'Evacuation', cost: 100 },
    Hotel: { count: 0, image: 'images/hotel.png', fallback: '🏨', label: 'Hotel', cost: 250 },
    Hospital: { count: 0, image: 'images/hospital.png', fallback: '🏥', label: 'Hospital', cost: 150 },
    School: { count: 0, image: 'images/school.png', fallback: '🏫', label: 'School', cost: 120 }
};

let equippedHandItem = null;
let structuresRegistry = [];
let gridData = Array(MAP_SIZE).fill(null).map(() => Array(MAP_SIZE).fill(null));

function playSound(audio) {
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

function playDrumsAtStart() {
    drums.play().catch(() => {
        const unlock = () => {
            drums.play().catch(() => {});
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
        };
        window.addEventListener('click', unlock);
        window.addEventListener('touchstart', unlock);
    });
}

function showToast(message) {
    if (!toastNotification) return;
    toastNotification.innerText = message;
    toastNotification.classList.add('toast-visible');
    setTimeout(() => {
        toastNotification.classList.remove('toast-visible');
    }, 3000);
}

function calculatePeopleCount() {
    let villagePeople = structuresRegistry
        .filter(s => s.type === 'Village')
        .reduce((sum, house) => sum + (house.level * 5), 0);
    let hotelPeople = structuresRegistry
        .filter(s => s.type === 'Hotel')
        .reduce((sum, hotel) => sum + (hotel.level * 10), 0);
    let farmPeople = structuresRegistry.filter(s => s.type === 'Farm').length;
    let evacuationPeople = structuresRegistry
        .filter(s => s.type === 'Evacuation')
        .reduce((sum, evac) => sum + (evac.storedPeople || 0), 0);
    let hospitalPeople = structuresRegistry
        .filter(s => s.type === 'Hospital')
        .reduce((sum, hosp) => sum + (hosp.storedPeople || 1), 0);
    let schoolPeople = structuresRegistry
        .filter(s => s.type === 'School')
        .reduce((sum, sch) => sum + (sch.storedPeople || 0), 0);

    return 10 + villagePeople + hotelPeople + farmPeople + evacuationPeople + hospitalPeople + schoolPeople;
}

function refreshPeopleCount() {
    peopleCount = calculatePeopleCount();
    if (txtPeople) txtPeople.innerText = peopleCount;
    checkGameOver();
}

function calculateActiveFarms() {
    const totalFarms = structuresRegistry.filter(s => s.type === 'Farm').length;
    const moneyBuildingsCount = 1 + structuresRegistry.filter(s => s.type === 'Village' || s.type === 'Hotel').length;
    const farmCapacity = moneyBuildingsCount * 2;
    const activeFarms = Math.min(totalFarms, farmCapacity);
    return { activeFarms, farmCapacity, totalFarms };
}

function checkCityRiverProximity() {
    if (gameOverState) return;

    const city = structuresRegistry.find(s => s.type === 'City');
    if (!city) return;

    let isRiverTouchingCity = false;
    for (let r = city.row - 1; r <= city.row + city.size; r++) {
        for (let c = city.col - 1; c <= city.col + city.size; c++) {
            const tile = gridData[r]?.[c];
            if (tile && tile.biome === 'river') {
                isRiverTouchingCity = true;
                break;
            }
        }
        if (isRiverTouchingCity) break;
    }

    const hasEvac = structuresRegistry.some(s => s.type === 'Evacuation');

    if (isRiverTouchingCity && !hasEvac) {
        if (!cityEvacTimer) {
            cityEvacWarningActive = true;
            showWarningAlert("WARNING!\nRiver touching City! Build Evacuation within 10s!");
            showToast("Flood touching City! Build Evacuation in 10s!");
            cityEvacTimer = setTimeout(() => {
                if (gameOverState) return;
                const currentEvac = structuresRegistry.some(s => s.type === 'Evacuation');
                if (!currentEvac) {
                    gameOverState = true;
                    showWarningAlert("GAME OVER\nCity flooded without Evacuation center!");
                    showToast("GAME OVER");
                    triggerGameOverSequence();
                }
                cityEvacTimer = null;
                cityEvacWarningActive = false;
            }, 10000);
        }
    } else {
        if (cityEvacTimer) {
            clearTimeout(cityEvacTimer);
            cityEvacTimer = null;
            if (cityEvacWarningActive && hasEvac) {
                showToast("City saved by Evacuation center!");
            }
            cityEvacWarningActive = false;
        }
    }
}

function init() {
    playDrumsAtStart();
    buildProceduralIslandMap();
    createPlacementPreviewElement();
    spawnTownHallWithLabel();
    setupInputListeners();
    setupModalToggleListeners();
    setupShopPurchaseListeners();
    setupMapClickDelegation();
    setupRealTimePreviewFollower();
    setupModalUpgradeAction();
    setupGameOverRestart();
    setupIntroSequence();
    refreshPeopleCount();
    if (txtCash) txtCash.innerText = formatCash(currentCash);
    updateCameraTransform();
    setInterval(checkCityRiverProximity, 500);
}

function buildProceduralIslandMap() {
    mapIsland.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const center = MAP_SIZE / 2;

    function getNoise(x, y) {
        return (Math.sin(x * 0.12) * Math.cos(y * 0.12)) +
               (Math.sin(x * 0.4) * Math.cos(y * 0.4) * 0.3);
    }

    for (let r = 0; r < MAP_SIZE; r++) {
        for (let c = 0; c < MAP_SIZE; c++) {
            const tileDiv = document.createElement('div');

            let dist = Math.max(Math.abs(r - center) / center, Math.abs(c - center) / center);
            let noiseVal = getNoise(c, r);
            let elevation = (1.0 - dist) + (noiseVal * 0.25);

            let river1Y = center + Math.sin(c * 0.1) * 12 + (getNoise(c, 0) * 4);
            let isRiver1 = Math.abs(r - river1Y) < 2.0;
            let river2X = center - 10 + Math.cos(r * 0.08) * 15;
            let isRiver2 = Math.abs(c - river2X) < 1.8;

            let biomeClass = 'deep-ocean';

            if (isRiver1 || isRiver2) {
                if (elevation > 0.36) biomeClass = 'river';
                else if (elevation > 0.22) biomeClass = 'shallow-water';
            } else {
                if (elevation > 0.65) biomeClass = 'inner-land';
                else if (elevation > 0.38) biomeClass = 'land';
                else if (elevation > 0.32) biomeClass = 'beach';
                else if (elevation > 0.18) biomeClass = 'shallow-water';
            }

            tileDiv.className = `tile ${biomeClass}`;
            tileDiv.dataset.row = r;
            tileDiv.dataset.col = c;
            tileDiv.id = `tile-${r}-${c}`;

            gridData[r][c] = {
                row: r, col: c,
                biome: biomeClass,
                hasStructure: false,
                isGrayTile: false,
                element: tileDiv
            };

            fragment.appendChild(tileDiv);
        }
    }
    mapIsland.appendChild(fragment);
}

function createPlacementPreviewElement() {
    previewEl = document.createElement('div');
    previewEl.id = 'placement-preview-layer';
    mapIsland.appendChild(previewEl);
}

function spawnTownHallWithLabel() {
    const minDistanceFromRiver = 5; 
    const citySize = 4; 

    const riverTiles = [];
    for (let r = 0; r < MAP_SIZE; r++) {
        for (let c = 0; c < MAP_SIZE; c++) {
            if (gridData[r][c].biome === 'river') {
                riverTiles.push({ row: r, col: c });
            }
        }
    }

    function distance(r1, c1, r2, c2) {
        return Math.sqrt((r1 - r2) ** 2 + (c1 - c2) ** 2);
    }

    const candidateSpots = [];
    for (let r = 20; r <= MAP_SIZE - 20 - citySize; r++) {
        for (let c = 20; c <= MAP_SIZE - 20 - citySize; c++) {
            let farEnough = true;
            for (const riverTile of riverTiles) {
                if (distance(r, c, riverTile.row, riverTile.col) < minDistanceFromRiver) {
                    farEnough = false;
                    break;
                }
            }
            if (!farEnough) continue;

            let spaceClear = true;
            for (let h = 0; h < citySize; h++) {
                for (let w = 0; w < citySize; w++) {
                    const tile = gridData[r + h][c + w];
                    if (tile.hasStructure || tile.biome !== 'inner-land') {
                        spaceClear = false;
                        break;
                    }
                }
                if (!spaceClear) break;
            }
            if (spaceClear) {
                candidateSpots.push({ row: r, col: c });
            }
        }
    }

    let targetRow = 46; 
    let targetCol = 45;
    if (candidateSpots.length > 0) {
        const choice = candidateSpots[Math.floor(Math.random() * candidateSpots.length)];
        targetRow = choice.row;
        targetCol = choice.col;
    }

    const townHallDiv = document.createElement('div');
    townHallDiv.className = 'townhall-sprite';
    townHallDiv.style.left = `${targetCol * TILE_PIXELS}px`;
    townHallDiv.style.top = `${targetRow * TILE_PIXELS}px`;

    for(let h=0; h<citySize; h++) {
        for(let w=0; w<citySize; w++) {
            gridData[targetRow+h][targetCol+w].hasStructure = true;
        }
    }

    const textLabelDiv = document.createElement('div');
    textLabelDiv.className = 'city-floating-label';
    textLabelDiv.id = 'floating-city-label-text';
    textLabelDiv.innerText = 'CITY Lvl 1';
    townHallDiv.appendChild(textLabelDiv);

    const invisibleHitboxBtn = document.createElement('div');
    invisibleHitboxBtn.className = 'universal-click-hitbox';
    townHallDiv.appendChild(invisibleHitboxBtn);

    function triggerCityOpen(e) {
        e.stopPropagation(); e.preventDefault();
        let clickDuration = Date.now() - touchStartTime;
        if (clickDuration < 300) { openLeftPanelContext('CITY', null); }
    }

    invisibleHitboxBtn.addEventListener('mousedown', (e) => { touchStartTime = Date.now(); });
    invisibleHitboxBtn.addEventListener('touchstart', (e) => { touchStartTime = Date.now(); }, { passive: true });
    invisibleHitboxBtn.addEventListener('mouseup', triggerCityOpen);
    invisibleHitboxBtn.addEventListener('touchend', triggerCityOpen);

    mapIsland.appendChild(townHallDiv);

    structuresRegistry.push({
        id: 'CITY',
        type: 'City',
        row: targetRow,
        col: targetCol,
        size: citySize,
        level: cityLevel,
        domElement: townHallDiv
    });

    camX = (window.innerWidth / 2) - (targetCol * TILE_PIXELS * zoom);
    camY = (window.innerHeight / 2) - (targetRow * TILE_PIXELS * zoom);
}

function openLeftPanelContext(type, targetObj) {
    currentModalContext.type = type;
    currentModalContext.targetObj = targetObj;
    let previewSrc = 'images/house2.jpg';
    let previewAlt = 'Structure Preview';

    if (type === 'CITY') {
        lblLeftHeader.innerText = 'City Details';
        lblRightHeader.innerText = 'Shop Menu';
        txtModalTitle.innerText = 'TOWN CITY';
        txtModalLevel.innerText = `Lvl ${cityLevel}`;
        txtModalStatus.innerText = `Core Town Hall. Gives money per 20s. Startup people: 10.`;
        previewSrc = 'images/City.png';
        previewAlt = 'City Preview';

        if (cityLevel < 2) {
            btnModalUpgrade.innerText = `Upgrade: 200 pesos`;
            btnModalUpgrade.style.display = 'block';
        } else {
            btnModalUpgrade.innerText = `MAX LEVEL REACHED`;
            btnModalUpgrade.style.display = 'block';
        }

        wrapperShopView.style.display = 'flex';
        wrapperStatsView.style.display = 'none';
    } else {
        lblLeftHeader.innerText = 'Structure Info';
        lblRightHeader.innerText = 'Stats Board';
        wrapperShopView.style.display = 'none';
        wrapperStatsView.style.display = 'flex';

        if (type === 'HOUSE' || type === 'HOTEL') {
            txtModalTitle.innerText = type === 'HOUSE' ? 'VILLAGE' : 'HOTEL';
            txtModalLevel.innerText = `Lvl ${targetObj.level}`;
            txtModalStatus.innerText = targetObj.status || 'Active structure generating revenue.';

            lblStatsPeople.innerText = `People Count: ${type === 'HOUSE' ? targetObj.level * 5 : targetObj.level * 10}`;
            lblStatsStatus.innerText = `Status: Operating (Yields ${targetObj.yieldAmount} ₱)`;

            if (targetObj.level < 5) {
                btnModalUpgrade.innerText = `Upgrade: ${targetObj.level * 50} pesos`;
                btnModalUpgrade.style.display = 'block';
            } else {
                btnModalUpgrade.innerText = `MAX LEVEL REACHED`;
                btnModalUpgrade.style.display = 'block';
            }

            if (type === 'HOUSE') {
                previewSrc = 'images/house2.jpg';
                previewAlt = 'Village Preview';
            } else {
                previewSrc = 'images/hotel2.png';
                previewAlt = 'Hotel Preview';
            }
        } else if (type === 'EVACUATION') {
            txtModalTitle.innerText = 'EVACUATION';
            txtModalLevel.innerText = `Max Capacity: 50`;
            txtModalStatus.innerText = `Stores displaced people when flood hits villages or hotels. Limit: 2 per map.`;
            lblStatsPeople.innerText = `People Stored: ${targetObj.storedPeople || 0} / 50`;
            lblStatsStatus.innerText = `Status: Active Shelter`;
            btnModalUpgrade.style.display = 'none';
        } else if (type === 'HOSPITAL') {
            txtModalTitle.innerText = 'HOSPITAL';
            txtModalLevel.innerText = `Max Capacity: 10`;
            txtModalStatus.innerText = `Stores evacuees when evacuation is full. Gives money based on people inside.`;
            lblStatsPeople.innerText = `People Stored: ${targetObj.storedPeople || 1} / 20`;
            lblStatsStatus.innerText = `Earnings: ${(targetObj.storedPeople || 1) * 5} ₱ per 5s`;
            btnModalUpgrade.style.display = 'none';
            previewSrc = 'images/hospital2.png';
            previewAlt = 'Hospital Preview';
        } else if (type === 'SCHOOL') {
            txtModalTitle.innerText = 'SCHOOL';
            txtModalLevel.innerText = `Lvl 1`;
            txtModalStatus.innerText = `Takes 5% of Village people count. Transfers them to Hospital after 1 minute.`;
            lblStatsPeople.innerText = `Students Stored: ${targetObj.storedPeople || 0}`;
            lblStatsStatus.innerText = `Status: In Session`;
            btnModalUpgrade.style.display = 'none';
            previewSrc = 'images/school2.png';
            previewAlt = 'School Preview';
        } else {
            txtModalTitle.innerText = targetObj.type.toUpperCase();
            txtModalLevel.innerText = `Lvl 1`;
            txtModalStatus.innerText = `Structure placed on the map.`;
            lblStatsPeople.innerText = `People: ${targetObj.type === 'Farm' ? 1 : 0}`;
            lblStatsStatus.innerText = `Status: Active`;
            btnModalUpgrade.style.display = 'none';

            if (type === 'HOTEL') {
                previewSrc = 'images/hotel2.png';
                previewAlt = 'Hotel Preview';
            } else if (type === 'HOUSE') {
                previewSrc = 'images/house2.jpg';
                previewAlt = 'Village Preview';
            } else if (type === 'EVACUATION') {
                previewSrc = 'images/evacuation.png';
                previewAlt = 'Evacuation Preview';
            } else if (type === 'FARM') {
                previewSrc = 'images/farm.png';
                previewAlt = 'Farm Preview';
            } else if (type === 'FOREST') {
                previewSrc = 'images/tree.png';
                previewAlt = 'Forest Preview';
            }
        }
    }

    if (statsPreviewImg) {
        statsPreviewImg.src = previewSrc;
        statsPreviewImg.alt = previewAlt;
    }
    cityModal.style.display = 'flex';
}

function setupIntroSequence() {
    if (!introOverlay || (!introImagePrimary && !introImageAlt) || !introText || !introActionBtn || !flashOverlay) return;
    introActive = true;
    introPhase = 0;
    introOverlay.style.display = 'flex';
    introOverlay.classList.remove('hidden');
    if (introImagePrimary) { introImagePrimary.classList.remove('hidden'); }
    if (introImageAlt) { introImageAlt.classList.add('hidden'); }
    introText.innerText = 'HAHAHAHAHAHA';
    introActionBtn.innerText = 'Click to continue';
    flashOverlay.classList.add('visible');
    setTimeout(() => {
        flashOverlay.classList.remove('visible');
    }, 350);
    
    introActionBtn.onclick = handleIntroClick;
}

function handleIntroClick() {
    if (introPhase === 0) {
        introPhase = 1;
        if (introImagePrimary) introImagePrimary.classList.add('hidden');
        if (introImageAlt) introImageAlt.classList.remove('hidden');
        introText.innerText = "I'll give you a challenge";
        introActionBtn.innerText = 'Click to continue';
        return;
    }
    if (introPhase === 1) {
        introPhase = 2;
        introText.innerText = "Let's see if you could manage your own island";
        introActionBtn.innerText = 'Start';
        return;
    }
    if (introPhase === 2) {
        introOverlay.classList.add('hidden');
        flashOverlay.classList.add('visible');
        setTimeout(() => {
            introOverlay.style.display = 'none';
            flashOverlay.classList.remove('visible');
            introActive = false;
            startGameplay();
            drums.pause();
            drums.currentTime = 0;
        }, 500);
    }
}

function startGameplay() {
    startGlobalProductionTimers();
    startTreeDefenseTimer();
    startSchoolTransferTimer();
    startTrashSpawner();
    startWaveTimer();
}

function triggerGameOverSequence() {
    if (!flashOverlay || !gameOverScreen || !gameOverWaves) return;
    flashOverlay.classList.add('visible');
    const wavesSurvived = Math.max(1, waveRound);
    gameOverWaves.innerText = `Waves survived: ${wavesSurvived}`;
    setTimeout(() => {
        flashOverlay.classList.remove('visible');
        gameOverScreen.style.display = 'flex';
    }, 450);
}

function setupModalUpgradeAction() {
    btnModalUpgrade.addEventListener('click', () => {
        if (currentModalContext.type === 'CITY') {
            if (cityLevel < 2 && currentCash >= 200) {
                updateCashBalance(-200);
                cityLevel = 2;
                groupTier2Shop.classList.remove('locked-tier');
                txtTier2Banner.innerText = 'Lvl 2 Structures';
                const floatingLbl = document.getElementById('floating-city-label-text');
                if (floatingLbl) floatingLbl.innerText = 'CITY Lvl 2';
                openLeftPanelContext('CITY', null);
            } else if (currentCash < 200) {
                flashCashText();
            }
        } else if (currentModalContext.type === 'HOUSE' || currentModalContext.type === 'HOTEL') {
            const structure = currentModalContext.targetObj;
            if (!structure) return;
            const upgradeCost = structure.level * 50;

            if (structure.level < 5 && currentCash >= upgradeCost) {
                updateCashBalance(-upgradeCost);
                structure.level += 1;
                structure.yieldAmount += structure.type === 'Hotel' ? 15 : 10;

                const labelNode = structure.domElement.querySelector('.structure-floating-label');
                if (labelNode) labelNode.innerText = structure.type === 'Hotel' ? `Hotel Lvl ${structure.level}` : `Village Lvl ${structure.level}`;

                refreshPeopleCount();
                openLeftPanelContext(structure.type === 'Hotel' ? 'HOTEL' : 'HOUSE', structure);
            } else if (currentCash < upgradeCost) {
                flashCashText();
            }
        }
    });
}

function formatCash(value) {
    return value.toLocaleString('en-US');
}

let cashFlashCooldown = false;
function flashCashText(duration = 1000) {
    if (cashFlashCooldown) return;
    cashFlashCooldown = true;

    const originalColor = window.getComputedStyle(txtCash).color;
    txtCash.style.transition = 'color 0.2s ease';
    txtCash.style.color = 'red';

    setTimeout(() => {
        txtCash.style.color = originalColor;
        setTimeout(() => { cashFlashCooldown = false; }, 200);
    }, duration);
}

function setupRealTimePreviewFollower() {
    function processMovePreview(clientX, clientY) {
        if (!equippedHandItem || !previewEl) return;
        const size = equippedHandItem === 'Forest' ? 1 : 4;
        const rect = mapIsland.getBoundingClientRect();
        const localX = (clientX - rect.left) / zoom;
        const localY = (clientY - rect.top) / zoom;
        let snapCol = Math.round((localX - 24) / TILE_PIXELS);
        let snapRow = Math.round((localY - 24) / TILE_PIXELS);
        snapCol = Math.max(0, Math.min(MAP_SIZE - size, snapCol));
        snapRow = Math.max(0, Math.min(MAP_SIZE - size, snapRow));
        const previewPixelSize = 48;
        previewEl.style.width = `${previewPixelSize}px`;
        previewEl.style.height = `${previewPixelSize}px`;
        previewEl.style.display = 'block';
        previewEl.style.left = `${snapCol * TILE_PIXELS}px`;
        previewEl.style.top = `${snapRow * TILE_PIXELS}px`;

        let isSpotValid = true;
        for (let h = 0; h < size; h++) {
            for (let w = 0; w < size; w++) {
                const tile = gridData[snapRow + h]?.[snapCol + w];
                if (!tile) { isSpotValid = false; break; }
                if (tile.hasStructure || tile.floodBlocked || tile.biome === 'river' || tile.biome === 'deep-ocean' || tile.biome === 'shallow-water') { isSpotValid = false; break; }
                if (tile.isGrayTile && equippedHandItem !== 'Forest') { isSpotValid = false; break; }
            }
            if (!isSpotValid) break;
        }
        previewEl.className = isSpotValid ? 'valid-spot' : 'invalid-spot';
    }
    window.addEventListener('mousemove', (e) => { processMovePreview(e.clientX, e.clientY); });
    window.addEventListener('touchmove', (e) => { if (e.touches.length === 1) processMovePreview(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
}

function setupMapClickDelegation() {
    mapIsland.addEventListener('click', (e) => {
        if (hasMovedSignificantly) return;
        if (!equippedHandItem) return;

        const rect = mapIsland.getBoundingClientRect();
        const localX = (e.clientX - rect.left) / zoom; const localY = (e.clientY - rect.top) / zoom;
        const size = equippedHandItem === 'Forest' ? 1 : 4;
        let c = Math.round((localX - 24) / TILE_PIXELS); let r = Math.round((localY - 24) / TILE_PIXELS);
        c = Math.max(0, Math.min(MAP_SIZE - size, c)); r = Math.max(0, Math.min(MAP_SIZE - size, r));

        deployStructureToMap(r, c, equippedHandItem);
    });
}

function setupShopPurchaseListeners() {
    function tryPurchase(type, cost, requiresLvl2 = false) {
        if (requiresLvl2 && cityLevel < 2) {
            showToast("Requires City Level 2!");
            flashCashText();
            return;
        }

        if (type === 'Evacuation') {
            const existingEvacs = structuresRegistry.filter(s => s.type === 'Evacuation').length + inventoryStore.Evacuation.count;
            if (existingEvacs >= 2) {
                showToast("Limit Reached: Only 2 Evacuation structures allowed!");
                return;
            }
        }

        if (currentCash >= cost) {
            updateCashBalance(-cost);
            inventoryStore[type].count += 1;
            renderInventoryBarDeck();
        } else {
            flashCashText();
        }
    }

    document.getElementById('buy-village-btn').addEventListener('click', () => tryPurchase('Village', 50));
    document.getElementById('buy-farm-btn').addEventListener('click', () => tryPurchase('Farm', 10));
    document.getElementById('buy-tree-btn').addEventListener('click', () => tryPurchase('Forest', 10));
    document.getElementById('buy-evacuation-btn').addEventListener('click', () => tryPurchase('Evacuation', 100));
    document.getElementById('buy-hotel-btn').addEventListener('click', () => tryPurchase('Hotel', 250, true));
    document.getElementById('buy-hospital-btn').addEventListener('click', () => tryPurchase('Hospital', 150, true));
    document.getElementById('buy-school-btn').addEventListener('click', () => tryPurchase('School', 120, true));
}

function renderInventoryBarDeck() {
    hotbarContainer.innerHTML = ''; let hasItems = false;
    for (let key in inventoryStore) {
        if (inventoryStore[key].count > 0) {
            hasItems = true; const card = document.createElement('div'); card.className = 'inventory-slot-card';
            if (equippedHandItem === key) card.classList.add('selected');
            card.innerHTML = `<img src="${inventoryStore[key].image}" alt="${inventoryStore[key].label}" class="slot-card-image-node" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"><span class="emoji-card-icon" style="display:none;">${inventoryStore[key].fallback}</span><div class="slot-card-title">${inventoryStore[key].label}</div><div class="slot-card-counter-badge">${inventoryStore[key].count}</div>`;
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                if (equippedHandItem === key) { equippedHandItem = null; if (previewEl) previewEl.style.display = 'none'; }
                else { equippedHandItem = key; if (previewEl) previewEl.innerHTML = `<img src="${inventoryStore[key].image}" alt="${inventoryStore[key].label}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"><span style="font-size:24px;display:none;">${inventoryStore[key].fallback}</span>`; }
                renderInventoryBarDeck();
            });
            hotbarContainer.appendChild(card);
        }
    }
    if (!hasItems) hotbarContainer.innerHTML = '<div class="empty-slot-placeholder-text">Inventory Empty - Open City Shop</div>';
}

function deployStructureToMap(r, c, type) {
    if (gameOverState) return;
    if (inventoryStore[type].count <= 0) return;

    if (type === 'Evacuation') {
        const placedEvacs = structuresRegistry.filter(s => s.type === 'Evacuation').length;
        if (placedEvacs >= 2) {
            showToast("Limit Reached: Only 2 Evacuation structures allowed!");
            return;
        }
    }

    const size = type === 'Forest' ? 1 : 4;
    for (let h = 0; h < size; h++) {
        for (let w = 0; w < size; w++) {
            const tile = gridData[r + h]?.[c + w];
            if (!tile) return;
            if (tile.hasStructure || tile.floodBlocked || tile.biome === 'river' || tile.biome === 'deep-ocean' || tile.biome === 'shallow-water') return;
            if (tile.isGrayTile && type !== 'Forest') return;
        }
    }

    if (type === 'Forest') {
        for (let h = 0; h < size; h++) {
            for (let w = 0; w < size; w++) {
                const tile = gridData[r + h]?.[c + w];
                if (tile && tile.isGrayTile) {
                    tile.isGrayTile = false;
                    tile.blockedByTrash = false;
                    tile.element.classList.remove('gray-tile', 'dark-trash-zone');
                }
            }
        }
    }

    for (let h = 0; h < size; h++) {
        for (let w = 0; w < size; w++) {
            gridData[r + h][c + w].hasStructure = true;
        }
    }

    inventoryStore[type].count -= 1;

    const structDiv = document.createElement('div');
    structDiv.className = 'placed-structure-large';
    structDiv.style.left = `${c * TILE_PIXELS}px`;
    structDiv.style.top = `${r * TILE_PIXELS}px`;
    structDiv.innerHTML = `<img src="${inventoryStore[type].image}" alt="${type}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"><span style="font-size:36px; display:none; text-align:center; line-height:1;">${inventoryStore[type].fallback || '🏠'}</span>`;

    const labelNode = document.createElement('div');
    labelNode.className = 'structure-floating-label';
    labelNode.innerText = `${inventoryStore[type].label} Lvl 1`;
    structDiv.appendChild(labelNode);

    const hitboxBtn = document.createElement('div');
    hitboxBtn.className = 'universal-click-hitbox';
    structDiv.appendChild(hitboxBtn);

    const structInstance = {
        id: Date.now() + Math.random(),
        type: type,
        row: r,
        col: c,
        size: size,
        level: 1,
        yieldAmount: type === 'Hotel' ? 50 : type === 'Village' ? 20 : 0,
        domElement: structDiv,
        isForest: type === 'Forest',
        storedPeople: type === 'Hospital' ? 1 : 0
    };

    function triggerStructOpen(e) {
        e.stopPropagation();
        e.preventDefault();
        let duration = Date.now() - touchStartTime;
        if (duration < 300) {
            if (type === 'Village') openLeftPanelContext('HOUSE', structInstance);
            else if (type === 'Hotel') openLeftPanelContext('HOTEL', structInstance);
            else openLeftPanelContext(type.toUpperCase(), structInstance);
        }
    }

    hitboxBtn.addEventListener('mousedown', () => touchStartTime = Date.now());
    hitboxBtn.addEventListener('touchstart', () => touchStartTime = Date.now(), { passive: true });
    hitboxBtn.addEventListener('mouseup', triggerStructOpen);
    hitboxBtn.addEventListener('touchend', triggerStructOpen);

    mapIsland.appendChild(structDiv);
    structuresRegistry.push(structInstance);

    refreshPeopleCount();

    if (inventoryStore[type].count <= 0) {
        equippedHandItem = null;
        if (previewEl) previewEl.style.display = 'none';
    }
    renderInventoryBarDeck();

    spawnTrashNearby(structInstance);
}

function spawnTrashNearby(anchorStructure) {
    if (!anchorStructure) return;
    if (Date.now() - lastTrashSpawnAt < 5000) return;
    if (trashNodes.length >= 5) return;

    const currentPeople = calculatePeopleCount();
    const spawnChance = Math.max(0.1, 0.8 - (currentPeople * 0.005));
    if (Math.random() > spawnChance) return;

    const anchorRow = anchorStructure.row;
    const anchorCol = anchorStructure.col;
    const validSpots = [];

    for (let radius = 2; radius <= 6; radius++) {
        for (let r = anchorRow - radius; r <= anchorRow + radius; r++) {
            for (let c = anchorCol - radius; c <= anchorCol + radius; c++) {
                const tile = gridData[r]?.[c];
                if (!tile || tile.blockedByTrash || tile.isGrayTile || tile.hasStructure) continue;
                if (tile.biome === 'river' || tile.biome === 'deep-ocean' || tile.biome === 'shallow-water') continue;
                validSpots.push({ row: r, col: c });
            }
        }
    }

    if (validSpots.length === 0) return;
    const foundSpot = validSpots[Math.floor(Math.random() * validSpots.length)];

    const trashNode = document.createElement('div');
    trashNode.className = 'trash-node';
    trashNode.style.left = `${foundSpot.col * TILE_PIXELS}px`;
    trashNode.style.top = `${foundSpot.row * TILE_PIXELS}px`;
    trashNode.innerHTML = '<img src="images/trash.png" alt="Trash" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline\';" /><span style="font-size:14px;display:none;">🗑️</span>';

    const trashObject = {
        row: foundSpot.row,
        col: foundSpot.col,
        domElement: trashNode,
        timeoutId: null,
        cleaned: false
    };

    trashNode.addEventListener('click', (e) => {
        e.stopPropagation();
        if (trashObject.cleaned) return;
        trashObject.cleaned = true;
        updateCashBalance(35);
        trashObject.domElement.remove();
        if (trashObject.timeoutId) clearTimeout(trashObject.timeoutId);
        trashNodes = trashNodes.filter(node => node !== trashObject);
    });

    mapIsland.appendChild(trashNode);
    trashNodes.push(trashObject);
    lastTrashSpawnAt = Date.now();

    trashObject.timeoutId = setTimeout(() => {
        if (trashObject.cleaned) return;

        const tile = gridData[trashObject.row]?.[trashObject.col];
        if (tile) {
            tile.isGrayTile = true;
            tile.blockedByTrash = true;
            tile.element.classList.add('gray-tile', 'dark-trash-zone');
        }

        trashObject.domElement.remove();
        trashNodes = trashNodes.filter(node => node !== trashObject);
    }, 10000);
}

function startTreeDefenseTimer() {
    setInterval(() => {
        const forests = structuresRegistry.filter(s => s.type === 'Forest');
        if (forests.length === 0 || floodActiveTiles.length === 0) return;

        forests.forEach(forest => {
            const tilesToRevert = [];
            for (let r = forest.row; r < forest.row + forest.size; r++) {
                for (let c = forest.col; c < forest.col + forest.size; c++) {
                    const tile = gridData[r]?.[c];
                    if (tile && tile.floodBlocked && tile.previousBiome) {
                        tilesToRevert.push(tile);
                    }
                }
            }
            tilesToRevert.slice(0, 5).forEach(tile => {
                tile.biome = tile.previousBiome || 'land';
                tile.floodBlocked = false;
                tile.element.className = `tile ${tile.previousBiome || 'land'}`;
                tile.element.classList.remove('flood-expanded', 'flood-blocked');
                delete tile.previousBiome;
                floodActiveTiles = floodActiveTiles.filter(active => active !== tile);
            });
        });
    }, 3000);
}

function startSchoolTransferTimer() {
    setInterval(() => {
        const schools = structuresRegistry.filter(s => s.type === 'School');
        if (schools.length === 0) return;

        const villages = structuresRegistry.filter(s => s.type === 'Village');
        const totalVillagePeople = villages.reduce((sum, v) => sum + (v.level * 5), 0);
        const schoolStudents = Math.ceil(totalVillagePeople * 0.05);

        schools.forEach(school => {
            school.storedPeople = schoolStudents;
            if (!school.schoolTimer) {
                school.schoolTimer = setTimeout(() => {
                    let studentsToTransfer = school.storedPeople || 0;
                    school.storedPeople = 0;
                    school.schoolTimer = null;

                    const hospitals = structuresRegistry.filter(s => s.type === 'Hospital');
                    for (let hosp of hospitals) {
                        if (studentsToTransfer <= 0) break;
                        let spaceAvailable = 10 - (hosp.storedPeople || 0);
                        if (spaceAvailable > 0) {
                            let adding = Math.min(spaceAvailable, studentsToTransfer);
                            hosp.storedPeople = (hosp.storedPeople || 0) + adding;
                            studentsToTransfer -= adding;
                        }
                    }

                    if (studentsToTransfer > 0) {
                        showToast(`${studentsToTransfer} students had no hospital space and left.`);
                    } else {
                        showToast("School students transferred to Hospital after 1 min!");
                    }
                    refreshPeopleCount();
                }, 60000);
            }
        });
    }, 10000);
}

function startGlobalProductionTimers() {
    let tickCount = 0;

    setInterval(() => {
        tickCount += 1;

        const { activeFarms, farmCapacity, totalFarms } = calculateActiveFarms();
        let farmPool = activeFarms;

        if (tickCount % 20 === 0) {
            let cityFarms = Math.min(2, farmPool);
            farmPool -= cityFarms;
            let cityMultiplier = Math.pow(2, cityFarms);
            let cityEarnings = 100 * cityLevel * cityMultiplier;
            updateCashBalance(cityEarnings);
        }

        if (tickCount % 10 === 0) {
            let houses = structuresRegistry.filter(s => s.type === 'Village');
            houses.forEach(h => {
                let villageFarms = Math.min(2, farmPool);
                farmPool -= villageFarms;
                let mult = Math.pow(2, villageFarms);
                updateCashBalance(h.yieldAmount * mult);
            });
        }

        if (tickCount % 5 === 0) {
            let hotels = structuresRegistry.filter(s => s.type === 'Hotel');
            hotels.forEach(h => {
                let hotelFarms = Math.min(2, farmPool);
                farmPool -= hotelFarms;
                let mult = Math.pow(2, hotelFarms);
                updateCashBalance(h.yieldAmount * mult);
            });

            let hospitals = structuresRegistry.filter(s => s.type === 'Hospital');
            hospitals.forEach(h => {
                let peopleIn = h.storedPeople || 1;
                updateCashBalance(peopleIn * 5);
            });
        }
    }, 1000);
}

function startWaveTimer() {
    playSound(prepMusic);
    isWaveActive = false;
    activeEventNames = [];
    waveWarningScheduled = false;
    waveEndsAt = Date.now() + FREE_TIME_MS;
    updateWaveTimerLabel();
    waveTimerInterval = setInterval(() => {
        if (gameOverState) return;
        const remainingMs = waveEndsAt - Date.now();
        if (remainingMs <= 0) {
            if (!isWaveActive) {
                if (!waveWarningScheduled) {
                    const eventList = getWaveEventList();
                    showWarningAlert(`WARNING\nPossible disaster: ${eventList.join(' + ')}`);
                    waveWarningScheduled = true;
                    prepMusic.pause();
                    playSound(waveWarningSound);
                    playSound(extraboom);
                    setTimeout(() => {
                        startWave(eventList);
                        waveWarningScheduled = false;
                        playSound(waveMusic);
                        waveWarningSound.pause();
                        waveWarningSound.currentTime = 0;
                        extraboom.currentTime = 0;
                    }, WARNING_DURATION_MS);
                }
            } else {
                endWave();
                waveMusic.pause();
                waveMusic.currentTime = 0;
                playSound(prepMusic);
            }
            return;
        }
        updateWaveTimerLabel(remainingMs);
    }, 1000);
}

function updateWaveTimerLabel(remainingMs = null) {
    const timeRemaining = remainingMs ?? (waveEndsAt - Date.now());
    const secondsLeft = Math.max(0, Math.ceil(timeRemaining / 1000));
    const isWarningPhase = timeRemaining <= WARNING_PHASE_MS && timeRemaining > 0;

    if (isWaveActive) {
        txtWave.innerText = `Wave ${waveRound} • ${secondsLeft}s`;
        txtWave.style.color = isWarningPhase ? '#ffd700' : '#9fa3a5';
    } else {
        txtWave.innerText = `Prep • ${secondsLeft}s`;
        txtWave.style.color = '#9fa3a5';
    }
    txtWave.style.fontWeight = 'bold';

    if (timeRemaining <= 0) {
        txtWave.style.color = '#ff5b5b';
        txtWave.innerText = isWaveActive ? `Wave ${waveRound} • END` : `Prep • END`;
    }
}

function showWarningAlert(message) {
    if (!warningAlert) return;
    warningAlert.innerHTML = message.replace(/\n/g, '<br>');
    warningAlert.classList.add('visible');
    warningAlert.style.display = 'block';
    warningAlert.style.opacity = '1';

    setTimeout(() => {
        warningAlert.classList.remove('visible');
        warningAlert.style.display = 'none';
    }, WARNING_DURATION_MS);
}

function startWave(eventNames) {
    isWaveActive = true;
    activeEventNames = Array.isArray(eventNames) ? eventNames : [eventNames];
    waveEndsAt = Date.now() + WAVE_DURATION_MS;
    updateWaveTimerLabel();

    activeEventNames.forEach((eventName) => {
        if (eventName === 'Flooding') triggerFloodEvent();
        else if (eventName === 'Earthquake') triggerEarthquakeEvent();
        else if (eventName === 'Volcano') triggerVolcanoEvent();
        else if (eventName === 'Corcs') triggerCorcsEvent();
    });
}

function endWave() {
    activeEventNames.forEach((eventName) => {
        if (eventName === 'Flooding') endFloodWave();
        else if (eventName === 'Earthquake') endEarthquakeWave();
        else if (eventName === 'Volcano') endVolcanoWave();
        else if (eventName === 'Corcs') endCorcsWave();
    });

    temporaryTrashTiles.forEach(tile => {
        if (!tile || !tile.element) return;
        tile.blockedByTrash = false;
        tile.element.classList.remove('dark-trash-zone');
    });
    temporaryTrashTiles = [];

    isWaveActive = false;
    activeEventNames = [];
    waveRound += 1;
    waveEndsAt = Date.now() + FREE_TIME_MS;
    updateWaveTimerLabel();
}

function setupGameOverRestart() {
    if (!playAgainBtn) return;
    playAgainBtn.addEventListener('click', () => {
        window.location.reload();
    });
}

function triggerFloodEvent() {
    const waterSourceTiles = [];
    for (let r = 0; r < MAP_SIZE; r++) {
        for (let c = 0; c < MAP_SIZE; c++) {
            const tile = gridData[r]?.[c];
            if (!tile || !tile.element) continue;
            if (tile.biome === 'river') waterSourceTiles.push(tile);
        }
    }
    if (waterSourceTiles.length === 0) return;
    if (floodExpansionInterval) {
        clearInterval(floodExpansionInterval);
        floodExpansionInterval = null;
    }
    floodExpansionStep = 0;

    function expandFlood() {
        if (floodExpansionStep >= 60) {
            clearInterval(floodExpansionInterval);
            floodExpansionInterval = null;
            return;
        }

        const sourceTiles = [];
        for (let r = 0; r < MAP_SIZE; r++) {
            for (let c = 0; c < MAP_SIZE; c++) {
                const tile = gridData[r]?.[c];
                if (!tile || !tile.element) continue;
                if (tile.biome === 'river') sourceTiles.push(tile);
            }
        }

        const neighborOffsets = [
            { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
            { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
        ];

        const candidateTiles = [];
        const candidateKeys = new Set();

        sourceTiles.forEach(sourceTile => {
            const shuffledOffsets = neighborOffsets.sort(() => Math.random() - 0.5);
            shuffledOffsets.forEach(({ dr, dc }) => {
                const row = sourceTile.row + dr;
                const col = sourceTile.col + dc;
                const tile = gridData[row]?.[col];
                if (!tile || !tile.element) return;
                const struct = findStructureAtTile(row, col);
                if (struct?.type === 'Forest') {
                    restoreFloodedTile(tile);
                    return;
                }
                if (tile.floodBlocked || tile.biome === 'deep-ocean' || tile.biome === 'river' || tile.biome === 'shallow-water') return;
                if (tile.biome === 'inner-land' || tile.biome === 'land' || tile.biome === 'beach') {
                    const key = `${row},${col}`;
                    if (!candidateKeys.has(key)) {
                        candidateKeys.add(key);
                        candidateTiles.push(tile);
                    }
                }
            });
        });

        if (candidateTiles.length === 0) {
            clearInterval(floodExpansionInterval);
            floodExpansionInterval = null;
            return;
        }

        const floodCount = Math.min(candidateTiles.length, Math.max(1, Math.floor(waveRound * 1.25)));
        for (let index = 0; index < floodCount; index++) {
            const pickIdx = Math.floor(Math.random() * candidateTiles.length);
            const selected = candidateTiles.splice(pickIdx, 1)[0];
            if (!selected) continue;
            const originalBiome = selected.biome;
            selected.floodBlocked = true;
            selected.previousBiome = originalBiome;
            floodActiveTiles.push(selected);
            selected.biome = 'river';
            selected.element.className = 'tile river flood-expanded flood-blocked';
            setTimeout(() => {
                if (!selected.element) return;
                selected.element.classList.remove('flood-expanded');
            }, 2000);

            if (selected.hasStructure) {
                const structure = findStructureAtTile(selected.row, selected.col);
                if (structure && !structure.floodPending) {
                    structure.floodPending = true;
                    handleFloodStructureImpact(structure);
                }
            }
        }

        floodExpansionStep += 1;
    }

    expandFlood();
    floodExpansionInterval = setInterval(expandFlood, 1000);
}

function handleFloodStructureImpact(structure) {
    if (!structure) return;
    if (structure.type === 'Village' || structure.type === 'Hotel') {
        let evacs = structuresRegistry.filter(s => s.type === 'Evacuation');

        if (evacs.length === 0) {
            showToast(`Flood hit ${structure.type}! No Evacuation centers placed; people remained inside.`);
            scheduleStructureRemoval(structure, 8000, true);
            return;
        }

        let peopleInBuilding = structure.type === 'Village' ? structure.level * 5 : structure.level * 10;
        let remainingToEvacuate = peopleInBuilding;

        for (let evac of evacs) {
            if (remainingToEvacuate <= 0) break;
            let currentInEvac = evac.storedPeople || 0;
            let spaceLeft = 50 - currentInEvac;
            if (spaceLeft > 0) {
                let toAdd = Math.min(spaceLeft, remainingToEvacuate);
                evac.storedPeople = currentInEvac + toAdd;
                remainingToEvacuate -= toAdd;
            }
        }

        if (remainingToEvacuate > 0) {
            let hospitals = structuresRegistry.filter(s => s.type === 'Hospital');
            for (let hosp of hospitals) {
                if (remainingToEvacuate <= 0) break;
                let currentInHosp = hosp.storedPeople || 1;
                let spaceLeft = 20 - currentInHosp;
                if (spaceLeft > 0) {
                    let toAdd = Math.min(spaceLeft, remainingToEvacuate);
                    hosp.storedPeople = currentInHosp + toAdd;
                    remainingToEvacuate -= toAdd;
                }
            }
        }

        if (remainingToEvacuate > 0) {
            showToast(`DISASTER! ${remainingToEvacuate} people had no evacuation/hospital space and died!`);
        } else {
            showToast(`Flood hit ${structure.type}! All people safely evacuated to shelters.`);
        }

        scheduleStructureRemoval(structure, 5000, true);
    } else if (structure.type !== 'City') {
        scheduleStructureRemoval(structure, 5000, true);
    }
}

function endFloodWave() {
    if (floodExpansionInterval) {
        clearInterval(floodExpansionInterval);
        floodExpansionInterval = null;
    }
    floodActiveTiles.forEach(tile => {
        if (!tile || !tile.element) return;
        tile.biome = tile.previousBiome || 'land';
        tile.floodBlocked = false;
        tile.element.className = `tile ${tile.previousBiome || 'land'}`;
        tile.element.classList.remove('flood-expanded', 'flood-blocked');
        delete tile.previousBiome;
    });
    floodActiveTiles = [];
    floodExpansionStep = 0;
}

function scheduleStructureRemoval(structure, destroyDelayMs = 600, flashBeforeDestroy = false) {
    if (!structure || !structure.domElement || !structure.domElement.parentElement) return;

    setTimeout(() => {
        if (!structure || !structure.domElement) return;

        if (flashBeforeDestroy) {
            structure.domElement.classList.add('structure-destroy-flash');
            setTimeout(() => {
                finalizeStructureRemoval(structure);
            }, 600);
            return;
        }

        finalizeStructureRemoval(structure);
    }, destroyDelayMs);
}

function finalizeStructureRemoval(structure) {
    if (!structure || !structure.domElement) return;
    if (structure.domElement.parentElement) {
        structure.domElement.remove();
    }

    const clearSize = structure.size || 4;
    for (let h = 0; h < clearSize; h++) {
        for (let w = 0; w < clearSize; w++) {
            const tile = gridData[structure.row + h]?.[structure.col + w];
            if (!tile) continue;
            tile.hasStructure = false;
        }
    }

    structuresRegistry = structuresRegistry.filter(item => item !== structure);
    refreshPeopleCount();
}

function updateCashBalance(amount) { currentCash += amount; if (txtCash) txtCash.innerText = formatCash(currentCash); }
function setupModalToggleListeners() { document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', () => { cityModal.style.display = 'none'; }); }); }

function updateCameraTransform() {
    const scaledWidth = ISLAND_DIMENSION * zoom;
    const scaledHeight = ISLAND_DIMENSION * zoom;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minPanX = viewportWidth - scaledWidth;
    const minPanY = viewportHeight - scaledHeight;

    if (scaledWidth <= viewportWidth) {
        camX = (viewportWidth - scaledWidth) / 2;
    } else {
        camX = Math.min(0, Math.max(minPanX, camX));
    }

    if (scaledHeight <= viewportHeight) {
        camY = (viewportHeight - scaledHeight) / 2;
    } else {
        camY = Math.min(0, Math.max(minPanY, camY));
    }

    cameraSpace.style.transform = `translate(${camX}px, ${camY}px) scale(${zoom})`;
}

function setupInputListeners() {
    function getPinchDistance(touches) { if (touches.length < 2) return 0; const dx = touches[0].clientX - touches[1].clientX; const dy = touches[0].clientY - touches[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
    function getTouchCenter(touches) { if (touches.length < 2) return { x: 0, y: 0 }; return { x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 }; }
    function onStart(clientX, clientY) { isDragging = true; hasMovedSignificantly = false; startX = clientX - camX; startY = clientY - camY; }
    viewport.addEventListener('mousedown', (e) => { if (e.target === viewport || e.target.classList.contains('tile') || e.target === mapIsland) onStart(e.clientX, e.clientY); });
    viewport.addEventListener('touchstart', (e) => { if (e.touches.length === 1) onStart(e.touches[0].clientX, e.touches[0].clientY); else if (e.touches.length === 2) { isDragging = false; initialPinchDistance = getPinchDistance(e.touches); initialZoom = zoom; } }, { passive: true });
    function onMove(clientX, clientY) { if (!isDragging) return; const nextX = clientX - startX; const nextY = clientY - startY; if (Math.abs(nextX - camX) > 4 || Math.abs(nextY - camY) > 4) hasMovedSignificantly = true; camX = nextX; camY = nextY; updateCameraTransform(); }
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    viewport.addEventListener('touchmove', (e) => { if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY); else if (e.touches.length === 2) { const currentDistance = getPinchDistance(e.touches); if (initialPinchDistance <= 0) return; const center = getTouchCenter(e.touches); const worldX = (center.x - camX) / zoom; const worldY = (center.y - camY) / zoom; const scaleRatio = currentDistance / initialPinchDistance; zoom = initialZoom * scaleRatio; zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)); camX = center.x - worldX * zoom; camY = center.y - worldY * zoom; updateCameraTransform(); } }, { passive: true });
    window.addEventListener('mouseup', () => isDragging = false); window.addEventListener('touchend', () => { isDragging = false; initialPinchDistance = 0; });
    viewport.addEventListener('wheel', (e) => { e.preventDefault(); const mouseX = e.clientX; const mouseY = e.clientY; const worldX = (mouseX - camX) / zoom; const worldY = (mouseY - camY) / zoom; const zoomFactor = 1.15; if (e.deltaY < 0) { if (zoom < MAX_ZOOM) zoom *= zoomFactor; } else { if (zoom > MIN_ZOOM) zoom /= zoomFactor; } zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)); camX = mouseX - worldX * zoom; camY = mouseY - worldY * zoom; updateCameraTransform(); }, { passive: false });
}

init();

function hasTrashSourceStructures() {
    return structuresRegistry.some(s => ['Village', 'Hotel', 'School', 'Hospital', 'Evacuation'].includes(s.type));
}

function startTrashSpawner() {
    if (trashSpawnerInterval) clearInterval(trashSpawnerInterval);
    trashSpawnerInterval = setInterval(() => {
        if (gameOverState) return;
        if (!hasTrashSourceStructures()) return;
        const sources = structuresRegistry.filter(s => ['Village', 'Hotel', 'School', 'Hospital', 'Evacuation'].includes(s.type));
        if (sources.length === 0) return;
        const source = sources[Math.floor(Math.random() * sources.length)];
        spawnTrashNearby(source);
    }, 5000);
}

function findStructureAtTile(row, col) {
    return structuresRegistry.find(struct =>
        row >= struct.row &&
        row < struct.row + struct.size &&
        col >= struct.col &&
        col < struct.col + struct.size
    ) || null;
}

function getStructureOccupantCount(structure) {
    if (!structure) return 0;
    switch (structure.type) {
        case 'Village': return structure.level * 5;
        case 'Hotel': return structure.level * 10;
        case 'Farm': return 1;
        case 'Hospital': return Math.max(0, structure.storedPeople || 1);
        case 'School': return Math.max(0, structure.storedPeople || 0);
        case 'Evacuation': return Math.max(0, structure.storedPeople || 0);
        default: return 0;
    }
}

function restoreFloodedTile(tile) {
    if (!tile || !tile.element || !tile.previousBiome) return;
    tile.biome = tile.previousBiome;
    tile.floodBlocked = false;
    tile.element.className = `tile ${tile.previousBiome}`;
    tile.element.classList.remove('flood-expanded', 'flood-blocked');
    delete tile.previousBiome;
    floodActiveTiles = floodActiveTiles.filter(active => active !== tile);
}

function getAvailableEventTypes() {
    return EVENT_TYPES.filter(eventName => {
        if (eventName === 'Earthquake') {
            return Date.now() >= earthquakeCooldownUntil;
        }
        if (eventName === 'Corcs') {
            return waveRound >= 1;
        }
        return true;
    });
}

function getWaveEventList() {
    const availableEvents = getAvailableEventTypes();
    if (availableEvents.length === 0) return ['Flooding'];
    if (waveRound < 10) return [availableEvents[Math.floor(Math.random() * availableEvents.length)]];

    if (waveRound === 10) {
        const shuffled = [...availableEvents].sort(() => Math.random() - 0.5);
        const chooseTwo = Math.random() < 0.5;
        if (!chooseTwo) return [shuffled[0]];
        const second = shuffled.find(e => e !== shuffled[0]) || shuffled[0];
        return [shuffled[0], second];
    }

    const shuffled = [...availableEvents].sort(() => Math.random() - 0.5);
    const first = shuffled[0];
    const second = shuffled.find(e => e !== first) || first;
    return [first, second];
}

function getRandomEventName() {
    const availableEvents = getAvailableEventTypes();
    return availableEvents.length ? availableEvents[Math.floor(Math.random() * availableEvents.length)] : 'Flooding';
}

let corcsStealTimer = null;
let corcsRespawnTimer = null;
let isCorcsEventActive = false;

function triggerCorcsEvent() {
    if (isCorcsEventActive) return;
    isCorcsEventActive = true;
    runCorcsCycle();
}

function runCorcsCycle() {
    clearTimeout(corcsStealTimer);
    clearTimeout(corcsRespawnTimer);

    const overlay = document.getElementById('corcs-cash-overlay');
    if (overlay) {
        overlay.classList.add('visible');
    }

    corcsStealTimer = setTimeout(() => {
        executeCorcsTheft();
        prepareNextCorcsCycle();
    }, 10000);
}

function handleCorcsClick() {
    const overlay = document.getElementById('corcs-cash-overlay');
    
    if (overlay && overlay.classList.contains('visible')) {
        showToast("Defended! Corcs retreated temporarily.");
        prepareNextCorcsCycle();
    }
}

function prepareNextCorcsCycle() {
    const overlay = document.getElementById('corcs-cash-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }

    clearTimeout(corcsStealTimer);
    clearTimeout(corcsRespawnTimer);

    if (isCorcsEventActive) {
        corcsRespawnTimer = setTimeout(() => {
            runCorcsCycle();
        }, 5000);
    }
}

function executeCorcsTheft() {
    const currentMoney = Math.max(0, currentCash);
    const stealAmount = currentMoney > 0 ? Math.min(currentMoney, Math.max(100, Math.floor(currentMoney * 0.18))) : 0;
    const container = document.getElementById('cash-indicators-container');

    if (stealAmount > 0) {
        updateCashBalance(-stealAmount);
        showToast(`Corcs raided the city and stole ₱${formatCash(stealAmount)}!`);

        if (container) {
            const indicator = document.createElement('div');
            indicator.className = 'cash-stolen-indicator';
            indicator.textContent = `-₱${formatCash(stealAmount)}`;
            
            indicator.style.top = '20px';
            indicator.style.left = '50%';
            
            container.appendChild(indicator);

            setTimeout(() => {
                indicator.classList.add('visible');
            }, 10);

            setTimeout(() => {
                indicator.remove();
            }, 2000);
        }
    } else {
        showToast('Corcs searched for money but found nothing to steal.');
    }
}

function endCorcsWave() {
    isCorcsEventActive = false;
    clearTimeout(corcsStealTimer);
    clearTimeout(corcsRespawnTimer);

    const overlay = document.getElementById('corcs-cash-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

function triggerEarthquakeEvent() {
    viewport.classList.remove('screen-shake');
    void viewport.offsetWidth;
    viewport.classList.add('screen-shake');
    earthquakeCooldownUntil = Date.now() + 45000;

    if (earthquakeInterval) {
        clearInterval(earthquakeInterval);
        earthquakeInterval = null;
    }

    const quakeStrike = () => {
        const damageTargets = structuresRegistry.filter(struct =>
            struct.type !== 'City' &&
            struct.type !== 'Farm' &&
            struct.type !== 'Forest'
        );

        if (damageTargets.length === 0) {
            showToast('Earthquake passed without damaging buildings.');
            return;
        }

        const structure = damageTargets[Math.floor(Math.random() * damageTargets.length)];
        if (!structure) return;

        showToast(`Earthquake damaged ${structure.type}!`);
        scheduleStructureRemoval(structure, 0, true);
    };

    let strikeIntervalMs = 5000;
    let totalStrikes = Infinity;

    if (waveRound === 1) {
        strikeIntervalMs = 0;
        totalStrikes = 1;
    } else if (waveRound === 2) {
        strikeIntervalMs = 10000;
        totalStrikes = 2;
    } else {
        strikeIntervalMs = 5000;
        totalStrikes = Infinity;
    }

    let strikesDone = 0;
    const runStrike = () => {
        strikesDone += 1;
        quakeStrike();
        if (strikesDone >= totalStrikes && earthquakeInterval) {
            clearInterval(earthquakeInterval);
            earthquakeInterval = null;
        }
    };

    runStrike();
    if (strikeIntervalMs > 0 && totalStrikes !== 1) {
        earthquakeInterval = setInterval(runStrike, strikeIntervalMs);
    }
}

function endEarthquakeWave() {
    viewport.classList.remove('screen-shake');
    if (earthquakeInterval) {
        clearInterval(earthquakeInterval);
        earthquakeInterval = null;
    }
}

function triggerVolcanoEvent() {
    clearVolcanoZone();
    if (volcanoOverlay) volcanoOverlay.classList.add('visible');

    const validCenters = [];
    for (let r = 0; r < MAP_SIZE; r++) {
        for (let c = 0; c < MAP_SIZE; c++) {
            const tile = gridData[r]?.[c];
            if (!tile || !tile.element) continue;
            if (tile.biome === 'inner-land' || tile.biome === 'land' || tile.biome === 'beach') {
                validCenters.push(tile);
            }
        }
    }

    if (validCenters.length === 0) {
        showToast('Volcano eruption passed over empty land.');
        return;
    }

    const center = validCenters[Math.floor(Math.random() * validCenters.length)];
    const radius = 2;
    const impactedTiles = [];
    const seen = new Set();

    for (let r = center.row - radius; r <= center.row + radius; r++) {
        for (let c = center.col - radius; c <= center.col + radius; c++) {
            const tile = gridData[r]?.[c];
            if (!tile || !tile.element) continue;
            if (tile.biome === 'river' || tile.biome === 'deep-ocean' || tile.biome === 'shallow-water') continue;
            const key = `${r},${c}`;
            if (seen.has(key)) continue;
            seen.add(key);
            tile.isVolcanoZone = true;
            tile.element.classList.add('volcano-zone');
            volcanoActiveTiles.push(tile);
            impactedTiles.push(tile);
        }
    }

    const hitStructures = new Set();
    impactedTiles.forEach(tile => {
        const structure = findStructureAtTile(tile.row, tile.col);
        if (!structure || hitStructures.has(structure.id) || structure.type === 'Evacuation') return;
        hitStructures.add(structure.id);

        const peopleInside = getStructureOccupantCount(structure);
        if (peopleInside > 0) {
            showToast(`${structure.type} was hit by the volcano and ${peopleInside} people died.`);
        } else {
            showToast(`${structure.type} was hit by the volcano and destroyed.`);
        }

        scheduleStructureRemoval(structure, 0, true);
    });

    if (hitStructures.size === 0) {
        showToast('Volcano eruption scorched empty land.');
    }

    if (volcanoDamageInterval) {
        clearInterval(volcanoDamageInterval);
        if (volcanoExpansionInterval) clearInterval(volcanoExpansionInterval);
    }
    volcanoDamageInterval = setInterval(() => {
        volcanoActiveTiles.forEach(tile => {
            if (!tile || !tile.element) return;
            const structure = findStructureAtTile(tile.row, tile.col);
            if (!structure || structure.type === 'Evacuation') return;
            const deadPeople = Math.min(getStructureOccupantCount(structure), 3);
            if (deadPeople > 0) {
                showToast(`Volcano smoke killed ${deadPeople} people in ${structure.type}!`);
            }
            scheduleStructureRemoval(structure, 500, true);
        });
    }, 1000);

    const initialRadius = 2;
    const targetRadius = Math.min(2 + Math.max(0, waveRound - 1), 6);
    let expansionRadius = initialRadius;
    const centerRow = center.row;
    const centerCol = center.col;
    if (volcanoExpansionInterval) clearInterval(volcanoExpansionInterval);
    if (targetRadius > initialRadius) {
        volcanoExpansionInterval = setInterval(() => {
            expansionRadius += 1;
            const newTiles = [];
            for (let r = centerRow - expansionRadius; r <= centerRow + expansionRadius; r++) {
                for (let c = centerCol - expansionRadius; c <= centerCol + expansionRadius; c++) {
                    const dist = Math.max(Math.abs(r - centerRow), Math.abs(c - centerCol));
                    if (dist !== expansionRadius) continue;
                    const tile = gridData[r]?.[c];
                    if (!tile || !tile.element) continue;
                    if (tile.biome === 'river' || tile.biome === 'deep-ocean' || tile.biome === 'shallow-water') continue;
                    if (!tile.isVolcanoZone) {
                        tile.isVolcanoZone = true;
                        tile.element.classList.add('volcano-zone');
                        volcanoActiveTiles.push(tile);
                        newTiles.push(tile);
                    }
                }
            }
            if (expansionRadius >= targetRadius) {
                clearInterval(volcanoExpansionInterval);
                volcanoExpansionInterval = null;
            }
        }, 1000);
    } else {
        volcanoExpansionInterval = null;
    }
}

function endVolcanoWave() {
    clearVolcanoZone();
    if (volcanoOverlay) volcanoOverlay.classList.remove('visible');
    if (volcanoDamageInterval) {
        clearInterval(volcanoDamageInterval);
        volcanoDamageInterval = null;
    }
    if (volcanoExpansionInterval) {
        clearInterval(volcanoExpansionInterval);
        volcanoExpansionInterval = null;
    }
}

function clearVolcanoZone() {
    volcanoActiveTiles.forEach(tile => {
        if (!tile || !tile.element) return;
        tile.element.classList.remove('volcano-zone');
        tile.isVolcanoZone = false;
    });
    volcanoActiveTiles = [];
}

function checkGameOver() {
    if (gameOverState) return;
    if (peopleCount <= 0) {
        gameOverState = true;
        showWarningAlert('GAME OVER\nThe City has no people left.');
        showToast('GAME OVER');
        clearInterval(waveTimerInterval);
        clearInterval(floodExpansionInterval);
        clearInterval(trashSpawnerInterval);
        clearInterval(volcanoDamageInterval);
        if (previewEl) previewEl.style.display = 'none';
        triggerGameOverSequence();
    }
}