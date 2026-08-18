import "./ammo.js";
import "./machinegun.js";
import "./subcompactsmg.js";
import "./machinepistol.js";
import "./dvDisplay.js";

Hooks.once("ready", () => {
  ui.notifications.info("✅ Sanctum CPR Hooks loaded", { permanent: false });
  console.log("Sanctum CPR Hooks | Fully loaded");
});