$(function() {
  $("#tabs").tabs({});
});

$(document).ready(function () {
  var namespace = '/test';
  var socket;

  var x = [];
  var temp = [];
  var hum = [];

  var traceTemp;
  var traceHum;

  var layout;

  var gaugeTemp;
  var gaugeHum;

  function updateConnectionState(state) {
    $('#con').text(state);
  }

  function updateButtonState(btnValue) {
    if (btnValue === 'start') {
      $('.button1').prop('disabled', true);
      $('.button2').prop('disabled', false);
    } else if (btnValue === 'stop') {
      $('.button1').prop('disabled', false);
      $('.button2').prop('disabled', true);
    }
  }

  $('#connectbtn').click(function(event) {
    console.log("connected!");
    $('#con').html("Connected!");

    socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);

    socket.emit('open_serial', {});

    socket.on('my_response', function (msg) {
      console.log(msg.temperature);
      console.log(msg.humidity);

      $('#log').append('CNT#: ' + msg.count + '   Temp: ' + msg.temperature + '   Hum: ' + msg.humidity + '<br>');

      gaugeTemp.value = msg.temperature;
      gaugeHum.value = msg.humidity;

      x.push(parseFloat(msg.count));
      temp.push(parseFloat(msg.temperature));
      hum.push(parseFloat(msg.humidity));

      traceTemp = {
        x: x,
        y: temp,
        mode: 'lines',
        name: 'Temperature',
      };

      traceHum = {
        x: x,
        y: hum,
        mode: 'lines',
        name: 'Humidity',
      };

      layout = {
        title: 'Temperature and Humidity Values',
        xaxis: { title: 'Time [s]' },
        yaxis: { title: 'Value' }
      };

      var traces = [traceTemp, traceHum];
      Plotly.newPlot($('#plotdiv')[0], traces, layout);

      $('#ac-status').text('AC heating/cooling: ' + msg.ac_status);
    });

    socket.on('set_temperature_ack', function (msg) {
      console.log(msg.status);
      console.log('Set temperature to:', msg.set_temperature);
    });

    socket.on('serial_open_ack', function (msg) {
      console.log(msg.status);
      updateConnectionState(msg.connection_state);
      updateButtonState(msg.btn_value);
    });

    socket.on('serial_disconnect_ack', function (msg) {
      console.log(msg.status);
      updateConnectionState(msg.connection_state);
      socket.disconnect();
    });

    socket.on('connection_state', function (msg) {
      updateConnectionState(msg.state);
      updateButtonState(msg.btn_value);
    });
  });

  $('#disconnectbtn').click(function(event) {
    socket.emit('disconnect_request');
  });

  gaugeTemp = new RadialGauge({
    renderTo: 'canvasTemp',
    width: 300,
    height: 300,
    units: "Temperature (°C)",
    minValue: -10,
    maxValue: 50,
    majorTicks: [
      "-10", "0", "10", "20", "30", "40", "50"
    ],
    minorTicks: 2,
    strokeTicks: true,
    highlights: [
      { "from": -10, "to": 10, "color": "rgba(0, 0, 255, .75)" },
      { "from": 10, "to": 30, "color": "rgba(255, 165, 0, .75)" },
      { "from": 30, "to": 50, "color": "rgba(255, 0, 0, .75)" }
    ],
    colorPlate: "#fff",
    borderShadowWidth: 5,
    borders: false,
    needleType: "arrow",
    needleWidth: 2,
    needleCircleSize: 7,
    needleCircleOuter: true,
    needleCircleInner: false,
    animationDuration: 1500,
    animationRule: "linear"
  });

  gaugeTemp.draw();

  gaugeHum = new RadialGauge({
    renderTo: 'canvasHum',
    width: 300,
    height: 300,
    units: "Humidity (%)",
    minValue: 0,
    maxValue: 100,
    majorTicks: [
      "0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"
    ],
    minorTicks: 2,
    strokeTicks: true,
    highlights: [
      { "from": 0, "to": 40, "color": "rgba(255, 165, 0, .75)" },
      { "from": 40, "to": 60, "color": "rgba(50, 200, 50, .75)" },
      { "from": 60, "to": 100, "color": "rgba(0, 0, 255, .75)" }
    ],
    colorPlate: "#fff",
    borderShadowWidth: 5,
    borders: false,
    needleType: "arrow",
    needleWidth: 2,
    needleCircleSize: 7,
    needleCircleOuter: true,
    needleCircleInner: false,
    animationDuration: 1500,
    animationRule: "linear"
  });

  gaugeHum.draw();

  $('form#buttonVal').submit(function (event) {
    var setTemp = $('#emit_value').val();
    socket.emit('set_temperature', { value: setTemp });
    return false;
  });



  $('.button1').click(function(event) {
    console.log($('.button1').val());
    socket.emit('click_start', { value: $('.button1').val() });
    return false;
  });

  $('.button2').click(function(event) {
    console.log($('.button2').val());
    socket.emit('click_stop', { value: $('.button2').val() });
    return false;
  });

  $('form#disconnect').submit(function (event) {
    socket.emit('disconnect_request');
    return false;
  });

  $('#load-file-data').click(function(event) {
	  
    $.get('/get_file_data', function(data) {
      if (data.error) {
        alert('Error loading file data: ' + data.error);
        return;
      }

      var file_x = data.map(item => new Date(item.timestamp * 1000));
      var file_temp = data.map(item => item.temperature);
      var file_hum = data.map(item => item.humidity);
      // Append file data to the text log
      var fileLog = $('#file-log');
      fileLog.empty();
   
      data.forEach(item => {
        var logItem = $('<div>').text(`Timestamp: ${new Date(item.timestamp * 1000).toLocaleString()}, Temperature: ${item.temperature}, Humidity: ${item.humidity}`);
        fileLog.append(logItem);
      });

      var file_traceTemp = {
        x: file_x,
        y: file_temp,
        mode: 'lines',
        name: 'File Temperature',
      };

      var file_traceHum = {
        x: file_x,
        y: file_hum,
        mode: 'lines',
        name: 'File Humidity',
      };

      var file_layout = {
        title: 'File Temperature and Humidity Values',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Value' }
      };

      var file_traces = [file_traceTemp, file_traceHum];
      Plotly.newPlot($('#file-plotdiv')[0], file_traces, file_layout);
    });
  });

 

  // Check connection state on page load
  socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port + namespace);
  socket.on('connection_state', function (msg) {
    updateConnectionState(msg.state);
    updateButtonState(msg.btn_value);
  });
});
