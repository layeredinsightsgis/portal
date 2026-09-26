import { state } from './state.js';
import { dom } from './dom.js';
import { newGuid, applyEdits } from './utils.js';

function clientNameFor(clientId) {
  var match = state.clients.filter(function (c) {
    return c.ClientID === clientId;
  })[0];
  return match ? match.ClientName || clientId : clientId;
}
function renderClientOptions() {
  var sorted = state.clients.slice().sort(function (a, b) {
    return (a.ClientName || "").localeCompare(b.ClientName || "");
  });
  [dom.clientSelect, dom.editUnitClient, dom.mepClient].forEach(function (select) {
    var previousValue = select.value;
    while (select.options.length > 1) {
      select.remove(1);
    }
    sorted.forEach(function (attrs) {
      var option = document.createElement("option");
      option.value = attrs.ClientID;
      option.textContent = attrs.ClientName || attrs.ClientID;
      select.appendChild(option);
    });
    select.value = previousValue; // no-op if that client no longer exists
  });
}
function resetAddClientForm() {
  dom.addClientForm.reset();
  dom.newClientError.textContent = "";
  dom.addClientForm.hidden = true;
  dom.addClientBtn.textContent = "+ New";
}
function initClients() {
  dom.addClientBtn.addEventListener("click", function () {
    var showing = !dom.addClientForm.hidden;
    dom.addClientForm.hidden = showing;
    dom.addClientBtn.textContent = showing ? "+ New" : "Cancel";
  });
  dom.newClientCancel.addEventListener("click", resetAddClientForm);
  dom.addClientForm.addEventListener("submit", function (e) {
    e.preventDefault();
    dom.newClientError.textContent = "";
    if (!dom.newClientName.value.trim()) {
      dom.newClientError.textContent = "Client name is required.";
      return;
    }
    var attrs = {
      ClientID: newGuid(),
      ClientName: dom.newClientName.value.trim(),
      ContactName: dom.newClientContact.value || null,
      Phone: dom.newClientPhone.value || null,
      Email: dom.newClientEmail.value || null,
      Notes: dom.newClientNotes.value || null
    };
    var saveBtn = document.getElementById("newClientSave");
    saveBtn.disabled = true;
    applyEdits(7, {
      adds: [{
        attributes: attrs
      }]
    }).then(function (result) {
      if (result.error) {
        dom.newClientError.textContent = "ArcGIS error " + (result.error.code || "") + ": " + (result.error.message || JSON.stringify(result.error));
        saveBtn.disabled = false;
        return;
      }
      var addResult = result.addResults && result.addResults[0];
      if (!addResult || !addResult.success) {
        var msg = addResult && addResult.error && (addResult.error.description || addResult.error.message) || "Unexpected response: " + JSON.stringify(result);
        dom.newClientError.textContent = msg;
        saveBtn.disabled = false;
        return;
      }
      state.clients.push(attrs);
      renderClientOptions();
      dom.clientSelect.value = attrs.ClientID; // jump straight to the new client
      dom.clientSelect.dispatchEvent(new Event("change"));
      saveBtn.disabled = false;
      resetAddClientForm();
    }).catch(function (err) {
      dom.newClientError.textContent = "Could not reach the server: " + (err && err.message ? err.message : err);
      saveBtn.disabled = false;
    });
  });
}
export { clientNameFor, renderClientOptions, resetAddClientForm, initClients };
