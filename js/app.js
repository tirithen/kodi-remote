/* global btoa, unescape */

'use strict';

var translate;
var kodiBackgroundUpdates = true;
var verifySettingsMessage = '';
var authentication = localStorage.getItem('authentication');

var buttonsDependentOnActivePlayers = [];

function ActivePlayers(ids) {
  ids = ids || [];
  this.forEach = function forEach(callback) {
    ids.forEach(callback);
  };
}
var activePlayers = new ActivePlayers();

var inputs = {};
function Input(name, events, callback) {
  var self = this;

  this.name = name;
  this.element = document.querySelector('#' + name);
  this.events = Array.isArray(events) ? events : events.trim().split(/\s+/);

  this.events.forEach(function (eventName) {
    self.element.addEventListener(eventName, function (event) {
      callback(self, event);
    });
  });
}

function Menu(name, callback) {
  var self = this;

  this.name = name;
  this.buttonElement = document.querySelector('#' + name);
  this.menuElement = document.querySelector(this.buttonElement.getAttribute('href'));
  this.overlay = document.querySelector('#overlay');
  this.menuItems = Array.prototype.slice.call(this.menuElement.querySelectorAll('.menu-item'));

  this.buttonElement.addEventListener('click', function (event) {
    event.preventDefault();
    if (!self.buttonElement.hasAttribute('disabled')) {
      self.show();
    }
  });

  this.overlay.addEventListener('click', function () {
    self.close();
  });

  this.menuItems.forEach(function (menuItem) {
    menuItem.addEventListener('click', function () {
      callback(self, menuItem.getAttribute('data-value'));
    });
  });

  this.overlay.addEventListener('transitionend', function () {
    self.overlay.style.display = 'none';
  });
}

Menu.prototype.show = function show() {
  this.overlay.style.display = 'block';
  this.menuElement.classList.add('show');
  this.overlay.classList.add('show');
};

Menu.prototype.close = function close() {
  this.menuElement.classList.remove('show');
  this.overlay.classList.remove('show');
};

function authenticate() {
  var username = prompt(translate('prompt_username'));
  var password = '';

  if (username) {
    password = prompt(translate('prompt_password'));

    authentication = btoa(unescape(encodeURIComponent(username + ':' + password)));
    localStorage.setItem('authentication', authentication);
  }
}

function makeKodiCall(method, parameters, callback) {
  // Setup data, url, and create request object
  var data = JSON.stringify({
    id: Date.now(),
    jsonrpc: '2.0',
    method: method,
    params: parameters
  });
  var url = 'http://' + inputs.address.element.value + '/jsonrpc';
  var request = new XMLHttpRequest({ mozSystem: true });

  // Setup response handlers
  request.onload = function() {
    var response = request.response;
    var status = request.status;

    // Enable power menu
    inputs.menu.buttonElement.removeAttribute('disabled');

    if (status === 401 && callback instanceof Function) {
      callback(new Error(status), request);
    } else {
      if (response) {
        try {
          response = JSON.parse(response);
        } catch (exception) {
          response = undefined;
          status = exception;
        }
      }

      if (callback instanceof Function) {
        if (status >= 200 && status < 300) {
          callback(undefined, response, request);
        } else {
          callback(new Error(status), request);
        }
      }
    }
  };

  request.onerror = function() {
    if (callback instanceof Function) {
      callback(new Error(request.status), request);
    }
  };

  // Open the connection, set the headers and send the data
  request.open('POST', url, true);
  request.timeout = 10000;
  if (authentication) {
    request.setRequestHeader('Authorization', 'Basic ' + authentication);
  }
  request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  request.setRequestHeader('Content-Length', data.length);
  request.setRequestHeader('Connection', 'close');
  request.send(data);
}

function callKodi(method, parameters, callback) {
  // If one of the parameters are a list of players, extract that parameter,
  // as multiple calls will be made
  var activePlayersToCall;
  var activePlayersToCallIndex = -1;
  if (Array.isArray(parameters)) {
    parameters.forEach(function (parameter, index) {
      if (parameter instanceof ActivePlayers) {
        activePlayersToCall = parameter;
        activePlayersToCallIndex = index;
      }
    });
  }

  if (!inputs.address.element.value) { // If there is not address to call, return an error
    if (callback instanceof Function) {
      callback(new Error('Missing address to Kodi instance'));
    }
  } else if (activePlayersToCall) { // Make one call to each player
    activePlayersToCall.forEach(function (playerId) {
      parameters[activePlayersToCallIndex] = playerId;
      makeKodiCall(method, parameters, callback);
    });
  } else { // Make a regular call
    makeKodiCall(method, parameters, callback);
  }
}

var errorMessageTimer;
function callKodiErrorHandler(error) {
  if (error) {
    clearTimeout(errorMessageTimer);
    errorMessageTimer = setTimeout(function () {
      // Disable power menu
      inputs.menu.buttonElement.setAttribute('disabled', true);

      if (error.message === '401') {
        authenticate();
      } else {
        alert(translate('error_unable_to_connect') + ' ' + verifySettingsMessage);
      }
    }, 1000);
  }
}

