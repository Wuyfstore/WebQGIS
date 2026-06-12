import { createApp } from "vue";
import App from "./App.vue";
import { installClientErrorLogging } from "./clientLogger";
import "virtual:uno.css";
import "./styles.css";
import "ol/ol.css";

const app = createApp(App);
installClientErrorLogging(app);
app.mount("#app");
