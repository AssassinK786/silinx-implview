// SPDX-License-Identifier: Apache-2.0
// boot.mjs -- a skyline page of make-page.mjs --app-out, as a server whose Content-Security-Policy runs no inline script
// shows it (Silinx: its 3D Skyline process): the widget's constants from the page's JSON element, then the widget,
// served beside this file (widgets/fasm-skyline/tool.js and skyline.js).
window.T27_WIDGET = JSON.parse(document.getElementById('t27-widget').textContent)
await import('./widgets/fasm-skyline/tool.js')