var updateActivePlayersTimer;
function updateActivePlayers() {
  clearTimeout(updateActivePlayers);
  if (inputs.address && inputs.address.element.value) {
    callKodi('Player.GetActivePlayers', undefined, function (error, response) {
      if (error) {
        // Disable power menu
        inputs.menu.buttonElement.setAttribute('disabled', true);
      } else {
        // Enable power menu
        inputs.menu.buttonElement.removeAttribute('disabled');
      }

      if (!error && response && Array.isArray(response.result) && response.result.length) {
        activePlayers = new ActivePlayers(response.result.map(function (result) {
          return result.playerid;
        }));

        // Enable all buttons denedent an active player
        buttonsDependentOnActivePlayers.forEach(function (button) {
          button.removeAttribute('disabled');
        });
      } else {
        activePlayers = new ActivePlayers();

        // Disable all buttons denedent an active player
        buttonsDependentOnActivePlayers.forEach(function (button) {
          button.setAttribute('disabled', true);
        });
      }

      if (kodiBackgroundUpdates) {
        updateActivePlayersTimer = setTimeout(updateActivePlayers, 5000);
      }
    });
  } else if (kodiBackgroundUpdates) {
    updateActivePlayersTimer = setTimeout(updateActivePlayers, 5000);
  }
}

// Pause/resume updates, only update when application has focus
window.addEventListener('focus', function () {
  kodiBackgroundUpdates = true;

  // Restart update of player ids
  updateActivePlayers();
});

window.addEventListener('blur', function () {
  kodiBackgroundUpdates = false;

  // Pause player ids update
  clearTimeout(updateActivePlayers);
});

// Start the application
function start() {
  buttonsDependentOnActivePlayers = Array.prototype.slice.call(window.document.querySelectorAll('#' + [
    'previous',
    'reverse',
    'playpause',
    'forward',
    'next',
    'stop'
  ].join(',#')));

  // Bind menu
  inputs.menu = new Menu('power', function (input, value) {
    if (value === 'shutdown') {
      callKodi('System.Shutdown', undefined, callKodiErrorHandler);
    } else if (value === 'reboot') {
      callKodi('System.Reboot', undefined, callKodiErrorHandler);
    } else if (value === 'exit') {
      callKodi('Application.Quit', undefined, callKodiErrorHandler);
    }

    input.buttonElement.setAttribute('disabled', true);
    input.close();
  });

  // Bind to all controls in the GUI
  inputs.playpause = new Input('playpause', 'click', function () {
    callKodi('Player.PlayPause', [ activePlayers, 'toggle' ], callKodiErrorHandler);
  });

  inputs.stop = new Input('stop', 'click', function () {
    callKodi('Player.Stop', [ activePlayers ], callKodiErrorHandler);
  });

  inputs.volume = new Input('volume', 'change', function (input) {
    callKodi('Application.SetVolume', [ parseInt(input.element.value, 10) ], callKodiErrorHandler);
  });

  inputs.up = new Input('up', 'click', function () {
    callKodi('Input.Up', undefined, callKodiErrorHandler);
  });

  inputs.down = new Input('down', 'click', function () {
    callKodi('Input.Down', undefined, callKodiErrorHandler);
  });

  inputs.left = new Input('left', 'click', function () {
    callKodi('Input.Left', undefined, callKodiErrorHandler);
  });

  inputs.right = new Input('right', 'click', function () {
    callKodi('Input.Right', undefined, callKodiErrorHandler);
  });

  inputs.home = new Input('home', 'click', function () {
    callKodi('Input.Home', undefined, callKodiErrorHandler);
  });

  inputs.back = new Input('back', 'click', function () {
    callKodi('Input.Back', undefined, callKodiErrorHandler);
  });

  inputs.info = new Input('player', 'click', function () {
    callKodi('Input.ShowOSD', undefined, callKodiErrorHandler);
  });

  inputs.select = new Input('select', 'click', function () {
    callKodi('Input.Select', undefined, callKodiErrorHandler);
  });

  inputs.reverse = new Input('reverse', 'click', function () {
    callKodi('Player.SetSpeed', [ activePlayers, -4 ], callKodiErrorHandler);
  });

  inputs.forward = new Input('forward', 'click', function () {
    callKodi('Player.SetSpeed', [ activePlayers, 4 ], callKodiErrorHandler);
  });

  inputs.previous = new Input('previous', 'click', function () {
    callKodi('Player.GoTo', [ activePlayers, 'previous' ], callKodiErrorHandler);
  });

  inputs.next = new Input('next', 'click', function () {
    callKodi('Player.GoTo', [ activePlayers, 'next' ], callKodiErrorHandler);
  });

  inputs.change = new Input('text', 'change', function (input) {
    callKodi('Input.SendText', [ input.element.value, true ], callKodiErrorHandler);
    input.element.value = '';
    input.element.blur();
  });
  inputs.change.element.value = '';

  inputs.address = new Input('address', 'change', function (input) {
    localStorage.setItem('address', input.element.value);
    input.element.blur();
  });

  // Pre-populate value from local storage
  inputs.address.element.value = localStorage.getItem('address');

  // If no address are filled in, tell the use to do that first
  if (!inputs.address.element.value) {
    alert(translate('welcome_instructions') + ' ' + verifySettingsMessage);
    inputs.address.element.focus();
  }
}

// Load the translator and start the application
window.addEventListener('DOMContentLoaded', function () {
  translate = document.webL10n.get;

  document.webL10n.ready(function () {
    verifySettingsMessage = translate('help_enable_http_in_kodi');

    start();
  });
});
