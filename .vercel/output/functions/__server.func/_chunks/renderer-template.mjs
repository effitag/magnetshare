import { r as HTTPResponse } from "../_libs/h3+rou3+srvx.mjs";
//#region #nitro/virtual/renderer-template
var rendererTemplate = () => new HTTPResponse("<!doctype html>\n<html lang=\"he\" dir=\"rtl\">\n  <head><meta name=\"twitter:card\" content=\"summary_large_image\"><meta property=\"og:title\" content=\"MagnetimShare\">\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>MagnetimShare</title>\n    <link rel=\"icon\" href=\"/favicon.svg\" type=\"image/svg+xml\" />\n    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />\n    <link\n      href=\"https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Secular+One&display=swap\"\n      rel=\"stylesheet\"\n    />\n    <script type=\"module\" crossorigin src=\"/assets/index-BdpX8h5Z.js\"><\/script>\n    <link rel=\"modulepreload\" crossorigin href=\"/assets/rolldown-runtime-CbXtAM7H.js\">\n    <link rel=\"stylesheet\" crossorigin href=\"/assets/index-DmYAlfca.css\">\n  <link rel=\"manifest\" href=\"/__grok/manifest.webmanifest\"><link rel=\"apple-touch-icon\" href=\"/__grok/icon-180.png\"><meta name=\"apple-mobile-web-app-title\" content=\"MagnetimShare\"><meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black\"><meta name=\"theme-color\" content=\"#000000\"><script src=\"https://grok.com/grok-app-builder/extensions.js\" defer><\/script></head>\n  <body>\n    <div id=\"root\"></div>\n  </body>\n</html>\n", { headers: { "content-type": "text/html; charset=utf-8" } });
//#endregion
//#region node_modules/nitro/dist/runtime/internal/routes/renderer-template.mjs
function renderIndexHTML(event) {
	return rendererTemplate(event.req);
}
//#endregion
export { renderIndexHTML as default };
