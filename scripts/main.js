import "./ammo.js";
import "./machinegun.js";
import "./subcompactsmg.js";
import "./machinepistol.js";
import "./dvDisplay.js";

Hooks.once("ready", () => {
  ui.notifications.info("✅ Sanctum SOF-45 Hooks loaded", { permanent: false });
  console.log("Sanctum SOF-45 Hooks | Fully loaded");
});