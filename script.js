document.addEventListener('DOMContentLoaded', () => {
  const config = {
    DEFAULT_LANGUAGE: 'English',
    LANGUAGE_NAMES: {
      'de': 'German (Deutsch)',
      'en': 'English',
      'es': 'Spanish (español)',
      'fr': 'French (français)',
      'id': 'Indonesian (Bahasa Indonesia)',
      'in': 'Indonesian (Bahasa Indonesia)',
      'it': 'Italian (italiano)',
      'ja': 'Japanese (日本語)',
      'ko': 'Korean (한국어)',
      'ru': 'Russian (pусский)',
      'tr': 'Turkish (Türkçe)',
      'zh': 'Chinese (中文)',
    },
    MAX_INTERVAL_MS: 5000,
    MAX_NUM_COUNT: 10,
  };

  const ui = {
    playPauseButton: document.getElementById('playPauseButton'),
    playPauseIcon:
        document.getElementById('playPauseButton')
            .querySelector('.material-icons'),
    refreshButton: document.getElementById('refreshButton'),
    toggleVisibilityButton:
        document.getElementById('toggleVisibilityButton'),
    toggleVisibilityIcon:
        document.getElementById('toggleVisibilityButton')
            .querySelector('.material-icons'),
    languageSelector: document.getElementById('languageSelector'),
    voiceSelector: document.getElementById('voiceSelector'),
    correctNumbersDisplay: document.getElementById('correctNumbersDisplay'),
    userInput: document.getElementById('userInput'),
    checkButton: document.getElementById('checkButton'),
    messageDisplay: document.getElementById('messageDisplay'),
    minNumberInput: document.getElementById('minNumber'),
    maxNumberInput: document.getElementById('maxNumber'),
    numCountInput: document.getElementById('numCount'),
    speechRateInput: document.getElementById('speechRate'),
    speechRateValueDisplay: document.getElementById('speechRateValue'),
    intervalMsInput: document.getElementById('intervalMs'),
    formElements:
        document.querySelectorAll(
            '.settings-form input, ' +
            '.settings-form select, ' +
            '.input-group input, ' +
            '.button'),
    mainControlButtons: document.querySelectorAll('.main-controls button'),
  };

  const state = {
    isSpeaking: false,
    allVoices: [],
    numbersToSpeak: [],
    currentNumberIndex: 0,
    messageId: 0,
  };

  function displayMessage(text, type = 'general') {
    state.messageId = (state.messageId + 1) % 255;
    ui.messageDisplay.textContent = text;
    ui.messageDisplay.className = `message-display message-${type}`;
  }

  function disableAppFeatures() {
    displayMessage(
        'Web Speech API is not supported in your browser.', 'incorrect');
    ui.mainControlButtons.forEach((btn) => btn.disabled = true);
    ui.formElements.forEach((elem) => elem.disabled = true);
  }

  if (!('speechSynthesis' in window)) {
    console.warn('Web Speech API is not supported in this browser.');
    disableAppFeatures();
    return;
  }

  function getLangTagPrefix(langTag) {
    const separatorIndex = langTag.search(/[_\\-]/);
    if (separatorIndex > 0) {
      return langTag.substring(0, separatorIndex);
    }
    return langTag;
  }

  function loadLanguages() {
    state.allVoices = speechSynthesis.getVoices();
    const uniqueLanguages = new Set();
    state.allVoices.forEach((voice) => {
      const langTag = voice.lang;
      const langTagPrefix = getLangTagPrefix(langTag);
      if (config.LANGUAGE_NAMES[langTagPrefix]) {
        uniqueLanguages.add(config.LANGUAGE_NAMES[langTagPrefix]);
      } else {
        uniqueLanguages.add(langTag);
      }
    });
    const sortedLanguages = Array.from(uniqueLanguages).sort();

    const currentLang = ui.languageSelector.value;
    ui.languageSelector.innerHTML = '';
    sortedLanguages.forEach((lang) => {
      const option = new Option(lang, lang);
      ui.languageSelector.add(option);
    });

    const currentLangExists =
        sortedLanguages.some((lang) => lang === currentLang);
    if (currentLangExists) {
      ui.languageSelector.value = currentLang;
    } else {
      const defaultLangExists =
          sortedLanguages.some((lang) => lang === config.DEFAULT_LANGUAGE);
      ui.languageSelector.value =
          defaultLangExists ?
              config.DEFAULT_LANGUAGE : (sortedLanguages[0] || '');
    }

    updateVoiceList();
  }

  function updateVoiceList() {
    const selectedLang = ui.languageSelector.value;
    const filteredVoices =
        state.allVoices.filter((voice) => {
          const langTag = voice.lang;
          const langTagPrefix = getLangTagPrefix(langTag);
          if (config.LANGUAGE_NAMES[langTagPrefix]) {
            return config.LANGUAGE_NAMES[langTagPrefix] === selectedLang;
          }
          return langTag === selectedLang;
        });
    const sortedVoices =
        filteredVoices.sort((a, b) => a.name.localeCompare(b.name));

    const currentVoice = ui.voiceSelector.value;
    ui.voiceSelector.innerHTML = '';
    if (sortedVoices.length === 0) {
      ui.voiceSelector.add(
          new Option('No available voices found.', '', false, true));
      return;
    }
    sortedVoices.forEach((voice) => {
      const option = new Option(voice.name, voice.name);
      ui.voiceSelector.add(option);
    });

    const currentVoiceExists =
        sortedVoices.some((voice) => voice.name === currentVoice);
    if (currentVoiceExists) {
      ui.voiceSelector.value = currentVoice;
    } else {
      const defaultVoice = sortedVoices.find((voice) => voice.default);
      ui.voiceSelector.value =
          defaultVoice ? defaultVoice.name : sortedVoices[0].name;
    }
  }

  function parseFormattedNumber(str) {
    return parseInt(str.replace(/,/g, ''), 10);
  }

  function parseAndValidateFormattedNumber(str, min, max) {
    const val = parseFormattedNumber(str) || min;
    return Math.max(min, Math.min(val, max));
  }

  function getOrdinalSuffix(i) {
    const j = i % 10;
    const k = i % 100;
    if (j === 1 && k !== 11) {
      return 'st';
    }
    if (j === 2 && k !== 12) {
      return 'nd';
    }
    if (j === 3 && k !== 13) {
      return 'rd';
    }
    return 'th';
  }

  function stopSpeaking() {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    state.isSpeaking = false;
    ui.playPauseIcon.textContent = 'play_arrow';
    displayMessage('');
  }

  function generateRandomNumbers(min, max, count) {
    const numbers = [];
    for (let i = 0; i < count; i++) {
      numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return numbers;
  }

  function generateNewNumbers() {
    stopSpeaking();
    ui.userInput.value = '';

    const min =
        parseAndValidateFormattedNumber(
            ui.minNumberInput.value, 0, Number.MAX_SAFE_INTEGER);
    const max =
        parseAndValidateFormattedNumber(
            ui.maxNumberInput.value, min, Number.MAX_SAFE_INTEGER);
    const count =
        parseAndValidateFormattedNumber(
            ui.numCountInput.value, 1, config.MAX_NUM_COUNT);

    ui.minNumberInput.value = min;
    ui.maxNumberInput.value = max;
    ui.numCountInput.value = count;

    state.numbersToSpeak = generateRandomNumbers(min, max, count);
    ui.correctNumbersDisplay.textContent = state.numbersToSpeak.join(' ');
    state.currentNumberIndex = 0;
  }

  function handleRefresh() {
    generateNewNumbers();
    displayMessage('New numbers have been generated.');
    const currentMessageId = state.messageId;
    setTimeout(() => {
      if (state.messageId === currentMessageId) {
        displayMessage('');
      }
    }, 1000);
  }

  function speakNextNumber() {
    if (!state.isSpeaking ||
        state.currentNumberIndex >= state.numbersToSpeak.length) {
      stopSpeaking();
      return;
    }

    const numberToSpeak = state.numbersToSpeak[state.currentNumberIndex];
    state.currentNumberIndex++;

    const utterance =
        new SpeechSynthesisUtterance(numberToSpeak.toString());
    const selectedVoice =
        state.allVoices.find((voice) => voice.name === ui.voiceSelector.value);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }
    utterance.rate = parseFloat(ui.speechRateInput.value);

    const suffix = getOrdinalSuffix(state.currentNumberIndex);
    displayMessage(`Speaking the ${state.currentNumberIndex}${suffix} number.`);
    const currentMessageId = state.messageId;
    utterance.onend = () => {
      if (state.messageId === currentMessageId) {
        displayMessage('');
      }
      const interval =
          parseAndValidateFormattedNumber(
              ui.intervalMsInput.value, 0, config.MAX_INTERVAL_MS);
      setTimeout(speakNextNumber, interval);
    };

    speechSynthesis.speak(utterance);
  }

  function startSpeaking() {
    state.currentNumberIndex = 0;
    state.isSpeaking = true;
    ui.playPauseIcon.textContent = 'stop';
    speakNextNumber();
  }

  function handlePlayPause() {
    if (state.isSpeaking) {
      stopSpeaking();
    } else {
      startSpeaking();
    }
  }

  function handleToggleVisibility() {
    if (ui.correctNumbersDisplay.style.visibility === 'visible') {
      ui.correctNumbersDisplay.style.visibility = 'hidden';
      ui.toggleVisibilityIcon.textContent = 'visibility';
    } else {
      ui.correctNumbersDisplay.style.visibility = 'visible';
      ui.toggleVisibilityIcon.textContent = 'visibility_off';
    }
  }

  function checkAnswer() {
    const userNumbersStr = ui.userInput.value.trim();
    if (!userNumbersStr) {
      displayMessage('Incorrect.', 'incorrect');
      return;
    }

    const userNumbers =
        userNumbersStr.split(' ')
            .map((s) => parseFormattedNumber(s))
            .filter((n) => !isNaN(n));
    if (state.numbersToSpeak.join(' ') === userNumbers.join(' ')) {
      displayMessage('Correct!', 'correct');
    } else {
      displayMessage('Incorrect.', 'incorrect');
    }
  }

  function addEventListeners() {
    speechSynthesis.onvoiceschanged = loadLanguages;

    ui.refreshButton.addEventListener('click', handleRefresh);
    ui.playPauseButton.addEventListener('click', handlePlayPause);
    ui.toggleVisibilityButton.addEventListener('click', handleToggleVisibility);
    document.onkeydown = function(e) {
      if (!e.altKey) {
        return;
      }
      switch (e.key) {
        case 'r':
          if (e.preventDefault) {
            e.preventDefault();
          }
          handleRefresh();
          break;
        case 'p':
          if (e.preventDefault) {
            e.preventDefault();
          }
          handlePlayPause();
          break;
        case 'v':
          if (e.preventDefault) {
            e.preventDefault();
          }
          handleToggleVisibility();
          break;
      }
    };

    ui.checkButton.addEventListener('click', checkAnswer);
    ui.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        checkAnswer();
      }
    });

    ['minNumberInput', 'maxNumberInput', 'numCountInput'].forEach((id) => {
      ui[id].addEventListener('change', handleRefresh);
    });

    ui.languageSelector.addEventListener('change', updateVoiceList);

    ui.speechRateInput.addEventListener('input', () => {
      ui.speechRateValueDisplay.textContent =
          parseFloat(ui.speechRateInput.value).toFixed(2);
    });

    ui.intervalMsInput.addEventListener('change', () => {
      const interval =
          parseAndValidateFormattedNumber(
              ui.intervalMsInput.value, 0, config.MAX_INTERVAL_MS);
      ui.intervalMsInput.value = interval;
    });
  }

  function init() {
    addEventListeners();
    loadLanguages();
    generateNewNumbers();
    displayMessage('Shortcut keys: Alt+r, Alt+p, Alt+v');
  }

  init();
});
