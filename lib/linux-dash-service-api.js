"use strict";

var settings   = require('../config');
var apiBaseUrl = settings.LDS_API_URL;
var logAndKill = require('./log-and-kill');
var http       = require('axios');
var os         = require("os");

var cachedUserAccessKey;

function getPublicIp() {
  return http.get('https://api.ipify.org?format=json').then(function (res) {
    return res.ip;
  });
}

function phoneHome() {
  console.log("Calling server with", process.env["LINUX_DASH_SEVER_ID"]);
  
  var url = apiBaseUrl 
    + 'users/' + cachedUserAccessKey 
    + '/servers/' + process.env["LINUX_DASH_SEVER_ID"];

  console.log(os.totalmem(), os.freemem());
  console.log(os.loadavg()[0]);

  var ramUtilization = parseInt((os.freemem() / os.totalmem()) * 100);
  var cpuUtilization = parseInt((os.loadavg()[0] * 100));

  var options = {
    url: url,
    method: 'PUT',
    json: true,
    body: {
      cpu_utilization: cpuUtilization,
      ram_utilization: ramUtilization,
      uptime: parseInt(os.uptime(), 10),
    }
  };
  
  return http(options).catch(function (err) {

    console.error("Error occurred while checking in with Linux Dash Service.");
    console.error(err.message);

  });

}

var ldsAPI = {
  
  _setAccessKey: function (key) {
    cachedUserAccessKey = key;
  },

  pingServer: function () {

    http.get(apiBaseUrl+'ping').catch(function () {
      logAndKill("Cannot reach Linux Dash API.");
    });

    return this;
  },

  verifyUserAccessKey: function (userAccessKey) {
   

   this._setAccessKey(userAccessKey);

    var url = apiBaseUrl + 'users/' + cachedUserAccessKey + '/verify';

    return http.get(url).catch(function (err) {

      logAndKill("User Access Key is invalid.");

    });

  },

  register: function () {

    var options = {
      url: apiBaseUrl + 'users/' + cachedUserAccessKey + '/servers',
      method: 'POST',
      json: true,
      body: {
        hostname: os.hostname(),
      }
    };

    return http(options).then(function (registrationResponse) {
      process.env["LINUX_DASH_SEVER_ID"] = registrationResponse.server_id;

    }).catch(function (err) {

      logAndKill(err.message);

    });

  },

  setupCheckinInterval: function () {
    setInterval(phoneHome, settings.ET_INTERVAL);
  },

  deregister: function (userAccessKey) {
    var url = apiBaseUrl + 'users/' + userAccessKey + '/servers/' + process.env["LINUX_DASH_SEVER_ID"];

    var options = {
      url: url,
      method: 'DELETE',
    };

    return http(options);
  }

};

module.exports = ldsAPI; 