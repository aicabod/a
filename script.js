// AI suggested doing everything in this callback, and I followed it because I
// know nothing about javascript.
document.addEventListener('DOMContentLoaded', () => {
  // Constants. Not sure if `config` is really an appropriate name.
  const config = {
    // Default language to initially set (if available).
    DEFAULT_LANGUAGE: 'English',
    // Map from language tag prefixes to language names (not exhaustive).
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
    // Maximum interval between speeches in milliseconds.
    MAX_INTERVAL_MS: 5000,
    // Maximum number of numbers to generate at once.
    MAX_NUM_COUNT: 10,
  };

  // Super messy list of UI elements.
  const ui = {
    refreshButton: document.getElementById('refreshButton'),
    playPauseButton: document.getElementById('playPauseButton'),
    playPauseIcon:
        document.getElementById('playPauseButton')
            .querySelector('.material-icons'),
    toggleVisibilityButton:
        document.getElementById('toggleVisibilityButton'),
    toggleVisibilityIcon:
        document.getElementById('toggleVisibilityButton')
            .querySelector('.material-icons'),
    correctNumbersDisplay: document.getElementById('correctNumbersDisplay'),
    userInput: document.getElementById('userInput'),
    checkButton: document.getElementById('checkButton'),
    messageDisplay: document.getElementById('messageDisplay'),
    minNumberInput: document.getElementById('minNumber'),
    maxNumberInput: document.getElementById('maxNumber'),
    numCountInput: document.getElementById('numCount'),
    languageSelector: document.getElementById('languageSelector'),
    voiceSelector: document.getElementById('voiceSelector'),
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
    // Whether a speech is in progress.
    isSpeaking: false,
    // List of available voices. Obtained by speechSynthesis.getVoices().
    allVoices: [],
    // Current list of numbers to speak.
    numbersToSpeak: [],
    // Which number in the above list should be spoken next.
    currentNumberIndex: 0,
    // ID of the last message dislayed in messageDisplay.
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

  // Disable everything and return early if the Web Speech API is not available.
  if (!('speechSynthesis' in window)) {
    console.warn('Web Speech API is not supported in this browser.');
    disableAppFeatures();
    return;
  }

  // Extracts the prefix part of an IETF language tag.
  function getLangTagPrefix(langTag) {
    // Assume that the prefix is followed by either '_' or '-' (e.g. "en-GB",
    // "ja-JP"), or the whole tag should be treated as the prefix (e.g. "ko").
    const separatorIndex = langTag.search(/[_\\-]/);
    if (separatorIndex > 0) {
      return langTag.substring(0, separatorIndex);
    }
    return langTag;
  }

  // Returns the language name corresponding to the given language tag.
  // `prefixMap` is a map (an object literal) from language tag prefixes to
  // language names. If the map contains the prefix of the language tag, its
  // corresponding language name is returned. Otherwise, the language tag is
  // returned as-is.
  function getLanguageName(langTag, prefixMap) {
    return prefixMap[getLangTagPrefix(langTag)] || langTag;
  }

  // Returns the list of languages available in the given set of voices.
  // The list is alphabetically sorted using the default sort() method.
  function getLanguages(voices, prefixMap) {
    const uniqueLanguages = new Set();
    voices.forEach((voice) => {
      uniqueLanguages.add(getLanguageName(voice.lang, prefixMap));
    });
    return Array.from(uniqueLanguages).sort();
  }

  // Loads the available voices and accordingly updates languageSelector and
  // voiceSelector.
  function loadLanguages() {
    state.allVoices = speechSynthesis.getVoices();
    const languages = getLanguages(state.allVoices, config.LANGUAGE_NAMES);

    // Update languageSelector after memorizing the current language.
    const currentLang = ui.languageSelector.value;
    ui.languageSelector.innerHTML = '';
    languages.forEach((lang) => {
      const option = new Option(lang, lang);
      ui.languageSelector.add(option);
    });

    // Keep selecting the current language if it is still available.
    const currentLangExists =
        currentLang && languages.some((lang) => lang === currentLang);
    if (currentLangExists) {
      ui.languageSelector.value = currentLang;
    } else {
      // Select the default language if available. Otherwise, pick the first
      // language in the list (unless the list is empty).
      const defaultLangExists =
          languages.some((lang) => lang === config.DEFAULT_LANGUAGE);
      ui.languageSelector.value =
          defaultLangExists ? config.DEFAULT_LANGUAGE : (languages[0] || '');
    }

    // Update voiceSelector as well.
    updateVoiceList();
  }

  // Returns the list of voices of the specified language.
  // The list is sorted using the localeCompare() method.
  function filterVoices(voices, language, prefixMap) {
    const filteredVoices =
        voices.filter((voice) => {
          return language === getLanguageName(voice.lang, prefixMap);
        });
    return filteredVoices.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Fills voiceSelector with all available voices of the currently selected
  // language.
  function updateVoiceList() {
    const selectedLanguage = ui.languageSelector.value;
    const filteredVoices =
      filterVoices(state.allVoices, selectedLanguage, config.LANGUAGE_NAMES);

    // Update voiceSelector after memorizing the current voice.
    const currentVoice = ui.voiceSelector.value;
    ui.voiceSelector.innerHTML = '';
    filteredVoices.forEach((voice) => {
      const option = new Option(voice.name, voice.voiceURI);
      ui.voiceSelector.add(option);
    });

    // Keep selecting the current voice if it is still available.
    // Note that voiceURI (not name) is used as the identifier.
    const currentVoiceExists =
        currentVoice &&
        filteredVoices.some((voice) => voice.voiceURI === currentVoice);
    if (currentVoiceExists) {
      ui.voiceSelector.value = currentVoice;
      return;
    }

    // Select a predefined default voice if exists. Otherwise, pick the first
    // voice in the list (unless the list is empty).
    const defaultVoice = filteredVoices.find((voice) => voice.default);
    if (defaultVoice) {
      ui.voiceSelector.value = defaultVoice.voiceURI;
    } else if (filteredVoices.length > 0) {
      ui.voiceSelector.value = filteredVoices[0].voiceURI || '';
    } else {
      ui.voiceSelector.value = '';
    }
  }

  /* Some random garbage code follows. */

  function parseFormattedNumber(str) {
    // Accept comma-separated numbers (e.g. treat "123,456" as 123456).
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
        state.allVoices.find((voice) =>
          voice.voiceURI === ui.voiceSelector.value);
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
    // Do not forget to update languages/voices on voiceschanged events.
    // This is especially important in environments where the voices are lazily
    // loaded and speechSynthesis.getVoices() initially returns an empty list.
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
