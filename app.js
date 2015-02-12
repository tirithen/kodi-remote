'use strict';

/* global RSVP */

var inputs = {};

window.Promise = RSVP.Promise;

function Input(name, events, callback) {
  var self = this;

  this.name = name;
  this.element = document.querySelector('#' + name);
  this.events = Array.isArray(events) ? events : events.trim().split(/\s+/);

  this.events.forEach(function (event) {
    self.element.addEventListener(event, function (event) {
      callback(self, event);
    });
  });
}

function callKodi(method, parameters, id) {
  var data = JSON.stringify({
    id: id || Date.now(),
    jsonrpc: '2.0',
    method: method,
    params: parameters
  });

  return new Promise(function (resolve) {
    var url = 'http://' + inputs.ip.element.value + '/jsonrpc';
    var request = new XMLHttpRequest({ mozSystem: true });

    request.onload = function() {
      var response = request.response;

      if (request.status === 200) {
        console.log('XHR response:', response);
        resolve(response);
      } else {
        console.error('XHR error', response);
        resolve();
      }
    };

    request.open('POST', url, true);
    //request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
    request.setRequestHeader('Content-Length', data.length);
    request.setRequestHeader('Connection', 'close');
    request.send(data);

    console.log('Sending XHR request to: ' + url, data);
  });
}

window.addEventListener('load', function () {
  function getPlayerId() {
    return 1;
  }

  inputs.playpause = new Input('playpause', 'click', function () {
    callKodi('Player.PlayPause', [ getPlayerId(), 'toggle' ]);
  });

  inputs.stop = new Input('stop', 'click', function () {
    callKodi('Player.Stop', [ getPlayerId() ]);
  });

  inputs.volume = new Input('volume', 'change', function (input) {
    callKodi('Application.SetVolume', [ parseInt(input.element.value, 10) ]);
  });

  inputs.ip = new Input('ip', 'change', function (input) {
    localStorage.setItem('ip', input.element.value);
    input.element.blur();
  });

  inputs.up = new Input('up', 'click', function () {
    callKodi('Input.Up');
  });

  inputs.down = new Input('down', 'click', function () {
    callKodi('Input.Down');
  });

  inputs.left = new Input('left', 'click', function () {
    callKodi('Input.Left');
  });

  inputs.right = new Input('right', 'click', function () {
    callKodi('Input.Right');
  });

  inputs.home = new Input('home', 'click', function () {
    callKodi('Input.Home');
  });

  inputs.back = new Input('back', 'click', function () {
    callKodi('Input.Back');
  });

  inputs.info = new Input('info', 'click', function () {
    callKodi('Input.Info');
  });

  inputs.select = new Input('select', 'click', function () {
    callKodi('Input.Select');
  });

  inputs.change = new Input('text', 'change', function (input) {
    callKodi('Input.SendText', [ input.element.value, true ]);
    input.element.value = '';
    input.element.blur();
  });
  inputs.change.element.value = '';

  // Pre-populate value from local storage
  inputs.ip.element.value = localStorage.getItem('ip');

  console.log(inputs);
});
