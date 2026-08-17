/* Google Analytics 4, loaded from one place.
 *
 * The official snippet is an inline <script> block that would have to be
 * copied into seven pages plus the diary entry template, with the measurement
 * id repeated in each — this file does the same work with the id written
 * once. Pages include it as:
 *
 *   <script src="/analytics.js?v=YYYYMMDD"></script>
 *
 * (absolute path: /d/{slug}.html entry pages live one level down.)
 * Behaviour matches the snippet: dataLayer and gtag() exist immediately, the
 * calls queue, and the tag library loads asynchronously without blocking
 * rendering.
 */
(function () {
  var MEASUREMENT_ID = "G-G7S2K2C1TC";

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);

  var tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
  document.head.appendChild(tag);
})();
