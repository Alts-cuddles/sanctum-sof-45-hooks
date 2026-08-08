import "./ammo.js";
import "./machinegun.js";

Hooks.once("ready", () => {
  ui.notifications.info("✅ Sanctum CPR Hooks loaded", { permanent: false });
  console.log("Sanctum CPR Hooks | Fully loaded");
});
